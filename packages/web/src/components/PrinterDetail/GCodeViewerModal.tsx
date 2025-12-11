
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, CheckCircle2, X, FileCode, Trash2, Edit3, Check, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetailedIssue, PatchSuggestion } from './GCodeAnalysisReport';
import type { IssueEditItem } from '@shared/types/gcodeAnalysisDbTypes';
import { saveIssueEdit } from '@/lib/gcodeAnalysisDbService';
import { useAuth } from '@shared/contexts/AuthContext';

interface GCodeViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    gcodeContent: string;
    issues: DetailedIssue[];
    patches: PatchSuggestion[];
    reportId?: string;  // DB 보고서 ID (수정 내역 저장용)
    onSave?: (newContent: string) => Promise<void>;
}

// Basic G-code syntax highlighting regex (Light Mode / Softer Colors)
const highlightGCode = (line: string) => {
    // Comments
    if (line.trim().startsWith(';')) {
        return <span className="text-slate-400 italic">{line}</span>;
    }

    const parts = line.split(/(\s+)/);

    return parts.map((part, i) => {
        if (part.trim() === '') return part; // whitespace

        // Commands (G0, G1, M104, etc.)
        if (/^[GM]\d+/.test(part)) {
            return <span key={i} className="text-blue-700 font-bold">{part}</span>;
        }

        // Coordinates (X, Y, Z, E)
        if (/^[XYZE]-?[\d.]+/.test(part)) {
            const axis = part.charAt(0);
            const val = part.substring(1);
            return (
                <span key={i}>
                    <span className="text-indigo-600 font-semibold">{axis}</span>
                    <span className="text-emerald-600">{val}</span>
                </span>
            );
        }

        // Parameters (F, S, P, etc.)
        if (/^[FSP]-?[\d.]+/.test(part)) {
            const param = part.charAt(0);
            const val = part.substring(1);
            return (
                <span key={i}>
                    <span className="text-purple-600 font-semibold">{param}</span>
                    <span className="text-amber-600">{val}</span>
                </span>
            );
        }

        // Comments within line
        if (part.startsWith(';')) {
            return <span key={i} className="text-slate-400 italic">{part}</span>;
        }

        return <span key={i} className="text-slate-700">{part}</span>;
    });
};

export const GCodeViewerModal: React.FC<GCodeViewerModalProps> = ({
    isOpen,
    onClose,
    fileName,
    gcodeContent,
    issues,
    patches,
    reportId,
    onSave
}) => {
    const { user } = useAuth();
    const [selectedIssueIndex, setSelectedIssueIndex] = useState<number | null>(null);
    const [content, setContent] = useState(gcodeContent);
    const [lines, setLines] = useState<string[]>([]);
    const [originalLines, setOriginalLines] = useState<string[]>([]); // 원본 라인 (수정 추적용)
    const [isSaving, setIsSaving] = useState(false);

    // 패치 목록을 state로 관리 (라인 삭제 시 라인 번호 조정 필요)
    const [adjustedPatches, setAdjustedPatches] = useState<PatchSuggestion[]>(patches);

    // 이슈 목록을 state로 관리 (라인 삭제 시 라인 번호 조정 필요)
    const [adjustedIssues, setAdjustedIssues] = useState<DetailedIssue[]>(issues);

    // Line editing state
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
    const [editingLineValue, setEditingLineValue] = useState<string>('');
    const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // 이슈별 수정 내역 추적 (Map: issueIndex -> IssueEditItem[])
    const [issueEditsMap, setIssueEditsMap] = useState<Map<number, IssueEditItem[]>>(new Map());
    const prevIssueIndexRef = useRef<number | null>(null);

    // 패치 클릭 시 이동할 라인 인덱스 (이슈 선택과 별개로 패치 라인으로 이동)
    const [patchTargetLineIndex, setPatchTargetLineIndex] = useState<number | null>(null);

    // 패치별 수정 내역 추적 (Map: patchIndex -> IssueEditItem[])
    const [patchEditsMap, setPatchEditsMap] = useState<Map<number, IssueEditItem[]>>(new Map());

    // 수정사항 저장 확인 모달 상태
    const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
    const [pendingIssueIndex, setPendingIssueIndex] = useState<number | null>(null);

    // 현재 편집 중인 패치 인덱스 (패치 카드 클릭 후 편집 시)
    const [editingPatchIndex, setEditingPatchIndex] = useState<number | null>(null);
    const [editingPatchInfo, setEditingPatchInfo] = useState<PatchSuggestion | null>(null);

    // 패치 수정 완료 확인 모달 상태
    const [showPatchConfirmModal, setShowPatchConfirmModal] = useState(false);
    const [pendingPatchEdit, setPendingPatchEdit] = useState<{
        lineIndex: number;
        originalContent: string;
        newContent: string;
        patchIndex: number;
        patchInfo: PatchSuggestion;
    } | null>(null);

    // 현재 이슈에 수정 내역 추가
    const addEditToCurrentIssue = useCallback((
        lineIndex: number,
        action: 'edit' | 'delete',
        originalContent: string,
        modifiedContent: string | null
    ) => {
        if (selectedIssueIndex === null) return;

        const editItem: IssueEditItem = {
            lineIndex,
            lineNumber: lineIndex + 1,
            action,
            originalContent,
            modifiedContent,
            editedAt: new Date().toISOString(),
        };

        setIssueEditsMap(prev => {
            const newMap = new Map(prev);
            const existingEdits = newMap.get(selectedIssueIndex) || [];
            // 같은 라인에 대한 기존 수정이 있으면 대체
            const filteredEdits = existingEdits.filter(e => e.lineIndex !== lineIndex);
            newMap.set(selectedIssueIndex, [...filteredEdits, editItem]);
            return newMap;
        });
    }, [selectedIssueIndex]);

    // 패치 적용 시 수정 내역 추가 및 즉시 저장 (patch_success)
    const addPatchEdit = useCallback(async (
        patchIndex: number,
        patchAction: string,
        lineIndex: number,
        action: 'edit' | 'delete',
        originalContent: string,
        modifiedContent: string | null
    ) => {
        if (!user || !reportId) return;

        const editItem: IssueEditItem = {
            lineIndex,
            lineNumber: lineIndex + 1,
            action,
            originalContent,
            modifiedContent,
            editedAt: new Date().toISOString(),
        };

        // 패치 인덱스는 -1000부터 시작하여 이슈와 구분
        const dbPatchIndex = -1000 - patchIndex;

        setPatchEditsMap(prev => {
            const newMap = new Map(prev);
            const existingEdits = newMap.get(patchIndex) || [];
            newMap.set(patchIndex, [...existingEdits, editItem]);
            return newMap;
        });

        // 즉시 DB에 저장 - 패치 제안대로 적용했으므로 patch_success
        try {
            await saveIssueEdit(
                user.id,
                reportId,
                dbPatchIndex,
                'patch_success',
                [editItem],
                {
                    issueLine: lineIndex + 1,
                    issueLineIndex: lineIndex,
                    note: `Patch applied successfully: ${patchAction}`,
                }
            );
            console.log(`[GCodeViewerModal] Saved patch_success for patch ${patchIndex}`);
        } catch (error) {
            console.error(`[GCodeViewerModal] Failed to save patch edit:`, error);
        }
    }, [user, reportId]);

    // 패치 제안과 다른 수정 시 matching_failed로 저장
    const addMatchingFailedEdit = useCallback(async (
        patchIndex: number,
        lineIndex: number,
        action: 'edit' | 'delete',
        originalContent: string,
        modifiedContent: string | null
    ) => {
        if (!user || !reportId) return;

        const editItem: IssueEditItem = {
            lineIndex,
            lineNumber: lineIndex + 1,
            action,
            originalContent,
            modifiedContent,
            editedAt: new Date().toISOString(),
        };

        // 패치 인덱스는 -1000부터 시작하여 이슈와 구분
        const dbPatchIndex = -1000 - patchIndex;

        // 즉시 DB에 저장 - 패치 제안과 다르게 수정했으므로 matching_failed
        try {
            await saveIssueEdit(
                user.id,
                reportId,
                dbPatchIndex,
                'matching_failed',
                [editItem],
                {
                    issueLine: lineIndex + 1,
                    issueLineIndex: lineIndex,
                    note: `User edited differently from patch suggestion`,
                }
            );
            console.log(`[GCodeViewerModal] Saved matching_failed for patch ${patchIndex}`);
        } catch (error) {
            console.error(`[GCodeViewerModal] Failed to save matching_failed edit:`, error);
        }
    }, [user, reportId]);

    // 이슈 전환 시 현재 이슈의 수정 내역을 DB에 저장
    const saveCurrentIssueEdits = useCallback(async (issueIndex: number) => {
        if (!user || !reportId) return;

        const edits = issueEditsMap.get(issueIndex);
        if (!edits || edits.length === 0) return;

        const issue = issues[issueIndex];
        if (!issue) return;

        try {
            await saveIssueEdit(
                user.id,
                reportId,
                issueIndex,
                issue.issueType,
                edits,
                {
                    issueLine: typeof issue.line === 'number' ? issue.line : undefined,
                    issueLineIndex: issue.line_index !== undefined ? Number(issue.line_index) : undefined,
                }
            );
            console.log(`[GCodeViewerModal] Saved edits for issue ${issueIndex}`);
        } catch (error) {
            console.error(`[GCodeViewerModal] Failed to save edits for issue ${issueIndex}:`, error);
        }
    }, [user, reportId, issueEditsMap, issues]);

    // 이슈 선택 변경 핸들러
    const handleIssueSelect = useCallback((newIndex: number) => {
        // 이전 이슈에 수정 내역이 있는지 확인
        if (prevIssueIndexRef.current !== null && prevIssueIndexRef.current !== newIndex) {
            const currentEdits = issueEditsMap.get(prevIssueIndexRef.current);
            if (currentEdits && currentEdits.length > 0) {
                // 수정 내역이 있으면 확인 모달 표시
                setPendingIssueIndex(newIndex);
                setShowSaveConfirmModal(true);
                return;
            }
        }

        // 수정 내역이 없으면 바로 이동
        setPatchTargetLineIndex(null);
        setSelectedIssueIndex(newIndex);
        prevIssueIndexRef.current = newIndex;
    }, [issueEditsMap]);

    // 수정사항 저장 확인 후 이슈 전환
    const handleConfirmSaveAndSwitch = useCallback(async () => {
        if (prevIssueIndexRef.current !== null) {
            await saveCurrentIssueEdits(prevIssueIndexRef.current);
        }

        if (pendingIssueIndex !== null) {
            setPatchTargetLineIndex(null);
            setSelectedIssueIndex(pendingIssueIndex);
            prevIssueIndexRef.current = pendingIssueIndex;
        }

        setShowSaveConfirmModal(false);
        setPendingIssueIndex(null);
    }, [saveCurrentIssueEdits, pendingIssueIndex]);

    // 수정사항 저장하지 않고 이슈 전환
    const handleDiscardAndSwitch = useCallback(() => {
        // 현재 이슈의 수정 내역 삭제
        if (prevIssueIndexRef.current !== null) {
            setIssueEditsMap(prev => {
                const newMap = new Map(prev);
                newMap.delete(prevIssueIndexRef.current!);
                return newMap;
            });
        }

        if (pendingIssueIndex !== null) {
            setPatchTargetLineIndex(null);
            setSelectedIssueIndex(pendingIssueIndex);
            prevIssueIndexRef.current = pendingIssueIndex;
        }

        setShowSaveConfirmModal(false);
        setPendingIssueIndex(null);
    }, [pendingIssueIndex]);

    // 확인 모달 취소 (현재 이슈에 머물기)
    const handleCancelSwitch = useCallback(() => {
        setShowSaveConfirmModal(false);
        setPendingIssueIndex(null);
    }, []);

    // 패치 수정 확인 모달 - 적용 (DB 저장)
    const handleConfirmPatchEdit = useCallback(async () => {
        if (!pendingPatchEdit) return;

        const { lineIndex, originalContent, newContent, patchIndex, patchInfo } = pendingPatchEdit;

        // 라인 내용 업데이트
        const newLines = [...lines];
        newLines[lineIndex] = newContent;
        setLines(newLines);
        setContent(newLines.join('\n'));

        // 패치 제안대로 수정했는지 확인
        const isMatchingPatch = patchInfo.modified === newContent;

        if (isMatchingPatch) {
            // 패치 제안대로 수정 → patch_success
            await addPatchEdit(patchIndex, patchInfo.action, lineIndex, 'edit', originalContent, newContent);
        } else {
            // 패치 제안과 다르게 수정 → matching_failed
            await addMatchingFailedEdit(patchIndex, lineIndex, 'edit', originalContent, newContent);
        }

        // 적용된 패치 제거
        setAdjustedPatches(prevPatches => prevPatches.filter((_, idx) => idx !== patchIndex));

        // 상태 초기화
        setShowPatchConfirmModal(false);
        setPendingPatchEdit(null);
        setEditingLineIndex(null);
        setEditingLineValue('');
        setEditingPatchIndex(null);
        setEditingPatchInfo(null);
    }, [pendingPatchEdit, lines, addPatchEdit, addMatchingFailedEdit]);

    // 패치 수정 확인 모달 - 취소 (편집 모드 유지)
    const handleCancelPatchEdit = useCallback(() => {
        setShowPatchConfirmModal(false);
        setPendingPatchEdit(null);
        // 편집 모드 유지 - 사용자가 계속 수정할 수 있음
    }, []);

    // 패치 수정 확인 모달 - 저장 안함 (편집 취소)
    const handleDiscardPatchEdit = useCallback(() => {
        setShowPatchConfirmModal(false);
        setPendingPatchEdit(null);
        setEditingLineIndex(null);
        setEditingLineValue('');
        setEditingPatchIndex(null);
        setEditingPatchInfo(null);
    }, []);

    // 패치 카드 클릭 시 해당 라인으로 이동 (편집 모드 진입 없이)
    const handlePatchClick = useCallback((patch: PatchSuggestion, patchIndex: number) => {
        console.log('[GCodeViewerModal] handlePatchClick called:', { patch, patchIndex });

        // 라인 인덱스 계산 (0-based)
        let lineIndex = -1;

        if (patch.line_index !== undefined && patch.line_index >= 0) {
            lineIndex = patch.line_index;
        } else if (patch.line !== undefined && patch.line > 0) {
            lineIndex = patch.line - 1;
        }

        console.log('[GCodeViewerModal] Calculated lineIndex:', lineIndex);

        if (lineIndex < 0 || lineIndex >= lines.length) {
            console.warn('[GCodeViewerModal] Invalid patch line index:', lineIndex);
            return;
        }

        // 패치 정보 저장 (나중에 수정 버튼 클릭 시 사용)
        setEditingPatchIndex(patchIndex);
        setEditingPatchInfo(patch);

        // 해당 라인으로 이동만 (편집 모드 진입 없음)
        setPatchTargetLineIndex(lineIndex);
    }, [lines]);

    // Initialize lines when content changes (or opens)
    useEffect(() => {
        if (isOpen) {
            const newLines = gcodeContent.split('\n');
            setLines(newLines);
            setOriginalLines(newLines); // 원본 저장
            setContent(gcodeContent);
            setAdjustedPatches(patches); // 패치 목록 초기화
            setAdjustedIssues(issues); // 이슈 목록 초기화
            // Auto-select first issue when modal opens
            if (issues.length > 0) {
                setSelectedIssueIndex(0);
                prevIssueIndexRef.current = 0;
            } else {
                setSelectedIssueIndex(null);
                prevIssueIndexRef.current = null;
            }
            // Reset editing state
            setEditingLineIndex(null);
            setEditingLineValue('');
            setIssueEditsMap(new Map());
            setPatchTargetLineIndex(null);
        }
    }, [gcodeContent, isOpen, issues.length, patches, issues]);

    // 모달 닫힐 때 마지막 이슈의 수정 내역 저장
    const handleClose = useCallback(async () => {
        // 현재 이슈의 수정 내역 저장
        if (selectedIssueIndex !== null) {
            await saveCurrentIssueEdits(selectedIssueIndex);
        }
        onClose();
    }, [selectedIssueIndex, saveCurrentIssueEdits, onClose]);

    // Focus edit input when editing starts
    useEffect(() => {
        if (editingLineIndex !== null && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingLineIndex]);

    // Handle Save
    const handleSave = async () => {
        if (!onSave) return;
        setIsSaving(true);
        try {
            // Use current lines state to build content
            const newContent = lines.join('\n');
            await onSave(newContent);
            setContent(newContent);
        } finally {
            setIsSaving(false);
        }
    };

    // Start editing a line
    const handleStartEdit = (lineIndex: number) => {
        setEditingLineIndex(lineIndex);
        setEditingLineValue(lines[lineIndex] || '');
    };

    // Confirm line edit
    const handleConfirmEdit = useCallback(() => {
        if (editingLineIndex === null) return;

        const originalContent = originalLines[editingLineIndex] || '';

        // 패치 카드를 통해 편집 중인 경우 → 확인 모달 표시
        if (editingPatchIndex !== null && editingPatchInfo !== null) {
            setPendingPatchEdit({
                lineIndex: editingLineIndex,
                originalContent,
                newContent: editingLineValue,
                patchIndex: editingPatchIndex,
                patchInfo: editingPatchInfo,
            });
            setShowPatchConfirmModal(true);
            return;
        }

        // 일반 편집의 경우 기존 로직 실행
        const newLines = [...lines];
        newLines[editingLineIndex] = editingLineValue;
        setLines(newLines);
        setContent(newLines.join('\n'));

        // 해당 라인에 패치 제안이 있는지 확인
        const patchIndex = adjustedPatches.findIndex(p => {
            const patchLineIdx = p.line_index !== undefined ? p.line_index : (p.line ? p.line - 1 : -1);
            return patchLineIdx === editingLineIndex;
        });

        if (patchIndex >= 0) {
            // 패치 제안이 있는 라인을 수동 수정 → matching_failed
            addMatchingFailedEdit(patchIndex, editingLineIndex, 'edit', originalContent, editingLineValue);
        } else {
            // 패치 제안이 없는 라인 → 기존 이슈 기반 수정 내역 기록
            addEditToCurrentIssue(editingLineIndex, 'edit', originalContent, editingLineValue);
        }

        setEditingLineIndex(null);
        setEditingLineValue('');
    }, [editingLineIndex, editingLineValue, lines, originalLines, adjustedPatches, addEditToCurrentIssue, addMatchingFailedEdit, editingPatchIndex, editingPatchInfo]);

    // Cancel line edit
    const handleCancelEdit = useCallback(() => {
        setEditingLineIndex(null);
        setEditingLineValue('');
        // 패치 편집 상태도 초기화
        setEditingPatchIndex(null);
        setEditingPatchInfo(null);
    }, []);

    // Delete a line
    const handleDeleteLine = useCallback((lineIndex: number) => {
        const originalContent = originalLines[lineIndex] || lines[lineIndex] || '';

        // 해당 라인에 패치 제안이 있는지 확인
        const patchIndex = adjustedPatches.findIndex(p => {
            const patchLineIdx = p.line_index !== undefined ? p.line_index : (p.line ? p.line - 1 : -1);
            return patchLineIdx === lineIndex;
        });

        if (patchIndex >= 0) {
            // 패치 제안이 있는 라인을 수동 삭제 → matching_failed
            addMatchingFailedEdit(patchIndex, lineIndex, 'delete', originalContent, null);
        } else {
            // 패치 제안이 없는 라인 → 기존 이슈 기반 수정 내역 기록
            addEditToCurrentIssue(lineIndex, 'delete', originalContent, null);
        }

        const newLines = lines.filter((_, idx) => idx !== lineIndex);
        setLines(newLines);
        setContent(newLines.join('\n'));

        // 삭제된 라인 이후의 패치 라인 번호 조정
        setAdjustedPatches(prevPatches =>
            prevPatches
                .filter(p => {
                    // 삭제된 라인에 해당하는 패치는 제거
                    const patchLineIdx = p.line_index !== undefined ? Number(p.line_index) : (p.line ? Number(p.line) - 1 : -1);
                    return patchLineIdx !== lineIndex;
                })
                .map(p => {
                    const patchLineIdx = p.line_index !== undefined ? Number(p.line_index) : (p.line ? Number(p.line) - 1 : -1);
                    // 삭제된 라인보다 뒤에 있는 패치의 라인 번호를 1씩 감소
                    if (patchLineIdx > lineIndex) {
                        return {
                            ...p,
                            line: p.line ? Number(p.line) - 1 : undefined,
                            line_index: p.line_index !== undefined ? Number(p.line_index) - 1 : undefined,
                        };
                    }
                    return p;
                })
        );

        // 삭제된 라인 이후의 이슈 라인 번호 조정
        setAdjustedIssues(prevIssues =>
            prevIssues.map(issue => {
                const issueLineIdx = issue.line_index !== undefined
                    ? Number(issue.line_index)
                    : (typeof issue.line === 'number' ? issue.line - 1 : -1);

                // 삭제된 라인보다 뒤에 있는 이슈의 라인 번호를 1씩 감소
                if (issueLineIdx > lineIndex) {
                    return {
                        ...issue,
                        line: typeof issue.line === 'number' ? issue.line - 1 : issue.line,
                        line_index: issue.line_index !== undefined ? Number(issue.line_index) - 1 : undefined,
                    };
                }
                return issue;
            })
        );
    }, [lines, originalLines, adjustedPatches, addEditToCurrentIssue, addMatchingFailedEdit]);

    // Handle keyboard events in edit mode
    const handleEditKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    };

    // Snippet calculation
    const getSnippetRange = () => {
        // 패치 타겟 라인이 설정되어 있으면 해당 라인을 기준으로 snippet 범위 계산
        if (patchTargetLineIndex !== null) {
            const start = Math.max(0, patchTargetLineIndex - 50);
            const end = Math.min(lines.length, patchTargetLineIndex + 50);
            return { start, end, targetLineIndex: patchTargetLineIndex };
        }

        if (selectedIssueIndex === null || !adjustedIssues[selectedIssueIndex]) return { start: 0, end: 100 }; // Default start

        // API returns line (1-based) or line_index (0-based)
        // DetailedIssue type has `line` (number|string) and `line_index`.
        let targetLineIndex = 0;
        const issue = adjustedIssues[selectedIssueIndex];

        if (issue.line_index !== undefined) {
            targetLineIndex = Number(issue.line_index);
        } else if (issue.line !== undefined) {
            targetLineIndex = Number(issue.line) - 1;
        }

        const start = Math.max(0, targetLineIndex - 50);
        const end = Math.min(lines.length, targetLineIndex + 50);

        return { start, end, targetLineIndex };
    };

    const { start: snippetStart, end: snippetEnd, targetLineIndex } = getSnippetRange();
    const targetLineRef = useRef<HTMLDivElement>(null);

    // Scroll to target line when it changes
    useEffect(() => {
        if (targetLineRef.current) {
            targetLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, [selectedIssueIndex, targetLineIndex, patchTargetLineIndex]);


    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertTriangle className="h-4 w-4 text-rose-600" />;
            case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
            case 'medium': return <Info className="h-4 w-4 text-amber-600" />;
            default: return <Info className="h-4 w-4 text-blue-600" />;
        }
    };

    const getSeverityStyles = (severity: string, isSelected: boolean) => {
        const base = "cursor-pointer rounded-lg border p-4 text-sm transition-all duration-200 hover:shadow-sm relative overflow-hidden";

        if (isSelected) {
            switch (severity) {
                case 'critical': return `${base} bg-rose-50 border-rose-200 ring-1 ring-rose-500`;
                case 'high': return `${base} bg-orange-50 border-orange-200 ring-1 ring-orange-500`;
                case 'medium': return `${base} bg-amber-50 border-amber-200 ring-1 ring-amber-500`;
                default: return `${base} bg-blue-50 border-blue-200 ring-1 ring-blue-500`;
            }
        }

        return `${base} bg-white hover:bg-slate-50 border-slate-200`;
    };

    const getBadgeStyle = (severity: string) => {
        switch (severity) {
            case 'critical': return "bg-rose-100 text-rose-700 border-rose-200";
            case 'high': return "bg-orange-100 text-orange-700 border-orange-200";
            case 'medium': return "bg-amber-100 text-amber-700 border-amber-200";
            default: return "bg-blue-100 text-blue-700 border-blue-200";
        }
    }


    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-[95vw] w-[1400px] h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white shadow-xl border border-slate-200 sm:rounded-xl">
                {/* Header */}
                <DialogHeader className="px-6 py-4 border-b border-slate-200 flex flex-row items-center justify-between space-y-0 bg-slate-50/50 sticky top-0 z-10 transition-colors">
                    <div className="flex items-center gap-4">
                        <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">
                            <FileCode className="h-6 w-6 text-slate-700" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                            <DialogTitle className="text-lg font-bold tracking-tight text-slate-800">G-code 분석 스튜디오</DialogTitle>
                            <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                <span className="max-w-[300px] truncate">{fileName}</span>
                                <Badge variant="secondary" className="h-5 text-[10px] font-mono px-1.5 bg-slate-100 text-slate-600 border-slate-200">
                                    {content.length.toLocaleString()} bytes
                                </Badge>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        {/* 스마트 뷰 모드 표시 (전체 파일 모드 비활성화) */}
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <div className="h-8 px-3 text-xs font-medium rounded-md bg-white shadow-sm text-blue-600 flex items-center">
                                스마트 뷰
                            </div>
                        </div>
                        <div className="h-6 w-px bg-slate-200 mx-1" />
                        <Button variant="ghost" size="sm" onClick={handleClose} className="h-9 text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                            <X className="h-4 w-4 mr-2" /> 닫기
                        </Button>
                        <Button
                            size="sm"
                            className="h-9 font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm min-w-[100px]"
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? (
                                <>
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                    저장 중...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-4 w-4 mr-2" /> 저장 및 적용
                                </>
                            )}
                        </Button>
                    </div>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar: Issues & Patches */}
                    <div className="w-[420px] border-r border-slate-200 flex flex-col bg-slate-50/50">
                        <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-slate-50 z-10">
                            <h3 className="text-sm font-semibold flex items-center gap-2 text-slate-700">
                                <div className="h-2 w-2 rounded-full bg-rose-500" />
                                분석 리포트
                            </h3>
                            <Badge variant="outline" className="font-mono text-xs bg-white text-slate-600 border-slate-200">{issues.length} Issues</Badge>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-6">
                                {/* Patches List - 패치 제안을 먼저 표시 */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">
                                        패치 제안 내역
                                    </h4>
                                    <div className="space-y-3">
                                        {adjustedPatches
                                            .map((patch, originalIndex) => ({ patch, originalIndex }))
                                            .sort((a, b) => {
                                                // 라인번호 오름차순 정렬
                                                const lineA = a.patch.line ?? a.patch.line_index ?? 0;
                                                const lineB = b.patch.line ?? b.patch.line_index ?? 0;
                                                return lineA - lineB;
                                            })
                                            .map(({ patch, originalIndex }) => (
                                                <div
                                                    key={originalIndex}
                                                    onClick={() => handlePatchClick(patch, originalIndex)}
                                                    className="group p-4 bg-white border border-slate-200 rounded-xl text-sm hover:shadow-md hover:border-blue-400 transition-all cursor-pointer active:scale-[0.99]"
                                                >
                                                    <div className="flex justify-between items-center mb-2">
                                                        <Badge variant="outline" className="text-[10px] font-mono bg-slate-100 text-slate-600 border-slate-200">L{patch.line || patch.line_index}</Badge>
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={cn("text-[10px] font-bold shadow-none",
                                                                patch.action === 'remove' ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border-rose-200' :
                                                                    patch.action === 'modify' ? 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200' :
                                                                        'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200'
                                                            )}>
                                                                {patch.action.toUpperCase()}
                                                            </Badge>
                                                            <span className="text-[10px] text-blue-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                                                클릭하여 수정 →
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-xs font-medium text-slate-700 mb-3 leading-relaxed">{patch.reason}</p>
                                                    <div className="bg-slate-50 p-3 rounded-lg text-xs font-mono space-y-1.5 border border-slate-200 group-hover:bg-blue-50/50 transition-colors">
                                                        <div className="flex items-start gap-2 opacity-80">
                                                            <span className="text-rose-500 font-bold select-none">-</span>
                                                            <span className="line-through text-slate-500 break-all">{patch.original}</span>
                                                        </div>
                                                        <div className="flex items-start gap-2">
                                                            <span className="text-emerald-500 font-bold select-none">+</span>
                                                            <span className="text-emerald-700 font-semibold break-all">{patch.modified}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        {adjustedPatches.length === 0 && (
                                            <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                                                <p className="text-xs text-slate-400">제안된 패치가 없습니다.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Issues List - 감지된 문제점을 아래에 표시 */}
                                <div>
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 mt-6 border-t border-slate-200 pt-6">
                                        감지된 문제점
                                    </h4>
                                    <div className="space-y-3">
                                        {adjustedIssues.map((issue, index) => {
                                            const isSelected = selectedIssueIndex === index;
                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() => handleIssueSelect(index)}
                                                    className={getSeverityStyles(issue.severity, isSelected)}
                                                >
                                                    {/* Selection Indicator Line */}
                                                    {isSelected && (
                                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1",
                                                            issue.severity === 'critical' ? 'bg-rose-500' :
                                                                issue.severity === 'high' ? 'bg-orange-500' :
                                                                    issue.severity === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                                                        )} />
                                                    )}

                                                    <div className="flex justify-between items-start mb-2 pl-2">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn("p-1.5 rounded-full shrink-0",
                                                                issue.severity === 'critical' ? 'bg-rose-100' :
                                                                    issue.severity === 'high' ? 'bg-orange-100' :
                                                                        issue.severity === 'medium' ? 'bg-amber-100' : 'bg-blue-100'
                                                            )}>
                                                                {getSeverityIcon(issue.severity)}
                                                            </div>
                                                            <span className="font-bold text-sm text-slate-800 tracking-tight">
                                                                {issue.issueType}
                                                            </span>
                                                        </div>
                                                        <Badge variant="outline" className={cn("font-mono text-[10px] h-5 border shadow-none", getBadgeStyle(issue.severity))}>
                                                            L{issue.line || issue.line_index || '?'}
                                                        </Badge>
                                                    </div>

                                                    <p className="text-sm text-slate-600 pl-2 leading-relaxed mb-3">
                                                        {issue.description}
                                                    </p>

                                                    {issue.suggestion && (
                                                        <div className={cn("rounded-md p-2.5 pl-3 text-xs flex gap-2 items-start mx-1",
                                                            isSelected ? "bg-white/80 border border-black/5" : "bg-slate-100/50 border border-slate-200/50"
                                                        )}>
                                                            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-emerald-600 flex-shrink-0" />
                                                            <span className="text-slate-700 font-medium leading-snug">
                                                                {issue.suggestion}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                        {adjustedIssues.length === 0 && (
                                            <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-300 bg-slate-50">
                                                <CheckCircle2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                                <p className="text-sm font-medium text-slate-600">감지된 문제가 없습니다.</p>
                                                <p className="text-xs text-slate-400 mt-1">G-code 파일이 완벽해보입니다!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </ScrollArea>
                    </div>

                    {/* Right Main: G-code Editor */}
                    <div className="flex-1 flex flex-col bg-white text-slate-800 relative">
                        {/* Editor Header */}
                        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200">
                            <div className="flex items-center gap-3">
                                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                <div className="text-xs font-mono text-slate-500">
                                    {selectedIssueIndex !== null
                                        ? <>Issue at <span className="text-blue-600 font-bold">Line {adjustedIssues[selectedIssueIndex]?.line || adjustedIssues[selectedIssueIndex]?.line_index}</span></>
                                        : 'Full File View'}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
                                <span>UTF-8</span>
                                <span>G-code</span>
                                <span className="px-2 py-0.5 rounded font-medium bg-blue-50 text-blue-600">
                                    SNIPPET MODE
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto font-mono text-sm leading-6 p-0 custom-scrollbar bg-white">
                            {lines.slice(snippetStart, snippetEnd).map((line, idx) => {
                                const actualLineIdx = snippetStart + idx;
                                const isTarget = actualLineIdx === targetLineIndex;
                                const lineNumber = actualLineIdx + 1;
                                const isEditing = editingLineIndex === actualLineIdx;
                                const isHovered = hoveredLineIndex === actualLineIdx;

                                // 해당 라인에 대한 패치 제안 찾기 (인덱스와 함께)
                                const linePatchIndex = adjustedPatches.findIndex(p => {
                                    const patchLineIdx = p.line_index !== undefined ? p.line_index : (p.line ? p.line - 1 : -1);
                                    return patchLineIdx === actualLineIdx;
                                });
                                const linePatch = linePatchIndex >= 0 ? adjustedPatches[linePatchIndex] : undefined;

                                return (
                                    <React.Fragment key={actualLineIdx}>
                                        <div
                                            ref={isTarget ? targetLineRef : null}
                                            onMouseEnter={() => setHoveredLineIndex(actualLineIdx)}
                                            onMouseLeave={() => setHoveredLineIndex(null)}
                                            className={cn(
                                                "flex group transition-all duration-150",
                                                isTarget ? "bg-blue-50/60" : "",
                                                isHovered && !isEditing ? "bg-slate-100/80" : "",
                                                isEditing ? "bg-amber-50/50" : ""
                                            )}
                                        >
                                            {/* Line Number */}
                                            <div
                                                className={cn("w-16 min-w-[64px] text-right select-none pr-4 border-r border-slate-100 py-0.5 transition-colors",
                                                    isTarget ? "text-blue-600 font-bold bg-blue-50/30" :
                                                        isHovered ? "text-slate-500 bg-slate-50" : "text-slate-300 bg-white"
                                                )}
                                            >
                                                {lineNumber}
                                            </div>

                                            {/* Code Content */}
                                            <div className={cn("flex-1 pl-4 whitespace-pre font-mono py-0.5 relative flex items-center",
                                                isTarget ? "text-slate-900" : "text-slate-600"
                                            )}>
                                                {isTarget && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 pointer-events-none" />
                                                )}

                                                {isEditing ? (
                                                    <input
                                                        ref={editInputRef}
                                                        type="text"
                                                        value={editingLineValue}
                                                        onChange={(e) => setEditingLineValue(e.target.value)}
                                                        onKeyDown={handleEditKeyDown}
                                                        className="flex-1 bg-white border border-amber-300 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent mr-2"
                                                        style={{ fontFamily: "'Consolas', 'Monaco', 'Courier New', monospace" }}
                                                    />
                                                ) : (
                                                    <span className="flex-1">{highlightGCode(line)}</span>
                                                )}
                                            </div>

                                            {/* Action Buttons */}
                                            <div className={cn(
                                                "flex items-center gap-1 pr-3 transition-opacity duration-150",
                                                (isHovered || isEditing) ? "opacity-100" : "opacity-0"
                                            )}>
                                                {isEditing ? (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={handleConfirmEdit}
                                                            className="h-6 w-6 p-0 hover:bg-emerald-100 text-emerald-600"
                                                            title="확인 (Enter)"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={handleCancelEdit}
                                                            className="h-6 w-6 p-0 hover:bg-slate-200 text-slate-500"
                                                            title="취소 (Esc)"
                                                        >
                                                            <XCircle className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleStartEdit(actualLineIdx)}
                                                            className="h-6 w-6 p-0 hover:bg-blue-100 text-blue-600"
                                                            title="수정"
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteLine(actualLineIdx)}
                                                            className="h-6 w-6 p-0 hover:bg-rose-100 text-rose-600"
                                                            title="삭제"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* 패치 제안이 있는 라인 아래에 제안 내역 표시 */}
                                        {linePatch && (
                                            <div className="flex bg-gradient-to-r from-amber-50/80 to-orange-50/50 border-l-4 border-amber-400">
                                                {/* 빈 라인번호 영역 */}
                                                <div className="w-16 min-w-[64px] border-r border-slate-100 bg-amber-50/30" />

                                                {/* 패치 제안 내용 */}
                                                <div className="flex-1 px-4 py-2">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Badge className="text-[10px] font-bold bg-amber-100 text-amber-700 border-amber-200">
                                                            패치 제안
                                                        </Badge>
                                                        <span className="text-[11px] text-slate-500">{linePatch.reason}</span>
                                                    </div>

                                                    {/* - 원본 / + 수정 표시 */}
                                                    <div className="space-y-1 text-xs font-mono">
                                                        <div className="flex items-center gap-2 bg-rose-50/80 rounded px-2 py-1">
                                                            <span className="text-rose-500 font-bold select-none w-4">-</span>
                                                            <span className="text-rose-600 line-through">{linePatch.original || line}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 bg-emerald-50/80 rounded px-2 py-1">
                                                            <span className="text-emerald-500 font-bold select-none w-4">+</span>
                                                            <span className="text-emerald-700 font-medium">{linePatch.modified || '(삭제)'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                            {lines.length === 0 && (
                                <div className="flex flex-col items-center justify-center p-20 opacity-50">
                                    <FileCode className="h-12 w-12 mb-4 text-slate-300" />
                                    <span className="text-slate-400">No G-code content available</span>
                                </div>
                            )}
                        </div>

                        {/* Mini Map or Status Bar (Visual only) */}
                        <div className="h-6 bg-slate-100 text-slate-500 text-[10px] flex items-center px-4 justify-between select-none border-t border-slate-200">
                            <span>Ready</span>
                            <span>Ln {targetLineIndex + 1}, Col 1</span>
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* 수정사항 저장 확인 모달 */}
            {showSaveConfirmModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-100 rounded-full">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">수정사항 저장</h3>
                        </div>
                        <p className="text-sm text-slate-600 mb-6">
                            현재 이슈에 대한 수정사항이 있습니다. 저장하시겠습니까?
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelSwitch}
                                className="px-4"
                            >
                                취소
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDiscardAndSwitch}
                                className="px-4 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                            >
                                저장 안함
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleConfirmSaveAndSwitch}
                                className="px-4 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Check className="h-4 w-4 mr-1" />
                                적용
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 패치 수정 내역 반영 확인 모달 */}
            {showPatchConfirmModal && pendingPatchEdit && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-100 rounded-full">
                                <Edit3 className="h-5 w-5 text-blue-600" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-800">수정 내역 반영</h3>
                        </div>

                        <p className="text-sm text-slate-600 mb-4">
                            G-code 수정 내역을 반영하시겠습니까?
                        </p>

                        {/* 수정 내역 미리보기 */}
                        <div className="bg-slate-50 rounded-lg p-4 mb-6 border border-slate-200">
                            <div className="text-xs font-mono text-slate-500 mb-2">
                                Line {pendingPatchEdit.lineIndex + 1}
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-start gap-2 bg-rose-50 rounded px-3 py-2">
                                    <span className="text-rose-500 font-bold select-none">-</span>
                                    <span className="text-rose-600 text-sm font-mono break-all line-through">
                                        {pendingPatchEdit.originalContent || '(빈 줄)'}
                                    </span>
                                </div>
                                <div className="flex items-start gap-2 bg-emerald-50 rounded px-3 py-2">
                                    <span className="text-emerald-500 font-bold select-none">+</span>
                                    <span className="text-emerald-700 text-sm font-mono break-all font-medium">
                                        {pendingPatchEdit.newContent || '(빈 줄)'}
                                    </span>
                                </div>
                            </div>

                            {/* 패치 제안과 비교 */}
                            {pendingPatchEdit.patchInfo.modified && pendingPatchEdit.patchInfo.modified !== pendingPatchEdit.newContent && (
                                <div className="mt-3 pt-3 border-t border-slate-200">
                                    <div className="text-xs text-amber-600 font-medium mb-1">
                                        ⚠️ 패치 제안과 다른 내용입니다
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        제안: <span className="font-mono">{pendingPatchEdit.patchInfo.modified}</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 justify-end">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCancelPatchEdit}
                                className="px-4"
                            >
                                계속 수정
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDiscardPatchEdit}
                                className="px-4 text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                            >
                                취소
                            </Button>
                            <Button
                                size="sm"
                                onClick={handleConfirmPatchEdit}
                                className="px-4 bg-blue-600 hover:bg-blue-700 text-white"
                            >
                                <Check className="h-4 w-4 mr-1" />
                                확인
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Dialog>
    );
};
