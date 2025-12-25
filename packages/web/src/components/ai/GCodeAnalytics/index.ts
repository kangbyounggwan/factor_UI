/**
 * G-code Analytics Components
 * G-code 분석 관련 컴포넌트 모음
 */

// Main Report Component
export { GCodeAnalysisReport } from './GCodeAnalysisReport';
export type {
  GCodeAnalysisData,
  AIResolveStartInfo,
  AIResolveCompleteInfo,
  DetailedIssue,
  PatchSuggestion,
  IssueStatistics,
  SeverityLevel,
  ExpectedImprovement,
} from './GCodeAnalysisReport';

// Archive Component
export { default as GCodeAnalyticsArchive } from './GCodeAnalyticsArchive';
export type { GCodeAnalyticsArchiveProps } from './GCodeAnalyticsArchive';

// Printable Report
export * from './GCodeReportPrintable';

// Sub Components
export { CollapsibleSection } from './CollapsibleSection';
export type { CollapsibleSectionProps } from './CollapsibleSection';

export { AIResolutionPanel } from './AIResolutionPanel';
export type { AIResolutionPanelProps, CodeFix } from './AIResolutionPanel';

export { PatchSuggestionsSection } from './PatchSuggestionsSection';
export type { PatchSuggestionsSectionProps } from './PatchSuggestionsSection';

// Shared Report Page
export { default as SharedReportPage } from './SharedReportPage';

// Chat Components
export { CodeFixDiffCard } from './CodeFixDiffCard';
export type { CodeFixInfo } from './CodeFixDiffCard';

export { ReportCompletionCard } from './ReportCompletionCard';
export type { ReportCompletionCardProps } from './ReportCompletionCard';

// Analysis Polling Hook
export { useGcodeAnalysisPolling, createReportCardData, convertAnalysisResultToReportData } from './useGcodeAnalysisPolling';
export type { ReportCardData, SegmentData, UseGcodeAnalysisPollingReturn, StartPollingParams } from './useGcodeAnalysisPolling';

// Complete Service
export { completeAnalysisDbOperations } from './gcodeAnalysisCompleteService';
export type { CompleteAnalysisDbParams, CompleteAnalysisDbResult } from './gcodeAnalysisCompleteService';
