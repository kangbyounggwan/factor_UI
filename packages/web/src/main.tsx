import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { AuthProvider } from '@shared/contexts/AuthContext'
import './i18n' // i18n 초기화

// 프로덕션 환경에서 console 로그 제거
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // console.warn과 console.error는 유지 (중요한 경고/에러 확인용)
}

createRoot(document.getElementById("root")!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
