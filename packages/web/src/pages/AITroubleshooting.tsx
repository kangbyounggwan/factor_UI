import { Suspense, lazy } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Wrench } from "lucide-react";
import { AIPageHeader } from "@/components/ai/AIPageHeader";

// Lazy load the troubleshooting component
const AITroubleshootingTab = lazy(() => import("@/components/ai/AITroubleshootingTab").then(m => ({ default: m.AITroubleshootingTab })));

const AITroubleshooting = () => {
  const { t } = useTranslation();

  return (
    <div className="h-[calc(100vh-4rem)] bg-background flex flex-col overflow-hidden">
      {/* 헤더 */}
      <AIPageHeader
        icon={Wrench}
        title={t('ai.troubleshootingTitle')}
        subtitle={t('ai.troubleshootingDescription')}
      />

      {/* 메인 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        <Suspense fallback={
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        }>
          <AITroubleshootingTab />
        </Suspense>
      </div>
    </div>
  );
};

export default AITroubleshooting;
