/**
 * MQTT 메시지 파싱 유틸리티
 * 중복 코드 방지를 위한 공통 함수
 */

/**
 * MQTT 페이로드를 JSON 객체로 파싱
 * string, Uint8Array, object 모두 처리
 */
export function parseMqttPayload<T = any>(payload: any): T | null {
  if (payload == null) return null;

  try {
    if (typeof payload === 'string') {
      return JSON.parse(payload) as T;
    }
    if (payload instanceof Uint8Array) {
      return JSON.parse(new TextDecoder().decode(payload)) as T;
    }
    // 이미 객체인 경우
    if (typeof payload === 'object') {
      return payload as T;
    }
  } catch {
    // 파싱 실패 시 null 반환
  }
  return null;
}

/**
 * 프린터 상태 정규화
 * OctoPrint 상태 → 앱 내부 상태로 매핑
 */
export type NormalizedPrinterStatus =
  | 'printing'
  | 'paused'
  | 'idle'
  | 'error'
  | 'disconnected';

export function normalizePrinterStatus(parsed: any): NormalizedPrinterStatus {
  // state.flags 우선 확인 (가장 정확한 상태)
  const flags = parsed?.state?.flags;
  if (flags?.printing) return 'printing';
  if (flags?.paused) return 'paused';
  if (flags?.error) return 'error';

  // connection 배열에서 상태 추출: ["Printing", "/dev/ttyUSB0", 115200, {...}]
  const connectionArr = Array.isArray(parsed?.connection) ? parsed.connection : null;
  const connectionState = connectionArr?.[0];
  // state.text에서 상태 추출
  const stateText = parsed?.state?.text;
  // 우선순위: connection[0] > state.text
  const rawState = (connectionState ?? stateText ?? '').toLowerCase();

  // 상태 매핑
  switch (rawState) {
    case 'printing': return 'printing';
    case 'paused': return 'paused';
    case 'operational':
    case 'ready': return 'idle';
    case 'offline':
    case 'closed':
    case 'closed_with_error': return 'disconnected';
    case 'error': return 'error';
    default: return 'idle';
  }
}

/**
 * 온도 정보 정규화
 */
export interface NormalizedTemperature {
  tool: { actual: number; target: number };
  bed: { actual: number; target: number };
}

export function normalizeTemperature(parsed: any): NormalizedTemperature | undefined {
  const temps = parsed?.temperatures ?? parsed?.temperature;
  if (!temps) return undefined;

  const toolAny = temps?.tool ?? temps?.tool0;
  const bedAny = temps?.bed;

  return {
    tool: {
      actual: Number(toolAny?.actual ?? toolAny?.current ?? 0),
      target: Number(toolAny?.target ?? 0),
    },
    bed: {
      actual: Number(bedAny?.actual ?? bedAny?.current ?? 0),
      target: Number(bedAny?.target ?? 0),
    },
  };
}
