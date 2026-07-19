# Slow Mode

A quiet space for engineers who work with AI tools and lose their sense of direction. Not a productivity app. A place to breathe and see the horizon.

## What it does

One screen. Three layers:

- **Horizon** — your one main goal. Changes rarely. Always visible.
- **Now** — where you are today. A short note that resets each day.
- **Plan** — the next step. Free-form, no structure.

Data lives in local storage. No backend, no sync, no tracking. An optional
auth layer (Supabase) exists for the future cross-device sync, but without
keys in `.env.local` it is fully disabled and never even downloaded.

## Tech stack

- React 18 + TypeScript
- Vite
- Capacitor (iOS + Android)
- CSS Modules
- `@capacitor/preferences` for native persistence

## Development

```bash
npm install
npm run dev
```

## Native apps

```bash
npm run ios:open       # build, sync, open in Xcode (needs Xcode + CocoaPods)
npm run android:open   # build, sync, open in Android Studio
```

## Project layout

```
src/            the web app (components, hooks, utils, auth)
public/         PWA icons, manifest, service worker
ios/  android/  Capacitor native shells
assets/         logo sources for @capacitor/assets icon generation
landing/        standalone landing page
docs/           plans and decisions (publishing, auth, sync, ADRs)
```

## Design principles

- Silence is visible — lots of empty space
- One thought on screen at a time
- No buttons without reason, no panels, no icons
- Typography is the main element
