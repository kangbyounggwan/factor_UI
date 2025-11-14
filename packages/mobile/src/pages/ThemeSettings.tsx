import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check } from "lucide-react";
import { useTheme } from "next-themes";

const ThemeSettings = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const themes = [
    {
      value: "dark",
      label: t("profile.themeDark", "Dark"),
      description: t("profile.themeDarkDesc", "어두운 테마")
    },
    {
      value: "light",
      label: t("profile.themeLight", "Light"),
      description: t("profile.themeLightDesc", "밝은 테마")
    },
    {
      value: "system",
      label: t("profile.themeSystem", "System"),
      description: t("profile.themeSystemDesc", "시스템 설정 사용")
    },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-4 border-b safe-area-top">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      {/* 제목 */}
      <div className="px-6 py-8">
        <h1 className="text-3xl font-bold">{t("profile.themeSettings", "화면 테마")}</h1>
        <p className="text-muted-foreground mt-2">{t("profile.selectTheme", "원하는 테마를 선택해주세요")}</p>
      </div>

      {/* 테마 목록 */}
      <div className="flex-1 px-6 pb-6 safe-area-bottom">
        <div className="space-y-3">
          {themes.map((themeOption) => (
            <button
              key={themeOption.value}
              onClick={() => setTheme(themeOption.value)}
              className="w-full"
            >
              <div className={`flex items-center justify-between px-6 py-5 rounded-xl border-2 transition-all ${
                theme === themeOption.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-accent"
              }`}>
                <div className="flex items-center gap-4">
                  {/* 테마 프리뷰 */}
                  <div className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-border">
                    {themeOption.value === "dark" && (
                      <div className="w-full h-full bg-slate-950">
                        <div className="absolute top-2 left-2 right-2 space-y-1">
                          <div className="h-1 bg-emerald-500 w-1/3 rounded"></div>
                          <div className="h-1 bg-slate-700 w-2/3 rounded"></div>
                          <div className="h-1 bg-slate-700 w-1/2 rounded"></div>
                        </div>
                      </div>
                    )}
                    {themeOption.value === "light" && (
                      <div className="w-full h-full bg-white">
                        <div className="absolute top-2 left-2 right-2 space-y-1">
                          <div className="h-1 bg-emerald-500 w-1/3 rounded"></div>
                          <div className="h-1 bg-slate-300 w-2/3 rounded"></div>
                          <div className="h-1 bg-slate-300 w-1/2 rounded"></div>
                        </div>
                      </div>
                    )}
                    {themeOption.value === "system" && (
                      <div className="w-full h-full">
                        <div className="absolute top-0 left-0 w-1/2 h-full bg-white">
                          <div className="absolute top-2 left-1 right-0 space-y-1">
                            <div className="h-1 bg-emerald-500 w-2/3 rounded"></div>
                            <div className="h-1 bg-slate-300 w-full rounded"></div>
                          </div>
                        </div>
                        <div className="absolute top-0 right-0 w-1/2 h-full bg-slate-950">
                          <div className="absolute top-2 left-0 right-1 space-y-1">
                            <div className="h-1 bg-emerald-500 w-2/3 rounded"></div>
                            <div className="h-1 bg-slate-700 w-full rounded"></div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="text-left">
                    <div className="text-lg font-semibold">{themeOption.label}</div>
                    <div className="text-sm text-muted-foreground">{themeOption.description}</div>
                  </div>
                </div>

                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    theme === themeOption.value
                      ? "bg-primary"
                      : "bg-muted border-2 border-border"
                  }`}
                >
                  {theme === themeOption.value && (
                    <Check className="h-4 w-4 text-primary-foreground" />
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;
