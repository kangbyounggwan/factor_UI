import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Box, Trash2 } from "lucide-react";

export interface ModelArchiveItem {
  id: string | number;  // UUID 또는 숫자 모두 허용
  name: string;
  createdAt: string;
  download_url?: string;  // Supabase Storage URL for rendering
  thumbnail_url?: string;  // Optional thumbnail
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
          <div className="space-y-3">
            {items.map((model) => (
              <Card
                key={model.id}
                className="p-3 hover:bg-accent/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => onSelect?.(model)}
                  >
                    {model.thumbnail_url ? (
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img
                          src={model.thumbnail_url}
                          alt={model.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Box className="w-6 h-6 text-primary" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" title={model.name}>
                        {shortenFileName(model.name)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(model.createdAt).toLocaleString('ko-KR', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                  {onDelete && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(model);
                      }}
                      title="모델 삭제"
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>
    </>
  );
}


