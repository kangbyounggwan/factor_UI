import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, Home } from "lucide-react";
import { useTranslation } from "react-i18next";

const PaymentFail = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL 파라미터에서 실패 정보 추출
  const code = searchParams.get("code");
  const message = searchParams.get("message");
  const orderId = searchParams.get("orderId");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-destructive">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl text-destructive">
            {t("payment.failTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-center text-muted-foreground">
              {t("payment.failDescription")}
            </p>

            {/* 실패 정보 */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              {orderId && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("payment.orderId")}</span>
                  <span className="font-mono">{orderId}</span>
                </div>
              )}
              {code && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{t("payment.errorCode")}</span>
                  <span className="font-mono text-destructive">{code}</span>
                </div>
              )}
              {message && (
                <div className="text-sm">
                  <span className="text-muted-foreground block mb-1">
                    {t("payment.errorMessage")}
                  </span>
                  <span className="text-destructive">{message}</span>
                </div>
              )}
            </div>

            {/* 안내 메시지 */}
            <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30 p-3">
              <p className="text-xs text-yellow-900 dark:text-yellow-100">
                {t("payment.failNotice")}
              </p>
            </div>
          </div>

          {/* 액션 버튼 */}
          <div className="space-y-2">
            <Button
              className="w-full"
              size="lg"
              onClick={() => navigate("/subscription")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t("payment.retryPayment")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/")}
            >
              <Home className="mr-2 h-4 w-4" />
              {t("payment.goToHome")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentFail;
