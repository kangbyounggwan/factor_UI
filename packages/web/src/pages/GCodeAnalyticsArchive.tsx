/**
 * G-code 분석 아카이브 페이지
 * 이전 분석 보고서 목록 조회 및 상세 보기
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@shared/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { GCodeAnalysisReport, type GCodeAnalysisData } from '@/components/PrinterDetail/GCodeAnalysisReport';
import {
  getAnalysisReportsList,
  getAnalysisReportById,
  deleteAnalysisReport,
  convertDbReportToUiData,
  downloadGCodeContent,
} from '@/lib/gcodeAnalysisDbService';
import type {
  GCodeAnalysisReportListItem,
  AnalysisReportFilters,
  AnalysisReportSortOption,
  OverallGrade,
} from '@shared/types/gcodeAnalysisDbTypes';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  FileCode2,
  Search,
  Trash2,
  ArrowLeft,
  Clock,
  Layers,
  AlertTriangle,
  CheckCircle,
  Filter,
  SortDesc,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';
import { AppSidebar, type ChatSession, type ReportArchiveItem } from '@/components/common/AppSidebar';
import { AppHeader } from '@/components/common/AppHeader';
import { useSidebarState } from '@/hooks/useSidebarState';
import { LoginPromptModal } from '@/components/auth/LoginPromptModal';
import { getChatSessions } from '@shared/services/supabaseService/chat';

const PAGE_SIZE = 12;

export default function GCodeAnalyticsArchive() {
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // 사이드바 상태
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebarState(true);

  // 로그인 모달 상태
  const [showLoginModal, setShowLoginModal] = useState(false);

  // 채팅 세션 상태 (사이드바용)
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);

  // 보고서 아카이브 상태 (사이드바용)
  const [reportArchive, setReportArchive] = useState<ReportArchiveItem[]>([]);

  // 현재 언어에 따른 date-fns locale
  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  // 목록 상태
  const [reports, setReports] = useState<GCodeAnalysisReportListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // 필터/정렬 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<OverallGrade | 'all'>('all');
  const [sortOption, setSortOption] = useState<AnalysisReportSortOption>({
    field: 'created_at',
    direction: 'desc',
  });

  // 상세 보기 상태
  const [selectedReport, setSelectedReport] = useState<GCodeAnalysisData | null>(null);
  const [selectedReportName, setSelectedReportName] = useState<string>('');
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // 삭제 확인 다이얼로그
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);

  // 목록 로드
  const loadReports = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const filters: AnalysisReportFilters = {
        status: 'completed',
      };

      if (gradeFilter !== 'all') {
        filters.grade = gradeFilter;
      }

      const offset = (currentPage - 1) * PAGE_SIZE;

      const { data, count, error } = await getAnalysisReportsList(user.id, {
        filters,
        sort: sortOption,
        limit: PAGE_SIZE,
        offset,
      });

      if (error) {
        toast({
          title: t('gcodeAnalytics.loadFailed'),
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      // 검색어 필터링 (클라이언트 사이드)
      const filtered = searchQuery
        ? data.filter(r => r.file_name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : data;

      setReports(filtered);
      setTotalCount(count);
    } catch (err) {
      console.error('[GCodeAnalyticsArchive] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, currentPage, gradeFilter, sortOption, searchQuery, toast, t]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // 채팅 세션 로드 (사이드바용)
  useEffect(() => {
    const loadSessions = async () => {
      if (!user?.id) {
        setChatSessions([]);
        return;
      }

      try {
        const dbSessions = await getChatSessions(user.id);
        const formattedSessions: ChatSession[] = dbSessions.map(s => ({
          id: s.id,
          title: s.title,
          timestamp: new Date(s.last_message_at || s.created_at),
          messages: [],
          metadata: s.metadata,
        }));
        setChatSessions(formattedSessions);
      } catch {
        // 세션 로드 실패
      }
    };

    loadSessions();
  }, [user?.id]);

  // 보고서 아카이브 로드 (사이드바용)
  useEffect(() => {
    const loadReportArchive = async () => {
      if (!user?.id) {
        setReportArchive([]);
        return;
      }

      try {
        const { data } = await getAnalysisReportsList(user.id, { limit: 10 });
        const formattedReports: ReportArchiveItem[] = data.map(r => ({
          id: r.id,
          fileName: r.file_name,
          overallScore: r.overall_score ?? undefined,
          overallGrade: r.overall_grade ?? undefined,
          totalIssues: r.total_issues_count ?? undefined,
          createdAt: new Date(r.created_at),
        }));
        setReportArchive(formattedReports);
      } catch {
        // 보고서 로드 실패
      }
    };

    loadReportArchive();
  }, [user?.id]);

  // 새 채팅 시작 (AI 채팅으로 이동)
  const handleNewChat = () => {
    navigate('/ai-chat');
  };

  // 채팅 세션 로드 (AI 채팅으로 이동)
  const handleLoadSession = (session: ChatSession) => {
    navigate(`/ai-chat?session=${session.id}`);
  };

  // 보고서 선택
  const handleSelectReport = (report: ReportArchiveItem) => {
    handleViewReport(report.id, report.fileName);
  };

  // 사이드바에서 보고서 삭제
  const handleDeleteReportFromSidebar = async (reportId: string) => {
    try {
      const { error } = await deleteAnalysisReport(reportId);
      if (!error) {
        setReportArchive(prev => prev.filter(r => r.id !== reportId));
        loadReports(); // 메인 목록도 새로고침
      }
    } catch {
      // 삭제 실패
    }
  };

  // 상세 보기
  const handleViewReport = async (reportId: string, fileName?: string) => {
    setIsLoadingDetail(true);
    setSelectedReportName(fileName || t('gcodeAnalytics.reportTitle'));

    try {
      const { data, error } = await getAnalysisReportById(reportId);

      if (error || !data) {
        toast({
          title: t('gcodeAnalytics.reportLoadFailed'),
          description: error?.message || t('gcodeAnalytics.reportNotFound'),
          variant: 'destructive',
        });
        return;
      }

      const uiData = convertDbReportToUiData(data);

      // G-code 컨텐츠가 없고 스토리지 경로가 있으면 다운로드
      if (!uiData.gcodeContent && data.file_storage_path) {
        try {
          // 토스트 알림 대신 로딩 상태로 처리 (조용히 로드)
          const content = await downloadGCodeContent(data.file_storage_path);
          if (content) {
            uiData.gcodeContent = content;
          }
        } catch (downloadErr) {
          console.error('[GCodeAnalyticsArchive] G-code download error:', downloadErr);
          // G-code 로드 실패해도 보고서는 보여줌
          toast({
            title: t('gcodeAnalytics.gcodeLoadFailed'),
            description: t('gcodeAnalytics.gcodeLoadFailedDesc'),
            // variant: 'default', // warning is not a valid variant
          });
        }
      }

      setSelectedReport(uiData);
    } catch (err) {
      console.error('[GCodeAnalyticsArchive] View error:', err);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!reportToDelete) return;

    try {
      const { error } = await deleteAnalysisReport(reportToDelete);

      if (error) {
        toast({
          title: t('gcodeAnalytics.deleteFailed'),
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: t('gcodeAnalytics.deleteSuccess'),
        description: t('gcodeAnalytics.deleteSuccessDesc'),
      });

      loadReports();
    } catch (err) {
      console.error('[GCodeAnalyticsArchive] Delete error:', err);
    } finally {
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  // 등급 배지 색상
  const getGradeBadgeColor = (grade?: OverallGrade) => {
    switch (grade) {
      case 'A': return 'bg-green-500 text-white';
      case 'B': return 'bg-blue-500 text-white';
      case 'C': return 'bg-yellow-500 text-white';
      case 'D': return 'bg-orange-500 text-white';
      case 'F': return 'bg-red-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 상세 보기 모드
  if (selectedReport) {
    return (
      <div className="h-screen bg-background flex">
        {/* 왼쪽 사이드바 */}
        <AppSidebar
          isOpen={sidebarOpen}
          onToggle={toggleSidebar}
          sessions={chatSessions}
          onNewChat={handleNewChat}
          onLoadSession={handleLoadSession}
          user={user}
          onLoginClick={() => setShowLoginModal(true)}
          onSignOut={signOut}
          mode="chat"
          reports={reportArchive}
          currentReportId={selectedReport ? undefined : undefined}
          onSelectReport={handleSelectReport}
          onDeleteReport={handleDeleteReportFromSidebar}
        />

        {/* 메인 컨텐츠 */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* 앱 헤더 */}
          <AppHeader sidebarOpen={sidebarOpen} />

          {/* 상단 바 */}
          <div className="bg-background/95 backdrop-blur-sm border-b">
            <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedReport(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                {t('gcodeAnalytics.backToList')}
              </Button>
              <span className="text-sm text-muted-foreground truncate">
                {selectedReportName}
              </span>
            </div>
          </div>

          {/* 보고서 */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto p-4">
              <GCodeAnalysisReport
                data={selectedReport}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex">
      {/* 왼쪽 사이드바 */}
      <AppSidebar
        isOpen={sidebarOpen}
        onToggle={toggleSidebar}
        sessions={chatSessions}
        onNewChat={handleNewChat}
        onLoadSession={handleLoadSession}
        user={user}
        onLoginClick={() => setShowLoginModal(true)}
        onSignOut={signOut}
        mode="chat"
        reports={reportArchive}
        onSelectReport={handleSelectReport}
        onDeleteReport={handleDeleteReportFromSidebar}
      />

      {/* 메인 컨텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 앱 헤더 */}
        <AppHeader sidebarOpen={sidebarOpen} />

        {/* 페이지 헤더 */}
        <div className="bg-background/95 backdrop-blur-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-4">
            {/* 필터 바 */}
            <div className="flex flex-wrap items-center gap-3">
              {/* 검색 */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('gcodeAnalytics.searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* 등급 필터 */}
              <Select
                value={gradeFilter}
                onValueChange={(v) => setGradeFilter(v as OverallGrade | 'all')}
              >
                <SelectTrigger className="w-[120px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('gcodeAnalytics.grade')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('gcodeAnalytics.gradeAll')}</SelectItem>
                  <SelectItem value="A">{t('gcodeAnalytics.gradeA')}</SelectItem>
                  <SelectItem value="B">{t('gcodeAnalytics.gradeB')}</SelectItem>
                  <SelectItem value="C">{t('gcodeAnalytics.gradeC')}</SelectItem>
                  <SelectItem value="D">{t('gcodeAnalytics.gradeD')}</SelectItem>
                  <SelectItem value="F">{t('gcodeAnalytics.gradeF')}</SelectItem>
                </SelectContent>
              </Select>

              {/* 정렬 */}
              <Select
                value={`${sortOption.field}-${sortOption.direction}`}
                onValueChange={(v) => {
                  const [field, direction] = v.split('-') as [typeof sortOption.field, 'asc' | 'desc'];
                  setSortOption({ field, direction });
                }}
              >
                <SelectTrigger className="w-[160px]">
                  <SortDesc className="h-4 w-4 mr-2" />
                  <SelectValue placeholder={t('gcodeAnalytics.sort')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created_at-desc">{t('gcodeAnalytics.sortNewest')}</SelectItem>
                  <SelectItem value="created_at-asc">{t('gcodeAnalytics.sortOldest')}</SelectItem>
                  <SelectItem value="overall_score-desc">{t('gcodeAnalytics.sortScoreHigh')}</SelectItem>
                  <SelectItem value="overall_score-asc">{t('gcodeAnalytics.sortScoreLow')}</SelectItem>
                  <SelectItem value="total_issues_count-desc">{t('gcodeAnalytics.sortIssuesHigh')}</SelectItem>
                  <SelectItem value="file_name-asc">{t('gcodeAnalytics.sortFileName')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2 mt-2" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileCode2 className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">{t('gcodeAnalytics.noReports')}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {t('gcodeAnalytics.noReportsDesc')}
            </p>
            <Button onClick={() => navigate('/gcode-analytics')}>
              <Plus className="h-4 w-4 mr-2" />
              {t('gcodeAnalytics.startNewAnalysis')}
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className="overflow-hidden cursor-pointer transition-all hover:shadow-md"
                  onClick={() => handleViewReport(report.id, report.file_name)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm font-medium truncate">
                          {report.file_name || t('gcodeAnalytics.noName')}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(report.created_at), {
                            addSuffix: true,
                            locale: dateLocale,
                          })}
                        </p>
                      </div>
                      {report.overall_grade && (
                        <Badge className={cn("text-xs font-bold", getGradeBadgeColor(report.overall_grade))}>
                          {report.overall_grade}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-2">
                    {/* 점수 */}
                    {report.overall_score !== undefined && (
                      <div className="mb-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">{t('gcodeAnalytics.qualityScore')}</span>
                          <span className="font-semibold">{report.overall_score}/100</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all",
                              report.overall_score >= 80 ? "bg-green-500" :
                                report.overall_score >= 60 ? "bg-yellow-500" :
                                  report.overall_score >= 40 ? "bg-orange-500" : "bg-red-500"
                            )}
                            style={{ width: `${report.overall_score}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 메타 정보 */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {report.print_time_formatted && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" />
                          <span className="truncate">{report.print_time_formatted}</span>
                        </div>
                      )}
                      {report.layer_count && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Layers className="h-3.5 w-3.5" />
                          <span>{t('gcodeAnalytics.layerCount', { count: report.layer_count })}</span>
                        </div>
                      )}
                      {report.total_issues_count > 0 ? (
                        <div className="flex items-center gap-1.5 text-orange-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{t('gcodeAnalytics.issueCount', { count: report.total_issues_count })}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-500">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>{t('gcodeAnalytics.noIssues')}</span>
                        </div>
                      )}
                      {report.filament_weight_g && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span>{report.filament_weight_g}g</span>
                        </div>
                      )}
                    </div>

                    {/* 삭제 버튼 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full mt-3 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setReportToDelete(report.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t('gcodeAnalytics.delete')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* 페이지네이션 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-4">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
          </div>
        </div>

        {/* 상세 로딩 오버레이 */}
        {isLoadingDetail && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">{t('gcodeAnalytics.loadingReport')}</p>
            </div>
          </div>
        )}

        {/* 삭제 확인 다이얼로그 */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('gcodeAnalytics.deleteReportTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('gcodeAnalytics.deleteReportDesc')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('gcodeAnalytics.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {t('gcodeAnalytics.delete')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 로그인 모달 */}
        <LoginPromptModal
          open={showLoginModal}
          onOpenChange={setShowLoginModal}
        />
      </div>
    </div>
  );
}
