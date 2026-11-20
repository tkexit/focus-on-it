import type { FocusOnItState } from '../types'
import { todayStr } from '../utils/date'

/**
 * Pure state logic for Focus On It: no React, no storage APIs.
 * `useStorage` wires these functions to persistence and lifecycle events.
 */

export function defaultState(): FocusOnItState {
  const today = todayStr()
  return {
    horizon: { text: '', updatedAt: new Date().toISOString() },
    now: { text: '', date: today },
    plan: { text: '', date: today },
    history: [],
  }
}

/** Guards against garbage in localStorage and against old schema versions. */
export function normalize(raw: unknown): FocusOnItState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const p = raw as Record<string, any>

  return {
    horizon: {
      text: typeof p.horizon?.text === 'string' ? p.horizon.text : base.horizon.text,
      updatedAt:
        typeof p.horizon?.updatedAt === 'string' ? p.horizon.updatedAt : base.horizon.updatedAt,
    },
    now: {
      text: typeof p.now?.text === 'string' ? p.now.text : '',
      date: typeof p.now?.date === 'string' ? p.now.date : base.now.date,
    },
    plan: {
      text: typeof p.plan?.text === 'string' ? p.plan.text : '',
      date: typeof p.plan?.date === 'string' ? p.plan.date : base.plan.date,
    },
    history: Array.isArray(p.history)
      ? p.history.filter(
          (h: any) => h && typeof h.text === 'string' && typeof h.date === 'string',
        )
      : [],
  }
}

/**
 * Day rollover: if the "now" entry belongs to a past day and has text,
 * it moves into history, and "now" resets to a clean slate for today.
 */
export function rollOver(state: FocusOnItState): FocusOnItState {
  const today = todayStr()
  if (state.now.date === today) return state

  const history = [...state.history]
  if (state.now.text.trim() !== '' && !history.some((h) => h.date === state.now.date)) {
    history.unshift({ text: state.now.text, date: state.now.date })
  }

  return { ...state, now: { text: '', date: today }, history }
}

export function isEmpty(s: FocusOnItState): boolean {
  return (
    s.horizon.text === '' && s.now.text === '' && s.plan.text === '' && s.history.length === 0
  )
}
