/**
 * 회원가입 동의 상태와 판정.
 *
 * 컴포넌트 파일과 분리한다. 상수·함수를 컴포넌트와 같은 파일에서 내보내면
 * Fast Refresh 가 동작하지 않는다.
 */
export interface ConsentState {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
}

export const EMPTY_CONSENT: ConsentState = {
  terms: false,
  privacy: false,
  marketing: false,
};

/** 필수 항목(이용약관·개인정보 수집·이용)에 모두 동의했는가. */
export function hasRequiredConsent(c: ConsentState): boolean {
  return c.terms && c.privacy;
}
