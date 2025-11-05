import { useState, useEffect, useRef } from "react";
import { ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FullScreenInputProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (value: string) => void;
  title: string;
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
}

export function FullScreenInput({
  isOpen,
  onClose,
  onConfirm,
  title,
  label,
  value,
  placeholder,
  type = "text",
}: FullScreenInputProps) {
  const [inputValue, setInputValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      // 모달이 열리면 자동으로 포커스
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm(inputValue);
    onClose();
  };

  const handleClear = () => {
    setInputValue("");
    inputRef.current?.focus();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background animate-in fade-in duration-200 flex flex-col"
      style={{ top: 0, left: 0, right: 0, bottom: 0 }}
    >
      {/* 헤더 */}
      <div className="px-6 py-4 safe-area-top">
        <button
          onClick={onClose}
          className="p-2 -ml-2 hover:bg-accent rounded-full transition-colors"
        >
          <ArrowLeft className="h-6 w-6" />
        </button>
      </div>

      {/* 제목 */}
      <div className="px-6 py-8">
        <h1 className="text-3xl font-bold">{title}</h1>
      </div>

      {/* 입력 필드 */}
      <div className="flex-1 px-6">
        <div className="relative">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={placeholder}
            type={type}
            className="w-full h-14 text-lg px-4 border-2 border-border rounded-xl focus-visible:ring-0 focus-visible:border-primary bg-background"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConfirm();
              }
            }}
          />
          {inputValue && (
            <button
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-accent rounded-full transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 하단 확인 버튼 */}
      <div className="p-6 safe-area-bottom">
        <Button
          onClick={handleConfirm}
          disabled={!inputValue.trim()}
          className="w-full h-14 text-lg"
        >
          확인
        </Button>
      </div>
    </div>
  );
}
