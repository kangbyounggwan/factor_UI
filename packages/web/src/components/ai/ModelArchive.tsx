import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Box, Trash2, Loader2, Printer } from "lucide-react";

export interface ModelArchiveItem {
  id: string | number;  // UUID 또는 숫자 모두 허용
  name: string;
  createdAt: string;
  download_url?: string;  // Supabase Storage URL for rendering
  thumbnail_url?: string;  // Optional thumbnail
  gcode_url?: string;  // GCode URL if slicing is complete
  isGenerating?: boolean;  // 생성 중인지 여부
}

export interface ModelArchiveProps {
  items: ModelArchiveItem[];
  onSelect?: (item: ModelArchiveItem) => void;
  onDelete?: (item: ModelArchiveItem) => void;
}

// 긴 파일명을 간략하게 표시
function shortenFileName(name: string, maxLength: number = 25): string {
  if (name.length <= maxLength) return name;

  // 파일 확장자 분리
  const lastDotIndex = name.lastIndexOf('.');
  if (lastDotIndex === -1) {
    // 확장자가 없는 경우
    return name.substring(0, maxLength - 3) + '...';
  }

  const extension = name.substring(lastDotIndex);
  const nameWithoutExt = name.substring(0, lastDotIndex);

  // 확장자를 제외한 이름 부분만 자르기
  const availableLength = maxLength - extension.length - 3; // 3 for '...'
  if (availableLength <= 0) {
    return name.substring(0, maxLength - 3) + '...';
  }

  return nameWithoutExt.substring(0, availableLength) + '...' + extension;
}

export default function ModelArchive({ items, onSelect, onDelete }: ModelArchiveProps) {
  return (
    <>
      <ScrollArea className="h-full">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Box className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">생성된 3D 모델이 없습니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((model) => (
              <Card
                key={model.id}
                className={`p-2 hover:bg-accent/50 transition-colors group relative ${
                  model.gcode_url ? 'border-2 border-green-400/30' : ''
                } ${model.isGenerating ? 'opacity-60' : ''}`}
              >
                <div
                  className={model.isGenerating ? 'pointer-events-none' : 'cursor-pointer'}
                  onClick={() => !model.isGenerating && onSelect?.(model)}
                >
                  {model.thumbnail_url ? (
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-muted mb-2 relative">
                      <img
                        src={model.thumbnail_url}
                        alt={model.name}
                        className="w-full h-full object-cover"
                      />
                      {model.isGenerating && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        </div>
                      )}
                      {/* 슬라이싱 완료 뱃지 */}
                      {model.gcode_url && !model.isGenerating && (
                        <Badge
                          className="absolute top-1 left-1 bg-green-500 hover:bg-green-600 text-white text-[9px] px-1.5 py-0 h-5 gap-0.5"
                          title="즉시 출력 가능"
                        >
                          <Printer className="w-2.5 h-2.5" />
                          <span>READY</span>
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-primary/10 rounded-lg flex items-center justify-center mb-2 relative">
                      {model.isGenerating ? (
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      ) : (
                        <Box className="w-8 h-8 text-primary" />
                      )}
                      {/* 썸네일 없는 경우에도 슬라이싱 완료 뱃지 */}
                      {model.gcode_url && !model.isGenerating && (
                        <Badge
                          className="absolute top-1 left-1 bg-green-500 hover:bg-green-600 text-white text-[9px] px-1.5 py-0 h-5 gap-0.5"
                          title="즉시 출력 가능"
                        >
                          <Printer className="w-2.5 h-2.5" />
                          <span>READY</span>
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate" title={model.name}>
                      {shortenFileName(model.name, 15)}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {new Date(model.createdAt).toLocaleDateString('ko-KR', {
                        month: '2-digit',
                        day: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(model);
                    }}
                    title="모델 삭제"
                  >
                    <Trash2 className="w-3 h-3 text-destructive" />
                  </Button>
                )}
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}


