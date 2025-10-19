import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.factor.app',
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
  }
};

export default config;