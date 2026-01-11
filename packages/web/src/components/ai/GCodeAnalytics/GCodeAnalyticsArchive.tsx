/**
 * G-code 분석 아카이브 컴포넌트
 * 이전 분석 보고서 목록 조회 및 상세 보기
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
import { GCodeAnalysisReport, type GCodeAnalysisData } from './GCodeAnalysisReport';
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
  SortDesc,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Ruler,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko, enUS } from 'date-fns/locale';

const PAGE_SIZE = 12;

export interface GCodeAnalyticsArchiveProps {
  /** 사용자 ID */
  userId: string;
  /** 닫기 버튼 클릭 시 콜백 */
  onClose: () => void;
  /** 보고서 삭제 후 사이드바 새로고침용 콜백 */
  onReportDeleted?: () => void;
  /** 닫기 애니메이션 진행 중 여부 */
  isClosing?: boolean;
  /** 보고서 불러오기 콜백 - reportId를 전달하면 외부에서 처리 */
  onLoadReport?: (reportId: string, fileName?: string) => void;
}

export default function GCodeAnalyticsArchive({
  userId,
  onClose,
  onReportDeleted,
  isClosing = false,
  onLoadReport,
}: GCodeAnalyticsArchiveProps) {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();

  // 현재 언어에 따른 date-fns locale
  const dateLocale = i18n.language === 'ko' ? ko : enUS;

  // 목록 상태
  const [reports, setReports] = useState<GCodeAnalysisReportListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // 필터/정렬 상태
  const [searchQuery, setSearchQuery] = useState('');
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
    if (!userId) return;

    setIsLoading(true);
    try {
      const filters: AnalysisReportFilters = {
        status: 'completed',
      };

      const offset = (currentPage - 1) * PAGE_SIZE;

      const { data, count } = await getAnalysisReportsList(userId, {
        filters,
        sort: sortOption,
        limit: PAGE_SIZE,
        offset,
      });

      // 검색어 필터링 (클라이언트 사이드)
      const filtered = searchQuery
        ? data.filter((r) =>
            r.file_name?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : data;

      setReports(filtered);
      setTotalCount(count);
    } catch (err) {
      console.error('[GCodeAnalyticsArchive] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, currentPage, sortOption, searchQuery]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // 상세 보기 - onLoadReport가 있으면 외부로 위임, 없으면 인라인 표시
  const handleViewReport = async (reportId: string, fileName?: string) => {
    // 외부 콜백이 있으면 외부에서 처리 (더보기 → 보고서 불러오기)
    if (onLoadReport) {
      onLoadReport(reportId, fileName);
      return;
    }

    // 외부 콜백이 없으면 기존처럼 인라인으로 표시
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

      // G-code 컨텐츠가 없고 스토리지 경로가 있고 이슈가 있으면 다운로드 (에디터용)
      if (!uiData.gcodeContent && data.file_storage_path && data.total_issues_count > 0) {
        try {
          const content = await downloadGCodeContent(data.file_storage_path);
          if (content) {
            uiData.gcodeContent = content;
          }
        } catch (downloadErr) {
          console.error('[GCodeAnalyticsArchive] G-code download error:', downloadErr);
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
        description: t('gcodeAnalytics.reportDeleted'),
      });

      // 목록 새로고침
      loadReports();
      // 사이드바 보고서 목록도 새로고침
      onReportDeleted?.();
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
      case 'A':
        return 'bg-green-500 text-white';
      case 'B':
        return 'bg-blue-500 text-white';
      case 'C':
        return 'bg-yellow-500 text-white';
      case 'D':
        return 'bg-orange-500 text-white';
      case 'F':
        return 'bg-red-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 상세 보기 모드
  if (selectedReport) {
    return (
      <div
        className={cn(
          'flex-1 flex flex-col overflow-hidden',
          isClosing
            ? 'animate-out slide-out-to-top duration-200 ease-in fill-mode-forwards'
            : 'animate-in slide-in-from-top duration-300 ease-out'
        )}
      >
        <div className="bg-background/95 backdrop-blur-sm border-b shrink-0">
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
        <div className="flex-1 overflow-hidden">
          <div className="max-w-6xl mx-auto p-4 h-full">
            <GCodeAnalysisReport data={selectedReport} />
          </div>
        </div>
      </div>
    );
  }

  // 목록 모드
  return (
    <div
      className={cn(
        'flex-1 flex flex-col overflow-hidden',
        isClosing
          ? 'animate-out slide-out-to-top duration-200 ease-in fill-mode-forwards'
          : 'animate-in slide-in-from-top duration-300 ease-out'
      )}
    >
      {/* 아카이브 헤더 */}
      <div className="bg-background/95 backdrop-blur-sm border-b shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {t('gcodeAnalytics.reportArchiveTitle', '보고서 아카이브')}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-background/95 backdrop-blur-sm shrink-0">
        <div className="max-w-7xl mx-auto px-4 py-3">
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

            {/* 정렬 */}
            <Select
              value={`${sortOption.field}-${sortOption.direction}`}
              onValueChange={(v) => {
                const [field, direction] = v.split('-') as [
                  typeof sortOption.field,
                  'asc' | 'desc'
                ];
                setSortOption({ field, direction });
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SortDesc className="h-4 w-4 mr-2" />
                <SelectValue placeholder={t('gcodeAnalytics.sort')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">
                  {t('gcodeAnalytics.sortNewest')}
                </SelectItem>
                <SelectItem value="created_at-asc">
                  {t('gcodeAnalytics.sortOldest')}
                </SelectItem>
                <SelectItem value="overall_score-desc">
                  {t('gcodeAnalytics.sortScoreHigh')}
                </SelectItem>
                <SelectItem value="overall_score-asc">
                  {t('gcodeAnalytics.sortScoreLow')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 아카이브 목록 */}
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
              <p className="text-sm text-muted-foreground mt-1">
                {t('gcodeAnalytics.noReportsDesc')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {reports.map((report) => (
                  <Card
                    key={report.id}
                    className="overflow-hidden cursor-pointer transition-all hover:shadow-md h-full flex flex-col"
                    onClick={() => handleViewReport(report.id, report.file_name)}
                  >
                    <CardHeader className="pb-2 shrink-0">
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
                          <Badge
                            className={cn(
                              'text-xs font-bold',
                              getGradeBadgeColor(report.overall_grade)
                            )}
                          >
                            {report.overall_grade}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>

                    <CardContent className="pt-2 flex-1 flex flex-col">
                      {/* 점수 */}
                      {report.overall_score !== undefined && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">
                              {t('gcodeAnalytics.qualityScore')}
                            </span>
                            <span className="font-semibold">{report.overall_score}/100</span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full transition-all',
                                report.overall_score >= 80
                                  ? 'bg-green-500'
                                  : report.overall_score >= 60
                                  ? 'bg-yellow-500'
                                  : report.overall_score >= 40
                                  ? 'bg-orange-500'
                                  : 'bg-red-500'
                              )}
                              style={{ width: `${report.overall_score}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* 메타 정보 */}
                      <div className="grid grid-cols-2 gap-2 text-xs mt-auto">
                        {report.print_time_formatted && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            <span className="truncate">{report.print_time_formatted}</span>
                          </div>
                        )}
                        {report.layer_count && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Layers className="h-3.5 w-3.5" />
                            <span>{report.layer_count} layers</span>
                          </div>
                        )}
                        {report.filament_length_mm !== undefined &&
                          report.filament_length_mm > 0 && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Ruler className="h-3.5 w-3.5" />
                              <span>{(report.filament_length_mm / 1000).toFixed(1)}m</span>
                            </div>
                          )}
                        {report.total_issues_count > 0 ? (
                          <div className="flex items-center gap-1.5 text-orange-500">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            <span>{report.total_issues_count} issues</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-green-500">
                            <CheckCircle className="h-3.5 w-3.5" />
                            <span>{t('gcodeAnalytics.noIssues')}</span>
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
                    onClick={() => setCurrentPage((p) => p - 1)}
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
                    onClick={() => setCurrentPage((p) => p + 1)}
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
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t('gcodeAnalytics.loadingReport')}
            </p>
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
    </div>
  );
}
