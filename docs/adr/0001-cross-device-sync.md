# ADR-0001: Cross-device state synchronization

- **Status:** proposed
- **Date:** 2026-07-14
- **Related:** [AUTH_PLAN.md](../AUTH_PLAN.md) (Phase 3 — this ADR details and supersedes it), [SYNC_PLAN.md](../SYNC_PLAN.md) — the implementation plan

## Context

Slow Mode is a local-first app: all state (`horizon`, `now`, `plan`,
`history`) is one small object, a few kilobytes, living in localStorage +
Capacitor Preferences (`src/utils/persist.ts`). Offline is the norm, not a
degradation. The auth layer (Supabase, Google + Apple, PKCE) is already on
main and fully optional: without keys in env the app runs exactly as v1.

The only reason to sign in is syncing across devices (phone ↔ laptop).
Domain specifics:

- one user, rarely two active devices at once;
- three text fields and an append-only history by date — no collections,
  no collaborative editing;
- "day rollover" happens independently on each device;
- the app must work without sign-in (guideline 5.1.1) — the cloud is a
  layer on top of local storage, not the source of truth.

## Decision

### 1. Backend — Supabase Postgres, one jsonb row per user

Table `states`: `user_id uuid PK → auth.users (on delete cascade)`,
`state jsonb`, `rev bigint`, `updated_at timestamptz`. RLS: a user can see
and write only their own row. No service role in the client.

Supabase already holds auth — a second vendor or a custom server would add
nothing but operational overhead. State is tiny, so normalizing into
tables buys nothing: the server just stores a blob and merges nothing.

### 2. Sync model — local-first, client-side merge, per-field LWW

Local storage stays primary. The cloud is a third write-through
(after localStorage and Preferences), with a larger debounce.

Whole-blob last-write-wins loses data in the main scenario itself
(edited `now` on the phone, `plan` on the laptop, the second push
overwrites the first), so merge happens per field:

- `horizon`, `now`, `plan` — the larger `updatedAt` wins
  (`now`/`plan` gain that field — state schema v2);
- `now` with different dates: the more recent date wins outright, and a
  non-empty "yesterday's" now from the other side moves into history —
  rollover semantics are preserved across devices too;
- `history` — union by date; a same-date collision is resolved by the
  entry's `updatedAt`;
- after merging — the usual rollover + normalize.

Merge is a pure function `merge(a, b): SlowModeState`: idempotent, with
deterministic tie-breaks, the single algorithmic hot spot — covered by
unit tests.

An important detail: in `defaultState()`, timestamps become an epoch
sentinel, otherwise a fresh install with an empty `horizon.updatedAt =
now()` would "win" over real cloud data on first sign-in.

### 3. Concurrency — optimistic CAS via a `rev` counter

The push goes through a Postgres function `push_state(p_state,
p_expected_rev)`: the update only applies if `rev` matches, and in either
case the current row is returned. On mismatch, the client merges the
returned state into its own and retries the push — one round-trip per
attempt, the lost-update window is closed. `rev = 0` means "the row
doesn't exist yet" (first push).

### 4. Triggers — pull on focus, push debounced; no Realtime

- **Pull:** app start, successful sign-in, tab/app returning to focus
  (listeners already exist in `useStorage.ts`), a push conflict.
- **Push:** 5s debounce after a state change + flush on
  `visibilitychange: hidden`. Offline — a persistent dirty flag,
  retried on `online`/focus/next launch.

We're not adopting Supabase Realtime: one person almost never edits on two
devices at the same time, and pull-on-focus covers the real scenario of
"opened the laptop — saw what I wrote on the phone." Realtime is a
possible later upgrade; this decision doesn't block it.

### 5. Data in the cloud — plain jsonb, EU region; E2EE deferred

End-to-end encryption would require a key that survives a device change,
i.e. a passphrase — against the spirit of the app (zero friction, zero
settings). Compensating controls: file export already exists
(`backup.ts`), account deletion together with the `states` row is a
mandatory part of the release (AUTH_PLAN, Phase 4), region is EU.

## Alternatives considered

- **CloudKit / NSUbiquitousKeyValueStore** — zero backend and free, but
  locks data into the Apple ecosystem: the web version (PWA) loses sync
  entirely. Rejected.
- **Firebase** — a second vendor on top of already-working Supabase auth.
  Rejected.
- **Whole-blob LWW** — loses fields when editing from two devices
  (see above). Rejected.
- **Normalized tables + server-side merge** — more moving parts and
  migrations for a four-field object; client-side merge covers the same
  conflicts. Rejected.
- **CRDTs (Automerge/Yjs)** — a heavy dependency for three text fields
  with no collaborative editing. Rejected.

## Consequences

- **Pros:** offline behavior doesn't change at all; without sign-in the
  app is identical to v1; the server stays dumb (stores a blob + CAS) —
  all the logic lives in one testable place; Supabase's free tier lasts a
  long time (one row per user).
- **Cons / accepted risks:**
  - LWW relies on device clocks — acceptable for a single user, a
    noticeable clock skew could pick the wrong version of a field;
  - the state schema becomes v2 (`updatedAt` on `now`/`plan`/history
    entries) — `normalize()` must migrate old data;
  - switching accounts on a device needs an explicit rule: local data
    belongs to the previous account — before replacing it with the new
    account's cloud copy, a backup is downloaded automatically (we don't
    merge two people's data);
  - a first bit of test infrastructure appears (vitest) — for merge only.
