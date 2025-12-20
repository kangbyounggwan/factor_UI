import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import ko from './locales/ko';
import en from './locales/en';

// 지원하는 언어 목록
const SUPPORTED_LANGUAGES = ['ko', 'en'];

// Capacitor 환경 감지
const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;

// 브라우저 언어 감지 (navigator.language 기반)
const detectBrowserLanguage = (): string => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return 'en'; // SSR 환경에서는 영어 기본
  }

  // navigator.language: 'ko-KR', 'en-US', 'de-DE' 등
  const browserLang = navigator.language || (navigator as any).userLanguage || '';
  const langCode = browserLang.split('-')[0].toLowerCase(); // 'ko-KR' -> 'ko'

  // 지원하는 언어면 그대로 사용, 아니면 영어(국제 표준)
  if (SUPPORTED_LANGUAGES.includes(langCode)) {
    return langCode;
  }

  // 한국어가 아닌 다른 언어는 영어로 처리
  return 'en';
};

// Capacitor Preferences에서 언어 가져오기
const getStoredLanguage = async () => {
  // 브라우저 환경 (웹)
  if (typeof window !== 'undefined' && !isCapacitor) {
    const stored = localStorage.getItem('language');
    // 저장된 언어가 있으면 사용, 없으면 브라우저 언어 감지
    if (stored && SUPPORTED_LANGUAGES.includes(stored)) {
      return stored;
    }
    return detectBrowserLanguage();
  }

  // Capacitor 환경 (모바일)
  if (isCapacitor) {
    try {
      // Capacitor의 Preferences API 사용
      const { Preferences } = (window as any).Capacitor.Plugins;
      if (Preferences) {
        const { value } = await Preferences.get({ key: 'language' });
        if (value && SUPPORTED_LANGUAGES.includes(value)) {
          return value;
        }
      }
    } catch (error) {
      console.error('Failed to get stored language from Capacitor:', error);
    }
    // 모바일도 브라우저 언어 감지
    return detectBrowserLanguage();
  }

  // 폴백 - 브라우저 언어 감지
  return detectBrowserLanguage();
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
      lng: storedLanguage, // 감지된/저장된 언어 사용
      fallbackLng: 'en', // 폴백 언어 (국제 표준)
      supportedLngs: SUPPORTED_LANGUAGES, // 지원 언어
      debug: import.meta.env.DEV, // 개발 환경에서만 디버그
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
