# Focus On It

[![CI](https://github.com/tkexit/slow/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/tkexit/slow/actions/workflows/ci.yml)

A quiet place to see your horizon. One screen, three slow questions a day, nothing else.

Built end to end by one person, from problem framing to App Store, Google Play and a
live landing page, working with AI coding agents through pull requests.

<!-- SCREENSHOT: main screen, light and dark side by side -->

**Live:** [unfry.dev](https://unfry.dev) · [Web app](https://app.unfry.dev) ·
App Store <!-- TODO: link --> · Google Play <!-- TODO: link -->

---

## The problem

Engineers who work with AI tools all day ship more than ever and lose the thread faster
than ever. Agents run in parallel, context switches every few minutes, and by evening it
is hard to say what the day was *for*. People call it **AI brain fry**: not burnout from
too much work, but disorientation from too many fast, shallow loops.

Productivity apps make this worse. They add tasks, streaks, reminders and dashboards,
which is one more system to feed.

## Who it is for

Engineers and builders who spend their days with Claude, Cursor, Copilot and friends,
and who want one calm place to answer three questions:

- **Horizon:** what am I actually working toward? Changes rarely, always visible.
- **Now:** where am I today? A short note that resets every day.
- **Next step:** what is the one next thing? Free-form, no structure.

Yesterday's "now" quietly moves into a hidden history, so you can look back without
being asked to.

<!-- GIF: typing into Now, then opening history the next day -->

## Product principles

- **No tracking pressure.** No streaks, no counters, no reminders, no "you missed a day".
- **Passive over active.** The app waits to be opened. It never pings, nudges or scores.
- **Local-first.** Your text lives on your device. Works fully offline, no account needed.
- **Silence is visible.** Lots of empty space, one thought on screen at a time.
- **Every element earns its place.** No buttons without reason, no panels, no icons.
  Copy is phrased as gentle questions.

These are hard constraints, not taste. They decide what *not* to build: see
[ADR-0002](docs/adr/0002-no-ai-in-product.md) for why a product about AI fatigue has no
AI inside it.

## Key decisions

| Decision | Why | Where |
|---|---|---|
| **Local storage is the source of truth** | The app must work offline and without an account (App Store guideline 5.1.1). The cloud, when it comes, is a layer on top, never a replacement. | [`src/utils/persist.ts`](src/utils/persist.ts) |
| **Dual persistence on device** | iOS can clear WebView localStorage under storage pressure, so every write also goes to native Capacitor Preferences. Native restore only fills an *empty* state and never overwrites typed text. | [`src/utils/persist.ts`](src/utils/persist.ts), [`src/state/storage.ts`](src/state/storage.ts) |
| **Day rollover as a pure, tested function** | Moving yesterday's text into history is the riskiest code in the app: a bug loses data silently. It is a pure function, unit-tested at day boundaries with fake timers. | [`src/state/storage.ts`](src/state/storage.ts), [tests](src/state/storage.test.ts) |
| **Optional auth, lazily loaded** | Sign-in exists only to enable future sync. Without keys it is fully disabled, and supabase-js (~215 kB) ships as a separate chunk that a keyless build never downloads. | [PR #2](https://github.com/tkexit/slow/pull/2), [`src/auth/client.ts`](src/auth/client.ts) |
| **No silent failures** | OAuth deep-link errors used to be swallowed (`.catch(() => {})`): tap "Continue with Google", the browser closes, nothing happens, nothing logged. Now every failure path is surfaced. | [PR #3](https://github.com/tkexit/slow/pull/3) |
| **Cross-device sync: per-field merge, optimistic CAS** | Whole-blob last-write-wins loses data in the main scenario (phone edits "now", laptop edits "plan"). Designed as a pure `merge(a, b)` with per-field LWW, history union and a `rev` counter, without Realtime. | [ADR-0001](docs/adr/0001-cross-device-sync.md) |

## What shipped

- **iOS app.** Capacitor 8 shell with SPM, native persistence, dark mode, splash and icons. <!-- TODO: App Store link -->
- **Android app.** Edge-to-edge on Android 15+, themed system bars. <!-- TODO: Google Play link -->
- **Web app / PWA** at [app.unfry.dev](https://app.unfry.dev), with a service worker for offline use.
- **Landing page** at [unfry.dev](https://unfry.dev): static HTML on a Hetzner box behind Caddy,
  provisioned with [cloud-init](deploy/cloud-init.yaml), GA4 with Consent Mode v2 (denied by default).

<!-- SCREENSHOT: iOS and Android side by side -->

## How I build with AI

AI agents write a large share of the code here. The process around them keeps the quality.

- **Agent instructions live in the repo.** [`CLAUDE.md`](CLAUDE.md) and [`AGENTS.md`](AGENTS.md)
  describe the architecture, its invariants (local storage is the source of truth, never
  import supabase-js statically, keep rollover consistent across call sites) and the
  commands. Claude Code and Codex start every task from the same context.
- **Work lands through pull requests.** One concern per branch, a description that says
  what, why and how to verify. Agents open PRs; I review and merge.
- **Two layers of review on every PR.** [CI](.github/workflows/ci.yml) runs the strict
  type check, lint, formatting, the production build and the unit tests.
  [Claude Code Review](.github/workflows/claude-code-review.yml) comments on intent and
  edge cases. `@claude` in an issue or PR comment hands a task to an agent
  ([workflow](.github/workflows/claude.yml)); only repo collaborators can trigger it.
- **Decisions are written down.** Non-trivial choices get an ADR in [`docs/adr/`](docs/adr)
  and a plan in [`docs/`](docs) *before* code, so an agent works against an agreed design
  rather than inventing one.
- **Agents' work is checked, not trusted.** Tests target the code where a silent bug would
  cost user data. PR descriptions call out what was deliberately *not* done and why.

<!-- SCREENSHOT: a PR with the CI check and a Claude review comment -->

## Tech stack

- React 18, TypeScript (strict), Vite, CSS Modules
- Capacitor 8 for iOS (SPM) and Android, with `@capacitor/preferences` for native persistence
- Supabase (optional, lazily loaded): Google and Apple OAuth with PKCE
- Vitest, ESLint and Prettier, GitHub Actions for CI
- Landing: static HTML, Caddy and Docker on Hetzner, provisioned with cloud-init

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest)
npm run lint       # ESLint; npm run format runs Prettier
npm run build      # strict type check + production build
```

The app runs fully local by default. To enable the optional sign-in, copy
`.env.example` to `.env.local` and add Supabase keys.

Native shells (need Xcode or Android Studio):

```bash
npm run ios:open       # build, cap sync, open in Xcode
npm run android:open   # build, cap sync, open in Android Studio
```

## Project layout

```
src/state/      pure state logic (normalize, day rollover), unit-tested
src/hooks/      useStorage: wires state logic to persistence and lifecycle
src/            the rest of the web app (components, utils, auth)
public/         PWA icons, manifest, service worker
ios/  android/  Capacitor native shells
landing/        the unfry.dev landing page
deploy/         Caddy, Docker Compose and cloud-init for the landing server
docs/           plans and decisions (publishing, auth, sync, ADRs)
```

## License

Source-available for viewing and evaluation. All rights reserved, see [LICENSE](LICENSE).
