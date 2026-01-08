import { Card, CardContent } from '@/components/ui/card';
import {
  MessageSquare,
  Wrench,
  Box,
  FileCode,
  TrendingUp,
  CheckCircle,
  Image,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface AIStats {
  chat: {
    totalSessions: number;
    totalMessages: number;
    sessionsLastWeek: number;
  };
  troubleshoot: {
    totalSessions: number;
    totalMessages: number;
    sessionsLastWeek: number;
  };
  aiModels: {
    total: number;
    textTo3d: number;
    imageTo3d: number;
    textToImage: number;
    lastWeek: number;
  };
  gcode: {
    totalReports: number;
    avgScore: number;
  };
  usage: {
    totalModelGenerations: number;
    totalImageGenerations: number;
  };
}

// 숫자를 안전하게 변환하는 헬퍼 함수
const safeNumber = (value: unknown): number => {
  if (typeof value === 'number' && !isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

interface StatsSummaryCardsProps {
  stats: AIStats | null;
  loading?: boolean;
}

export function StatsSummaryCards({ stats, loading }: StatsSummaryCardsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="h-4 bg-muted rounded w-1/2 mb-2" />
              <div className="h-8 bg-muted rounded w-3/4" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      title: '채팅 세션',
      value: safeNumber(stats.chat?.totalSessions).toLocaleString(),
      subtitle: `이번 주 +${safeNumber(stats.chat?.sessionsLastWeek)}`,
      icon: MessageSquare,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      title: '채팅 메시지',
      value: safeNumber(stats.chat?.totalMessages).toLocaleString(),
      subtitle: '총 메시지 수',
      icon: MessageSquare,
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
    },
    {
      title: '문제진단 세션',
      value: safeNumber(stats.troubleshoot?.totalSessions).toLocaleString(),
      subtitle: `이번 주 +${safeNumber(stats.troubleshoot?.sessionsLastWeek)}`,
      icon: Wrench,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
    },
    {
      title: '진단 메시지',
      value: safeNumber(stats.troubleshoot?.totalMessages).toLocaleString(),
      subtitle: '문제진단 대화 수',
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      title: 'AI 모델 생성',
      value: safeNumber(stats.aiModels?.total).toLocaleString(),
      subtitle: `이번 주 +${safeNumber(stats.aiModels?.lastWeek)}`,
      icon: Box,
      color: 'text-violet-500',
      bgColor: 'bg-violet-500/10',
    },
    {
      title: 'Text to 3D',
      value: safeNumber(stats.aiModels?.textTo3d).toLocaleString(),
      subtitle: '텍스트 → 3D',
      icon: Box,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      title: 'Image to 3D',
      value: safeNumber(stats.aiModels?.imageTo3d).toLocaleString(),
      subtitle: '이미지 → 3D',
      icon: Image,
      color: 'text-pink-500',
      bgColor: 'bg-pink-500/10',
    },
    {
      title: 'G-code 분석',
      value: safeNumber(stats.gcode?.totalReports).toLocaleString(),
      subtitle: `평균 점수 ${safeNumber(stats.gcode?.avgScore).toFixed(1)}점`,
      icon: FileCode,
      color: 'text-emerald-500',
      bgColor: 'bg-emerald-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-1">{stat.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{stat.subtitle}</p>
                </div>
                <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                  <Icon className={cn("h-5 w-5", stat.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export default StatsSummaryCards;
