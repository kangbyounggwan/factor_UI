import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko';
import en from './locales/en';

// Capacitor 환경 감지
const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;

// Capacitor Preferences에서 언어 가져오기
const getStoredLanguage = async () => {
  if (isCapacitor) {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'language' });
      return value || 'ko';
    } catch (error) {
      console.error('Failed to get stored language:', error);
      return 'ko';
    }
  } else {
    return localStorage.getItem('language') || 'ko';
  }
};

// i18n 초기화
const initI18n = async () => {
  const storedLanguage = await getStoredLanguage();

  await i18n
    .use(initReactI18next) // React 바인딩
    .init({
      resources: {
        ko: { translation: ko },
        en: { translation: en },
      },
      lng: storedLanguage, // 저장된 언어 사용
      fallbackLng: 'ko', // 기본 언어
      debug: true, // 디버그 모드
      interpolation: {
        escapeValue: false, // React는 자동으로 XSS 방지
      },
      react: {
        useSuspense: false, // Suspense 비활성화
      },
    });
};

// 초기화 실행
initI18n();

// 개발 환경에서만 로그 출력
if (import.meta.env.DEV) {
  console.log('i18n initialized:', i18n.isInitialized, 'language:', i18n.language);
}

export default i18n;
