import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2, Box, Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "@/components/ui/use-toast";

interface TextToImageTabProps {
    prompt: string;
    setPrompt: (val: string) => void;
    isProcessing: boolean;
    generateImage: () => void;
    generatedImageUrl: string | null;
}

export function TextToImageTab({ prompt, setPrompt, isProcessing, generateImage, generatedImageUrl }: TextToImageTabProps) {
    const { t } = useTranslation();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-6 h-full">
            <Card className="lg:sticky top-4 max-h-[calc(85vh-4rem-2rem)] flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Camera className="w-5 h-5" />
                        {t('ai.imageGeneration')}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 overflow-auto">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">{t('ai.imageDescription')}</label>
                        <Textarea
                            placeholder={t('ai.imageDescriptionPlaceholder')}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="min-h-[120px]"
                        />
                    </div>

                    {/* 이미지 설정 */}
                    <div className="space-y-4 p-4 bg-muted/5 rounded-lg">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('ai.artStyle')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="default" size="sm">{t('ai.realistic')}</Button>
                                <Button variant="outline" size="sm">{t('ai.cartoon')}</Button>
                                <Button variant="outline" size="sm">{t('ai.abstract')}</Button>
                                <Button variant="outline" size="sm">{t('ai.pixelArt')}</Button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium">{t('ai.resolution')}</label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant="outline" size="sm">512x512</Button>
                                <Button variant="default" size="sm">1024x1024</Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
                {/* 하단 고정 버튼 */}
                <div className="p-6 pt-0 mt-auto">
                    <Button onClick={generateImage} className="w-full" size="lg" disabled={isProcessing || !prompt.trim()}>
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                {t('ai.generatingImage')}
                            </>
                        ) : (
                            <>
                                <Camera className="w-4 h-4 mr-2" />
                                {t('ai.generateImage')}
                            </>
                        )}
                    </Button>
                </div>
            </Card>

            <Card className="h-fit lg:sticky top-4">
                <CardContent className="p-0">
                    <div className="bg-gray-900 rounded-lg flex items-center justify-center h-[calc(85vh-4rem-2rem)] relative overflow-hidden">
                        {isProcessing ? (
                            <div className="flex flex-col items-center justify-center gap-4 z-10">
                                <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                <div className="text-center">
                                    <p className="text-lg font-medium text-white">{t('ai.processing')}</p>
                                    <p className="text-sm text-muted-foreground">{t('ai.pleaseWait')}</p>
                                </div>
                            </div>
                        ) : generatedImageUrl ? (
                            <img
                                src={generatedImageUrl}
                                alt="Generated"
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                                <div className="absolute inset-0" style={{
                                    backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                      linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                                    backgroundSize: '20px 20px'
                                }} />
                                <div className="text-center z-10">
                                    <Box className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                                    <p className="text-sm text-muted-foreground">{t('ai.generatedImagePlaceholder')}</p>
                                </div>
                            </div>
                        )}

                        {/* 이미지 다운로드 버튼 - 오른쪽 위 */}
                        {generatedImageUrl && !isProcessing && (
                            <div className="absolute top-4 right-4 z-20">
                                <Button
                                    onClick={async () => {
                                        try {
                                            toast({ title: t('ai.downloadStarted'), description: t('ai.downloadingImage') });
                                            const response = await fetch(generatedImageUrl);
                                            const blob = await response.blob();
                                            const url = window.URL.createObjectURL(blob);
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.download = `generated_image_${Date.now()}.png`;
                                            document.body.appendChild(link);
                                            link.click();
                                            document.body.removeChild(link);
                                            window.URL.revokeObjectURL(url);
                                            toast({ title: t('ai.downloadComplete'), description: t('ai.imageDownloaded') });
                                        } catch (error) {
                                            toast({ title: t('ai.downloadFailed'), variant: 'destructive' });
                                        }
                                    }}
                                    variant="secondary"
                                    size="sm"
                                    className="flex items-center gap-2 shadow-lg"
                                >
                                    <Download className="w-4 h-4" />
                                    Download
                                </Button>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

export default TextToImageTab;
