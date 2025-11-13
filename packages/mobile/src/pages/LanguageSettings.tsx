import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Preferences } from '@capacitor/preferences';

const LanguageSettings = () => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language);

  const languages = [
    { code: "ko", name: t("profile.korean", "한국어") },
    { code: "en", name: t("profile.english", "English") },
  ];

  const handleSave = async () => {
    await i18n.changeLanguage(selectedLanguage);
    await Preferences.set({
      key: 'language',
      value: selectedLanguage,
    });
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 헤더 */}
      <div className="px-6 py-4 safe-area-top">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      {/* 제목 */}
      <div className="px-6 py-8">
        <h1 className="text-3xl font-bold">{t("profile.selectLanguage", "어떤 언어를 쓸까요?")}</h1>
      </div>

      {/* 언어 목록 */}
      <div className="flex-1 px-6">
        <div className="space-y-2">
          {languages.map((language) => (
            <button
              key={language.code}
              onClick={() => setSelectedLanguage(language.code)}
              className="w-full flex items-center justify-between px-6 py-4 rounded-xl hover:bg-accent transition-colors"
            >
              <span className="text-lg font-medium">{language.name}</span>
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  selectedLanguage === language.code
                    ? "bg-primary"
                    : "bg-muted border-2 border-border"
                }`}
              >
                {selectedLanguage === language.code && (
                  <Check className="h-4 w-4 text-primary-foreground" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="p-6 safe-area-bottom">
        <Button onClick={handleSave} className="w-full h-14 text-lg">
          {t("profile.next", "다음")}
        </Button>
      </div>
    </div>
  );
};

export default LanguageSettings;
