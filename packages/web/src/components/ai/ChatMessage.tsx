/**
 * 채팅 메시지 컴포넌트
 * - 사용자 메시지와 AI 메시지를 렌더링
 * - 마크다운 렌더링, 코드 수정 카드, 보고서 카드 포함
 */
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Cpu, File, ExternalLink, ArrowRight, ImageIcon, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { CodeFixDiffCard } from "@/components/gcodeAnalysis/CodeFixDiffCard";
import type { CodeFixInfo } from "@/components/gcodeAnalysis/CodeFixDiffCard";
import { ReportCompletionCard } from "./ReportCompletionCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { ChatFileInfo } from "@shared/services/supabaseService/chat";
import type { ReferenceImages, ReferenceImage } from "@shared/services/chatApiService";

// 참고 자료 타입
export interface ReferenceInfo {
  title: string;
  url: string;
  source?: string; // 예: 'duckduckgo', 'google'
  snippet?: string; // 검색 결과 요약
}

// 제안 액션 타입
export interface SuggestedAction {
  label: string;
  action: string; // 예: 'follow_up', 'open_link', 'copy'
  data?: Record<string, unknown>;
}

// 메시지 타입 정의
export interface ChatMessageData {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  images?: string[];
  files?: ChatFileInfo[];
  reportCard?: {
    reportId: string;
    fileName: string;
    overallScore?: number;
    overallGrade?: string;
    totalIssues?: number;
    layerCount?: number;
    printTime?: string;
  };
  codeFixes?: CodeFixInfo[];
  gcodeContext?: string;
  analysisReportId?: string; // 연결된 보고서 ID (코드 수정 시 보고서 로드용)
  // API 응답에서 받은 참고 자료
  references?: ReferenceInfo[];
  // API 응답에서 받은 제안 액션
  suggestedActions?: SuggestedAction[];
  // API 응답에서 받은 참조 이미지 (문제진단)
  referenceImages?: ReferenceImages;
}

interface ChatMessageProps {
  message: ChatMessageData;
  gcodeContent?: string;
  extractGcodeContext?: (content: string, lineNumber: number, contextSize: number) => string;
  onCodeFixClick?: (fix: CodeFixInfo, context: string, analysisReportId?: string) => void;
  // 보고서 카드 관련
  reportPanelOpen?: boolean;
  activeReportId?: string | null;
  onReportCardClick?: (reportId: string) => void | Promise<void>;
  // 해결된 라인 번호들 (패치 적용 완료 표시)
  resolvedLines?: Set<number>;
  // 되돌리기 콜백 (수정코드 -> 원본코드로)
  onRevert?: (lineNumber: number, fixedCode: string, originalCode: string) => void;
  // 제안 액션 클릭 콜백
  onSuggestedAction?: (action: SuggestedAction) => void;
}

/**
 * 사용자 메시지 컴포넌트
 */
const UserMessage: React.FC<{ message: ChatMessageData }> = ({ message }) => (
  <>
    {/* 이미지 미리보기 */}
    {message.images && message.images.length > 0 && (
      <div className="flex flex-wrap gap-2 mb-2 justify-end">
        {message.images.map((img, imgIdx) => (
          <img
            key={imgIdx}
            src={img}
            alt={`uploaded-${imgIdx}`}
            className="w-24 h-24 object-cover rounded-lg border"
          />
        ))}
      </div>
    )}
    {/* 파일 미리보기 */}
    {message.files && message.files.length > 0 && (
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground justify-end">
        <File className="w-4 h-4" />
        {message.files.map((f, fIdx) => (
          <span key={fIdx} className="bg-muted px-2 py-1 rounded">{f.name}</span>
        ))}
      </div>
    )}
    {/* 메시지 내용 */}
    <div className="bg-blue-100 text-blue-900 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[85%] overflow-hidden">
      <div className="text-base leading-relaxed whitespace-pre-wrap break-words overflow-wrap-anywhere">
        {message.content}
      </div>
    </div>
  </>
);

/**
 * 마크다운 컴포넌트 설정
 */
const markdownComponents = {
  // 제목 스타일링
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-xl font-bold mt-6 mb-4 pb-2 border-b border-border">
      {children}
    </h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-lg font-bold mt-6 mb-3 pb-1.5 border-b border-border/50">
      {children}
    </h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-base font-semibold mt-5 mb-3">
      {children}
    </h3>
  ),
  // 문단 스타일링 - 볼드만 있는 줄은 제목처럼 표시
  p: ({ children }: { children?: React.ReactNode }) => {
    const childArray = Array.isArray(children) ? children : [children];
    const isBoldOnlyLine = childArray.length === 1 &&
      typeof childArray[0] === 'object' &&
      childArray[0] !== null &&
      (childArray[0] as React.ReactElement).type === 'strong';

    if (isBoldOnlyLine) {
      return (
        <p className="my-4 mt-6 text-base font-bold leading-relaxed">
          {children}
        </p>
      );
    }
    return (
      <p className="my-3 leading-relaxed">
        {children}
      </p>
    );
  },
  // 링크 스타일링
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
  // 코드 블록 스타일링
  code: ({ className, children, ...props }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    ) : (
      <code className={cn("block bg-muted p-3 rounded-lg text-sm font-mono overflow-x-auto", className)} {...props}>
        {children}
      </code>
    );
  },
  // pre 태그 스타일링
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted rounded-lg overflow-x-auto my-4">
      {children}
    </pre>
  ),
  // 리스트 스타일링
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-6 space-y-2 my-4">
      {children}
    </ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-6 space-y-2 my-4">
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
      <li className="my-1.5 leading-relaxed [&>p]:inline [&>p]:my-0 [&>strong]:font-bold">
        {children}
      </li>
    );
  },
  // 테이블 스타일링
  table: ({ children }: { children?: React.ReactNode }) => (
    <div className="overflow-x-auto my-5">
      <table className="min-w-full border-collapse border border-border">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: { children?: React.ReactNode }) => (
    <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: { children?: React.ReactNode }) => (
    <td className="border border-border px-3 py-2">
      {children}
    </td>
  ),
  // 구분선 스타일링
  hr: () => (
    <hr className="my-8 border-t-2 border-border/60" />
  ),
  // 인용구 스타일링
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-primary/50 pl-4 my-5 italic text-muted-foreground bg-muted/30 py-2 rounded-r-lg">
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
 * GPT 스타일: 본문에서 출처를 제거하고 하단에 별도 섹션으로 표시
 */
function extractSources(content: string): { cleanContent: string; sources: SourceInfo[] } {
  const sources: SourceInfo[] = [];

  // 다양한 출처/참고자료 패턴 매칭
  // 이모지, 볼드, 여러 언어 지원
  const sourcePatterns = [
    // === 한국어 패턴 ===
    // "📚 참고 자료:" 뒤에 리스트 형식으로 나오는 경우 (여러 줄)
    /📚\s*참고\s*자료:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    // "📚 출처:" 뒤에 리스트 형식으로 나오는 경우 (여러 줄)
    /📚\s*출처:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    // "📎 출처:" 패턴
    /📎\s*출처:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    // 단일 줄 패턴들
    /📚\s*출처:\s*(.+?)(?=\n\n|\n(?=[#\d])|$)/gs,
    /📚\s*참고\s*자료:\s*(.+?)(?=\n\n|\n(?=[#\d])|$)/gs,
    /📎\s*출처:\s*(.+?)(?=\n\n|\n(?=[#\d])|$)/gs,
    /🔗\s*출처:\s*(.+?)(?=\n\n|\n(?=[#\d])|$)/gs,
    /🔗\s*참고\s*자료:\s*(.+?)(?=\n\n|\n(?=[#\d])|$)/gs,
    // 볼드 패턴 (** **) - 한국어
    /\*\*참고\s*자료:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*출처:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*📚\s*참고\s*자료:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*📎\s*출처:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    // "참고자료:" 또는 "더 알아보기:" 볼드 패턴
    /\*\*더\s*알아보기:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*관련\s*링크:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,

    // === 영어 패턴 ===
    // "📚 Sources:" or "📚 References:"
    /📚\s*Sources?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*References?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📎\s*Sources?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /🔗\s*Sources?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    // 볼드 패턴 - 영어
    /\*\*Sources?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*References?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*Learn More:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*Related Links?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
  ];

  let cleanContent = content;

  for (const pattern of sourcePatterns) {
    cleanContent = cleanContent.replace(pattern, (match, sourceText) => {
      // [Title](URL) 패턴 추출
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let linkMatch;
      while ((linkMatch = linkPattern.exec(sourceText)) !== null) {
        const title = linkMatch[1].trim();
        const url = linkMatch[2].trim();
        // 중복 체크 및 유효한 URL만 추가
        if (url.startsWith('http') && !sources.some(s => s.url === url)) {
          sources.push({ title, url });
        }
      }
      return ''; // 본문에서 출처 제거
    });
  }

  // 정리: 잔여물 제거
  // 빈 볼드 (**) 제거
  cleanContent = cleanContent.replace(/\*\*\s*\*\*/g, '');
  // 빈 줄만 있는 볼드 제거 (예: **\n**)
  cleanContent = cleanContent.replace(/\*\*\s*\n\s*\*\*/g, '');
  // 단독 ** 제거
  cleanContent = cleanContent.replace(/^\s*\*\*\s*$/gm, '');
  // 연속된 빈 줄 제거
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanContent, sources };
}

/**
 * AI 메시지 컴포넌트
 */
const AssistantMessage: React.FC<{
  message: ChatMessageData;
  gcodeContent?: string;
  extractGcodeContext?: (content: string, lineNumber: number, contextSize: number) => string;
  onCodeFixClick?: (fix: CodeFixInfo, context: string, analysisReportId?: string) => void;
  reportPanelOpen?: boolean;
  activeReportId?: string | null;
  onReportCardClick?: (reportId: string) => void;
  resolvedLines?: Set<number>;
  onRevert?: (lineNumber: number, fixedCode: string, originalCode: string) => void;
  onSuggestedAction?: (action: SuggestedAction) => void;
}> = ({
  message,
  gcodeContent,
  extractGcodeContext,
  onCodeFixClick,
  reportPanelOpen,
  activeReportId,
  onReportCardClick,
  resolvedLines,
  onRevert,
  onSuggestedAction,
}) => {
  // 출처 추출 및 본문 분리
  const { cleanContent, sources } = extractSources(message.content);

  // API에서 받은 참고 자료가 있으면 그것을 사용, 없으면 본문에서 추출한 sources 사용
  const displayReferences = message.references && message.references.length > 0
    ? message.references
    : sources;

  // 이미지 확대 보기 상태
  const [selectedImage, setSelectedImage] = useState<ReferenceImage | null>(null);

  return (
  <>
    {/* 역할 라벨 */}
    <div className="flex items-center gap-2 mb-3">
      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <Cpu className="w-3.5 h-3.5 text-white" />
      </div>
      <span className="text-base font-bold text-foreground">
        FACTOR AI
      </span>
    </div>

    {/* 메시지 내용 - 마크다운 렌더링 (출처 제외) */}
    <div className="prose prose-base max-w-none text-foreground pl-8 dark:prose-invert prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground prose-ul:my-4 prose-ol:my-4 prose-li:my-1 prose-p:my-3 prose-headings:my-4 prose-headings:mt-6">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={markdownComponents}
      >
        {cleanContent}
      </ReactMarkdown>
    </div>

    {/* 참고 자료 섹션 - GPT 스타일 (하단 별도 표시) */}
    {displayReferences.length > 0 && (
      <div className="pl-8 mt-6 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
          <ExternalLink className="w-4 h-4" />
          <span>참고 자료</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {displayReferences.map((ref, idx) => (
            <a
              key={`ref-${idx}-${ref.url}`}
              href={ref.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-full transition-colors group"
              title={'snippet' in ref && ref.snippet ? ref.snippet : undefined}
            >
              <span className="max-w-[200px] truncate">{ref.title}</span>
              <ExternalLink className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
            </a>
          ))}
        </div>
      </div>
    )}

    {/* 참조 이미지 섹션 - 문제진단 결과 이미지 */}
    {message.referenceImages && message.referenceImages.images && message.referenceImages.images.length > 0 && (
      <div className="pl-8 mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-2 mb-3 text-sm font-medium text-muted-foreground">
          <ImageIcon className="w-4 h-4" />
          <span>참조 이미지</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {message.referenceImages.images.slice(0, 8).map((img, idx) => (
            <button
              key={`ref-img-${idx}-${img.source_url}`}
              onClick={() => setSelectedImage(img)}
              className="group relative block rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all hover:shadow-md text-left"
            >
              <img
                src={img.thumbnail_url}
                alt={img.title}
                className="w-full h-24 object-cover"
                loading="lazy"
                onError={(e) => {
                  // 이미지 로드 실패 시 숨김
                  (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                <span className="text-[10px] text-white line-clamp-2 font-medium leading-tight">{img.title}</span>
              </div>
              <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="w-3 h-3 text-white" />
              </div>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* 이미지 확대 보기 모달 */}
    <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
        {selectedImage && (
          <div className="relative flex flex-col h-full">
            {/* 닫기 버튼 */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* 이미지 */}
            <div className="flex-1 flex items-center justify-center p-4 min-h-0">
              <img
                src={selectedImage.thumbnail_url}
                alt={selectedImage.title}
                className="max-w-full max-h-[70vh] object-contain rounded-lg"
              />
            </div>

            {/* 하단 정보 */}
            <div className="p-4 bg-black/80 border-t border-white/10">
              <h3 className="text-white font-medium text-sm mb-2 line-clamp-2">{selectedImage.title}</h3>
              <a
                href={selectedImage.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                원본 사이트에서 보기
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* 제안 액션 버튼 */}
    {message.suggestedActions && message.suggestedActions.length > 0 && onSuggestedAction && (
      <div className="pl-8 mt-4">
        <div className="flex flex-wrap gap-2">
          {message.suggestedActions.map((action, idx) => (
            <Button
              key={`action-${idx}-${action.label}`}
              variant="outline"
              size="sm"
              onClick={() => onSuggestedAction(action)}
              className="rounded-full text-xs gap-1.5 hover:bg-primary/10 hover:text-primary hover:border-primary/30 transition-colors"
            >
              {action.label}
              <ArrowRight className="w-3 h-3" />
            </Button>
          ))}
        </div>
      </div>
    )}

    {/* 코드 수정 카드 (GitHub Diff 스타일) */}
    {message.codeFixes && message.codeFixes.length > 0 && onCodeFixClick && (
      <CodeFixDiffCard
        codeFixes={message.codeFixes}
        gcodeContext={message.gcodeContext}
        gcodeContent={gcodeContent}
        extractGcodeContext={extractGcodeContext}
        onFixClick={onCodeFixClick}
        analysisReportId={message.analysisReportId}
        resolvedLines={resolvedLines}
        onRevert={onRevert}
      />
    )}

    {/* 보고서 완료 카드 */}
    {message.reportCard && onReportCardClick && (
      <div className="pl-8 mt-4">
        <ReportCompletionCard
          reportId={message.reportCard.reportId}
          fileName={message.reportCard.fileName}
          completedAt={message.timestamp}
          overallScore={message.reportCard.overallScore}
          overallGrade={message.reportCard.overallGrade}
          totalIssues={message.reportCard.totalIssues}
          layerCount={message.reportCard.layerCount}
          printTime={message.reportCard.printTime}
          isOpen={reportPanelOpen && activeReportId === message.reportCard.reportId}
          isActive={!reportPanelOpen || activeReportId === message.reportCard.reportId}
          onClick={() => onReportCardClick(message.reportCard!.reportId)}
        />
      </div>
    )}
  </>
  );
};

/**
 * 메인 ChatMessage 컴포넌트
 */
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  gcodeContent,
  extractGcodeContext,
  onCodeFixClick,
  reportPanelOpen,
  activeReportId,
  onReportCardClick,
  resolvedLines,
  onRevert,
  onSuggestedAction,
}) => {
  return (
    <div
      className={cn(
        "w-full",
        message.role === "user" ? "bg-transparent" : "bg-muted/30"
      )}
    >
      <div className={cn(
        "max-w-4xl mx-auto px-6 py-5",
        message.role === "user" && "flex flex-col items-end"
      )}>
        {message.role === "user" ? (
          <UserMessage message={message} />
        ) : (
          <AssistantMessage
            message={message}
            gcodeContent={gcodeContent}
            extractGcodeContext={extractGcodeContext}
            onCodeFixClick={onCodeFixClick}
            reportPanelOpen={reportPanelOpen}
            activeReportId={activeReportId}
            onReportCardClick={onReportCardClick}
            resolvedLines={resolvedLines}
            onRevert={onRevert}
            onSuggestedAction={onSuggestedAction}
          />
        )}
      </div>
    </div>
  );
};

/**
 * 로딩 메시지 컴포넌트
 */
export const LoadingMessage: React.FC = () => (
  <div className="bg-muted/30 w-full">
    <div className="max-w-4xl mx-auto px-6 py-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
          <Cpu className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-sm font-semibold text-foreground">
          FACTOR AI
        </span>
      </div>
      <div className="flex items-center gap-2 text-muted-foreground pl-8">
        <div className="flex gap-1">
          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <span className="text-sm">응답 생성 중...</span>
      </div>
    </div>
  </div>
);

export default ChatMessage;
