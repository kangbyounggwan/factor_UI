import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.factor.app',
  appName: 'FACTOR',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      overlays: false,
      backgroundColor: '#0B0F17',
      style: 'LIGHT'
    },
    BluetoothLe: {
      displayStrings: {
        scanning: "블루투스 장치를 스캔 중...",
        cancel: "취소",
        availableDevices: "사용 가능한 장치",
        noDeviceFound: "장치를 찾을 수 없습니다"
      }
    }
  },
  android: {
    backgroundColor: '#0B0F17'
  }
};

export default config;