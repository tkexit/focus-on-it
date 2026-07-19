# Slow Mode — installing on iPhone and publishing to the App Store

The iOS project already exists in `ios/` (Capacitor). After any web-code changes:

```bash
npm run ios:sync   # rebuild the web app and copy it into the iOS project
npm run ios:open   # same, plus opens Xcode
```

---

## 1. Install on your own iPhone via cable (free, no Developer Program)

A regular Apple ID is enough. An app signed with a free profile lives on the phone for 7 days, then needs reinstalling from Xcode (data is preserved).

1. `npm run ios:open` — opens Xcode.
2. Xcode → Settings → Accounts → `+` → sign in with your Apple ID.
3. In the left navigator, select the **App** project → **App** target → **Signing & Capabilities** tab:
   - ✅ Automatically manage signing
   - Team: pick `<your name> (Personal Team)`
   - If it complains about Bundle Identifier — it must be unique.
     Currently set to `com.kartoshkin.slowmode`; change it to any value of your own on conflict.
4. Connect the iPhone via cable. On the phone: "Trust This Computer" → Yes.
5. On the iPhone, enable Developer Mode: Settings → Privacy & Security → Developer Mode → on → reboot.
6. In Xcode, at the top, select your iPhone as the run destination → ⌘R.
7. First launch: iOS will block the "untrusted developer".
   Settings → General → VPN & Device Management → your Apple ID → Trust.

## 2. Publishing to the App Store (once you have a paid account at $99/year)

### Preparation (1–2 days for account activation)

1. Sign up for the [Apple Developer Program](https://developer.apple.com/programs/enroll/) — $99/year.
2. In [App Store Connect](https://appstoreconnect.apple.com) → My Apps → `+` → New App:
   - Platform: iOS, Name: **Slow Mode** (if taken — e.g., "Slow Mode — quiet horizon")
   - Bundle ID: `com.kartoshkin.slowmode` (created in [Identifiers](https://developer.apple.com/account/resources/identifiers/list))
   - SKU: `slowmode-001`

### Building for the store — no sign-in (v1)

`.env.local` holds the Supabase keys — with them present, the build ships
with the sign-in UI (Google/Apple buttons in the history panel), but the
backend for v1 isn't set up. The store build must be made without the keys:

```bash
mv .env.local .env.local.dev   # remove the keys
npm run ios:sync               # rebuild the web app and sync iOS
mv .env.local.dev .env.local   # restore for development
```

Check before Archive: launch the app, open the history panel (the dot at
the bottom) — there should be no "Continue with Google/Apple" buttons.

### Building and uploading

1. In Xcode: Signing & Capabilities → Team: switch from Personal Team to the paid team.
2. At the top, select **Any iOS Device (arm64)** as the destination.
3. Product → Archive → once done, Distribute App → App Store Connect → Upload.
4. The build shows up in App Store Connect → TestFlight after about 15 minutes.

### Metadata (minimum for review)

- **Screenshots**: 6.9" (iPhone 16 Pro Max) and 6.5" — can be captured in the simulator (⌘S).
- **Description**: short and honest — "A quiet place to see your horizon. Three slow questions a day — nothing else."
- **Privacy**: App Privacy → **Data Not Collected** — the app collects nothing,
  no analytics, no network calls. This greatly simplifies review.
- **Privacy Policy URL**: required even with "Data Not Collected" — one page
  saying "we don't collect data" (GitHub Pages works fine).
- **Age Rating**: 4+.

### What to expect during review

- Usually 1–3 days.
- The main risk for web-app wrappers is guideline 4.2 (minimum functionality).
  Our arguments hold up: the app is fully offline, data lives in native
  storage, nothing about it reads as "just a website." If rejected anyway,
  reply in the Resolution Center explaining the offline nature.

## 3. Google / Apple sign-in — deferred to v1.1

Decision: v1 ships without sign-in (data is local, no backend). Once demand shows up:

- Per Apple's rules (guideline 4.8): if Google sign-in is offered, Sign in with Apple **must** be offered too.
- Sign-in must be **optional** (guideline 5.1.1) — the app must work without an account.
- Plan: Supabase (free tier) as the backend → Sign in with Apple (native) + Google OAuth → sync `SlowModeState` across devices. The storage layer is already isolated in `src/utils/persist.ts` — that's where sync will land.
