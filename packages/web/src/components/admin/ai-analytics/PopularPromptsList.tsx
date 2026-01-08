import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Box, Image, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PopularPrompt {
  prompt: string;
  generation_type: string;
  usage_count: number;
  success_rate: number;
}

interface PopularPromptsListProps {
  prompts: PopularPrompt[];
  loading?: boolean;
}

const typeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  text_to_3d: { label: 'Text→3D', icon: Box, color: 'text-violet-500' },
  image_to_3d: { label: 'Image→3D', icon: Image, color: 'text-pink-500' },
  text_to_image: { label: 'Text→Image', icon: Image, color: 'text-blue-500' },
};

export function PopularPromptsList({ prompts, loading }: PopularPromptsListProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            인기 프롬프트
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse p-3 rounded-lg border">
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-violet-500" />
          인기 프롬프트
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {prompts.map((prompt, index) => {
            const config = typeConfig[prompt.generation_type] || {
              label: prompt.generation_type,
              icon: Sparkles,
              color: 'text-gray-500',
            };
            const Icon = config.icon;

            return (
              <div
                key={`${prompt.prompt}-${index}`}
                className="p-3 rounded-lg border hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm flex-1 line-clamp-2">
                    "{prompt.prompt}"
                  </p>
                  <Badge variant="outline" className="shrink-0">
                    {prompt.usage_count}회
                  </Badge>
                </div>

                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn("h-4 w-4", config.color)} />
                    <span className="text-xs text-muted-foreground">
                      {config.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <CheckCircle
                      className={cn(
                        "h-4 w-4",
                        prompt.success_rate >= 80 ? "text-green-500" :
                        prompt.success_rate >= 50 ? "text-yellow-500" :
                        "text-red-500"
                      )}
                    />
                    <span className="text-xs text-muted-foreground">
                      성공률 {prompt.success_rate}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })}

          {prompts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>프롬프트 데이터가 없습니다</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default PopularPromptsList;
