import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const KEY = 'slow-mode/v1'

export const isNative = Capacitor.isNativePlatform()

/** Синхронное чтение для первого рендера. */
export function loadLocal(): unknown | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * iOS может почистить localStorage у WebView при нехватке места,
 * поэтому на устройстве надёжная копия живёт в нативных Preferences.
 */
export async function loadNative(): Promise<unknown | null> {
  if (!isNative) return null
  try {
    const { value } = await Preferences.get({ key: KEY })
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

/** Пишем в оба хранилища: localStorage — быстрый, Preferences — выживает. */
export function persist(state: unknown) {
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(KEY, json)
  } catch {
    /* приватный режим / переполнение — молча терпим */
  }
  if (isNative) {
    Preferences.set({ key: KEY, value: json }).catch(() => {})
  }
}
