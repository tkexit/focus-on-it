import type { SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isNative = Capacitor.isNativePlatform()

/**
 * Without keys in env, auth is simply disabled: the app runs as v1,
 * all sign-in UI is hidden. This also enables a web deploy without secrets.
 */
export const isAuthEnabled = Boolean(url && anonKey)

/**
 * Where the provider returns to after sign-in. On device — a deep link
 * (the scheme must match CFBundleURLTypes in Info.plist and the
 * Redirect URLs in Supabase), on the web — the current origin.
 */
export const authRedirectUrl = isNative
  ? 'com.kartoshkin.slowmode://auth-callback'
  : window.location.origin

/**
 * The session is stored the same way as data (see persist.ts): localStorage
 * is fast, Preferences survives the system clearing the WebView's storage.
 */
const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const local = localStorage.getItem(key)
      if (local !== null) return local
    } catch {
      /* private mode — fall through to Preferences */
    }
    if (!isNative) return null
    const { value } = await Preferences.get({ key })
    return value
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* quota exceeded — fail silently */
    }
    if (isNative) await Preferences.set({ key, value }).catch(() => {})
  },
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key)
    } catch {
      /* nothing to do */
    }
    if (isNative) await Preferences.remove({ key }).catch(() => {})
  },
}

let clientPromise: Promise<SupabaseClient> | null = null

/**
 * supabase-js is most of the app's bundle, so it loads as a separate
 * chunk on demand: a build without keys never fetches it at all.
 * The client is created once; repeated calls share the same promise.
 */
export function getClient(): Promise<SupabaseClient> | null {
  if (!url || !anonKey) return null
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url, anonKey, {
        auth: {
          flowType: 'pkce',
          storage: sessionStorage,
          // On device the callback arrives via appUrlOpen, not the page URL.
          detectSessionInUrl: !isNative,
        },
      }),
    )
  }
  return clientPromise
}
