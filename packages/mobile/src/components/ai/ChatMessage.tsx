/**
 * 모바일 채팅 메시지 컴포넌트
 * - 사용자 메시지와 AI 메시지를 렌더링
 * - 마크다운 렌더링, 참조 이미지/링크 포함
 * - 웹 버전과 동일한 뷰어 형식
 */
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Cpu, ExternalLink, ImageIcon, X, ZoomIn, Link2, AlertCircle, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { ReferenceImages, ReferenceImage } from "@shared/services/chatApiService";

// 참고 자료 타입
export interface ReferenceInfo {
  title: string;
  url: string;
  source?: string;
  snippet?: string;
}

// 제안 액션 타입
export interface SuggestedAction {
  label: string;
  action: string;
  data?: Record<string, unknown>;
}

// 메시지 타입 정의
export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  references?: ReferenceInfo[];
  suggestedActions?: SuggestedAction[];
  referenceImages?: ReferenceImages;
}

interface ChatMessageProps {
  message: ChatMessageData;
  onSuggestedAction?: (action: SuggestedAction) => void;
}

/**
 * 마크다운 컴포넌트 설정 (모바일 최적화)
 */
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-lg font-bold mt-4 mb-3 pb-1.5 border-b border-border">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-bold mt-4 mb-2 pb-1 border-b border-border/50">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold mt-3 mb-2">
      {children}
    </h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => {
    const childArray = Array.isArray(children) ? children : [children];
    const isBoldOnlyLine = childArray.length === 1 &&
      typeof childArray[0] === 'object' &&
      childArray[0] !== null &&
      (childArray[0] as React.ReactElement).type === 'strong';

    if (isBoldOnlyLine) {
      return (
        <p className="my-3 mt-4 text-sm font-bold leading-relaxed">
          {children}
        </p>
      );
    }
    return (
      <p className="my-2 text-sm leading-relaxed">
        {children}
      </p>
    );
  },
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline"
    >
      {children}
    </a>
  ),
  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono" {...props}>
        {children}
      </code>
    ) : (
      <code className={cn("block bg-muted p-2 rounded-lg text-xs font-mono overflow-x-auto", className)} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted rounded-lg overflow-x-auto my-3">
      {children}
    </pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 space-y-1.5 my-3 text-sm">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-5 space-y-1.5 my-3 text-sm">
      {children}
    </ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => {
    const childArray = Array.isArray(children) ? children : [children];
    const hasContent = childArray.some(child => {
      if (typeof child === 'string') return child.trim().length > 0;
      if (typeof child === 'object' && child !== null) return true;
      return false;
    });

    if (!hasContent) {
      return null;
    }

    return (
      <li className="my-1 leading-relaxed [&>p]:inline [&>p]:my-0 [&>strong]:font-bold">
        {children}
      </li>
    );
  },
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-3">
      <table className="min-w-full border-collapse border border-border text-xs">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border bg-muted px-2 py-1.5 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border px-2 py-1.5">
      {children}
    </td>
  ),
  hr: () => (
    <hr className="my-4 border-t border-border/60" />
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/50 pl-3 my-3 italic text-muted-foreground bg-muted/30 py-2 rounded-r-lg text-sm">
      {children}
    </blockquote>
  ),
};

/**
 * 출처 정보 타입
 */
interface SourceInfo {
  title: string;
  url: string;
}

/**
 * 마크다운에서 출처/참고 자료 링크를 추출하고 본문과 분리
 */
function extractSources(content: string): { cleanContent: string; sources: SourceInfo[] } {
  const sources: SourceInfo[] = [];

  const sourcePatterns = [
    /📚\s*참고\s*자료:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*출처:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📎\s*출처:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*출처:\s*(.+?)(?=\n\n|\n(?=[#\d])|$)/gs,
    /📚\s*참고\s*자료:\s*(.+?)(?=\n\n|\n(?=[#\d])|$)/gs,
    /\*\*참고\s*자료:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*출처:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*Sources?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*References?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*Sources?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*References?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
  ];

  let cleanContent = content;

  for (const pattern of sourcePatterns) {
    cleanContent = cleanContent.replace(pattern, (match, sourceText) => {
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let linkMatch;
      while ((linkMatch = linkPattern.exec(sourceText)) !== null) {
        const title = linkMatch[1].trim();
        const url = linkMatch[2].trim();
        if (url.startsWith('http') && !sources.some(s => s.url === url)) {
          sources.push({ title, url });
        }
      }
      return '';
    });
  }

  cleanContent = cleanContent.replace(/\*\*\s*\*\*/g, '');
  cleanContent = cleanContent.replace(/\*\*\s*\n\s*\*\*/g, '');
  cleanContent = cleanContent.replace(/^\s*\*\*\s*$/gm, '');
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanContent, sources };
}

/**
 * 사용자 메시지 컴포넌트
 */
const UserMessage: React.FC<{ message: ChatMessageData }> = ({ message }) => (
  <div className="flex justify-end">
    <div className="max-w-[85%]">
      {/* 이미지 미리보기 */}
      {message.images && message.images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 justify-end">
          {message.images.map((img, imgIdx) => (
            <img
              key={imgIdx}
              src={img}
              alt={`uploaded-${imgIdx}`}
              className="w-20 h-20 object-cover rounded-lg border"
            />
          ))}
        </div>
      )}
      {/* 메시지 내용 */}
      <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3">
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.content}
        </div>
      </div>
    </div>
  </div>
);

/**
 * AI 메시지 컴포넌트
 */
const AssistantMessage: React.FC<{
  message: ChatMessageData;
  onSuggestedAction?: (action: SuggestedAction) => void;
}> = ({ message, onSuggestedAction }) => {
  const { cleanContent, sources } = extractSources(message.content);

  const displayReferences = message.references && message.references.length > 0
    ? message.references
    : sources;

  const [selectedImage, setSelectedImage] = useState<ReferenceImage | null>(null);

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%]">
        {/* 역할 라벨 */}
        <div className="flex items-center gap-2 mb-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
            <Cpu className="w-3 h-3 text-white" />
          </div>
          <span className="text-sm font-bold text-foreground">
            FACTOR AI
          </span>
        </div>

        {/* 메시지 내용 - 마크다운 렌더링 */}
        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
          <div className="prose prose-sm max-w-none text-foreground dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={markdownComponents}
            >
              {cleanContent}
            </ReactMarkdown>
          </div>

          {/* 참고 자료 섹션 */}
          {displayReferences.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
                <ExternalLink className="w-3.5 h-3.5" />
                <span>참고 자료</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {displayReferences.map((ref, idx) => (
                  <a
                    key={`ref-${idx}-${ref.url}`}
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-full transition-colors"
                  >
                    <span className="max-w-[150px] truncate">{ref.title}</span>
                    <ExternalLink className="w-2.5 h-2.5 flex-shrink-0 opacity-60" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 참조 이미지 섹션 */}
          {message.referenceImages && message.referenceImages.images && message.referenceImages.images.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
                <ImageIcon className="w-3.5 h-3.5" />
                <span>참조 이미지</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {message.referenceImages.images.slice(0, 6).map((img, idx) => (
                  <button
                    key={`ref-img-${idx}-${img.source_url}`}
                    onClick={() => setSelectedImage(img)}
                    className="group relative block rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all text-left"
                  >
                    <img
                      src={img.thumbnail_url}
                      alt={img.title}
                      className="w-full h-20 object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-1.5">
                      <span className="text-[9px] text-white line-clamp-2 font-medium leading-tight">{img.title}</span>
                    </div>
                    <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <ZoomIn className="w-2.5 h-2.5 text-white" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 참조 링크 섹션 - 참조 이미지가 있을 때만 표시 */}
          {message.referenceImages && message.referenceImages.images && message.referenceImages.images.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
                <Link2 className="w-3.5 h-3.5" />
                <span>참조 링크</span>
              </div>
              {message.references && message.references.length > 0 ? (
                <div className="space-y-1.5">
                  {message.references.slice(0, 3).map((ref, idx) => (
                    <a
                      key={`ref-link-${idx}-${ref.url}`}
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2 rounded-lg border border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground line-clamp-1">
                          {ref.title}
                        </div>
                        {ref.snippet && (
                          <div className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                            {ref.snippet}
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 p-2 rounded-lg bg-muted/30 text-muted-foreground text-xs">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>참조 링크가 없습니다</span>
                </div>
              )}
            </div>
          )}

          {/* 제안 액션 버튼 */}
          {message.suggestedActions && message.suggestedActions.length > 0 && onSuggestedAction && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex flex-wrap gap-1.5">
                {message.suggestedActions.map((action, idx) => (
                  <Button
                    key={`action-${idx}-${action.label}`}
                    variant="outline"
                    size="sm"
                    onClick={() => onSuggestedAction(action)}
                    className="rounded-full text-xs h-7 gap-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
                  >
                    {action.label}
                    <ArrowRight className="w-2.5 h-2.5" />
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 이미지 확대 보기 모달 */}
        <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
            {selectedImage && (
              <div className="relative flex flex-col h-full">
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>

                <div className="flex-1 flex items-center justify-center p-3 min-h-0">
                  <img
                    src={selectedImage.thumbnail_url}
                    alt={selectedImage.title}
                    className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  />
                </div>

                <div className="p-3 bg-black/80 border-t border-white/10">
                  <h3 className="text-white font-medium text-sm mb-1.5 line-clamp-2">{selectedImage.title}</h3>
                  <a
                    href={selectedImage.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    원본 사이트에서 보기
                  </a>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

/**
 * 메인 ChatMessage 컴포넌트
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({ message, onSuggestedAction }) => {
  return (
    <div className="w-full">
      {message.role === "user" ? (
        <UserMessage message={message} />
      ) : (
        <AssistantMessage message={message} onSuggestedAction={onSuggestedAction} />
      )}
    </div>
  );
};

/**
 * 로딩 메시지 컴포넌트
 */
export const LoadingMessage: React.FC = () => (
  <div className="flex justify-start">
    <div className="max-w-[95%]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
          <Cpu className="w-3 h-3 text-white" />
        </div>
        <span className="text-sm font-bold text-foreground">
          FACTOR AI
        </span>
      </div>
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-xs">응답 생성 중...</span>
        </div>
      </div>
    </div>
  </div>
);

export default ChatMessage;
