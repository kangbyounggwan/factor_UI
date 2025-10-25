import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type SymmetryMode = 'off' | 'auto' | 'on';
type ArtStyle = 'realistic' | 'sculpture';

export interface TextTo3DFormProps {
  prompt: string;
  symmetryMode: SymmetryMode;
  artStyle: ArtStyle;
  targetPolycount: number;
  isProcessing: boolean;
  onChangePrompt: (v: string) => void;
  onChangeSymmetryMode: (m: SymmetryMode) => void;
  onChangeArtStyle: (s: ArtStyle) => void;
  onChangeTargetPolycount: (p: number) => void;
  onSubmit: () => void;
}

export default function TextTo3DForm(props: TextTo3DFormProps) {
  const { t } = useTranslation();
  const {
    prompt,
    symmetryMode,
    artStyle,
    targetPolycount,
    isProcessing,
    onChangePrompt,
    onChangeSymmetryMode,
    onChangeArtStyle,
    onChangeTargetPolycount,
    onSubmit
  } = props;

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
          <Textarea
            placeholder={t('ai.textPromptPlaceholder')}
            value={prompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            className="min-h-[120px]"
          />
        </div>

        <div className="space-y-4 p-4 bg-muted/5 rounded-lg">
          {/* Symmetry Mode */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.symmetryMode')}</label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant={symmetryMode === 'off' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChangeSymmetryMode('off')}
              >
                {t('ai.symmetryOff')}
              </Button>
              <Button
                variant={symmetryMode === 'auto' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChangeSymmetryMode('auto')}
              >
                {t('ai.symmetryAuto')}
              </Button>
              <Button
                variant={symmetryMode === 'on' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChangeSymmetryMode('on')}
              >
                {t('ai.symmetryOn')}
              </Button>
            </div>
          </div>

          {/* Art Style */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.artStyle')}</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={artStyle === 'realistic' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChangeArtStyle('realistic')}
              >
                {t('ai.styleRealistic')}
              </Button>
              <Button
                variant={artStyle === 'sculpture' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onChangeArtStyle('sculpture')}
              >
                {t('ai.styleSculpture')}
              </Button>
            </div>
          </div>

          {/* Target Polycount */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('ai.targetPolycount')}</label>
              <span className="text-sm text-muted-foreground">{targetPolycount.toLocaleString()}</span>
            </div>
            <Slider
              min={10000}
              max={50000}
              step={200}
              value={[targetPolycount]}
              onValueChange={(values) => onChangeTargetPolycount(values[0])}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10,000</span>
              <span>50,000</span>
            </div>
          </div>
        </div>

        <Button
          onClick={onSubmit}
          disabled={isProcessing || !prompt.trim()}
          className="w-full"
          size="lg"
        >
          {t('ai.generate')}
        </Button>
      </CardContent>
    </Card>
  );
}
