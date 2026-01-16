/**
 * Create 모드 사이드바 콘텐츠
 * - 3D 모델 아카이브
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Box, Trash2 } from "lucide-react";
import type { AIGeneratedModel } from "./types";

interface CreateSidebarContentProps {
  generatedModels: AIGeneratedModel[];
  currentModelId: string | null;
  onSelectModel?: (model: AIGeneratedModel) => void;
  onDeleteModel?: (modelId: string) => void;
}

export function CreateSidebarContent({
  generatedModels,
  currentModelId,
  onSelectModel,
  onDeleteModel,
}: CreateSidebarContentProps) {
  const { t } = useTranslation();

  return (
    <>
      <p className="text-sm font-semibold text-foreground px-2 py-2">
        {t('ai.modelArchive', '모델 아카이브')}
      </p>
      {generatedModels.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t('ai.noModels', '생성된 모델이 없습니다')}
        </p>
      ) : (
        <ScrollArea className="flex-1">
          <div className="space-y-1">
            {generatedModels.map((model) => (
              <div
                key={model.id}
                className={cn(
                  "group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                  currentModelId === model.id
                    ? "bg-primary/10 text-primary"
                    : "hover:bg-muted"
                )}
                onClick={() => onSelectModel?.(model)}
              >
                {/* 썸네일 */}
                <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                  {model.thumbnail_url ? (
                    <img
                      src={model.thumbnail_url}
                      alt={model.prompt || '3D Model'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Box className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
                {/* 모델 정보 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {model.prompt || t('ai.untitledModel', '제목 없음')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {model.created_at ? new Date(model.created_at).toLocaleDateString() : ''}
                  </p>
                </div>
                {/* 삭제 버튼 */}
                {onDeleteModel && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteModel(model.id);
                    }}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </>
  );
}

export default CreateSidebarContent;
