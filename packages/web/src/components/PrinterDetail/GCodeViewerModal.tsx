import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Info, CheckCircle2, X, FileCode, Trash2, Edit3, Check, XCircle, Undo2, Wrench, Link2, Link2Off, Zap, ShieldAlert, ChevronRight, Clock, Layers, ThumbsUp, ThumbsDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DetailedIssue, PatchSuggestion } from '@/components/ai/GCodeAnalytics';
import type { IssueEditItem, PatchFeedback } from '@shared/types/gcodeAnalysisDbTypes';
import { saveIssueEdit } from '@/lib/gcodeAnalysisDbService';
import { useAuth } from '@shared/contexts/AuthContext';

interface GCodeViewerModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileName: string;
    gcodeContent: string;
    issues: DetailedIssue[];
    patches: PatchSuggestion[];
    reportId?: string;
    onSave?: (newContent: string) => Promise<void>;
    initialIssueIndex?: number;
    initialLine?: number;  // 특정 라인으로 직접 스크롤
    // 메트릭 정보 (시간, 필라멘트 등)
    metrics?: {
        printTime?: {
            value: string;
            seconds?: number;
        };
        filamentUsage?: {
            length: string;
            weight?: string;
        };
        layerCount?: {
            value: number;
        };
    };
}

// G-code 구문 하이라이팅
const highlightGCode = (line: string) => {
    if (line.trim().startsWith(';')) {
        return <span className="text-slate-400 italic">{line}</span>;
    }

    const parts = line.split(/(\s+)/);

    return parts.map((part, i) => {
        if (part.trim() === '') return part;

        // Command (G1, M104...) - Blue/Cyan
        if (/^[GM]\d+/.test(part)) {
            return <span key={i} className="text-blue-600 dark:text-blue-400 font-bold">{part}</span>;
        }

        // Coordinates (X,Y,Z,E) - Orange/Yellow for axis, Green/LightBlue for value
        if (/^[XYZE]-?[\d.]+/.test(part)) {
            const axis = part.charAt(0);
            const val = part.substring(1);
            return (
                <span key={i}>
                    <span className="text-orange-600 dark:text-orange-300 font-semibold">{axis}</span>
                    <span className="text-emerald-600 dark:text-emerald-300">{val}</span>
                </span>
            );
        }

        // Parameters (F,S,P) - Purple/Pink for param, Green/LightBlue for value
        if (/^[FSP]-?[\d.]+/.test(part)) {
            const param = part.charAt(0);
            const val = part.substring(1);
            return (
                <span key={i}>
                    <span className="text-purple-600 dark:text-purple-300 font-semibold">{param}</span>
                    <span className="text-amber-600 dark:text-amber-300">{val}</span>
                </span>
            );
        }

        if (part.startsWith(';')) {
            return <span key={i} className="text-slate-400 dark:text-slate-500 italic">{part}</span>;
        }

        return <span key={i} className="text-slate-700 dark:text-slate-300">{part}</span>;
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
    onSave,
    initialIssueIndex,
    initialLine,
    metrics
}) => {
    const { user } = useAuth();

    // 핵심 상태들
    const [lines, setLines] = useState<string[]>([]);
    const [originalLines, setOriginalLines] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    // 현재 선택된 항목 (이슈 또는 패치)
    const [selectedType, setSelectedType] = useState<'issue' | 'patch' | null>(null);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // 편집 상태
    const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState('');
    const [hoveredLineIndex, setHoveredLineIndex] = useState<number | null>(null);

    // 적용된 패치 추적 및 이전 상태 저장 (되돌리기용)
    const [appliedPatches, setAppliedPatches] = useState<Set<number>>(new Set());
    const [patchHistory, setPatchHistory] = useState<Map<number, { lines: string[], appliedPatches: Set<number>, lineOffsets: Map<number, number> }>>(new Map());

    // 패치 적용 후 유지할 라인 인덱스 (뷰 위치 유지용)
    const [fixedLineIndex, setFixedLineIndex] = useState<number | null>(null);

    // 패치 피드백 상태 (저장 버튼 클릭 전까지 로컬에만 유지)
    // key: patchIndex, value: 'like' | 'dislike'
    const [pendingFeedbacks, setPendingFeedbacks] = useState<Map<number, PatchFeedback>>(new Map());

    // 델타 추적 (대용량 파일 효율적 처리)
    const [deltas, setDeltas] = useState<Map<number, { lineIndex: number; action: string; originalContent?: string; newContent?: string }>>(new Map());

    // 라인 오프셋 추적 (패치 적용 시 라인 번호 변화 추적)
    // key: 원본 라인 번호, value: 오프셋 (삭제: -1, 추가: +N)
    const [lineOffsets, setLineOffsets] = useState<Map<number, number>>(new Map());
    const [newlyInsertedLineIndex, setNewlyInsertedLineIndex] = useState<number | null>(null);

    const editInputRef = useRef<HTMLInputElement>(null);
    const targetLineRef = useRef<HTMLDivElement>(null);
    const sidebarScrollRef = useRef<HTMLDivElement>(null);

    // 초기화
    useEffect(() => {
        if (isOpen && gcodeContent) {
            const newLines = gcodeContent.split('\n');
            setLines(newLines);
            setOriginalLines(newLines);
            setEditingLineIndex(null);
            setEditingValue('');
            setAppliedPatches(new Set());
            setPatchHistory(new Map());
            setFixedLineIndex(null);
            setPendingFeedbacks(new Map());
            setDeltas(new Map());
            setLineOffsets(new Map());

            // initialLine이 있으면 해당 라인에 해당하는 이슈 찾기
            if (initialLine !== undefined && initialLine > 0) {
                // 해당 라인에 해당하는 이슈 찾기 (새 구조: lines 배열 사용)
                const issueIdx = issues.findIndex(issue => {
                    if (issue.lines && issue.lines.length > 0) {
                        return issue.lines.includes(initialLine);
                    }
                    // 레거시 폴백
                    const issueLine = typeof issue.line === 'string' ? parseInt(issue.line, 10) : issue.line;
                    return issueLine === initialLine || issue.line_index === initialLine;
                });

                if (issueIdx >= 0) {
                    setSelectedType('issue');
                    setSelectedIndex(issueIdx);
                } else {
                    // 이슈가 없으면 선택 없이 해당 라인으로만 스크롤
                    setSelectedType(null);
                    setSelectedIndex(null);
                }
            } else if (initialIssueIndex !== undefined && initialIssueIndex >= 0 && initialIssueIndex < issues.length) {
                // initialIssueIndex가 있으면 우선 사용
                setSelectedType('issue');
                setSelectedIndex(initialIssueIndex);
            } else if (issues.length > 0) {
                // 첫 번째 이슈 자동 선택 (기본값)
                setSelectedType('issue');
                setSelectedIndex(0);
            } else if (patches.length > 0) {
                setSelectedType('patch');
                setSelectedIndex(0);
            } else {
                setSelectedType(null);
                setSelectedIndex(null);
            }

            // 사이드바 스크롤을 맨 위로
            setTimeout(() => {
                if (sidebarScrollRef.current) {
                    sidebarScrollRef.current.scrollTop = 0;
                }
            }, 50);

            // 초기 오픈 시 선택된 라인으로 스크롤
            setTimeout(() => {
                // initialLine이 있으면 해당 라인으로 직접 스크롤
                if (initialLine !== undefined && initialLine > 0) {
                    const lineElement = document.getElementById(`gcode-line-${initialLine}`);
                    if (lineElement) {
                        lineElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
                        // 하이라이트 효과
                        lineElement.classList.add('animate-pulse', 'bg-yellow-500/30');
                        setTimeout(() => {
                            lineElement.classList.remove('animate-pulse', 'bg-yellow-500/30');
                        }, 2000);
                        return;
                    }
                }
                // 그렇지 않으면 선택된 타겟으로 스크롤
                if (targetLineRef.current) {
                    targetLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
                }
            }, 300);
        }
    }, [isOpen, gcodeContent, patches.length, issues.length, initialIssueIndex, initialLine]);

    // 필터 상태
    const [activeTab, setActiveTab] = useState<'all' | 'critical' | 'warning'>('all');

    // 필터링된 이슈 목록
    const filteredIssues = useMemo(() => {
        return issues.filter(issue => {
            if (activeTab === 'all') return true;
            if (activeTab === 'critical') return issue.severity === 'critical' || issue.severity === 'high';
            if (activeTab === 'warning') return issue.severity === 'medium' || issue.severity === 'low' || issue.severity === 'info';
            return true;
        });
    }, [issues, activeTab]);

    // 카운트 계산
    const counts = useMemo(() => {
        const critical = issues.filter(i => i.severity === 'critical' || i.severity === 'high').length;
        const warning = issues.filter(i => i.severity === 'medium' || i.severity === 'low' || i.severity === 'info').length;
        return {
            total: issues.length,
            critical,
            warning
        };
    }, [issues]);

    // 편집 input 포커스
    useEffect(() => {
        if (editingLineIndex !== null && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingLineIndex]);

    // 이슈-패치 연결 맵 생성 (새 API 형식 ISSUE-1 ↔ PATCH-001 지원)
    const issuePatchMap = useMemo(() => {
        const map = new Map<number, number>(); // issueIndex -> patchIndex

        // 디버그: 데이터 구조 확인 (전체 객체 출력)
        console.log('[GCodeViewerModal] Issues:', issues.map(i => ({
            id: i.id,
            patch_id: i.patch_id,
            line: i.line,
            line_index: i.line_index
        })));
        console.log('[GCodeViewerModal] Patches (full):', patches);
        console.log('[GCodeViewerModal] First Patch keys:', patches[0] ? Object.keys(patches[0]) : 'no patches');
        console.log('[GCodeViewerModal] First Patch full:', patches[0]);

        // 전체 패치 구조 상세 출력 (원본 그대로)
        console.log('[GCodeViewerModal] ===== FULL PATCH STRUCTURE (RAW) =====');
        console.table(patches.map((p, idx) => ({
            idx,
            id: p.id,
            issue_id: p.issue_id,
            line: p.line,
            line_index: p.line_index,
            layer: p.layer,
            action: p.action,
            position: p.position,
            modified: p.modified,
            new_line: p.new_line,
            original: p.original,
            original_line: p.original_line,
            autofix_allowed: p.autofix_allowed,
            issue_type: p.issue_type,
            reason: p.reason?.substring(0, 50) + '...'
        })));
        console.log('[GCodeViewerModal] Raw patches array:', patches);
        console.log('[GCodeViewerModal] ================================');

        // 1. issue.patch_id -> patch.id 또는 patch.patch_id 매칭
        issues.forEach((issue, issueIdx) => {
            if (issue.patch_id) {
                const patchIdx = patches.findIndex(p =>
                    p.id === issue.patch_id ||
                    p.patch_id === issue.patch_id
                );
                if (patchIdx !== -1) {
                    map.set(issueIdx, patchIdx);
                    console.log(`[Match by patch_id] Issue ${issueIdx} (${issue.id}, patch_id: ${issue.patch_id}) -> Patch ${patchIdx}`);
                }
            }
        });

        // 2. patch.issue_id -> issue.id 매칭
        patches.forEach((patch, patchIdx) => {
            if (patch.issue_id) {
                const issueIdx = issues.findIndex(i => i.id === patch.issue_id);
                if (issueIdx !== -1 && !map.has(issueIdx)) {
                    map.set(issueIdx, patchIdx);
                    console.log(`[Match by issue_id] Patch ${patchIdx} (issue_id: ${patch.issue_id}) -> Issue ${issueIdx}`);
                }
            }
        });

        // 3. 라인 번호로 매칭 (ID 매칭이 안 된 경우 fallback)
        issues.forEach((issue, issueIdx) => {
            if (!map.has(issueIdx)) {
                const issueLine = issue.line ?? issue.line_index;
                if (issueLine !== undefined) {
                    const patchIdx = patches.findIndex(p => {
                        // new API: line_number, legacy: line_index, line
                        const patchLine = p.line_number ?? p.line_index ?? p.line;
                        return patchLine !== undefined && Number(patchLine) === Number(issueLine);
                    });
                    if (patchIdx !== -1 && !Array.from(map.values()).includes(patchIdx)) {
                        map.set(issueIdx, patchIdx);
                        console.log(`[Match by Line] Issue ${issueIdx} (line: ${issueLine}) -> Patch ${patchIdx}`);
                    }
                }
            }
        });

        console.log('[GCodeViewerModal] Final issuePatchMap:', Array.from(map.entries()));
        return map;
    }, [issues, patches]);

    // 현재 타겟 라인 인덱스 계산 (패치가 있으면 패치 라인, 없으면 이슈 라인)
    const targetLineIndex = useMemo(() => {
        if (selectedType === 'patch' && selectedIndex !== null && patches[selectedIndex]) {
            const patch = patches[selectedIndex];
            // new API: line_number (1-based) 우선, legacy: line_index (0-based), line (1-based)
            if (patch.line_number !== undefined) return patch.line_number - 1;
            if (patch.line_index !== undefined) return patch.line_index;
            if (patch.line !== undefined) return patch.line - 1;
        }
        if (selectedType === 'issue' && selectedIndex !== null && issues[selectedIndex]) {
            const issue = issues[selectedIndex];
            // 이슈에 연결된 패치가 있으면 패치 라인 사용 (패치와 이슈 라인이 다를 수 있음)
            const linkedPatchIndex = issuePatchMap.get(selectedIndex);
            if (linkedPatchIndex !== undefined) {
                const linkedPatch = patches[linkedPatchIndex];
                if (linkedPatch) {
                    if (linkedPatch.line_number !== undefined) return linkedPatch.line_number - 1;
                    if (linkedPatch.line_index !== undefined) return linkedPatch.line_index;
                    if (linkedPatch.line !== undefined) return linkedPatch.line - 1;
                }
            }
            // 패치 없으면 이슈 라인 사용
            if (issue.line_index !== undefined) return Number(issue.line_index);
            if (typeof issue.line === 'number') return issue.line - 1;
        }
        // 선택이 없지만 fixedLineIndex가 있으면 그 위치 유지 (패치 적용 후)
        if (fixedLineIndex !== null) {
            return fixedLineIndex;
        }
        return -1;
    }, [selectedType, selectedIndex, patches, issues, issuePatchMap, fixedLineIndex]);

    // 선택된 라인으로 스크롤 (초기 로드 시만 적용, 패치 적용 시는 위치 유지)
    // 주석 처리: 패치 적용 시 스크롤 안 함

    // 연결되지 않은 독립 패치들 (자동수정 가능 > 수동검토 순)
    const standalonPatches = useMemo(() => {
        const linkedPatchIndices = new Set(issuePatchMap.values());
        return patches
            .map((patch, index) => ({ patch, index }))
            .filter(({ index }) => !linkedPatchIndices.has(index))
            .sort((a, b) => {
                // 자동수정 가능 먼저 (autofix_allowed !== false && modified 있음)
                const aCanAutoFix = a.patch.autofix_allowed !== false && a.patch.modified ? 0 : 1;
                const bCanAutoFix = b.patch.autofix_allowed !== false && b.patch.modified ? 0 : 1;
                return aCanAutoFix - bCanAutoFix;
            });
    }, [patches, issuePatchMap]);

    // Better approach: Sort ALL issues first, then Filter.
    const sortedAndFilteredIssues = useMemo(() => {
        // 정렬: 자동수정 > 수동검토 > 패치없음 (적용됨도 원래 위치 유지)
        const sorted = issues.map((issue, index) => {
            const patchIndex = issuePatchMap.get(index);
            let hasPatch = false;
            let isAutoFixable = false;

            if (patchIndex !== undefined) {
                const patch = patches[patchIndex];
                if (patch) {
                    hasPatch = true;
                    isAutoFixable = patch.autofix_allowed !== false;
                }
            }

            let sortPriority = 0;
            if (!hasPatch) {
                sortPriority = 2; // 패치 없음
            } else {
                if (isAutoFixable) {
                    sortPriority = 0; // 자동 수정 (최우선)
                } else {
                    sortPriority = 1; // 수동검토
                }
            }
            // 패치 적용됨 여부와 관계없이 원래 우선순위 유지

            return { issue, originalIndex: index, sortPriority };
        }).sort((a, b) => a.sortPriority - b.sortPriority);

        // Filter
        return sorted.filter(item => {
            if (activeTab === 'all') return true;
            if (activeTab === 'critical') return item.issue.severity === 'critical' || item.issue.severity === 'high';
            if (activeTab === 'warning') return item.issue.severity === 'medium' || item.issue.severity === 'low' || item.issue.severity === 'info';
            return true;
        });
    }, [issues, patches, issuePatchMap, activeTab]);

    // 스니펫 범위 계산
    const snippetRange = useMemo(() => {
        if (targetLineIndex < 0) {
            return { start: 0, end: Math.min(100, lines.length) };
        }
        const start = Math.max(0, targetLineIndex - 50);
        const end = Math.min(lines.length, targetLineIndex + 50);
        return { start, end };
    }, [targetLineIndex, lines.length]);

    // 패치 카드 클릭 핸들러
    const handlePatchClick = useCallback((index: number) => {
        if (appliedPatches.has(index)) return;
        setSelectedType('patch');
        setSelectedIndex(index);
        setEditingLineIndex(null);
        setEditingValue('');
        setFixedLineIndex(null); // 새로운 선택 시 고정 위치 해제
        // 클릭 시 G-code 뷰로 스크롤
        setTimeout(() => {
            if (targetLineRef.current) {
                targetLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }, 100);
    }, [appliedPatches]);

    // 이슈 카드 클릭 핸들러
    const handleIssueClick = useCallback((index: number) => {
        setSelectedType('issue');
        setSelectedIndex(index);
        setEditingLineIndex(null);
        setEditingValue('');
        setFixedLineIndex(null);
        // 클릭 시 G-code 뷰로 스크롤
        setTimeout(() => {
            if (targetLineRef.current) {
                targetLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
            }
        }, 100);
    }, []);

    // 델타 추가 헬퍼 함수 (대용량 파일 효율적 처리)
    const addDelta = useCallback((lineIndex: number, action: string, originalContent?: string, newContent?: string) => {
        setDeltas(prev => {
            const newMap = new Map(prev);
            const delta = {
                lineIndex,
                action,
                originalContent,
                newContent,
            };
            newMap.set(lineIndex, delta);
            return newMap;
        });
    }, []);

    // 오프셋 계산 함수: 이전 패치들로 인한 라인 번호 변화량 계산
    const calculateOffset = useCallback((originalLineIdx: number): number => {
        let offset = 0;
        lineOffsets.forEach((deltaOffset, lineNum) => {
            // 현재 라인보다 앞선 라인들의 변화량만 합산
            if (lineNum <= originalLineIdx) {
                offset += deltaOffset;
            }
        });
        return offset;
    }, [lineOffsets]);

    // 패치 적용 핸들러 (new API: additional_lines, add_before/add_after 지원)
    const handleApplyPatch = useCallback(async (patchIndex: number) => {
        const patch = patches[patchIndex];
        if (!patch) return;

        // no_action, review는 적용 불가 (수동 검토 필요)
        if (patch.action === 'no_action' || patch.action === 'review') return;

        // 원본 라인 인덱스 계산 (new API: line_number, legacy: line_index, line)
        const originalLineIdx = patch.line_number !== undefined
            ? patch.line_number - 1  // line_number는 1-based
            : patch.line_index ?? (patch.line ? patch.line - 1 : -1);

        // 오프셋을 적용한 실제 라인 인덱스 계산
        const offset = calculateOffset(originalLineIdx);
        const lineIdx = originalLineIdx + offset;

        console.log('[Patch] Applying at original line:', originalLineIdx + 1, 'offset:', offset, 'actual line:', lineIdx + 1, 'action:', patch.action);

        if (lineIdx < 0 || lineIdx >= lines.length) return;

        // 되돌리기를 위해 현재 상태 저장 (lineOffsets 포함)
        setPatchHistory(prev => new Map(prev).set(patchIndex, {
            lines: [...lines],
            appliedPatches: new Set(appliedPatches),
            lineOffsets: new Map(lineOffsets)
        }));

        const newLines = [...lines];
        const originalContent = originalLines[lineIdx] || lines[lineIdx];

        // 수정할 내용 결정 (new API: patched_code.line, additional_lines / legacy: modified)
        const modifiedLine = patch.patched_code?.line || patch.modified;
        const additionalLines = patch.additional_lines || [];
        const position = patch.position || 'after'; // 기본값: after

        // autofix_allowed가 false이거나 modified가 없으면 리턴 (delete 제외)
        if (patch.autofix_allowed === false) {
            return;
        }

        // add/modify 액션인데 추가할 내용이 없으면 경고 후 리턴
        if ((patch.action === 'add' || patch.action === 'add_before' || patch.action === 'add_after' ||
            patch.action === 'insert' || patch.action === 'insert_after' || patch.action === 'modify') &&
            !modifiedLine && additionalLines.length === 0) {
            alert('패치에 추가할 내용(modified)이 정의되지 않았습니다.\n수동으로 코드를 편집해주세요.');
            return;
        }

        if (patch.action === 'remove' || patch.action === 'delete') {
            // 라인 삭제
            newLines.splice(lineIdx, 1);
            // 델타 추적: delete
            addDelta(lineIdx, 'delete', originalContent, undefined);
        } else if (patch.action === 'modify') {
            // 라인 수정 (position: "replace" 포함)
            if (modifiedLine) {
                newLines[lineIdx] = modifiedLine;
                // 델타 추적: modify
                addDelta(lineIdx, 'modify', originalContent, modifiedLine);
            }
        } else if (patch.action === 'add') {
            // position에 따라 before/after 결정
            const contentToAdd = additionalLines.length > 0 ? additionalLines.join('\n') : modifiedLine;
            if (position === 'before') {
                // 대상 라인 앞에 추가
                if (additionalLines.length > 0) {
                    newLines.splice(lineIdx, 0, ...additionalLines);
                } else if (modifiedLine) {
                    newLines.splice(lineIdx, 0, modifiedLine);
                }
                // 델타 추적: insert_before
                if (contentToAdd) addDelta(lineIdx, 'insert_before', undefined, contentToAdd);
            } else {
                // position === 'after' 또는 기본값
                // 대상 라인 뒤에 추가
                if (additionalLines.length > 0) {
                    newLines.splice(lineIdx + 1, 0, ...additionalLines);
                } else if (modifiedLine) {
                    newLines.splice(lineIdx + 1, 0, modifiedLine);
                }
                // 델타 추적: insert_after
                if (contentToAdd) addDelta(lineIdx, 'insert_after', undefined, contentToAdd);
            }
        } else if (patch.action === 'add_before') {
            // 대상 라인 앞에 추가 (legacy)
            const contentToAdd = additionalLines.length > 0 ? additionalLines.join('\n') : modifiedLine;
            if (additionalLines.length > 0) {
                newLines.splice(lineIdx, 0, ...additionalLines);
            } else if (modifiedLine) {
                newLines.splice(lineIdx, 0, modifiedLine);
            }
            // 델타 추적: insert_before
            if (contentToAdd) addDelta(lineIdx, 'insert_before', undefined, contentToAdd);
        } else if (patch.action === 'insert' || patch.action === 'insert_after' || patch.action === 'add_after') {
            // 대상 라인 뒤에 추가 (legacy)
            const contentToAdd = additionalLines.length > 0 ? additionalLines.join('\n') : modifiedLine;
            if (additionalLines.length > 0) {
                newLines.splice(lineIdx + 1, 0, ...additionalLines);
            } else if (modifiedLine) {
                newLines.splice(lineIdx + 1, 0, modifiedLine);
            }
            // 델타 추적: insert_after
            if (contentToAdd) addDelta(lineIdx, 'insert_after', undefined, contentToAdd);
        }

        setLines(newLines);
        setAppliedPatches(prev => new Set([...prev, patchIndex]));

        // 라인 오프셋 업데이트 (다른 패치들의 라인 번호에 영향)
        if (patch.action === 'remove' || patch.action === 'delete') {
            // 삭제: 이 라인 이후의 모든 라인이 -1 오프셋
            setLineOffsets(prev => {
                const newOffsets = new Map(prev);
                newOffsets.set(originalLineIdx, (prev.get(originalLineIdx) || 0) - 1);
                return newOffsets;
            });
        } else if (patch.action === 'add' || patch.action === 'add_before' || patch.action === 'add_after' ||
            patch.action === 'insert' || patch.action === 'insert_after') {
            // 추가: 추가된 라인 수만큼 오프셋 증가
            const addedCount = additionalLines.length > 0 ? additionalLines.length : (modifiedLine ? 1 : 0);
            if (addedCount > 0) {
                setLineOffsets(prev => {
                    const newOffsets = new Map(prev);
                    newOffsets.set(originalLineIdx, (prev.get(originalLineIdx) || 0) + addedCount);
                    return newOffsets;
                });
            }
        }
        // modify는 라인 수 변화 없으므로 오프셋 변경 없음

        // 패치 적용 후 뷰 위치 유지를 위해 라인 인덱스 저장
        setFixedLineIndex(lineIdx);

        // DB 저장
        if (user && reportId) {
            try {
                const editItem: IssueEditItem = {
                    lineIndex: lineIdx,
                    lineNumber: lineIdx + 1,
                    action: (patch.action === 'remove' || patch.action === 'delete') ? 'delete' : 'edit',
                    originalContent,
                    modifiedContent: (patch.action === 'remove' || patch.action === 'delete')
                        ? null
                        : additionalLines.length > 0
                            ? additionalLines.join('\n')
                            : modifiedLine || null,
                    editedAt: new Date().toISOString(),
                };

                await saveIssueEdit(
                    user.id,
                    reportId,
                    -1000 - patchIndex,
                    'patch_success',
                    [editItem],
                    {
                        issueLine: lineIdx + 1,
                        issueLineIndex: lineIdx,
                        note: `Patch applied: ${patch.action} (${patch.patch_id || patch.id || ''})`,
                    }
                );
            } catch (error) {
                console.error('Failed to save patch:', error);
            }
        }

        // 선택은 유지 (적용됨 상태 표시를 위해)
        // setSelectedType(null);
        // setSelectedIndex(null);
    }, [patches, lines, originalLines, user, reportId, appliedPatches, addDelta, lineOffsets, calculateOffset]);

    // 패치 되돌리기 핸들러
    const handleRevertPatch = useCallback((patchIndex: number) => {
        const history = patchHistory.get(patchIndex);
        if (!history) return;

        // 저장된 상태로 복원 (lineOffsets 포함)
        setLines(history.lines);
        setAppliedPatches(history.appliedPatches);
        setLineOffsets(history.lineOffsets);

        // 히스토리에서 제거
        setPatchHistory(prev => {
            const newMap = new Map(prev);
            newMap.delete(patchIndex);
            return newMap;
        });
    }, [patchHistory]);

    // 라인 편집 시작
    const handleStartEdit = useCallback((lineIndex: number) => {
        setEditingLineIndex(lineIndex);
        setEditingValue(lines[lineIndex] || '');
    }, [lines]);

    // 라인 추가
    const handleInsertLine = useCallback((lineIndex: number) => {
        const insertIndex = lineIndex + 1;
        const newLines = [...lines];
        // 빈 라인 추가
        newLines.splice(insertIndex, 0, '');
        setLines(newLines);
        // 편집 모드 진입
        setEditingLineIndex(insertIndex);
        setNewlyInsertedLineIndex(insertIndex);
        setEditingValue('');

        // 라인 오프셋 업데이트 (라인 추가)
        setLineOffsets(prev => {
            const newOffsets = new Map(prev);
            newOffsets.set(insertIndex, (prev.get(insertIndex) || 0) + 1);
            return newOffsets;
        });

        // G-code 뷰 스크롤
        setTimeout(() => {
            if (editInputRef.current) {
                editInputRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
                editInputRef.current.focus();
            }
        }, 100);
    }, [lines]);

    // 편집 확인
    const handleConfirmEdit = useCallback(() => {
        if (editingLineIndex === null) return;

        const isNewInsert = editingLineIndex === newlyInsertedLineIndex;
        const originalContent = isNewInsert ? undefined : (originalLines[editingLineIndex] || lines[editingLineIndex]);

        const newLines = [...lines];

        if (isNewInsert && !editingValue.trim()) {
            // 새로 추가했는데 내용이 없으면 라인 삭제 (취소와 동일)
            newLines.splice(editingLineIndex, 1);
            setLines(newLines);
            setNewlyInsertedLineIndex(null);
            setEditingLineIndex(null);
            setEditingValue('');

            // 라인 오프셋 복구 (라인 추가 취소)
            setLineOffsets(prev => {
                const newOffsets = new Map(prev);
                newOffsets.set(editingLineIndex, (prev.get(editingLineIndex) || 0) - 1);
                return newOffsets;
            });
            return;
        }

        newLines[editingLineIndex] = editingValue;
        setLines(newLines);

        // 델타 추적
        if (isNewInsert) {
            addDelta(editingLineIndex - 1, 'insert_after', undefined, editingValue);
            setNewlyInsertedLineIndex(null);
        } else if (originalContent !== editingValue) {
            addDelta(editingLineIndex, 'modify', originalContent, editingValue);
        }

        setEditingLineIndex(null);
        setEditingValue('');
    }, [editingLineIndex, editingValue, lines, originalLines, addDelta, newlyInsertedLineIndex]);

    // 편집 취소
    const handleCancelEdit = useCallback(() => {
        if (editingLineIndex !== null && editingLineIndex === newlyInsertedLineIndex) {
            // 새로 추가된 라인이면 삭제
            setLines(prev => prev.filter((_, idx) => idx !== editingLineIndex));
            setNewlyInsertedLineIndex(null);

            // 라인 오프셋 복구 (라인 추가 취소)
            setLineOffsets(prev => {
                const newOffsets = new Map(prev);
                newOffsets.set(editingLineIndex, (prev.get(editingLineIndex) || 0) - 1);
                return newOffsets;
            });
        }
        setEditingLineIndex(null);
        setEditingValue('');
    }, [editingLineIndex, newlyInsertedLineIndex]);

    // 라인 삭제
    const handleDeleteLine = useCallback((lineIndex: number) => {
        const originalContent = originalLines[lineIndex] || lines[lineIndex];
        const newLines = lines.filter((_, idx) => idx !== lineIndex);
        setLines(newLines);

        // 델타 추적: delete
        addDelta(lineIndex, 'delete', originalContent, undefined);

        // 라인 오프셋 업데이트 (수동 삭제)
        setLineOffsets(prev => {
            const newOffsets = new Map(prev);
            newOffsets.set(lineIndex, (prev.get(lineIndex) || 0) - 1);
            return newOffsets;
        });
    }, [lines, originalLines, addDelta]);

    // 키보드 이벤트
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleConfirmEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    }, [handleConfirmEdit, handleCancelEdit]);

    // 패치 피드백 (추천/비추천) 핸들러
    const handlePatchFeedback = useCallback((patchIndex: number, feedback: PatchFeedback) => {
        setPendingFeedbacks(prev => {
            const newMap = new Map(prev);
            // 같은 피드백을 다시 클릭하면 취소
            if (newMap.get(patchIndex) === feedback) {
                newMap.delete(patchIndex);
            } else {
                newMap.set(patchIndex, feedback);
            }
            return newMap;
        });
    }, []);

    // 수정된 G-code 다운로드
    const downloadGCode = useCallback((content: string, downloadFileName: string) => {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // 파일명에 _modified 추가
        const baseName = downloadFileName.replace(/\.gcode$/i, '');
        link.download = `${baseName}_modified.gcode`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, []);

    // 저장 (G-code 다운로드 + 스토리지 업로드 + 피드백 DB 저장)
    const handleSave = useCallback(async () => {
        // 수정사항이 없으면 알림
        if (appliedPatches.size === 0 && lines.join('\n') === originalLines.join('\n')) {
            alert('수정사항이 없습니다.');
            return;
        }

        setIsSaving(true);
        try {
            // 수정된 G-code 직접 다운로드 (lines는 이미 모든 수정이 반영된 상태)
            const modifiedContent = lines.join('\n');
            const baseName = fileName.replace(/\.gcode$/i, '');
            downloadGCode(modifiedContent, `${baseName}_modified.gcode`);

            // 2. 스토리지에도 저장 (onSave가 있으면)
            if (onSave) {
                const modifiedContent = lines.join('\n');
                await onSave(modifiedContent);
            }

            // 3. 피드백 저장 (DB)
            if (user && reportId && pendingFeedbacks.size > 0) {
                for (const [patchIndex, feedback] of pendingFeedbacks.entries()) {
                    const patch = patches[patchIndex];
                    if (!patch) continue;

                    const lineIdx = patch.line_number !== undefined ? patch.line_number - 1 :
                        patch.line_index !== undefined ? patch.line_index :
                            patch.line !== undefined ? patch.line - 1 : 0;

                    const editItem: IssueEditItem = {
                        lineIndex: lineIdx,
                        lineNumber: lineIdx + 1,
                        action: 'edit',
                        originalContent: patch.original || '',
                        modifiedContent: patch.modified || null,
                        editedAt: new Date().toISOString(),
                        feedback: feedback,
                        feedbackAt: new Date().toISOString(),
                    };

                    try {
                        await saveIssueEdit(
                            user.id,
                            reportId,
                            -2000 - patchIndex, // 피드백용 음수 인덱스
                            'patch_feedback',
                            [editItem],
                            {
                                patchIndex,
                                feedback,
                                patchId: patch.id || patch.patch_id,
                                note: `User feedback: ${feedback}`,
                            }
                        );
                    } catch (error) {
                        console.error('Failed to save patch feedback:', error);
                    }
                }
            }
        } finally {
            setIsSaving(false);
        }
    }, [lines, fileName, downloadGCode, onSave, user, reportId, pendingFeedbacks, patches, deltas, appliedPatches]);

    // 모달 닫기
    const handleClose = useCallback(() => {
        onClose();
    }, [onClose]);

    // 심각도 아이콘
    const getSeverityIcon = (severity: string) => {
        switch (severity) {
            case 'critical': return <AlertTriangle className="h-4 w-4 text-rose-600" />;
            case 'high': return <AlertTriangle className="h-4 w-4 text-orange-600" />;
            case 'medium': return <Info className="h-4 w-4 text-amber-600" />;
            default: return <Info className="h-4 w-4 text-blue-600" />;
        }
    };

    // 현재 선택된 패치 (직접 선택하거나 이슈에 연결된 패치)
    const selectedPatch = useMemo(() => {
        // 직접 패치를 선택한 경우
        if (selectedType === 'patch' && selectedIndex !== null) {
            return patches[selectedIndex] || null;
        }
        // 이슈를 선택한 경우 -> 연결된 패치 가져오기
        if (selectedType === 'issue' && selectedIndex !== null) {
            const linkedPatchIndex = issuePatchMap.get(selectedIndex);
            if (linkedPatchIndex !== undefined) {
                return patches[linkedPatchIndex] || null;
            }
        }
        return null;
    }, [selectedType, selectedIndex, patches, issuePatchMap]);

    // 현재 선택된 패치의 인덱스 (적용됨 여부 확인용)
    const selectedPatchIndex = useMemo(() => {
        if (selectedType === 'patch' && selectedIndex !== null) {
            return selectedIndex;
        }
        if (selectedType === 'issue' && selectedIndex !== null) {
            return issuePatchMap.get(selectedIndex) ?? null;
        }
        return null;
    }, [selectedType, selectedIndex, issuePatchMap]);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent
                className="max-w-[95vw] w-[1400px] h-[90vh] p-0 bg-white dark:bg-[#0d1117] shadow-2xl border border-slate-200 dark:border-[#30363d] sm:rounded-xl overflow-hidden"
                style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
                hideCloseButton
                aria-describedby={undefined}
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
                onFocusOutside={(e) => e.preventDefault()}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {/* Header - Light/Dark Mode Support */}
                <DialogHeader className="p-0 space-y-0 bg-slate-50 dark:bg-[#161b22] border-b border-slate-200 dark:border-[#30363d] flex-shrink-0 z-50">
                    <div className="h-14 px-5 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-slate-100 dark:bg-[#21262d] rounded-lg border border-slate-200 dark:border-[#30363d]">
                                    <FileCode className="h-5 w-5 text-violet-500 dark:text-violet-400" />
                                </div>
                                <DialogTitle className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                                    G-Code Smart Editor
                                </DialogTitle>
                            </div>
                            <div className="h-5 w-px bg-slate-200 dark:bg-[#30363d]" />
                            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-[#8b949e]">
                                <span className="font-mono">{fileName}</span>
                                <span className="text-slate-300 dark:text-[#484f58]">•</span>
                                <span className="font-mono text-xs">{(lines.join('\n').length / 1024).toFixed(1)} KB</span>
                            </div>
                            {/* 메트릭 정보 (시간, 필라멘트, 레이어) */}
                            {metrics && (
                                <>
                                    <div className="h-5 w-px bg-slate-200 dark:bg-[#30363d]" />
                                    <div className="flex items-center gap-4 text-xs">
                                        {metrics.printTime?.value && (
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-[#8b949e]">
                                                <Clock className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                                                <span className="font-medium">{metrics.printTime.value}</span>
                                            </div>
                                        )}
                                        {metrics.filamentUsage?.length && (
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-[#8b949e]">
                                                <div className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-orange-400 to-amber-500" />
                                                <span className="font-medium">{metrics.filamentUsage.length}</span>
                                                {metrics.filamentUsage.weight && (
                                                    <span className="text-slate-400 dark:text-slate-500">({metrics.filamentUsage.weight})</span>
                                                )}
                                            </div>
                                        )}
                                        {metrics.layerCount?.value && (
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-[#8b949e]">
                                                <Layers className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
                                                <span className="font-medium">{metrics.layerCount.value} layers</span>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClose}
                                className="h-8 px-3 text-slate-500 dark:text-[#8b949e] hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#30363d] rounded-md transition-colors"
                            >
                                닫기
                            </Button>
                            <Button
                                size="sm"
                                className="h-8 px-4 font-semibold bg-emerald-600 dark:bg-[#238636] hover:bg-emerald-700 dark:hover:bg-[#2ea043] text-white border border-emerald-600 dark:border-[#238636] rounded-md transition-colors"
                                onClick={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                                        저장 중...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" /> 저장 및 내보내기
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Main Content - flex-1과 min-h-0이 중요 */}
                <div
                    className="grid grid-cols-[400px_1fr]"
                    style={{ flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}
                >
                    {/* Left Sidebar: Patches & Issues - Solid Dark Background */}
                    <div
                        className="border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1e1e1e]"
                        style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
                    >
                        <div className="shrink-0 px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-[#1e1e1e] sticky top-0 z-10">
                            <h3 className="text-sm font-heading font-bold flex items-center gap-2 text-slate-800 dark:text-slate-200">
                                <div className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.4)] ring-2 ring-rose-500/20" />
                                분석 리포트
                            </h3>
                            <Badge variant="outline" className="font-mono text-[10px] h-6 px-2.5 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 shadow-sm rounded-lg group-hover:border-slate-300 transition-colors">
                                {patches.length} P / {issues.length} I
                            </Badge>
                        </div>

                        {/* 스크롤 영역 - min-h-0과 flex-1이 함께 있어야 함 */}
                        <div
                            ref={sidebarScrollRef}
                            style={{ flex: '1 1 0%', minHeight: 0, overflowY: 'auto' }}
                            className="bg-transparent"
                        >
                            <div className="p-4 space-y-4">
                                {/* 요약 통계 & 필터 탭 */}
                                <div className="grid grid-cols-3 gap-2 mb-4">
                                    <button
                                        onClick={() => setActiveTab('all')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer",
                                            activeTab === 'all'
                                                ? "bg-slate-200/50 dark:bg-slate-800 border-violet-500 ring-1 ring-violet-500"
                                                : "bg-white dark:bg-[#252526] border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#2d2d2d]"
                                        )}
                                    >
                                        <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{counts.total}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Total</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('critical')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer",
                                            activeTab === 'critical'
                                                ? "bg-rose-50 dark:bg-rose-950/20 border-rose-500 ring-1 ring-rose-500"
                                                : "bg-white dark:bg-[#252526] border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#2d2d2d]"
                                        )}
                                    >
                                        <span className="text-xl font-bold text-rose-500 dark:text-rose-400">{counts.critical}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Critical</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('warning')}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-2 rounded-lg border transition-all cursor-pointer",
                                            activeTab === 'warning'
                                                ? "bg-amber-50 dark:bg-amber-950/20 border-amber-500 ring-1 ring-amber-500"
                                                : "bg-white dark:bg-[#252526] border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-[#2d2d2d]"
                                        )}
                                    >
                                        <span className="text-xl font-bold text-amber-500 dark:text-amber-400">{counts.warning}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">Warning</span>
                                    </button>
                                </div>

                                {/* 이슈 목록 */}
                                <div>
                                    <div className="flex items-center justify-between mb-3 px-1">
                                        <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                            <ShieldAlert className="h-3.5 w-3.5" />
                                            감지된 문제점
                                        </h4>
                                        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded">
                                            {issues.length} Issues
                                        </span>
                                    </div>
                                    <div className="space-y-3">
                                        {/* 정렬 & 필터링된 이슈 리스트 렌더링 */}
                                        {sortedAndFilteredIssues.map(({ issue, originalIndex }) => {
                                            const issueIndex = originalIndex; // 원래 인덱스 사용
                                            const isSelected = selectedType === 'issue' && selectedIndex === issueIndex;
                                            const linkedPatchIndex = issuePatchMap.get(issueIndex);
                                            const linkedPatch = linkedPatchIndex !== undefined ? patches[linkedPatchIndex] : null;
                                            const hasPatch = linkedPatch !== null;
                                            const isPatchApplied = linkedPatchIndex !== undefined && appliedPatches.has(linkedPatchIndex);

                                            const fixedLine = fixedLineIndex;
                                            const issueLineNumber = typeof issue.line === 'number' ? issue.line : (issue.line ? parseInt(String(issue.line), 10) : 0);
                                            const isFixed = fixedLine !== null && fixedLine === (issueLineNumber - 1);
                                            // 심각도별 색상 설정 (Light/Dark)
                                            const severityColors = {
                                                critical: {
                                                    bg: 'bg-rose-50 dark:bg-[#252526]',
                                                    border: 'border-rose-200 dark:border-slate-700',
                                                    ring: 'ring-rose-200/50 dark:ring-rose-800/50',
                                                    accent: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]',
                                                    text: 'text-rose-700 dark:text-rose-400',
                                                    badgeBg: 'bg-rose-100 dark:bg-rose-900/40'
                                                },
                                                high: {
                                                    bg: 'bg-orange-50 dark:bg-[#252526]',
                                                    border: 'border-orange-200 dark:border-slate-700',
                                                    ring: 'ring-orange-200/50 dark:ring-orange-800/50',
                                                    accent: 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.4)]',
                                                    text: 'text-orange-700 dark:text-orange-400',
                                                    badgeBg: 'bg-orange-100 dark:bg-orange-900/40'
                                                },
                                                medium: {
                                                    bg: 'bg-amber-50 dark:bg-[#252526]',
                                                    border: 'border-amber-200 dark:border-slate-700',
                                                    ring: 'ring-amber-200/50 dark:ring-amber-800/50',
                                                    accent: 'bg-amber-500',
                                                    text: 'text-amber-700 dark:text-amber-400',
                                                    badgeBg: 'bg-amber-100 dark:bg-amber-900/40'
                                                },
                                                low: {
                                                    bg: 'bg-blue-50 dark:bg-[#252526]',
                                                    border: 'border-blue-200 dark:border-slate-700',
                                                    ring: 'ring-blue-200/50 dark:ring-blue-800/50',
                                                    accent: 'bg-blue-500',
                                                    text: 'text-blue-700 dark:text-blue-400',
                                                    badgeBg: 'bg-blue-100 dark:bg-blue-900/40'
                                                },
                                            };
                                            const colors = severityColors[issue.severity as keyof typeof severityColors] || severityColors.low;

                                            return (
                                                <div
                                                    key={issueIndex}
                                                    onClick={() => handleIssueClick(issueIndex)}
                                                    className={cn(
                                                        "group relative rounded-lg text-sm transition-all duration-200 cursor-pointer border overflow-hidden",
                                                        isPatchApplied
                                                            ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200/50 dark:border-emerald-900/30 opacity-75 grayscale-[0.3] hover:grayscale-0 hover:opacity-100"
                                                            : isSelected
                                                                ? cn(colors.bg, colors.border, "ring-1", colors.ring, "shadow-sm z-10")
                                                                : "bg-white dark:bg-[#252526] border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-[#2d2d2d]"
                                                    )}
                                                >
                                                    {/* 왼쪽 심각도 인디케이터 - High Contrast: Solid Line */}
                                                    <div className={cn(
                                                        "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                                                        isPatchApplied ? "bg-emerald-600" : colors.accent,
                                                        isSelected ? "w-1.5 opacity-100" : "opacity-80 group-hover:opacity-100"
                                                    )} />

                                                    <div className="pl-4 pr-3 py-3">
                                                        {/* 헤더: 제목 + 뱃지들 */}
                                                        <div className="flex items-start justify-between gap-3 mb-2">
                                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                                <div className={cn(
                                                                    "shrink-0 p-1.5 rounded-lg transition-colors border",
                                                                    isPatchApplied ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800" : cn(colors.badgeBg, colors.border.split(' ')[0], "dark:border-transparent ml-0.5")
                                                                )}>
                                                                    {isPatchApplied ? (
                                                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                                                    ) : (
                                                                        getSeverityIcon(issue.severity)
                                                                    )}
                                                                </div>
                                                                <span className={cn(
                                                                    "font-heading font-bold text-sm truncate",
                                                                    isPatchApplied ? "text-emerald-700 dark:text-emerald-400 decoration-slate-400/50" : "text-slate-800 dark:text-slate-100"
                                                                )}>
                                                                    {issue.title || issue.issueType}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {/* 패치 연결 상태 아이콘 */}
                                                                {hasPatch ? (
                                                                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 shadow-sm">
                                                                        <Zap className="h-3 w-3 text-emerald-500 dark:text-emerald-400 drop-shadow-sm" fill="currentColor" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                                        <Link2Off className="h-3 w-3 text-slate-400" />
                                                                    </div>
                                                                )}
                                                                {/* 라인 번호 */}
                                                                <Badge variant="outline" className={cn(
                                                                    "font-mono text-[10px] h-5 px-1.5 border min-w-[32px] justify-center shadow-sm",
                                                                    isPatchApplied
                                                                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900"
                                                                        : cn(colors.badgeBg, colors.text, colors.border)
                                                                )}>
                                                                    L{issue.line ?? issue.line_index ?? '?'}
                                                                </Badge>
                                                            </div>
                                                        </div>

                                                        {/* 설명 */}
                                                        <p className={cn(
                                                            "text-xs leading-relaxed mb-3 line-clamp-2 pl-1",
                                                            isPatchApplied ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-400"
                                                        )}>
                                                            {issue.description}
                                                        </p>

                                                        {/* 패치 섹션 - autofix_allowed 기준 분기 */}
                                                        {hasPatch && linkedPatchIndex !== undefined && (
                                                            linkedPatch.autofix_allowed === false ? (
                                                                // autofix_allowed === false: 수동 검토 필요 UI
                                                                <div className="rounded-lg p-2.5 transition-all bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30">
                                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                                            <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                                                                                수동 검토 필요
                                                                            </span>
                                                                        </div>
                                                                        <Badge className="text-[9px] font-bold h-4 px-1.5 border shadow-sm bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                                                                            {linkedPatch.action === 'review' ? '검토' : linkedPatch.action}
                                                                        </Badge>
                                                                    </div>

                                                                    {/* 수동 검토 사유 */}
                                                                    <div className="text-[10px] bg-white/80 dark:bg-slate-900/50 rounded px-2 py-1.5 mb-2 text-slate-600 dark:text-slate-300 border border-amber-200/50 dark:border-amber-700/50">
                                                                        <Info className="h-2.5 w-2.5 inline mr-1 text-amber-500" />
                                                                        {linkedPatch.reason || '자동 수정이 불가능한 항목입니다. 직접 코드를 확인하세요.'}
                                                                    </div>

                                                                    {/* 원본 코드 표시 */}
                                                                    {linkedPatch.original && (
                                                                        <div className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800 rounded px-2 py-1 text-slate-500 dark:text-slate-400 truncate border border-slate-200 dark:border-slate-700">
                                                                            <span className="text-slate-400 mr-1">L{linkedPatch.line}:</span>
                                                                            {linkedPatch.original}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                // autofix_allowed === true (또는 undefined): 자동 수정 가능 UI
                                                                <div className={cn(
                                                                    "rounded-lg p-2.5 transition-all",
                                                                    isPatchApplied
                                                                        ? "bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20"
                                                                        : "bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20 border border-indigo-100 dark:border-indigo-800/30"
                                                                )}>
                                                                    <div className="flex items-center justify-between gap-2 mb-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Wrench className={cn(
                                                                                "h-3 w-3",
                                                                                isPatchApplied ? "text-emerald-500" : "text-indigo-500 dark:text-indigo-400"
                                                                            )} />
                                                                            <span className={cn(
                                                                                "text-[10px] font-bold uppercase tracking-wide",
                                                                                isPatchApplied ? "text-emerald-600 dark:text-emerald-400" : "text-indigo-600 dark:text-indigo-300"
                                                                            )}>
                                                                                {isPatchApplied ? '수정 완료' : '자동 수정 가능'}
                                                                            </span>
                                                                        </div>
                                                                        <Badge className={cn(
                                                                            "text-[9px] font-bold h-4 px-1.5 border shadow-sm",
                                                                            linkedPatch.action === 'remove' || linkedPatch.action === 'delete' ? 'bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800' :
                                                                                linkedPatch.action === 'modify' ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' :
                                                                                    'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                                                        )}>
                                                                            {linkedPatch.action === 'remove' || linkedPatch.action === 'delete' ? '삭제' :
                                                                                linkedPatch.action === 'modify' ? '수정' :
                                                                                    linkedPatch.action === 'add' ? '추가' : '삽입'}
                                                                        </Badge>
                                                                    </div>

                                                                    {/* 패치 내용 미리보기 */}
                                                                    {linkedPatch.modified && !isPatchApplied && (
                                                                        <div className="text-[10px] font-mono bg-white/80 dark:bg-slate-900/50 rounded px-2 py-1.5 mb-2 text-slate-600 dark:text-slate-300 truncate border border-slate-200/50 dark:border-slate-700/50 shadow-sm">
                                                                            <ChevronRight className="h-2.5 w-2.5 inline mr-1 text-emerald-500" />
                                                                            {linkedPatch.modified}
                                                                        </div>
                                                                    )}

                                                                    {/* 버튼 */}
                                                                    {isPatchApplied ? (
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={(e) => { e.stopPropagation(); handleRevertPatch(linkedPatchIndex); }}
                                                                            className="w-full h-7 text-[10px] font-bold border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 bg-white/50 dark:bg-transparent shadow-sm"
                                                                        >
                                                                            <Undo2 className="h-3 w-3 mr-1.5" />
                                                                            되돌리기
                                                                        </Button>
                                                                    ) : (
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={(e) => { e.stopPropagation(); handleApplyPatch(linkedPatchIndex); }}
                                                                            disabled={!linkedPatch.modified && linkedPatch.action !== 'remove' && linkedPatch.action !== 'delete'}
                                                                            className={cn(
                                                                                "w-full h-7 text-[10px] font-bold shadow-md",
                                                                                (!linkedPatch.modified && linkedPatch.action !== 'remove' && linkedPatch.action !== 'delete')
                                                                                    ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                                                                                    : "bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white shadow-indigo-500/20"
                                                                            )}
                                                                        >
                                                                            <Zap className="h-3 w-3 mr-1.5 fill-current" />
                                                                            {(!linkedPatch.modified && linkedPatch.action !== 'remove' && linkedPatch.action !== 'delete')
                                                                                ? '수정 내용 없음'
                                                                                : '자동 수정 적용'}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                            )
                                                        )}

                                                        {/* 패치 없음 - 수동 확인 필요 */}
                                                        {!hasPatch && (
                                                            <div className="mt-2 rounded-lg p-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                                                                <div className="flex items-center gap-1.5 mb-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                                                    <Link2Off className="h-3 w-3" />
                                                                    패치 없음
                                                                </div>
                                                                <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                                                                    이 이슈에 대한 자동 패치가 제공되지 않습니다.
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {issues.length === 0 && (
                                            <div className="text-center py-12 px-4 bg-gradient-to-b from-emerald-50/50 to-transparent dark:from-emerald-900/10 rounded-2xl border border-dashed border-emerald-200 dark:border-emerald-800 mx-2">
                                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center ring-4 ring-emerald-50 dark:ring-emerald-900/10">
                                                    <CheckCircle2 className="h-8 w-8 text-emerald-500 dark:text-emerald-400" />
                                                </div>
                                                <h3 className="text-lg font-title font-bold text-slate-800 dark:text-slate-200 mb-1">완벽합니다!</h3>
                                                <p className="text-sm text-slate-500 dark:text-slate-400">G-code에서 문제가 발견되지 않았습니다</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 연결되지 않은 독립 패치들 */}
                                {standalonPatches.length > 0 && (
                                    <div>
                                        <div className="flex items-center justify-between mb-3 px-1 pt-4 border-t border-slate-200 dark:border-slate-700/50">
                                            <h4 className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                                <Wrench className="h-3.5 w-3.5" />
                                                추가 최적화
                                            </h4>
                                            <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded">
                                                {standalonPatches.length} Patches
                                            </span>
                                        </div>
                                        <div className="space-y-3">
                                            {standalonPatches.map(({ patch, index }) => {
                                                const isApplied = appliedPatches.has(index);
                                                const isSelected = selectedType === 'patch' && selectedIndex === index;
                                                const canAutoFix = patch.autofix_allowed !== false;

                                                return (
                                                    <div
                                                        key={index}
                                                        onClick={() => handlePatchClick(index)}
                                                        className={cn(
                                                            "group relative rounded-xl text-sm transition-all duration-200 cursor-pointer border overflow-hidden",
                                                            isApplied
                                                                ? "bg-emerald-50/30 dark:bg-emerald-950/10 border-emerald-200/50 dark:border-emerald-900/30 opacity-75 grayscale-[0.3]"
                                                                : !canAutoFix
                                                                    ? "bg-amber-50/30 dark:bg-amber-950/10 border-amber-200/50 dark:border-amber-900/30"
                                                                    : isSelected
                                                                        ? "bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800 ring-2 ring-indigo-200/50 dark:ring-indigo-800/50 shadow-md z-10"
                                                                        : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:shadow-lg hover:-translate-y-0.5 hover:border-indigo-200 dark:hover:border-indigo-700"
                                                        )}
                                                    >
                                                        {/* 왼쪽 인디케이터 */}
                                                        <div className={cn(
                                                            "absolute left-0 top-0 bottom-0 w-1 transition-all duration-300",
                                                            isApplied ? "bg-emerald-500/50" : !canAutoFix ? "bg-amber-500" : "bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.4)]",
                                                            isSelected ? "w-1.5 opacity-100" : "opacity-70 group-hover:opacity-100"
                                                        )} />

                                                        <div className="pl-4 pr-3 py-3">
                                                            <div className="flex items-center justify-between gap-2 mb-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn(
                                                                        "p-1.5 rounded-lg border",
                                                                        isApplied
                                                                            ? "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800"
                                                                            : !canAutoFix
                                                                                ? "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800"
                                                                                : "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800"
                                                                    )}>
                                                                        {isApplied ? (
                                                                            <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                                                        ) : !canAutoFix ? (
                                                                            <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                                                        ) : (
                                                                            <Zap className="h-3 w-3 text-indigo-600 dark:text-indigo-400" fill="currentColor" />
                                                                        )}
                                                                    </div>
                                                                    <Badge variant="outline" className="font-mono text-[10px] h-5 px-1.5 bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700">
                                                                        L{patch.line ?? patch.line_index ?? '?'}
                                                                    </Badge>
                                                                </div>
                                                                <Badge className={cn(
                                                                    "text-[9px] font-bold h-4 px-1.5 shadow-sm border",
                                                                    isApplied
                                                                        ? "bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800"
                                                                        : !canAutoFix
                                                                            ? "bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                                                                            : patch.action === 'remove' || patch.action === 'delete' ? 'bg-rose-100 text-rose-600 border-rose-200 dark:bg-rose-900/30 dark:text-rose-300 dark:border-rose-800' :
                                                                                patch.action === 'modify' ? 'bg-amber-100 text-amber-600 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800' :
                                                                                    'bg-emerald-100 text-emerald-600 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800'
                                                                )}>
                                                                    {isApplied ? '적용됨' :
                                                                        !canAutoFix ? '수동 검토' :
                                                                            patch.action === 'remove' || patch.action === 'delete' ? '삭제' :
                                                                                patch.action === 'modify' ? '수정' :
                                                                                    patch.action === 'add' ? '추가' : '삽입'}
                                                                </Badge>
                                                            </div>

                                                            <p className={cn(
                                                                "text-xs leading-relaxed line-clamp-2 mb-3 pl-1",
                                                                isApplied ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-400"
                                                            )}>
                                                                {patch.reason}
                                                            </p>

                                                            {/* 버튼 - autofix_allowed 기준 분기 */}
                                                            <div>
                                                                {isApplied ? (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={(e) => { e.stopPropagation(); handleRevertPatch(index); }}
                                                                        className="w-full h-7 text-[10px] font-bold border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 bg-white/50 dark:bg-transparent shadow-sm"
                                                                    >
                                                                        <Undo2 className="h-3 w-3 mr-1.5" />
                                                                        되돌리기
                                                                    </Button>
                                                                ) : !canAutoFix ? (
                                                                    // autofix_allowed === false: 수동 검토 필요 표시
                                                                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5 justify-center py-1.5 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
                                                                        <Info className="h-3 w-3" />
                                                                        코드를 직접 확인하세요
                                                                    </div>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={(e) => { e.stopPropagation(); handleApplyPatch(index); }}
                                                                        disabled={!patch.modified && patch.action !== 'remove' && patch.action !== 'delete'}
                                                                        className={cn(
                                                                            "w-full h-7 text-[10px] font-bold transition-all shadow-sm",
                                                                            (!patch.modified && patch.action !== 'remove' && patch.action !== 'delete')
                                                                                ? "bg-slate-300 text-slate-500 cursor-not-allowed shadow-none"
                                                                                : isSelected
                                                                                    ? "bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-indigo-500/20"
                                                                                    : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                                                                        )}
                                                                    >
                                                                        <Zap className="h-3 w-3 mr-1.5 fill-current" />
                                                                        {(!patch.modified && patch.action !== 'remove' && patch.action !== 'delete')
                                                                            ? '수정 내용 없음'
                                                                            : '패치 적용'}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: G-code Editor - High Contrast Dark Mode */}
                    <div
                        className="bg-white dark:bg-[#0d1117]"
                        style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}
                    >
                        {/* Editor Header - 고정 높이 - Darker background */}
                        <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-[#0d1117] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10" style={{ flexShrink: 0 }}>
                            <div className="flex items-center gap-3">
                                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] ring-2 ring-emerald-500/20" />
                                <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    {targetLineIndex >= 0 ? (
                                        <>
                                            <span className="font-semibold text-slate-700 dark:text-slate-300">{selectedType === 'patch' ? 'Patch' : 'Issue'}</span>
                                            at
                                            <Badge variant="outline" className="font-mono text-xs border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm">
                                                Line {targetLineIndex + 1}
                                            </Badge>
                                        </>
                                    ) : (
                                        <span className="opacity-50">Select an item to view</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-mono text-slate-400 dark:text-slate-500">
                                <span>UTF-8</span>
                                <span>G-code</span>
                                <span className="px-2 py-0.5 rounded font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    SNIPPET
                                </span>
                            </div>
                        </div>

                        {/* Code View - High Contrast Background */}
                        <div
                            className="font-mono text-sm leading-7 bg-white dark:bg-[#0d1117]"
                            style={{ flex: '1 1 0%', minHeight: 0, overflow: 'auto' }}
                        >
                            {lines.slice(snippetRange.start, snippetRange.end).map((line, idx) => {
                                const actualLineIdx = snippetRange.start + idx;
                                const isTarget = actualLineIdx === targetLineIndex;
                                const lineNumber = actualLineIdx + 1;
                                const isEditing = editingLineIndex === actualLineIdx;
                                const isHovered = hoveredLineIndex === actualLineIdx;

                                // 이 라인에 해당하는 패치 찾기
                                const linePatch = selectedPatch && targetLineIndex === actualLineIdx ? selectedPatch : null;

                                return (
                                    <React.Fragment key={actualLineIdx}>
                                        <div
                                            ref={isTarget ? targetLineRef : null}
                                            onMouseEnter={() => setHoveredLineIndex(actualLineIdx)}
                                            onMouseLeave={() => setHoveredLineIndex(null)}
                                            className={cn(
                                                "flex transition-all duration-150 border-l-4",
                                                isTarget
                                                    ? "bg-blue-50/60 dark:bg-blue-900/30 border-blue-500"
                                                    : isHovered && !isEditing
                                                        ? "bg-slate-50/80 dark:bg-slate-700/30 border-transparent"
                                                        : isEditing
                                                            ? "bg-amber-50/50 dark:bg-amber-900/20 border-amber-400"
                                                            : "bg-transparent border-transparent"
                                            )}
                                        >
                                            {/* Line Number */}
                                            <div className={cn(
                                                "w-16 min-w-[64px] text-right select-none pr-4 border-r border-slate-200 dark:border-slate-600 py-0.5 transition-colors",
                                                isTarget ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-50/30 dark:bg-blue-900/30" :
                                                    isHovered ? "text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50" : "text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-800/50"
                                            )}>
                                                {lineNumber}
                                            </div>

                                            {/* Code Content */}
                                            <div className={cn(
                                                "flex-1 pl-4 whitespace-pre font-mono py-0.5 relative flex items-center group/line",
                                                isTarget ? "text-slate-900 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
                                            )}>
                                                {isTarget && (
                                                    <div className="absolute left-0 top-0 bottom-0 w-px bg-blue-400/20 dark:bg-blue-500/20 pointer-events-none" />
                                                )}

                                                {isEditing ? (
                                                    <input
                                                        ref={editInputRef}
                                                        type="text"
                                                        value={editingValue}
                                                        onChange={(e) => setEditingValue(e.target.value)}
                                                        onKeyDown={handleKeyDown}
                                                        className="flex-1 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400 dark:text-amber-100 mr-2"
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
                                                            className="h-6 w-6 p-0 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                                            title="확인 (Enter)"
                                                        >
                                                            <Check className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={handleCancelEdit}
                                                            className="h-6 w-6 p-0 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
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
                                                            className="h-6 w-6 p-0 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                                                            title="수정"
                                                        >
                                                            <Edit3 className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleInsertLine(actualLineIdx)}
                                                            className="h-6 w-6 p-0 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
                                                            title="아래에 라인 추가"
                                                        >
                                                            <Plus className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => handleDeleteLine(actualLineIdx)}
                                                            className="h-6 w-6 p-0 hover:bg-rose-100 dark:hover:bg-rose-900/30 text-rose-600 dark:text-rose-400"
                                                            title="삭제"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* 선택된 패치 정보 표시 - 패치 내용과 적용 버튼 포함 */}
                                        {linePatch && selectedPatchIndex !== null && (
                                            <div className={cn(
                                                "border-l-4 relative",
                                                (linePatch.action === 'remove' || linePatch.action === 'delete') ? "bg-rose-50/80 dark:bg-rose-950/20 border-rose-400 dark:border-rose-600" :
                                                    (linePatch.action === 'insert' || linePatch.action === 'insert_after' || linePatch.action === 'add_after' || linePatch.action === 'add_before' || linePatch.action === 'add') ? "bg-emerald-50/80 dark:bg-emerald-950/20 border-emerald-400 dark:border-emerald-600" :
                                                        linePatch.action === 'no_action' ? "bg-slate-50/80 dark:bg-slate-900/50 border-slate-400 dark:border-slate-600" :
                                                            "bg-amber-50/80 dark:bg-amber-950/20 border-amber-400 dark:border-amber-600"
                                            )}>
                                                {/* 배경 효과 */}
                                                <div className="absolute inset-0 bg-white/40 dark:bg-slate-800/40 backdrop-blur-[1px] pointer-events-none" />

                                                <div className="flex relative z-10">
                                                    <div className="w-16 min-w-[64px] border-r border-slate-100 dark:border-slate-800 bg-transparent" />
                                                    <div className="flex-1 px-5 py-4">
                                                        {/* 패치 헤더 */}
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div className="flex items-center gap-3 flex-wrap">
                                                                <Badge className={cn(
                                                                    "text-[10px] font-bold shadow-sm",
                                                                    (linePatch.action === 'remove' || linePatch.action === 'delete') ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800" :
                                                                        (linePatch.action === 'insert' || linePatch.action === 'insert_after' || linePatch.action === 'add_after' || linePatch.action === 'add_before' || linePatch.action === 'add') ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800" :
                                                                            (linePatch.action === 'no_action' || linePatch.action === 'review') ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" :
                                                                                "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800"
                                                                )}>
                                                                    {(linePatch.action === 'remove' || linePatch.action === 'delete') ? '삭제 예정' :
                                                                        (linePatch.action === 'insert' || linePatch.action === 'insert_after' || linePatch.action === 'add_after') ? '뒤에 삽입' :
                                                                            linePatch.action === 'add_before' ? '앞에 삽입' :
                                                                                linePatch.action === 'add' ? (linePatch.position === 'before' ? '앞에 삽입' : linePatch.position === 'replace' ? '대체' : '뒤에 삽입') :
                                                                                    (linePatch.action === 'no_action' || linePatch.action === 'review') ? '수동 검토' :
                                                                                        linePatch.action === 'modify' ? '수정' :
                                                                                            '수정 예정'}
                                                                </Badge>
                                                                {/* 위험도 표시 (new API) */}
                                                                {linePatch.risk_level && (
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[9px] font-medium border shadow-sm",
                                                                        linePatch.risk_level === 'high' ? "border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-300 dark:border-rose-700" :
                                                                            linePatch.risk_level === 'medium' ? "border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700" :
                                                                                "border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-700"
                                                                    )}>
                                                                        위험도: {linePatch.risk_level === 'high' ? '높음' : linePatch.risk_level === 'medium' ? '중간' : '낮음'}
                                                                    </Badge>
                                                                )}
                                                                {/* 자동 적용 가능 여부 (new API) */}
                                                                {linePatch.can_auto_apply !== undefined && (
                                                                    <Badge variant="outline" className={cn(
                                                                        "text-[9px] font-medium border shadow-sm",
                                                                        linePatch.can_auto_apply ? "border-blue-300 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-700" : "border-slate-300 text-slate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                                                                    )}>
                                                                        {linePatch.can_auto_apply ? '✓ 자동 적용 가능' : '수동 검토 필요'}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Diff 뷰어 - new API: original_code/patched_code 지원 */}
                                                        {linePatch.original_code && linePatch.patched_code && (
                                                            <div className="mb-4 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                                                                {/* 원본 코드 */}
                                                                <div className="border-b border-slate-200 dark:border-slate-800">
                                                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50">
                                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase flex items-center gap-1.5">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                                            Before (Line {linePatch.line_number || linePatch.line_index || linePatch.line})
                                                                        </div>
                                                                    </div>
                                                                    <div className="font-mono text-xs p-3 space-y-0.5">
                                                                        {linePatch.original_code.context_before?.slice(-2).map((ctxLine, i) => (
                                                                            <div key={`ctx-before-${i}`} className="px-3 py-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded transition-colors">
                                                                                {ctxLine || ' '}
                                                                            </div>
                                                                        ))}
                                                                        <div className="px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-900/50 rounded flex items-center gap-2">
                                                                            <span className="text-rose-400 select-none">-</span> {linePatch.original_code.line}
                                                                        </div>
                                                                        {linePatch.original_code.context_after?.slice(0, 2).map((ctxLine, i) => (
                                                                            <div key={`ctx-after-${i}`} className="px-3 py-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 rounded transition-colors">
                                                                                {ctxLine || ' '}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>

                                                                {/* 패치 후 코드 */}
                                                                <div>
                                                                    <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50">
                                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase flex items-center gap-1.5">
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                                            After
                                                                        </div>
                                                                    </div>
                                                                    <div className="font-mono text-xs p-3 space-y-0.5 bg-white dark:bg-slate-800/50">
                                                                        {linePatch.patched_code.context_before?.slice(-2).map((ctxLine, i) => (
                                                                            <div key={`patched-ctx-before-${i}`} className="px-3 py-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded transition-colors">
                                                                                {ctxLine || ' '}
                                                                            </div>
                                                                        ))}

                                                                        {/* 변경 로직 시각화 */}
                                                                        <div className="relative">
                                                                            {/* 추가된 라인 */}
                                                                            {linePatch.action === 'add_before' && linePatch.additional_lines?.map((addLine, i) => (
                                                                                <div key={`add-before-${i}`} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50 rounded flex items-center gap-2 mb-0.5 animate-in fade-in slide-in-from-left-1 duration-300">
                                                                                    <span className="text-emerald-500 font-bold select-none">+</span> {addLine}
                                                                                </div>
                                                                            ))}

                                                                            {/* 삭제된 라인 (line-through) - 삭제만 하는 경우 */}
                                                                            {(linePatch.action === 'delete' || linePatch.action === 'remove') ? (
                                                                                <div className="px-3 py-1 bg-rose-50/50 dark:bg-rose-950/20 text-slate-400 dark:text-slate-600 line-through decoration-rose-400 decoration-2 rounded flex items-center gap-2">
                                                                                    <span className="opacity-0 select-none">-</span> {linePatch.original_code.line}
                                                                                </div>
                                                                            ) : (
                                                                                <div className={cn(
                                                                                    "px-3 py-1 rounded border flex items-center gap-2 transition-all",
                                                                                    linePatch.action === 'modify'
                                                                                        ? "bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800"
                                                                                        : linePatch.action === 'no_action'
                                                                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                                                                                            : "bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-transparent"
                                                                                )}>
                                                                                    <span className={cn(
                                                                                        "font-bold select-none",
                                                                                        linePatch.action === 'modify' ? "text-amber-500" : "opacity-0"
                                                                                    )}>{linePatch.action === 'modify' ? '~' : ' '}</span>
                                                                                    {linePatch.patched_code.line}
                                                                                </div>
                                                                            )}

                                                                            {/* 뒤에 추가된 라인 */}
                                                                            {(linePatch.action === 'add_after' || linePatch.action === 'insert_after' || linePatch.action === 'insert') && linePatch.additional_lines?.map((addLine, i) => (
                                                                                <div key={`add-after-${i}`} className="px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50 rounded flex items-center gap-2 mt-0.5 animate-in fade-in slide-in-from-left-1 duration-300">
                                                                                    <span className="text-emerald-500 font-bold select-none">+</span> {addLine}
                                                                                </div>
                                                                            ))}
                                                                        </div>

                                                                        {linePatch.patched_code.context_after?.slice(0, 2).map((ctxLine, i) => (
                                                                            <div key={`patched-ctx-after-${i}`} className="px-3 py-0.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900 rounded transition-colors">
                                                                                {ctxLine || ' '}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Legacy 패치 표시: modified 필드 사용 */}
                                                        {!linePatch.original_code && linePatch.action !== 'remove' && linePatch.action !== 'delete' && linePatch.action !== 'no_action' && (linePatch.modified || linePatch.additional_lines) && (
                                                            <div className="mb-4">
                                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 font-bold uppercase tracking-wide">변경 후:</div>
                                                                <div className={cn(
                                                                    "font-mono text-sm px-4 py-3 rounded-lg border shadow-sm",
                                                                    linePatch.action === 'modify'
                                                                        ? "bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100"
                                                                        : "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100"
                                                                )}>
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={cn("w-1 h-full rounded-full self-stretch shrink-0",
                                                                            linePatch.action === 'modify' ? "bg-amber-400" : "bg-emerald-400"
                                                                        )} />
                                                                        <div>
                                                                            {linePatch.modified && <div>{highlightGCode(linePatch.modified)}</div>}
                                                                            {linePatch.additional_lines?.map((addLine, i) => (
                                                                                <div key={i} className="text-emerald-700 dark:text-emerald-400 mt-0.5">+ {highlightGCode(addLine)}</div>
                                                                            ))}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Legacy: modified가 없는 add/insert 패치 - 수동 편집 필요 안내 */}
                                                        {!linePatch.original_code && !linePatch.modified && !linePatch.additional_lines?.length &&
                                                            (linePatch.action === 'add' || linePatch.action === 'add_before' || linePatch.action === 'add_after' ||
                                                                linePatch.action === 'insert' || linePatch.action === 'insert_after' || linePatch.action === 'review') && (
                                                                <div className="mb-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                                                    <div className="flex items-start gap-3">
                                                                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                                                        <div>
                                                                            <div className="text-xs font-bold text-amber-800 dark:text-amber-200 mb-1">
                                                                                {linePatch.action === 'review' ? '수동 검토 필요' : '수동 편집 필요'}
                                                                            </div>
                                                                            <div className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                                                                                {linePatch.action === 'review'
                                                                                    ? '이 라인은 자동 수정이 불가합니다. 아래 제안을 참고하여 수동으로 수정해주세요.'
                                                                                    : '추가할 코드가 정의되지 않았습니다. 위 라인을 클릭하여 직접 편집하거나, 아래 제안을 참고하세요.'}
                                                                            </div>
                                                                            <div className="mt-3 text-xs font-mono bg-white/60 dark:bg-slate-900/60 rounded px-3 py-2 text-slate-700 dark:text-slate-300 border border-amber-200/50 dark:border-amber-900/30">
                                                                                💡 {linePatch.reason}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                        {/* Legacy: 삭제 표시 */}
                                                        {!linePatch.original_code && (linePatch.action === 'remove' || linePatch.action === 'delete') && (
                                                            <div className="mb-4">
                                                                <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 font-bold uppercase">이 라인이 삭제됩니다</div>
                                                                <div className="font-mono text-sm px-4 py-3 rounded-lg border bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 line-through opacity-70 decoration-rose-500 decoration-2">
                                                                    {highlightGCode(line)}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* no_action 표시 */}
                                                        {linePatch.action === 'no_action' && (
                                                            <div className="mb-4 p-3 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                                                                <div className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-2">
                                                                    <AlertTriangle className="w-4 h-4 text-slate-400" />
                                                                    이 코드는 벤더 확장(H 파라미터 등)으로 자동 수정이 불가합니다. 수동으로 검토해 주세요.
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* 패치 적용 버튼 + 피드백 버튼 */}
                                                        <div className="mt-2 flex items-center justify-between">
                                                            {/* 피드백 버튼 (추천/비추천) */}
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-[10px] text-slate-400 dark:text-slate-500 mr-1">이 제안이 유용했나요?</span>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={(e) => { e.stopPropagation(); handlePatchFeedback(selectedPatchIndex!, 'like'); }}
                                                                    className={cn(
                                                                        "h-7 w-7 p-0 rounded-full transition-all",
                                                                        pendingFeedbacks.get(selectedPatchIndex!) === 'like'
                                                                            ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 ring-2 ring-emerald-500/30"
                                                                            : "text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                                                                    )}
                                                                    title="추천"
                                                                >
                                                                    <ThumbsUp className={cn("h-3.5 w-3.5", pendingFeedbacks.get(selectedPatchIndex!) === 'like' && "fill-current")} />
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={(e) => { e.stopPropagation(); handlePatchFeedback(selectedPatchIndex!, 'dislike'); }}
                                                                    className={cn(
                                                                        "h-7 w-7 p-0 rounded-full transition-all",
                                                                        pendingFeedbacks.get(selectedPatchIndex!) === 'dislike'
                                                                            ? "bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400 ring-2 ring-rose-500/30"
                                                                            : "text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                                                    )}
                                                                    title="비추천"
                                                                >
                                                                    <ThumbsDown className={cn("h-3.5 w-3.5", pendingFeedbacks.get(selectedPatchIndex!) === 'dislike' && "fill-current")} />
                                                                </Button>
                                                            </div>

                                                            {/* 패치 적용 버튼 */}
                                                            <div>
                                                                {(linePatch.action === 'no_action' || linePatch.action === 'review') ? (
                                                                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 text-xs font-medium">
                                                                        <Info className="h-4 w-4" />
                                                                        자동 수정 불가 - 수동 검토 필요
                                                                    </div>
                                                                ) : appliedPatches.has(selectedPatchIndex) ? (
                                                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200 dark:border-emerald-900">
                                                                        <CheckCircle2 className="h-4 w-4" />
                                                                        <span className="text-sm font-bold">패치가 적용되었습니다</span>
                                                                    </div>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={(e) => { e.stopPropagation(); handleApplyPatch(selectedPatchIndex!); }}
                                                                        className="font-bold bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-lg shadow-indigo-500/20 px-6"
                                                                    >
                                                                        <Zap className="h-4 w-4 mr-2 fill-current" />
                                                                        이 패치 적용하기
                                                                    </Button>
                                                                )}
                                                            </div>
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
                                    <FileCode className="h-12 w-12 mb-4 text-slate-300 dark:text-slate-600" />
                                    <span className="text-slate-400 dark:text-slate-500">No G-code content</span>
                                </div>
                            )}
                        </div>

                        {/* Status Bar - High Contrast */}
                        <div className="h-7 bg-slate-100 dark:bg-[#1e1e1e] text-slate-500 dark:text-slate-400 text-[10px] flex items-center px-4 justify-between border-t border-slate-200 dark:border-slate-800" style={{ flexShrink: 0 }}>
                            <div className="flex items-center gap-2">
                                <div className={cn("w-1.5 h-1.5 rounded-full", appliedPatches.size > 0 ? "bg-indigo-500 animate-pulse" : "bg-emerald-500")} />
                                <span>{appliedPatches.size > 0 ? `${appliedPatches.size} patches applied` : 'Ready'}</span>
                            </div>
                            <div className="font-mono">
                                Ln {targetLineIndex >= 0 ? targetLineIndex + 1 : '-'} : Col 1
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
