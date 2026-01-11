/**
 * GCodeViewerReportModal 컴포넌트
 * G-code 파일을 보고서 형식의 뷰어로 보여주는 모달
 * - 보고서 / 뷰어 / 에디터 탭 UI (GCodeAnalysisReport 사용)
 * - 커뮤니티 게시물, 보고서 아카이브 등에서 공통 사용
 */
import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { GCodeAnalysisReport, type GCodeAnalysisData, type ReportPanelTab } from './GCodeAnalysisReport';

interface GCodeViewerReportModalProps {
  /** 모달 열림 상태 */
  isOpen: boolean;
  /** 모달 닫기 콜백 */
  onClose: () => void;
  /** G-code 파일 URL (URL 기반 로드 시) */
  gcodeUrl?: string;
  /** G-code 콘텐츠 (직접 전달 시) */
  gcodeContent?: string;
  /** 파일명 */
  fileName: string;
  /** 초기 탭 (기본: viewer) */
  initialTab?: ReportPanelTab;
  /** 공유 버튼 표시 여부 (기본: false) */
  showShareButton?: boolean;
  /** 분석 데이터 (보고서에서 사용 시 전달) */
  analysisData?: Partial<GCodeAnalysisData>;
}

/**
 * G-code 뷰어 보고서 모달
 * URL 또는 콘텐츠로 G-code를 로드하여 보고서 형식으로 표시
 */
export function GCodeViewerReportModal({
  isOpen,
  onClose,
  gcodeUrl,
  gcodeContent: initialContent,
  fileName,
  initialTab = 'viewer',
  showShareButton = false,
  analysisData: externalAnalysisData,
}: GCodeViewerReportModalProps) {
  const [gcodeContent, setGcodeContent] = useState<string>(initialContent || '');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<ReportPanelTab>(initialTab);

  // URL에서 G-code 로드
  useEffect(() => {
    if (isOpen && gcodeUrl && !gcodeContent && !isLoading) {
      setIsLoading(true);
      fetch(gcodeUrl)
        .then(res => res.text())
        .then(text => {
          setGcodeContent(text);
        })
        .catch(err => {
          console.error('[GCodeViewerReportModal] Failed to load gcode:', err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen, gcodeUrl, gcodeContent, isLoading]);

  // 외부에서 콘텐츠가 전달되면 사용
  useEffect(() => {
    if (initialContent) {
      setGcodeContent(initialContent);
    }
  }, [initialContent]);

  // 모달 열릴 때 초기 탭으로 설정
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // 모달 닫힐 때 상태 리셋
  const handleClose = useCallback(() => {
    onClose();
    // URL 기반이면 콘텐츠 리셋 (다음 열 때 다시 로드)
    if (gcodeUrl && !initialContent) {
      setGcodeContent('');
    }
  }, [onClose, gcodeUrl, initialContent]);

  // 분석 데이터 생성 (외부 데이터 또는 기본값)
  const analysisData: GCodeAnalysisData = {
    fileName: fileName,
    gcodeContent: gcodeContent,
    storagePath: gcodeUrl,
    metrics: {
      printTime: { value: '-' },
      filamentUsage: { length: '-' },
      layerCount: { value: 0 },
      retractionCount: { value: 0 },
    },
    support: { percentage: 0 },
    speedDistribution: {
      travel: 0,
      infill: 0,
      perimeter: 0,
    },
    temperature: {
      nozzle: 0,
      bed: 0,
    },
    analysis: {
      warnings: [],
      cautions: [],
      suggestions: [],
      goodPoints: [],
    },
    // 외부 데이터로 덮어쓰기
    ...externalAnalysisData,
    // gcodeContent는 항상 로드된 것 사용
    ...(gcodeContent && { gcodeContent }),
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-6xl w-[95vw] h-[90vh] p-0 overflow-hidden" hideCloseButton>
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
          </div>
        ) : (
          <GCodeAnalysisReport
            data={analysisData}
            embedded={false}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onClose={handleClose}
            showShareButton={showShareButton}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export default GCodeViewerReportModal;
