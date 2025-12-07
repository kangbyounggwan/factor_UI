import { useState, lazy, Suspense } from "react";
import { STLUpload } from "@/components/STLUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Lazy load ModelViewer to reduce initial bundle size
const ModelViewer = lazy(() => import("@/components/ai/ModelViewer"));

interface STLFile {
  id: string;
  filename: string;
  file_path: string;
  file_size: number;
  thumbnail_url?: string;
  storage_url?: string;
  upload_date: string;
  triangle_count?: number;
  bounding_box?: { x: number; y: number; z: number };
  status: string;
}

export default function STLManager() {
  const [selectedFile, setSelectedFile] = useState<STLFile | null>(null);

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">STL 파일 관리</h1>
        <p className="text-muted-foreground mt-2">
          STL 파일을 업로드하면 자동으로 썸네일이 생성되어 Supabase에 저장됩니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 왼쪽: 파일 업로드 및 관리 */}
        <div className="space-y-4">
          <STLUpload onFileSelect={setSelectedFile} />
        </div>

        {/* 오른쪽: 3D 모델 뷰어 */}
        <div className="space-y-4">
          <Card className="h-[600px]">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {selectedFile ? selectedFile.filename : "3D 모델 미리보기"}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[calc(100%-4rem)]">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Loading 3D viewer...</p>
                  </div>
                </div>
              }>
                <ModelViewer
                  className="w-full h-full"
                  stlUrl={selectedFile?.storage_url}
                  placeholderMessage="왼쪽에서 파일을 선택하여 미리보기"
                />
              </Suspense>
            </CardContent>
          </Card>

          {selectedFile && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">모델 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-muted-foreground">파일명:</div>
                  <div className="font-medium">{selectedFile.filename}</div>

                  <div className="text-muted-foreground">삼각형 개수:</div>
                  <div className="font-medium">
                    {selectedFile.triangle_count?.toLocaleString() || 'N/A'}
                  </div>

                  {selectedFile.bounding_box && (
                    <>
                      <div className="text-muted-foreground">크기 (mm):</div>
                      <div className="font-medium">
                        {selectedFile.bounding_box.x.toFixed(1)} × {' '}
                        {selectedFile.bounding_box.y.toFixed(1)} × {' '}
                        {selectedFile.bounding_box.z.toFixed(1)}
                      </div>
                    </>
                  )}

                  <div className="text-muted-foreground">상태:</div>
                  <div className="font-medium">{selectedFile.status}</div>

                  <div className="text-muted-foreground">업로드일:</div>
                  <div className="font-medium">
                    {new Date(selectedFile.upload_date).toLocaleDateString('ko-KR')}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
