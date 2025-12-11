import { Wifi, WifiOff, Activity } from "lucide-react";
import { useTranslation } from "react-i18next";

interface PrinterStatusCardProps {
  isPrinting: boolean;
  isConnected: boolean;
  completion: number; // 0~1 사이 값
}

/**
 * 프린터 상태 카드 컴포넌트
 * 출력 중일 때 진행률 바와 함께 상태를 표시
 */
export function PrinterStatusCard({ isPrinting, isConnected, completion }: PrinterStatusCardProps) {
  const { t } = useTranslation();
  const percentage = Math.round(completion * 100);

  // 상태별 스타일 설정
  const getStatusConfig = () => {
    if (isPrinting) {
      return {
        bgGradient: 'from-emerald-500 to-emerald-600',
        textColor: 'text-white',
        statusText: 'PRINTING',
        icon: Activity,
        showProgress: true,
        glowColor: 'shadow-emerald-500/25'
      };
    }
    if (isConnected) {
      return {
        bgGradient: 'from-blue-500 to-blue-600',
        textColor: 'text-white',
        statusText: 'IDLE',
        icon: Wifi,
        showProgress: false,
        glowColor: 'shadow-blue-500/25'
      };
    }
    return {
      bgGradient: 'from-slate-600 to-slate-700',
      textColor: 'text-white/80',
      statusText: 'OFFLINE',
      icon: WifiOff,
      showProgress: false,
      glowColor: 'shadow-slate-500/20'
    };
  };

  const config = getStatusConfig();
  const StatusIcon = config.icon;

  return (
    <div className={`relative rounded-2xl overflow-hidden shadow-card ${config.glowColor}`}>
      {/* 배경 그라데이션 */}
      <div className={`absolute inset-0 bg-gradient-to-br ${config.bgGradient}`} />

      {/* 패턴 오버레이 */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      {/* 진행률 바 (PRINTING일 때만) */}
      {config.showProgress && (
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-black/30">
          <div
            className="h-full bg-white transition-all duration-500 ease-out shadow-[0_0_8px_rgba(255,255,255,0.5)]"
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {/* 메인 콘텐츠 */}
      <div className="relative z-10 px-6 py-5">
        <div className="flex items-center justify-between">
          {/* 왼쪽: 상태 텍스트 */}
          <div className="flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-white/20 backdrop-blur-sm">
              <StatusIcon className={`h-6 w-6 ${config.textColor}`} />
            </div>
            <div>
              <div className={`text-3xl font-bold tracking-wide ${config.textColor}`}>
                {config.statusText}
              </div>
              {isPrinting && (
                <div className="text-white/70 text-sm font-medium mt-0.5">
                  {t('printerDetail.printingInProgress')}
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽: 퍼센트 (프린팅 중일 때만) */}
          {isPrinting && (
            <div className="text-right">
              <div className={`text-5xl font-bold ${config.textColor} tabular-nums`}>
                {percentage}
                <span className="text-3xl">%</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
