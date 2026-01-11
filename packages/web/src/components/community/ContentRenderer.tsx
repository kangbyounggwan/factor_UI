/**
 * ContentRenderer 컴포넌트
 * 커뮤니티 게시물 콘텐츠를 파싱하여 렌더링
 * - HTML 콘텐츠 지원
 * - 3D 모델 임베드 지원
 * - 이미지 지원
 */
import { useMemo, Suspense, lazy } from 'react';
import { Loader2 } from 'lucide-react';

// 3D 모델 임베드 컴포넌트 lazy load
const Model3DEmbed = lazy(() => import('./Model3DEmbed'));
// GCode 임베드 컴포넌트 lazy load
const GCodeEmbed = lazy(() => import('./GCodeEmbed'));

// 간단한 HTML sanitizer (DOMPurify 없이)
function sanitizeHtml(html: string): string {
  // 위험한 태그 제거
  const dangerous = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  let safe = html.replace(dangerous, '');

  // onclick, onerror 등 이벤트 핸들러 제거 (img의 onerror는 제외)
  safe = safe.replace(/\s*on(?!error\b)\w+="[^"]*"/gi, '');
  safe = safe.replace(/\s*on(?!error\b)\w+='[^']*'/gi, '');

  // javascript: 프로토콜 제거
  safe = safe.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"');

  // img 태그에 기본 스타일 추가 (크기 조절된 이미지 지원)
  safe = safe.replace(/<img([^>]*?)>/gi, (match, attrs) => {
    // 이미 클래스가 있으면 추가, 없으면 새로 추가
    if (!/class=/i.test(attrs)) {
      return `<img${attrs} class="max-w-full h-auto rounded-lg">`;
    }
    return match;
  });

  return safe;
}

interface ContentRendererProps {
  content: string;
  className?: string;
  postId?: string;  // 게시물 ID (세그먼트 조회용)
}

// 3D 모델 임베드 패턴 (model-3d-embed 클래스를 가진 div)
// 속성 순서에 관계없이 매칭하도록 개선
const MODEL_EMBED_REGEX = /<div[^>]*class="model-3d-embed"[^>]*>[\s\S]*?<\/div>/gi;

// 3D 모델 정보 추출
interface Model3DInfo {
  url: string;
  filename: string;
  type: string;
  gcodeId?: string;  // G-code 파일 고유 ID (gcode_embed_id)
  originalHtml: string;
  startIndex: number;
  endIndex: number;
}

// data 속성 추출 헬퍼 함수
function extractDataAttribute(html: string, attrName: string): string {
  const regex = new RegExp(`data-${attrName}="([^"]*)"`, 'i');
  const match = html.match(regex);
  return match ? match[1] : '';
}

function extract3DModels(content: string): Model3DInfo[] {
  const models: Model3DInfo[] = [];
  let match;

  // 정규식 lastIndex 초기화
  MODEL_EMBED_REGEX.lastIndex = 0;

  while ((match = MODEL_EMBED_REGEX.exec(content)) !== null) {
    const html = match[0];
    const url = extractDataAttribute(html, 'url');
    const filename = extractDataAttribute(html, 'filename');
    const type = extractDataAttribute(html, 'type');
    const gcodeId = extractDataAttribute(html, 'gcode-id');

    // url이 있는 경우에만 모델로 처리
    if (url) {
      models.push({
        url,
        filename: filename || 'model',
        type: type || 'unknown',
        gcodeId: gcodeId || undefined,
        originalHtml: html,
        startIndex: match.index,
        endIndex: match.index + html.length,
      });
    }
  }

  return models;
}

// HTML 콘텐츠를 안전하게 렌더링
function SafeHtmlContent({ html, className }: { html: string; className?: string }) {
  const sanitizedHtml = useMemo(() => sanitizeHtml(html), [html]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}

export function ContentRenderer({ content, className, postId }: ContentRendererProps) {
  // 3D 모델 추출
  const models = useMemo(() => extract3DModels(content), [content]);

  // 모델이 없으면 일반 HTML 렌더링
  if (models.length === 0) {
    // HTML 태그가 있는지 확인
    const hasHtmlTags = /<[^>]+>/.test(content);

    if (hasHtmlTags) {
      return (
        <SafeHtmlContent
          html={content}
          className={`prose prose-sm dark:prose-invert max-w-none ${className || ''}`}
        />
      );
    }

    // 일반 텍스트
    return (
      <div className={`whitespace-pre-wrap ${className || ''}`}>
        {content}
      </div>
    );
  }

  // 3D 모델이 포함된 콘텐츠를 세그먼트로 분할
  const segments: Array<{ type: 'html' | 'model'; content: string | Model3DInfo }> = [];
  let lastIndex = 0;

  models.forEach((model) => {
    // 모델 이전의 HTML 콘텐츠
    if (model.startIndex > lastIndex) {
      const htmlContent = content.slice(lastIndex, model.startIndex);
      if (htmlContent.trim()) {
        segments.push({ type: 'html', content: htmlContent });
      }
    }

    // 3D 모델
    segments.push({ type: 'model', content: model });
    lastIndex = model.endIndex;
  });

  // 마지막 모델 이후의 HTML 콘텐츠
  if (lastIndex < content.length) {
    const htmlContent = content.slice(lastIndex);
    if (htmlContent.trim()) {
      segments.push({ type: 'html', content: htmlContent });
    }
  }

  return (
    <div className={className}>
      {segments.map((segment, index) => {
        if (segment.type === 'html') {
          const htmlContent = segment.content as string;
          const hasHtmlTags = /<[^>]+>/.test(htmlContent);

          if (hasHtmlTags) {
            return (
              <SafeHtmlContent
                key={index}
                html={htmlContent}
                className="prose prose-sm dark:prose-invert max-w-none"
              />
            );
          }

          return (
            <div key={index} className="whitespace-pre-wrap">
              {htmlContent}
            </div>
          );
        }

        // 3D 모델 또는 GCode 렌더링
        const model = segment.content as Model3DInfo;
        const isGCode = model.type.toLowerCase() === 'gcode' || model.type.toLowerCase() === 'nc' || model.type.toLowerCase() === 'ngc';

        return (
          <Suspense
            key={index}
            fallback={
              <div className="h-[300px] bg-muted rounded-lg flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            }
          >
            {isGCode ? (
              <GCodeEmbed
                url={model.url}
                filename={model.filename}
                gcodeEmbedId={model.gcodeId}
              />
            ) : (
              <Model3DEmbed
                url={model.url}
                filename={model.filename}
                fileType={model.type}
              />
            )}
          </Suspense>
        );
      })}
    </div>
  );
}

export default ContentRenderer;
