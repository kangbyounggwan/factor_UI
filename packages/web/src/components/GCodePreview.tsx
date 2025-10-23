/**
 * 출력 설정 다이얼로그용 개선된 G-code 프리뷰 컴포넌트
 * - 레이어별 슬라이더
 * - 이동/출력 경로 색상 구분
 * - 자동 카메라 조정
 */

import { useState, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Line, Box3, Vector3 } from "three";
import { Slider } from "@/components/ui/slider";

interface GCodePreviewProps {
  gcodeUrl?: string;
  gcodeContent?: string;
  className?: string;
}

interface GCodeLayer {
  z: number;
  moves: number[][]; // [x, y, z][]
  extrusions: number[][]; // [x, y, z][]
}

// G-code를 레이어별로 파싱
function parseGCode(gcode: string): GCodeLayer[] {
  const lines = gcode.split("\n");
  const layers: Map<number, GCodeLayer> = new Map();

  let currentX = 0, currentY = 0, currentZ = 0;
  let isExtruding = false;
  let hasMovedFromOrigin = false; // 원점에서 벗어났는지 확인

  for (const line of lines) {
    const trimmed = line.trim();

    // G0 = 이동 (비출력), G1 = 출력
    if (trimmed.startsWith("G0") || trimmed.startsWith("G1")) {
      const isG1 = trimmed.startsWith("G1");

      // 좌표 추출
      const xMatch = trimmed.match(/X([-\d.]+)/);
      const yMatch = trimmed.match(/Y([-\d.]+)/);
      const zMatch = trimmed.match(/Z([-\d.]+)/);
      const eMatch = trimmed.match(/E([-\d.]+)/); // 압출 여부

      const prevX = currentX, prevY = currentY, prevZ = currentZ;

      if (xMatch) currentX = parseFloat(xMatch[1]);
      if (yMatch) currentY = parseFloat(yMatch[1]);
      if (zMatch) currentZ = parseFloat(zMatch[1]);

      // 원점 (0,0,0)에서 벗어난 첫 이동을 감지
      if (!hasMovedFromOrigin) {
        if (currentX !== 0 || currentY !== 0 || currentZ !== 0) {
          hasMovedFromOrigin = true;
        } else {
          // 아직 원점이면 이 라인은 스킵
          continue;
        }
      }

      // 이전 좌표나 현재 좌표가 원점이면 스킵 (원점 연결 라인 제외)
      if ((prevX === 0 && prevY === 0 && prevZ === 0) ||
          (currentX === 0 && currentY === 0 && currentZ === 0)) {
        continue;
      }

      // 레이어 Z 값으로 반올림 (0.01mm 단위)
      const layerZ = Math.round(currentZ * 100) / 100;

      if (!layers.has(layerZ)) {
        layers.set(layerZ, { z: layerZ, moves: [], extrusions: [] });
      }

      const layer = layers.get(layerZ)!;

      // E 값이 있고 증가하면 출력, 없거나 G0이면 이동
      isExtruding = isG1 && eMatch && parseFloat(eMatch[1]) > 0;

      if (isExtruding) {
        layer.extrusions.push([prevX, prevY, prevZ], [currentX, currentY, currentZ]);
      } else {
        layer.moves.push([prevX, prevY, prevZ], [currentX, currentY, currentZ]);
      }
    }
  }

  return Array.from(layers.values()).sort((a, b) => a.z - b.z);
}

// 레이어를 3D로 렌더링
function GCodeLayers({ layers, maxLayer, onModelCenterCalculated }: { layers: GCodeLayer[]; maxLayer: number; onModelCenterCalculated?: (center: Vector3, size: number) => void }) {
  const { camera, controls } = useThree();

  const visibleLayers = useMemo(() => {
    return layers.filter(layer => layer.z <= maxLayer);
  }, [layers, maxLayer]);

  // 카메라 자동 조정
  useEffect(() => {
    if (layers.length === 0 || !controls) return;

    // 모든 포인트의 바운딩 박스 계산
    const allPoints: number[] = [];
    layers.forEach(layer => {
      layer.moves.forEach(p => allPoints.push(...p));
      layer.extrusions.forEach(p => allPoints.push(...p));
    });

    if (allPoints.length === 0) return;

    const box = new Box3();
    for (let i = 0; i < allPoints.length; i += 3) {
      box.expandByPoint(new Vector3(allPoints[i], allPoints[i + 1], allPoints[i + 2]));
    }

    const center = new Vector3();
    box.getCenter(center);
    const size = new Vector3();
    box.getSize(size);

    // OrbitControls target을 모델 중심으로
    (controls as any).target.copy(center);

    // 카메라 거리 조정 - 더 타이트하게
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = 'fov' in camera ? (camera as any).fov * (Math.PI / 180) : Math.PI / 4;
    const cameraDistance = Math.abs(maxDim / Math.tan(fov / 2)) * 1.2; // 1.5에서 1.2로 줄임

    // 카메라를 45도 각도로 배치
    const angle = Math.PI / 4;
    camera.position.set(
      center.x + cameraDistance * Math.cos(angle),
      center.y + cameraDistance * Math.sin(angle),
      center.z + cameraDistance * 0.7 // 0.8에서 0.7로 줄임
    );

    camera.lookAt(center);
    camera.updateProjectionMatrix();
    (controls as any).update();

    // 모델 중심과 축 크기를 부모 컴포넌트에 전달
    if (onModelCenterCalculated) {
      onModelCenterCalculated(center, maxDim * 0.2); // 모델 크기의 20%로 축 표시
    }
  }, [layers, camera, controls, onModelCenterCalculated]);

  return (
    <>
      {visibleLayers.map((layer, idx) => (
        <group key={idx}>
          {/* 이동 경로 (회색) */}
          {layer.moves.length > 0 && (
            <primitive
              object={(() => {
                const geometry = new BufferGeometry();
                geometry.setAttribute('position', new Float32BufferAttribute(layer.moves.flat(), 3));
                const material = new LineBasicMaterial({ color: 0x666666, linewidth: 1 });
                return new Line(geometry, material);
              })()}
            />
          )}
          {/* 출력 경로 (청록색) */}
          {layer.extrusions.length > 0 && (
            <primitive
              object={(() => {
                const geometry = new BufferGeometry();
                geometry.setAttribute('position', new Float32BufferAttribute(layer.extrusions.flat(), 3));
                const material = new LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
                return new Line(geometry, material);
              })()}
            />
          )}
        </group>
      ))}
    </>
  );
}

export default function GCodePreview({
  gcodeUrl,
  gcodeContent,
  className = "",
}: GCodePreviewProps) {
  const [gcode, setGcode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [layers, setLayers] = useState<GCodeLayer[]>([]);
  const [currentLayer, setCurrentLayer] = useState<number>(0);
  const [axesCenter, setAxesCenter] = useState<Vector3>(new Vector3(0, 0, 0));
  const [axesSize, setAxesSize] = useState<number>(10);

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
          const response = await fetch(gcodeUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const text = await response.text();
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

    console.log('[GCodePreview] Parsing GCode...');
    const parsedLayers = parseGCode(gcode);
    console.log('[GCodePreview] Parsed layers:', parsedLayers.length);

    setLayers(parsedLayers);
    if (parsedLayers.length > 0) {
      // 기본적으로 모든 레이어 표시
      setCurrentLayer(parsedLayers[parsedLayers.length - 1].z);
    }
  }, [gcode]);

  const maxZ = layers.length > 0 ? layers[layers.length - 1].z : 0;
  const layerCount = layers.length;

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
            camera={{ position: [50, 50, 80], fov: 50 }}
            onCreated={({ camera }) => {
              camera.up.set(0, 0, 1);
            }}
            style={{ width: "100%", height: "100%" }}
          >
            <color attach="background" args={["#1a1a1a"]} />
            <ambientLight intensity={0.8} />
            <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
            <directionalLight position={[-10, -10, -5]} intensity={0.6} />
            <directionalLight position={[0, 10, 0]} intensity={0.4} />
            <GCodeLayers
              layers={layers}
              maxLayer={currentLayer}
              onModelCenterCalculated={(center, size) => {
                setAxesCenter(center);
                setAxesSize(size);
              }}
            />
            {/* 모델 위치에 Grid 배치 */}
            <group position={[axesCenter.x, axesCenter.y, 0]}>
              <Grid
                rotation={[Math.PI / 2, 0, 0]}
                infiniteGrid
                cellColor="#2a2a2a"
                sectionColor="#3a3a3a"
                args={[200, 200]}
              />
            </group>
            {/* 모델 중심에 축 표시 */}
            <group position={[axesCenter.x, axesCenter.y, axesCenter.z]}>
              <axesHelper args={[axesSize]} />
            </group>
            <OrbitControls enableDamping dampingFactor={0.05} />
          </Canvas>

          {/* 레이어 슬라이더 - 오른쪽 */}
          <div className="absolute right-4 top-1/2 -translate-y-1/2 h-[60%] w-16 flex flex-col items-center gap-4 bg-black/50 backdrop-blur-sm rounded-lg p-4">
            <div className="text-white text-sm font-semibold">{layerCount}</div>
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

          {/* 범례 - 왼쪽 위 */}
          <div className="absolute left-4 top-4 bg-black/70 backdrop-blur-sm rounded-lg p-3 text-white text-xs space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 bg-cyan-400"></div>
              <span>출력 경로</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-6 h-1 bg-gray-500"></div>
              <span>이동 경로</span>
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
