/**
 * G-code 통합 컨트롤러 훅
 *
 * 책임:
 * - G-code 분석 폴링 (useGcodeAnalysisPolling 래핑)
 * - G-code 에디터 (useGcodeEditor 래핑)
 * - 보고서 패널 (useGcodeReportPanel 래핑)
 * - AI 해결하기 핸들러
 * - 패치 적용/저장 핸들러
 * - 보고서 카드 클릭 핸들러
 */

import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { useGcodeEditor } from './useGcodeEditor';
import { useGcodeReportPanel } from './useGcodeReportPanel';
import {
  useGcodeAnalysisPolling,
  type ReportCardData,
  type StartPollingParams,
} from '@/components/ai/GCodeAnalytics/useGcodeAnalysisPolling';
import {
  convertDbReportToUiData,
  getAnalysisReportById,
  downloadGCodeContent,
  deleteAnalysisReport,
} from '@/lib/gcodeAnalysisDbService';
import { loadFullSegmentDataByReportId } from '@/lib/gcodeSegmentService';
import { extractGcodeContext } from '@/lib/api/gcode';
import { saveChatMessage } from '@shared/services/supabaseService/chat';
import type { Message, CodeFix, ReportPanelTab } from '../types';
import type { AIResolveStartInfo, AIResolveCompleteInfo, GCodeAnalysisData } from '@/components/ai/GCodeAnalytics';

export interface UseGcodeControllerOptions {
  userId?: string;
  currentSessionId?: string | null;
  gcodeFileContentRef?: React.MutableRefObject<string | null>;
  setGcodeFileContent?: (content: string | null) => void;
  setMessages?: React.Dispatch<React.SetStateAction<Message[]>>;
  messagesEndRef?: React.RefObject<HTMLDivElement | null>;
}

export interface ReportArchiveItem {
  id: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  createdAt: Date;
}

export interface UseGcodeControllerReturn {
  // === 분석 상태 (useGcodeAnalysisPolling) ===
  isAnalyzing: boolean;
  analysisProgress: number;
  analysisTimeline: unknown[];
  analysisProgressMessage: string | null;
  analysisId: string | null;
  reportData: GCodeAnalysisData | null;
  segmentData: { layers: unknown[]; metadata?: unknown; temperatures?: unknown[] } | null;
  activeReportId: string | null;

  // === 에디터 상태 (useGcodeEditor) ===
  editorContent: string | undefined;
  editorLoading: boolean;
  editorFixInfo: { lineNumber: number; original: string; fixed: string; description?: string } | undefined;
  pendingPatches: Map<number, { originalCode: string; fixedCode: string }>;
  resolvedLines: Set<number>;
  revertLineNumber: number | undefined;

  // === 패널 상태 (useGcodeReportPanel) ===
  reportPanelOpen: boolean;
  reportPanelTab: ReportPanelTab;
  archiveViewActive: boolean;
  archiveClosing: boolean;
  isAIResolving: boolean;

  // === 보고서 아카이브 ===
  reportArchive: ReportArchiveItem[];

  // === 분석 액션 ===
  startAnalysis: (params: StartPollingParams & {
    onReportCardReady?: (reportCard: ReportCardData, messageId?: string) => void;
    onError?: (error: string) => void;
  }) => void;
  stopAnalysis: () => void;

  // === 에디터 액션 ===
  setEditorContent: (content: string | undefined) => void;
  setEditorLoading: (loading: boolean) => void;
  setEditorFixInfo: (fixInfo: { lineNumber: number; original: string; fixed: string; description?: string } | undefined) => void;

  // === 패널 액션 ===
  openReportPanel: () => void;
  closeReportPanel: () => void;
  setReportPanelTab: (tab: ReportPanelTab) => void;
  openArchiveView: () => void;
  closeArchiveView: () => void;

  // === AI 해결하기 핸들러 ===
  handleAIResolveStart: (info: AIResolveStartInfo) => void;
  handleAIResolveComplete: (info: AIResolveCompleteInfo) => void;
  handleAIResolveError: (error: string) => void;

  // === 코드 수정 핸들러 ===
  handleViewCodeFix: (fix: CodeFix, messages: Message[]) => Promise<void>;
  handleApplyFix: (lineNumber: number, originalCode: string, fixedCode: string) => void;
  handleRevert: (lineNumber: number) => void;
  handleSaveModifiedGCode: () => Promise<void>;

  // === 보고서 카드 핸들러 ===
  handleReportCardClick: (reportId: string) => Promise<void>;
  handleSelectReport: (reportId: string) => Promise<void>;
  handleDeleteReport: (reportId: string) => Promise<void>;
  handleArchiveToggle: () => void;

  // === 상태 설정 ===
  setReportData: React.Dispatch<React.SetStateAction<GCodeAnalysisData | null>>;
  setActiveReportId: React.Dispatch<React.SetStateAction<string | null>>;
  setSegmentData: React.Dispatch<React.SetStateAction<{ layers: unknown[]; metadata?: unknown; temperatures?: unknown[] } | null>>;

  // === 초기화 ===
  resetGcode: () => void;
}

/**
 * G-code 통합 컨트롤러 훅
 */
export function useGcodeController({
  userId,
  currentSessionId,
  gcodeFileContentRef,
  setGcodeFileContent,
  setMessages,
  messagesEndRef,
}: UseGcodeControllerOptions = {}): UseGcodeControllerReturn {
  const { t } = useTranslation();
  const { toast } = useToast();

  // 보고서 아카이브 상태
  const [reportArchive, setReportArchive] = useState<ReportArchiveItem[]>([]);

  // 하위 훅들
  const editor = useGcodeEditor();
  const panel = useGcodeReportPanel();
  const polling = useGcodeAnalysisPolling();

  // 내부 ref
  const localGcodeContentRef = useRef<string | null>(null);
  const effectiveGcodeContentRef = gcodeFileContentRef || localGcodeContentRef;

  /**
   * 분석 시작 (폴링 래퍼)
   */
  const startAnalysis = useCallback((params: StartPollingParams & {
    onReportCardReady?: (reportCard: ReportCardData, messageId?: string) => void;
    onError?: (error: string) => void;
  }) => {
    // 분석 시작 시 보고서 패널 열기
    panel.openReportPanel();

    polling.startPolling({
      ...params,
      userId,
      sessionId: params.sessionId ?? currentSessionId,
      gcodeContent: effectiveGcodeContentRef.current,
      onReportCardReady: (reportCard) => {
        // 보고서 패널 열기
        panel.openReportPanel();

        // 보고서 아카이브에 추가
        if (reportCard.reportId) {
          setReportArchive(prev => {
            if (prev.some(r => r.id === reportCard.reportId)) {
              return prev;
            }
            const newReport: ReportArchiveItem = {
              id: reportCard.reportId,
              fileName: reportCard.fileName,
              overallScore: reportCard.overallScore,
              overallGrade: reportCard.overallGrade,
              totalIssues: reportCard.totalIssues,
              createdAt: new Date(),
            };
            return [newReport, ...prev].slice(0, 10);
          });
        }

        // 콜백 호출
        params.onReportCardReady?.(reportCard, params.messageId);
      },
      onError: (errorMsg) => {
        panel.closeReportPanel();
        params.onError?.(errorMsg);
      },
    });
  }, [polling, panel, userId, currentSessionId, effectiveGcodeContentRef]);

  /**
   * AI 해결하기 시작
   */
  const handleAIResolveStart = useCallback((info: AIResolveStartInfo) => {
    panel.startAIResolving();

    toast({
      title: t('aiChat.aiResolving', 'AI 분석 중'),
      description: `"${info.issueTitle}" ${t('aiChat.analyzing', '분석 중...')}`,
    });

    // 사용자 질문 메시지 추가
    if (setMessages) {
      const userContent = `"${info.issueTitle}" 이슈를 해결해줘`;
      const userMessage: Message = {
        id: `user-resolve-${Date.now()}`,
        role: 'user',
        content: userContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // DB 저장
      if (userId && currentSessionId) {
        saveChatMessage(currentSessionId, userId, 'user', userContent, {
          metadata: { tool: 'resolve_issue' },
        });
      }
    }

    // 자동 스크롤
    setTimeout(() => {
      messagesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, [panel, toast, t, setMessages, userId, currentSessionId, messagesEndRef]);

  /**
   * AI 해결하기 완료
   */
  const handleAIResolveComplete = useCallback((info: AIResolveCompleteInfo) => {
    panel.stopAIResolving();

    const { resolution, updated_issue } = info.resolution;
    const { explanation, solution, tips } = resolution;

    // 마크다운 응답 구성
    let content = '';

    const severityEmoji: Record<string, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🔵',
      none: '🟢',
    };
    const emoji = severityEmoji[explanation.severity] || '⚪';
    content += `## ${emoji} ${updated_issue?.title || 'AI 분석 결과'}\n\n`;

    if (explanation.is_false_positive) {
      content += `> ✅ **오탐 확인됨** - 실제 문제가 아닙니다.\n\n`;
    }

    content += `### 📋 요약\n${explanation.summary}\n\n`;
    content += `### 🔍 원인\n${explanation.cause}\n\n`;

    if (solution.action_needed && solution.steps?.length > 0) {
      content += `### 🔧 해결 방법\n`;
      solution.steps.forEach((step: string, i: number) => {
        content += `${i + 1}. ${step}\n`;
      });
      content += '\n';
    }

    // 코드 수정 정보 추출
    const codeFixesRaw = solution.code_fixes?.filter((fix: { has_fix?: boolean }) => fix.has_fix) ||
      (solution.code_fix?.has_fix ? [solution.code_fix] : []);

    const codeFixesForMessage: CodeFix[] = codeFixesRaw.map((fix: { line_number?: number; original?: string; fixed?: string }) => ({
      line_number: fix.line_number ?? null,
      original: fix.original ?? null,
      fixed: fix.fixed ?? null,
    }));

    if (codeFixesRaw.length > 0) {
      content += `### 💻 코드 수정 (${codeFixesRaw.length}건)\n`;
      content += `> 아래 코드 수정 카드를 클릭하면 에디터에서 직접 수정할 수 있습니다.\n\n`;
    }

    if (tips?.length > 0) {
      content += `### 💡 팁\n`;
      tips.forEach((tip: string) => {
        content += `- ${tip}\n`;
      });
      content += '\n';
    }

    if (!solution.action_needed) {
      content += `> ✅ 별도의 조치가 필요하지 않습니다.\n`;
    }

    // AI 응답 메시지 추가
    if (setMessages) {
      const assistantMessage: Message = {
        id: `assistant-resolve-${Date.now()}`,
        role: 'assistant',
        content: content.trim(),
        timestamp: new Date(),
        codeFixes: codeFixesForMessage.length > 0 ? codeFixesForMessage : undefined,
        analysisReportId: info.reportId,
        gcodeContext: info.gcodeContext,
      };
      setMessages(prev => [...prev, assistantMessage]);

      // DB 저장
      if (userId && currentSessionId) {
        saveChatMessage(currentSessionId, userId, 'assistant', content.trim(), {
          metadata: {
            tool: 'resolve_issue',
            codeFixes: codeFixesForMessage.length > 0 ? codeFixesForMessage : undefined,
            gcodeContext: info.gcodeContext,
            analysisReportId: info.reportId,
          },
        });
      }
    }
  }, [panel, setMessages, userId, currentSessionId]);

  /**
   * AI 해결하기 에러
   */
  const handleAIResolveError = useCallback((error: string) => {
    panel.stopAIResolving();

    const errorContent = `AI 해결 중 오류가 발생했습니다: ${error}`;

    if (setMessages) {
      const errorMessage: Message = {
        id: `assistant-error-${Date.now()}`,
        role: 'assistant',
        content: errorContent,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);

      if (userId && currentSessionId) {
        saveChatMessage(currentSessionId, userId, 'assistant', errorContent, {
          metadata: { tool: 'resolve_issue' },
        });
      }
    }
  }, [panel, setMessages, userId, currentSessionId]);

  /**
   * 코드 수정 보기 (에디터 탭으로 이동)
   */
  const handleViewCodeFix = useCallback(async (fix: CodeFix, messages: Message[]) => {
    const resolveMessage = messages.find(m => m.codeFixes && m.gcodeContext);

    if (resolveMessage?.gcodeContext && fix.line_number) {
      editor.setEditorContent(resolveMessage.gcodeContext);
      editor.setEditorFixInfo({
        lineNumber: fix.line_number,
        original: fix.original || '',
        fixed: fix.fixed || '',
      });
      panel.setReportPanelTab('editor');
    } else {
      // G-code 컨텍스트가 없으면 스토리지에서 로드 시도
      const reportId = resolveMessage?.analysisReportId || polling.activeReportId;
      if (reportId && fix.line_number) {
        editor.setEditorLoading(true);
        try {
          const { data: report } = await getAnalysisReportById(reportId);
          if (report) {
            const reportUiData = convertDbReportToUiData(report);
            const storagePath = reportUiData.storagePath;

            if (storagePath) {
              const gcodeContent = await downloadGCodeContent(storagePath);
              if (gcodeContent) {
                effectiveGcodeContentRef.current = gcodeContent;
                setGcodeFileContent?.(gcodeContent);

                const extracted = extractGcodeContext(gcodeContent, fix.line_number, 30);
                editor.setEditorContent(extracted);
                editor.setEditorFixInfo({
                  lineNumber: fix.line_number,
                  original: fix.original || '',
                  fixed: fix.fixed || '',
                });
                panel.setReportPanelTab('editor');
              }
            }
          }
        } finally {
          editor.setEditorLoading(false);
        }
      } else {
        toast({
          title: t('aiChat.noGcodeData', 'G-code 데이터 없음'),
          description: t('aiChat.noGcodeDataDesc', '연결된 G-code 데이터를 찾을 수 없습니다.'),
          variant: 'destructive',
        });
      }
    }
  }, [editor, panel, polling.activeReportId, effectiveGcodeContentRef, setGcodeFileContent, toast, t]);

  /**
   * 패치 적용
   */
  const handleApplyFix = useCallback((lineNumber: number, originalCode: string, fixedCode: string) => {
    editor.addPendingPatch(lineNumber, { originalCode, fixedCode });
    editor.markLineResolved(lineNumber);

    toast({
      title: t('aiChat.patchQueued', '패치 대기 중'),
      description: t('aiChat.patchQueuedDesc', '수정본 저장 시 적용됩니다.'),
    });
  }, [editor, toast, t]);

  /**
   * 되돌리기
   */
  const handleRevert = useCallback((lineNumber: number) => {
    editor.removePendingPatch(lineNumber);
    editor.unmarkLineResolved(lineNumber);
    editor.setRevertLineNumber(lineNumber);

    toast({
      title: t('aiChat.revertSuccess', '되돌리기 완료'),
      description: t('aiChat.revertSuccessDesc', '패치가 취소되었습니다.'),
    });
  }, [editor, toast, t]);

  /**
   * 수정된 G-code 저장
   */
  const handleSaveModifiedGCode = useCallback(async () => {
    if (editor.pendingPatches.size === 0) {
      toast({
        title: t('aiChat.noPendingPatches', '적용할 패치 없음'),
        description: t('aiChat.noPendingPatchesDesc', '저장할 수정사항이 없습니다.'),
        variant: 'destructive',
      });
      return;
    }

    const storagePath = polling.reportData?.storagePath;
    if (!storagePath) {
      toast({
        title: t('aiChat.noStoragePath', '저장 경로 없음'),
        description: t('aiChat.noStoragePathDesc', 'G-code 파일의 저장 경로를 찾을 수 없습니다.'),
        variant: 'destructive',
      });
      return;
    }

    try {
      // 전체 G-code 파일 로드
      let fullContent = effectiveGcodeContentRef.current;
      if (!fullContent) {
        fullContent = await downloadGCodeContent(storagePath);
        if (fullContent) {
          effectiveGcodeContentRef.current = fullContent;
          setGcodeFileContent?.(fullContent);
        }
      }

      if (!fullContent) {
        toast({
          title: t('aiChat.loadFailed', '파일 로드 실패'),
          description: t('aiChat.loadFailedDesc', 'G-code 파일을 불러올 수 없습니다.'),
          variant: 'destructive',
        });
        return;
      }

      // 패치 적용
      const lines = fullContent.split('\n');
      let appliedCount = 0;

      for (const [lineNumber, patch] of editor.pendingPatches) {
        const targetIndex = lineNumber - 1;
        if (targetIndex >= 0 && targetIndex < lines.length) {
          if (lines[targetIndex].trim() === patch.originalCode.trim()) {
            lines[targetIndex] = patch.fixedCode;
            appliedCount++;
          }
        }
      }

      if (appliedCount === 0) {
        toast({
          title: t('aiChat.noMatchingLines', '일치하는 라인 없음'),
          description: t('aiChat.noMatchingLinesDesc', '원본 코드와 일치하는 라인을 찾을 수 없습니다.'),
          variant: 'destructive',
        });
        return;
      }

      // 수정된 파일 다운로드
      const modifiedContent = lines.join('\n');
      const fileName = polling.reportData?.fileName || 'modified.gcode';
      const modifiedFileName = fileName.replace(/\.gcode$/i, '_modified.gcode');

      const blob = new Blob([modifiedContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = modifiedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 패치 상태 초기화
      editor.clearPendingPatches();
      editor.clearResolvedLines();

      toast({
        title: t('aiChat.saveSuccess', '저장 완료'),
        description: t('aiChat.saveSuccessDesc', `${appliedCount}개의 패치가 적용되었습니다.`),
      });
    } catch (error) {
      console.error('[useGcodeController] Save failed:', error);
      toast({
        title: t('aiChat.saveFailed', '저장 실패'),
        description: error instanceof Error ? error.message : t('common.unknownError', '알 수 없는 오류'),
        variant: 'destructive',
      });
    }
  }, [editor, polling.reportData, effectiveGcodeContentRef, setGcodeFileContent, toast, t]);

  /**
   * 보고서 카드 클릭
   */
  const handleReportCardClick = useCallback(async (reportId: string) => {
    // 같은 보고서가 열려있으면 닫기
    if (panel.reportPanelOpen && polling.activeReportId === reportId) {
      panel.closeReportPanel();
      polling.setActiveReportId(null);
      panel.setReportPanelTab('report');
      editor.clearEditorContent();
      editor.clearEditorFixInfo();
      return;
    }

    // 보고서 로드
    const { data: report } = await getAnalysisReportById(reportId);
    if (report) {
      const { data: segmentData } = await loadFullSegmentDataByReportId(reportId);

      const reportUiData = convertDbReportToUiData(report);
      polling.setReportData({
        ...reportUiData,
        analysisId: segmentData?.analysisId,
      });
      polling.setActiveReportId(reportId);
      panel.openReportPanel();
      panel.setReportPanelTab('report');
      editor.clearEditorContent();
      editor.clearEditorFixInfo();

      // G-code 원본 파일 로드
      if (reportUiData.storagePath) {
        const gcodeContent = await downloadGCodeContent(reportUiData.storagePath);
        if (gcodeContent) {
          setGcodeFileContent?.(gcodeContent);
          effectiveGcodeContentRef.current = gcodeContent;
        }
      }

      if (segmentData?.layers?.length > 0) {
        polling.setSegmentData({
          layers: segmentData.layers,
          metadata: segmentData.metadata,
          temperatures: segmentData.temperatures,
        });
      } else {
        polling.setSegmentData(null);
      }
    }
  }, [panel, polling, editor, setGcodeFileContent, effectiveGcodeContentRef]);

  /**
   * 보고서 선택 (사이드바에서)
   */
  const handleSelectReport = useCallback(async (reportId: string) => {
    await handleReportCardClick(reportId);
  }, [handleReportCardClick]);

  /**
   * 보고서 삭제
   */
  const handleDeleteReport = useCallback(async (reportId: string) => {
    try {
      await deleteAnalysisReport(reportId);
      setReportArchive(prev => prev.filter(r => r.id !== reportId));

      if (polling.activeReportId === reportId) {
        panel.closeReportPanel();
        polling.setActiveReportId(null);
        polling.setReportData(null);
        polling.setSegmentData(null);
      }

      toast({
        title: t('aiChat.reportDeleted', '보고서 삭제됨'),
        description: t('aiChat.reportDeletedDesc', '보고서가 삭제되었습니다.'),
      });
    } catch (error) {
      console.error('[useGcodeController] Delete report failed:', error);
      toast({
        title: t('common.error', '오류'),
        description: t('aiChat.reportDeleteFailed', '보고서 삭제에 실패했습니다.'),
        variant: 'destructive',
      });
    }
  }, [polling, panel, toast, t]);

  /**
   * 아카이브 토글
   */
  const handleArchiveToggle = useCallback(() => {
    if (panel.archiveViewActive) {
      panel.closeArchiveView();
    } else {
      panel.openArchiveView();
    }
  }, [panel]);

  /**
   * 전체 초기화
   */
  const resetGcode = useCallback(() => {
    polling.stopPolling();
    polling.setReportData(null);
    polling.setActiveReportId(null);
    polling.setSegmentData(null);
    editor.resetEditor();
    panel.resetPanel();
    setReportArchive([]);
  }, [polling, editor, panel]);

  return {
    // 분석 상태
    isAnalyzing: polling.isAnalyzing,
    analysisProgress: polling.progress,
    analysisTimeline: polling.timeline,
    analysisProgressMessage: polling.progressMessage,
    analysisId: polling.analysisId,
    reportData: polling.reportData,
    segmentData: polling.segmentData,
    activeReportId: polling.activeReportId,

    // 에디터 상태
    editorContent: editor.editorContent,
    editorLoading: editor.editorLoading,
    editorFixInfo: editor.editorFixInfo,
    pendingPatches: editor.pendingPatches,
    resolvedLines: editor.resolvedLines,
    revertLineNumber: editor.revertLineNumber,

    // 패널 상태
    reportPanelOpen: panel.reportPanelOpen,
    reportPanelTab: panel.reportPanelTab,
    archiveViewActive: panel.archiveViewActive,
    archiveClosing: panel.archiveClosing,
    isAIResolving: panel.isAIResolving,

    // 보고서 아카이브
    reportArchive,

    // 분석 액션
    startAnalysis,
    stopAnalysis: polling.stopPolling,

    // 에디터 액션
    setEditorContent: editor.setEditorContent,
    setEditorLoading: editor.setEditorLoading,
    setEditorFixInfo: editor.setEditorFixInfo,

    // 패널 액션
    openReportPanel: panel.openReportPanel,
    closeReportPanel: panel.closeReportPanel,
    setReportPanelTab: panel.setReportPanelTab,
    openArchiveView: panel.openArchiveView,
    closeArchiveView: panel.closeArchiveView,

    // AI 해결하기 핸들러
    handleAIResolveStart,
    handleAIResolveComplete,
    handleAIResolveError,

    // 코드 수정 핸들러
    handleViewCodeFix,
    handleApplyFix,
    handleRevert,
    handleSaveModifiedGCode,

    // 보고서 카드 핸들러
    handleReportCardClick,
    handleSelectReport,
    handleDeleteReport,
    handleArchiveToggle,

    // 상태 설정
    setReportData: polling.setReportData,
    setActiveReportId: polling.setActiveReportId,
    setSegmentData: polling.setSegmentData,

    // 초기화
    resetGcode,
  };
}

export default useGcodeController;
