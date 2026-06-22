# Slow Mode

A quiet space for engineers who work with AI tools and lose their sense of direction. Not a productivity app. A place to breathe and see the horizon.

## What it does

One screen. Three layers:

- **Horizon** — your one main goal. Changes rarely. Always visible.
- **Now** — where you are today. A short note that resets each day.
- **Plan** — the next step. Free-form, no structure.

Data lives in local storage. No backend, no sync, no tracking.

## Tech stack

- React 18 + TypeScript
- Vite
- Capacitor (iOS)
- CSS Modules
- `@capacitor/preferences` for native persistence

## Development

```bash
npm install
npm run dev
```

## iOS

```bash
npm run ios:open   # builds, syncs, and opens in Xcode
```

Requires Xcode and CocoaPods installed.

## Design principles

- Silence is visible — lots of empty space
- One thought on screen at a time
- No buttons without reason, no panels, no icons
- Typography is the main element
