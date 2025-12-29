/**
 * Shared Chat Page (Mobile)
 * 공유된 채팅 대화 조회 페이지 - 모바일 최적화
 * URL: /share/:shareId
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getSharedChat, type SharedChat, type SharedReferenceImage } from '@shared/services/supabaseService/sharedChat';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, AlertTriangle, ArrowLeft, Eye, Calendar, ExternalLink, Activity, MessageCircle, Cpu, ImageIcon, ZoomIn, X, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { PlatformHeader } from "@/components/PlatformHeader";
import { useSafeAreaStyle } from "@/hooks/usePlatform";

/**
 * 마크다운 렌더링 전 ~ 문자를 이스케이프
 */
function escapeMarkdownTildes(content: string): string {
  return content.replace(/(?<!\\)~(?!~)/g, '\\~');
}

/**
 * 마크다운 포맷팅 수정
 */
function fixMarkdownLineBreaks(content: string): string {
  let result = content;
  result = result.replace(/(추천\s*해결\s*방법:?)(\*\*\d+\.)/g, '$1\n\n$2');
  result = result.replace(/(Recommended\s*Solutions?:?)(\*\*\d+\.)/gi, '$1\n\n$2');
  result = result.replace(/(\*\*[^*]+:\*\*)(\d+\.)/g, '$1\n\n$2');
  result = result.replace(/(\*\*[^*]+:\*\*)\n(\d+\.)/g, '$1\n\n$2');
  result = result.replace(/(방법:)\n(\*\*\d+\.)/g, '$1\n\n$2');
  result = result.replace(/(Solutions?:)\n(\*\*\d+\.)/gi, '$1\n\n$2');
  result = result.replace(/(예상 시간:[^\n]+)\n(\s*\d+\.)/g, '$1\n\n$2');
  result = result.replace(/(estimated time:[^\n]+)\n(\s*\d+\.)/gi, '$1\n\n$2');
  return result;
}

interface SourceInfo {
  title: string;
  url: string;
}

function extractSources(content: string): { cleanContent: string; sources: SourceInfo[] } {
  const sources: SourceInfo[] = [];
  const sourcePatterns = [
    /📚\s*참고\s*자료:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*출처:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*참고\s*자료:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*출처:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /📚\s*Sources?:?\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*Sources?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
    /\*\*References?:?\*\*\s*\n((?:\s*[-*]\s*\[.+?\]\(.+?\).*?\n?)+)/gi,
  ];

  let cleanContent = content;

  for (const pattern of sourcePatterns) {
    cleanContent = cleanContent.replace(pattern, (match, sourceText) => {
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      let linkMatch;
      let hasValidLinks = false;
      while ((linkMatch = linkPattern.exec(sourceText)) !== null) {
        const title = linkMatch[1].trim();
        const url = linkMatch[2].trim();
        if (url.startsWith('http') && !sources.some(s => s.url === url)) {
          sources.push({ title, url });
          hasValidLinks = true;
        }
      }
      return hasValidLinks ? '' : match;
    });
  }

  cleanContent = cleanContent.replace(/\*\*\s*\*\*/g, '');
  cleanContent = cleanContent.replace(/\n{3,}/g, '\n\n').trim();

  return { cleanContent, sources };
}

const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-lg font-bold mt-4 mb-3 pb-1 border-b border-border">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-base font-bold mt-4 mb-2">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-sm font-semibold mt-3 mb-2">{children}</h3>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="my-2 leading-relaxed text-sm">{children}</p>
  ),
  a: ({ children, href }: { children?: React.ReactNode; href?: string }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
      {children}
    </a>
  ),
  code: ({ className, children }: { className?: string; children?: React.ReactNode }) => {
    const isInline = !className;
    return isInline ? (
      <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
    ) : (
      <code className={cn("block bg-muted p-2 rounded text-xs font-mono overflow-x-auto", className)}>{children}</code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-muted rounded overflow-x-auto my-3">{children}</pre>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc pl-5 space-y-1 my-3 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal pl-5 space-y-1 my-3 text-sm">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="my-1 leading-relaxed">{children}</li>
  ),
};

export default function SharedChatPage() {
  const { shareId } = useParams<{ shareId: string }>();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatData, setChatData] = useState<SharedChat | null>(null);
  const [selectedImage, setSelectedImage] = useState<SharedReferenceImage | null>(null);

  // SafeArea 스타일
  const safeAreaStyle = useSafeAreaStyle({ bottom: true, bottomPadding: '80px' });

  useEffect(() => {
    async function loadSharedChat() {
      if (!shareId) {
        setError('Invalid share link');
        setLoading(false);
        return;
      }

      try {
        const data = await getSharedChat(shareId);
        if (!data) {
          setError('Chat not found or expired');
          setLoading(false);
          return;
        }
        setChatData(data);
      } catch (err) {
        console.error('[SharedChatPage] Error:', err);
        setError('Failed to load chat');
      } finally {
        setLoading(false);
      }
    }

    loadSharedChat();
  }, [shareId]);

  // 로딩 중
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm">{t('shared.loadingChat', '대화를 불러오는 중...')}</p>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error || !chatData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <div className="text-center">
              <h1 className="text-lg font-semibold mb-1">
                {error === 'Chat not found or expired'
                  ? t('shared.chatExpired', '대화를 찾을 수 없음')
                  : t('shared.chatNotFound', '대화를 찾을 수 없음')}
              </h1>
              <p className="text-sm text-muted-foreground">
                {t('shared.chatExpiredDesc', '이 공유 링크가 만료되었거나 삭제되었습니다.')}
              </p>
            </div>
            <Button variant="outline" className="gap-2" onClick={() => navigate('/ai-chat')}>
              <ArrowLeft className="w-4 h-4" />
              {t('shared.goToChat', 'AI 채팅으로')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* 모바일 헤더 */}
      <PlatformHeader
        title={t('shared.sharedChat', '공유된 대화')}
        showBackButton
        onBack={() => navigate('/ai-chat')}
        rightElement={
          <Link to="/ai-chat">
            <Button size="sm" variant="ghost" className="gap-1.5 h-8 px-2">
              <MessageCircle className="w-4 h-4" />
              <span className="text-xs">{t('shared.tryIt', '사용하기')}</span>
            </Button>
          </Link>
        }
      />

      {/* 대화 콘텐츠 */}
      <main className="flex-1 overflow-y-auto px-4 py-3" style={safeAreaStyle}>
        {/* 제목 및 메타 정보 */}
        <div className="mb-4">
          <h1 className="text-lg font-bold mb-1">
            {chatData.title || t('shared.chatConversation', '프린터 문제 진단 대화')}
          </h1>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              <span>{chatData.view_count}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              <span>{new Date(chatData.created_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* 메시지 목록 */}
        <div className="space-y-4">
          {chatData.messages.map((message, index) => (
            <div key={index}>
              {message.role === 'user' ? (
                /* 사용자 메시지 */
                <div className="flex flex-col items-end">
                  {message.images && message.images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-1.5 justify-end">
                      {message.images.map((img, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={img}
                          alt={`uploaded-${imgIdx}`}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                      ))}
                    </div>
                  )}
                  {message.files && message.files.length > 0 && (
                    <div className="flex items-center gap-1.5 mb-1.5 text-xs text-muted-foreground">
                      <File className="w-3.5 h-3.5" />
                      {message.files.map((f, fIdx) => (
                        <span key={fIdx} className="bg-muted px-1.5 py-0.5 rounded">{f.name}</span>
                      ))}
                    </div>
                  )}
                  <div className="bg-blue-100 text-blue-900 rounded-2xl rounded-tr-sm px-3 py-2 max-w-[85%]">
                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {message.content}
                    </div>
                  </div>
                </div>
              ) : (
                /* AI 메시지 */
                (() => {
                  const { cleanContent, sources } = extractSources(message.content);
                  const fixedContent = fixMarkdownLineBreaks(cleanContent);
                  const escapedContent = escapeMarkdownTildes(fixedContent);
                  const displayReferences = message.references && message.references.length > 0
                    ? message.references
                    : sources;

                  return (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center">
                          <Cpu className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm font-bold text-foreground">FACTOR AI</span>
                      </div>

                      <div className="prose prose-sm max-w-none text-foreground pl-7 dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                          {escapedContent}
                        </ReactMarkdown>
                      </div>

                      {displayReferences.length > 0 && (
                        <div className="pl-7 mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{t('shared.references', '참고 자료')}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {displayReferences.slice(0, 4).map((ref, idx) => (
                              <a
                                key={idx}
                                href={ref.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-primary bg-primary/5 border border-primary/20 rounded-full"
                              >
                                <span className="max-w-[120px] truncate">{ref.title}</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {message.referenceImages && message.referenceImages.length > 0 && (
                        <div className="pl-7 mt-3 pt-3 border-t border-border/50">
                          <div className="flex items-center gap-1.5 mb-2 text-xs font-medium text-muted-foreground">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>{t('shared.referenceImages', '참조 이미지')}</span>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {message.referenceImages.slice(0, 6).map((img, idx) => (
                              <button
                                key={idx}
                                onClick={() => setSelectedImage(img)}
                                className="relative rounded-lg overflow-hidden border hover:border-primary/50"
                              >
                                <img
                                  src={img.thumbnail_url}
                                  alt={img.title}
                                  className="w-full h-16 object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-black/50 flex items-center justify-center">
                                  <ZoomIn className="w-2.5 h-2.5 text-white" />
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()
              )}
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6 mb-4">
          <Card className="bg-gradient-to-r from-primary/10 to-blue-500/10 border-primary/20">
            <CardContent className="py-4 px-4 text-center">
              <h2 className="text-base font-bold mb-1">
                {t('shared.tryFactorCTA', '나도 FACTOR로 프린터 문제 해결하기')}
              </h2>
              <p className="text-xs text-muted-foreground mb-3">
                {t('shared.tryFactorDesc', 'AI가 3D 프린터 문제를 진단하고 해결 방법을 알려드립니다.')}
              </p>
              <Link to="/ai-chat">
                <Button size="sm" className="gap-1.5">
                  <MessageCircle className="w-4 h-4" />
                  {t('shared.startChat', '무료로 시작하기')}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* 이미지 확대 모달 */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
          {selectedImage && (
            <div className="relative flex flex-col h-full">
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-2 right-2 z-10 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <div className="flex-1 flex items-center justify-center p-2">
                <img
                  src={selectedImage.thumbnail_url}
                  alt={selectedImage.title}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                />
              </div>
              <div className="p-3 bg-black/80">
                <h3 className="text-white font-medium text-xs mb-1 line-clamp-2">{selectedImage.title}</h3>
                <a
                  href={selectedImage.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-400"
                >
                  <ExternalLink className="w-3 h-3" />
                  {t('shared.viewOriginal', '원본 보기')}
                </a>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
