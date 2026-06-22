export interface Horizon {
  text: string
  updatedAt: string // ISO timestamp — меняется редко
}

export interface Now {
  text: string
  date: string // YYYY-MM-DD — обновляется каждый день
}

export interface Plan {
  text: string
  date: string // YYYY-MM-DD — последнее касание
}

export interface NowEntry {
  text: string
  date: string // YYYY-MM-DD
}

export interface SlowModeState {
  horizon: Horizon
  now: Now
  plan: Plan
  history: NowEntry[] // предыдущие записи «сейчас», новые — первыми
}
