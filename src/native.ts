import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'

/** Нативная инициализация iOS: статус-бар следует за темой системы. */
export function initNative() {
  if (!Capacitor.isNativePlatform()) return

  const dark = window.matchMedia('(prefers-color-scheme: dark)')
  const apply = () => {
    StatusBar.setStyle({ style: dark.matches ? Style.Dark : Style.Light }).catch(() => {})
  }
  apply()
  dark.addEventListener('change', apply)
}
