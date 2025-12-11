import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, Mic, MicOff, Loader2, Sparkles, Calendar, FileText, BarChart3, ClipboardList, Box, Image, Archive, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { chatService, type ChatMessage } from "@/lib/chatService";
import { useAuth } from "@shared/contexts/AuthContext";
import { getUserPlan } from "@shared/services/supabaseService/subscription";
import { hasAiAssistantAccess } from "@shared/utils/subscription";
import type { SubscriptionPlan } from "@shared/types/subscription";
import { UpgradePrompt } from "@/components/Settings/UpgradePrompt";
import { useTranslation } from "react-i18next";

interface AIAssistantSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export const AIAssistantSidebar = ({ isCollapsed, onToggle, width, onWidthChange }: AIAssistantSidebarProps) => {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string>();
  const [selectedFeature, setSelectedFeature] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  // 구독 플랜 및 AI 어시스턴트 접근 권한
  const [userPlan, setUserPlan] = useState<SubscriptionPlan>('free');
  const [hasAiAccess, setHasAiAccess] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 사용자 플랜 로드 및 AI 어시스턴트 접근 권한 체크
  useEffect(() => {
    const loadUserPlan = async () => {
      if (!user) return;
      try {
        const plan = await getUserPlan(user.id);
        setUserPlan(plan);
        const hasAccess = hasAiAssistantAccess(plan);
        setHasAiAccess(hasAccess);
      } catch (error) {
        console.error('[AI] Error loading user plan:', error);
      }
    };
    loadUserPlan();
  }, [user]);

  const handleSendMessage = async (messageText?: string) => {
    // AI 어시스턴트 접근 권한 체크
    if (!hasAiAccess) {
      setShowUpgradePrompt(true);
      return;
    }

    const textToSend = messageText || inputMessage;
    if (!textToSend.trim() || isLoading || !user) return;

    const finalText = selectedFeature 
      ? getFeaturePrompt(selectedFeature, textToSend)
      : textToSend;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      session_id: currentChatId || '',
      user_id: user.id,
      type: 'user',
      content: finalText,
      created_at: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setSelectedFeature(null);
    setIsLoading(true);

    try {
      let sessionId = currentChatId;
      
      if (!sessionId) {
        const title = chatService.generateSessionTitle(textToSend);
        const newSession = await chatService.createChatSession(title);
        sessionId = newSession.id;
        setCurrentChatId(sessionId);
      }

      await chatService.addChatMessage(sessionId, 'user', finalText);

      // AI 응답 시뮬레이션
      setTimeout(async () => {
        let aiResponseContent = '';
        
        if (finalText.includes('[보고서 생성 모드]')) {
          aiResponseContent = `[보고서 생성 모드] 

# 3D 프린터 운영 보고서

## 요약
현재 프린터 팜의 전반적인 상태는 양호하며, 3대 중 2대가 정상 작동 중입니다.

## 상세 분석
### 프린터 상태
- **프린터 A**: 정상 작동 (가동률 95%)
- **프린터 B**: 정상 작동 (가동률 88%)  
- **프린터 C**: 점검 필요 (노즐 교체 권장)

### 생산성 지표
- 일일 평균 출력: 12개
- 성공률: 92%
- 재료 소비량: 1.2kg/일`;
        } else if (finalText.includes('[3D 모델링 지원]')) {
          aiResponseContent = `[3D 모델링 지원] 

3D 모델링에 대한 조언을 드리겠습니다. 

**모델링 팁:**
- 벽 두께는 최소 0.8mm 이상 권장
- 오버행은 45도 이하로 설계
- 서포트가 필요한 부분 미리 고려

**프린팅 설정:**
- 레이어 높이: 0.2mm
- 인필 밀도: 20%
- 프린팅 속도: 50mm/s`;
        } else if (finalText.includes('[이미지 분석/설명]')) {
          aiResponseContent = `[이미지 분석/설명] 

웹 인터페이스를 생성했습니다. 

**생성된 콘텐츠:**
- 반응형 대시보드 레이아웃
- 실시간 데이터 차트
- 인터랙티브 컨트롤 패널`;
        } else {
          aiResponseContent = '안녕하세요! FACTOR AI 어시스턴트입니다. 3D 프린터 관련 질문이나 보고서, 모델링, 이미지 기능을 테스트해보세요.';
        }
        
        const aiResponse: ChatMessage = {
          id: (Date.now() + 1).toString(),
          session_id: sessionId!,
          user_id: user.id,
          type: 'ai',
          content: aiResponseContent,
          created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, aiResponse]);
        
        try {
          await chatService.addChatMessage(sessionId!, 'ai', aiResponseContent);
        } catch (error) {
          console.error('Failed to save AI message:', error);
        }
        
        setIsLoading(false);
      }, 1500);
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: "오류 발생",
        description: "메시지 전송 중 오류가 발생했습니다.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoiceInput = () => {
    if (!isListening) {
      setIsListening(true);
      toast({
        title: "음성 인식",
        description: "음성 인식 기능은 준비 중입니다.",
      });
      setTimeout(() => setIsListening(false), 3000);
    } else {
      setIsListening(false);
    }
  };

  const handleFeatureSelect = (feature: string) => {
    setSelectedFeature(selectedFeature === feature ? null : feature);
  };

  const getFeaturePrompt = (feature: string, userInput: string) => {
    switch (feature) {
      case 'report':
        return `[보고서 생성 모드] 다음 주제로 전문적인 보고서를 작성해주세요: ${userInput}`;
      case 'modeling':
        return `[3D 모델링 지원] 3D 프린터와 모델링에 관한 다음 질문에 답해주세요: ${userInput}`;
      case 'image':
        return `[이미지 분석/설명] 다음과 관련된 이미지 설명이나 시각적 도움이 필요합니다: ${userInput}`;
      default:
        return userInput;
    }
  };

  const additionalFeatures = [
    {
      id: 'report',
      name: '보고서',
      icon: ClipboardList,
      description: '전문적인 보고서 생성'
    },
    {
      id: 'modeling',
      name: '모델링',
      icon: Box,
      description: '3D 모델링 지원'
    },
    {
      id: 'image',
      name: '이미지',
      icon: Image,
      description: '이미지 생성 및 분석'
    }
  ];

  const quickQuestions = [
    {
      icon: BarChart3,
      text: "현재 모든 프린터 상태를 알려주세요",
      category: "상태확인"
    },
    {
      icon: FileText,
      text: "프린터 문제 해결 방법",
      category: "문제해결"
    },
    {
      icon: Calendar,
      text: "필라멘트 교체 방법",
      category: "유지보수"
    },
  ];

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const calculatedWidth = window.innerWidth - e.clientX;
    const minWidth = 280;
    const maxWidth = Math.min(720, window.innerWidth * 0.6);
    
    const finalWidth = Math.max(minWidth, Math.min(maxWidth, calculatedWidth));
    onWidthChange(finalWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  if (isCollapsed) {
    return (
      <div className="fixed right-0 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={onToggle}
          variant="secondary"
          size="sm"
          className="rounded-l-lg rounded-r-none shadow-lg flex items-center gap-1 pr-3"
          title={t('ai.openAssistant', 'AI 어시스턴트 열기')}
        >
          <ChevronLeft className="w-4 h-4" />
          <Bot className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div
      className="fixed right-0 top-16 h-[calc(100vh-4rem)] bg-background border-l-2 border-border shadow-lg z-40 flex flex-col"
      style={{ width: `${width}px` }}
    >
      {/* 리사이즈 핸들 */}
      <div 
        className={`absolute left-0 top-0 w-1 h-full cursor-col-resize transition-all duration-200 z-50 ${
          isResizing 
            ? 'bg-primary w-2 shadow-lg' 
            : 'bg-border hover:bg-primary/50 hover:w-2'
        }`}
        onMouseDown={handleMouseDown}
      />
      <div 
        className="absolute -left-2 top-0 w-4 h-full cursor-col-resize z-50 flex items-center justify-center group"
        onMouseDown={handleMouseDown}
      >
        {/* 핸들 아이콘 */}
        <div className={`w-1 h-8 rounded-full transition-all duration-200 ${
          isResizing 
            ? 'bg-primary scale-110 shadow-md' 
            : 'bg-muted-foreground/30 group-hover:bg-primary/70 group-hover:scale-105'
        }`} />
      </div>
      {/* 닫기 버튼 - 사이드바 왼쪽 중앙에 위치 */}
      <div className="absolute -left-10 top-1/2 -translate-y-1/2 z-50">
        <Button
          onClick={onToggle}
          variant="secondary"
          size="sm"
          className="rounded-l-lg rounded-r-none shadow-lg flex items-center gap-1 pl-3"
          title={t('ai.closeAssistant', 'AI 어시스턴트 닫기')}
        >
          <Bot className="w-4 h-4" />
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      {/* 헤더 */}
      <div className="flex items-center gap-2 p-4 border-b border-border bg-card">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">AI 어시스턴트</h3>
          <p className="text-xs text-muted-foreground">실시간 지원</p>
        </div>
      </div>

      {/* 메시지 영역 */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="flex justify-center mb-3">
                <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl">
                  <Bot className="w-8 h-8 text-primary" />
                </div>
              </div>
              <h4 className="font-semibold mb-2">AI 어시스턴트</h4>
              <p className="text-sm text-muted-foreground">
                프린터 관리를 도와드립니다
              </p>
            </div>

            {/* 빠른 질문 */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">빠른 질문</p>
              {quickQuestions.map((question, index) => {
                const Icon = question.icon;
                return (
                  <Button
                    key={index}
                    variant="outline"
                    onClick={() => handleQuickQuestion(question.text)}
                    className="w-full p-3 h-auto text-left justify-start text-xs"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-left">{question.text}</span>
                    </div>
                  </Button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                {message.type === 'ai' && (
                  <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <Bot className="w-3 h-3 text-primary" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  message.type === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-accent'
                }`}>
                  <div className="whitespace-pre-wrap">{message.content}</div>
                </div>
                {message.type === 'user' && (
                  <div className="w-6 h-6 bg-muted rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                    <User className="w-3 h-3" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-3 h-3 text-primary" />
                </div>
                <div className="bg-accent rounded-lg px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* 입력 영역 */}
      <div className="p-4 border-t border-border">
        {/* 기능 버튼들 */}
        <div className="flex gap-1 mb-3">
          {additionalFeatures.map((feature) => {
            const Icon = feature.icon;
            const isActive = selectedFeature === feature.id;
            return (
              <button
                key={feature.id}
                onClick={() => handleFeatureSelect(feature.id)}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                }`}
                title={feature.description}
              >
                <Icon className="w-3 h-3" />
                <span>{feature.name}</span>
              </button>
            );
          })}
        </div>

        {/* 입력창 */}
        <div className="relative">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              selectedFeature 
                ? `${additionalFeatures.find(f => f.id === selectedFeature)?.name} 관련 질문...`
                : "메시지를 입력하세요..."
            }
            disabled={isLoading}
            className="pr-20"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={isListening ? "default" : "ghost"}
              onClick={toggleVoiceInput}
              className="h-8 w-8 p-0"
            >
              {isListening ? (
                <MicOff className="w-3 h-3" />
              ) : (
                <Mic className="w-3 h-3" />
              )}
            </Button>
            <Button 
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              size="sm"
              className="h-8 w-8 p-0"
            >
              <Send className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* AI 어시스턴트 접근 제한 오버레이 */}
      {!hasAiAccess && (
        <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-sm">
            <div className="flex justify-center">
              <div className="p-4 bg-muted rounded-full">
                <Lock className="w-12 h-12 text-muted-foreground" />
              </div>
            </div>
            <h3 className="text-lg font-semibold">{t('subscription.aiAssistant')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('subscription.featureRequiresPlan', { plan: 'Enterprise' })}
            </p>
            <Button onClick={() => setShowUpgradePrompt(true)} className="w-full">
              <Sparkles className="w-4 h-4 mr-2" />
              {t('subscription.viewPlans')}
            </Button>
          </div>
        </div>
      )}

      {/* 업그레이드 프롬프트 */}
      <UpgradePrompt
        open={showUpgradePrompt}
        onOpenChange={setShowUpgradePrompt}
        feature={t('subscription.aiAssistant')}
        requiredPlan="enterprise"
        currentPlan={userPlan}
      />
    </div>
  );
};