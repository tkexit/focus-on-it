import { useCallback, useEffect, useRef, useState } from 'react'
import type { FocusOnItState } from '../types'
import { defaultState, isEmpty, normalize, rollOver } from '../state/storage'
import { todayStr } from '../utils/date'
import { isNative, loadLocal, loadNative, persist } from '../utils/persist'

const DEBOUNCE_MS = 500

function load(): FocusOnItState {
  const raw = loadLocal()
  return raw ? rollOver(normalize(raw)) : defaultState()
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
