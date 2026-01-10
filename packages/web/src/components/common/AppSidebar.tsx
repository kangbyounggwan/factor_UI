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
  ChevronDown,
  FileCode,
  Printer,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
  X,
  Camera,
  Wrench,
  Brain,
  BarChart3,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import type { User } from "@supabase/supabase-js";
import type { SubscriptionPlan } from "@shared/types/subscription";
import type { AIGeneratedModel } from "@shared/types/aiModelType";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";

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
export type PrinterDetailTab = 'all' | 'monitoring' | 'files' | 'settings' | 'settings-equipment' | 'settings-camera';

// 보고서 아카이브 아이템 타입
export interface ReportArchiveItem {
  id: string;
  fileName: string;
  overallScore?: number;
  overallGrade?: string;
  totalIssues?: number;
  createdAt: Date;
}

// 프린터 빠른 선택 아이템 타입
export interface PrinterQuickItem {
  id: string;
  name: string;
  model?: string;
  isOnline: boolean;
  progress?: number; // 0-100
  currentJob?: string;
}

// 프린터 알림 타입
export type PrinterAlertType = 'error' | 'warning' | 'info' | 'success';
export interface PrinterAlert {
  id: string;
  type: PrinterAlertType;
  printerName: string;
  message: string;
  timestamp: Date;
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
  mode?: 'chat' | 'dashboard' | 'settings' | 'create' | 'printer-detail' | 'archive' | 'admin'; // 사이드바 모드
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
  onViewMoreReports?: () => void; // 더보기 클릭 콜백
  archiveViewActive?: boolean; // 아카이브 뷰 활성화 상태
  // Dashboard 모드용 props (프린터 빠른 선택 + 알림)
  printers?: PrinterQuickItem[];
  onSelectPrinter?: (printer: PrinterQuickItem) => void;
  alerts?: PrinterAlert[];
  onDismissAlert?: (alertId: string) => void;
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
  onViewMoreReports,
  archiveViewActive = false,
  // Dashboard 모드용 props
  printers = [],
  onSelectPrinter,
  alerts = [],
  onDismissAlert,
}: AppSidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const isMobile = useIsMobile();

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
                    {onViewMoreReports && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                        onClick={onViewMoreReports}
                      >
                        {archiveViewActive ? t('aiChat.close', '닫기') : t('aiChat.viewMore', '더보기')}
                      </Button>
                    )}
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

                {/* 설정 메뉴 (서브메뉴 포함) */}
                <div className="space-y-1">
                  <button
                    onClick={() => onPrinterTabChange?.('settings-equipment')}
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      activePrinterTab?.startsWith('settings')
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Settings className="h-4 w-4 shrink-0" />
                      <span>{t('printerDetail.settingsMenu', '설정')}</span>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      activePrinterTab?.startsWith('settings') ? "rotate-0" : "-rotate-90"
                    )} />
                  </button>

                  {/* 설정 서브메뉴 */}
                  {activePrinterTab?.startsWith('settings') && (
                    <div className="ml-4 pl-3 border-l border-border space-y-1">
                      <button
                        onClick={() => onPrinterTabChange?.('settings-equipment')}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          activePrinterTab === 'settings-equipment'
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Wrench className="h-4 w-4 shrink-0" />
                        <span>{t('printerDetail.settingsEquipment', '설비 설정')}</span>
                      </button>

                      <button
                        onClick={() => onPrinterTabChange?.('settings-camera')}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          activePrinterTab === 'settings-camera'
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Camera className="h-4 w-4 shrink-0" />
                        <span>{t('printerDetail.settingsCamera', '카메라 설정')}</span>
                      </button>
                    </div>
                  )}
                </div>
              </nav>
            </>
          ) : mode === 'admin' ? (
            /* Admin 모드 - 관리자 메뉴 */
            <>
              <p className="text-sm font-semibold text-foreground px-2 py-2">
                {t('admin.title', '관리자')}
              </p>
              <nav className="space-y-1">
                <Link
                  to="/admin"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === '/admin'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span>{t('admin.dashboard', '관리자 대시보드')}</span>
                </Link>

                <Link
                  to="/admin/users"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === '/admin/users'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <UserIcon className="h-4 w-4 shrink-0" />
                  <span>{t('admin.userStats', '사용자 통계')}</span>
                </Link>

                {/* AI 분석 메뉴 (서브메뉴 포함) */}
                <div className="space-y-1">
                  <Link
                    to="/admin/ai-analytics"
                    className={cn(
                      "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                      location.pathname.startsWith('/admin/ai-analytics')
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Brain className="h-4 w-4 shrink-0" />
                      <span>{t('admin.aiAnalytics', 'AI 분석')}</span>
                    </div>
                    <ChevronDown className={cn(
                      "h-4 w-4 shrink-0 transition-transform",
                      location.pathname.startsWith('/admin/ai-analytics') ? "rotate-0" : "-rotate-90"
                    )} />
                  </Link>

                  {/* AI 분석 서브메뉴 */}
                  {location.pathname.startsWith('/admin/ai-analytics') && (
                    <div className="ml-4 pl-3 border-l border-border space-y-1">
                      <Link
                        to="/admin/ai-analytics"
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          location.pathname === '/admin/ai-analytics'
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <BarChart3 className="h-4 w-4 shrink-0" />
                        <span>{t('admin.aiDashboard', '분석 대시보드')}</span>
                      </Link>

                      <Link
                        to="/admin/ai-analytics/chat"
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          location.pathname === '/admin/ai-analytics/chat'
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <MessageSquare className="h-4 w-4 shrink-0" />
                        <span>{t('admin.chatAnalytics', '채팅 분석')}</span>
                      </Link>

                      <Link
                        to="/admin/ai-analytics/models"
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          location.pathname === '/admin/ai-analytics/models'
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Box className="h-4 w-4 shrink-0" />
                        <span>{t('admin.modelAnalytics', '모델 생성 분석')}</span>
                      </Link>

                      <Link
                        to="/admin/ai-analytics/usage"
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                          location.pathname === '/admin/ai-analytics/usage'
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Activity className="h-4 w-4 shrink-0" />
                        <span>{t('admin.usageAnalytics', '사용량 분석')}</span>
                      </Link>
                    </div>
                  )}
                </div>

                <Link
                  to="/admin/subscriptions"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === '/admin/subscriptions'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span>{t('admin.subscriptions', '구독 현황')}</span>
                </Link>

                <Link
                  to="/admin/printers"
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    location.pathname === '/admin/printers'
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Printer className="h-4 w-4 shrink-0" />
                  <span>{t('admin.printers', '프린터')}</span>
                </Link>
              </nav>
            </>
          ) : (
            /* Dashboard 모드 - 프린터 빠른 선택 + 알림 */
            <div className="flex flex-col gap-4">
              {/* 프린터 빠른 선택 */}
              <div className="px-2">
                <div className="flex items-center justify-between px-2 py-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t('dashboard.printerQuickSelect', '프린터')}
                  </p>
                </div>
                {printers.length > 0 ? (
                  <div className="space-y-2">
                    {printers.slice(0, 4).map((printer) => (
                      <div
                        key={printer.id}
                        onClick={() => onSelectPrinter?.(printer)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all",
                          "bg-background border border-border/60 shadow-sm hover:border-border hover:shadow-md"
                        )}
                      >
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full shrink-0",
                          printer.isOnline ? "bg-green-500" : "bg-gray-400"
                        )} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{printer.name}</p>
                          {printer.model && (
                            <p className="text-xs text-muted-foreground truncate">{printer.model}</p>
                          )}
                        </div>
                        {printer.progress !== undefined && printer.progress > 0 && (
                          <div className="text-xs font-medium text-blue-500">
                            {printer.progress}%
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Printer className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.noRegisteredPrinters', '아직 등록된 프린터가 없습니다.')}
                    </p>
                  </div>
                )}
              </div>

              {/* 알림/경고 */}
              <div className="px-2">
                <div className="flex items-center justify-between px-2 py-2">
                  <p className="text-sm font-semibold text-foreground">
                    {t('dashboard.alerts', '알림')}
                  </p>
                  {alerts.length > 0 && (
                    <span className="text-xs text-muted-foreground">{alerts.length}</span>
                  )}
                </div>
                {alerts.length > 0 ? (
                  <div className="space-y-2">
                    {alerts.slice(0, 5).map((alert) => {
                      const AlertIcon = alert.type === 'error' ? AlertCircle
                        : alert.type === 'warning' ? AlertTriangle
                        : alert.type === 'success' ? CheckCircle
                        : Info;
                      const alertColor = alert.type === 'error' ? 'text-red-500'
                        : alert.type === 'warning' ? 'text-amber-500'
                        : alert.type === 'success' ? 'text-green-500'
                        : 'text-blue-500';

                      return (
                        <div
                          key={alert.id}
                          className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 group"
                        >
                          <AlertIcon className={cn("h-4 w-4 shrink-0 mt-0.5", alertColor)} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium truncate">{alert.printerName}</p>
                            <p className="text-xs text-muted-foreground line-clamp-2">{alert.message}</p>
                          </div>
                          {onDismissAlert && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={(e) => {
                                e.stopPropagation();
                                onDismissAlert(alert.id);
                              }}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {t('dashboard.noAlerts', '새로운 알림이 없습니다')}
                    </p>
                  </div>
                )}
              </div>
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

      {/* 토글 버튼 + 로고 - 사이드바 상태에 따라 위치 변경, 모바일에서는 숨김 (AppHeader에서 표시) */}
      {!isMobile && (
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
      )}
    </>
  );
}

export default AppSidebar;

// 하위 호환성을 위한 별칭 (deprecated)
export { AppSidebar as AIChatSidebar };
