/**
 * G-code Viewer Canvas Component
 * 옥토프린트 스타일의 Canvas 2D 뷰어
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { GCodeReader, GCodeRenderer, type GCodeModel, type ParseProgress } from '@/lib/gcode';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface GCodeViewerCanvasProps {
  gcodeContent?: string;
  gcodeUrl?: string;
  bedSize?: { x: number; y: number };
  printProgress?: number; // 0-100
  onLayerChange?: (layer: number) => void;
  className?: string;
}

export const GCodeViewerCanvas = ({
  gcodeContent,
  gcodeUrl,
  bedSize = { x: 200, y: 200 },
  printProgress,
  onLayerChange,
  className = '',
}: GCodeViewerCanvasProps) => {
  const { t } = useTranslation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<GCodeReader | null>(null);
  const rendererRef = useRef<GCodeRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [model, setModel] = useState<GCodeModel | null>(null);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<ParseProgress>({
    percentage: 0,
    type: 'parsing',
  });

  const [options, setOptions] = useState({
    showMoves: true,
    showRetracts: true,
    showBoundingBox: false,
    showPreviousLayer: false,
    showCurrentLayer: false,
    showNextLayer: false,
  });

  const { toast } = useToast();

  // Reader & Renderer 초기화
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const reader = new GCodeReader({
      bed: bedSize,
      purgeEmptyLayers: true,
    });

    const renderer = new GCodeRenderer();
    renderer.initialize(canvasRef.current, reader);
    renderer.updateOptions({
      bed: bedSize,
      showMoves: options.showMoves,
      showRetracts: options.showRetracts,
      showBoundingBox: options.showBoundingBox,
    });

    readerRef.current = reader;
    rendererRef.current = renderer;

    // 초기 리사이즈 (마운트 직후 크기 설정)
    requestAnimationFrame(() => {
      renderer.resize();
    });

    // 리사이즈 핸들러
    const handleResize = () => {
      renderer.resize();
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [bedSize]);

  // G-code 파싱
  const parseGCode = useCallback(async (content: string) => {
    if (!readerRef.current || !rendererRef.current) return;

    setParsing(true);
    setParseProgress({ percentage: 0, type: 'parsing' });

    try {
      const parsedModel = await readerRef.current.parseGCode(content, (progress) => {
        setParseProgress(progress);
      });

      setModel(parsedModel);
      rendererRef.current.setModel(parsedModel);
      rendererRef.current.render();

      toast({
        title: t('gcode.parseComplete', 'G-code parsing complete'),
        description: `${parsedModel.modelInfo.layerCount} layers, ${parsedModel.modelInfo.totalFilament.toFixed(2)}mm filament`,
      });
    } catch (error) {
      console.error('[GCodeViewerCanvas] 파싱 에러:', error);
      toast({
        title: t('gcode.parseFailed'),
        description: error instanceof Error ? error.message : t('errors.general'),
        variant: 'destructive',
      });
    } finally {
      setParsing(false);
    }
  }, [toast, t]);

  // G-code 로드
  useEffect(() => {
    if (gcodeContent) {
      parseGCode(gcodeContent);
    } else if (gcodeUrl) {
      fetch(gcodeUrl)
        .then((res) => res.text())
        .then((content) => parseGCode(content))
        .catch((error) => {
          console.error('[GCodeViewerCanvas] 로드 에러:', error);
          toast({
            title: t('gcode.loadFailed'),
            description: t('errors.loadFailed'),
            variant: 'destructive',
          });
        });
    }
  }, [gcodeContent, gcodeUrl, parseGCode, toast, t]);

  // 프린트 진행률 동기화
  useEffect(() => {
    if (printProgress !== undefined && rendererRef.current) {
      rendererRef.current.setProgress(printProgress);
    }
  }, [printProgress]);

  // 옵션 변경
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateOptions({
        showMoves: options.showMoves,
        showRetracts: options.showRetracts,
        showBoundingBox: options.showBoundingBox,
        showPreviousLayer: options.showPreviousLayer,
        showCurrentLayer: options.showCurrentLayer,
        showNextLayer: options.showNextLayer,
      });
    }
  }, [options]);

  // 레이어 변경
  const handleLayerChange = useCallback(
    (layer: number) => {
      if (!rendererRef.current) return;

      const layerCount = rendererRef.current.getLayerCount();
      const newLayer = Math.max(0, Math.min(layer, layerCount - 1));

      setCurrentLayer(newLayer);
      rendererRef.current.setLayer(newLayer);

      if (onLayerChange) {
        onLayerChange(newLayer);
      }
    },
    [onLayerChange]
  );

  // 마우스 드래그 핸들러
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !rendererRef.current) return;

    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;

    rendererRef.current.pan(dx, dy);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 마우스 휠 핸들러 (줌)
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!rendererRef.current) return;

    e.preventDefault();

    if (e.deltaY < 0) {
      rendererRef.current.zoomIn();
    } else {
      rendererRef.current.zoomOut();
    }
  };

  const layerCount = model?.layers.length || 0;
  const modelInfo = model?.modelInfo;

  return (
    <Card className={className}>
      <CardContent className="p-0 h-full flex flex-col">
        {/* 파싱 프로그레스 */}
        {parsing && (
          <div className="absolute top-4 left-4 right-4 z-20 space-y-2 bg-background/95 backdrop-blur p-3 rounded-lg border">
            <div className="flex items-center justify-between text-sm">
              <span>{parseProgress.type === 'parsing' ? t('gcode.parsing') : t('gcode.analyzing')}</span>
              <span>{parseProgress.percentage.toFixed(0)}%</span>
            </div>
            <Progress value={parseProgress.percentage} />
          </div>
        )}

        {/* 캔버스 */}
        <div
          ref={containerRef}
          className="relative bg-black flex-1 overflow-hidden"
        >
          <canvas
            ref={canvasRef}
            className="w-full h-full cursor-move"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />

          {/* 컨트롤 버튼 */}
          {model && (
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                size="icon"
                onClick={() => rendererRef.current?.zoomIn()}
                title={t('gcode.zoomIn')}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => rendererRef.current?.zoomOut()}
                title={t('gcode.zoomOut')}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                onClick={() => rendererRef.current?.resetViewport()}
                title={t('gcode.resetViewport')}
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* 하단 컨트롤 바 */}
        {model && layerCount > 0 && (
          <div className="absolute bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-3">
            <div className="flex items-center gap-3">
              {/* 레이어 컨트롤 */}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handleLayerChange(currentLayer - 1)}
                disabled={currentLayer === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex-1 flex items-center gap-2">
                <Slider
                  value={[currentLayer]}
                  onValueChange={(value) => handleLayerChange(value[0])}
                  max={layerCount - 1}
                  step={1}
                  className="flex-1"
                />
                <div className="text-xs font-medium whitespace-nowrap">
                  {currentLayer + 1}/{layerCount}
                </div>
              </div>

              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
                onClick={() => handleLayerChange(currentLayer + 1)}
                disabled={currentLayer >= layerCount - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
