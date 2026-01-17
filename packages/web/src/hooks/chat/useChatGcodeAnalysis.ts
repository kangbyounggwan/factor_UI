/**
 * G-code 분석 후처리 훅
 * - 분석 결과 처리
 * - 세그먼트 데이터 저장
 */

import { useCallback, useRef } from "react";
import { saveSegmentData, type SegmentMetadata } from "@/lib/gcodeSegmentService";
import type { LayerSegmentData } from "@/lib/api/gcode";
import type { GCodeAnalysisData } from "@/components/ai/GCodeAnalytics/GCodeAnalysisReport";

interface GcodeSegmentsData {
  layers: LayerSegmentData[];
  metadata?: SegmentMetadata;
}

interface GcodeApiResult {
  response: string;
  analysisId?: string;
  fileName?: string;
  segments?: {
    layers?: LayerSegmentData[];
    metadata?: SegmentMetadata;
  };
}

interface UseChatGcodeAnalysisOptions {
  userId?: string;
  setGcodeSegments: (data: GcodeSegmentsData | null) => void;
  setReportPanelOpen: (open: boolean) => void;
  setGcodeReportData: (data: GCodeAnalysisData | null) => void;
  setActiveReportId: (id: string | null) => void;
  setGcodeAnalysisMessageId: (id: string | null) => void;
  handleGcodeAnalysisStream: (
    analysisId: string,
    fileName: string | undefined,
    messageId: string,
    dbMessageId: string | null
  ) => void;
}

interface UseChatGcodeAnalysisReturn {
  savedSegmentDataIdRef: React.MutableRefObject<string | null>;
  processGcodeAnalysis: (
    apiResult: GcodeApiResult,
    assistantMessageId: string,
    savedDbMessageId: string | null
  ) => Promise<void>;
}

export const useChatGcodeAnalysis = ({
  userId,
  setGcodeSegments,
  setReportPanelOpen,
  setGcodeReportData,
  setActiveReportId,
  setGcodeAnalysisMessageId,
  handleGcodeAnalysisStream,
}: UseChatGcodeAnalysisOptions): UseChatGcodeAnalysisReturn => {
  const savedSegmentDataIdRef = useRef<string | null>(null);

  /**
   * G-code 분석 결과 처리
   */
  const processGcodeAnalysis = useCallback(
    async (
      apiResult: GcodeApiResult,
      assistantMessageId: string,
      savedDbMessageId: string | null
    ) => {
      if (!apiResult.analysisId) return;

      console.log("[DEBUG] Starting G-code analysis polling...");

      // 새로운 분석 시작 시 기존 보고서 패널 닫고 상태 초기화
      setReportPanelOpen(false);
      setGcodeReportData(null);
      setActiveReportId(null);
      setGcodeSegments(null);

      // 메시지 ID 저장 후 폴링 시작
      setGcodeAnalysisMessageId(assistantMessageId);
      handleGcodeAnalysisStream(
        apiResult.analysisId,
        apiResult.fileName,
        assistantMessageId,
        savedDbMessageId
      );

      // 세그먼트 데이터가 있으면 상태에 저장 (3D 뷰어용)
      if (apiResult.segments) {
        console.log(
          "[DEBUG] Setting gcodeSegments for 3D viewer, layerCount:",
          apiResult.segments.layers?.length
        );
        setGcodeSegments({
          layers: apiResult.segments.layers || [],
          metadata: apiResult.segments.metadata,
        });
      }

      // 세그먼트 데이터가 있으면 DB에 저장 (로그인 사용자만)
      if (userId && apiResult.segments) {
        savedSegmentDataIdRef.current = null;
        console.log(
          "[DEBUG] Saving segment data to DB, analysisId:",
          apiResult.analysisId,
          "layerCount:",
          apiResult.segments.layers?.length
        );

        try {
          const { data, error } = await saveSegmentData({
            userId,
            analysisId: apiResult.analysisId,
            segmentResponse: {
              analysis_id: apiResult.analysisId,
              status: "segments_ready",
              segments: apiResult.segments,
              llm_analysis_started: true,
            },
          });

          if (error) {
            console.log("[DEBUG] Segment save FAILED:", error);
          } else {
            console.log("[DEBUG] Segment saved, id:", data?.id);
            savedSegmentDataIdRef.current = data?.id || null;
          }
        } catch (err) {
          console.error("[useChatGcodeAnalysis] Failed to save segment:", err);
        }
      }
    },
    [
      userId,
      setGcodeSegments,
      setReportPanelOpen,
      setGcodeReportData,
      setActiveReportId,
      setGcodeAnalysisMessageId,
      handleGcodeAnalysisStream,
    ]
  );

  return {
    savedSegmentDataIdRef,
    processGcodeAnalysis,
  };
};

export default useChatGcodeAnalysis;
