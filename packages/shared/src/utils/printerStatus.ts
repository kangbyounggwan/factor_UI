import type { PrinterState, PrinterStateFlags, PrinterStatusInfo } from '../types/printerType';

/**
 * 프린터 상태와 플래그를 기반으로 상태 정보를 반환합니다.
 *
 * 우선순위:
 * 1. error 플래그
 * 2. printing 플래그
 * 3. paused 플래그
 * 4. ready/operational 플래그 (idle)
 * 5. connecting 상태
 * 6. 기본값: disconnected
 *
 * @param printerState 프린터 상태 문자열
 * @param flags 프린터 상태 플래그
 * @param translations 번역 함수 또는 번역 객체
 * @returns 상태 라벨과 뱃지 클래스
 */
export function getPrinterStatusInfo(
  printerState: PrinterState | undefined | null,
  flags: PrinterStateFlags | undefined | null,
  translations: {
    idle: string;
    printing: string;
    paused: string;
    error: string;
    connecting: string;
    disconnected: string;
  }
): PrinterStatusInfo {
  const state = printerState || 'disconnected';
  let label = translations.disconnected;
  let badgeClass = 'bg-destructive/40 text-destructive-foreground';

  // 우선순위에 따라 상태 결정
  if (flags?.error) {
    label = translations.error;
    badgeClass = 'bg-warning/40 text-warning-foreground';
  } else if (flags?.printing) {
    label = translations.printing;
    badgeClass = 'bg-success/40 text-success-foreground';
  } else if (flags?.paused) {
    label = translations.paused;
    badgeClass = 'bg-orange-500/40 text-orange-900 dark:text-orange-100';
  } else if (flags?.ready || flags?.operational) {
    label = translations.idle;
    badgeClass = 'bg-success/40 text-success-foreground';
  } else if (state === 'connecting') {
    label = translations.connecting;
    badgeClass = 'bg-primary/40 text-primary-foreground';
  }

  return { label, badgeClass };
}

/**
 * idle 상태인지 확인합니다.
 * idle은 operational 또는 ready 플래그가 true이고,
 * printing, paused, error가 아닌 상태입니다.
 */
export function isIdleState(
  printerState: PrinterState | undefined | null,
  flags: PrinterStateFlags | undefined | null
): boolean {
  if (flags?.printing || flags?.paused || flags?.error) {
    return false;
  }
  return !!(flags?.ready || flags?.operational);
}

/**
 * 프린터가 제어 가능한 상태인지 확인합니다.
 * (연결되어 있고 오류가 없는 상태)
 */
export function isControllable(
  printerState: PrinterState | undefined | null,
  flags: PrinterStateFlags | undefined | null
): boolean {
  const state = printerState || 'disconnected';
  if (state === 'disconnected' || state === 'disconnect' || state === 'connecting') {
    return false;
  }
  if (flags?.error || flags?.closedOrError) {
    return false;
  }
  return true;
}
