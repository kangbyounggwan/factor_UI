/**
 * G-code Analysis API Service
 * Python 백엔드와의 통신을 담당하는 서비스
 */

import type {
    GCodeAnalysisRequest,
    GCodeAnalysisResponse,
    AnalysisStatusResponse,
    PatchApprovalRequest,
    PatchApprovalResponse,
    SSETimelineEvent,
    SSEProgressEvent,
    SSECompleteEvent,
    SSEErrorEvent,
    GCodeSummaryRequest,
    GCodeSummaryResponse,
    DeltaExportRequest,
    DeltaExportResponse,
} from '@shared/types/gcodeAnalysisTypes';

// API Base URL (환경변수 사용)
const getBaseUrl = (): string => {
    const envUrl = (import.meta as any).env?.VITE_AI_PYTHON_URL;
    if (!envUrl) {
        throw new Error('VITE_AI_PYTHON_URL 환경변수가 설정되지 않았습니다.');
    }
    return envUrl;
};

/**
 * G-code 분석 시작
 */
export async function startGCodeAnalysis(
    request: GCodeAnalysisRequest
): Promise<GCodeAnalysisResponse> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/analyze`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Analysis request failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * 분석 상태 조회
 */
export async function getAnalysisStatus(
    analysisId: string
): Promise<AnalysisStatusResponse> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/analysis/${analysisId}`;

    const response = await fetch(url);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Status request failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * SSE 스트리밍 구독
 */
export interface SSECallbacks {
    onTimeline?: (event: SSETimelineEvent) => void;
    onProgress?: (event: SSEProgressEvent) => void;
    onComplete?: (event: SSECompleteEvent) => void;
    onError?: (event: SSEErrorEvent) => void;
}

export function subscribeToAnalysisStream(
    analysisId: string,
    callbacks: SSECallbacks
): EventSource {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/analysis/${analysisId}/stream`;

    const eventSource = new EventSource(url);

    eventSource.addEventListener('timeline', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data) as SSETimelineEvent;
            callbacks.onTimeline?.(data);
        } catch (err) {
            console.error('[gcodeAnalysisService] Failed to parse timeline event:', err);
        }
    });

    eventSource.addEventListener('progress', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data) as SSEProgressEvent;
            callbacks.onProgress?.(data);
        } catch (err) {
            console.error('[gcodeAnalysisService] Failed to parse progress event:', err);
        }
    });

    eventSource.addEventListener('complete', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data) as SSECompleteEvent;
            callbacks.onComplete?.(data);
            eventSource.close();
        } catch (err) {
            console.error('[gcodeAnalysisService] Failed to parse complete event:', err);
        }
    });

    eventSource.addEventListener('error', (e: MessageEvent) => {
        try {
            const data = JSON.parse(e.data) as SSEErrorEvent;
            callbacks.onError?.(data);
            eventSource.close();
        } catch (err) {
            // SSE 연결 에러
            callbacks.onError?.({ error: 'SSE connection error' });
            eventSource.close();
        }
    });

    eventSource.onerror = () => {
        callbacks.onError?.({ error: 'SSE connection lost' });
        eventSource.close();
    };

    return eventSource;
}

/**
 * 패치 승인/거부
 */
export async function approvePatch(
    analysisId: string,
    request: PatchApprovalRequest
): Promise<PatchApprovalResponse> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/analysis/${analysisId}/approve`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Approval request failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * 수정된 G-code 다운로드
 */
export async function downloadPatchedGCode(analysisId: string): Promise<Blob> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/analysis/${analysisId}/download`;

    const response = await fetch(url);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Download request failed: ${response.status} ${errorText}`);
    }

    return response.blob();
}

/**
 * G-code 파일 다운로드 및 저장
 */
export async function downloadAndSaveGCode(
    analysisId: string,
    filename?: string
): Promise<void> {
    const blob = await downloadPatchedGCode(analysisId);
    const finalFilename = filename || `patched_${analysisId}.gcode`;

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * G-code 요약 분석 (LLM 없이 빠른 분석)
 * POST /api/v1/gcode/summary
 */
export async function getGCodeSummary(
    request: GCodeSummaryRequest
): Promise<GCodeSummaryResponse> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/summary`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Summary request failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * 분석 ID로 요약 결과 조회
 * GET /api/v1/gcode/analysis/{id}/summary
 */
export async function getAnalysisSummary(
    analysisId: string
): Promise<GCodeSummaryResponse> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/analysis/${analysisId}/summary`;

    const response = await fetch(url);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Summary fetch failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * 에러 분석 별도 실행
 * POST /api/v1/gcode/analysis/{id}/error-analysis
 */
export async function requestErrorAnalysis(
    analysisId: string
): Promise<GCodeAnalysisResponse> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/analysis/${analysisId}/error-analysis`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error analysis request failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * 델타 기반 G-code 내보내기
 * POST /api/v1/gcode/export
 *
 * 대용량 파일(50만줄+)을 효율적으로 처리하기 위해
 * 전체 파일 대신 변경된 델타만 서버로 전송하고
 * 서버에서 스트리밍으로 병합 후 반환
 */
export async function exportGCodeWithDeltas(
    request: DeltaExportRequest
): Promise<DeltaExportResponse> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/export`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export request failed: ${response.status} ${errorText}`);
    }

    return response.json();
}

/**
 * 델타 기반 G-code 내보내기 + 직접 다운로드
 * 서버에서 병합된 파일을 Blob으로 받아 다운로드
 */
export async function exportAndDownloadGCodeWithDeltas(
    request: DeltaExportRequest,
    filename?: string
): Promise<void> {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/v1/gcode/export`;

    console.log('[exportAndDownloadGCodeWithDeltas] Request:', {
        url,
        body: request,
    });

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Export download failed: ${response.status} ${errorText}`);
    }

    const blob = await response.blob();
    const finalFilename = filename || request.filename || `modified_${request.analysis_id}.gcode`;

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = finalFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
}
