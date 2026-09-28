import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusOnItState } from '../types'
import { todayStr } from '../utils/date'
import { isNative, loadLocal, loadNative, persist } from '../utils/persist'

const DEBOUNCE_MS = 500

function defaultState(): FocusOnItState {
  const today = todayStr()
  return {
    horizon: { text: '', updatedAt: new Date().toISOString() },
    now: { text: '', date: today },
    plan: { text: '', date: today },
    history: [],
  }
}

/** Guards against garbage in localStorage and against old schema versions. */
function normalize(raw: unknown): FocusOnItState {
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
function rollOver(state: FocusOnItState): FocusOnItState {
  const today = todayStr()
  if (state.now.date === today) return state

  const history = [...state.history]
  if (state.now.text.trim() !== '' && !history.some((h) => h.date === state.now.date)) {
    history.unshift({ text: state.now.text, date: state.now.date })
  }

  return { ...state, now: { text: '', date: today }, history }
}

function load(): FocusOnItState {
  const raw = loadLocal()
  return raw ? rollOver(normalize(raw)) : defaultState()
}

function isEmpty(s: FocusOnItState): boolean {
  return (
    s.horizon.text === '' && s.now.text === '' && s.plan.text === '' && s.history.length === 0
  )
}

export function useStorage() {
  const [state, setState] = useState<FocusOnItState>(load)

  // The latest state — so we can flush it to disk before leaving the page.
  const latest = useRef(state)
  latest.current = state

  // On device localStorage may have been cleared by the system — restore
  // data from native storage, but only into an empty state, so we never
  // overwrite what the person has already started typing.
  useEffect(() => {
    if (!isNative) return
    loadNative().then((raw) => {
      if (raw) setState((s) => (isEmpty(s) ? rollOver(normalize(raw)) : s))
    })
  }, [])

  // Debounce the write: don't hit disk on every keystroke while typing.
  useEffect(() => {
    const id = window.setTimeout(() => persist(state), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [state])

  // Guarantee a save when the tab is closed or hidden.
  // And on returning to the tab — check whether a new day has started.
  useEffect(() => {
    const flush = () => persist(latest.current)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else setState(rollOver)
    }
    const onFocus = () => setState(rollOver)
    window.addEventListener('beforeunload', flush)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('beforeunload', flush)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const setHorizon = useCallback((text: string) => {
    setState((s) => ({ ...s, horizon: { text, updatedAt: new Date().toISOString() } }))
  }, [])

  const setNow = useCallback((text: string) => {
    // Roll the day over first: if the entry is from yesterday, it moves
    // into history instead of silently turning into today's entry.
    setState((s) => {
      const rolled = rollOver(s)
      return { ...rolled, now: { text, date: rolled.now.date } }
    })
  }, [])

  const setPlan = useCallback((text: string) => {
    setState((s) => ({ ...s, plan: { text, date: todayStr() } }))
  }, [])

  /** Restore from a backup: run through normalize and the day rollover. */
  const importState = useCallback((raw: unknown) => {
    setState(rollOver(normalize(raw)))
  }, [])

  return { state, setHorizon, setNow, setPlan, importState }
}
