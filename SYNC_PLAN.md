# Slow Mode v1.1 — Sync (Фаза 3 из AUTH_PLAN, детализация)

## Зачем

Вход уже есть (PR #2), но он ничего не делает: `persist.ts` пишет только
локально, а UI обещает «keep your notes across devices». Этот план закрывает
разрыв. Принципы прежние: локальное хранилище **первично**, облако догоняет;
офлайн — норма; никаких спиннеров и состояний загрузки на главном экране.

**Бэкенд:** отдельный сервер не нужен. Supabase Postgres + RLS — это и есть
весь бек. Единственный «серверный код» появится позже, в Фазе 4
(edge function удаления аккаунта) — он вне этого плана.

---

## Пререквизит (руками, в Supabase SQL editor)

```sql
create table public.states (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.states enable row level security;

create policy "own state" on public.states
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`on delete cascade` — задел под Фазу 4: удаление auth-пользователя утянет
и его state.

---

## Ключевые решения

- **Last-write-wins по `updatedAt` на уровне всего state**, но merge —
  по полям (см. ниже). Никаких CRDT: продукт — три текстовых поля и история,
  конфликты редки и дёшевы.
- **Пассивный pull**: при появлении сессии и при возврате вкладки/приложения
  в фокус (`visibilitychange → visible`). Никакого realtime на MVP.
- **Дебаунс-push**: локально мгновенно (как сейчас), в облако — 5 с после
  последнего изменения + flush при уходе со страницы. Паттерн дебаунса уже
  есть в `useStorage.ts`.
- **Выход не трогает локальные данные.** Sign out = перестали синхронизировать,
  и только.

---

## Шаг 1 — `updatedAt` на state

`src/types/index.ts`:

```ts
export interface SlowModeState {
  horizon: Horizon
  now: Now
  plan: Plan
  history: NowEntry[]
  updatedAt: string // ISO — любое изменение state бампает
}
```

- `defaultState()` — добавить `updatedAt: new Date().toISOString()`.
- `normalize()` — миграция старых данных: если поля нет, взять
  `horizon.updatedAt` (он ISO и есть всегда), иначе `now()`.
- В `useStorage` каждый сеттер (`setHorizon`, `setNow`, `setPlan`,
  `importState`, rollOver при переносе дня) бампает `updatedAt`.

## Шаг 2 — `src/sync/cloud.ts`

Тонкий модуль поверх supabase-клиента (`../auth/client`):

```ts
pullState(userId): Promise<{ state: SlowModeState; updatedAt: string } | null>
pushState(userId, state): Promise<void>   // upsert, onConflict: 'user_id'
```

- `pull`: `select state, updated_at from states where user_id = ...`,
  `maybeSingle()`. Прогнать через `normalize()` — облаку доверяем не больше,
  чем localStorage.
- `push`: `upsert({ user_id, state, updated_at: state.updatedAt })`.
- Все ошибки — `console.error('sync failed:', ...)` (конвенция из
  AuthContext/History), наружу не бросать. Нет сети — просто не
  синхронизировалось, следующий push догонит.

## Шаг 3 — merge

`src/sync/merge.ts`, чистая функция + юнит-смысл (можно без раннера,
но логика должна быть изолирована):

```ts
mergeStates(a: SlowModeState, b: SlowModeState): SlowModeState
```

Правила:
- `horizon` — чей `horizon.updatedAt` новее.
- `now` и `plan` — чья `date` новее; при равной дате — из state с более
  новым верхним `updatedAt`.
- `history` — union по `date`; при совпадении даты — запись из state
  с более новым верхним `updatedAt`. Сортировка: новые первыми
  (как в `rollOver`).
- Верхний `updatedAt` результата = max двух.
- После merge прогнать через `rollOver` (день мог смениться).

## Шаг 4 — интеграция: `src/sync/useSync.ts`

Хук, живущий в `App.tsx` (или обёртке), получает `state`, `importState`
(или отдельный тихий `applyRemote`, чтобы не бампать `updatedAt` при
применении удалённого) и `session` из `useAuth`:

1. **Сессия появилась** (вход или запуск с живой сессией):
   `pull` → облако пусто → `push(local)`;
   облако есть → `merged = mergeStates(local, cloud)` → применить локально
   → `push(merged)`.
2. **Локальное изменение** (по `state.updatedAt`): дебаунс 5000 мс → `push`.
   Flush по `visibilitychange → hidden` и `pagehide`
   (тот же паттерн, что flush в `useStorage`).
3. **Возврат в фокус** (`visible`): `pull`; если `cloud.updatedAt >
   local.updatedAt` → merge → применить. Иначе ничего.
4. **Защита от эха**: после собственного push запомнить отправленный
   `updatedAt` и не реагировать на pull с тем же значением.
5. Нет сессии или `!isAuthEnabled` — хук ничего не делает.

Важно: применение удалённого state НЕ должно перезатирать текст, который
пользователь набирает прямо сейчас. Простейшая защита: не применять merge,
пока фокус в textarea (отложить до blur/hidden). Тихое место — значит текст
не прыгает под руками.

## Шаг 5 — честный copy в History.tsx

- Не залогинен: «Everything you write stays on this device.» (как сейчас).
- Залогинен: «Synced quietly to your account.» — или тише: просто email,
  без обещаний. Никаких индикаторов «syncing…» на главном экране.

---

## Что НЕ делаем

- Realtime-подписки, presence, мультивкладочный live-sync.
- Разрешение конфликтов сложнее last-write-wins + union истории.
- Шифрование на клиенте (можно обсудить отдельно, не сейчас).
- Удаление аккаунта — это Фаза 4 (AUTH_PLAN), отдельная итерация.

---

## Проверка (руками)

1. Веб, вход Google, чистое облако → локальные данные появились в таблице.
2. Второй браузер (или инкогнито), тот же аккаунт → данные приехали.
3. Изменить «сейчас» в одном → в другом после возврата в фокус подтянулось.
4. Разойтись офлайн: изменить в обоих, потом дать сеть → merge не потерял
   ни одной записи истории, поля взялись более свежие.
5. Выход → локальные данные на месте, облако не трогается.
6. Смена дня при живой сессии → rollOver уехал в облако.
7. `npm run build` зелёный; без ключей в env всё работает как v1.

## Критерий готовности

Пишу на телефоне утром → открываю ноут → вижу то же самое, не заметив,
что была какая-то «синхронизация».
