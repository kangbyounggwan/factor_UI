/**
 * G-Code Analysis Chat Component
 * Gemini 대화를 통해 정보 수집 후 분석 진행
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import {
    Upload,
    Send,
    FileCode2,
    Loader2,
    CheckCircle,
    AlertCircle,
    Download,
    Bot,
    User,
    Sparkles,
    ThumbsUp,
    ThumbsDown,
} from 'lucide-react';

import {
    chatForGCodeAnalysis,
    getInitialGCodeChatMessage,
} from '@shared/services/geminiService';
import {
    startGCodeAnalysis,
    subscribeToAnalysisStream,
    approvePatch,
    downloadAndSaveGCode,
} from '@shared/services/gcodeAnalysisService';
import type {
    ChatMessage,
    CollectedInfo,
    TimelineStep,
    AnalysisResult,
    GCodeAnalysisRequest,
} from '@shared/types/gcodeAnalysisTypes';

interface GCodeAnalysisChatProps {
    userId?: string;
}

export function GCodeAnalysisChat({ userId }: GCodeAnalysisChatProps) {
    const { t } = useTranslation();
    const { toast } = useToast();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    // G-code state
    const [gcodeContent, setGcodeContent] = useState<string | null>(null);
    const [gcodeFileName, setGcodeFileName] = useState<string | null>(null);
    const [collectedInfo, setCollectedInfo] = useState<CollectedInfo>({});

    // Analysis state
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisId, setAnalysisId] = useState<string | null>(null);
    const [progress, setProgress] = useState(0);
    const [timeline, setTimeline] = useState<TimelineStep[]>([]);
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [patchApproved, setPatchApproved] = useState<boolean | null>(null);

    // Gemini 대화 컨텍스트
    const [chatContext, setChatContext] = useState<Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>>([]);

    // 스크롤 자동 이동
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // 메시지 추가 헬퍼
    const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
        const newMessage: ChatMessage = {
            id: `msg_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            role,
            content,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, newMessage]);

        // Gemini 컨텍스트 업데이트
        setChatContext(prev => [
            ...prev,
            { role: role === 'user' ? 'user' : 'model', parts: [{ text: content }] }
        ]);
    }, []);

    // G-code 파일 업로드
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            setGcodeContent(content);
            setGcodeFileName(file.name);

            // 초기 인사 메시지
            const greeting = getInitialGCodeChatMessage(file.name);
            addMessage('assistant', greeting);

            toast({
                title: 'G-code 파일 로드 완료',
                description: `${file.name} (${(file.size / 1024).toFixed(1)}KB)`,
            });
        } catch (error) {
            toast({
                title: '파일 로드 실패',
                description: '파일을 읽을 수 없습니다.',
                variant: 'destructive',
            });
        }

        // 입력 초기화
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // 메시지 전송
    const handleSendMessage = async () => {
        if (!inputValue.trim() || isTyping || isAnalyzing) return;

        const userMessage = inputValue.trim();
        setInputValue('');
        addMessage('user', userMessage);

        // 파일이 없으면 파일 요청
        if (!gcodeContent) {
            addMessage('assistant', 'G-code 파일을 먼저 업로드해 주세요. 📁 위의 "파일 선택" 버튼을 클릭해 주세요.');
            return;
        }

        setIsTyping(true);

        try {
            const result = await chatForGCodeAnalysis(userMessage, {
                messages: chatContext,
                collectedInfo,
                gcodeFileName: gcodeFileName || undefined,
            });

            addMessage('assistant', result.response);
            setCollectedInfo(result.collectedInfo);

            // 분석 준비 완료 시 자동 시작
            if (result.readyToAnalyze) {
                await startAnalysis();
            }
        } catch (error) {
            addMessage('assistant', '죄송합니다. 오류가 발생했습니다. 다시 시도해 주세요.');
        } finally {
            setIsTyping(false);
        }
    };

    // 분석 시작
    const startAnalysis = async () => {
        if (!gcodeContent) return;

        setIsAnalyzing(true);
        setProgress(0);
        setTimeline([]);
        setAnalysisResult(null);

        addMessage('assistant', '🔍 G-code 분석을 시작합니다...');

        try {
            const request: GCodeAnalysisRequest = {
                gcode_content: gcodeContent,
                user_id: userId,
                printer_info: collectedInfo.printerName ? {
                    name: collectedInfo.printerName,
                    model: collectedInfo.printerModel,
                    nozzle_diameter: collectedInfo.nozzleDiameter,
                    max_temp_nozzle: collectedInfo.maxTempNozzle,
                    max_temp_bed: collectedInfo.maxTempBed,
                    build_volume: collectedInfo.buildVolume,
                } : undefined,
                filament_type: collectedInfo.filamentType,
            };

            const response = await startGCodeAnalysis(request);
            setAnalysisId(response.analysis_id);

            // SSE 스트리밍 구독
            subscribeToAnalysisStream(response.analysis_id, {
                onTimeline: (event) => {
                    setTimeline(prev => {
                        const existing = prev.find(t => t.step === event.step);
                        if (existing) {
                            return prev.map(t => t.step === event.step ? event : t);
                        }
                        return [...prev, event];
                    });
                },
                onProgress: (event) => {
                    setProgress(event.progress * 100);
                },
                onComplete: (event) => {
                    setIsAnalyzing(false);
                    setProgress(100);
                    setAnalysisResult({
                        final_summary: event.final_summary,
                        issues_found: event.issues_found,
                        patch_plan: event.patch_plan,
                        token_usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
                    });

                    // 결과 요약 메시지
                    const summary = event.final_summary;
                    const resultMessage = `✅ **분석 완료!**

📊 **품질 점수**: ${summary.overall_quality_score}/100
🔍 **발견된 이슈**: ${summary.total_issues_found}개 (심각: ${summary.critical_issues}개)

${summary.summary}

${summary.patch_available ? `\n🔧 **${summary.patch_count}개의 수정 패치**가 준비되었습니다.\n아래에서 승인/거부를 선택해 주세요.` : ''}`;

                    addMessage('assistant', resultMessage);
                },
                onError: (event) => {
                    setIsAnalyzing(false);
                    addMessage('assistant', `❌ 분석 중 오류가 발생했습니다: ${event.error}`);
                },
            });
        } catch (error) {
            setIsAnalyzing(false);
            addMessage('assistant', '❌ 분석 요청에 실패했습니다. 서버 연결을 확인해 주세요.');
        }
    };

    // 패치 승인
    const handleApprovePatch = async (approved: boolean) => {
        if (!analysisId) return;

        try {
            await approvePatch(analysisId, { approved, selected_patches: null });
            setPatchApproved(approved);

            if (approved) {
                addMessage('assistant', '✅ 패치가 승인되었습니다! 수정된 G-code를 다운로드할 수 있습니다.');
            } else {
                addMessage('assistant', '❌ 패치가 거부되었습니다. 원본 G-code를 그대로 사용하세요.');
            }
        } catch (error) {
            toast({
                title: '패치 처리 실패',
                variant: 'destructive',
            });
        }
    };

    // 수정된 G-code 다운로드
    const handleDownload = async () => {
        if (!analysisId || !gcodeFileName) return;

        try {
            const patchedName = gcodeFileName.replace('.gcode', '_patched.gcode');
            await downloadAndSaveGCode(analysisId, patchedName);
            toast({ title: '다운로드 완료' });
        } catch (error) {
            toast({ title: '다운로드 실패', variant: 'destructive' });
        }
    };

    // 바로 분석 버튼
    const handleQuickAnalyze = () => {
        if (gcodeContent && !isAnalyzing) {
            addMessage('user', '바로 분석');
            startAnalysis();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-4 border-b shrink-0">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <FileCode2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="font-semibold">G-code 분석 AI</h2>
                        {gcodeFileName && (
                            <p className="text-sm text-muted-foreground">{gcodeFileName}</p>
                        )}
                    </div>
                </div>

                {/* 파일 업로드 */}
                <div className="flex gap-2">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".gcode,.gc,.nc"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isAnalyzing}
                    >
                        <Upload className="w-4 h-4 mr-2" />
                        파일 선택
                    </Button>
                    {gcodeContent && !isAnalyzing && !analysisResult && (
                        <Button size="sm" onClick={handleQuickAnalyze}>
                            <Sparkles className="w-4 h-4 mr-2" />
                            바로 분석
                        </Button>
                    )}
                </div>
            </div>

            {/* 수집된 정보 요약 */}
            {Object.keys(collectedInfo).length > 0 && (
                <div className="px-4 py-2 border-b bg-muted/30 flex gap-2 flex-wrap shrink-0">
                    {collectedInfo.printerName && (
                        <Badge variant="secondary">🖨️ {collectedInfo.printerName}</Badge>
                    )}
                    {collectedInfo.filamentType && (
                        <Badge variant="secondary">🧵 {collectedInfo.filamentType}</Badge>
                    )}
                    {collectedInfo.nozzleDiameter && (
                        <Badge variant="secondary">⚙️ {collectedInfo.nozzleDiameter}mm</Badge>
                    )}
                </div>
            )}

            {/* 채팅 메시지 영역 */}
            <ScrollArea className="flex-1 p-4">
                <div className="space-y-4">
                    {messages.length === 0 && !gcodeContent && (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileCode2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>G-code 파일을 업로드하면<br />AI가 분석을 도와드립니다.</p>
                        </div>
                    )}

                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                            {msg.role === 'assistant' && (
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Bot className="w-4 h-4 text-primary" />
                                </div>
                            )}
                            <div
                                className={`max-w-[80%] rounded-lg px-4 py-2 ${msg.role === 'user'
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted'
                                    }`}
                            >
                                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                            </div>
                            {msg.role === 'user' && (
                                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                                    <User className="w-4 h-4" />
                                </div>
                            )}
                        </div>
                    ))}

                    {/* 타이핑 표시 */}
                    {isTyping && (
                        <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                <Bot className="w-4 h-4 text-primary" />
                            </div>
                            <div className="bg-muted rounded-lg px-4 py-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                        </div>
                    )}

                    {/* 분석 진행률 */}
                    {isAnalyzing && (
                        <Card className="mt-4">
                            <CardContent className="pt-4">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm">
                                        <span>분석 중...</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                    <Progress value={progress} />
                                    <div className="space-y-1">
                                        {timeline.map((step) => (
                                            <div key={step.step} className="flex items-center gap-2 text-sm">
                                                {step.status === 'done' && <CheckCircle className="w-4 h-4 text-green-500" />}
                                                {step.status === 'running' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                                                {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2" />}
                                                {step.status === 'error' && <AlertCircle className="w-4 h-4 text-destructive" />}
                                                <span className={step.status === 'done' ? 'text-muted-foreground' : ''}>{step.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 패치 승인 UI */}
                    {analysisResult?.patch_plan && analysisResult.patch_plan.total_patches > 0 && patchApproved === null && (
                        <Card className="mt-4">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base">패치 승인</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground mb-4">
                                    {analysisResult.patch_plan.total_patches}개의 수정 사항이 있습니다.
                                    예상 개선율: {analysisResult.patch_plan.estimated_improvement}%
                                </p>
                                <div className="flex gap-2">
                                    <Button onClick={() => handleApprovePatch(true)} className="flex-1">
                                        <ThumbsUp className="w-4 h-4 mr-2" />
                                        승인
                                    </Button>
                                    <Button variant="outline" onClick={() => handleApprovePatch(false)} className="flex-1">
                                        <ThumbsDown className="w-4 h-4 mr-2" />
                                        거부
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* 다운로드 버튼 */}
                    {patchApproved === true && (
                        <div className="flex justify-center mt-4">
                            <Button onClick={handleDownload} size="lg">
                                <Download className="w-4 h-4 mr-2" />
                                수정된 G-code 다운로드
                            </Button>
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>
            </ScrollArea>

            {/* 입력 영역 */}
            <div className="p-4 border-t shrink-0">
                <div className="flex gap-2">
                    <Input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                        placeholder={gcodeContent ? "메시지를 입력하세요..." : "먼저 G-code 파일을 업로드하세요"}
                        disabled={isTyping || isAnalyzing || !gcodeContent}
                    />
                    <Button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isTyping || isAnalyzing || !gcodeContent}
                    >
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}

export default GCodeAnalysisChat;
