import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type Quality = 'low' | 'medium' | 'high';
type Model = 'flux-kontext' | 'gpt-4';
type Style = 'realistic' | 'abstract';

export interface TextTo3DFormProps {
  prompt: string;
  quality: Quality;
  model: Model;
  style: Style;
  isProcessing: boolean;
  onChangePrompt: (v: string) => void;
  onChangeQuality: (q: Quality) => void;
  onChangeModel: (m: Model) => void;
  onChangeStyle: (s: Style) => void;
  onSubmit: () => void;
}

export default function TextTo3DForm(props: TextTo3DFormProps) {
  const { t } = useTranslation();
  const { prompt, quality, model, style, isProcessing, onChangePrompt, onChangeQuality, onChangeModel, onChangeStyle, onSubmit } = props;
  return (
    <Card className="lg:sticky top-4 max-h-[calc(85vh-4rem-2rem)] overflow-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-5 h-5" />
          {t('ai.textTo3DTitle')}
        </CardTitle>
        <CardDescription>{t('ai.textTo3DDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('ai.textPrompt')}</label>
          <Textarea placeholder={t('ai.textPromptPlaceholder')} value={prompt} onChange={(e)=>onChangePrompt(e.target.value)} className="min-h-[120px]" />
        </div>
        <div className="space-y-4 p-4 bg-muted/5 rounded-lg">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.quality')}</label>
            <div className="grid grid-cols-3 gap-2">
              <Button variant={quality==='low'?'default':'outline'} size="sm" onClick={()=>onChangeQuality('low')}>{t('ai.qualityLow')}</Button>
              <Button variant={quality==='medium'?'default':'outline'} size="sm" onClick={()=>onChangeQuality('medium')}>{t('ai.qualityMedium')}</Button>
              <Button variant={quality==='high'?'default':'outline'} size="sm" onClick={()=>onChangeQuality('high')}>{t('ai.qualityHigh')}</Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.model')}</label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={model==='flux-kontext'?'default':'outline'} size="sm" onClick={()=>onChangeModel('flux-kontext')}>Flux Kontext</Button>
              <Button variant={model==='gpt-4'?'default':'outline'} size="sm" onClick={()=>onChangeModel('gpt-4')}>GPT-4</Button>
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.style')}</label>
            <div className="grid grid-cols-2 gap-2">
              <Button variant={style==='realistic'?'default':'outline'} size="sm" onClick={()=>onChangeStyle('realistic')}>{t('ai.styleRealistic')}</Button>
              <Button variant={style==='abstract'?'default':'outline'} size="sm" onClick={()=>onChangeStyle('abstract')}>{t('ai.styleAbstract')}</Button>
            </div>
          </div>
        </div>
        <Button onClick={onSubmit} disabled={isProcessing || !prompt.trim()} className="w-full" size="lg">
          {t('ai.generate')}
        </Button>
      </CardContent>
    </Card>
  );
}


