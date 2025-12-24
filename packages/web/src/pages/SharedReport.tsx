/**
 * Shared Report Page
 * 공유된 G-code 분석 보고서 조회 페이지
 * URL: /shared/report/:shareId
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { GCodeAnalysisReport, type GCodeAnalysisData } from '@/components/PrinterDetail/GCodeAnalysisReport';
import { getSharedReport, type SharedReport } from '@/lib/sharedReportService';
import { convertDbReportToUiData } from '@/lib/gcodeAnalysisDbService';
import type { GCodeAnalysisReport as GCodeAnalysisReportType } from '@shared/types/gcodeAnalysisDbTypes';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertTriangle, ArrowLeft, Eye, Calendar, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function SharedReportPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareData, setShareData] = useState<SharedReport | null>(null);
  const [reportData, setReportData] = useState<GCodeAnalysisData | null>(null);

  useEffect(() => {
    async function loadSharedReport() {
      if (!shareId) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await getSharedReport(shareId);

        if (fetchError || !data) {
          setError(fetchError?.message || 'Report not found');
          setLoading(false);
          return;
        }

        setShareData(data.share);

        // DB 보고서 데이터를 UI 데이터로 변환
        const uiData = convertDbReportToUiData(data.report as unknown as GCodeAnalysisReportType);
        setReportData(uiData);
      } catch (err) {
        console.error('[SharedReportPage] Error:', err);
        setError('Failed to load report');
      } finally {
        setLoading(false);
      }
    }

    loadSharedReport();
  }, [shareId]);

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground">{t('shared.loading', 'Loading shared report...')}</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error || !reportData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center gap-6 p-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold mb-2">
                {error === 'Share link expired'
                  ? t('shared.expired', 'Link Expired')
                  : t('shared.notFound', 'Report Not Found')}
              </h1>
              <p className="text-muted-foreground">
                {error === 'Share link expired'
                  ? t('shared.expiredDesc', 'This share link has expired. Please request a new link.')
                  : t('shared.notFoundDesc', 'The shared report could not be found or has been removed.')}
              </p>
            </div>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t('shared.goHome', 'Go to Homepage')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 공유 헤더 */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="flex items-center gap-2">
                <img
                  src="/images/factorlogo-white.png"
                  alt="FACTOR"
                  className="h-8 hidden dark:block"
                />
                <img
                  src="/images/factorlogo-black.png"
                  alt="FACTOR"
                  className="h-8 dark:hidden"
                />
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="text-sm text-muted-foreground">
                {t('shared.sharedReport', 'Shared Report')}
              </div>
            </div>

            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              {shareData && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4" />
                    <span>{shareData.view_count}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(shareData.created_at).toLocaleDateString()}</span>
                  </div>
                </>
              )}
              <Link to="/ai-chat">
                <Button size="sm" className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  {t('shared.tryFactor', 'Try FACTOR')}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* 보고서 콘텐츠 - 넓은 레이아웃 */}
      <main className="w-full max-w-[1600px] mx-auto px-4 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            {shareData?.title || reportData.fileName || t('shared.analysisReport', 'Analysis Report')}
          </h1>
          <p className="text-muted-foreground">
            {t('shared.generatedBy', 'Generated by FACTOR G-code Analyzer')}
          </p>
        </div>

        {/* G-code 분석 보고서 컴포넌트 */}
        <GCodeAnalysisReport
          data={reportData}
          embedded={false}
        />
      </main>

      {/* 푸터 */}
      <footer className="border-t mt-12 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p className="mb-2">
            {t('shared.poweredBy', 'Powered by FACTOR - AI-Powered 3D Printing Assistant')}
          </p>
          <Link to="/" className="text-primary hover:underline">
            {t('shared.learnMore', 'Learn more about FACTOR')}
          </Link>
        </div>
      </footer>
    </div>
  );
}
