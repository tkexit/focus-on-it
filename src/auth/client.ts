import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Preferences } from '@capacitor/preferences'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isNative = Capacitor.isNativePlatform()

/**
 * Куда провайдер возвращает после входа. На устройстве — deep link
 * (схема должна совпадать с CFBundleURLTypes в Info.plist и с
 * Redirect URLs в Supabase), в вебе — текущий origin.
 */
export const authRedirectUrl = isNative
  ? 'com.kartoshkin.slowmode://auth-callback'
  : window.location.origin

/**
 * Сессия хранится как и данные (см. persist.ts): localStorage — быстрый,
 * Preferences — переживает чистку WebView-хранилища системой.
 */
const sessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const local = localStorage.getItem(key)
      if (local !== null) return local
    } catch {
      /* приватный режим — идём в Preferences */
    }
    if (!isNative) return null
    const { value } = await Preferences.get({ key })
    return value
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* переполнение — молча терпим */
    }
    if (isNative) await Preferences.set({ key, value }).catch(() => {})
  },
  async removeItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ничего */
    }
    if (isNative) await Preferences.remove({ key }).catch(() => {})
  },
}

/**
 * Без ключей в env auth просто выключен: приложение работает как v1,
 * весь вход-UI скрыт. Это же спасает web-деплой без секретов.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          flowType: 'pkce',
          storage: sessionStorage,
          // На устройстве callback приходит через appUrlOpen, не через URL страницы.
          detectSessionInUrl: !isNative,
        },
      })
    : null

export const isAuthEnabled = supabase !== null
