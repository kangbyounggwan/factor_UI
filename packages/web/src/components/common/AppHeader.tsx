/**
 * AI 채팅 페이지용 심플 헤더 컴포넌트
 * - AI 도구 / 프린터 탭 스위치
 * - 언어, 테마, 플랜 배지
 */
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sun, Moon, Globe, MessageSquare, Printer, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  sidebarOpen?: boolean;
}

export const AppHeader = ({ sidebarOpen = false }: AppHeaderProps) => {
  const { t, i18n } = useTranslation();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const currentLanguage = i18n.language || 'ko';

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  // 현재 활성 탭
  const isAITools = location.pathname.includes('/ai-chat') || location.pathname.includes('/create');
  const isPrinter = location.pathname.includes('/dashboard') || location.pathname.includes('/printer');

  return (
    <header
      className={cn(
        "sticky top-0 z-20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 transition-all duration-300",
        sidebarOpen ? "ml-0" : "ml-52"
      )}
    >
      <div className="flex h-14 items-center justify-between px-4">
        {/* 왼쪽: 빈 공간 (로고와 메뉴는 사이드바에서 처리) */}
        <div className="flex items-center gap-3" />

        {/* 중앙: 탭 스위치 */}
        <div className="hidden sm:flex items-center">
          <div className="flex items-center bg-muted rounded-full p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/ai-chat')}
              className={cn(
                "rounded-full px-4 h-8 text-sm font-medium transition-colors",
                isAITools
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="w-4 h-4 mr-2" />
              {t('nav.aiTools', 'AI 도구')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className={cn(
                "rounded-full px-4 h-8 text-sm font-medium transition-colors",
                isPrinter
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Printer className="w-4 h-4 mr-2" />
              {t('nav.printers', '프린터')}
            </Button>
          </div>
        </div>

        {/* 오른쪽: 언어/테마 그룹 + 플랜 배지 */}
        <div className="flex items-center gap-3">
          {/* 언어 + 테마 버튼 그룹 */}
          <div className="flex items-center bg-muted rounded-full p-1">
            {/* 언어 선택 */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-background"
                >
                  <Globe className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => changeLanguage('ko')}>
                  한국어 {currentLanguage === 'ko' && '✓'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage('en')}>
                  English {currentLanguage === 'en' && '✓'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* 테마 토글 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-8 w-8 rounded-full hover:bg-background"
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>

          {/* 플랜 배지 */}
          <Badge
            variant="outline"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-800 dark:bg-purple-950 dark:text-purple-400 text-xs font-medium"
          >
            <Sparkles className="w-3 h-3" />
            Free
          </Badge>
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
