# Focus On It — Claude Code Plan v1.0

## Project context

Focus On It is a separate space for engineers who work with AI tools and lose their sense of direction. Not a work tool, not a productivity app. A place to exhale and see the horizon.

**The feeling the product should give:**
- Visibility: I can see where I am, what matters to me
- Silence: everything unnecessary is removed

**Two modes of use:**
- Morning: a 5–10 minute ritual, update "now", look at the horizon
- Exhale: open at any moment when things spin out — just look

---

## What we're building (MVP)

A web app. One main screen. Two layers:

1. **Horizon** — one main goal. Changes rarely. Always visible.
2. **Now** — where I am. A short note. Changes every day.

A light **plan** naturally grows out of this — not a task list, but an understanding of the next step.

Notes are saved locally (localStorage). No backend for the MVP.

---

## Tech stack

```
React (Vite)
TypeScript
CSS Modules or styled-components — either works
localStorage for persistence
No UI libraries — everything from scratch
```

---

## File structure

```
focus-on-it/
├── src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── components/
│   │   ├── Horizon.tsx        # Main goal
│   │   ├── Now.tsx            # Where I am now
│   │   ├── Plan.tsx           # Notes / next step
│   │   └── EntryModal.tsx     # Editing the horizon
│   ├── hooks/
│   │   └── useStorage.ts      # localStorage handling
│   ├── types/
│   │   └── index.ts
│   └── styles/
│       └── global.css
├── index.html
├── vite.config.ts
└── package.json
```

---

## Design

### Principles
- Lots of empty space — silence should be visible
- One thought on screen at a time
- No buttons without reason, no panels, no icons
- Typography is the main element

### Palette
```css
--bg: #F5F2EC;          /* warm off-white, like paper */
--text-primary: #1A1814; /* near-black */
--text-secondary: #8C8070; /* warm gray */
--accent: #2D4A3E;       /* deep green — horizon */
--border: #E0DAD0;
```

### Typography
- Display / headings: `Playfair Display` or `Cormorant Garamond` — editorial, slow
- Body: `iA Writer Quattro` or `Lora` — readable, calm
- Horizon size: large, takes up space

### Main screen layout
```
[empty space]

  Horizon                      ← large, quiet
  ─────────────────────────
  Your main goal here          ← one or two lines, large

[a little space]

  Now                          ← smaller, but noticeable
  ─────────────────────────
  Where you are                ← text field, free input

[space]

  Next step                    ← very quiet, almost a whisper
  ─────────────────────────
  What matters to do today

[empty space]

                           [·]  ← the only button: enter edit mode
```

---

## Data types

```typescript
interface FocusOnItState {
  horizon: {
    text: string;
    updatedAt: string;
  };
  now: {
    text: string;
    date: string;           // YYYY-MM-DD — updates every day
  };
  plan: {
    text: string;
    date: string;
  };
  history: NowEntry[];      // previous "now" entries
}

interface NowEntry {
  text: string;
  date: string;
}
```

---

## Behavior

### Horizon
- Always displayed large
- Editable by click (inline edit or a quiet modal)
- If not set — placeholder: *"What matters most to you right now?"*
- Persists until explicitly changed

### Now
- A new entry every day (determined by date)
- If today's entry already exists — shows it, editable
- On a new day — field is empty, the previous entry moves to history
- Placeholder: *"Where are you now relative to the horizon?"*

### Plan
- Free text, changes freely
- Not a structured list — just a note

### History
- Not shown by default
- Accessible via a quiet toggle or swipe — "back"
- Shows previous "now" entries by date

---

## Build steps (in order)

```
1. Project init
   → vite create focus-on-it --template react-ts
   → install dependencies

2. useStorage hook
   → get/set/clear for FocusOnItState
   → auto-detect a new day for Now

3. Horizon component
   → display + inline edit
   → appearance animation (fade in, slow)

4. Now component
   → borderless textarea
   → autosave via debounce (500ms)
   → new-day detection

5. Plan component
   → same as Now, but simpler

6. Main screen App.tsx
   → assemble all components
   → typography and spacing

7. Styles
   → CSS variables
   → fonts via Google Fonts
   → silence through whitespace

8. History
   → toggle at the bottom of the screen
   → list of previous Now entries by date

9. Final polish
   → fade-in on load
   → smooth transitions while editing
   → responsive (mobile matters too)
```

---

## What we're NOT building in the MVP

- No backend and no auth
- No notifications or reminders
- No multiple horizons
- No sync across devices
- No analytics or tracking

---

## Launch command for Claude Code

```bash
cd focus-on-it
npm install
npm run dev
```

---

## MVP done-criteria

I open it in the morning → I see my horizon → I write where I am → I understand the next step → I close it feeling grounded.
