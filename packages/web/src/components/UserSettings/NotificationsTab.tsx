/**
 * NotificationsTab - 알림 설정 탭
 */
import { useTranslation } from "react-i18next";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, Crown } from "lucide-react";
import type { SubscriptionPlan } from "@shared/types/subscription";

export interface NotificationsTabProps {
  currentPlan: SubscriptionPlan;
  emailNotifications: boolean;
  setEmailNotifications: (value: boolean) => void;
  pushNotifications: boolean;
  setPushNotifications: (value: boolean) => void;
  printCompleteNotif: boolean;
  setPrintCompleteNotif: (value: boolean) => void;
  errorNotif: boolean;
  setErrorNotif: (value: boolean) => void;
  weeklyReport: boolean;
  setWeeklyReport: (value: boolean) => void;
  loadingNotifications: boolean;
  isEditingNotifications: boolean;
  setIsEditingNotifications: (editing: boolean) => void;
  originalNotifications: {
    email: boolean;
    push: boolean;
    printComplete: boolean;
    error: boolean;
    weekly: boolean;
  };
  onSaveNotifications: () => Promise<void>;
}

export const NotificationsTab = ({
  currentPlan,
  emailNotifications,
  setEmailNotifications,
  pushNotifications,
  setPushNotifications,
  printCompleteNotif,
  setPrintCompleteNotif,
  errorNotif,
  setErrorNotif,
  weeklyReport,
  setWeeklyReport,
  loadingNotifications,
  isEditingNotifications,
  setIsEditingNotifications,
  originalNotifications,
  onSaveNotifications,
}: NotificationsTabProps) => {
  const { t } = useTranslation();

  const handleReset = () => {
    setPushNotifications(originalNotifications.push);
    setPrintCompleteNotif(originalNotifications.printComplete);
    setErrorNotif(originalNotifications.error);
    setEmailNotifications(originalNotifications.email);
    setWeeklyReport(originalNotifications.weekly);
    setIsEditingNotifications(false);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <CardTitle>{t("userSettings.notificationSettings")}</CardTitle>
              <CardDescription>
                {t("userSettings.notificationDescription")}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-9 w-9 shrink-0"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4">
            {/* Push Notifications */}
            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5 flex-1">
                <Label
                  htmlFor="push-notif"
                  className="text-base font-medium cursor-pointer"
                >
                  {t("userSettings.pushNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("userSettings.pushNotificationsDesc")}
                </p>
              </div>
              <Switch
                id="push-notif"
                checked={pushNotifications}
                onCheckedChange={(value) => {
                  setPushNotifications(value);
                  setIsEditingNotifications(true);
                }}
                disabled={loadingNotifications}
              />
            </div>

            <Separator />

            {/* Print Complete */}
            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5 flex-1">
                <Label
                  htmlFor="print-complete"
                  className="text-base font-medium cursor-pointer"
                >
                  {t("userSettings.printComplete")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("userSettings.printCompleteDesc")}
                </p>
              </div>
              <Switch
                id="print-complete"
                checked={printCompleteNotif}
                onCheckedChange={(value) => {
                  setPrintCompleteNotif(value);
                  setIsEditingNotifications(true);
                }}
                disabled={loadingNotifications}
              />
            </div>

            <Separator />

            {/* Error Notifications */}
            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5 flex-1">
                <Label
                  htmlFor="error-notif"
                  className="text-base font-medium cursor-pointer"
                >
                  {t("userSettings.errorNotifications")}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {t("userSettings.errorNotificationsDesc")}
                </p>
              </div>
              <Switch
                id="error-notif"
                checked={errorNotif}
                onCheckedChange={(value) => {
                  setErrorNotif(value);
                  setIsEditingNotifications(true);
                }}
                disabled={loadingNotifications}
              />
            </div>

            <Separator />

            {/* Email Notifications - Pro Feature */}
            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="email-notif"
                    className={`text-base font-medium ${
                      currentPlan === "free"
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    {t("userSettings.emailNotifications")}
                  </Label>
                  <Badge
                    className="text-xs bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0"
                    style={{
                      boxShadow:
                        "0 2px 8px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                </div>
                <p
                  className={`text-sm text-muted-foreground ${
                    currentPlan === "free" ? "opacity-50" : ""
                  }`}
                >
                  {t("userSettings.emailNotificationsDesc")}
                </p>
              </div>
              <Switch
                id="email-notif"
                checked={emailNotifications}
                onCheckedChange={(value) => {
                  setEmailNotifications(value);
                  setIsEditingNotifications(true);
                }}
                disabled={currentPlan === "free" || loadingNotifications}
              />
            </div>

            <Separator />

            {/* Weekly Report - Pro Feature */}
            <div className="flex items-center justify-between py-3">
              <div className="space-y-0.5 flex-1">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="weekly-report"
                    className={`text-base font-medium ${
                      currentPlan === "free"
                        ? "cursor-not-allowed opacity-50"
                        : "cursor-pointer"
                    }`}
                  >
                    {t("userSettings.weeklyReport")}
                  </Label>
                  <Badge
                    className="text-xs bg-gradient-to-r from-blue-600 to-blue-500 text-white border-0"
                    style={{
                      boxShadow:
                        "0 2px 8px rgba(37, 99, 235, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Pro
                  </Badge>
                </div>
                <p
                  className={`text-sm text-muted-foreground ${
                    currentPlan === "free" ? "opacity-50" : ""
                  }`}
                >
                  {t("userSettings.weeklyReportDesc")}
                </p>
              </div>
              <Switch
                id="weekly-report"
                checked={weeklyReport}
                onCheckedChange={(value) => {
                  setWeeklyReport(value);
                  setIsEditingNotifications(true);
                }}
                disabled={currentPlan === "free" || loadingNotifications}
              />
            </div>
          </div>

          {isEditingNotifications && (
            <div className="flex justify-end pt-4 border-t">
              <Button onClick={onSaveNotifications}>
                {t("userSettings.saveChanges")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationsTab;
