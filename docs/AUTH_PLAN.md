# Slow Mode v1.1 — Auth Layer (Google + Apple via Supabase)

## Why

Sign-in exists only to sync data across devices. The app must fully work
without signing in (guideline 5.1.1) — auth is a layer on top of the
existing local storage, not a replacement for it.

## Key decisions

- **Supabase Auth + Postgres** — auth and state storage in one place,
  the free tier will last a long time.
- **Google + Sign in with Apple together, in one release.** Guideline 4.8:
  if there's third-party sign-in (Google), there must also be a
  privacy-respecting option — in practice that's Sign in with Apple.
  Google-only = rejection.
- **OAuth through the system browser**, no native SDKs:
  `supabase.auth.signInWithOAuth()` + `@capacitor/browser`
  (SFSafariViewController — Google accepts it, unlike a WebView)
  + return to the app via deep link `com.kartoshkin.slowmode://auth-callback`.
  Upside: no new native dependencies (zero SPM risk), one code path
  for both providers, works on the web too. Native sheets
  (`@capgo/capacitor-social-login`) are a possible later upgrade if the
  browser-window UX turns out to be annoying.
- **Sync**: one table holding state as jsonb, last-write-wins by
  `updatedAt`, and on first sign-in — merge local and cloud state
  (history gets unioned, fields take the more recent value).

## Blocking prerequisites (manual, outside the code)

1. **Paid Apple Developer Program ($99/year)** — without it there's no
   Sign in with Apple capability and no publishing. This gates the whole
   v1.1 release.
2. **Supabase project** (EU region, closer to the user).
3. **Google Cloud Console**: OAuth consent screen + Web client
   (client ID/secret — for Supabase) + iOS client (bundle
   `com.kartoshkin.slowmode`).
4. **Apple Developer portal**: App ID with the Sign in with Apple
   capability, Services ID, `.p8` key — data for the Apple provider in
   Supabase.
5. In Supabase, enable the Google and Apple providers, and add
   `com.kartoshkin.slowmode://auth-callback` to Redirect URLs.

## Development phases

### Phase 1 — auth layer in the app
- `npm i @supabase/supabase-js @capacitor/browser @capacitor/app`
- `src/auth/client.ts` — Supabase client (url/anon key via `import.meta.env`,
  `.env.local` in gitignore; the anon key isn't secret, but let it live in
  env anyway). Session storage uses the same pattern as `persist.ts`
  (localStorage is unreliable on iOS → write-through to Preferences).
- `src/auth/AuthContext.tsx` — React context: `session`, `signInWithGoogle`,
  `signInWithApple`, `signOut`. Sign-in: `signInWithOAuth({ skipBrowserRedirect:
  true })` → `Browser.open(url)` → an `App.addListener('appUrlOpen')`
  listener catches the callback, `exchangeCodeForSession` (PKCE).
- iOS: URL scheme `com.kartoshkin.slowmode` in `Info.plist`
  (`CFBundleURLTypes`).

### Phase 2 — UI
- Entry point is small and optional (gear icon / bottom of screen, next to
  the backup controls in `backup.ts`): "Sign in to sync." No login screens
  on startup.
- Signed in: email + "Sign out" + "Delete account".

### Phase 3 — sync
- Table `states`: `user_id uuid PK → auth.users`, `state jsonb`,
  `updated_at timestamptz`. RLS: `auth.uid() = user_id` on everything.
- Extend `persist.ts` with a third write-through: local instantly, cloud
  debounced (5–10 s, with a flush on visibilitychange — the pattern
  already exists in `useStorage.ts`).
- First sign-in: cloud empty → push local state; both non-empty → merge
  (history — union by date, horizon/now/plan — whichever is more recent).
- Offline is the norm: local storage is primary, the cloud catches up.

### Phase 4 — account deletion and compliance
- Guideline 5.1.1(v): since account creation exists, account deletion
  **must** be available right in the app. Edge function `delete-account`
  (service role: delete the `states` row + the auth user), a button in the
  UI with confirmation.
- Update the privacy policy (what data, where it's stored), App Privacy
  labels in App Store Connect: email + user content, linked to user.

### Phase 5 — verification
- On device: Google sign-in, Apple sign-in, sign-out, sign-in again, merge
  of local data, working offline, account deletion.
- Sign in with Apple: check the "Hide My Email" scenario.
- Web version (`npm run dev`) — sign-in should work there too (redirect flow).

## Order

Prerequisites (manual) → Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5.
Phase 1 + Phase 2 can be written and tested on the web even before buying
an Apple Developer account (Google sign-in will work), the Apple provider
and the release happen after the purchase.
