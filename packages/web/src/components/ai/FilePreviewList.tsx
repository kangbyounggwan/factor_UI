/**
 * 파일 미리보기 목록 컴포넌트
 * - 업로드된 이미지 미리보기
 * - G-code 파일 표시
 * - 삭제 버튼
 */
import { Button } from "@/components/ui/button";
import { X, FileCode2, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePreviewListProps {
  images: string[];
  gcodeFile: File | null;
  onRemoveImage: (index: number) => void;
  onRemoveGcode: () => void;
  className?: string;
}

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
    <div className={cn("flex flex-wrap gap-2", className)}>
      {/* 이미지 미리보기 */}
      {images.map((image, index) => (
        <div
          key={index}
          className="relative group w-16 h-16 rounded-lg overflow-hidden border bg-muted"
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
            className="absolute top-0.5 right-0.5 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </Button>
          <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-0.5 px-1">
            <ImageIcon className="h-3 w-3 text-white" />
          </div>
        </div>
      ))}

      {/* G-code 파일 미리보기 */}
      {gcodeFile && (
        <div className="relative group flex items-center gap-2 px-3 py-2 rounded-lg border bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <FileCode2 className="h-5 w-5 text-blue-500" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate max-w-[120px]">
              {gcodeFile.name}
            </span>
            <span className="text-xs text-blue-500 dark:text-blue-400">
              {(gcodeFile.size / 1024).toFixed(1)} KB
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRemoveGcode}
            className="h-6 w-6 ml-1 text-blue-500 hover:text-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
};

export default FilePreviewList;
