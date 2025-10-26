import { useNavigate, useSearchParams } from "react-router-dom";
import { XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const PaymentFail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const code = searchParams.get("code");
  const message = searchParams.get("message");
  const orderId = searchParams.get("orderId");

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="pt-6 text-center space-y-6">
          <div className="flex justify-center">
            <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-4">
              <XCircle className="h-16 w-16 text-red-600 dark:text-red-500" />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold">결제 실패</h1>
            <p className="text-muted-foreground">
              {message || "결제 처리 중 문제가 발생했습니다."}
            </p>
          </div>

          {(code || orderId) && (
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-left">
              {code && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">오류 코드</span>
                  <span className="text-xs font-mono">{code}</span>
                </div>
              )}
              {orderId && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">주문번호</span>
                  <span className="text-xs font-mono">{orderId}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 pt-4">
            <Button
              size="lg"
              className="w-full"
              onClick={() => navigate("/subscription")}
            >
              다시 시도하기
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full"
              onClick={() => navigate("/dashboard")}
            >
              대시보드로 이동
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>문제가 계속되면 고객센터로 문의해주세요.</p>
            <p className="text-muted-foreground/60">support@factor.com</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentFail;
