/**
 * G-code 분석 완료 후 처리 서비스
 * - 비동기 I/O (DB, API) 작업만 담당
 * - UI 상태 업데이트는 포함하지 않음
 */
import {
  saveAnalysisReport,
} from '@/lib/gcodeAnalysisDbService';
import {
  linkSegmentToReport,
  getSegmentDataIdByAnalysisId,
  loadFullSegmentData,
} from '@/lib/gcodeSegmentService';
import { updateChatSessionMetadata, updateMessageReportId } from '@shared/services/supabaseService/chat';
import type { GCodeAnalysisData } from '@/components/PrinterDetail/GCodeAnalysisReport';
import type { AnalysisResult } from '@shared/types/gcodeAnalysisTypes';
import type { SegmentData } from './useGcodeAnalysisPolling';

// DB 저장 파라미터
export interface SaveReportParams {
  userId: string;
  fileName: string;
  reportData: GCodeAnalysisData;
  apiResult: AnalysisResult;
  segmentDataId?: string;
  gcodeFileId?: string;
  storagePath?: string;
}

// DB 저장 결과
export interface SaveReportResult {
  reportId: string | null;
  error?: Error;
}

// 세션 업데이트 파라미터
export interface UpdateSessionParams {
  userId: string;
  sessionId: string;
  reportId: string;
  fileName: string;
  dbMessageId?: string | null;
}

// 세그먼트 로드 결과
export interface LoadSegmentResult {
  segmentData: SegmentData | null;
  segmentDataId: string | null;
}

/**
 * 세그먼트 데이터 ID 조회
 */
export const fetchSegmentDataId = async (
  analysisId: string,
  cachedSegmentId?: string | null
): Promise<string | null> => {
  if (cachedSegmentId) {
    return cachedSegmentId;
  }

  try {
    const { segmentDataId } = await getSegmentDataIdByAnalysisId(analysisId);
    return segmentDataId;
  } catch (err) {
    console.error('[gcodeAnalysisCompleteService] Fetch segment ID error:', err);
    return null;
  }
};

/**
 * 분석 보고서 DB 저장
 */
export const saveReportToDb = async (
  params: SaveReportParams
): Promise<SaveReportResult> => {
  const { userId, fileName, reportData, apiResult, segmentDataId, gcodeFileId, storagePath } = params;

  try {
    const { data: savedReport, error } = await saveAnalysisReport(
      userId,
      fileName,
      reportData,
      {
        apiResult,
        segmentDataId,
        gcodeFileId,
        storagePath,
      }
    );

    if (error || !savedReport) {
      return { reportId: null, error: error as Error };
    }

    return { reportId: savedReport.id };
  } catch (err) {
    console.error('[gcodeAnalysisCompleteService] Save report error:', err);
    return { reportId: null, error: err as Error };
  }
};

/**
 * 세그먼트와 보고서 연결
 */
export const linkSegmentWithReport = async (
  analysisId: string,
  reportId: string
): Promise<void> => {
  try {
    await linkSegmentToReport(analysisId, reportId);
  } catch (err) {
    console.error('[gcodeAnalysisCompleteService] Link segment error:', err);
  }
};

/**
 * 세그먼트 데이터 로드
 */
export const loadSegmentFromDb = async (
  segmentDataId: string
): Promise<SegmentData | null> => {
  try {
    const { data: loadedSegment } = await loadFullSegmentData(segmentDataId);

    if (loadedSegment) {
      return {
        layers: loadedSegment.layers,
        metadata: loadedSegment.metadata,
        temperatures: loadedSegment.temperatures,
      };
    }
    return null;
  } catch (err) {
    console.error('[gcodeAnalysisCompleteService] Load segment error:', err);
    return null;
  }
};

/**
 * 채팅 세션 메타데이터 업데이트
 */
export const updateSessionMetadata = async (
  params: UpdateSessionParams
): Promise<void> => {
  const { sessionId, reportId, fileName, dbMessageId } = params;

  try {
    await updateChatSessionMetadata(sessionId, {
      gcode_report_id: reportId,
      gcode_report_file_name: fileName,
    });

    if (dbMessageId) {
      await updateMessageReportId(dbMessageId, reportId);
    }
  } catch (err) {
    console.error('[gcodeAnalysisCompleteService] Update session error:', err);
  }
};

/**
 * 분석 완료 후 모든 DB 작업 수행 (orchestration)
 * - 보고서 저장 → 세그먼트 연결 → 세션 업데이트
 */
export interface CompleteAnalysisDbParams {
  userId?: string;
  sessionId?: string | null;
  analysisId: string;
  fileName: string;
  reportData: GCodeAnalysisData;
  apiResult: AnalysisResult;
  cachedSegmentId?: string | null;
  dbMessageId?: string | null;
  gcodeFileId?: string;
  storagePath?: string;
}

export interface CompleteAnalysisDbResult {
  reportId: string | null;
  segmentData: SegmentData | null;
  segmentDataId: string | null;
}

export const completeAnalysisDbOperations = async (
  params: CompleteAnalysisDbParams
): Promise<CompleteAnalysisDbResult> => {
  const {
    userId,
    sessionId,
    analysisId,
    fileName,
    reportData,
    apiResult,
    cachedSegmentId,
    dbMessageId,
    gcodeFileId,
    storagePath,
  } = params;

  // 비로그인 사용자는 DB 작업 스킵
  if (!userId) {
    return {
      reportId: null,
      segmentData: null,
      segmentDataId: null,
    };
  }

  // 1. 세그먼트 ID 조회
  const segmentDataId = await fetchSegmentDataId(analysisId, cachedSegmentId);

  // 2. 보고서 저장
  const { reportId } = await saveReportToDb({
    userId,
    fileName,
    reportData,
    apiResult,
    segmentDataId: segmentDataId || undefined,
    gcodeFileId,
    storagePath,
  });

  // 3. 세그먼트-보고서 연결
  if (reportId) {
    await linkSegmentWithReport(analysisId, reportId);
  }

  // 4. 세그먼트 데이터 로드
  let segmentData: SegmentData | null = null;
  if (segmentDataId) {
    segmentData = await loadSegmentFromDb(segmentDataId);
  }

  // 5. 세션 메타데이터 업데이트
  if (sessionId && reportId) {
    await updateSessionMetadata({
      userId,
      sessionId,
      reportId,
      fileName,
      dbMessageId,
    });
  }

  return {
    reportId,
    segmentData,
    segmentDataId,
  };
};
