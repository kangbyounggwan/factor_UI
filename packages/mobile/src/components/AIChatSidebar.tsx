import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Menu, 
  Plus, 
  MessageSquare, 
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Clock,
  Search,
  Trash2,
  Bot,
  Box,
  ClipboardList
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { chatService, type ChatSession } from "@/lib/chatService";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

interface AIChatSidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
  onNewChat: () => void;
  onSelectChat: (chatId: string) => void;
  currentChatId?: string;
  onSessionCreated?: () => void;
}

export const AIChatSidebar = ({ 
  isCollapsed, 
  onToggle, 
  onNewChat, 
  onSelectChat, 
  currentChatId,
  onSessionCreated
}: AIChatSidebarProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [openCategories, setOpenCategories] = useState<string[]>(['chatbot']); // 기본으로 챗봇 열어두기
  const { user } = useAuth();
  const { toast } = useToast();

  const loadChatSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      const sessions = await chatService.getUserChatSessions();
      setChatSessions(sessions);
    } catch (error) {
      console.error('Failed to load chat sessions:', error);
      toast({
        title: "오류",
        description: "채팅 기록을 불러오는데 실패했습니다.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  // 채팅 세션 로드
  useEffect(() => {
    if (user) {
      loadChatSessions();
    }
  }, [user, loadChatSessions]);

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      await chatService.deleteChatSession(sessionId);
      setChatSessions(prev => prev.filter(session => session.id !== sessionId));
      
      // 현재 선택된 세션을 삭제한 경우 새 채팅으로 이동
      if (currentChatId === sessionId) {
        onNewChat();
      }
      
      toast({
        title: "삭제 완료",
        description: "채팅이 삭제되었습니다."
      });
    } catch (error) {
      console.error('Failed to delete chat session:', error);
      toast({
        title: "삭제 실패",
        description: "채팅 삭제에 실패했습니다.",
        variant: "destructive"
      });
    }
  };

  // 외부에서 호출할 수 있도록 사이드바 새로고침 함수 제공
  const refreshSessions = () => {
    loadChatSessions();
  };

  // 채팅 카테고리 정의
  const chatCategories = [
    {
      id: 'chatbot',
      name: '챗봇',
      icon: Bot,
      filter: (session: ChatSession) => 
        !session.title.includes('보고서') && 
        !session.title.includes('3D') && 
        !session.title.includes('모델링') && 
        !session.title.includes('모델')
    },
    {
      id: 'modeling',
      name: '3D 모델링',
      icon: Box,
      filter: (session: ChatSession) => 
        session.title.includes('3D') || 
        session.title.includes('모델링') || 
        session.title.includes('모델')
    },
    {
      id: 'reports',
      name: '보고서',
      icon: ClipboardList,
      filter: (session: ChatSession) => 
        session.title.includes('보고서')
    }
  ];

  // 검색 필터링 및 카테고리별 분류
  const filteredSessions = chatSessions.filter(session =>
    session.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categorizedSessions = chatCategories.map(category => ({
    ...category,
    sessions: filteredSessions.filter(category.filter)
  }));

  // 카테고리 토글 함수
  const toggleCategory = (categoryId: string) => {
    setOpenCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}분 전`;
    if (hours < 24) return `${hours}시간 전`;
    return `${days}일 전`;
  };

  return (
    <div className={`
      ${isCollapsed ? "w-12" : "w-80"} 
      h-[calc(100vh-4rem)] 
      bg-background 
      border-r 
      transition-all 
      duration-300 
      flex 
      flex-col
      fixed
      left-0
      top-16
      z-40
    `}>
      {/* 상단 컨트롤 */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <h2 className="text-lg font-semibold">채팅 기록</h2>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggle}
            className="h-8 w-8 p-0"
          >
            {isCollapsed ? (
              <Menu className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {!isCollapsed && (
          <Button 
            onClick={onNewChat}
            className="w-full mt-3 justify-start"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            새 채팅
          </Button>
        )}
      </div>

      {/* 검색 (확장된 상태에서만) */}
      {!isCollapsed && (
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="채팅 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      )}

      {/* 채팅 목록 */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {isCollapsed ? (
            /* 축소된 상태 - 아이콘만 표시 */
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onNewChat}
                className="w-full h-8 p-0"
                title="새 채팅"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Separator />
              {categorizedSessions.map((category) => (
                category.sessions.length > 0 && (
                  <div key={category.id} className="space-y-1 mb-3">
                    {/* 카테고리 아이콘 */}
                    <div 
                      className="w-full h-6 rounded flex items-center justify-center bg-primary/10"
                      title={category.name}
                    >
                      <category.icon className="w-3 h-3 text-primary" />
                    </div>
                    
                    {/* 카테고리별 채팅 아이콘들 (최대 3개) */}
                    {category.sessions.slice(0, 3).map((session) => (
                      <Button
                        key={session.id}
                        variant={currentChatId === session.id ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => onSelectChat(session.id)}
                        className="w-full h-8 p-0"
                        title={session.title}
                      >
                        <MessageSquare className="h-4 w-4" />
                      </Button>
                    ))}
                  </div>
                )
              ))}
            </div>
          ) : (
            /* 확장된 상태 - 전체 정보 표시 */
            <div className="space-y-1">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
                  <p className="text-sm">채팅 기록을 불러오는 중...</p>
                </div>
              ) : filteredSessions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {searchQuery ? "검색 결과가 없습니다" : "채팅 기록이 없습니다"}
                  </p>
                </div>
              ) : (
                categorizedSessions.map((category) => (
                  <Collapsible 
                    key={category.id}
                    open={openCategories.includes(category.id)}
                    onOpenChange={() => toggleCategory(category.id)}
                  >
                    <div className="mb-2">
                      {/* 카테고리 헤더 - 클릭 가능한 토글 */}
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="w-full justify-between p-2 h-auto hover:bg-accent/50"
                        >
                          <div className="flex items-center gap-2">
                            <category.icon className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium text-foreground">
                              {category.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {category.sessions.length}
                            </span>
                          </div>
                          {openCategories.includes(category.id) ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                      
                      {/* 카테고리별 채팅 목록 - 접을 수 있는 콘텐츠 */}
                      <CollapsibleContent className="space-y-1 mt-1">
                        <div className={`space-y-1 ${openCategories.includes(category.id) ? 'max-h-none' : 'max-h-0 overflow-hidden'}`}>
                          {category.sessions.map((session) => (
                            <div key={session.id} className="group relative ml-6">
                              <Button
                                variant={currentChatId === session.id ? "secondary" : "ghost"}
                                onClick={() => onSelectChat(session.id)}
                                className="w-full p-2 h-auto justify-start text-left hover:bg-accent/50 pr-8 text-xs"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-1">
                                    <h3 className="text-xs font-medium truncate pr-2">
                                      {session.title}
                                    </h3>
                                    <div className="flex items-center text-xs text-muted-foreground">
                                      <Clock className="h-2 w-2 mr-1" />
                                      <span className="text-xs">{formatTimeAgo(session.last_message_at)}</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs text-muted-foreground">
                                      {session.message_count}개 메시지
                                    </span>
                                  </div>
                                </div>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleDeleteSession(session.id, e)}
                                className="absolute right-1 top-1/2 -translate-y-1/2 h-5 w-5 p-0 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="h-2 w-2" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};