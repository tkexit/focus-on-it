# Slow Mode v1.1 — Sync Backend (cross-device synchronization)

Implements the decision from [ADR-0001](adr/0001-cross-device-sync.md).
Details and supersedes Phase 3 of [AUTH_PLAN.md](AUTH_PLAN.md).

## Gist

Local storage stays primary. Supabase Postgres holds one jsonb row per
user. Merge happens on the client, per field (LWW by `updatedAt`), history
is unioned by date. Push uses optimistic CAS by `rev`. Without sign-in the
app works exactly as it does today.

## Prerequisites (manual)

Already covered in AUTH_PLAN: Supabase project (EU), Google/Apple
providers, redirect URLs. Nothing extra needed by hand for sync — the
table and function arrive via migration.

## Phase 0 — DB migration

`supabase/migrations/0001_states.sql` (kept in the repo, applied via the
SQL editor or the supabase CLI):

```sql
create table public.states (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  state      jsonb not null,
  rev        bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.states enable row level security;

create policy "own row" on public.states
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- CAS in one round-trip: the push only applies if rev matches,
-- the response always carries the current row — on conflict the client merges and retries.
create or replace function public.push_state(p_state jsonb, p_expected_rev bigint)
returns table (rev bigint, state jsonb)
language plpgsql security invoker set search_path = public as $$
begin
  if p_expected_rev = 0 then
    insert into states (user_id, state) values (auth.uid(), p_state)
    on conflict (user_id) do nothing;
  else
    update states s
       set state = p_state, rev = s.rev + 1, updated_at = now()
     where s.user_id = auth.uid() and s.rev = p_expected_rev;
  end if;
  return query select s.rev, s.state from states s where s.user_id = auth.uid();
end $$;

revoke execute on function public.push_state from anon;
```

## Phase 1 — state schema v2 (pure client, no backend needed)

- `src/types/index.ts`: `updatedAt: string` on `Now` and `Plan`;
  `updatedAt?: string` on `NowEntry` (set during rollover).
- `useStorage.ts`:
  - `defaultState()` — timestamps become the epoch sentinel
    `1970-01-01T00:00:00.000Z`, so a fresh empty install loses to the
    cloud; check that the UI doesn't show a date for empty text;
  - `normalize()` — migrates old data: a missing `updatedAt` on
    `now`/`plan` is derived from their `date`, and for history entries
    from their `date`;
  - the `setNow`/`setPlan` setters stamp `updatedAt = now()`;
  - storage key stays the same (`slow-mode/v1`) — normalize tolerates
    both shapes.

## Phase 2 — merge as a pure function + first tests in the repo

- `src/sync/merge.ts` — `merge(a: SlowModeState, b: SlowModeState)`:
  - `horizon`/`plan`: the larger `updatedAt` wins; tie-break —
    deterministic (lexicographically larger text, so merge stays
    commutative);
  - `now`: equal dates → LWW by `updatedAt`; otherwise the more recent
    `date` wins outright, and the losing side's non-empty now moves into
    history (if that date isn't already there);
  - `history`: union by `date`; a collision is resolved by `updatedAt`,
    and for older entries without one, by the longer text; sorted by
    date, newest first;
  - rollover runs at the end.
- `npm i -D vitest`, `src/sync/merge.test.ts`: commutativity, idempotence,
  empty-vs-cloud (epoch sentinel), cross-device rollover, a history-date
  collision. Script `"test": "vitest run"`.

## Phase 3 — sync engine

- `src/sync/engine.ts`:
  - metadata is persisted next to the state (key `slow-mode/sync-meta`,
    same pattern as persist.ts): `{ userId, rev, dirty }` — survives a
    restart, unsynced edits aren't lost;
  - `pull()`: `select state, rev` → merge with local → if the result
    differs from the cloud copy, mark dirty (a push is needed);
  - `push()`: `rpc('push_state', { p_state, p_expected_rev: rev })` →
    rev matched — store the new rev, clear dirty; mismatch — merge the
    returned state, retry (max 3 attempts, then wait for the next
    trigger).
- `src/hooks/useSync.ts` — wires it into React:
  - pull triggers: mount with a live session, `SIGNED_IN`, focus
    returning (the same listeners as in `useStorage.ts`);
  - push triggers: state change with a 5s debounce, flush on
    `visibilitychange: hidden`, the `online` event;
  - without a session the hook is a no-op (like the whole auth layer).
- In `App.tsx`, state is passed into `useSync` along with a callback to
  apply the merged state (extend `useStorage` with an `applyMerged`
  method, similar to `importState` but without normalize surprises).

## Phase 4 — UI (together with AUTH_PLAN Phase 2)

- Sign-in is already designed in AUTH_PLAN: a small, optional entry point,
  in the History panel next to backup.
- Sync status — in the spirit of the app: no spinners; a small-print line
  "synced · just now / offline" next to the export/import buttons, shown
  only when signed in.

## Phase 5 — edge-case rules

- **Sign-out:** local data stays, metadata is cleared, sync turns off.
- **Account switch** (meta.userId ≠ session.user.id): the data on the
  device belongs to the previous account — automatically download a
  backup (`downloadBackup` already exists), then replace local state with
  the new account's cloud copy. Never merge two people's data.
- **Clock skew:** accepted (see ADR, "Consequences") — nothing to do.
- **Multiple tabs on the web:** pull-on-focus is enough for v1.1;
  BroadcastChannel — not now.

## Phase 6 — account deletion and compliance

Unchanged from AUTH_PLAN Phase 4: edge function `delete-account`
(service role deletes the auth user; the `states` row cascades away), a
confirmation button, updated privacy policy + App Privacy labels.

## Phase 7 — verification (two devices + web)

1. A edits horizon, B edits plan, both online → both fields intact on both.
2. A and B edit horizon in turn → the last one wins.
3. A writes now offline; B writes now for the same day; A comes back
   online → LWW by `updatedAt`, no duplicates in history.
4. Day rollover on A → sync → on B the history is unified, no double date.
5. Fresh install + sign-in → the cloud isn't overwritten with empty state.
6. Sign-in with an empty cloud → local state gets pushed (rev 0 → 1).
7. Account switch → backup downloaded, state replaced.
8. Account deletion → row deleted, the app keeps working locally.
9. All of the above with no network at all → the app is indistinguishable from v1.

## Order

Phase 1 and Phase 2 are pure client work, can be written and tested before
any backend exists. Phase 0 is five minutes in Supabase. Then Phase 3 →
Phase 4 → Phase 5 → Phase 6 → Phase 7.
The auth UI (AUTH_PLAN Phase 2) is needed before Phase 7 verification —
right now App.tsx has no sign-in entry point yet.
