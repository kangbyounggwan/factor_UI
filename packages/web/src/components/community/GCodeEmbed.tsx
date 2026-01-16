/**
 * GCodeEmbed 컴포넌트
 * 커뮤니티 게시물에 GCode 파일을 임베드하여 보여주는 컴포넌트
 * - GCodeAnalysisReport를 embedded 모드로 사용 (보고서/뷰어 탭 UI)
 * - gcodeEmbedId가 있으면 gcode_segment_data 테이블에서 조회
 * - 없으면 API를 통해 세그먼트 생성
 * - 다운로드 기능
 * - 확대 시 GCodeViewerReportModal 사용 (모달 형태)
 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { FileCode, Download, Loader2, Maximize2, Lock } from 'lucide-react';
import { GCodeViewerReportModal } from '@/components/ai/GCodeAnalytics/GCodeViewerReportModal';
import { GCodeAnalysisReport, type GCodeAnalysisData, type ReportPanelTab } from '@/components/ai/GCodeAnalytics/GCodeAnalysisReport';
import type { LayerSegmentData, TemperatureData } from '@/lib/api/gcode';
import type { SegmentMetadata } from '@/lib/gcodeSegmentService';
import { loadFullSegmentByEmbedId } from '@/lib/gcodeSegmentService';
import { createCommunitySegments } from '@/lib/api/gcode';

/**
 * 초 단위 시간을 "Xh Ym" 형식으로 변환
 */
function formatPrintTime(seconds: number | undefined): string {
  if (!seconds || seconds <= 0) return '-';

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${Math.floor(seconds)}s`;
  }
}

/**
 * G-code 내용에서 속도 및 리트렉션 정보 추출
 */
function extractGCodeStats(gcodeContent: string): {
  speedDistribution: {
    travel: number;
    infill: number;
    perimeter: number;
    support?: number;
  };
  retractionCount: number;
} {
  const lines = gcodeContent.split('\n');
  let retractionCount = 0;
  const speeds: { travel: number[]; infill: number[]; perimeter: number[]; support: number[] } = {
    travel: [],
    infill: [],
    perimeter: [],
    support: [],
  };

  let currentType: 'travel' | 'infill' | 'perimeter' | 'support' = 'travel';
  let lastE = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // 타입 주석 감지 (슬라이서별 형식)
    const lowerLine = trimmed.toLowerCase();
    if (lowerLine.includes('type:') || lowerLine.includes('feature:')) {
      if (lowerLine.includes('travel') || lowerLine.includes('move')) {
        currentType = 'travel';
      } else if (lowerLine.includes('infill') || lowerLine.includes('fill') || lowerLine.includes('internal')) {
        currentType = 'infill';
      } else if (lowerLine.includes('perimeter') || lowerLine.includes('wall') || lowerLine.includes('outer') || lowerLine.includes('inner')) {
        currentType = 'perimeter';
      } else if (lowerLine.includes('support')) {
        currentType = 'support';
      }
    }

    // G1 명령어에서 속도(F) 추출
    if (trimmed.startsWith('G1') || trimmed.startsWith('G0')) {
      const fMatch = trimmed.match(/F(\d+(?:\.\d+)?)/i);
      if (fMatch) {
        const feedRate = parseFloat(fMatch[1]);
        // F 값은 mm/min이므로 mm/s로 변환
        const speedMmS = feedRate / 60;
        if (speedMmS > 0 && speedMmS < 1000) { // 유효한 속도 범위
          speeds[currentType].push(speedMmS);
        }
      }

      // 리트렉션 감지 (E 값이 감소하면 리트렉션)
      const eMatch = trimmed.match(/E(-?\d+(?:\.\d+)?)/i);
      if (eMatch) {
        const currentE = parseFloat(eMatch[1]);
        if (currentE < lastE - 0.1) { // 0.1mm 이상 감소하면 리트렉션으로 간주
          retractionCount++;
        }
        lastE = currentE;
      }
    }

    // G10/G11 펌웨어 리트렉션 감지
    if (trimmed.startsWith('G10') && !trimmed.includes('P') && !trimmed.includes('S')) {
      retractionCount++;
    }
  }

  // 평균 속도 계산
  const avgSpeed = (arr: number[]): number => {
    if (arr.length === 0) return 0;
    return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  };

  return {
    speedDistribution: {
      travel: avgSpeed(speeds.travel),
      infill: avgSpeed(speeds.infill),
      perimeter: avgSpeed(speeds.perimeter),
      support: speeds.support.length > 0 ? avgSpeed(speeds.support) : undefined,
    },
    retractionCount,
  };
}

interface GCodeEmbedProps {
  url: string;
  filename: string;
  className?: string;
  /** G-code 임베드 고유 ID (gcode_segment_data 테이블 조회용) */
  gcodeEmbedId?: string;
  /** 다운로드 허용 여부 */
  downloadable?: boolean;
}

export function GCodeEmbed({ url, filename, className, gcodeEmbedId, downloadable = true }: GCodeEmbedProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [gcodeContent, setGcodeContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ReportPanelTab>('viewer');
  const [segments, setSegments] = useState<{
    layers: LayerSegmentData[];
    metadata?: SegmentMetadata;
    temperatures?: TemperatureData[];
  } | null>(null);

  // URL에서 G-code 로드 및 세그먼트 조회/생성
  useEffect(() => {
    if (!url) return;

    const loadGCode = async () => {
      setIsLoading(true);
      try {
        // 1. G-code 콘텐츠 로드
        const response = await fetch(url);
        const text = await response.text();
        setGcodeContent(text);

        // 2. gcodeEmbedId가 있으면 DB에서 세그먼트 조회
        if (gcodeEmbedId) {
          console.log('[GCodeEmbed] Loading segments from DB for:', gcodeEmbedId);
          const { data: dbSegments, error } = await loadFullSegmentByEmbedId(gcodeEmbedId);

          if (!error && dbSegments) {
            setSegments({
              layers: dbSegments.layers,
              metadata: dbSegments.metadata,
              temperatures: dbSegments.temperatures,
            });
            console.log('[GCodeEmbed] Loaded from DB, layer count:', dbSegments.layers.length);
            return;  // DB에서 로드 성공하면 종료
          } else {
            console.warn('[GCodeEmbed] Failed to load from DB, will try API:', error?.message);
          }
        }

        // 3. DB에서 로드 실패하거나 gcodeEmbedId가 없으면 API로 생성
        if (text) {
          console.log('[GCodeEmbed] No DB data, calling API...');
          try {
            const segmentResponse = await createCommunitySegments({
              gcode_content: text,
              filename: filename,
            });
            if (segmentResponse.success && segmentResponse.segments) {
              setSegments({
                layers: segmentResponse.segments.layers,
                metadata: segmentResponse.segments.metadata as SegmentMetadata,
                temperatures: segmentResponse.segments.temperatures,
              });
              console.log('[GCodeEmbed] Segments loaded from API, layer count:', segmentResponse.layer_count);
            }
          } catch (err) {
            console.warn('[GCodeEmbed] Failed to load segments from API:', err);
          }
        }
      } catch (err) {
        console.error('[GCodeEmbed] Failed to load gcode:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadGCode();
  }, [url, filename, gcodeEmbedId]);

  // 다운로드 핸들러
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [url, filename]);

  // G-code에서 속도 및 리트렉션 정보 추출
  const gcodeStats = useMemo(() => {
    if (!gcodeContent) {
      return {
        speedDistribution: { travel: 0, infill: 0, perimeter: 0 },
        retractionCount: 0,
      };
    }
    return extractGCodeStats(gcodeContent);
  }, [gcodeContent]);

  // 메트릭 데이터 생성 (세그먼트 메타데이터에서 추출)
  const metrics = segments?.metadata ? {
    printTime: {
      // estimatedTime이 이미 포맷된 문자열이면 사용, 아니면 printTime(초)에서 변환
      value: segments.metadata.estimatedTime && isNaN(Number(segments.metadata.estimatedTime))
        ? segments.metadata.estimatedTime
        : formatPrintTime(segments.metadata.printTime),
      seconds: segments.metadata.printTime,
    },
    filamentUsage: {
      length: segments.metadata.totalFilament
        ? `${(segments.metadata.totalFilament / 1000).toFixed(2)}m`
        : '-',
    },
    layerCount: {
      value: segments.metadata.layerCount || 0,
      layerHeight: segments.metadata.layerHeight,
    },
    retractionCount: { value: gcodeStats.retractionCount },
  } : {
    printTime: { value: '-' },
    filamentUsage: { length: '-' },
    layerCount: { value: 0 },
    retractionCount: { value: 0 },
  };

  // 온도 데이터 추출
  const temperature = segments?.temperatures && segments.temperatures.length > 0
    ? {
        nozzle: segments.temperatures[0].nozzleTemp || 0,
        bed: segments.temperatures[0].bedTemp || 0,
      }
    : { nozzle: 0, bed: 0 };

  // 분석 데이터 생성
  const analysisData: GCodeAnalysisData = {
    fileName: filename,
    gcodeContent: gcodeContent,
    storagePath: url,
    metrics,
    support: { percentage: 0 },
    speedDistribution: gcodeStats.speedDistribution,
    temperature,
    analysis: {
      warnings: [],
      cautions: [],
      suggestions: [],
      goodPoints: [],
    },
  };

  return (
    <>
      <Card className={cn("overflow-hidden my-2", className)}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
          <div className="flex items-center gap-2 text-sm">
            <FileCode className="w-4 h-4 text-orange-500" />
            <span className="font-medium truncate max-w-[200px]">{filename}</span>
            <span className="text-xs text-muted-foreground uppercase">(GCODE)</span>
            {segments && (
              <span className="text-xs text-green-600 dark:text-green-400">
                {segments.metadata?.layerCount || segments.layers.length} layers
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {downloadable ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDownload}
                className="h-7 px-2"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {t('common.download', '다운로드')}
              </Button>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground px-2 py-1">
                <Lock className="w-3 h-3" />
                {t('community.downloadNotAllowed')}
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(true)}
              className="h-7 px-2"
            >
              <Maximize2 className="w-3.5 h-3.5 mr-1" />
              {t('common.expand', '확대')}
            </Button>
          </div>
        </div>

        {/* GCode 뷰어 영역 - GCodeAnalysisReport embedded 모드 */}
        <div className="relative h-[520px] flex flex-col">
          {isLoading ? (
            <div className="flex items-center justify-center h-full bg-muted">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <GCodeAnalysisReport
              data={analysisData}
              embedded={true}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              hiddenTabs={['editor']}
              showShareButton={false}
              initialSegments={segments || undefined}
              hideTemperatureChart={true}
            />
          )}
        </div>
      </Card>

      {/* 전체화면 뷰어 모달 - GCodeViewerReportModal 사용 */}
      <GCodeViewerReportModal
        isOpen={isExpanded}
        onClose={() => setIsExpanded(false)}
        gcodeUrl={url}
        gcodeContent={gcodeContent}
        fileName={filename}
        initialTab={activeTab}
      />
    </>
  );
}

export default GCodeEmbed;
