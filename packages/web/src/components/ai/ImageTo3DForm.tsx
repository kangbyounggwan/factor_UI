import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

type Quality = 'low' | 'medium' | 'high';

export interface ImageTo3DFormProps {
  files: Array<{ id: number; name: string; size: number; type: string; url: string }>;
  selectedId: number | null;
  imageDepth: 'auto' | 'manual';
  imageQuality: Quality;
  isProcessing: boolean;
  hasExistingModel?: boolean; // 선택된 이미지의 3D 모델 존재 여부
  onPickFiles?: () => void;
  onDrop: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: (id: number) => void;
  onSelect: (id: number) => void;
  onChangeDepth: (d: 'auto'|'manual') => void;
  onChangeQuality: (q: Quality) => void;
  onSubmit: () => void;
}

export default function ImageTo3DForm(props: ImageTo3DFormProps) {
  const { t } = useTranslation();
  const { files, selectedId, imageDepth, imageQuality, isProcessing, hasExistingModel, onPickFiles, onDrop, onDragOver, onFileChange, onRemove, onSelect, onChangeDepth, onChangeQuality, onSubmit } = props;
  const inputRef = useRef<HTMLInputElement>(null);
  const active = selectedId != null ? files.find(f => f.id === selectedId) : (files.length > 0 ? files[files.length - 1] : null);
  return (
    <Card className="lg:sticky top-4 max-h-[calc(85vh-4rem-2rem)] overflow-auto lg:w-[420px]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          {t('ai.imageUploadTitle')}
        </CardTitle>
        <CardDescription>{t('ai.imageUploadDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <div 
          className="border-2 border-dashed border-muted-foreground/25 rounded-lg px-12 py-10 text-center hover:border-primary/50 transition-colors cursor-pointer"
          onDragOver={onDragOver}
          onDrop={onDrop}
          onClick={() => (onPickFiles ? onPickFiles() : inputRef.current?.click())}
        >
          <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">{t('ai.clickOrDrop')}</p>
          <p className="text-sm text-muted-foreground mb-4">{t('ai.supportedFormats')}</p>
          <Button variant="outline">{t('ai.selectFile')}</Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          onChange={onFileChange}
          className="hidden"
          accept="image/*"
          multiple
        />

        {files.length > 0 && (
          <div className="mt-6 space-y-3">
            <h4 className="font-medium">{t('ai.selectedImage')}</h4>
            {active && (
              <div className="flex items-center gap-3 p-3 border rounded-lg">
                <img src={active.url} alt={active.name} className="w-16 h-16 object-cover rounded" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" title={active.name}>{active.name}</p>
                  <p className="text-xs text-muted-foreground">{(active.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => onRemove(active.id)} className="flex-shrink-0">{t('common.delete')}</Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-4 p-4 bg-muted/5 rounded-lg mt-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.depthRecognition')}</label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={imageDepth==='auto'?'default':'outline'} size="sm" onClick={()=>onChangeDepth('auto')}>{t('ai.depthAuto')}</Button>
              <Button variant={imageDepth==='manual'?'default':'outline'} size="sm" onClick={()=>onChangeDepth('manual')}>{t('ai.depthManual')}</Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.quality')}</label>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={imageQuality==='low'?'default':'outline'} size="sm" onClick={()=>onChangeQuality('low')}>{t('ai.qualityLow')}</Button>
              <Button variant={imageQuality==='medium'?'default':'outline'} size="sm" onClick={()=>onChangeQuality('medium')}>{t('ai.qualityMedium')}</Button>
              <Button variant={imageQuality==='high'?'default':'outline'} size="sm" onClick={()=>onChangeQuality('high')}>{t('ai.qualityHigh')}</Button>
            </div>
          </div>
        </div>

        <Button onClick={onSubmit} className="w-full mt-4" size="lg" disabled={isProcessing || !active}>
          {hasExistingModel ? t('ai.regenerate3D') : t('ai.convertTo3D')}
        </Button>
      </CardContent>
    </Card>
  );
}


