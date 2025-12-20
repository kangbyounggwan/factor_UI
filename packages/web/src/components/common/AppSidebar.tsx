/**
 * 앱 사이드바 컴포넌트
 * AI Chat, Dashboard, Settings 등에서 재사용 가능한 사이드바
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Menu,
  PenSquare,
  MessageSquare,
  Trash2,
  LogIn,
  LogOut,
  Activity,
  Settings,
  Sparkles,
  Rocket,
  Crown,
  Building2,
  User as UserIcon,
  Shield,
  CreditCard,
  Bell,
  Key,
  Box,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import type { SubscriptionPlan } from "@shared/types/subscription";
import type { AIGeneratedModel } from "@shared/types/aiModelType";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  files?: { name: string; type: string }[];
}

export interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
  metadata?: Record<string, unknown>;
}

// Settings 탭 타입
export type SettingsTab = 'profile' | 'account' | 'subscription' | 'notifications' | 'api-keys';

interface AppSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  sessions?: ChatSession[];
  currentSessionId?: string | null;
  onNewChat?: () => void;
  onLoadSession?: (session: ChatSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  user: User | null;
  userPlan?: SubscriptionPlan;
  onLoginClick?: () => void;
  onSignOut?: () => void;
  mode?: 'chat' | 'dashboard' | 'settings' | 'create'; // 사이드바 모드
  // Settings 모드용 props
  activeSettingsTab?: SettingsTab;
  onSettingsTabChange?: (tab: SettingsTab) => void;
  // Create 모드용 props (3D 모델 아카이브)
  generatedModels?: AIGeneratedModel[];
  currentModelId?: string | null;
  onSelectModel?: (model: AIGeneratedModel) => void;
  onDeleteModel?: (modelId: string) => void;
}

// 플랜별 표시 설정
const planConfig: Record<SubscriptionPlan, { label: string; icon: typeof Sparkles; colors: string }> = {
  free: {
    label: 'Free',
    icon: Sparkles,
    colors: 'from-blue-500/10 via-purple-500/10 to-pink-500/10 border-purple-500/20 hover:border-purple-500/40',
  },
  starter: {
    label: 'Starter',
    icon: Rocket,
    colors: 'from-sky-500/10 via-blue-500/10 to-indigo-500/10 border-blue-500/30 hover:border-blue-500/50',
  },
  pro: {
    label: 'Pro',
    icon: Crown,
    colors: 'from-amber-500/10 via-orange-500/10 to-yellow-500/10 border-amber-500/30 hover:border-amber-500/50',
  },
  enterprise: {
    label: 'Enterprise',
    icon: Building2,
    colors: 'from-emerald-500/10 via-teal-500/10 to-cyan-500/10 border-emerald-500/30 hover:border-emerald-500/50',
  },
};


export function AppSidebar({
  isOpen,
  onToggle,
  sessions = [],
  currentSessionId = null,
  onNewChat,
  onLoadSession,
  onDeleteSession,
  user,
  userPlan = 'free',
  onLoginClick,
  onSignOut,
  mode = 'chat',
  activeSettingsTab = 'profile',
  onSettingsTabChange,
  // Create 모드용 props
  generatedModels = [],
  currentModelId = null,
  onSelectModel,
  onDeleteModel,
}: AppSidebarProps) {
  const { t } = useTranslation();

  // userPlan이 undefined이거나 planConfig에 없는 경우 'free'로 fallback
  const safePlan = userPlan && planConfig[userPlan] ? userPlan : 'free';
  const currentPlanConfig = planConfig[safePlan];
  const PlanIcon = currentPlanConfig.icon;

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onDeleteSession?.(sessionId);
  };

  return (
    <>
      {/* 사이드바 */}
      <div
        className={cn(
          "h-full bg-muted/50 border-r-2 border-border flex flex-col transition-all duration-300 shrink-0 shadow-sm",
          isOpen ? "w-80" : "w-0 overflow-hidden"
        )}
      >
        {/* 사이드바 헤더 - 메인 헤더와 높이 맞춤 */}
        <div className="h-14 px-3 flex items-center justify-between border-b border-border/50">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full"
            onClick={onToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>
          {mode === 'chat' && onNewChat && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full"
              onClick={onNewChat}
              title={t('aiChat.newChat', '새 채팅')}
            >
              <PenSquare className="w-5 h-5" />
            </Button>
          )}
        </div>

        {/* 사이드바 내용 - 모드에 따라 다르게 표시 */}
        <div className="flex-1 overflow-y-auto p-3 min-h-0">
          {mode === 'chat' ? (
            <>
              <p className="text-sm font-semibold text-foreground px-2 py-2">
                {t('aiChat.recentChats', '최근 대화')}
              </p>
              {sessions.length === 0 ? (
                <div className="px-2 py-4 space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    {t('aiChat.noHistory', '대화 기록이 없습니다')}
                  </p>
                  {/* 비로그인 시 대화 저장 안내 */}
                  {!user && (
                    <div className="bg-muted/80 border border-border rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">
                        {t('aiChat.loginBenefit', '로그인하면 대화 기록을 저장하고 나중에 다시 볼 수 있습니다.')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      onClick={() => onLoadSession?.(session)}
                      className={cn(
                        "group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors",
                        currentSessionId === session.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <MessageSquare className="w-4 h-4 shrink-0" />
                      <span className="flex-1 text-sm truncate">{session.title}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => handleDelete(session.id, e)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : mode === 'settings' ? (
            /* Settings 모드 - 설정 메뉴 */
            <>
              <p className="text-sm font-semibold text-foreground px-2 py-2">
                {t('userSettings.title', '사용자 설정')}
              </p>
              <nav className="space-y-1">
                <button
                  onClick={() => onSettingsTabChange?.('profile')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeSettingsTab === 'profile'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <UserIcon className="h-4 w-4 shrink-0" />
                  <span>{t("userSettings.profile", "프로필")}</span>
                </button>

                <button
                  onClick={() => onSettingsTabChange?.('account')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeSettingsTab === 'account'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span>{t("userSettings.account", "계정")}</span>
                </button>

                <button
                  onClick={() => onSettingsTabChange?.('subscription')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeSettingsTab === 'subscription'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span>{t("userSettings.subscription", "구독")}</span>
                </button>

                <button
                  onClick={() => onSettingsTabChange?.('notifications')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeSettingsTab === 'notifications'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Bell className="h-4 w-4 shrink-0" />
                  <span>{t("userSettings.notifications", "알림")}</span>
                </button>

                <button
                  onClick={() => onSettingsTabChange?.('api-keys')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    activeSettingsTab === 'api-keys'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Key className="h-4 w-4 shrink-0" />
                  <span>{t("userSettings.apiKeys", "API 키")}</span>
                </button>
              </nav>
            </>
          ) : mode === 'create' ? (
            /* Create 모드 - 3D 모델 아카이브 */
            <>
              <p className="text-sm font-semibold text-foreground px-2 py-2">
                {t('ai.modelArchive', '모델 아카이브')}
              </p>
              {generatedModels.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {t('ai.noModels', '생성된 모델이 없습니다')}
                </p>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="space-y-1">
                    {generatedModels.map((model) => (
                      <div
                        key={model.id}
                        className={cn(
                          "group flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors",
                          currentModelId === model.id
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-muted"
                        )}
                        onClick={() => onSelectModel?.(model)}
                      >
                        {/* 썸네일 */}
                        <div className="w-10 h-10 rounded-md overflow-hidden bg-muted flex-shrink-0">
                          {model.thumbnail_url ? (
                            <img
                              src={model.thumbnail_url}
                              alt={model.prompt || '3D Model'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Box className="w-5 h-5 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        {/* 모델 정보 */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {model.prompt || t('ai.untitledModel', '제목 없음')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {model.created_at ? new Date(model.created_at).toLocaleDateString() : ''}
                          </p>
                        </div>
                        {/* 삭제 버튼 */}
                        {onDeleteModel && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteModel(model.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </>
          ) : (
            /* Dashboard 모드 - 빈 메뉴 영역 */
            <div className="px-2 py-4">
              <p className="text-sm text-muted-foreground text-center">
                {t('dashboard.sidebarPlaceholder', '메뉴 준비 중...')}
              </p>
            </div>
          )}
        </div>

      </div>

      {/* 토글 버튼 + 로고 - 사이드바 상태에 따라 위치 변경 */}
      <div className={cn(
        "absolute h-14 z-30 flex items-center gap-3 transition-all duration-300",
        isOpen ? "left-[21rem]" : "left-4"
      )}>
        {!isOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-full bg-background shadow-md border"
            onClick={onToggle}
          >
            <Menu className="w-5 h-5" />
          </Button>
        )}
        {/* FACTOR 로고 */}
        <Link to="/" className="flex items-center space-x-2.5">
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-3xl font-bold font-orbitron text-primary tracking-wide">
            FACTOR
          </span>
        </Link>
      </div>

      {/* 비로그인 시 하단 로그인 버튼 - 사이드바와 독립적으로 항상 표시 */}
      {!user && onLoginClick && (
        <div className="absolute left-4 bottom-4 z-10 w-72">
          <Button
            variant="default"
            className="w-full h-12 rounded-2xl shadow-lg gap-3 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium transition-all duration-300 hover:shadow-xl hover:scale-[1.02]"
            onClick={onLoginClick}
          >
            <LogIn className="w-5 h-5" />
            <span>{t('aiChat.loginToStart', '로그인하고 시작하기')}</span>
          </Button>
        </div>
      )}

      {/* 로그인 사용자용 하단 프로필 - 사이드바 열려있을 때만 표시 */}
      {user && isOpen && (
        <div className="absolute left-4 bottom-4 z-10 w-72 transition-all duration-300">
          <div className="flex items-center gap-2 h-14 rounded-2xl shadow-md bg-background border px-3">
            {/* 프로필 (아바타 + 이름) */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* 아바타 */}
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarImage src={user.user_metadata?.avatar_url} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {user.email?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              {/* 사용자 이름 */}
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate">
                  {user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'}
                </span>
                <span className="text-xs text-muted-foreground truncate">
                  {user.email}
                </span>
              </div>
            </div>
            {/* 구분선 */}
            <div className="w-px h-8 bg-border" />
            {/* 설정 아이콘 */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-muted transition-all shrink-0"
              asChild
            >
              <Link to="/user-settings">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </Link>
            </Button>
            {/* 로그아웃 아이콘 */}
            {onSignOut && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-full hover:bg-destructive/10 transition-all shrink-0"
                onClick={onSignOut}
              >
                <LogOut className="w-5 h-5 text-destructive" />
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default AppSidebar;

// 하위 호환성을 위한 별칭 (deprecated)
export { AppSidebar as AIChatSidebar };
