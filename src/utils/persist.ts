import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const KEY = 'focus-on-it/v1'

export const isNative = Capacitor.isNativePlatform()

/** Synchronous read for the first render. */
export function loadLocal(): unknown | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/**
 * iOS can clear the WebView's localStorage under storage pressure,
 * so on device the reliable copy lives in native Preferences.
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

/** Write to both stores: localStorage is fast, Preferences survives. */
export function persist(state: unknown) {
  const json = JSON.stringify(state)
  try {
    localStorage.setItem(KEY, json)
  } catch {
    /* private mode / quota exceeded — silently tolerate it */
  }
  if (isNative) {
    Preferences.set({ key: KEY, value: json }).catch(() => {})
  }
}
