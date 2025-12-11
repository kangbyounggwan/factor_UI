/**
 * G-code Viewer Canvas Component
 * 옥토프린트 스타일의 Canvas 2D 뷰어 + Three.js 3D 뷰어
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
  Box,
  Grid3X3,
  Thermometer,
  TrendingUp,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { GCodeReader, GCodeRenderer, type GCodeModel, type ParseProgress } from '@/lib/gcode';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import * as THREE from 'three';

// 레이어별 온도 데이터 타입
interface LayerTemperature {
  layer: number;
  nozzleTemp: number | null;  // 노즐 온도 (M104/M109)
  bedTemp: number | null;     // 베드 온도 (M140/M190)
}

// G-code에서 레이어별 온도 명령어 파싱
function parseTemperatureByLayer(gcode: string): LayerTemperature[] {
  const lines = gcode.split('\n');
  const temperatures: LayerTemperature[] = [];

  let currentLayer = 0;
  let currentNozzleTemp: number | null = null;
  let currentBedTemp: number | null = null;
  let lastRecordedLayer = -1;

  for (const line of lines) {
    const trimmed = line.trim();

    // 레이어 변경 감지
    if (trimmed.startsWith(';LAYER:') || trimmed.includes(';LAYER_CHANGE')) {
      // 레이어가 변경되기 전에 현재 온도 저장
      if (currentLayer !== lastRecordedLayer && (currentNozzleTemp !== null || currentBedTemp !== null)) {
        temperatures.push({
          layer: currentLayer,
          nozzleTemp: currentNozzleTemp,
          bedTemp: currentBedTemp,
        });
        lastRecordedLayer = currentLayer;
      }

      // 레이어 번호 추출
      const layerMatch = trimmed.match(/;LAYER:?\s*(\d+)/);
      if (layerMatch) {
        currentLayer = parseInt(layerMatch[1]);
      } else {
        currentLayer++;
      }
    }

    // 노즐 온도 명령어 (M104: 설정, M109: 설정 후 대기)
    const nozzleTempMatch = trimmed.match(/^M10[49]\s+S([\d.]+)/);
    if (nozzleTempMatch) {
      currentNozzleTemp = parseFloat(nozzleTempMatch[1]);
    }

    // 베드 온도 명령어 (M140: 설정, M190: 설정 후 대기)
    const bedTempMatch = trimmed.match(/^M1[49]0\s+S([\d.]+)/);
    if (bedTempMatch) {
      currentBedTemp = parseFloat(bedTempMatch[1]);
    }
  }

  // 마지막 레이어 추가
  if (currentLayer !== lastRecordedLayer && (currentNozzleTemp !== null || currentBedTemp !== null)) {
    temperatures.push({
      layer: currentLayer,
      nozzleTemp: currentNozzleTemp,
      bedTemp: currentBedTemp,
    });
  }

  return temperatures;
}

// 특정 레이어의 온도 찾기
function getTemperatureForLayer(temperatures: LayerTemperature[], layer: number): { nozzle: number | null; bed: number | null } {
  // 해당 레이어 이하에서 가장 가까운 온도 데이터 찾기
  let nozzle: number | null = null;
  let bed: number | null = null;

  for (const temp of temperatures) {
    if (temp.layer <= layer) {
      if (temp.nozzleTemp !== null) nozzle = temp.nozzleTemp;
      if (temp.bedTemp !== null) bed = temp.bedTemp;
    } else {
      break;
    }
  }

  return { nozzle, bed };
}

// 3D G-code 경로 시각화 컴포넌트
// Three.js 좌표계: X(가로), Y(높이), Z(깊이) - G-code의 Z를 Three.js Y로, G-code의 Y를 Three.js Z로 변환
// 색상: 모델/서포트 구분 - 다크모드(노란색/청록색), 라이트모드(진한 파란색/진한 주황색)
function GCodePath3D({ gcode, maxLayer, isDarkMode = true }: { gcode: string; maxLayer?: number; isDarkMode?: boolean }) {
  const { modelGeometry, supportGeometry } = useMemo(() => {
    const lines = gcode.split('\n');
    const modelPoints: THREE.Vector3[] = [];
    const supportPoints: THREE.Vector3[] = [];
    let currentX = 0, currentY = 0, currentZ = 0; // G-code 좌표계
    let currentLayer = 0;
    let isSupport = false; // 현재 서포트 출력 중인지

    for (const line of lines) {
      const trimmed = line.trim();

      // 레이어 변경 감지
      if (trimmed.startsWith(';LAYER:') || trimmed.includes(';LAYER_CHANGE')) {
        currentLayer++;
        if (maxLayer !== undefined && currentLayer > maxLayer) break;
      }

      // 압출 타입 감지 (Cura, PrusaSlicer 등 슬라이서별 주석)
      if (trimmed.startsWith(';TYPE:')) {
        const typeStr = trimmed.substring(6).toUpperCase();
        isSupport = typeStr.includes('SUPPORT');
      }
      // MESH 태그도 감지 (일부 슬라이서)
      if (trimmed.startsWith(';MESH:')) {
        const meshStr = trimmed.substring(6).toUpperCase();
        if (meshStr.includes('SUPPORT')) {
          isSupport = true;
        } else if (meshStr !== 'NONMESH') {
          isSupport = false;
        }
      }

      if (trimmed.startsWith('G1') || trimmed.startsWith('G0')) {
        const xMatch = trimmed.match(/X([-\d.]+)/);
        const yMatch = trimmed.match(/Y([-\d.]+)/);
        const zMatch = trimmed.match(/Z([-\d.]+)/);
        const eMatch = trimmed.match(/E([-\d.]+)/);

        const prevX = currentX, prevY = currentY, prevZ = currentZ;

        if (xMatch) currentX = parseFloat(xMatch[1]);
        if (yMatch) currentY = parseFloat(yMatch[1]);
        if (zMatch) currentZ = parseFloat(zMatch[1]);

        // E값이 양수면 압출 중
        const isExtrusion = eMatch ? parseFloat(eMatch[1]) > 0 : false;

        // 압출 중인 경로만 표시 (이동 경로는 건너뛰기)
        if (isExtrusion || trimmed.startsWith('G1')) {
          // G-code -> Three.js 좌표 변환: (X, Y, Z) -> (X, Z, Y)
          const startPoint = new THREE.Vector3(prevX, prevZ, prevY);
          const endPoint = new THREE.Vector3(currentX, currentZ, currentY);

          if (isSupport) {
            supportPoints.push(startPoint, endPoint);
          } else {
            modelPoints.push(startPoint, endPoint);
          }
        }
      }
    }

    return {
      modelGeometry: new THREE.BufferGeometry().setFromPoints(modelPoints),
      supportGeometry: new THREE.BufferGeometry().setFromPoints(supportPoints),
    };
  }, [gcode, maxLayer]);

  // 색상 - 다크모드: 노란색/청록색, 라이트모드: 진한 파란색/진한 주황색
  const modelColor = isDarkMode ? 0xffcc00 : 0x2563eb;
  const supportColor = isDarkMode ? 0x00cccc : 0xea580c;

  return (
    <>
      {/* 모델 경로 */}
      <lineSegments geometry={modelGeometry}>
        <lineBasicMaterial color={modelColor} linewidth={1} />
      </lineSegments>
      {/* 서포트 경로 */}
      <lineSegments geometry={supportGeometry}>
        <lineBasicMaterial color={supportColor} linewidth={1} />
      </lineSegments>
    </>
  );
}

// 베드 플레이트 컴포넌트 - XZ 평면 (Three.js에서 바닥면)
function BedPlate({ size, isDarkMode = true }: { size: { x: number; y: number }; isDarkMode?: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[size.x / 2, 0, size.y / 2]} receiveShadow>
      <planeGeometry args={[size.x, size.y]} />
      <meshStandardMaterial color={isDarkMode ? "#2a2a2a" : "#e8e8e8"} transparent opacity={0.8} />
    </mesh>
  );
}

interface GCodeViewerCanvasProps {
  gcodeContent?: string;
  gcodeUrl?: string;
  bedSize?: { x: number; y: number };
  printProgressRef?: React.MutableRefObject<number>; // ref로 전달하여 리렌더링 방지
  onLayerChange?: (layer: number) => void;
  className?: string;
}

// 온도 라인 차트용 데이터 포맷
interface TemperatureChartData {
  layer: number;
  nozzle: number | null;
  bed: number | null;
}

// 온도 데이터를 차트용으로 변환
function prepareChartData(temperatures: LayerTemperature[], maxLayer: number): TemperatureChartData[] {
  const chartData: TemperatureChartData[] = [];
  let lastNozzle: number | null = null;
  let lastBed: number | null = null;

  for (let layer = 0; layer <= maxLayer; layer++) {
    // 해당 레이어의 온도 데이터 찾기
    const tempEntry = temperatures.find(t => t.layer === layer);
    if (tempEntry) {
      if (tempEntry.nozzleTemp !== null) lastNozzle = tempEntry.nozzleTemp;
      if (tempEntry.bedTemp !== null) lastBed = tempEntry.bedTemp;
    }

    chartData.push({
      layer,
      nozzle: lastNozzle,
      bed: lastBed,
    });
  }

  // 데이터가 너무 많으면 샘플링 (최대 100개 포인트)
  if (chartData.length > 100) {
    const step = Math.ceil(chartData.length / 100);
    return chartData.filter((_, index) => index % step === 0 || index === chartData.length - 1);
  }

  return chartData;
}

export const GCodeViewerCanvas = ({
  gcodeContent,
  gcodeUrl,
  bedSize = { x: 200, y: 200 },
  printProgressRef,
  onLayerChange,
  className = '',
}: GCodeViewerCanvasProps) => {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readerRef = useRef<GCodeReader | null>(null);
  const rendererRef = useRef<GCodeRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null); // 2D canvas 컨테이너

  const [model, setModel] = useState<GCodeModel | null>(null);
  const [currentLayer, setCurrentLayer] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState<ParseProgress>({
    percentage: 0,
    type: 'parsing',
  });
  // 레이어별 온도 데이터
  const [temperatureData, setTemperatureData] = useState<LayerTemperature[]>([]);
  // 온도 차트 표시 여부
  const [showTemperatureChart, setShowTemperatureChart] = useState(false);

  const [options, setOptions] = useState({
    showMoves: true,
    showRetracts: true,
    showBoundingBox: false,
    showPreviousLayer: false,
    showCurrentLayer: false,
    showNextLayer: false,
  });

  // 2D/3D 뷰 모드: '2d', '3d', 'split' (분할 화면)
  const [viewMode, setViewMode] = useState<'2d' | '3d' | 'split'>('2d');
  // 3D 뷰용 원본 G-code 저장
  const [rawGcode, setRawGcode] = useState<string>('');

  const { toast } = useToast();
  // toast를 ref로 저장하여 useCallback 의존성에서 제외
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Reader & Renderer 초기화
  useEffect(() => {
    if (!canvasRef.current) return;

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

    return () => {
      // cleanup
    };
  }, [bedSize]);

  // canvas 컨테이너 크기 변경 감지 (split 모드 대응)
  useEffect(() => {
    const canvasContainer = canvasContainerRef.current;
    if (!canvasContainer || !rendererRef.current) return;

    const handleResize = () => {
      // 2D 모드나 split 모드일 때만 리사이즈
      if (viewMode === '2d' || viewMode === 'split') {
        rendererRef.current?.resize();
      }
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(canvasContainer);

    // 초기 리사이즈
    requestAnimationFrame(handleResize);

    return () => {
      resizeObserver.disconnect();
    };
  }, [viewMode]);

  // viewMode 변경 시 2D 렌더러 다시 렌더링 (3D → 2D 전환 시 필요)
  useEffect(() => {
    if ((viewMode === '2d' || viewMode === 'split') && rendererRef.current && model) {
      // 약간의 지연 후 리사이즈 및 렌더링 (DOM 업데이트 대기)
      const timer = setTimeout(() => {
        rendererRef.current?.resize();
        rendererRef.current?.render();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [viewMode, model]);

  // model 또는 renderer가 변경되면 동기화 (renderer 재생성 시 model 복원)
  useEffect(() => {
    if (rendererRef.current && model) {
      // 렌더러에 이미 같은 model이 설정되어 있으면 스킵
      const currentRendererModel = (rendererRef.current as any).model;
      if (currentRendererModel === model) {
        return;
      }
      rendererRef.current.setModel(model);
      // resize 후 render (canvas 크기가 올바르게 설정되어야 함)
      requestAnimationFrame(() => {
        rendererRef.current?.resize();
        rendererRef.current?.render();
      });
    }
  }, [model]);

  // G-code 파싱
  const parseGCode = useCallback(async (content: string) => {
    if (!readerRef.current || !rendererRef.current) return;

    // 3D 뷰용 원본 저장
    setRawGcode(content);

    setParsing(true);
    setParseProgress({ percentage: 0, type: 'parsing' });

    try {
      const parsedModel = await readerRef.current.parseGCode(content, (progress) => {
        setParseProgress(progress);
      });

      setModel(parsedModel);
      rendererRef.current.setModel(parsedModel);
      rendererRef.current.render();

      // 온도 데이터 파싱
      const temps = parseTemperatureByLayer(content);
      setTemperatureData(temps);
      console.log('[GCodeViewerCanvas] Temperature data parsed:', temps.length, 'entries');

      toastRef.current({
        title: t('gcode.parseComplete', 'G-code parsing complete'),
        description: `${parsedModel.modelInfo.layerCount} layers, ${parsedModel.modelInfo.totalFilament.toFixed(2)}mm filament`,
      });
    } catch (error) {
      console.error('[GCodeViewerCanvas] 파싱 에러:', error);
      toastRef.current({
        title: t('gcode.parseFailed'),
        description: error instanceof Error ? error.message : t('errors.general'),
        variant: 'destructive',
      });
    } finally {
      setParsing(false);
    }
  }, [t]);

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
          toastRef.current({
            title: t('gcode.loadFailed'),
            description: t('errors.loadFailed'),
            variant: 'destructive',
          });
        });
    }
  }, [gcodeContent, gcodeUrl, parseGCode, t]);

  // 프린트 진행률 동기화 - requestAnimationFrame으로 폴링하여 React 리렌더링 우회
  // 3D 뷰에서도 진행률에 따라 레이어를 자동 업데이트
  useEffect(() => {
    if (!printProgressRef) return;

    let animationFrameId: number;
    let lastProgress = -1;

    const syncProgress = () => {
      const currentProgress = printProgressRef.current;
      // 진행률이 변경되었을 때만 업데이트
      if (currentProgress !== lastProgress) {
        lastProgress = currentProgress;

        // 2D 렌더러 업데이트
        if (rendererRef.current) {
          rendererRef.current.setProgress(currentProgress);
        }

        // 3D 뷰용 레이어 계산 및 업데이트
        // 진행률(0-100)을 레이어 수로 변환
        const totalLayers = model?.layers.length || 0;
        if (model && totalLayers > 0 && currentProgress > 0) {
          const progressLayer = Math.floor((currentProgress / 100) * totalLayers);
          const clampedLayer = Math.max(0, Math.min(progressLayer, totalLayers - 1));
          // 레이어가 변경된 경우에만 상태 업데이트 (불필요한 리렌더링 방지)
          setCurrentLayer(prev => prev !== clampedLayer ? clampedLayer : prev);
        }
      }
      animationFrameId = requestAnimationFrame(syncProgress);
    };

    animationFrameId = requestAnimationFrame(syncProgress);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [printProgressRef, model]);

  // 옵션 변경 + 다크모드 대응
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateOptions({
        showMoves: options.showMoves,
        showRetracts: options.showRetracts,
        showBoundingBox: options.showBoundingBox,
        showPreviousLayer: options.showPreviousLayer,
        showCurrentLayer: options.showCurrentLayer,
        showNextLayer: options.showNextLayer,
        isDarkMode,
      });
    }
  }, [options, isDarkMode]);

  // 레이어 변경
  const handleLayerChange = useCallback(
    (layer: number) => {
      const totalLayers = model?.layers.length || 0;

      if (!model || totalLayers === 0) {
        return;
      }

      const newLayer = Math.max(0, Math.min(layer, totalLayers - 1));
      setCurrentLayer(newLayer);

      // 2D 렌더러 업데이트
      if (rendererRef.current) {
        rendererRef.current.setLayer(newLayer);
      }

      if (onLayerChange) {
        onLayerChange(newLayer);
      }
    },
    [onLayerChange, currentLayer, model]
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

  // 마우스 휠 핸들러 (줌) - 패시브 이벤트 리스너 문제 해결을 위해 useEffect로 직접 바인딩
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      if (!rendererRef.current) return;

      e.preventDefault();

      if (e.deltaY < 0) {
        rendererRef.current.zoomIn();
      } else {
        rendererRef.current.zoomOut();
      }
    };

    // passive: false로 설정하여 preventDefault 호출 가능하게 함
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, []);

  const layerCount = model?.layers.length || 0;
  const modelInfo = model?.modelInfo;

  // 현재 레이어의 온도 계산
  const currentTemperature = useMemo(() => {
    if (temperatureData.length === 0) {
      return { nozzle: null, bed: null };
    }
    return getTemperatureForLayer(temperatureData, currentLayer);
  }, [temperatureData, currentLayer]);

  // 온도 차트용 데이터
  const chartData = useMemo(() => {
    if (temperatureData.length === 0 || !model) {
      return [];
    }
    return prepareChartData(temperatureData, model.layers.length - 1);
  }, [temperatureData, model]);

  return (
    <Card className={className}>
      <CardContent className="p-0 h-full flex flex-col relative">
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

        {/* 뷰어 영역 */}
        <div
          ref={containerRef}
          className="relative bg-black flex-1 overflow-hidden flex pb-14"
        >
          {/* 2D 캔버스 뷰 - CSS로 표시/숨김 (마운트 유지) */}
          <div
            ref={canvasContainerRef}
            className={`relative ${
              viewMode === '2d' ? 'w-full h-full' :
              viewMode === 'split' ? 'w-1/2 h-full border-r border-gray-700' :
              'hidden'
            }`}
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full cursor-move"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />
          </div>

          {/* 3D Three.js 뷰 - CSS로 표시/숨김 (Context Lost 방지) */}
          <div className={`${
            viewMode === '3d' ? 'w-full h-full' :
            viewMode === 'split' ? 'w-1/2 h-full' :
            'hidden'
          }`}>
            <Canvas
              shadows
              frameloop={viewMode === '2d' ? 'demand' : 'always'}
              camera={{
                position: [bedSize.x + 100, 150, bedSize.y + 100],
                fov: 50,
                near: 0.1,
                far: 2000
              }}
              className="w-full h-full"
              gl={{
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance',
              }}
              onCreated={({ gl }) => {
                gl.domElement.addEventListener('webglcontextlost', (e) => {
                  e.preventDefault();
                  console.warn('[GCodeViewerCanvas] WebGL context lost, will restore');
                });
              }}
            >
              <color attach="background" args={[isDarkMode ? '#1a1a1a' : '#f5f5f5']} />
              <ambientLight intensity={isDarkMode ? 0.6 : 0.8} />
              <directionalLight position={[100, 150, 100]} intensity={isDarkMode ? 1.2 : 1.0} castShadow />
              <pointLight position={[bedSize.x / 2, 100, bedSize.y / 2]} intensity={0.5} />

              {/* 베드 플레이트 - XZ 평면 (Y=0) */}
              <BedPlate size={bedSize} isDarkMode={isDarkMode} />

              {/* G-code 경로 - rawGcode가 있을 때만 표시 */}
              {rawGcode && <GCodePath3D gcode={rawGcode} maxLayer={currentLayer + 1} isDarkMode={isDarkMode} />}

              {/* 그리드 - XZ 평면 (drei Grid는 기본적으로 XZ 평면) */}
              <gridHelper
                args={[Math.max(bedSize.x, bedSize.y), Math.max(bedSize.x, bedSize.y) / 10, isDarkMode ? '#444444' : '#cccccc', isDarkMode ? '#333333' : '#dddddd']}
                position={[bedSize.x / 2, 0, bedSize.y / 2]}
              />

              {/* 카메라 컨트롤 */}
              <OrbitControls
                enableDamping
                dampingFactor={0.05}
                target={[bedSize.x / 2, 30, bedSize.y / 2]}
                minDistance={50}
                maxDistance={500}
              />
            </Canvas>
          </div>

          {/* 2D/3D/Split 토글 버튼 - 항상 표시 */}
          <div className="absolute top-4 left-4 flex gap-1 bg-background/80 backdrop-blur rounded-lg p-1 z-10">
            <Button
              variant={viewMode === '2d' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('2d')}
              className="h-8 px-3"
            >
              <Grid3X3 className="h-4 w-4 mr-1" />
              2D
            </Button>
            <Button
              variant={viewMode === '3d' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('3d')}
              className="h-8 px-3"
            >
              <Box className="h-4 w-4 mr-1" />
              3D
            </Button>
            <Button
              variant={viewMode === 'split' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('split')}
              className="h-8 px-3"
            >
              <Layers className="h-4 w-4 mr-1" />
              Split
            </Button>
          </div>

          {/* 2D 컨트롤 버튼 (2D 또는 Split 모드에서 표시) */}
          {model && (viewMode === '2d' || viewMode === 'split') && (
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
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

          {/* 하단 컨트롤 바 - 뷰어 영역 내부 */}
          {model && layerCount > 0 && (
            <div className="absolute bottom-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t p-3" style={{ pointerEvents: 'auto' }}>
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

                {/* 온도 표시 및 차트 토글 */}
                {(currentTemperature.nozzle !== null || currentTemperature.bed !== null) && (
                  <div className="flex items-center gap-3 ml-2 pl-3 border-l border-border">
                    <Thermometer className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    {currentTemperature.nozzle !== null && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-red-500" title="노즐" />
                        <span className="text-xs font-medium">{currentTemperature.nozzle}°C</span>
                      </div>
                    )}
                    {currentTemperature.bed !== null && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-orange-500" title="베드" />
                        <span className="text-xs font-medium">{currentTemperature.bed}°C</span>
                      </div>
                    )}
                    {/* 차트 토글 버튼 */}
                    {chartData.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 ml-1"
                        onClick={() => setShowTemperatureChart(!showTemperatureChart)}
                        title={showTemperatureChart ? '차트 숨기기' : '차트 보기'}
                      >
                        <TrendingUp className="h-3.5 w-3.5 mr-1" />
                        {showTemperatureChart ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 온도 라인 차트 섹션 */}
        {showTemperatureChart && chartData.length > 0 && (
          <div className="border-t bg-background/95 backdrop-blur p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">레이어별 온도 변화</span>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1">
                  <div className="w-3 h-[2px] bg-red-500 rounded" />
                  <span className="text-muted-foreground">노즐</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-[2px] bg-orange-500 rounded" />
                  <span className="text-muted-foreground">베드</span>
                </div>
              </div>
            </div>
            <div className="h-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDarkMode ? '#374151' : '#e5e7eb'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="layer"
                    tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                    axisLine={{ stroke: isDarkMode ? '#4b5563' : '#d1d5db' }}
                    tickLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={(value) => `${value}`}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: isDarkMode ? '#9ca3af' : '#6b7280' }}
                    axisLine={{ stroke: isDarkMode ? '#4b5563' : '#d1d5db' }}
                    tickLine={false}
                    width={35}
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => `${value}°`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: isDarkMode ? '#1f2937' : '#ffffff',
                      border: `1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}`,
                      borderRadius: '6px',
                      fontSize: '12px',
                    }}
                    labelStyle={{ color: isDarkMode ? '#f3f4f6' : '#111827' }}
                    formatter={(value: number, name: string) => [
                      `${value}°C`,
                      name === 'nozzle' ? '노즐' : '베드'
                    ]}
                    labelFormatter={(label) => `레이어 ${label}`}
                  />
                  {/* 현재 레이어 위치 표시 */}
                  <ReferenceLine
                    x={currentLayer}
                    stroke={isDarkMode ? '#60a5fa' : '#3b82f6'}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="stepAfter"
                    dataKey="nozzle"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#ef4444' }}
                    connectNulls
                  />
                  <Line
                    type="stepAfter"
                    dataKey="bed"
                    stroke="#f97316"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: '#f97316' }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
