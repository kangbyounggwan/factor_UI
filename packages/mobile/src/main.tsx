import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from '@shared/contexts/AuthContext'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import { Keyboard, KeyboardResize } from '@capacitor/keyboard'
import { App as CapApp } from '@capacitor/app'
import { SafeArea, initialize as initSafeArea } from '@capacitor-community/safe-area'
import './i18n' // i18n 초기화

// 프로덕션 환경에서 console 로그 제거
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // console.warn과 console.error는 유지 (중요한 경고/에러 확인용)
}

// Capacitor 초기화 및 앱 시작
async function initializeApp() {
  try {
    // Capacitor가 네이티브 플랫폼에서 완전히 로드될 때까지 대기
    if (Capacitor.isNativePlatform()) {
      // DOM이 완전히 로드될 때까지 대기
      await new Promise<void>((resolve) => {
        if (document.readyState === 'complete') {
          resolve();
        } else {
          window.addEventListener('load', () => resolve(), { once: true });
        }
      });

      try {
        // SafeArea 단일 소스로 시스템 바와 CSS 안전영역 관리
        await SafeArea.enable({
          config: {
            customColorsForSystemBars: true,
            statusBarColor: '#000000',
            statusBarContent: 'light',
            navigationBarColor: '#000000',
            navigationBarContent: 'light',
            offset: 0,
          },
        })
        initSafeArea()
        const top = getComputedStyle(document.documentElement)
          .getPropertyValue('--safe-area-inset-top')
          .trim() || '0px'
        document.documentElement.style.setProperty('--sa-top', top)
      } catch (e) {
        console.warn('SafeArea setup failed:', e)
      }
    }

    if (Capacitor.getPlatform() === 'android') {
      // 정보 로깅만 유지 (시스템바 제어는 SafeArea가 담당)
      const info = await StatusBar.getInfo()
      console.log('Capacitor StatusBar info:', info)

      // Keyboard handling is configured in capacitor.config.ts with resize: 'none'
      // No additional JavaScript keyboard handling needed
    }
  } catch (error) {
    console.warn('Capacitor initialization failed:', error)
  }

  // React 앱 렌더링
  createRoot(document.getElementById("root")!).render(
    <AuthProvider variant="mobile">
      <App />
    </AuthProvider>
  );
}

// Android 하드웨어/제스처 뒤로가기 처리는 App.tsx에서 관리합니다.
// (중복 방지를 위해 main.tsx의 리스너 제거됨)

// 앱 초기화 시작
initializeApp();
