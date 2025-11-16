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
import { useSafeAreaStyle } from "@/hooks/usePlatform";

const UserSettings = () => {
  const { user, signOut, isAdmin } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [scrollY, setScrollY] = useState(0);

  // Safe Area 패딩 (BottomNavigation 고려)
  const safeAreaStyle = useSafeAreaStyle({
    bottom: true,
    bottomPadding: '2rem',
  });

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t("common.user");
  const bio = user?.user_metadata?.bio || `${t("profile.myInfo")} · ${t("profile.addressManagement")}`;
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
          label: t("profile.language"),
          value: currentLanguage,
          onClick: () => navigate("/language-settings"),
        },
      ],
    },
    {
      items: [
        {
          icon: Bell,
          label: t("profile.notificationSettings"),
          onClick: () => navigate("/notification-settings"),
        },
        {
          icon: theme === "dark" ? Moon : Sun,
          label: t("profile.theme"),
          onClick: () => navigate("/theme-settings"),
        },
      ],
    },
    {
      title: t("profile.account"),
      items: [
        {
          icon: Shield,
          label: t("profile.socialAccountLink"),
          onClick: () => navigate("/social-account-linking"),
        },
        {
          icon: Shield,
          label: t("profile.changePassword"),
          onClick: () => navigate("/change-password"),
        },
      ],
    },
    {
      title: t("profile.support"),
      items: [
        {
          icon: HelpCircle,
          label: t("profile.helpCenter"),
          onClick: () => console.log("Help center"),
        },
        {
          icon: FileText,
          label: t("profile.termsOfService"),
          onClick: () => navigate('/terms'),
        },
        {
          icon: FileText,
          label: t("profile.privacyPolicy"),
          onClick: () => navigate('/privacy'),
        },
      ],
    },
    {
      title: t("profile.dangerZone"),
      items: [
        {
          icon: Trash2,
          label: t("profile.deleteAccount"),
          onClick: () => setShowDeleteDialog(true),
        },
      ],
    },
  ];

  // 스크롤 진행도 계산 (0 ~ 1)
  const maxScroll = 100; // 최대 스크롤 거리
  const scrollProgress = Math.min(scrollY / maxScroll, 1);

  // 축소된 상태에서의 높이
  const headerHeight = 80 + (48 * (1 - scrollProgress)); // 80px(최소) ~ 128px(최대)
  const avatarSize = 40 + (24 * (1 - scrollProgress)); // 40px(최소) ~ 64px(최대)
  const nameSize = scrollProgress > 0.5 ? 'text-lg' : 'text-xl';
  const bioOpacity = 1 - scrollProgress;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollY(e.currentTarget.scrollTop);
  };

  return (
    <div className="h-screen bg-background flex flex-col" style={safeAreaStyle}>
      {/* 고정 프로필 헤더 */}
      <div
        className="sticky top-0 z-10 bg-background border-b safe-area-top transition-all duration-200"
        style={{
          height: `${headerHeight}px`,
          minHeight: '80px'
        }}
      >
        <div className="flex items-center gap-4 px-6 h-full">
          <div className="relative flex-shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="rounded-full object-cover bg-gradient-to-br from-blue-400 to-blue-600 transition-all duration-200"
                style={{
                  width: `${avatarSize}px`,
                  height: `${avatarSize}px`
                }}
              />
            ) : (
              <div
                className="flex items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 transition-all duration-200"
                style={{
                  width: `${avatarSize}px`,
                  height: `${avatarSize}px`
                }}
              >
                <span className={scrollProgress > 0.5 ? 'text-xl' : 'text-2xl'}>😎</span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className={`font-semibold truncate transition-all duration-200 ${nameSize}`}>
              {displayName}
            </h2>
            <p
              className="text-sm text-muted-foreground truncate transition-opacity duration-200"
              style={{ opacity: bioOpacity }}
            >
              {bio}
            </p>
          </div>

          <button
            onClick={() => navigate(`/user-profile/${user?.id}`)}
            className="p-2 hover:bg-accent rounded-full transition-colors flex-shrink-0"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* 스크롤 가능한 메뉴 섹션 */}
      <div
        className="flex-1 overflow-y-auto px-4 py-2"
        onScroll={handleScroll}
      >
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

        {/* 관리자 페이지 버튼 (관리자인 경우에만 표시) */}
        {isAdmin && (
          <div className="pb-4">
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-card rounded-lg border hover:bg-accent transition-colors"
            >
              <Settings className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium text-primary">
                {t("nav.admin")}
              </span>
            </button>
          </div>
        )}

        {/* 로그아웃 버튼 */}
        <div className="pb-6">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-card rounded-lg border hover:bg-accent transition-colors"
          >
            <LogOut className="h-5 w-5 text-destructive" />
            <span className="text-sm font-medium text-destructive">
              {t("profile.signOut")}
            </span>
          </button>
        </div>
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
