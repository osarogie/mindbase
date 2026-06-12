import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'app.mindbase.notes',
  appName: 'mindbase',
  webDir: '../web/dist',
  server: {
    // Set to your vault server when running on device, e.g.:
    // url: 'http://192.168.1.10:8080',
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'automatic',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0f0f14',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0f0f14',
    },
  },
}

export default config
