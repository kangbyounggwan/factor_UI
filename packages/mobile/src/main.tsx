import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from '@shared/contexts/AuthContext'
import { Capacitor } from '@capacitor/core'
import { StatusBar } from '@capacitor/status-bar'
import { SafeArea, SystemBarsStyle } from '@capacitor-community/safe-area'
import './i18n' // i18n 초기화

// 프로덕션 환경에서 console 로그 제거 (현재 비활성화 - 디버깅용)
// if (import.meta.env.PROD) {
//   console.log = () => {};
//   console.debug = () => {};
//   console.info = () => {};
//   // console.warn과 console.error는 유지 (중요한 경고/에러 확인용)
// }

// 글로벌 딥링크 URL 저장소 (React 렌더링 전에 캡처)
declare global {
  interface Window {
    __PENDING_DEEP_LINK__?: string;
  }
}

// 딥링크 처리는 네이티브(MainActivity/AppDelegate)에서 직접 처리하며
// window.__PENDING_DEEP_LINK__ + deep-link-received 이벤트로 전달합니다.
// React 앱에서는 useDeepLinkHandler 훅이 이를 처리합니다.

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
        // SafeArea v8: enable()/커스텀 배경색(customColorsForSystemBars 등) API가 제거되고
        // 시스템 바는 자동으로 활성화됨. 아이콘/텍스트 밝기만 설정 가능 (배경색 지정 불가 - 네이티브 설계 변경).
        // TODO: 기존 statusBarColor/navigationBarColor(#000000) 커스텀 배경색과 동일한 시각효과가 필요하면
        // capacitor.config.json의 SystemBars 설정 및 웹 레이어 CSS로 별도 구현 필요 (프로덕트/디자인 검토 필요).
        await SafeArea.setSystemBarsStyle({ style: SystemBarsStyle.Light })
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
