import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { authRedirectUrl, isAuthEnabled, isNative, supabase } from './client'

export type OAuthProvider = 'google' | 'apple'

interface AuthValue {
  /** false, когда нет ключей Supabase — вход-UI не показываем вовсе. */
  enabled: boolean
  session: Session | null
  signIn: (provider: OAuthProvider) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  enabled: false,
  session: null,
  signIn: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)

  // Поднимаем сохранённую сессию и следим за её сменой (вход/выход/refresh).
  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Устройство: провайдер возвращает в приложение по deep link с кодом PKCE.
  useEffect(() => {
    if (!supabase || !isNative) return
    const client = supabase
    const handle = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(authRedirectUrl)) return
      Browser.close().catch(() => {})
      const code = new URL(url).searchParams.get('code')
      if (code) await client.auth.exchangeCodeForSession(code).catch(() => {})
    })
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  const signIn = useCallback(async (provider: OAuthProvider) => {
    if (!supabase) return
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirectUrl,
        // На устройстве открываем сами через SFSafariViewController:
        // Google запрещает вход из WebView, а системный браузер — принимает.
        skipBrowserRedirect: isNative,
      },
    })
    if (error) throw error
    if (isNative && data?.url) await Browser.open({ url: data.url })
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  return (
    <AuthContext.Provider value={{ enabled: isAuthEnabled, session, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
