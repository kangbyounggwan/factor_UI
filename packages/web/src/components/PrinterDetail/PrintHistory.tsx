import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  History,
  FileCode2,
  Clock,
  CheckCircle2,
  XCircle,
  PauseCircle,
  PlayCircle,
  Loader2,
  RefreshCw,
  Calendar,
  Timer
} from "lucide-react";
import { supabase } from "@shared/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface PrintHistoryItem {
  id: string;
  print_status: 'printing' | 'completed' | 'failed' | 'cancelled' | 'paused';
  started_at: string;
  completed_at: string | null;
  short_filename?: string | null;
  gcode_url?: string | null;
  print_settings: {
    file_name?: string;
    file_path?: string;
    file_size?: number;
    file_origin?: string;
    estimated_time?: number;
    estimated_time_formatted?: string;
  } | null;
  error_message?: string | null;
}

interface PrintHistoryProps {
  printerId: string;
  className?: string;
}

export function PrintHistory({ printerId, className }: PrintHistoryProps) {
  const { t } = useTranslation();
  const [history, setHistory] = useState<PrintHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async (showRefresh = false) => {
    try {
      if (showRefresh) setRefreshing(true);
      else setLoading(true);

      const { data, error } = await supabase
        .from('model_print_history')
        .select('id, print_status, started_at, completed_at, print_settings, error_message, short_filename, gcode_url')
        .eq('printer_id', printerId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[PrintHistory] Load error:', error);
        return;
      }

      setHistory(data || []);
    } catch (error) {
      console.error('[PrintHistory] Exception:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (printerId) {
      loadHistory();
    }
  }, [printerId]);

  // Realtime 구독
  useEffect(() => {
    if (!printerId) return;

    const channel = supabase
      .channel(`print_history:${printerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'model_print_history',
          filter: `printer_id=eq.${printerId}`,
        },
        () => {
          // 변경 감지 시 목록 새로고침
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [printerId]);

  const getStatusConfig = (status: PrintHistoryItem['print_status']) => {
    switch (status) {
      case 'printing':
        return {
          icon: PlayCircle,
          label: t('printHistory.printing'),
          className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
        };
      case 'completed':
        return {
          icon: CheckCircle2,
          label: t('printHistory.completed'),
          className: 'bg-blue-500/10 text-blue-600 border-blue-500/20'
        };
      case 'failed':
        return {
          icon: XCircle,
          label: t('printHistory.failed'),
          className: 'bg-red-500/10 text-red-600 border-red-500/20'
        };
      case 'cancelled':
        return {
          icon: XCircle,
          label: t('printHistory.cancelled'),
          className: 'bg-amber-500/10 text-amber-600 border-amber-500/20'
        };
      case 'paused':
        return {
          icon: PauseCircle,
          label: t('printHistory.paused'),
          className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
        };
      default:
        return {
          icon: Clock,
          label: status,
          className: 'bg-muted text-muted-foreground'
        };
    }
  };

  const formatDuration = (startedAt: string, completedAt: string | null) => {
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const diff = end - start;

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}${t('printHistory.hour')} ${minutes}${t('printHistory.minute')}`;
    }
    return `${minutes}${t('printHistory.minute')}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();

    const timeStr = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

    if (isToday) {
      return `${t('printHistory.today')} ${timeStr}`;
    }
    if (isYesterday) {
      return `${t('printHistory.yesterday')} ${timeStr}`;
    }
    return date.toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className={`h-full flex flex-col border border-border/50 shadow-card bg-card rounded-2xl ${className}`}>
      <CardHeader className="pb-4 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10">
              <History className="h-4 w-4 text-indigo-500" />
            </div>
            {t('printHistory.title')}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => loadHistory(true)}
            disabled={refreshing}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex-1 pt-4 overflow-hidden">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <History className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm">{t('printHistory.noHistory')}</p>
          </div>
        ) : (
          <ScrollArea className="h-full pr-3">
            <div className="space-y-3">
              {history.map((item) => {
                const statusConfig = getStatusConfig(item.print_status);
                const StatusIcon = statusConfig.icon;
                // short_filename 우선, 없으면 print_settings.file_name
                const fileName = item.short_filename || item.print_settings?.file_name || t('printHistory.unknownFile');

                return (
                  <div
                    key={item.id}
                    className="group p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors border border-transparent hover:border-border/50"
                  >
                    {/* 상단: 파일명 + 상태 */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-background">
                          <FileCode2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">
                            {fileName}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className={`flex-shrink-0 ${statusConfig.className}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* 하단: 시간 정보 */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>{formatDate(item.started_at)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Timer className="h-3.5 w-3.5" />
                        <span>{formatDuration(item.started_at, item.completed_at)}</span>
                      </div>
                    </div>

                    {/* 에러 메시지 (실패 시) */}
                    {item.print_status === 'failed' && item.error_message && (
                      <div className="mt-2 p-2 rounded-lg bg-red-500/10 text-red-600 text-xs">
                        {item.error_message}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
