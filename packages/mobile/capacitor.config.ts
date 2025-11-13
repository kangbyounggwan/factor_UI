import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.byeonggwan.factor',
  appName: 'FACTOR',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'ionic',
      resizeOnFullScreen: false
    },
    StatusBar: {
      overlays: false,
      backgroundColor: '#0B0F17',
      style: 'LIGHT'
    }
  },
  android: {
    backgroundColor: '#0B0F17'
  },
  ios: {
    contentInset: 'automatic'
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'com.byeonggwan.factor'
  }
};

export default config;