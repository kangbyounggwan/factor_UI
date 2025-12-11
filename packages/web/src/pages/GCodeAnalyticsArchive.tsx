/**
 * G-code 분석 아카이브 페이지
 * 이전 분석 보고서 목록 조회 및 상세 보기
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { GCodeAnalysisReport, type GCodeAnalysisData } from '@/components/PrinterDetail/GCodeAnalysisReport';
import {
  getAnalysisReportsList,
  getAnalysisReportById,
  deleteAnalysisReport,
  deleteMultipleReports,
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
  X,
  Plus,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

const PAGE_SIZE = 12;

export default function GCodeAnalyticsArchive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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

  // 선택 상태
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

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
          title: '목록 로드 실패',
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
  }, [user?.id, currentPage, gradeFilter, sortOption, searchQuery, toast]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // 상세 보기
  const handleViewReport = async (reportId: string, fileName?: string) => {
    setIsLoadingDetail(true);
    setSelectedReportName(fileName || 'G-code 분석 보고서');

    try {
      const { data, error } = await getAnalysisReportById(reportId);

      if (error || !data) {
        toast({
          title: '보고서 로드 실패',
          description: error?.message || '보고서를 찾을 수 없습니다.',
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
            title: 'G-code 원본 로드 실패',
            description: '분석 결과는 표시되지만 원본 G-code를 볼 수 없습니다.',
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
          title: '삭제 실패',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: '삭제 완료',
        description: '보고서가 삭제되었습니다.',
      });

      loadReports();
    } catch (err) {
      console.error('[GCodeAnalyticsArchive] Delete error:', err);
    } finally {
      setDeleteDialogOpen(false);
      setReportToDelete(null);
    }
  };

  // 선택 삭제
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    try {
      const { error } = await deleteMultipleReports(Array.from(selectedIds));

      if (error) {
        toast({
          title: '삭제 실패',
          description: error.message,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: '삭제 완료',
        description: `${selectedIds.size}개의 보고서가 삭제되었습니다.`,
      });

      setSelectedIds(new Set());
      setSelectMode(false);
      loadReports();
    } catch (err) {
      console.error('[GCodeAnalyticsArchive] Bulk delete error:', err);
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
      <div className="min-h-screen bg-background">
        {/* 상단 바 */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedReport(null)}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              목록으로
            </Button>
            <span className="text-sm text-muted-foreground truncate">
              {selectedReportName}
            </span>
          </div>
        </div>

        {/* 보고서 */}
        <div className="max-w-6xl mx-auto p-4">
          <GCodeAnalysisReport
            data={selectedReport}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 헤더 */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/gcode-analytics')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold">분석 아카이브</h1>
                <p className="text-sm text-muted-foreground">
                  {totalCount}개의 분석 보고서
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={() => navigate('/gcode-analytics')}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                새 분석
              </Button>

              {selectMode ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    disabled={selectedIds.size === 0}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {selectedIds.size}개 삭제
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectMode(false);
                      setSelectedIds(new Set());
                    }}
                  >
                    취소
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectMode(true)}
                >
                  선택
                </Button>
              )}
            </div>
          </div>

          {/* 필터 바 */}
          <div className="flex flex-wrap items-center gap-3 mt-4">
            {/* 검색 */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="파일명 검색..."
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
                <SelectValue placeholder="등급" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="A">A 등급</SelectItem>
                <SelectItem value="B">B 등급</SelectItem>
                <SelectItem value="C">C 등급</SelectItem>
                <SelectItem value="D">D 등급</SelectItem>
                <SelectItem value="F">F 등급</SelectItem>
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
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at-desc">최신순</SelectItem>
                <SelectItem value="created_at-asc">오래된순</SelectItem>
                <SelectItem value="overall_score-desc">점수 높은순</SelectItem>
                <SelectItem value="overall_score-asc">점수 낮은순</SelectItem>
                <SelectItem value="total_issues_count-desc">이슈 많은순</SelectItem>
                <SelectItem value="file_name-asc">파일명순</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* 목록 */}
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
            <h3 className="text-lg font-medium">분석 기록이 없습니다</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              새로운 G-code 파일을 분석해보세요
            </p>
            <Button onClick={() => navigate('/gcode-analytics')}>
              <Plus className="h-4 w-4 mr-2" />
              새 분석 시작
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {reports.map((report) => (
                <Card
                  key={report.id}
                  className={cn(
                    "overflow-hidden cursor-pointer transition-all hover:shadow-md",
                    selectMode && selectedIds.has(report.id) && "ring-2 ring-primary"
                  )}
                  onClick={() => {
                    if (selectMode) {
                      const newSelected = new Set(selectedIds);
                      if (newSelected.has(report.id)) {
                        newSelected.delete(report.id);
                      } else {
                        newSelected.add(report.id);
                      }
                      setSelectedIds(newSelected);
                    } else {
                      handleViewReport(report.id, report.file_name);
                    }
                  }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm font-medium truncate">
                          {report.file_name || '이름 없음'}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(report.created_at), {
                            addSuffix: true,
                            locale: ko,
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
                          <span className="text-muted-foreground">품질 점수</span>
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
                          <span>{report.layer_count} 레이어</span>
                        </div>
                      )}
                      {report.total_issues_count > 0 ? (
                        <div className="flex items-center gap-1.5 text-orange-500">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>{report.total_issues_count}개 이슈</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-green-500">
                          <CheckCircle className="h-3.5 w-3.5" />
                          <span>이슈 없음</span>
                        </div>
                      )}
                      {report.filament_weight_g && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <span>{report.filament_weight_g}g</span>
                        </div>
                      )}
                    </div>

                    {/* 삭제 버튼 (선택 모드가 아닐 때) */}
                    {!selectMode && (
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
                        삭제
                      </Button>
                    )}
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

      {/* 상세 로딩 오버레이 */}
      {isLoadingDetail && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">보고서 로딩 중...</p>
          </div>
        </div>
      )}

      {/* 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>보고서 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              이 분석 보고서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
