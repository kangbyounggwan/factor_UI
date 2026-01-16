/**
 * Model3DNodeComponent
 * TipTap 에디터 내에서 3D 모델을 표시하고 삭제할 수 있는 컴포넌트
 */
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Box, X, Loader2, FileCode, Download, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Model3DNodeComponent({ node, deleteNode, selected, editor }: NodeViewProps) {
  const { t } = useTranslation();
  const { url, filename, filetype, isLoading, downloadable = true } = node.attrs;
  const [showControls, setShowControls] = useState(false);

  // 모델 삭제
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    deleteNode();
  }, [deleteNode]);

  // 다운로드 가능 여부 변경
  const handleDownloadableChange = useCallback((value: boolean) => {
    if (editor && url) {
      editor.commands.updateModel3DDownloadable(url, value);
    }
  }, [editor, url]);

  // 파일 확장자 표시용
  const displayType = filetype?.toUpperCase() || '3D';

  // G-code 파일인지 확인
  const isGCode = ['gcode', 'nc', 'ngc'].includes(filetype?.toLowerCase() || '');

  return (
    <NodeViewWrapper className="relative my-2">
      <div
        className={cn(
          "relative group",
          selected && "ring-2 ring-primary ring-offset-2 rounded-lg"
        )}
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* 3D 모델 카드 */}
        <div className={cn(
          "p-4 border rounded-lg",
          isGCode ? "bg-orange-50 dark:bg-orange-950/20" : "bg-muted/30",
          isLoading && "animate-pulse"
        )}>
          <div className="flex items-center gap-3">
            {/* 아이콘 - G-code는 주황색, 3D 모델은 파란색 */}
            <div className={cn(
              "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
              isGCode ? "bg-orange-100 dark:bg-orange-900/30" : "bg-primary/10"
            )}>
              {isLoading ? (
                <Loader2 className={cn(
                  "w-6 h-6 animate-spin",
                  isGCode ? "text-orange-500" : "text-primary"
                )} />
              ) : isGCode ? (
                <FileCode className="w-6 h-6 text-orange-500" />
              ) : (
                <Box className="w-6 h-6 text-primary" />
              )}
            </div>

            {/* 파일 정보 */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{filename || '3D Model'}</p>
              <p className="text-xs text-muted-foreground">
                {isLoading ? t('community.uploading', '업로드 중...') : `${displayType} (${isGCode ? 'G-code' : '3D 모델'})`}
              </p>
            </div>

            {/* 다운로드 가능 여부 라디오 버튼 - 로딩 중에는 숨김 */}
            {!isLoading && (
              <div className="flex items-center gap-3 shrink-0">
                <label className={cn(
                  "flex items-center gap-1.5 cursor-pointer text-xs px-2.5 py-1.5 rounded-md border transition-colors",
                  downloadable
                    ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400"
                    : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                )}>
                  <input
                    type="radio"
                    name={`downloadable-${url}`}
                    checked={downloadable}
                    onChange={() => handleDownloadableChange(true)}
                    className="sr-only"
                  />
                  <Download className="w-3.5 h-3.5" />
                  <span>{t('community.downloadAllowed', '다운로드 허용')}</span>
                </label>
                <label className={cn(
                  "flex items-center gap-1.5 cursor-pointer text-xs px-2.5 py-1.5 rounded-md border transition-colors",
                  !downloadable
                    ? "bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-700 text-red-700 dark:text-red-400"
                    : "bg-muted/50 border-border text-muted-foreground hover:bg-muted"
                )}>
                  <input
                    type="radio"
                    name={`downloadable-${url}`}
                    checked={!downloadable}
                    onChange={() => handleDownloadableChange(false)}
                    className="sr-only"
                  />
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t('community.downloadNotAllowed', '다운로드 금지')}</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* 삭제 버튼 - 로딩 중에는 숨김 */}
        {!isLoading && (showControls || selected) && (
          <button
            onClick={handleDelete}
            className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md hover:bg-destructive/90 transition-colors z-10"
            title={t('common.delete', '삭제')}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </NodeViewWrapper>
  );
}

export default Model3DNodeComponent;
