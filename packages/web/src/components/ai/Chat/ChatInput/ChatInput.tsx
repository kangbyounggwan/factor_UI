/**
 * ChatInput 컴포넌트
 * AI 채팅의 입력 영역을 담당
 * - 텍스트 입력 (Textarea)
 * - 파일 업로드 버튼
 * - 도구 선택 드롭다운
 * - 모델 선택 드롭다운
 * - 전송 버튼
 */

import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Send,
  Cpu,
  FileCode2,
  Stethoscope,
  Loader2,
  X,
  Plus,
  Settings2,
  ChevronDown,
  Check,
  Box,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SubscriptionPlan } from "@shared/types/subscription";

// 도구 타입 정의
export interface ToolItem {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  description: string;
  color: string;
  bgColor: string;
}

// 모델 선택 타입
export interface SelectedModel {
  provider: "google" | "openai";
  model: string;
}

export interface ChatInputProps {
  // 입력 상태
  input: string;
  setInput: (value: string) => void;
  isLoading: boolean;
  isDragging: boolean;

  // 파일 상태
  uploadedImages: string[];
  gcodeFile: File | null;

  // 도구/모델 상태
  selectedTool: string | null;
  setSelectedTool: (tool: string | null) => void;
  selectedModel: SelectedModel;
  setSelectedModel: (model: SelectedModel) => void;

  // 사용자 정보
  user: { id: string } | null;
  userPlan: SubscriptionPlan | null;

  // 핸들러
  onSend: () => void;
  onLoginRequired: () => void;

  // 파일 입력 refs
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  gcodeInputRef: React.RefObject<HTMLInputElement | null>;

  // 드래그 핸들러
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => Promise<void>;

  // 붙여넣기 핸들러
  onPaste: (e: React.ClipboardEvent) => void;

  // 플레이스홀더
  placeholder?: string;
}

export function ChatInput({
  input,
  setInput,
  isLoading,
  isDragging,
  uploadedImages,
  gcodeFile,
  selectedTool,
  setSelectedTool,
  selectedModel,
  setSelectedModel,
  user,
  userPlan,
  onSend,
  onLoginRequired,
  fileInputRef,
  gcodeInputRef,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onPaste,
  placeholder,
}: ChatInputProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 도구 목록
  const tools: ToolItem[] = [
    {
      id: "troubleshoot",
      icon: Stethoscope,
      label: t("ai.printerTroubleshooting", "프린터 문제 진단"),
      description: t("ai.troubleshootDesc", "이미지로 프린터 문제를 분석합니다"),
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      id: "gcode",
      icon: FileCode2,
      label: t("ai.gcodeAnalysis", "G-code 분석"),
      description: t("ai.gcodeDesc", "G-code 파일을 분석하고 최적화합니다"),
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      id: "modeling",
      icon: Box,
      label: t("ai.modeling3d", "3D 모델링"),
      description: t("ai.modelingDesc", "텍스트로 3D 모델을 생성합니다"),
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      id: "price_comparison",
      icon: DollarSign,
      label: t("ai.priceComparison", "가격 비교"),
      description: t("ai.priceComparisonDesc", "3D 프린터, 부품, 필라멘트 가격 비교"),
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
  ];

  // 현재 선택된 도구
  const currentTool = tools.find((t) => t.id === selectedTool);

  // 도구 선택 핸들러
  const handleToolSelect = (toolId: string) => {
    // 익명 사용자는 general 외 도구 사용 불가
    if (!user && toolId !== "general") {
      onLoginRequired();
      return;
    }

    // 3D 모델링 선택 시 create 페이지로 이동
    if (toolId === "modeling") {
      navigate("/create");
      return;
    }

    // 같은 도구 다시 선택하면 해제
    if (selectedTool === toolId) {
      setSelectedTool(null);
    } else {
      setSelectedTool(toolId);
    }
  };

  // 키보드 핸들러
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() || uploadedImages.length > 0 || gcodeFile) {
        onSend();
      }
    }
  };

  // Textarea 높이 자동 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  // 기본 플레이스홀더 결정
  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    if (selectedTool === "troubleshoot") {
      return t(
        "aiChat.troubleshootPlaceholder",
        "문제 상황에 대한 이미지와 증상 내용이 있으면 더 좋아요"
      );
    }
    if (selectedTool === "gcode") {
      return t(
        "aiChat.gcodePlaceholder",
        "G-code 파일을 업로드하거나 문제 내용을 붙여넣어보세요"
      );
    }
    if (selectedTool === "modeling") {
      return t("aiChat.modelingPlaceholder", "만들고 싶은 3D 모델을 설명해주세요");
    }
    if (selectedTool === "price_comparison") {
      return t("aiChat.priceComparisonPlaceholder", "비교하고 싶은 제품명을 입력하세요 (예: Ender 3 V2)");
    }
    return t("aiChat.defaultPlaceholder", "FACTOR AI에게 물어보세요");
  };

  // 모델 표시 이름
  const getModelDisplayName = () => {
    switch (selectedModel.model) {
      case "gemini-2.5-flash-lite":
        return "Gemini 2.5 Flash Lite";
      case "gemini-2.5-flash":
        return "Gemini 2.5 Flash";
      case "gemini-2.5-pro":
        return "Gemini 2.5 Pro";
      case "gpt-4o-mini":
        return "GPT-4o mini";
      case "gpt-4o":
        return "GPT-4o";
      case "gpt-4.1":
        return "GPT-4.1";
      default:
        return t("aiChat.model", "모델");
    }
  };

  const canSend = (input.trim() || uploadedImages.length > 0 || gcodeFile) && !isLoading;

  return (
    <div
      className={cn(
        "bg-muted/50 rounded-3xl border shadow-sm hover:shadow-md transition-all overflow-hidden",
        isDragging
          ? "border-primary border-2 bg-primary/5"
          : "border-gray-300 dark:border-border"
      )}
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* 드래그 오버레이 */}
      {isDragging && (
        <div className="absolute inset-0 flex items-center justify-center bg-primary/10 z-10 rounded-3xl">
          <p className="text-primary font-medium">이미지를 여기에 놓으세요</p>
        </div>
      )}

      {/* 상단: 입력창 */}
      <div className="relative flex items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={onPaste}
          placeholder={getPlaceholder()}
          className="flex-1 min-h-[44px] max-h-[200px] py-3 px-5 resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-muted-foreground/60 overflow-hidden"
          rows={1}
        />

        {/* 전송 버튼 */}
        <div className="flex items-center gap-1 pr-3 pb-2">
          <Button
            size="icon"
            variant="ghost"
            className={cn(
              "shrink-0 rounded-full h-9 w-9 transition-colors",
              canSend
                ? "text-primary hover:text-primary/80 hover:bg-primary/10"
                : "text-muted-foreground/50"
            )}
            disabled={!canSend}
            onClick={onSend}
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </div>
      </div>

      {/* 하단: 도구 라인 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50">
        {/* + 버튼 - 선택된 도구에 따라 다른 파일 업로드 */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-9 w-9 rounded-full hover:bg-muted"
          onClick={() => {
            if (selectedTool === "gcode") {
              gcodeInputRef.current?.click();
            } else {
              fileInputRef.current?.click();
            }
          }}
          title={
            selectedTool === "gcode"
              ? t("aiChat.attachGcode", "G-code 파일 첨부")
              : t("aiChat.attachImage", "이미지 첨부")
          }
        >
          <Plus className="w-5 h-5 text-muted-foreground" />
        </Button>

        {/* 도구 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-9 px-4 rounded-full text-sm font-medium gap-2 transition-colors",
                selectedTool && currentTool
                  ? `${currentTool.bgColor} ${currentTool.color} border border-current/30 hover:opacity-80`
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {currentTool ? (
                <>
                  <currentTool.icon className="w-4 h-4" />
                  {currentTool.label}
                </>
              ) : (
                <>
                  <Settings2 className="w-4 h-4" />
                  {t("aiChat.tools", "도구")}
                </>
              )}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-3 rounded-3xl">
            {tools.map((tool) => {
              const Icon = tool.icon;
              const isSelected = selectedTool === tool.id;
              return (
                <DropdownMenuItem
                  key={tool.id}
                  onClick={() => handleToolSelect(tool.id)}
                  className={cn(
                    "flex items-start gap-4 cursor-pointer rounded-2xl p-4 transition-all",
                    isSelected ? `${tool.bgColor} ${tool.color}` : "hover:bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                      isSelected ? "bg-background shadow-sm" : tool.bgColor
                    )}
                  >
                    <Icon className={cn("w-6 h-6", tool.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-sm font-semibold",
                        isSelected ? tool.color : "text-foreground"
                      )}
                    >
                      {tool.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {tool.description}
                    </div>
                  </div>
                  {isSelected && <Check className={cn("w-5 h-5 shrink-0 mt-1", tool.color)} />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* 선택된 도구가 있을 때 해제 버튼 */}
        {selectedTool && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9 px-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
            onClick={() => setSelectedTool(null)}
          >
            <X className="w-4 h-4" />
          </Button>
        )}

        {/* 오른쪽 정렬을 위한 spacer */}
        <div className="flex-1" />

        {/* 모델 선택 드롭다운 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 px-4 rounded-full text-sm font-medium gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <Cpu className="w-4 h-4" />
              {getModelDisplayName()}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 p-2 rounded-2xl">
            {/* Google */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={cn(
                  "flex items-center gap-3 cursor-pointer rounded-xl p-3",
                  selectedModel.provider === "google" ? "bg-blue-500/10" : "hover:bg-muted"
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">Google</div>
                  <div className="text-xs text-muted-foreground">Gemini 모델</div>
                </div>
                {selectedModel.provider === "google" && (
                  <Check className="w-4 h-4 text-blue-500" />
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-2 rounded-2xl">
                {/* 무료 모델 */}
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
                  {t("aiChat.freeModels", "무료 모델")}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 cursor-pointer rounded-xl p-3 hover:bg-muted",
                    selectedModel.provider === "google" &&
                      selectedModel.model === "gemini-2.5-flash-lite" &&
                      "bg-blue-500/10"
                  )}
                  onClick={() =>
                    setSelectedModel({ provider: "google", model: "gemini-2.5-flash-lite" })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">
                      Gemini 2.5 Flash Lite
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {t("aiChat.fastAndEfficient", "빠르고 효율적")}
                    </div>
                  </div>
                  {selectedModel.provider === "google" &&
                    selectedModel.model === "gemini-2.5-flash-lite" && (
                      <Check className="w-4 h-4 text-blue-500" />
                    )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {/* 유료 모델 */}
                <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5">
                  {t("aiChat.paidModels", "유료 모델")}
                </DropdownMenuLabel>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    !userPlan || userPlan === "free"
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === "google" &&
                      selectedModel.model === "gemini-2.5-flash" &&
                      "bg-blue-500/10"
                  )}
                  disabled={!userPlan || userPlan === "free"}
                  onClick={() =>
                    userPlan &&
                    userPlan !== "free" &&
                    setSelectedModel({ provider: "google", model: "gemini-2.5-flash" })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Gemini 2.5 Flash</div>
                    <div className="text-xs text-muted-foreground">
                      {t("aiChat.starterAndAbove", "Starter 이상")}
                    </div>
                  </div>
                  {selectedModel.provider === "google" &&
                    selectedModel.model === "gemini-2.5-flash" && (
                      <Check className="w-4 h-4 text-blue-500" />
                    )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    !userPlan || userPlan === "free"
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === "google" &&
                      selectedModel.model === "gemini-2.5-pro" &&
                      "bg-blue-500/10"
                  )}
                  disabled={!userPlan || userPlan === "free"}
                  onClick={() =>
                    userPlan &&
                    userPlan !== "free" &&
                    setSelectedModel({ provider: "google", model: "gemini-2.5-pro" })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">Gemini 2.5 Pro</div>
                    <div className="text-xs text-muted-foreground">
                      {t("aiChat.latestModel", "최신 모델")}
                    </div>
                  </div>
                  {selectedModel.provider === "google" &&
                    selectedModel.model === "gemini-2.5-pro" && (
                      <Check className="w-4 h-4 text-blue-500" />
                    )}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* OpenAI */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                className={cn(
                  "flex items-center gap-3 rounded-xl p-3",
                  !userPlan || userPlan === "free"
                    ? "opacity-50 cursor-not-allowed"
                    : "cursor-pointer",
                  selectedModel.provider === "openai" ? "bg-emerald-500/10" : "hover:bg-muted"
                )}
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <Cpu className="w-5 h-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground">OpenAI</div>
                  <div className="text-xs text-muted-foreground">
                    {!userPlan || userPlan === "free"
                      ? t("aiChat.starterAndAbove", "Starter 이상")
                      : "GPT 모델"}
                  </div>
                </div>
                {selectedModel.provider === "openai" && (
                  <Check className="w-4 h-4 text-emerald-500" />
                )}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-64 p-2 rounded-2xl">
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    !userPlan || userPlan === "free"
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === "openai" &&
                      selectedModel.model === "gpt-4o-mini" &&
                      "bg-emerald-500/10"
                  )}
                  disabled={!userPlan || userPlan === "free"}
                  onClick={() =>
                    userPlan &&
                    userPlan !== "free" &&
                    setSelectedModel({ provider: "openai", model: "gpt-4o-mini" })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-4o mini</div>
                    <div className="text-xs text-muted-foreground">
                      {t("aiChat.fastAndEfficient", "빠르고 효율적")}
                    </div>
                  </div>
                  {selectedModel.provider === "openai" &&
                    selectedModel.model === "gpt-4o-mini" && (
                      <Check className="w-4 h-4 text-emerald-500" />
                    )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    !userPlan || userPlan === "free"
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === "openai" &&
                      selectedModel.model === "gpt-4o" &&
                      "bg-emerald-500/10"
                  )}
                  disabled={!userPlan || userPlan === "free"}
                  onClick={() =>
                    userPlan &&
                    userPlan !== "free" &&
                    setSelectedModel({ provider: "openai", model: "gpt-4o" })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-4o</div>
                    <div className="text-xs text-muted-foreground">
                      {t("aiChat.webSearchEnabled", "웹 검색 지원")}
                    </div>
                  </div>
                  {selectedModel.provider === "openai" && selectedModel.model === "gpt-4o" && (
                    <Check className="w-4 h-4 text-emerald-500" />
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className={cn(
                    "flex items-center gap-3 rounded-xl p-3",
                    !userPlan || userPlan === "free"
                      ? "opacity-50 cursor-not-allowed"
                      : "cursor-pointer hover:bg-muted",
                    selectedModel.provider === "openai" &&
                      selectedModel.model === "gpt-4.1" &&
                      "bg-emerald-500/10"
                  )}
                  disabled={!userPlan || userPlan === "free"}
                  onClick={() =>
                    userPlan &&
                    userPlan !== "free" &&
                    setSelectedModel({ provider: "openai", model: "gpt-4.1" })
                  }
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">GPT-4.1</div>
                    <div className="text-xs text-muted-foreground">
                      {t("aiChat.latestModel", "최신 모델")}
                    </div>
                  </div>
                  {selectedModel.provider === "openai" && selectedModel.model === "gpt-4.1" && (
                    <Check className="w-4 h-4 text-emerald-500" />
                  )}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default ChatInput;
