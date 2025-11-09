import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ko from './locales/ko';
import en from './locales/en';

// i18n 초기화 - 즉시 실행
i18n
  .use(LanguageDetector) // 브라우저 언어 자동 감지
  .use(initReactI18next) // React 바인딩
  .init({
    resources: {
      ko: { translation: ko },
      en: { translation: en },
    },
    lng: 'ko', // 초기 언어 명시
    fallbackLng: 'ko', // 기본 언어
    debug: true, // 디버그 모드 활성화하여 문제 확인
    interpolation: {
      escapeValue: false, // React는 자동으로 XSS 방지
    },
    detection: {
      // 언어 감지 순서: localStorage > 브라우저 설정
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
    },
    react: {
      useSuspense: false, // Suspense 비활성화로 즉시 렌더링
    },
  });

// 개발 환경에서만 로그 출력
if (import.meta.env.DEV) {
  console.log('i18n initialized:', i18n.isInitialized, 'language:', i18n.language);
}

export default i18n;
