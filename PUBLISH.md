# Slow Mode — установка на iPhone и публикация в App Store

iOS-проект уже создан в `ios/` (Capacitor). После любых правок веб-кода:

```bash
npm run ios:sync   # пересобрать веб и скопировать в iOS-проект
npm run ios:open   # то же + открыть Xcode
```

---

## 1. Поставить на свой iPhone по кабелю (бесплатно, без Developer Program)

Достаточно обычного Apple ID. Приложение, подписанное бесплатным профилем, живёт на телефоне 7 дней, потом нужно переустановить из Xcode (данные при этом сохраняются).

1. `npm run ios:open` — откроется Xcode.
2. Xcode → Settings → Accounts → `+` → войди своим Apple ID.
3. В навигаторе слева выбери проект **App** → таргет **App** → вкладка **Signing & Capabilities**:
   - ✅ Automatically manage signing
   - Team: выбери `<твоё имя> (Personal Team)`
   - Если ругается на Bundle Identifier — он должен быть уникальным.
     Сейчас стоит `com.kartoshkin.slowmode`; при конфликте поменяй на любой свой.
4. Подключи iPhone кабелем. На телефоне: «Доверять этому компьютеру» → Да.
5. На iPhone включи режим разработчика: Настройки → Конфиденциальность и безопасность → Режим разработчика → вкл → перезагрузка.
6. В Xcode вверху выбери свой iPhone как устройство запуска → ⌘R.
7. Первый запуск: iOS заблокирует «ненадёжного разработчика».
   Настройки → Основные → VPN и управление устройством → твой Apple ID → Доверять.

## 2. Публикация в App Store (когда будет аккаунт за $99/год)

### Подготовка (1–2 дня на активацию аккаунта)

1. Зарегистрируйся в [Apple Developer Program](https://developer.apple.com/programs/enroll/) — $99/год.
2. В [App Store Connect](https://appstoreconnect.apple.com) → My Apps → `+` → New App:
   - Platform: iOS, Name: **Slow Mode** (если занято — например, «Slow Mode — quiet horizon»)
   - Bundle ID: `com.kartoshkin.slowmode` (создаётся в [Identifiers](https://developer.apple.com/account/resources/identifiers/list))
   - SKU: `slowmode-001`

### Сборка и загрузка

1. В Xcode: Signing & Capabilities → Team: смени Personal Team на платную команду.
2. Вверху выбери устройство **Any iOS Device (arm64)**.
3. Product → Archive → по окончании Distribute App → App Store Connect → Upload.
4. Через ~15 минут сборка появится в App Store Connect → TestFlight.

### Метаданные (минимум для ревью)

- **Скриншоты**: 6.9" (iPhone 16 Pro Max) и 6.5" — можно снять в симуляторе (⌘S).
- **Описание**: коротко и честно — «A quiet place to see your horizon. Three slow questions a day — nothing else.»
- **Privacy**: App Privacy → **Data Not Collected** — приложение ничего не собирает,
  нет аналитики, нет сети. Это сильно упрощает ревью.
- **Privacy Policy URL**: обязателен даже при «Data Not Collected» — одна страница
  «мы не собираем данные» (подойдёт GitHub Pages).
- **Age Rating**: 4+.

### Чего ждать на ревью

- Обычно 1–3 дня.
- Главный риск для обёрток над веб-приложениями — guideline 4.2 (minimum functionality).
  У нас аргументы в порядке: приложение полностью офлайн, данные в нативном
  хранилище, нет признаков «просто сайта». Если всё же отклонят — отвечаем в
  Resolution Center, объясняем оффлайн-природу.

## 3. Вход через Google / Apple — отложено до v1.1

Решение: в v1 входа нет (данные локальные, бэкенда нет). Когда появится спрос:

- По правилам Apple (guideline 4.8): если есть вход через Google, **обязан** быть и Sign in with Apple.
- Вход должен быть **опциональным** (guideline 5.1.1) — приложение обязано работать без аккаунта.
- План: Supabase (бесплатный тариф) как бэкенд → Sign in with Apple (нативный) + Google OAuth → синхронизация `SlowModeState` между устройствами. Слой хранения уже изолирован в `src/utils/persist.ts` — туда и встанет синхронизация.
