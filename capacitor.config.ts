import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kartoshkin.slowmode',
  appName: 'Slow Mode',
  webDir: 'dist',
  plugins: {
    // A quiet splash: paper background, no spinner, gone quickly.
    SplashScreen: {
      launchShowDuration: 600,
      launchAutoHide: true,
      launchFadeOutDuration: 250,
      backgroundColor: '#f5f2ec',
      showSpinner: false,
    },
  },
}

export default config
