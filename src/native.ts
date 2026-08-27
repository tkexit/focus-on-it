import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/** Native init: the status bar follows the system theme. */
export function initNative() {
  if (!Capacitor.isNativePlatform()) return

  const android = Capacitor.getPlatform() === 'android'
  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light }).catch(() => {})
    if (android) {
      // Android < 15: paint the bar paper to match the app. No-op on 15+,
      // where edge-to-edge is enforced and the window background (also
      // paper, see res/values*/colors.xml) shows through instead.
      StatusBar.setBackgroundColor({ color: dark.matches ? '#1c1915' : '#f5f2ec' }).catch(() => {})
    }
  }
  apply()
  dark.addEventListener('change', apply)
}
