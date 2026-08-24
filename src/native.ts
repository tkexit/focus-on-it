import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/** Native iOS init: the status bar follows the system theme. */
export function initNative() {
  if (!Capacitor.isNativePlatform()) return

  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light }).catch(() => {})
  }
  apply()
  dark.addEventListener('change', apply)
}
