/**
 * G-code API 테스트 페이지
 * 백엔드 API로 Float32Array 렌더링 테스트
 */

import { useState, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Upload, Loader2 } from 'lucide-react';
import { analyzeGCodeWithSegments, type GCodeAnalysisResponse } from '@/lib/api/gcode';
import { GCodePath3DFromAPI } from '@/components/PrinterDetail/GCodePath3DFromAPI';
import { useToast } from '@/hooks/use-toast';

// 베드 플레이트
function BedPlate({ size, isDarkMode = true }: { size: { x: number; y: number }; isDarkMode?: boolean }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[size.x / 2, 0, size.y / 2]} receiveShadow>
      <planeGeometry args={[size.x, size.y]} />
      <meshStandardMaterial color={isDarkMode ? "#2a2a2a" : "#e8e8e8"} transparent opacity={0.8} />
    </mesh>
  );
}

export default function GCodeAPITest() {
  const { resolvedTheme } = useTheme();
  const isDarkMode = resolvedTheme === 'dark';
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<GCodeAnalysisResponse | null>(null);
  const [currentLayer, setCurrentLayer] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const bedSize = { x: 256, y: 256 }; // 기본 베드 사이즈

  // 파일 업로드 핸들러
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    console.log('[GCodeAPITest] Reading file:', file.name);

    try {
      // 파일 읽기
      const gcodeContent = await file.text();
      console.log('[GCodeAPITest] File size:', gcodeContent.length, 'bytes');

      // API 호출
      console.log('[GCodeAPITest] Calling API...');
      const startTime = Date.now();

      const result = await analyzeGCodeWithSegments(gcodeContent, {
        binaryFormat: true,
        language: 'ko'
      });

      const elapsed = Date.now() - startTime;
      console.log('[GCodeAPITest] API response received in', elapsed, 'ms');
      console.log('[GCodeAPITest] Analysis result:', result);

      if (result.status === 'segments_ready' && result.segments) {
        setAnalysisData(result);
        setCurrentLayer(0);

        toast({
          title: '분석 완료',
          description: `${result.segments.metadata.layerCount}개 레이어, ${(elapsed / 1000).toFixed(1)}초 소요`,
        });
      } else {
        throw new Error(result.message || '분석 실패');
      }
    } catch (error) {
      console.error('[GCodeAPITest] Error:', error);
      toast({
        title: 'G-code 분석 실패',
        description: error instanceof Error ? error.message : '알 수 없는 오류',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">G-code API 테스트</h1>
          <p className="text-muted-foreground mt-2">
            백엔드 API (Float32Array) 렌더링 테스트
          </p>
        </div>

        {/* 파일 업로드 */}
        <Card>
          <CardHeader>
            <CardTitle>G-code 파일 업로드</CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".gcode,.gco,.g"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  분석 중...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  G-code 파일 선택
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 분석 결과 메타데이터 */}
        {analysisData && (
          <Card>
            <CardHeader>
              <CardTitle>분석 결과</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">레이어 수:</span>{' '}
                  <span className="font-medium">{analysisData.segments.metadata.layerCount}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">레이어 높이:</span>{' '}
                  <span className="font-medium">{analysisData.segments.metadata.layerHeight}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">필라멘트:</span>{' '}
                  <span className="font-medium">{analysisData.segments.metadata.totalFilament.toFixed(2)}mm</span>
                </div>
                <div>
                  <span className="text-muted-foreground">출력 시간:</span>{' '}
                  <span className="font-medium">{Math.floor(analysisData.segments.metadata.printTime / 60)}분</span>
                </div>
              </div>
              <div className="pt-2">
                <span className="text-muted-foreground text-sm">바운딩 박스:</span>
                <div className="text-xs text-muted-foreground mt-1">
                  X: {analysisData.segments.metadata.boundingBox.minX.toFixed(1)} ~ {analysisData.segments.metadata.boundingBox.maxX.toFixed(1)},
                  Y: {analysisData.segments.metadata.boundingBox.minY.toFixed(1)} ~ {analysisData.segments.metadata.boundingBox.maxY.toFixed(1)},
                  Z: {analysisData.segments.metadata.boundingBox.minZ.toFixed(1)} ~ {analysisData.segments.metadata.boundingBox.maxZ.toFixed(1)}
                </div>
              </div>
              {/* 온도 정보 */}
              {analysisData.segments.temperatures && analysisData.segments.temperatures.length > 0 && (
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground text-sm">온도 데이터:</span>
                  <div className="text-xs text-muted-foreground mt-1">
                    {analysisData.segments.temperatures.length}개 레이어의 온도 정보 (백엔드 API 제공)
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 3D 뷰어 */}
        {analysisData && (
          <Card>
            <CardHeader>
              <CardTitle>3D 미리보기</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {/* 3D Canvas */}
              <div className="h-[600px] bg-black relative">
                <Canvas
                  shadows
                  camera={{
                    position: [bedSize.x + 100, 150, bedSize.y + 100],
                    fov: 50,
                    near: 0.1,
                    far: 2000
                  }}
                  gl={{
                    preserveDrawingBuffer: true,
                    powerPreference: 'high-performance',
                  }}
                >
                  <color attach="background" args={[isDarkMode ? '#1a1a1a' : '#f5f5f5']} />
                  <ambientLight intensity={isDarkMode ? 0.6 : 0.8} />
                  <directionalLight position={[100, 150, 100]} intensity={isDarkMode ? 1.2 : 1.0} castShadow />
                  <pointLight position={[bedSize.x / 2, 100, bedSize.y / 2]} intensity={0.5} />

                  {/* 베드 */}
                  <BedPlate size={bedSize} isDarkMode={isDarkMode} />

                  {/* G-code 경로 */}
                  <GCodePath3DFromAPI
                    layers={analysisData.segments.layers}
                    maxLayer={currentLayer}
                    isDarkMode={isDarkMode}
                  />

                  {/* 그리드 */}
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

              {/* 레이어 슬라이더 */}
              <div className="p-4 border-t">
                <div className="flex items-center gap-4">
                  <span className="text-sm font-medium whitespace-nowrap">
                    레이어: {currentLayer + 1} / {analysisData.segments.metadata.layerCount}
                  </span>
                  <Slider
                    value={[currentLayer]}
                    onValueChange={(value) => setCurrentLayer(value[0])}
                    max={analysisData.segments.metadata.layerCount - 1}
                    step={1}
                    className="flex-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
