/**
 * 출력 설정 다이얼로그용 개선된 G-code 프리뷰 컴포넌트
 * - 레이어별 슬라이더
 * - 이동/출력 경로 색상 구분
 * - 자동 카메라 조정
 */

import { useState, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { Box3, Vector3, PerspectiveCamera } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Slider } from "@/components/ui/slider";
import * as pako from "pako";
import { useTranslation } from "react-i18next";
import { useTheme } from "next-themes";

interface GCodePreviewProps {
  gcodeUrl?: string;
  gcodeContent?: string;
  className?: string;
}


interface GCodeLayer {
  z: number;
  moves: number[][]; // [x, y, z][] - Travel 경로
  extrusions: number[][][]; // [ [[x,y,z], [x,y,z], ...], ... ] - 일반 출력 폴리라인 배열
  supportExtrusions: number[][][]; // [ [[x,y,z], [x,y,z], ...], ... ] - 서포트 압출 폴리라인 배열
}

// G-code를 레이어별로 파싱 ("펜 업/다운" 방식으로 폴리라인 끊기)
function parseGCode(gcode: string): { layers: GCodeLayer[], firstExtrusionPoint: Vector3 | null } {
  const lines = gcode.split("\n");
  const layers: Map<number, GCodeLayer> = new Map();

  let currentX = 0, currentY = 0, currentZ = 0, currentE = 0;
  let absoluteE = true; // M82: 절대 E 모드 (기본값) / M83: 상대 E 모드
  let absoluteXYZ = true; // G90: 절대 좌표 (기본값) / G91: 상대 좌표
  let hasMovedFromOrigin = false;
  let penDown = false; // 압출 중인지 여부 (폴리라인 연속성)
  let currentPolyline: number[][] = []; // 현재 압출 폴리라인
  let firstExtrusionPoint: Vector3 | null = null; // 첫 번째 실제 압출 시작점
  let isSupport = false; // 현재 서포트 출력 중인지 여부
  let currentTool = 0; // 현재 익스트루더 번호 (T0, T1, ...)

  for (const line of lines) {
    const trimmed = line.trim();
    const original = line; // 주석 확인용 원본 라인

    // 주석에서 서포트 감지 (일반적인 슬라이서 패턴)
    if (original.includes(';TYPE:SUPPORT') ||
        original.includes(';TYPE:Support') ||
        original.includes(';MESH:SUPPORT') ||
        original.toLowerCase().includes('support')) {
      isSupport = true;
    } else if (original.includes(';TYPE:') || original.includes(';MESH:')) {
      // 다른 타입이 시작되면 서포트 모드 해제
      isSupport = false;
    }

    // T 명령 감지 (멀티 익스트루더)
    if (trimmed.startsWith('T')) {
      const toolMatch = trimmed.match(/T(\d+)/);
      if (toolMatch) {
        const newTool = parseInt(toolMatch[1]);
        currentTool = newTool;
        // T1을 서포트 익스트루더로 간주 (일반적인 설정)
        if (newTool === 1) {
          isSupport = true;
        } else if (newTool === 0) {
          isSupport = false;
        }
      }
      continue;
    }

    // M82: 절대 압출 모드
    if (trimmed.startsWith("M82")) {
      absoluteE = true;
      continue;
    }

    // M83: 상대 압출 모드
    if (trimmed.startsWith("M83")) {
      absoluteE = false;
      currentE = 0;
      continue;
    }

    // G90: 절대 좌표 모드
    if (trimmed.startsWith("G90")) {
      absoluteXYZ = true;
      continue;
    }

    // G91: 상대 좌표 모드
    if (trimmed.startsWith("G91")) {
      absoluteXYZ = false;
      continue;
    }

    // G92: 현재 위치 재설정 (선 그리지 않음)
    if (trimmed.startsWith("G92")) {
      const xMatch = trimmed.match(/X([-\d.]+)/);
      const yMatch = trimmed.match(/Y([-\d.]+)/);
      const zMatch = trimmed.match(/Z([-\d.]+)/);
      const eMatch = trimmed.match(/E([-\d.]+)/);

      if (xMatch) currentX = parseFloat(xMatch[1]);
      if (yMatch) currentY = parseFloat(yMatch[1]);
      if (zMatch) currentZ = parseFloat(zMatch[1]);
      if (eMatch) currentE = parseFloat(eMatch[1]);

      penDown = false; // 위치 재설정 후 폴리라인 끊기
      continue;
    }

    // G0/G1 이동 명령
    if (trimmed.startsWith("G0") || trimmed.startsWith("G1")) {
      const isG0 = trimmed.startsWith("G0");
      const isG1 = trimmed.startsWith("G1");

      // 좌표 추출
      const xMatch = trimmed.match(/X([-\d.]+)/);
      const yMatch = trimmed.match(/Y([-\d.]+)/);
      const zMatch = trimmed.match(/Z([-\d.]+)/);
      const eMatch = trimmed.match(/E([-\d.]+)/);

      const prevX = currentX, prevY = currentY, prevZ = currentZ;

      // 좌표 업데이트 (절대/상대 모드 고려)
      if (absoluteXYZ) {
        if (xMatch) currentX = parseFloat(xMatch[1]);
        if (yMatch) currentY = parseFloat(yMatch[1]);
        if (zMatch) currentZ = parseFloat(zMatch[1]);
      } else {
        if (xMatch) currentX += parseFloat(xMatch[1]);
        if (yMatch) currentY += parseFloat(yMatch[1]);
        if (zMatch) currentZ += parseFloat(zMatch[1]);
      }

      // 원점 필터링
      if (!hasMovedFromOrigin) {
        if (currentX !== 0 || currentY !== 0 || currentZ !== 0) {
          hasMovedFromOrigin = true;
        } else {
          continue;
        }
      }

      if ((prevX === 0 && prevY === 0 && prevZ === 0) ||
          (currentX === 0 && currentY === 0 && currentZ === 0)) {
        continue;
      }

      // E값 증가 여부로 압출 판단 (임계값 0.02mm)
      let isExtruding = false;
      if (isG1 && eMatch) {
        const newE = parseFloat(eMatch[1]);
        if (absoluteE) {
          const deltaE = newE - currentE;
          isExtruding = deltaE > 0.02; // 노이즈/리트랙트 제거
        } else {
          isExtruding = newE > 0.02;
        }
        currentE = absoluteE ? newE : currentE + newE;
      }

      // 세그먼트 길이 아웃라이어 컷 (베드 대각선의 1.5배 이상이면 무시)
      const dist = Math.sqrt(
        Math.pow(currentX - prevX, 2) +
        Math.pow(currentY - prevY, 2) +
        Math.pow(currentZ - prevZ, 2)
      );
      if (dist > 500) { // 500mm 이상 점프는 무시
        penDown = false;
        continue;
      }

      // 레이어 관리
      const layerZ = Math.round(currentZ * 100) / 100;
      if (!layers.has(layerZ)) {
        layers.set(layerZ, { z: layerZ, moves: [], extrusions: [], supportExtrusions: [] });
      }
      const layer = layers.get(layerZ)!;

      // "펜 업/다운" 방식으로 폴리라인 관리
      if (isExtruding) {
        if (!penDown) {
          // 새 폴리라인 시작
          if (currentPolyline.length > 0) {
            // 서포트 여부에 따라 다른 배열에 저장
            if (isSupport) {
              layer.supportExtrusions.push([...currentPolyline]);
            } else {
              layer.extrusions.push([...currentPolyline]);
            }
          }
          currentPolyline = [[prevX, prevY, prevZ]];
          penDown = true;

          // 첫 번째 실제 압출 시작점 기록 (일반 출력만, 서포트 제외)
          if (!firstExtrusionPoint && !isSupport) {
            firstExtrusionPoint = new Vector3(currentX, currentY, currentZ);
            console.log('[parseGCode] First extrusion point found:', firstExtrusionPoint);
          }
        }
        currentPolyline.push([currentX, currentY, currentZ]);
      } else {
        // 비압출 구간 - 폴리라인 끊기
        if (penDown && currentPolyline.length > 0) {
          // 서포트 여부에 따라 다른 배열에 저장
          if (isSupport) {
            layer.supportExtrusions.push([...currentPolyline]);
          } else {
            layer.extrusions.push([...currentPolyline]);
          }
          currentPolyline = [];
        }
        penDown = false;

        // Travel 경로 기록
        if (isG0 || isG1) {
          layer.moves.push([prevX, prevY, prevZ], [currentX, currentY, currentZ]);
        }
      }
    }
  }

  // 마지막 폴리라인 저장
  if (currentPolyline.length > 0) {
    const lastZ = Math.round(currentZ * 100) / 100;
    if (layers.has(lastZ)) {
      // 서포트 여부에 따라 다른 배열에 저장
      if (isSupport) {
        layers.get(lastZ)!.supportExtrusions.push([...currentPolyline]);
      } else {
        layers.get(lastZ)!.extrusions.push([...currentPolyline]);
      }
    }
  }

  const sortedLayers = Array.from(layers.values()).sort((a, b) => a.z - b.z);
  return { layers: sortedLayers, firstExtrusionPoint };
}

// 레이어를 3D로 렌더링
function GCodeLayers({ layers, maxLayer, onModelInfoCalculated, showTravels, firstExtrusionPoint, isDarkMode = true }: {
  layers: GCodeLayer[];
  maxLayer: number;
  onModelInfoCalculated?: (offset: Vector3, size: Vector3) => void;
  showTravels?: boolean;
  firstExtrusionPoint?: Vector3 | null;
  isDarkMode?: boolean;
}) {
  const { camera, controls } = useThree();
  const [axesSize, setAxesSize] = useState<number>(50); // 축 크기 상태

  const visibleLayers = useMemo(() => {
    return layers.filter(layer => layer.z <= maxLayer);
  }, [layers, maxLayer]);

  // 모델 오프셋 계산 (GCode 원본 좌표 유지, 오프셋 없음)
  const modelOffset = useMemo(() => {
    // GCode 원본 좌표를 그대로 사용 (오프셋 없음)
    console.log('[GCodeLayers] Using original GCode coordinates (no offset)');
    return new Vector3(0, 0, 0);
  }, [layers, firstExtrusionPoint]);

  // 카메라 자동 조정
  useEffect(() => {
    if (layers.length === 0) return;

    // 모델 크기 계산
    const allPoints: number[] = [];
    layers.forEach(layer => {
      if (layer.extrusions.length > 0) {
        layer.extrusions.forEach(polyline => {
          polyline.forEach(point => allPoints.push(...point));
        });
      }
    });

    if (allPoints.length === 0) {
      layers.forEach(layer => {
        layer.moves.forEach(p => allPoints.push(...p));
      });
    }

    if (allPoints.length === 0) return;

    const box = new Box3();
    for (let i = 0; i < allPoints.length; i += 3) {
      box.expandByPoint(new Vector3(allPoints[i], allPoints[i + 1], allPoints[i + 2]));
    }

    const size = new Vector3();
    box.getSize(size);

    // 모델의 실제 중심 계산
    const modelCenter = new Vector3();
    box.getCenter(modelCenter);

    console.log('[GCodeLayers] Model bounding box:', {
      min: { x: box.min.x.toFixed(2), y: box.min.y.toFixed(2), z: box.min.z.toFixed(2) },
      max: { x: box.max.x.toFixed(2), y: box.max.y.toFixed(2), z: box.max.z.toFixed(2) },
      center: { x: modelCenter.x.toFixed(2), y: modelCenter.y.toFixed(2), z: modelCenter.z.toFixed(2) },
      size: { x: size.x.toFixed(2), y: size.y.toFixed(2), z: size.z.toFixed(2) }
    });

    // 카메라가 준비되면 즉시 조정
    const adjustCamera = () => {
      if (!controls) return;

      // OrbitControls target을 모델 중심으로 설정
      (controls as unknown as OrbitControlsImpl).target.set(modelCenter.x, modelCenter.y, modelCenter.z);

      // 카메라 거리 조정
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = camera instanceof PerspectiveCamera ? camera.fov * (Math.PI / 180) : Math.PI / 4;
      const cameraDistance = Math.abs(maxDim / Math.tan(fov / 2)) * 1.5;

      // 카메라를 45도 각도로 배치 (모델 중심 기준)
      const angle = Math.PI / 4;
      camera.position.set(
        modelCenter.x + cameraDistance * Math.cos(angle),
        modelCenter.y + cameraDistance * Math.sin(angle),
        modelCenter.z + cameraDistance * 0.7
      );

      camera.lookAt(modelCenter.x, modelCenter.y, modelCenter.z);
      camera.updateProjectionMatrix();
      (controls as unknown as OrbitControlsImpl).update();

      // 축 크기를 모델 크기의 20%로 설정
      setAxesSize(maxDim * 0.2);
    };

    // controls가 준비되지 않았다면 짧은 지연 후 다시 시도
    if (!controls) {
      setTimeout(adjustCamera, 100);
    } else {
      adjustCamera();
    }

    // 모델 오프셋과 크기를 부모 컴포넌트에 전달
    if (onModelInfoCalculated) {
      onModelInfoCalculated(modelOffset, size);
    }
  }, [layers, camera, controls, onModelInfoCalculated, modelOffset]);

  // 성능 최적화: 레이어별로 하나의 geometry로 병합
  const mergedLayers = useMemo(() => {
    return visibleLayers.map(layer => {
      // Travel 경로 병합
      const travelPoints: number[] = [];
      if (showTravels && layer.moves.length > 0) {
        travelPoints.push(...layer.moves.flat());
      }

      // Extrusion 경로 병합 (LineSegments 방식) - 일반 출력물
      const extrusionPoints: number[] = [];
      layer.extrusions.forEach(polyline => {
        if (polyline.length > 1) {
          // 폴리라인을 선분(segments)으로 변환
          for (let i = 0; i < polyline.length - 1; i++) {
            extrusionPoints.push(...polyline[i], ...polyline[i + 1]);
          }
        }
      });

      // Support Extrusion 경로 병합 (LineSegments 방식) - 서포트
      const supportExtrusionPoints: number[] = [];
      layer.supportExtrusions.forEach(polyline => {
        if (polyline.length > 1) {
          // 폴리라인을 선분(segments)으로 변환
          for (let i = 0; i < polyline.length - 1; i++) {
            supportExtrusionPoints.push(...polyline[i], ...polyline[i + 1]);
          }
        }
      });

      return { travelPoints, extrusionPoints, supportExtrusionPoints };
    });
  }, [visibleLayers, showTravels]);

  return (
    <>
      {/* 모델을 원점으로 이동시키는 그룹 */}
      <group position={[modelOffset.x, modelOffset.y, modelOffset.z]}>
        {mergedLayers.map((layer, idx) => (
          <group key={idx}>
            {/* Travel 경로 - 하나의 Line으로 병합 */}
            {layer.travelPoints.length > 0 && (
              <lineSegments>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={layer.travelPoints.length / 3}
                    array={new Float32Array(layer.travelPoints)}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial
                  color={0x666666}
                  transparent
                  opacity={0.1}
                />
              </lineSegments>
            )}
            {/* Extrusion 경로 - 하나의 LineSegments로 병합 (일반 출력물) */}
            {/* 다크모드: 노란색(#ffcc00), 라이트모드: 진한 파란색(#2563eb) */}
            {layer.extrusionPoints.length > 0 && (
              <lineSegments>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={layer.extrusionPoints.length / 3}
                    array={new Float32Array(layer.extrusionPoints)}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={isDarkMode ? 0xffcc00 : 0x2563eb} />
              </lineSegments>
            )}
            {/* Support Extrusion 경로 - 하나의 LineSegments로 병합 (서포트) */}
            {/* 다크모드: 청록색(#00cccc), 라이트모드: 진한 주황색(#ea580c) */}
            {layer.supportExtrusionPoints.length > 0 && (
              <lineSegments>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={layer.supportExtrusionPoints.length / 3}
                    array={new Float32Array(layer.supportExtrusionPoints)}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={isDarkMode ? 0x00cccc : 0xea580c} />
              </lineSegments>
            )}
          </group>
        ))}
      </group>
      {/* 축을 원점(0, 0, 0)에 고정 표시 */}
      <group position={[0, 0, 0]}>
        <axesHelper args={[axesSize]} />
      </group>
    </>
  );
}

export default function GCodePreview({
  gcodeUrl,
  gcodeContent,
  className = "",
}: GCodePreviewProps) {
  const { t } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const [gcode, setGcode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [layers, setLayers] = useState<GCodeLayer[]>([]);
  const [firstExtrusionPoint, setFirstExtrusionPoint] = useState<Vector3 | null>(null);
  const [currentLayer, setCurrentLayer] = useState<number>(0);
  const [showTravels, setShowTravels] = useState<boolean>(false); // Travel 경로 표시 여부

  // G-code 파일 로드
  useEffect(() => {
    async function loadGCode() {
      if (gcodeContent) {
        setGcode(gcodeContent);
        return;
      }

      if (gcodeUrl) {
        setLoading(true);
        try {
          console.log('[GCodePreview] Loading GCode from URL:', gcodeUrl);
          const response = await fetch(gcodeUrl, {
            cache: 'no-store', // 캐시 사용 안 함
            headers: {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
            }
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          // .gz 파일인지 확인 (압축된 GCode)
          const isCompressed = gcodeUrl.endsWith('.gz') || gcodeUrl.endsWith('.gcode.gz');

          let text: string;
          if (isCompressed) {
            // 압축 해제
            const arrayBuffer = await response.arrayBuffer();
            const decompressed = pako.ungzip(new Uint8Array(arrayBuffer), { toText: true });
            text = decompressed;
            console.log('[GCodePreview] GCode decompressed, size:', text.length, 'characters');
          } else {
            // 압축되지 않은 파일
            text = await response.text();
          }

          console.log('[GCodePreview] GCode loaded, size:', text.length, 'characters');
          console.log('[GCodePreview] First 500 chars:', text.substring(0, 500));
          setGcode(text);
        } catch (error) {
          console.error("[GCodePreview] Failed to load G-code:", error);
        } finally {
          setLoading(false);
        }
      }
    }

    loadGCode();
  }, [gcodeUrl, gcodeContent]);

  // G-code 파싱
  useEffect(() => {
    if (!gcode) return;

    console.log('[GCodePreview] ========================================');
    console.log('[GCodePreview] 🔄 Parsing GCode...');
    console.log('[GCodePreview] GCode content length:', gcode.length, 'characters');
    const parseResult = parseGCode(gcode);
    console.log('[GCodePreview] ✅ Parsing completed!');
    console.log('[GCodePreview] - Total layers parsed:', parseResult.layers.length);
    console.log('[GCodePreview] - First extrusion point:', parseResult.firstExtrusionPoint);
    if (parseResult.layers.length > 0) {
      console.log('[GCodePreview] - First layer Z:', parseResult.layers[0].z.toFixed(2), 'mm');
      console.log('[GCodePreview] - Last layer Z:', parseResult.layers[parseResult.layers.length - 1].z.toFixed(2), 'mm');
    }
    console.log('[GCodePreview] ========================================');

    setLayers(parseResult.layers);
    setFirstExtrusionPoint(parseResult.firstExtrusionPoint);
    if (parseResult.layers.length > 0) {
      // 기본적으로 모든 레이어 표시
      setCurrentLayer(parseResult.layers[parseResult.layers.length - 1].z);
    }
  }, [gcode]);

  const maxZ = layers.length > 0 ? layers[layers.length - 1].z : 0;
  const layerCount = layers.length;

  // 현재 Z 높이에 해당하는 레이어 인덱스 계산
  const currentLayerIndex = useMemo(() => {
    const index = layers.findIndex(layer => layer.z > currentLayer);
    return index === -1 ? layerCount : Math.max(1, index);
  }, [layers, currentLayer, layerCount]);

  return (
    <div className={`w-full h-full relative ${className}`}>
      {loading ? (
        <div className="flex items-center justify-center h-full bg-muted rounded-lg">
          <p className="text-muted-foreground">G-code 로딩 중...</p>
        </div>
      ) : gcode && layers.length > 0 ? (
        <>
          <Canvas
            shadows
            camera={{ position: [300, 300, 400], fov: 50 }}
            onCreated={({ camera }) => {
              camera.up.set(0, 0, 1);
            }}
            style={{ width: "100%", height: "100%" }}
          >
            <color attach="background" args={[isDarkMode ? "#2d2d2d" : "#f5f5f5"]} />
            <ambientLight intensity={isDarkMode ? 1.0 : 1.2} />
            <directionalLight position={[10, 10, 5]} intensity={isDarkMode ? 1.8 : 1.5} castShadow />
            <directionalLight position={[-10, -10, -5]} intensity={0.8} />
            <directionalLight position={[0, 10, 0]} intensity={0.6} />
            <GCodeLayers
              layers={layers}
              maxLayer={currentLayer}
              showTravels={showTravels}
              firstExtrusionPoint={firstExtrusionPoint}
              isDarkMode={isDarkMode}
            />
            {/* 그리드를 원점에 배치 - 10mm 간격 */}
            <Grid
              rotation={[Math.PI / 2, 0, 0]}
              infiniteGrid
              cellSize={10}
              cellThickness={0.5}
              cellColor={isDarkMode ? "#3a3f47" : "#cccccc"}
              sectionSize={200}
              sectionThickness={1.5}
              sectionColor={isDarkMode ? "#596273" : "#aaaaaa"}
              fadeDistance={1000}
              fadeStrength={1}
            />
            <OrbitControls
              enableDamping
              dampingFactor={0.05}
              enabled={layers.length > 0}
            />
          </Canvas>

          {/* 레이어 슬라이더 - 오른쪽 */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 h-[60%] w-16 flex flex-col items-center gap-4 bg-black/50 backdrop-blur-sm rounded-lg p-4">
            <div className="text-white text-sm font-semibold">{currentLayerIndex}</div>
            <Slider
              value={[currentLayer]}
              onValueChange={(value) => setCurrentLayer(value[0])}
              min={0}
              max={maxZ}
              step={0.01}
              orientation="vertical"
              className="h-full"
            />
            <div className="text-white text-xs text-center">
              {currentLayer.toFixed(2)}mm
            </div>
          </div>

          {/* 범례 및 컨트롤 - 왼쪽 위 */}
          <div className="absolute left-4 top-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white text-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-6 h-1 ${isDarkMode ? 'bg-yellow-400' : 'bg-blue-600'}`}></div>
              <span>{t('gcode.extrusionPath')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-6 h-1 ${isDarkMode ? 'bg-cyan-400' : 'bg-orange-600'}`}></div>
              <span>{t('gcode.support')}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 bg-gray-500 opacity-20"></div>
              <span>{t('gcode.travelPath')}</span>
            </div>
            {/* Travel 토글 버튼 */}
            <div className="pt-2 border-t border-white/20">
              <label className="flex items-center gap-2 cursor-pointer hover:bg-white/10 rounded px-1 py-1">
                <input
                  type="checkbox"
                  checked={showTravels}
                  onChange={(e) => setShowTravels(e.target.checked)}
                  className="w-3 h-3 cursor-pointer"
                />
                <span className="text-xs">{t('gcode.showTravelPath')}</span>
              </label>
            </div>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full bg-muted rounded-lg">
          <p className="text-muted-foreground">G-code 파일을 로드하세요</p>
        </div>
      )}
    </div>
  );
}
