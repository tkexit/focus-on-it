# Slow Mode v1.1 — Auth Layer (Google + Apple через Supabase)

## Зачем

Вход нужен только для синхронизации данных между устройствами. Приложение
обязано полностью работать без входа (guideline 5.1.1) — auth это надстройка
над существующим локальным хранилищем, а не его замена.

## Ключевые решения

- **Supabase Auth + Postgres** — auth и хранилище состояния в одном месте,
  бесплатного тира хватит надолго.
- **Google + Sign in with Apple вместе, в одном релизе.** Guideline 4.8:
  если есть сторонний вход (Google), обязан быть и privacy-вариант —
  на практике это Sign in with Apple. Только Google = реджект.
- **OAuth через системный браузер**, без нативных SDK:
  `supabase.auth.signInWithOAuth()` + `@capacitor/browser`
  (SFSafariViewController — Google его принимает, в отличие от WebView)
  + возврат в приложение по deep link `com.kartoshkin.slowmode://auth-callback`.
  Плюсы: нет новых нативных зависимостей (SPM-риск нулевой), один код-путь
  для обоих провайдеров, работает и в вебе. Нативные шторки
  (`@capgo/capacitor-social-login`) — возможный апгрейд позже, если UX
  браузерного окна будет раздражать.
- **Синхронизация**: одна таблица со state как jsonb, last-write-wins по
  `updatedAt`, при первом входе — merge локального и облачного состояния
  (история объединяется, поля берутся более свежие).

## Блокирующие пререквизиты (руками, вне кода)

1. **Платный Apple Developer Program ($99/год)** — без него нет capability
   Sign in with Apple и нет публикации. Это гейт всего релиза v1.1.
2. **Supabase-проект** (region EU, ближе к пользователю).
3. **Google Cloud Console**: OAuth consent screen + Web client
   (client ID/secret — для Supabase) + iOS client (bundle
   `com.kartoshkin.slowmode`).
4. **Apple Developer portal**: App ID с capability Sign in with Apple,
   Services ID, ключ `.p8` — данные для Apple-провайдера в Supabase.
5. В Supabase включить провайдеры Google и Apple, в Redirect URLs добавить
   `com.kartoshkin.slowmode://auth-callback`.

## Фазы разработки

### Фаза 1 — слой auth в приложении
- `npm i @supabase/supabase-js @capacitor/browser @capacitor/app`
- `src/auth/client.ts` — supabase-клиент (url/anon key через `import.meta.env`,
  `.env.local` в gitignore; anon key не секрет, но пусть живёт в env).
  Storage для сессии — тот же паттерн, что в `persist.ts` (localStorage
  ненадёжен на iOS → write-through в Preferences).
- `src/auth/AuthContext.tsx` — React-контекст: `session`, `signInWithGoogle`,
  `signInWithApple`, `signOut`. Вход: `signInWithOAuth({ skipBrowserRedirect:
  true })` → `Browser.open(url)` → слушатель `App.addListener('appUrlOpen')`
  ловит callback, `exchangeCodeForSession` (PKCE).
- iOS: URL scheme `com.kartoshkin.slowmode` в `Info.plist`
  (`CFBundleURLTypes`).

### Фаза 2 — UI
- Точка входа — маленькая и необязательная (шестерёнка/низ экрана, рядом с
  бэкапом из `backup.ts`): «Войти, чтобы синхронизировать». Никаких экранов
  логина при старте.
- Залогинен: email + «Выйти» + «Удалить аккаунт».

### Фаза 3 — синхронизация
- Таблица `states`: `user_id uuid PK → auth.users`, `state jsonb`,
  `updated_at timestamptz`. RLS: `auth.uid() = user_id` на всё.
- `persist.ts` расширить третьим write-through: локально мгновенно, в облако
  дебаунсом (5–10 с, и flush на visibilitychange — паттерн уже есть в
  `useStorage.ts`).
- Первый вход: облако пусто → push локального; оба непустые → merge
  (history — union по датам, horizon/now/plan — что свежее).
- Офлайн — норма: локальное хранилище первично, облако догоняет.

### Фаза 4 — удаление аккаунта и комплаенс
- Guideline 5.1.1(v): раз есть создание аккаунта — **обязано быть удаление
  аккаунта прямо в приложении**. Edge function `delete-account`
  (service role: удалить строку states + auth-пользователя), кнопка в UI
  с подтверждением.
- Privacy policy обновить (какие данные, где хранятся), App Privacy labels
  в App Store Connect: email + user content, linked to user.

### Фаза 5 — проверка
- На устройстве: вход Google, вход Apple, выход, повторный вход, merge
  локальных данных, работа без сети, удаление аккаунта.
- Sign in with Apple: проверить сценарий «Hide My Email».
- Web-версия (`npm run dev`) — вход тоже должен работать (redirect-флоу).

## Порядок

Пререквизиты (руками) → Ф1 → Ф2 → Ф3 → Ф4 → Ф5. Ф1+Ф2 можно писать и
проверять в вебе ещё до покупки Apple Developer (Google-вход заведётся),
Apple-провайдер и релиз — после покупки.
