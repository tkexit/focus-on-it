# ADR-0002: No AI processing inside the product

- **Status:** proposed (draft)
- **Date:** 2026-11-20
- **Related:** [ADR-0001](0001-cross-device-sync.md) (local-first sync design),
  [FOCUS_ON_IT_PLAN.md](../FOCUS_ON_IT_PLAN.md) (product context)

## Context

Focus On It exists because of AI. Its audience is engineers who spend the day
with AI coding tools and end it disoriented: many fast, shallow loops, constant
context switches, no sense of what the day was for ("AI brain fry"). The app is
one screen with three slow questions (Horizon / Now / Next step) and a hidden
history of past "now" entries.

The product is built with AI agents (see `CLAUDE.md`, `AGENTS.md` and the
Claude review workflow). So the question comes up naturally, and every
reviewer will ask it: why is there no AI *in* the product? Obvious candidates:

- summarize the week from history ("here is what you focused on");
- suggest a next step from horizon + now;
- rephrase or "sharpen" the horizon;
- detect drift ("your daily focus has not matched your horizon for 5 days");
- a chat to talk through the day.

Each is cheap to build today. The question is whether any of them serves the
product's job.

## Decision

The product does no AI processing of user content: no LLM calls, no
embeddings, no on-device models, no generated text shown to the user. AI stays
in how the product is *built*, not in what it *does*.

The decision follows from two product principles that are already hard
constraints:

### 1. No tracking pressure

The app never evaluates the person. No streaks, scores, reminders or "you
missed a day". Every AI feature listed above is, in effect, an evaluation:
a summary decides what mattered, a suggestion decides what is next, drift
detection decides you are off course. Even phrased gently, that is the
product talking back about your performance, which is exactly the pressure
the audience is trying to step away from.

### 2. Passive over active

The app waits to be opened and then mostly shows what you wrote. It does not
initiate, nudge or produce. An AI layer is active by nature: it generates
output that asks to be read, judged and acted on. One more output stream to
process is the problem, not the cure. The value of the screen is that every
word on it is the person's own.

### Supporting reasons

- **Trust and privacy.** Horizon, now and history are personal reflections.
  Today they never leave the device unless the person opts into sync
  (ADR-0001). Sending them to a model provider would change the privacy story
  from "your text stays with you" to "your text is processed by a third party",
  and would require consent flows, disclosures and App Store privacy labels
  that do not fit a quiet single-screen app.
- **Offline and local-first.** The app works fully offline. A model-backed
  feature would either break that or require an on-device model far larger
  than the app itself.
- **Cost and dependencies.** No API keys, no per-user inference cost, no
  vendor in the critical path. The keyless build has zero runtime
  dependencies on any service.
- **Focus of a small product.** One person maintains this. Every feature has
  to earn its place; an AI feature would bring prompt maintenance, evaluation
  and failure modes (wrong or tone-deaf output) into a product whose promise
  is calm.

## Alternatives considered

- **Opt-in weekly summary from history.** The most defensible option: off by
  default, runs only on request. Rejected for now: it still turns reflection
  into a report, and the history panel already lets people re-read their own
  words, which is the point.
- **On-device model (Apple Foundation Models / Gemini Nano).** Solves privacy
  and cost, not the product problem. Platform-specific, uneven availability,
  and the output is still an evaluation.
- **AI only for the landing and support** (e.g. answering feedback). Out of
  scope for this ADR: it does not touch user content in the app. Not planned.

## Consequences

- **Pros:** the product stays consistent with its own message; a clear privacy
  story ("nothing you write is analyzed"); no inference cost or vendor risk;
  works offline everywhere; less surface to maintain.
- **Cons / accepted risks:**
  - The product looks "less AI" in a market where AI features are expected.
    Accepted: the restraint is the positioning.
  - Some users would welcome a summary or a nudge. If that demand shows up
    repeatedly in feedback, revisit with an opt-in, local-only design and a new
    ADR that supersedes this one.
- **What this does not restrict:** using AI to build, test and review the
  product (agents, Claude Code Review in CI), and AI on the marketing side.

## Revisit when

- Users repeatedly ask for a specific AI feature through the feedback form,
  phrased as a need rather than a novelty; or
- an on-device model becomes available on both iOS and Android with no
  network, no account and no measurable cost, *and* a feature is found that
  does not evaluate the person.
