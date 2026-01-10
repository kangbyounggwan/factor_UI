/**
 * WelcomeScreen 컴포넌트
 * 채팅 메시지가 없을 때 표시되는 초기 화면
 * - 인사말 및 애니메이션
 * - 입력창
 * - 빠른 프롬프트 버튼들
 */

import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { FilePreviewList } from "@/components/ai/FilePreviewList";
import { useIsMobile } from "@/hooks/use-mobile";

export interface WelcomeScreenProps {
  // 파일 상태
  uploadedImages: string[];
  gcodeFile: File | null;
  onRemoveImage: (index: number) => void;
  onRemoveGcode: () => void;

  // 도구 상태
  selectedTool: string | null;
  setSelectedTool: (tool: string | null) => void;
  setInput: (input: string) => void;

  // 로그인 상태
  user: { id: string } | null;
  onLoginRequired: () => void;

  // 입력 박스 렌더링 함수
  renderInputBox: (placeholder: string) => React.ReactNode;
}

export function WelcomeScreen({
  uploadedImages,
  gcodeFile,
  onRemoveImage,
  onRemoveGcode,
  selectedTool,
  setSelectedTool,
  setInput,
  user,
  onLoginRequired,
  renderInputBox,
}: WelcomeScreenProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  // 빠른 프롬프트 버튼 클릭 핸들러
  const handleQuickPrompt = (tool: string, prompt: string) => {
    if (!user) {
      onLoginRequired();
      return;
    }
    setSelectedTool(tool);
    setInput(prompt);
  };

  // 모델링 프롬프트 (별도 페이지로 이동)
  const handleModelingPrompt = (prompt: string) => {
    if (!user) {
      onLoginRequired();
      return;
    }
    navigate('/create', { state: { prompt } });
  };

  // 플레이스홀더 결정
  const getPlaceholder = () => {
    if (selectedTool === "troubleshoot") {
      return t('aiChat.troubleshootPlaceholder', '문제 상황에 대한 이미지와 증상 내용이 있으면 더 좋아요');
    }
    if (selectedTool === "gcode") {
      return t('aiChat.gcodePlaceholder', 'G-code 파일을 업로드하거나 문제 내용을 붙여넣어보세요');
    }
    if (selectedTool === "modeling") {
      return t('aiChat.modelingPlaceholder', '만들고 싶은 3D 모델을 설명해주세요');
    }
    return t('aiChat.defaultPlaceholder', 'FACTOR AI에게 물어보세요');
  };

  return (
    <div className="flex flex-col items-center justify-center px-4 py-6 w-full h-full overflow-hidden box-border">
        {/* 인사말 */}
        <div className="text-center mb-6 w-full max-w-full px-2">
          {/* 스타카토 애니메이션 */}
          <div className="flex justify-center gap-1.5 mb-3">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '450ms' }} />
          </div>
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-2 break-words leading-tight">
            {isMobile
              ? t('aiChat.askAnything', '출력 문제가 생겼나요?\n뭔가 이상하다면').split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 && <br />}</span>
                ))
              : t('aiChat.askAnythingDesktop', '출력 문제가 생겼나요? 뭔가 이상하다면')
            }
          </h1>
          <p className="text-sm sm:text-base md:text-xl lg:text-2xl font-medium text-muted-foreground break-words">
            {t('aiChat.greeting', '지금 어떤 문제가 생겼는지 그대로 보여주세요')}
          </p>
        </div>

        {/* 중앙 입력창 */}
        <div className="w-full max-w-2xl px-2">
          {/* 업로드된 미리보기 */}
          <FilePreviewList
            images={uploadedImages}
            gcodeFile={gcodeFile}
            onRemoveImage={onRemoveImage}
            onRemoveGcode={onRemoveGcode}
            className="mb-3"
          />

          {renderInputBox(getPlaceholder())}

          {/* 빠른 테스트 버튼 - 도구별 활용 예시 */}
          <div className="flex flex-col items-center gap-2 mt-6 sm:mt-8">
            {/* 첫째 줄 */}
            <div className="flex flex-wrap justify-center gap-2 w-full">
              <button
                onClick={() => handleQuickPrompt('gcode', t('aiChat.quickPrompt.gcodeOptimize', '출력 시간 줄이고 싶은데 G-code 봐줘'))}
                className="px-3 py-1.5 text-xs sm:text-sm bg-blue-500/10 hover:bg-blue-500/20 rounded-full border border-blue-500/30 transition-colors text-blue-600 dark:text-blue-400"
              >
                {t('aiChat.quickPrompt.gcodeOptimize', '출력 시간 줄이고 싶어')}
              </button>
              <button
                onClick={() => handleQuickPrompt('gcode', t('aiChat.quickPrompt.gcodeCheck', '이 G-code 문제 있는지 확인해줘'))}
                className="px-3 py-1.5 text-xs sm:text-sm bg-blue-500/10 hover:bg-blue-500/20 rounded-full border border-blue-500/30 transition-colors text-blue-600 dark:text-blue-400"
              >
                {t('aiChat.quickPrompt.gcodeCheck', 'G-code 문제 확인해줘')}
              </button>
              <button
                onClick={() => handleQuickPrompt('troubleshoot', t('aiChat.quickPrompt.stringing', '출력물에 실 같은 게 달려있어요'))}
                className="px-3 py-1.5 text-xs sm:text-sm bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full border border-emerald-500/30 transition-colors text-emerald-600 dark:text-emerald-400"
              >
                {t('aiChat.quickPrompt.stringing', '실 같은 게 달려있어요')}
              </button>
            </div>

            {/* 둘째 줄 */}
            <div className="flex flex-wrap justify-center gap-2 w-full">
              <button
                onClick={() => handleQuickPrompt('troubleshoot', t('aiChat.quickPrompt.warping', '첫 레이어가 베드에서 떨어져요'))}
                className="px-3 py-1.5 text-xs sm:text-sm bg-emerald-500/10 hover:bg-emerald-500/20 rounded-full border border-emerald-500/30 transition-colors text-emerald-600 dark:text-emerald-400"
              >
                {t('aiChat.quickPrompt.warping', '베드에서 떨어져요')}
              </button>
              <button
                onClick={() => handleModelingPrompt(t('aiChat.quickPrompt.modeling', '스마트폰 거치대 만들어줘'))}
                className="px-3 py-1.5 text-xs sm:text-sm bg-purple-500/10 hover:bg-purple-500/20 rounded-full border border-purple-500/30 transition-colors text-purple-600 dark:text-purple-400"
              >
                {t('aiChat.quickPrompt.modeling', '스마트폰 거치대 만들어줘')}
              </button>
            </div>
          </div>
        </div>
    </div>
  );
}

export default WelcomeScreen;
