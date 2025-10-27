import { ImageIcon, Box, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

export interface UploadArchiveItem {
  id: number;
  name: string;
  size: number;
  url: string;
  storagePath?: string;
  has3DModel?: boolean;  // 3D 모델 생성 여부
  modelId?: string;      // 생성된 모델 ID (클릭 시 로드용)
}

export default function UploadArchive({ items, selectedId, onSelect }:{ items: UploadArchiveItem[]; selectedId: number | null; onSelect:(id:number)=>void }) {
  const { t } = useTranslation();
  return (
    <div className="mb-6">
      {items.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <ImageIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">업로드된 이미지가 없습니다</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((file) => (
            <button
              key={file.id}
              type="button"
              onClick={() => onSelect(file.id)}
              className={`border rounded-lg p-2 text-left transition-all ${
                selectedId === file.id ? 'ring-2 ring-primary' : 'hover:border-primary/50'
              }`}
            >
              <div className="relative">
                <img src={file.url} alt={file.name} className="w-full aspect-square object-cover rounded mb-2" />
                {/* 3D 모델 상태 뱃지 */}
                {file.has3DModel && (
                  <div className="absolute top-1 right-1">
                    <Badge variant="default" className="bg-green-600 hover:bg-green-700 text-white gap-1 text-[10px] py-0 px-1.5">
                      <Box className="w-3 h-3" />
                      <span>{t('ai.has3DModel')}</span>
                    </Badge>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between gap-1">
                <p className="text-xs font-medium truncate flex-1">{file.name}</p>
                {selectedId === file.id && (
                  <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}


