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
import { authRedirectUrl, getClient, isAuthEnabled, isNative } from './client'

export type OAuthProvider = 'google' | 'apple'

interface AuthValue {
  /** false when there are no Supabase keys — we don't show sign-in UI at all. */
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

  // Restore the saved session and track its changes (sign-in/sign-out/refresh).
  useEffect(() => {
    const clientPromise = getClient()
    if (!clientPromise) return
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    clientPromise.then((client) => {
      if (cancelled) return
      client.auth.getSession().then(({ data }) => setSession(data.session))
      const { data: sub } = client.auth.onAuthStateChange((_event, s) => setSession(s))
      unsubscribe = () => sub.subscription.unsubscribe()
    })
    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  // On device: the provider returns to the app via a deep link with a PKCE code.
  useEffect(() => {
    if (!isAuthEnabled || !isNative) return
    const handle = CapApp.addListener('appUrlOpen', async ({ url }) => {
      if (!url.startsWith(authRedirectUrl)) return
      Browser.close().catch(() => {})
      const params = new URL(url).searchParams
      // The provider returned a denial (cancel, access_denied) — no code
      // follows. The quiet UX stays unchanged, but the reason goes to the
      // console, or a silent sign-in failure on device is undebuggable.
      const denied = params.get('error_description') ?? params.get('error')
      if (denied) {
        console.error('sign-in failed:', denied)
        return
      }
      const code = params.get('code')
      if (!code) return
      const client = await getClient()
      if (!client) return
      const { error } = await client.auth.exchangeCodeForSession(code)
      if (error) console.error('sign-in failed:', error.message)
    })
    return () => {
      handle.then((h) => h.remove())
    }
  }, [])

  const signIn = useCallback(async (provider: OAuthProvider) => {
    const client = await getClient()
    if (!client) return
    const { data, error } = await client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirectUrl,
        // On device we open it ourselves via SFSafariViewController:
        // Google refuses sign-in from a WebView, but accepts the system browser.
        skipBrowserRedirect: isNative,
      },
    })
    if (error) throw error
    if (isNative && data?.url) await Browser.open({ url: data.url })
  }, [])

  const signOut = useCallback(async () => {
    const client = await getClient()
    if (client) await client.auth.signOut()
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
