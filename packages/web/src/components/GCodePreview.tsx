/**
 * 출력 설정 다이얼로그용 간단한 G-code 프리뷰 컴포넌트
 */

import { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";

interface GCodePreviewProps {
  gcodeUrl?: string;
  gcodeContent?: string;
  className?: string;
}

// G-code 경로를 3D로 렌더링하는 컴포넌트
function GCodePath({ gcode }: { gcode: string }) {
  const [points, setPoints] = useState<number[]>([]);

  useEffect(() => {
    const lines = gcode.split("\n");
    const parsedPoints: number[] = [];
    let currentX = 0,
      currentY = 0,
      currentZ = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith("G1") || trimmed.startsWith("G0")) {
        // X, Y, Z 좌표 추출
        const xMatch = trimmed.match(/X([-\d.]+)/);
        const yMatch = trimmed.match(/Y([-\d.]+)/);
        const zMatch = trimmed.match(/Z([-\d.]+)/);

        if (xMatch) currentX = parseFloat(xMatch[1]);
        if (yMatch) currentY = parseFloat(yMatch[1]);
        if (zMatch) currentZ = parseFloat(zMatch[1]);

        parsedPoints.push(currentX, currentY, currentZ);
      }
    }

    setPoints(parsedPoints);
  }, [gcode]);

  if (points.length === 0) return null;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={points.length / 3}
          array={new Float32Array(points)}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial attach="material" color="#00ff00" linewidth={2} />
    </line>
  );
}

export default function GCodePreview({
  gcodeUrl,
  gcodeContent,
  className = "",
}: GCodePreviewProps) {
  const [gcode, setGcode] = useState<string>("");
  const [loading, setLoading] = useState(false);

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
          const text = await response.text();
          setGcode(text);
        } catch (error) {
          console.error("Failed to load G-code:", error);
        } finally {
          setLoading(false);
        }
      }
    }

    loadGCode();
  }, [gcodeUrl, gcodeContent]);

  return (
    <div className={`w-full h-full ${className}`}>
      {loading ? (
        <div className="flex items-center justify-center h-full bg-muted rounded-lg">
          <p className="text-muted-foreground">G-code 로딩 중...</p>
        </div>
      ) : gcode ? (
        <Canvas
          shadows
          camera={{ position: [50, 50, 80], fov: 50 }}
          onCreated={({ camera }) => {
            camera.up.set(0, 0, 1);
          }}
          style={{ width: "100%", height: "100%" }}
        >
          <color attach="background" args={["#2e323a"]} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} castShadow />
          <directionalLight position={[-10, -10, -5]} intensity={0.6} />
          <directionalLight position={[0, 10, 0]} intensity={0.4} />
          <GCodePath gcode={gcode} />
          <Grid
            rotation={[Math.PI / 2, 0, 0]}
            infiniteGrid
            cellColor="#3a3f47"
            sectionColor="#596273"
            args={[200, 200]}
          />
          <axesHelper args={[100]} />
          <OrbitControls enableDamping dampingFactor={0.05} />
        </Canvas>
      ) : (
        <div className="flex items-center justify-center h-full bg-muted rounded-lg">
          <p className="text-muted-foreground">G-code 파일을 로드하세요</p>
        </div>
      )}
    </div>
  );
}
