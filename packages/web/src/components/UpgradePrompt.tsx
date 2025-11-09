import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Zap, Lock } from "lucide-react";
import type { SubscriptionPlan } from "@shared/types/subscription";

interface UpgradePromptProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feature: string;
  requiredPlan: SubscriptionPlan;
  currentPlan: SubscriptionPlan;
}

const PLAN_NAMES: Record<SubscriptionPlan, string> = {
  free: "Basic",
  pro: "Pro",
  enterprise: "Enterprise",
};

export function UpgradePrompt({
  open,
  onOpenChange,
  feature,
  requiredPlan,
  currentPlan,
}: UpgradePromptProps) {
  const { t } = useTranslation();

  const getPlanColor = (plan: SubscriptionPlan) => {
    switch (plan) {
      case "pro":
        return "bg-blue-500";
      case "enterprise":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className={`p-2 rounded-lg ${getPlanColor(requiredPlan)} bg-opacity-10`}>
              <Lock className={`h-5 w-5 ${getPlanColor(requiredPlan).replace('bg-', 'text-')}`} />
            </div>
            <DialogTitle className="text-xl">
              {t('subscription.upgradeRequired')}
            </DialogTitle>
          </div>
          <DialogDescription className="text-base pt-2">
            {t('subscription.upgradeDescription', {
              feature,
              plan: PLAN_NAMES[requiredPlan],
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Plan */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="text-sm text-muted-foreground">{t('subscription.currentPlan')}</p>
              <p className="font-semibold">{PLAN_NAMES[currentPlan]}</p>
            </div>
            <Badge variant="outline">{t('subscription.active')}</Badge>
          </div>

          {/* Upgrade Arrow */}
          <div className="flex justify-center">
            <div className="text-2xl">↓</div>
          </div>

          {/* Required Plan */}
          <div className={`flex items-center justify-between p-3 rounded-lg ${getPlanColor(requiredPlan)} bg-opacity-10 border-2 ${getPlanColor(requiredPlan).replace('bg-', 'border-')}`}>
            <div>
              <p className="text-sm text-muted-foreground">{t('subscription.upgradeTo')}</p>
              <p className="font-semibold text-lg">{PLAN_NAMES[requiredPlan]}</p>
            </div>
            <Zap className={`h-6 w-6 ${getPlanColor(requiredPlan).replace('bg-', 'text-')}`} />
          </div>

          {/* Benefits */}
          <div className="pt-2">
            <p className="text-sm font-medium mb-2">{t('subscription.upgradeIncludesTitle')}</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {requiredPlan === 'pro' && (
                <>
                  <li>✓ {t('subscription.proBenefit1')}</li>
                  <li>✓ {t('subscription.proBenefit2')}</li>
                  <li>✓ {t('subscription.proBenefit3')}</li>
                  <li>✓ {t('subscription.proBenefit4')}</li>
                </>
              )}
              {requiredPlan === 'enterprise' && (
                <>
                  <li>✓ {t('subscription.enterpriseBenefit1')}</li>
                  <li>✓ {t('subscription.enterpriseBenefit2')}</li>
                  <li>✓ {t('subscription.enterpriseBenefit3')}</li>
                  <li>✓ {t('subscription.enterpriseBenefit4')}</li>
                </>
              )}
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            {t('common.cancel')}
          </Button>
          <Button asChild className="w-full sm:w-auto">
            <Link to="/subscription">
              <Zap className="mr-2 h-4 w-4" />
              {t('subscription.viewPlans')}
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
