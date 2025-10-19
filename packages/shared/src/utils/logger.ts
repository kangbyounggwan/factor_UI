/**
 * 환경 기반 로깅 유틸리티
 * 프로덕션 환경에서는 로그를 출력하지 않습니다.
 */

const isDevelopment = import.meta.env?.DEV ?? process.env.NODE_ENV === 'development';

export const logger = {
  log: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  warn: (...args: any[]) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },

  error: (...args: any[]) => {
    // 에러는 프로덕션에서도 출력 (중요한 디버깅 정보)
    console.error(...args);
  },

  info: (...args: any[]) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },

  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },

  // 개발 환경에서만 실행되는 함수
  dev: (fn: () => void) => {
    if (isDevelopment) {
      fn();
    }
  }
};

// 프로덕션에서 완전히 콘솔을 숨기려면 (권장하지 않음)
export const disableAllLogs = () => {
  if (!isDevelopment) {
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.debug = () => {};
    // console.error는 유지하는 것이 좋습니다
  }
};
