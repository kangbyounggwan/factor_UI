import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@shared/contexts/AuthContext";
import {
  Globe,
  Bell,
  Moon,
  Shield,
  FileText,
  HelpCircle,
  LogOut,
  ChevronRight,
  Sun,
  Settings,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { DeleteAccountDialog } from "@/components/DeleteAccountDialog";

const UserSettings = () => {
  const { user, signOut, isAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t("common.user", "사용자");
  const bio = user?.user_metadata?.bio || `${t("profile.myInfo", "내 정보")} · ${t("profile.addressManagement", "주소 관리")}`;
  const avatarUrl = user?.user_metadata?.avatar_url || "";

  // 현재 선택된 언어 표시
  const currentLanguage = i18n.language === 'ko' ? '한국어' : 'English';

  type MenuItem = {
    icon: typeof Globe;
    label: string;
    value?: string;
    onClick: () => void;
  };

  type MenuSection = {
    title?: string;
    items: MenuItem[];
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/", { replace: true });
  };

  const menuSections: MenuSection[] = [
    {
      items: [
        {
          icon: Globe,
          label: t("profile.language", "언어"),
          value: currentLanguage,
          onClick: () => navigate("/language-settings"),
        },
      ],
    },
    {
      items: [
        {
          icon: Bell,
          label: t("profile.notificationSettings", "알림 설정"),
          onClick: () => navigate("/notification-settings"),
        },
        {
          icon: theme === "dark" ? Moon : Sun,
          label: t("profile.theme", "화면 테마"),
          onClick: () => navigate("/theme-settings"),
        },
      ],
    },
    {
      title: t("profile.account", "계정"),
      items: [
        {
          icon: Shield,
          label: t("profile.socialAccountLink", "소셜 계정 연동"),
          onClick: () => navigate("/social-account-linking"),
        },
        {
          icon: Shield,
          label: t("profile.changePassword", "비밀번호 변경"),
          onClick: () => navigate("/change-password"),
        },
      ],
    },
    {
      title: t("profile.subscriptionPayment", "구독 및 결제"),
      items: [
        {
          icon: FileText,
          label: t("profile.subscriptionPlan", "구독 플랜 관리"),
          onClick: () => navigate("/subscription"),
        },
        {
          icon: FileText,
          label: t("profile.paymentHistory", "결제 내역"),
          onClick: () => console.log("Payment history"),
        },
        {
          icon: FileText,
          label: t("profile.paymentMethod", "결제 수단"),
          onClick: () => console.log("Payment method"),
        },
      ],
    },
    {
      title: t("profile.support", "고객 지원"),
      items: [
        {
          icon: HelpCircle,
          label: t("profile.helpCenter", "도움말 센터"),
          onClick: () => console.log("Help center"),
        },
        {
          icon: FileText,
          label: t("profile.termsOfService", "이용 약관"),
          onClick: () => navigate('/terms'),
        },
        {
          icon: FileText,
          label: t("profile.privacyPolicy", "개인정보 처리방침"),
          onClick: () => navigate('/privacy'),
        },
      ],
    },
    {
      title: t("profile.dangerZone", "위험 구역"),
      items: [
        {
          icon: Trash2,
          label: t("profile.deleteAccount", "계정 삭제"),
          onClick: () => setShowDeleteDialog(true),
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* 프로필 헤더 */}
      <div className="bg-background border-b px-6 pb-4 safe-area-top">
        <div className="flex items-center gap-4 pt-3">
          <div className="relative">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="w-16 h-16 rounded-full object-cover bg-gradient-to-br from-blue-400 to-blue-600"
              />
            ) : (
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600">
                <span className="text-2xl">😎</span>
              </div>
            )}
          </div>

          <div className="flex-1">
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <p className="text-sm text-muted-foreground">{bio}</p>
          </div>

          <button
            onClick={() => navigate(`/user-profile/${user?.id}`)}
            className="p-2 hover:bg-accent rounded-full transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* 메뉴 섹션 */}
      <div className="px-4 py-2">
        {menuSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-6">
            {section.title && (
              <h3 className="text-sm font-semibold text-muted-foreground px-2 mb-2">
                {section.title}
              </h3>
            )}
            <div className="bg-card rounded-lg overflow-hidden border">
              {section.items.map((item, itemIndex) => (
                <button
                  key={itemIndex}
                  onClick={item.onClick}
                  className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-accent transition-colors border-b last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.value && (
                      <span className="text-sm text-primary">{item.value}</span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 관리자 페이지 버튼 (관리자인 경우에만 표시) */}
      {isAdmin && (
        <div className="px-4 pb-4">
          <button
            onClick={() => navigate("/admin")}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-card rounded-lg border hover:bg-accent transition-colors"
          >
            <Settings className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-primary">
              {t("nav.admin", "관리자")}
            </span>
          </button>
        </div>
      )}

      {/* 로그아웃 버튼 */}
      <div className="px-4 pb-20">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-card rounded-lg border hover:bg-accent transition-colors"
        >
          <LogOut className="h-5 w-5 text-destructive" />
          <span className="text-sm font-medium text-destructive">
            {t("profile.signOut", "로그아웃")}
          </span>
        </button>
      </div>

      {/* 계정 삭제 다이얼로그 */}
      <DeleteAccountDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      />
    </div>
  );
};

export default UserSettings;
