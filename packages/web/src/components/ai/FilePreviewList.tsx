/**
 * 파일 미리보기 목록 컴포넌트
 * - 업로드된 이미지 미리보기
 * - G-code 파일 표시 (고도화된 UI)
 * - 삭제 버튼
 */
import { Button } from "@/components/ui/button";
import { X, FileCode2, Image as ImageIcon, File, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePreviewListProps {
  images: string[];
  gcodeFile: File | null;
  onRemoveImage: (index: number) => void;
  onRemoveGcode: () => void;
  className?: string;
}

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

/**
 * 파일명에서 확장자 추출
 */
const getFileExtension = (filename: string): string => {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ext.toUpperCase();
};

/**
 * 파일명 줄이기 (중간 생략)
 */
const truncateFileName = (filename: string, maxLength: number = 24): string => {
  if (filename.length <= maxLength) return filename;

  const ext = filename.split('.').pop() || '';
  const nameWithoutExt = filename.slice(0, filename.lastIndexOf('.'));

  if (nameWithoutExt.length <= maxLength - ext.length - 4) {
    return filename;
  }

  const keepStart = Math.floor((maxLength - ext.length - 3) / 2);
  const keepEnd = Math.ceil((maxLength - ext.length - 3) / 2);

  return `${nameWithoutExt.slice(0, keepStart)}...${nameWithoutExt.slice(-keepEnd)}.${ext}`;
};

export const FilePreviewList = ({
  images,
  gcodeFile,
  onRemoveImage,
  onRemoveGcode,
  className,
}: FilePreviewListProps) => {
  if (images.length === 0 && !gcodeFile) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-3 mb-3", className)}>
      {/* 이미지 미리보기 */}
      {images.map((image, index) => (
        <div
          key={index}
          className="relative group w-20 h-20 rounded-xl overflow-hidden border-2 border-muted bg-muted shadow-sm hover:shadow-md transition-shadow"
        >
          <img
            src={image}
            alt={`Preview ${index + 1}`}
            className="w-full h-full object-cover"
          />
          <Button
            variant="destructive"
            size="icon"
            onClick={() => onRemoveImage(index)}
            className="absolute top-1 right-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity rounded-full"
          >
            <X className="h-3 w-3" />
          </Button>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent py-1 px-1.5">
            <ImageIcon className="h-3.5 w-3.5 text-white" />
          </div>
        </div>
      ))}

      {/* G-code 파일 미리보기 - 고도화된 UI */}
      {gcodeFile && (
        <div className="relative group flex items-center gap-3 pl-3 pr-2 py-2.5 rounded-xl border-2 bg-gradient-to-r from-blue-50 to-sky-50 dark:from-blue-950/50 dark:to-sky-950/50 border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all min-w-[200px] max-w-[280px]">
          {/* 파일 아이콘 영역 */}
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-sky-500 flex items-center justify-center shadow-sm">
            <FileCode2 className="h-5 w-5 text-white" />
          </div>

          {/* 파일 정보 영역 */}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            {/* 파일명 */}
            <span
              className="text-sm font-semibold text-blue-800 dark:text-blue-200 truncate"
              title={gcodeFile.name}
            >
              {truncateFileName(gcodeFile.name)}
            </span>

            {/* 파일 메타 정보 */}
            <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/50 font-medium">
                <File className="h-3 w-3" />
                {getFileExtension(gcodeFile.name)}
              </span>
              <span className="inline-flex items-center gap-1">
                <HardDrive className="h-3 w-3" />
                {formatFileSize(gcodeFile.size)}
              </span>
            </div>
          </div>

          {/* 삭제 버튼 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemoveGcode}
            className="flex-shrink-0 h-7 w-7 rounded-full text-blue-500 hover:text-white hover:bg-red-500 transition-colors"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default FilePreviewList;
