export interface Horizon {
  text: string
  updatedAt: string // ISO timestamp — changes rarely
}

export interface Now {
  text: string
  date: string // YYYY-MM-DD — updated every day
}

export interface Plan {
  text: string
  date: string // YYYY-MM-DD — last touched
}

export interface NowEntry {
  text: string
  date: string // YYYY-MM-DD
}

export interface FocusOnItState {
  horizon: Horizon
  now: Now
  plan: Plan
  history: NowEntry[] // previous "now" entries, newest first
}
