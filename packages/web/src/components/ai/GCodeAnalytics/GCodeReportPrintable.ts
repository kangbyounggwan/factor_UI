/**
 * G-code 분석 보고서 인쇄용 HTML 생성기
 * PDF/인쇄를 위한 정적 HTML 템플릿 생성
 */

import type { GCodeAnalysisData, DetailedIssue, PatchSuggestion, IssueStatistics } from './GCodeAnalysisReport';

// ============================================================================
// Types
// ============================================================================

export interface PrintableReportData {
  data: GCodeAnalysisData;
  overallScore?: {
    value: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
  };
  metrics: GCodeAnalysisData['metrics'];
  support: GCodeAnalysisData['support'];
  temperature: GCodeAnalysisData['temperature'];
}

// ============================================================================
// Color Helpers
// ============================================================================

/**
 * 등급별 색상
 */
function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#22c55e';
    case 'B': return '#3b82f6';
    case 'C': return '#eab308';
    case 'D': return '#f97316';
    case 'F': return '#ef4444';
    default: return '#6b7280';
  }
}

/**
 * 심각도별 색상
 */
function getSeverityColor(severity: string): { bg: string; text: string; border: string } {
  switch (severity) {
    case 'critical': return { bg: '#ffe4e6', text: '#be123c', border: '#e11d48' };
    case 'high': return { bg: '#fee2e2', text: '#dc2626', border: '#ef4444' };
    case 'medium': return { bg: '#ffedd5', text: '#ea580c', border: '#f97316' };
    case 'low': return { bg: '#fef9c3', text: '#ca8a04', border: '#eab308' };
    case 'info': return { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' };
    default: return { bg: '#f3f4f6', text: '#6b7280', border: '#9ca3af' };
  }
}

// ============================================================================
// Chart Generators
// ============================================================================

/**
 * SVG 도넛 차트 생성 (서포트 비율)
 */
function generateDonutChart(percentage: number): string {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = (percentage / 100) * circumference;

  return `
    <svg width="110" height="110" viewBox="0 0 100 100" style="display:block;margin:0 auto;">
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="12"/>
      <circle cx="50" cy="50" r="${radius}" fill="none" stroke="#8b5cf6" stroke-width="12"
        stroke-dasharray="${strokeDasharray} ${circumference}"
        stroke-linecap="round"
        transform="rotate(-90 50 50)"/>
      <text x="50" y="50" text-anchor="middle" dominant-baseline="middle"
        font-size="18" font-weight="900" fill="#0f172a">${percentage.toFixed(1)}%</text>
    </svg>
  `;
}

/**
 * SVG 파이 차트 생성 (심각도 분포)
 */
function generateSeverityPieChart(severityCounts: Record<string, number>, totalIssues: number): string {
  if (totalIssues === 0) return '<p style="color:#64748b;font-size:9pt;text-align:center;">이슈 없음</p>';

  const colors: Record<string, string> = {
    critical: '#be123c',
    high: '#ef4444',
    medium: '#f97316',
    low: '#eab308',
    info: '#3b82f6'
  };
  const radius = 35;
  let cumulativeAngle = 0;
  const segments: string[] = [];

  const severities = [
    { key: 'critical', count: severityCounts.critical || 0 },
    { key: 'high', count: severityCounts.high || 0 },
    { key: 'medium', count: severityCounts.medium || 0 },
    { key: 'low', count: severityCounts.low || 0 },
    { key: 'info', count: severityCounts.info || 0 },
  ];

  // 활성 세그먼트가 하나뿐인 경우 (100%) - 원으로 그리기
  const activeSegments = severities.filter(s => s.count > 0);
  if (activeSegments.length === 1) {
    const singleKey = activeSegments[0].key;
    return `
      <svg width="90" height="90" viewBox="0 0 100 100" style="display:block;margin:0 auto;">
        <circle cx="50" cy="50" r="${radius}" fill="${colors[singleKey]}" stroke="white" stroke-width="1"/>
      </svg>
    `;
  }

  severities.forEach(({ key, count }) => {
    if (count === 0) return;
    const angle = (count / totalIssues) * 360;
    const startRad = (cumulativeAngle - 90) * Math.PI / 180;
    const endRad = (cumulativeAngle + angle - 90) * Math.PI / 180;

    const x1 = 50 + radius * Math.cos(startRad);
    const y1 = 50 + radius * Math.sin(startRad);
    const x2 = 50 + radius * Math.cos(endRad);
    const y2 = 50 + radius * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    segments.push(`<path d="M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${colors[key]}" stroke="white" stroke-width="1"/>`);
    cumulativeAngle += angle;
  });

  return `
    <svg width="90" height="90" viewBox="0 0 100 100" style="display:block;margin:0 auto;">
      ${segments.join('')}
    </svg>
  `;
}

/**
 * SVG 세로 바 차트 생성 (이슈 유형별 통계)
 */
function generateIssueStatsChart(issueStats: IssueStatistics[]): string {
  if (issueStats.length === 0) return '';

  const maxCount = Math.max(...issueStats.map(s => s.count));
  const topStats = issueStats.slice(0, 5); // 상위 5개만
  const barWidth = 36;
  const gap = 12;
  const chartWidth = topStats.length * (barWidth + gap);
  const chartHeight = 120;
  const maxBarHeight = 70;

  return `
    <svg width="100%" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" style="display:block;margin:0 auto;">
      ${topStats.map((stat, index) => {
        const x = index * (barWidth + gap) + gap / 2;
        const barHeight = maxCount > 0 ? (stat.count / maxCount) * maxBarHeight : 0;
        const barY = chartHeight - 35 - barHeight;
        const label = stat.label.length > 8 ? stat.label.substring(0, 8) + '..' : stat.label;
        return `
          <rect x="${x}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="3" fill="${stat.color || '#8b5cf6'}"/>
          <text x="${x + barWidth / 2}" y="${barY - 5}" text-anchor="middle" font-size="10" font-weight="700" fill="#0f172a">${stat.count}</text>
          <text x="${x + barWidth / 2}" y="${chartHeight - 20}" text-anchor="middle" font-size="8" fill="#475569">${label}</text>
        `;
      }).join('')}
      <line x1="0" y1="${chartHeight - 35}" x2="${chartWidth}" y2="${chartHeight - 35}" stroke="#e2e8f0" stroke-width="1"/>
    </svg>
  `;
}

// ============================================================================
// CSS Styles
// ============================================================================

const PRINTABLE_STYLES = `
@page {
  size: A4;
  margin: 15mm;
}
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  font-family: 'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 11pt;
  line-height: 1.5;
  color: #1e293b;
  background: white;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
code, .patch-code, .mono {
  font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
}
.container {
  max-width: 210mm;
  margin: 0 auto;
  padding: 10mm 0;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #334155;
  padding-bottom: 15px;
  margin-bottom: 20px;
}
.header h1 {
  font-size: 22pt;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.025em;
}
.header .file-info {
  font-size: 10pt;
  color: #64748b;
  margin-top: 5px;
}
.header .file-name {
  font-weight: 600;
  color: #334155;
}
.header .file-date {
  display: block;
  margin-top: 3px;
}
.score-box {
  display: flex;
  align-items: center;
  gap: 12px;
}
.score-value {
  display: flex;
  align-items: center;
  gap: 8px;
}
.score-value .label {
  font-size: 9pt;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.score-value .number {
  font-size: 32pt;
  font-weight: 900;
  color: #0f172a;
  line-height: 1;
}
.grade-badge {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22pt;
  font-weight: 900;
  color: white;
}
.section {
  margin-bottom: 25px;
  page-break-inside: avoid;
}
.section-title {
  font-size: 14pt;
  font-weight: 700;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 8px;
  margin-bottom: 15px;
}
.metrics-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 15px;
}
.metric-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}
.metric-card .label {
  font-size: 8pt;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 5px;
}
.metric-card .value {
  font-size: 16pt;
  font-weight: 900;
  color: #0f172a;
}
.metric-card .sub {
  font-size: 9pt;
  color: #64748b;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}
.info-box {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 15px;
}
.info-box h4 {
  font-size: 10pt;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 10px;
}
.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  border-bottom: 1px solid #e2e8f0;
}
.info-row:last-child {
  border-bottom: none;
}
.info-row .label {
  font-size: 10pt;
  color: #475569;
}
.info-row .value {
  font-size: 12pt;
  font-weight: 700;
  color: #0f172a;
}
.issue-item {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  page-break-inside: avoid;
}
.issue-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.issue-type {
  font-size: 10pt;
  font-weight: 600;
  color: #334155;
}
.issue-meta {
  display: flex;
  gap: 8px;
  align-items: center;
}
.severity-badge {
  font-size: 8pt;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}
.layer-badge {
  font-size: 8pt;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 3px;
}
.issue-desc {
  font-size: 10pt;
  color: #475569;
  margin-bottom: 5px;
}
.issue-suggestion {
  font-size: 9pt;
  color: #059669;
  background: #ecfdf5;
  padding: 6px 10px;
  border-radius: 4px;
  border-left: 3px solid #10b981;
}
.patch-item {
  background: #fffbeb;
  border: 1px solid #fcd34d;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  page-break-inside: avoid;
}
.patch-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.patch-action {
  font-size: 9pt;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}
.patch-action.remove { background: #fee2e2; color: #dc2626; }
.patch-action.modify { background: #dbeafe; color: #2563eb; }
.patch-action.insert { background: #dcfce7; color: #16a34a; }
.patch-code {
  font-family: 'JetBrains Mono', 'Fira Code', monospace;
  font-size: 9pt;
  background: #1e293b;
  color: #e2e8f0;
  padding: 8px 10px;
  border-radius: 4px;
  margin: 5px 0;
  overflow-x: auto;
}
.patch-reason {
  font-size: 9pt;
  color: #78350f;
}
.summary-box {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}
.summary-box p {
  font-size: 10pt;
  color: #0c4a6e;
  line-height: 1.6;
}
.footer {
  margin-top: 30px;
  padding-top: 15px;
  border-top: 1px solid #e2e8f0;
  text-align: center;
  font-size: 9pt;
  color: #94a3b8;
}
.page-break {
  page-break-before: always;
}
`;

// ============================================================================
// HTML Generators
// ============================================================================

/**
 * 이슈 목록 HTML 생성
 */
function generateIssuesHTML(issues: DetailedIssue[]): string {
  if (issues.length === 0) return '';

  return `
    <div class="section ${issues.length > 5 ? 'page-break' : ''}">
      <h2 class="section-title">문제점 및 이상 상황 (${issues.length}건)</h2>
      ${issues.map(issue => {
        const colors = getSeverityColor(issue.severity);
        const issueType = (issue.type || issue.issueType || 'unknown').replace(/_/g, ' ').toUpperCase();
        return `
          <div class="issue-item" style="border-left: 4px solid ${colors.border}">
            <div class="issue-header">
              <span class="issue-type">${issueType}</span>
              <div class="issue-meta">
                ${issue.layer !== undefined ? `<span class="layer-badge">Layer ${issue.layer}</span>` : ''}
                <span class="severity-badge" style="background: ${colors.bg}; color: ${colors.text}">${issue.severity}</span>
              </div>
            </div>
            <p class="issue-desc">${issue.description}</p>
            ${issue.suggestion ? `<p class="issue-suggestion">${issue.suggestion}</p>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * 패치 목록 HTML 생성
 */
function generatePatchesHTML(patches: PatchSuggestion[]): string {
  if (patches.length === 0) return '';

  return `
    <div class="section page-break">
      <h2 class="section-title">G-code 패치 제안 (${patches.length}건)</h2>
      ${patches.map(patch => {
        const lineNum = patch.line || patch.line_number || patch.line_index || 'N/A';
        return `
          <div class="patch-item">
            <div class="patch-header">
              <span>Line ${lineNum}</span>
              <span class="patch-action ${patch.action}">${patch.action}</span>
            </div>
            ${patch.action === 'remove' && patch.original ? `<div class="patch-code">- ${patch.original}</div>` : ''}
            ${(patch.action === 'insert' || patch.action === 'insert_after') && patch.modified ? `<div class="patch-code" style="background:#14532d;color:#86efac">+ ${patch.modified}</div>` : ''}
            ${patch.action === 'modify' ? `
              ${patch.original ? `<div class="patch-code">- ${patch.original}</div>` : ''}
              ${patch.modified ? `<div class="patch-code" style="background:#14532d;color:#86efac">+ ${patch.modified}</div>` : ''}
            ` : ''}
            <p class="patch-reason">${patch.reason}</p>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// ============================================================================
// Main Generator
// ============================================================================

/**
 * PDF/인쇄용 HTML 문서 생성
 */
export function generatePrintableHTML(reportData: PrintableReportData): string {
  const { data, overallScore, metrics, support, temperature } = reportData;

  const issues = data.detailedAnalysis?.detailedIssues || [];
  const patches = data.detailedAnalysis?.patchSuggestions || [];
  const printingInfo = data.detailedAnalysis?.printingInfo;
  const issueStats = data.detailedAnalysis?.issueStatistics || [];

  // 심각도별 카운트 계산
  const severityCounts = {
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
    info: issues.filter(i => i.severity === 'info').length,
  };
  const totalIssues = severityCounts.critical + severityCounts.high + severityCounts.medium + severityCounts.low + severityCounts.info;

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>G-code 보고서 - ${data.fileName || '분석 결과'}</title>
  <!-- Google Fonts CDN -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&family=JetBrains+Mono:wght@400;500&family=Noto+Sans+KR:wght@400;500;700;900&display=swap" rel="stylesheet">
  <style>${PRINTABLE_STYLES}</style>
</head>
<body>
  <div class="container">
    <!-- 헤더 -->
    <div class="header">
      <div>
        <h1>G-code 보고서</h1>
        <p class="file-info">
          <span class="file-name">${data.fileName || '분석 결과'}</span>
          <span class="file-date">${data.analyzedAt || new Date().toLocaleString('ko-KR')}</span>
        </p>
      </div>
      ${overallScore ? `
      <div class="score-box">
        <div class="score-value">
          <span class="label">OVERALL SCORE</span>
          <span class="number">${overallScore.value}</span>
        </div>
        <div class="grade-badge" style="background-color: ${getGradeColor(overallScore.grade)}">${overallScore.grade}</div>
      </div>
      ` : ''}
    </div>

    <!-- 섹션 1: 출력 정보 -->
    <div class="section">
      <h2 class="section-title">출력 정보</h2>

      <div class="metrics-grid">
        <div class="metric-card">
          <p class="label">예상 출력 시간</p>
          <p class="value">${metrics.printTime.value}</p>
        </div>
        <div class="metric-card">
          <p class="label">필라멘트</p>
          <p class="value">${metrics.filamentUsage.length}</p>
          ${metrics.filamentUsage.weight ? `<p class="sub">${metrics.filamentUsage.weight}</p>` : ''}
        </div>
        <div class="metric-card">
          <p class="label">레이어</p>
          <p class="value">${metrics.layerCount.value.toLocaleString()}</p>
          ${metrics.layerCount.layerHeight ? `<p class="sub">${metrics.layerCount.layerHeight}mm</p>` : ''}
        </div>
        <div class="metric-card">
          <p class="label">리트렉션</p>
          <p class="value">${metrics.retractionCount.value.toLocaleString()}</p>
          <p class="sub">회</p>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-box">
          <h4>온도 설정</h4>
          <div class="info-row">
            <span class="label">노즐</span>
            <span class="value">${temperature.nozzle}°C</span>
          </div>
          <div class="info-row">
            <span class="label">베드</span>
            <span class="value">${temperature.bed}°C</span>
          </div>
        </div>
        <div class="info-box">
          <h4>서포트 비율</h4>
          ${generateDonutChart(support.percentage)}
        </div>
        <div class="info-box">
          <h4>이슈 심각도</h4>
          ${generateSeverityPieChart(severityCounts, totalIssues)}
          <div style="display:flex;justify-content:center;gap:8px;margin-top:8px;font-size:8pt;">
            <span style="color:#ef4444;">■ HIGH ${severityCounts.high}</span>
            <span style="color:#f97316;">■ MED ${severityCounts.medium}</span>
            <span style="color:#eab308;">■ LOW ${severityCounts.low}</span>
          </div>
        </div>
      </div>

      ${issueStats.length > 0 ? `
      <div class="info-box" style="margin-top:15px;">
        <h4>이슈 유형별 분포</h4>
        ${generateIssueStatsChart(issueStats)}
      </div>
      ` : ''}
    </div>

    ${printingInfo?.overview || printingInfo?.summary_text ? `
    <div class="summary-box">
      <p>${printingInfo.overview || printingInfo.summary_text}</p>
    </div>
    ` : ''}

    <!-- 섹션 2: 문제점 및 이상 상황 -->
    ${generateIssuesHTML(issues)}

    <!-- 섹션 3: 최적화 방안 및 패치 제안 -->
    ${generatePatchesHTML(patches)}

    <!-- 푸터 -->
    <div class="footer">
      <p>FACTOR 3D Printer Farm • G-code Quality Analysis Report</p>
      <p>Generated on ${new Date().toLocaleString('ko-KR')}</p>
    </div>
  </div>

  <script>
    window.onload = function() {
      window.print();
      window.onafterprint = function() {
        window.close();
      };
    };
  </script>
</body>
</html>
  `;
}

/**
 * 인쇄 창 열기
 */
export function openPrintWindow(htmlContent: string): boolean {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    return true;
  }
  return false;
}
