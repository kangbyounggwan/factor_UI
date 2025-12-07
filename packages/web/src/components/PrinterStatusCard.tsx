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
  return (
    <div className="relative rounded-2xl py-4 overflow-hidden flex-shrink-0">
      {/* 배경 */}
      <div className={`absolute inset-0 ${
        isPrinting ? 'bg-muted' :
        isConnected ? 'bg-green-600' :
        'bg-muted'
      }`} />

      {/* 진행률 채우기 (PRINTING일 때만) - 톱니 효과 */}
      {isPrinting && (
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{ width: `${completion * 100}%` }}
        >
          {/* 메인 채우기 */}
          <div className="absolute inset-0 bg-primary" />

          {/* 톱니 모양 경계선 */}
          <div
            className="absolute top-0 right-0 bottom-0 w-8 bg-primary"
            style={{
              clipPath: `polygon(
                0 0,
                100% 5%,
                100% 15%,
                0 10%,
                0 10%,
                100% 25%,
                100% 35%,
                0 30%,
                0 30%,
                100% 45%,
                100% 55%,
                0 50%,
                0 50%,
                100% 65%,
                100% 75%,
                0 70%,
                0 70%,
                100% 85%,
                100% 95%,
                0 90%,
                0 100%
              )`
            }}
          />
        </div>
      )}

      {/* 텍스트 */}
      <div className="relative z-10 flex items-center justify-center">
        <div className="text-5xl font-bold text-white tracking-wider">
          {isPrinting ? (
            <div className="flex items-center gap-3">
              <span>PRINTING</span>
              <span>{Math.round(completion * 100)}%</span>
            </div>
          ) : isConnected ? (
            'IDLE'
          ) : (
            'OFFLINE'
          )}
        </div>
      </div>
    </div>
  );
}
