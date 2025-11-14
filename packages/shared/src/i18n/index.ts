import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko';
import en from './locales/en';

// Capacitor 환경 감지
const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;

// Capacitor Preferences에서 언어 가져오기
const getStoredLanguage = async () => {
  // 브라우저 환경 (웹)
  if (typeof window !== 'undefined' && !isCapacitor) {
    return localStorage.getItem('language') || 'ko';
  }

  // Capacitor 환경 (모바일)
  if (isCapacitor) {
    try {
      // Capacitor의 Preferences API 사용
      const { Preferences } = (window as any).Capacitor.Plugins;
      if (Preferences) {
        const { value } = await Preferences.get({ key: 'language' });
        return value || 'ko';
      }
    } catch (error) {
      console.error('Failed to get stored language from Capacitor:', error);
    }
  }

  // 폴백
  return 'ko';
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

// 초기화 Promise 내보내기
export const i18nReady = initI18n();

// 개발 환경에서만 로그 출력
i18nReady.then(() => {
  if (import.meta.env.DEV) {
    console.log('i18n initialized:', i18n.isInitialized, 'language:', i18n.language);
  }
});

export default i18n;
