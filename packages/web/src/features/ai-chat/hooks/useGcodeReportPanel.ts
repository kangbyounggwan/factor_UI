/**
 * G-code 보고서 패널 상태 관리 훅
 *
 * 책임:
 * - 보고서 패널 열림/닫힘 상태
 * - 패널 탭 상태 (report/viewer/editor)
 * - 아카이브 뷰 상태
 * - AI 해결하기 상태
 */

import { useState, useCallback } from 'react';
import type { ReportPanelTab } from '../types';

export interface UseGcodeReportPanelOptions {
  defaultTab?: ReportPanelTab;
}

export interface UseGcodeReportPanelReturn {
  // 패널 상태
  reportPanelOpen: boolean;
  reportPanelTab: ReportPanelTab;

  // 아카이브 뷰 상태
  archiveViewActive: boolean;
  archiveClosing: boolean;

  // AI 해결하기 상태
  isAIResolving: boolean;

  // 패널 제어
  openReportPanel: () => void;
  closeReportPanel: () => void;
  toggleReportPanel: () => void;
  setReportPanelOpen: (open: boolean) => void;

  // 탭 제어
  setReportPanelTab: (tab: ReportPanelTab) => void;
  switchToReportTab: () => void;
  switchToViewerTab: () => void;
  switchToEditorTab: () => void;

  // 아카이브 뷰 제어
  openArchiveView: () => void;
  closeArchiveView: () => void;
  setArchiveViewActive: (active: boolean) => void;

  // AI 해결하기 제어
  setIsAIResolving: (resolving: boolean) => void;
  startAIResolving: () => void;
  stopAIResolving: () => void;

  // 초기화
  resetPanel: () => void;
}

/**
 * G-code 보고서 패널 관리 훅
 */
export function useGcodeReportPanel({
  defaultTab = 'report',
}: UseGcodeReportPanelOptions = {}): UseGcodeReportPanelReturn {
  // 패널 상태
  const [reportPanelOpen, setReportPanelOpen] = useState(false);
  const [reportPanelTab, setReportPanelTab] = useState<ReportPanelTab>(defaultTab);

  // 아카이브 뷰 상태
  const [archiveViewActive, setArchiveViewActive] = useState(false);
  const [archiveClosing, setArchiveClosing] = useState(false);

  // AI 해결하기 상태
  const [isAIResolving, setIsAIResolving] = useState(false);

  /**
   * 보고서 패널 열기
   */
  const openReportPanel = useCallback(() => {
    setReportPanelOpen(true);
  }, []);

  /**
   * 보고서 패널 닫기
   */
  const closeReportPanel = useCallback(() => {
    setReportPanelOpen(false);
  }, []);

  /**
   * 보고서 패널 토글
   */
  const toggleReportPanel = useCallback(() => {
    setReportPanelOpen(prev => !prev);
  }, []);

  /**
   * 보고서 탭으로 전환
   */
  const switchToReportTab = useCallback(() => {
    setReportPanelTab('report');
  }, []);

  /**
   * 뷰어 탭으로 전환
   */
  const switchToViewerTab = useCallback(() => {
    setReportPanelTab('viewer');
  }, []);

  /**
   * 에디터 탭으로 전환
   */
  const switchToEditorTab = useCallback(() => {
    setReportPanelTab('editor');
  }, []);

  /**
   * 아카이브 뷰 열기
   */
  const openArchiveView = useCallback(() => {
    setArchiveViewActive(true);
    setArchiveClosing(false);
  }, []);

  /**
   * 아카이브 뷰 닫기 (애니메이션 포함)
   */
  const closeArchiveView = useCallback(() => {
    setArchiveClosing(true);
    // 애니메이션 완료 후 실제로 닫기
    setTimeout(() => {
      setArchiveViewActive(false);
      setArchiveClosing(false);
    }, 300);
  }, []);

  /**
   * AI 해결하기 시작
   */
  const startAIResolving = useCallback(() => {
    setIsAIResolving(true);
  }, []);

  /**
   * AI 해결하기 종료
   */
  const stopAIResolving = useCallback(() => {
    setIsAIResolving(false);
  }, []);

  /**
   * 패널 상태 초기화
   */
  const resetPanel = useCallback(() => {
    setReportPanelOpen(false);
    setReportPanelTab(defaultTab);
    setArchiveViewActive(false);
    setArchiveClosing(false);
    setIsAIResolving(false);
  }, [defaultTab]);

  return {
    // 패널 상태
    reportPanelOpen,
    reportPanelTab,

    // 아카이브 뷰 상태
    archiveViewActive,
    archiveClosing,

    // AI 해결하기 상태
    isAIResolving,

    // 패널 제어
    openReportPanel,
    closeReportPanel,
    toggleReportPanel,
    setReportPanelOpen,

    // 탭 제어
    setReportPanelTab,
    switchToReportTab,
    switchToViewerTab,
    switchToEditorTab,

    // 아카이브 뷰 제어
    openArchiveView,
    closeArchiveView,
    setArchiveViewActive,

    // AI 해결하기 제어
    setIsAIResolving,
    startAIResolving,
    stopAIResolving,

    // 초기화
    resetPanel,
  };
}

export default useGcodeReportPanel;
