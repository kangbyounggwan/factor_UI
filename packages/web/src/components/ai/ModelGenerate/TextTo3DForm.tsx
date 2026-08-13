import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Loader2, Sparkles, Wand2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

type SymmetryMode = 'off' | 'auto' | 'on';
type ArtStyle = 'realistic' | 'sculpture';

const MAX_PROMPT_LENGTH = 500;

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

  const canSubmit = !isProcessing && prompt.trim().length > 0;

  // 폴리곤 수를 사용자가 이해할 수 있는 단계로 환산
  const polyLevel =
    targetPolycount < 22000 ? t('ai.polyLow')
      : targetPolycount < 38000 ? t('ai.polyMedium')
        : t('ai.polyHigh');

  const examples = [
    t('ai.promptExample1'),
    t('ai.promptExample2'),
    t('ai.promptExample3'),
    t('ai.promptExample4'),
  ];

  // Ctrl/Cmd + Enter 로 즉시 생성
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <Card className="lg:sticky top-4 max-h-[calc(85vh-4rem-2rem)] flex flex-col">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Wand2 className="w-5 h-5 text-primary" />
          {t('ai.textTo3DTitle')}
        </CardTitle>
        <CardDescription>{t('ai.textTo3DDescription')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5 flex-1 overflow-auto">
        {/* 프롬프트 입력 */}
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor="text-to-3d-prompt" className="text-sm font-medium">
              {t('ai.textPrompt')}
            </label>
            <span
              className={cn(
                "text-xs tabular-nums",
                prompt.length > MAX_PROMPT_LENGTH ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {prompt.length} / {MAX_PROMPT_LENGTH}
            </span>
          </div>
          <Textarea
            id="text-to-3d-prompt"
            placeholder={t('ai.textPromptPlaceholder')}
            value={prompt}
            onChange={(e) => onChangePrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={MAX_PROMPT_LENGTH}
            className="min-h-[120px] resize-none"
          />
          <p className="text-xs text-muted-foreground">{t('ai.submitShortcutHint')}</p>
        </div>

        {/* 예시 프롬프트 - 첫 사용자가 바로 시작할 수 있도록 */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t('ai.promptExamplesLabel')}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {examples.map((example) => (
              <button
                key={example}
                type="button"
                disabled={isProcessing}
                onClick={() => onChangePrompt(example)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border border-border",
                  "bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground",
                  "transition-colors hover:bg-accent hover:text-accent-foreground",
                  "disabled:pointer-events-none disabled:opacity-50"
                )}
              >
                <Sparkles className="h-3 w-3" />
                {example}
              </button>
            ))}
          </div>
        </div>

        {/* 생성 옵션 */}
        <div className="space-y-5 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('ai.optionsSectionTitle')}
          </p>

          {/* 대칭 모드 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.symmetryMode')}</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                ['off', t('ai.symmetryOff')],
                ['auto', t('ai.symmetryAuto')],
                ['on', t('ai.symmetryOn')],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  variant={symmetryMode === value ? 'default' : 'outline'}
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => onChangeSymmetryMode(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('ai.symmetryModeHint')}</p>
          </div>

          {/* 아트 스타일 */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ai.artStyle')}</label>
            <div className="grid grid-cols-2 gap-2">
              {([
                ['realistic', t('ai.styleRealistic')],
                ['sculpture', t('ai.styleSculpture')],
              ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  variant={artStyle === value ? 'default' : 'outline'}
                  size="sm"
                  disabled={isProcessing}
                  onClick={() => onChangeArtStyle(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{t('ai.artStyleHint')}</p>
          </div>

          {/* 목표 폴리곤 수 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('ai.targetPolycount')}</label>
              <span className="flex items-baseline gap-1.5">
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                  {polyLevel}
                </span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {targetPolycount.toLocaleString()}
                </span>
              </span>
            </div>
            <Slider
              min={10000}
              max={50000}
              step={200}
              value={[targetPolycount]}
              disabled={isProcessing}
              onValueChange={(values) => onChangeTargetPolycount(values[0])}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>10,000</span>
              <span>50,000</span>
            </div>
            <p className="text-xs text-muted-foreground">{t('ai.targetPolycountHint')}</p>
          </div>
        </div>
      </CardContent>

      {/* 하단 고정 생성 버튼 */}
      <div className="border-t border-border p-4">
        <Button
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('ai.generating')}
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              {t('ai.generate')}
            </>
          )}
        </Button>
      </div>
    </Card>
  );
}
