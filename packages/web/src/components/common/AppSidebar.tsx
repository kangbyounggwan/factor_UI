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
  LayoutGrid,
  FolderOpen,
  ChevronLeft,
  FileCode,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useNavigate } from "react-router-dom";
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

// PrinterDetail 탭 타입
export type PrinterDetailTab = 'all' | 'monitoring' | 'files' | 'settings';

// 보고서 아카이브 아이템 타입
export interface ReportArchiveItem {
  id: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  createdAt: Date;
}

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
  mode?: 'chat' | 'dashboard' | 'settings' | 'create' | 'printer-detail'; // 사이드바 모드
  // Settings 모드용 props
  activeSettingsTab?: SettingsTab;
  onSettingsTabChange?: (tab: SettingsTab) => void;
  // Create 모드용 props (3D 모델 아카이브)
  generatedModels?: AIGeneratedModel[];
  currentModelId?: string | null;
  onSelectModel?: (model: AIGeneratedModel) => void;
  onDeleteModel?: (modelId: string) => void;
  // PrinterDetail 모드용 props
  printerName?: string;
  printerUuid?: string;
  printerConnected?: boolean;
  activePrinterTab?: PrinterDetailTab;
  onPrinterTabChange?: (tab: PrinterDetailTab) => void;
  onBackClick?: () => void;
  // 보고서 아카이브용 props (chat 모드에서 사용)
  reports?: ReportArchiveItem[];
  currentReportId?: string | null;
  onSelectReport?: (report: ReportArchiveItem) => void;
  onDeleteReport?: (reportId: string) => void;
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
  // PrinterDetail 모드용 props
  printerName,
  printerUuid,
  printerConnected = false,
  activePrinterTab = 'all',
  onPrinterTabChange,
  onBackClick,
  // 보고서 아카이브용 props
  reports = [],
  currentReportId = null,
  onSelectReport,
  onDeleteReport,
}: AppSidebarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
        <div className="flex-1 flex flex-col p-3 min-h-0 overflow-hidden">
          {mode === 'chat' ? (
            <>
              {/* 보고서 아카이브 섹션 - 보고서가 있을 때만 표시 */}
              {reports.length > 0 && (
                <div className="shrink-0 mb-3">
                  <div className="flex items-center justify-between px-2 py-2">
                    <p className="text-sm font-semibold text-foreground">
                      {t('aiChat.reportArchive', '보고서 아카이브')}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => navigate('/gcode-analytics/archive')}
                    >
                      {t('aiChat.viewMore', '더보기')}
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    {reports.slice(0, 3).map((report) => (
                      <div
                        key={report.id}
                        onClick={() => onSelectReport?.(report)}
                        className={cn(
                          "group relative flex-1 p-2 rounded-lg cursor-pointer transition-all border",
                          currentReportId === report.id
                            ? "bg-primary/10 border-primary/30"
                            : "bg-muted/50 border-border hover:bg-muted hover:border-border/80"
                        )}
                      >
                        {/* 삭제 버튼 */}
                        {onDeleteReport && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100 transition-opacity z-10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteReport(report.id);
                            }}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </Button>
                        )}
                        {/* 점수 아이콘 */}
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 mx-auto",
                          report.overallGrade === 'S' ? "bg-violet-500/20 text-violet-600 dark:text-violet-400" :
                          report.overallGrade === 'A' ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" :
                          report.overallGrade === 'B' ? "bg-blue-500/20 text-blue-600 dark:text-blue-400" :
                          report.overallGrade === 'C' ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" :
                          "bg-red-500/20 text-red-600 dark:text-red-400"
                        )}>
                          <FileCode className="w-4 h-4" />
                        </div>
                        {/* 파일명 */}
                        <p className="text-xs font-medium truncate text-center" title={report.fileName}>
                          {report.fileName.replace(/\.gcode$/i, '').slice(0, 8)}
                        </p>
                        {/* 점수 */}
                        {report.overallScore !== undefined && (
                          <p className={cn(
                            "text-[10px] font-bold text-center mt-0.5",
                            report.overallGrade === 'S' ? "text-violet-600 dark:text-violet-400" :
                            report.overallGrade === 'A' ? "text-emerald-600 dark:text-emerald-400" :
                            report.overallGrade === 'B' ? "text-blue-600 dark:text-blue-400" :
                            report.overallGrade === 'C' ? "text-amber-600 dark:text-amber-400" :
                            "text-red-600 dark:text-red-400"
                          )}>
                            {report.overallGrade} · {report.overallScore}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 최근 대화 섹션 */}
              <p className="text-sm font-semibold text-foreground px-2 py-2 shrink-0">
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
                <ScrollArea className="flex-1 -mx-1 px-1">
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
                </ScrollArea>
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
          ) : mode === 'printer-detail' ? (
            /* PrinterDetail 모드 - 프린터 정보 + 탭 메뉴 */
            <>
              {/* 프린터 정보 + 연결 상태 구역 */}
              <div className="pb-4 mb-4 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={onBackClick}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  {/* 설비 이름 (왼쪽) */}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm truncate" title={printerName || t('printerDetail.defaultPrinterName', '프린터')}>
                      {printerName || t('printerDetail.defaultPrinterName', '프린터')}
                    </h2>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      {printerUuid ? `${printerUuid.substring(0, 12)}...` : 'N/A'}
                    </p>
                  </div>
                  {/* 연결 상태 (오른쪽) */}
                  {printerConnected ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 border border-green-500/20 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-xs font-medium">{t('printerDetail.connected', '연결됨')}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                      <span className="w-2 h-2 rounded-full bg-red-500" />
                      <span className="text-xs font-medium">{t('printerDetail.disconnected', '연결 끊김')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 탭 메뉴 */}
              <nav className="space-y-1">
                <button
                  onClick={() => onPrinterTabChange?.('all')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activePrinterTab === 'all'
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="h-4 w-4 shrink-0" />
                  <span>{t('printerDetail.monitoring', '모니터링')}</span>
                </button>

                <button
                  onClick={() => onPrinterTabChange?.('monitoring')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activePrinterTab === 'monitoring'
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Activity className="h-4 w-4 shrink-0" />
                  <span>{t('printerDetail.history', '히스토리')}</span>
                </button>

                <button
                  onClick={() => onPrinterTabChange?.('files')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activePrinterTab === 'files'
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <FolderOpen className="h-4 w-4 shrink-0" />
                  <span>{t('printerDetail.fileManagement', '파일 관리')}</span>
                </button>

                <button
                  onClick={() => onPrinterTabChange?.('settings')}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activePrinterTab === 'settings'
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>{t('printerDetail.settings', '설비 설정')}</span>
                </button>
              </nav>
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

        {/* 비로그인 시 하단 로그인 버튼 - 사이드바 내부 */}
        {!user && onLoginClick && (
          <div className="p-3 pt-0 shrink-0">
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

        {/* 로그인 사용자용 하단 프로필 - 사이드바 내부 */}
        {user && (
          <div className="p-3 pt-0 shrink-0">
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
        {/* FACTOR 로고 - 클릭 시 새 채팅 시작 */}
        <button
          onClick={() => {
            if (mode === 'chat' && onNewChat) {
              onNewChat();
            } else {
              window.location.href = '/ai-chat';
            }
          }}
          className="flex items-center space-x-2.5 cursor-pointer"
        >
          <div className="flex items-center justify-center w-8 h-8 bg-primary rounded-lg">
            <Activity className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="text-3xl font-bold font-orbitron text-primary tracking-wide">
            FACTOR
          </span>
        </button>
      </div>

    </>
  );
}

export default AppSidebar;

// 하위 호환성을 위한 별칭 (deprecated)
export { AppSidebar as AIChatSidebar };
