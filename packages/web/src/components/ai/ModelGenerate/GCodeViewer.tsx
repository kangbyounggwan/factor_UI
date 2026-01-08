/**
 * G-code 뷰어 컴포넌트
 * 프린터 클릭 시 G-code 파일을 시각화하여 표시
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, FileText, Layers, Download, Eye, EyeOff } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid } from "@react-three/drei";
import { useTheme } from "next-themes";

interface GCodeViewerProps {
  gcodeUrl?: string;
  gcodeContent?: string;
  filename?: string;
  metadata?: {
    estimatedTime?: string;
    filamentLength?: number;
    layerCount?: number;
    layerHeight?: number;
  };
}

// G-code 파일 분석 함수
function parseGCodeMetadata(gcode: string) {
  const lines = gcode.split('\n');
  let layerCount = 0;
  let estimatedTime = '';
  let filamentLength = 0;
  let layerHeight = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Layer count (여러 형식 지원)
    // Cura: ;LAYER_COUNT:
    // BambuStudio: ; total layer number:
    if (trimmed.includes(';LAYER_COUNT:')) {
      const match = trimmed.match(/;LAYER_COUNT:(\d+)/);
      if (match) layerCount = parseInt(match[1]);
    } else if (trimmed.includes('; total layer number:')) {
      const match = trimmed.match(/; total layer number:\s*(\d+)/);
      if (match) layerCount = parseInt(match[1]);
    }

    // Print time (여러 형식 지원)
    // Cura: ;TIME:
    // BambuStudio: ; model printing time: 2h 10m 43s
    if (trimmed.includes(';TIME:')) {
      const match = trimmed.match(/;TIME:(\d+)/);
      if (match) {
        const seconds = parseInt(match[1]);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        estimatedTime = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      }
    } else if (trimmed.includes('; model printing time:')) {
      const match = trimmed.match(/; model printing time:\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(?:(\d+)s)?/);
      if (match) {
        const hours = match[1] ? parseInt(match[1]) : 0;
        const minutes = match[2] ? parseInt(match[2]) : 0;
        estimatedTime = hours > 0 ? `${hours}시간 ${minutes}분` : `${minutes}분`;
      }
    }

    // Filament length (여러 형식 지원)
    // Cura: ;Filament used: 123.45m
    // BambuStudio: ; total filament length [mm] : 8194.80
    if (trimmed.includes(';Filament used:')) {
      const match = trimmed.match(/;Filament used:\s*([\d.]+)m/);
      if (match) filamentLength = parseFloat(match[1]);
    } else if (trimmed.includes('; total filament length [mm]')) {
      const match = trimmed.match(/; total filament length \[mm\]\s*:\s*([\d.]+)/);
      if (match) filamentLength = parseFloat(match[1]) / 1000; // mm를 m로 변환
    }

    // Layer height (여러 형식 지원)
    // Cura: ;Layer height: 0.2
    // BambuStudio: 레이어마다 다를 수 있으므로 첫 번째 LAYER_HEIGHT 사용
    if (!layerHeight && trimmed.includes(';Layer height:')) {
      const match = trimmed.match(/;Layer height:\s*([\d.]+)/);
      if (match) layerHeight = parseFloat(match[1]);
    } else if (!layerHeight && trimmed.includes('; LAYER_HEIGHT:')) {
      const match = trimmed.match(/; LAYER_HEIGHT:\s*([\d.]+)/);
      if (match) layerHeight = parseFloat(match[1]);
    }
  }

  return { layerCount, estimatedTime, filamentLength, layerHeight };
}

// 간단한 G-code 경로 시각화 (3D 라인)
function GCodePath({ gcode }: { gcode: string }) {
  const [points, setPoints] = useState<[number, number, number][]>([]);

  useEffect(() => {
    // G-code 파싱하여 경로 추출 (간단한 버전)
    const lines = gcode.split('\n').slice(0, 1000); // 성능을 위해 처음 1000줄만
    const parsedPoints: [number, number, number][] = [];
    let currentX = 0,
      currentY = 0,
      currentZ = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('G1') || trimmed.startsWith('G0')) {
        // X, Y, Z 좌표 추출
        const xMatch = trimmed.match(/X([-\d.]+)/);
        const yMatch = trimmed.match(/Y([-\d.]+)/);
        const zMatch = trimmed.match(/Z([-\d.]+)/);

        if (xMatch) currentX = parseFloat(xMatch[1]);
        if (yMatch) currentY = parseFloat(yMatch[1]);
        if (zMatch) currentZ = parseFloat(zMatch[1]);

        parsedPoints.push([currentX, currentY, currentZ]);
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
          count={points.length}
          array={new Float32Array(points.flat())}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color="#00ff00" linewidth={2} />
    </line>
  );
}

export default function GCodeViewer({
  gcodeUrl,
  gcodeContent,
  filename = "gcode.gcode",
  metadata,
}: GCodeViewerProps) {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const [gcode, setGcode] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [show3D, setShow3D] = useState(true);
  const [parsedMetadata, setParsedMetadata] = useState(metadata);

  // G-code 파일 로드
  useEffect(() => {
    async function loadGCode() {
      if (gcodeContent) {
        setGcode(gcodeContent);
        const meta = parseGCodeMetadata(gcodeContent);
        setParsedMetadata((prev) => ({ ...prev, ...meta }));
        return;
      }

      if (gcodeUrl) {
        setLoading(true);
        try {
          const response = await fetch(gcodeUrl);
          const text = await response.text();
          setGcode(text);
          const meta = parseGCodeMetadata(text);
          setParsedMetadata((prev) => ({ ...prev, ...meta }));
        } catch (error) {
          console.error("Failed to load G-code:", error);
        } finally {
          setLoading(false);
        }
      }
    }

    loadGCode();
  }, [gcodeUrl, gcodeContent]);

  const handleDownload = () => {
    const blob = new Blob([gcode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <CardTitle className="text-lg">G-code 뷰어</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShow3D(!show3D)}
            >
              {show3D ? (
                <>
                  <EyeOff className="h-4 w-4 mr-1" />
                  3D 숨기기
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-1" />
                  3D 보기
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" />
              다운로드
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {filename}
          </Badge>
          {parsedMetadata?.layerCount && (
            <Badge variant="secondary" className="text-xs">
              <Layers className="h-3 w-3 mr-1" />
              {parsedMetadata.layerCount} 레이어
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 overflow-hidden">
        {/* 메타데이터 */}
        {parsedMetadata && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {parsedMetadata.estimatedTime && (
              <div className="p-2 bg-muted rounded">
                <div className="text-xs text-muted-foreground">예상 시간</div>
                <div className="font-medium">{parsedMetadata.estimatedTime}</div>
              </div>
            )}
            {parsedMetadata.filamentLength && (
              <div className="p-2 bg-muted rounded">
                <div className="text-xs text-muted-foreground">필라멘트</div>
                <div className="font-medium">
                  {parsedMetadata.filamentLength.toFixed(2)}m
                </div>
              </div>
            )}
            {parsedMetadata.layerHeight && (
              <div className="p-2 bg-muted rounded">
                <div className="text-xs text-muted-foreground">레이어 높이</div>
                <div className="font-medium">{parsedMetadata.layerHeight}mm</div>
              </div>
            )}
            {parsedMetadata.layerCount && (
              <div className="p-2 bg-muted rounded">
                <div className="text-xs text-muted-foreground">레이어 수</div>
                <div className="font-medium">{parsedMetadata.layerCount}</div>
              </div>
            )}
          </div>
        )}

        {/* 탭 */}
        <Tabs defaultValue={show3D ? "3d" : "code"} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="3d">3D 미리보기</TabsTrigger>
            <TabsTrigger value="code">G-code</TabsTrigger>
          </TabsList>

          {/* 3D 뷰 */}
          <TabsContent value="3d" className="flex-1 mt-2">
            <div className="w-full h-full bg-muted rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">로딩 중...</p>
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
                  <color attach="background" args={[isDarkMode ? "#2e323a" : "#f5f5f5"]} />
                  <ambientLight intensity={isDarkMode ? 0.8 : 1.0} />
                  <directionalLight position={[10, 10, 5]} intensity={isDarkMode ? 1.5 : 1.2} castShadow />
                  <directionalLight position={[-10, -10, -5]} intensity={0.6} />
                  <directionalLight position={[0, 10, 0]} intensity={0.4} />
                  <GCodePath gcode={gcode} />
                  <Grid
                    rotation={[Math.PI / 2, 0, 0]}
                    infiniteGrid
                    cellColor={isDarkMode ? "#3a3f47" : "#cccccc"}
                    sectionColor={isDarkMode ? "#596273" : "#aaaaaa"}
                    args={[200, 200]}
                  />
                  <axesHelper args={[100]} />
                  <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
                </Canvas>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">
                    G-code 파일을 로드하세요
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 코드 뷰 */}
          <TabsContent value="code" className="flex-1 mt-2">
            <ScrollArea className="h-full w-full rounded-lg border bg-muted/50">
              <pre className="p-4 text-xs font-mono">
                {loading ? "로딩 중..." : gcode || "G-code 파일을 로드하세요"}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
