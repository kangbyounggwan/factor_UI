/**
 * Model3DEmbed 컴포넌트
 * 커뮤니티 게시물에 3D 모델을 임베드하여 보여주는 컴포넌트
 */
import { useState, useCallback, Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Box, Maximize2, X, Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// ModelViewer는 lazy import로 번들 크기 최적화
import { lazy } from 'react';
const ModelViewer = lazy(() => import('@/components/ai/ModelViewer'));

interface Model3DEmbedProps {
  url: string;
  filename: string;
  fileType: string;
  className?: string;
}

export function Model3DEmbed({ url, filename, fileType, className }: Model3DEmbedProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(false);

  // 파일 확장자 확인
  const normalizedType = fileType.toLowerCase();

  // 3D 파일 종류 확인
  const isValid3DFile = ['stl', 'obj', '3mf', 'gltf', 'glb', 'gcode'].includes(normalizedType);

  // Three.js ModelViewer가 지원하는 포맷 (STL, OBJ, GLTF, GLB)
  // 3MF, GCODE는 ZIP 기반 또는 텍스트 기반이라 별도 로더 필요
  const isViewableFormat = ['stl', 'obj', 'gltf', 'glb'].includes(normalizedType);

  // 다운로드 핸들러
  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [url, filename]);

  // 지원되지 않는 포맷
  if (!isValid3DFile) {
    return (
      <Card className={cn("p-4 my-2", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Box className="w-5 h-5" />
          <span>{filename}</span>
          <span className="text-xs">({t('community.unsupportedFormat', '지원되지 않는 형식')})</span>
        </div>
      </Card>
    );
  }

  // 3MF, GCODE 등 뷰어 미지원 포맷 - 다운로드 전용 UI
  if (!isViewableFormat) {
    return (
      <Card className={cn("overflow-hidden my-2", className)}>
        <div className="flex items-center justify-between px-4 py-3 bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Box className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{filename}</p>
              <p className="text-xs text-muted-foreground uppercase">
                {normalizedType} {t('community.file3D', '3D 파일')}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            className="gap-1.5"
          >
            <Download className="w-4 h-4" />
            {t('common.download', '다운로드')}
          </Button>
        </div>
      </Card>
    );
  }

  // 인라인 뷰어 (미리보기)
  const renderInlineViewer = () => (
    <Card className={cn("overflow-hidden my-2", className)}>
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 text-sm">
          <Box className="w-4 h-4 text-primary" />
          <span className="font-medium truncate max-w-[200px]">{filename}</span>
          <span className="text-xs text-muted-foreground uppercase">({fileType})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDownload}
            className="h-7 px-2"
          >
            <Download className="w-3.5 h-3.5 mr-1" />
            {t('common.download', '다운로드')}
          </Button>
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

      {/* 3D 뷰어 영역 */}
      <div className="relative h-[480px] bg-slate-900">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-white" />
          </div>
        }>
          <ModelViewer
            modelUrl={url}
            height="100%"
            showDemo={false}
            enableRotationControls={false}
            hideControls={true}
          />
        </Suspense>
      </div>
    </Card>
  );

  // 전체화면 뷰어 다이얼로그
  const renderExpandedViewer = () => (
    <Dialog open={isExpanded} onOpenChange={setIsExpanded}>
      <DialogContent className="max-w-[90vw] max-h-[90vh] p-0" hideCloseButton>
        <DialogHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Box className="w-5 h-5 text-primary" />
              {filename}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
              >
                <Download className="w-4 h-4 mr-1" />
                {t('common.download', '다운로드')}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setIsExpanded(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="h-[70vh] bg-slate-900">
          <Suspense fallback={
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-white" />
            </div>
          }>
            <ModelViewer
              modelUrl={url}
              height="100%"
              showDemo={false}
              enableRotationControls={true}
              hideControls={true}
            />
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  );

  return (
    <>
      {renderInlineViewer()}
      {renderExpandedViewer()}
    </>
  );
}

export default Model3DEmbed;
