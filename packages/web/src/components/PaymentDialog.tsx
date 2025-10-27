import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Loader2, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  initializePaymentWidget,
  renderPaymentWidget,
  requestPayment,
  generateOrderId,
  formatKRW,
  getPlanAmount,
  getPlanName,
} from "@/lib/tossPaymentsService";
import { PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";
import { useAuth } from "@shared/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface PaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planId: string;
  isYearly?: boolean;
}

export const PaymentDialog = ({
  open,
  onOpenChange,
  planId,
  isYearly = false,
}: PaymentDialogProps) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(true);
  const [customerName, setCustomerName] = useState(user?.user_metadata?.full_name || "");
  const [customerEmail, setCustomerEmail] = useState(user?.email || "");
  const [paymentWidget, setPaymentWidget] = useState<PaymentWidgetInstance | null>(null);
  const [orderId] = useState(generateOrderId("SUB"));

  const paymentMethodsRef = useRef<HTMLDivElement>(null);

  const amount = getPlanAmount(planId, isYearly);
  const planName = getPlanName(planId);

  // 결제 위젯 초기화 및 렌더링
  useEffect(() => {
    if (!open) {
      // 모달이 닫힐 때 상태 초기화
      setPaymentWidget(null);
      setWidgetLoading(true);
      return;
    }

    let mounted = true;

    const initWidget = async () => {
      try {
        setWidgetLoading(true);

        // 고객 키 생성 (회원: user ID, 비회원: ANONYMOUS)
        // customerKey는 UUID 형식 권장 (보안상 이메일/전화번호 사용 금지)
        const customerKey = user?.id || "ANONYMOUS";

        console.log("결제 위젯 초기화 시작...", { customerKey, amount });

        // Step 1: 위젯 인스턴스 초기화
        const widget = await initializePaymentWidget(customerKey);

        if (!mounted) return;

        console.log("결제 위젯 초기화 완료");
        setPaymentWidget(widget);

        // DOM이 준비될 때까지 대기
        await new Promise(resolve => setTimeout(resolve, 300));

        if (!mounted || !paymentMethodsRef.current) {
          console.log("DOM이 준비되지 않음");
          return;
        }

        console.log("결제 위젯 렌더링 시작...");
        console.log("렌더링 파라미터:", {
          amount,
          selector: "#payment-methods",
          domExists: !!document.querySelector("#payment-methods"),
        });

        // Step 2: renderPaymentMethods 호출 (amount 포함)
        await renderPaymentWidget({
          paymentWidget: widget,
          amount,
          selector: "#payment-methods",
          variantKey: "DEFAULT", // 결제위젯 어드민에서 설정한 UI 키
        });

        if (!mounted) return;

        console.log("결제 위젯 렌더링 완료");
        setWidgetLoading(false);
      } catch (error) {
        console.error("위젯 초기화 실패:", error);
        console.error("에러 상세:", {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          errorObject: error,
        });

        if (!mounted) return;

        toast({
          title: t("payment.error"),
          description: error instanceof Error ? error.message : t("payment.widgetInitFailed"),
          variant: "destructive",
        });
        setWidgetLoading(false);
      }
    };

    initWidget();

    return () => {
      mounted = false;
    };
  }, [open, amount, user?.id, toast, t]);

  const handlePayment = async () => {
    if (!paymentWidget) {
      toast({
        title: t("payment.error"),
        description: t("payment.widgetNotReady"),
        variant: "destructive",
      });
      return;
    }

    if (!customerName || !customerEmail) {
      toast({
        title: t("payment.error"),
        description: t("payment.fillAllFields"),
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const orderName = `${planName} - ${isYearly ? t("subscription.yearly") : t("subscription.monthly")}`;

      await requestPayment({
        paymentWidget,
        orderId,
        orderName,
        customerName,
        customerEmail,
      });

      // 결제창으로 리다이렉트되므로 여기는 실행되지 않음
    } catch (error) {
      console.error("결제 요청 실패:", error);
      toast({
        title: t("payment.error"),
        description: t("payment.requestFailed"),
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {t("payment.title")}
          </DialogTitle>
          <DialogDescription>{t("payment.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* 결제 정보 요약 */}
          <div className="rounded-lg bg-muted p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.plan")}</span>
              <span className="font-medium">{planName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{t("payment.billingCycle")}</span>
              <span className="font-medium">
                {isYearly ? t("subscription.yearly") : t("subscription.monthly")}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold">{t("payment.totalAmount")}</span>
              <span className="text-2xl font-bold text-primary">{formatKRW(amount)}</span>
            </div>
            {isYearly && amount > 0 && (
              <div className="text-xs text-green-600 dark:text-green-400 text-right">
                {t("subscription.yearlyDiscount")} - {formatKRW(getPlanAmount(planId, false) * 12 - amount)} {t("payment.saved")}
              </div>
            )}
          </div>

          {/* 고객 정보 입력 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customer-name">{t("payment.name")}</Label>
              <Input
                id="customer-name"
                placeholder={t("payment.namePlaceholder")}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="customer-email">{t("payment.email")}</Label>
              <Input
                id="customer-email"
                type="email"
                placeholder={t("payment.emailPlaceholder")}
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>

          {/* 결제 위젯 영역 */}
          <div className="space-y-2">
            <Label>{t("payment.paymentMethod")}</Label>
            <div className="border rounded-lg p-4 bg-background min-h-[300px]">
              {/* 항상 payment-methods div를 렌더링하되, 로딩 중에는 위에 오버레이 */}
              <div className="relative">
                <div id="payment-methods" ref={paymentMethodsRef}></div>
                {widgetLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">{t("payment.loadingWidget")}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 안내 사항 */}
          <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-3">
            <div className="flex gap-2">
              <CheckCircle2 className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-900 dark:text-blue-100 space-y-1">
                <p>{t("payment.notice1")}</p>
                <p>{t("payment.notice2")}</p>
              </div>
            </div>
          </div>

          {/* 결제 버튼 */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              {t("payment.cancel")}
            </Button>
            <Button
              className="flex-1"
              onClick={handlePayment}
              disabled={loading || widgetLoading || !paymentWidget || !customerName || !customerEmail}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("payment.processing")}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {formatKRW(amount)} {t("payment.pay")}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
