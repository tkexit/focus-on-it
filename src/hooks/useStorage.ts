import { useCallback, useEffect, useRef, useState } from 'react'
import type { SlowModeState } from '../types'
import { todayStr } from '../utils/date'
import { isNative, loadLocal, loadNative, persist } from '../utils/persist'

const DEBOUNCE_MS = 500

function defaultState(): SlowModeState {
  const today = todayStr()
  return {
    horizon: { text: '', updatedAt: new Date().toISOString() },
    now: { text: '', date: today },
    plan: { text: '', date: today },
    history: [],
  }
}

/** Защита от мусора в localStorage и от старых версий схемы. */
function normalize(raw: unknown): SlowModeState {
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
 * Переход дня: если запись «сейчас» относится к прошлому дню и в ней есть
 * текст — она уходит в историю, а поле «сейчас» становится чистым на сегодня.
 */
function rollOver(state: SlowModeState): SlowModeState {
  const today = todayStr()
  if (state.now.date === today) return state

  const history = [...state.history]
  if (state.now.text.trim() !== '' && !history.some((h) => h.date === state.now.date)) {
    history.unshift({ text: state.now.text, date: state.now.date })
  }

  return { ...state, now: { text: '', date: today }, history }
}

function load(): SlowModeState {
  const raw = loadLocal()
  return raw ? rollOver(normalize(raw)) : defaultState()
}

function isEmpty(s: SlowModeState): boolean {
  return (
    s.horizon.text === '' && s.now.text === '' && s.plan.text === '' && s.history.length === 0
  )
}

export function useStorage() {
  const [state, setState] = useState<SlowModeState>(load)

  // Последнее состояние — чтобы сбросить его на диск перед уходом со страницы.
  const latest = useRef(state)
  latest.current = state

  // На устройстве localStorage мог быть вычищен системой — поднимаем
  // данные из нативного хранилища, но только в пустое состояние,
  // чтобы не затереть то, что человек уже начал писать.
  useEffect(() => {
    if (!isNative) return
    loadNative().then((raw) => {
      if (raw) setState((s) => (isEmpty(s) ? rollOver(normalize(raw)) : s))
    })
  }, [])

  // Дебаунс записи: пока человек печатает, не дёргаем диск на каждый символ.
  useEffect(() => {
    const id = window.setTimeout(() => persist(state), DEBOUNCE_MS)
    return () => window.clearTimeout(id)
  }, [state])

  // Гарантированно сохраняем, если вкладку закрывают или прячут.
  // А при возврате во вкладку — проверяем, не наступил ли новый день.
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
    // Сначала прокатываем день: если запись вчерашняя, она уходит в историю,
    // а не молча превращается в сегодняшнюю.
    setState((s) => {
      const rolled = rollOver(s)
      return { ...rolled, now: { text, date: rolled.now.date } }
    })
  }, [])

  const setPlan = useCallback((text: string) => {
    setState((s) => ({ ...s, plan: { text, date: todayStr() } }))
  }, [])

  /** Восстановление из бэкапа: прогоняем через normalize и переход дня. */
  const importState = useCallback((raw: unknown) => {
    setState(rollOver(normalize(raw)))
  }, [])

  return { state, setHorizon, setNow, setPlan, importState }
}
