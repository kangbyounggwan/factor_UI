import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.byeonggwan.factor', // iOS용 기본 ID
  appName: 'FACTOR',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'body',  // React 앱에서 표준 웹뷰 방식 사용 (iOS/Android 공통)
      resizeOnFullScreen: true,  // 전체화면에서도 키보드에 맞춰 크기 조절
      style: 'dark'  // 다크 테마에 맞는 키보드 스타일
    },
    StatusBar: {
      overlays: true,  // StatusBar가 콘텐츠 위에 오버레이됨 (SafeArea와 중복 방지)
      backgroundColor: '#0B0F17',
      style: 'LIGHT'
    }
  },
  android: {
    // Android는 Google Play에 등록된 패키지명 사용
    // AndroidManifest.xml의 package="com.factor.app"과 일치
    backgroundColor: '#0B0F17'
  },
  ios: {
    // SafeArea를 CSS에서 직접 제어하기 위해 'never'로 설정
    contentInset: 'never',
    // 개발 중 웹뷰 캐시 비활성화
    webContentsDebuggingEnabled: true
  },
  server: {
    androidScheme: 'https',
    iosScheme: 'com.byeonggwan.factor',
    // 개발 중 캐시 비활성화
    cleartext: true
  }
};

export default config;