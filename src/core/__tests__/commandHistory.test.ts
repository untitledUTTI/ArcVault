import { describe, it, expect } from 'vitest';
import {
  CommandHistory,
  adjustAnchorsForTextEdit,
  applyAnnotationTextReplacement,
  applyBatchAnnotationAction,
  extractParagraphAtOffset,
} from '../commandHistory';
import type { AnnotationItem, DocEditableState } from '../../types/archive';

describe('CommandHistory & Annotation Anchor Shifting (Undo / Redo)', () => {
  it('supports multi-step Undo and Redo across text edits, accept revision, and comment resolution', () => {
    const baseText = '本文提出了旧表述，达到94.2%准确率。';
    const revStart = baseText.indexOf('旧表述');
    const comStart = baseText.indexOf('94.2%');

    const initialAnns: AnnotationItem[] = [
      {
        id: 'rev_1',
        type: 'revision',
        revisionKind: 'replace',
        author: '导师',
        date: '2026-11-25',
        originalText: '旧表述',
        suggestedText: '更严谨的新学术表述',
        anchorStart: revStart,
        anchorEnd: revStart + '旧表述'.length,
        status: 'open',
        replies: [],
      },
      {
        id: 'com_1',
        type: 'comment',
        author: '导师',
        date: '2026-11-25',
        commentText: '核对数值',
        originalText: '94.2%',
        anchorStart: comStart,
        anchorEnd: comStart + '94.2%'.length,
        status: 'open',
        replies: [],
      },
    ];

    const state0: DocEditableState = {
      markdownText: baseText,
      latexText: '',
      annotations: initialAnns,
      activeFormat: 'markdown',
    };

    expect(state0.markdownText.slice(revStart, revStart + 3)).toBe('旧表述');
    expect(state0.markdownText.slice(comStart, comStart + 5)).toBe('94.2%');

    const history = new CommandHistory<DocEditableState>();

    // Step 1: Manual edit before both annotations (+2 chars)
    const editedText = '【修改】本文提出了旧表述，达到94.2%准确率。';
    const state1: DocEditableState = {
      ...state0,
      markdownText: editedText,
      annotations: adjustAnchorsForTextEdit(state0.markdownText, editedText, state0.annotations),
    };
    history.push('编辑正文', state0, state1);

    expect(state1.markdownText.slice(state1.annotations[0].anchorStart, state1.annotations[0].anchorEnd)).toBe('旧表述');
    expect(state1.markdownText.slice(state1.annotations[1].anchorStart, state1.annotations[1].anchorEnd)).toBe('94.2%');

    // Step 2: Accept revision rev_1 -> replaces '旧表述' with '更严谨的新学术表述' and shifts com_1
    const accepted = applyAnnotationTextReplacement({
      text: state1.markdownText,
      annotations: state1.annotations,
      targetId: 'rev_1',
      replacementText: '更严谨的新学术表述',
      newStatus: 'accepted',
    });
    const state2: DocEditableState = {
      ...state1,
      markdownText: accepted.text,
      annotations: accepted.annotations,
    };
    history.push('接受修订', state1, state2);

    expect(state2.markdownText).toContain('更严谨的新学术表述');
    expect(state2.annotations[0].status).toBe('accepted');
    expect(state2.markdownText.slice(state2.annotations[1].anchorStart, state2.annotations[1].anchorEnd)).toBe('94.2%');

    // Undo Step 2 -> restores '旧表述' and open status
    const undo2 = history.undo();
    expect(undo2?.label).toBe('接受修订');
    expect(undo2?.state.markdownText).toBe(state1.markdownText);
    expect(undo2?.state.annotations[0].status).toBe('open');

    // Undo Step 1 -> restores state0
    const undo1 = history.undo();
    expect(undo1?.label).toBe('编辑正文');
    expect(undo1?.state.markdownText).toBe(state0.markdownText);
    expect(history.canUndo()).toBe(false);

    // Redo Step 1 & Step 2 -> restores state2 identically
    history.redo();
    const redo2 = history.redo();
    expect(redo2?.state.markdownText).toBe(state2.markdownText);
    expect(redo2?.state.annotations[0].status).toBe('accepted');
  });

  it('extracts target paragraph cleanly after AI rewrite replacement for unfocused confirmation', () => {
    const docText = [
      '# 1 引言',
      '',
      '第一段原始表述，需要补充量化指标。',
      '',
      '第二段保留内容。',
    ].join('\n');

    const anchorStart = docText.indexOf('需要补充量化指标');
    const anns: AnnotationItem[] = [
      {
        id: 'com_ai',
        type: 'comment',
        author: '导师',
        date: '2026-11-28',
        commentText: '补充定量提升百分比',
        originalText: '需要补充量化指标',
        anchorStart,
        anchorEnd: anchorStart + '需要补充量化指标'.length,
        status: 'open',
        replies: [],
      },
    ];

    const mutated = applyAnnotationTextReplacement({
      text: docText,
      annotations: anns,
      targetId: 'com_ai',
      replacementText: '相较基线方法准确率提升 4.6%',
      newStatus: 'resolved',
    });

    const updatedAnn = mutated.annotations.find((a) => a.id === 'com_ai')!;
    const paraBefore = extractParagraphAtOffset(docText, anchorStart);
    const paraAfter = extractParagraphAtOffset(mutated.text, updatedAnn.anchorStart);

    expect(paraBefore.text).toBe('第一段原始表述，需要补充量化指标。');
    expect(paraAfter.start).toBe(paraBefore.start);
    expect(paraAfter.text).toBe('第一段原始表述，相较基线方法准确率提升 4.6%。');
    expect(mutated.text).toContain('第二段保留内容。');
  });

  it('coalesces rapid typing into one Undo snapshot within 500ms and splits after window or breakMergeChain', () => {
    const history = new CommandHistory<DocEditableState>();
    const s0: DocEditableState = { markdownText: 'A', latexText: 'A', annotations: [], activeFormat: 'markdown' };
    const s1: DocEditableState = { markdownText: 'AB', latexText: 'A', annotations: [], activeFormat: 'markdown' };
    const s2: DocEditableState = { markdownText: 'ABC', latexText: 'A', annotations: [], activeFormat: 'markdown' };
    const s3: DocEditableState = { markdownText: 'ABCD', latexText: 'A', annotations: [], activeFormat: 'markdown' };
    const s4: DocEditableState = { markdownText: 'ABCDE', latexText: 'A', annotations: [], activeFormat: 'markdown' };

    history.push('编辑正文', s0, s1, { mergeKey: 'text-edit', mergeWindowMs: 500, skipClone: true, now: 1000 });
    history.push('编辑正文', s1, s2, { mergeKey: 'text-edit', mergeWindowMs: 500, skipClone: true, now: 1200 });
    expect(history.undoCount()).toBe(1);

    // Beyond 500ms window -> new snapshot
    history.push('编辑正文', s2, s3, { mergeKey: 'text-edit', mergeWindowMs: 500, skipClone: true, now: 1850 });
    expect(history.undoCount()).toBe(2);

    // Explicit breakMergeChain -> new snapshot even within 500ms
    history.breakMergeChain();
    history.push('编辑正文', s3, s4, { mergeKey: 'text-edit', mergeWindowMs: 500, skipClone: true, now: 1900 });
    expect(history.undoCount()).toBe(3);

    expect(history.undo()?.state.markdownText).toBe('ABCD');
    expect(history.undo()?.state.markdownText).toBe('ABC');
    expect(history.undo()?.state.markdownText).toBe('A');
    expect(history.redo()?.state.markdownText).toBe('ABC');
  });

  it('preserves annotation array identity in adjustAnchorsForTextEdit when no anchors shift', () => {
    const anns: AnnotationItem[] = [
      {
        id: 'c1',
        type: 'comment',
        author: 'A',
        date: '2026-11-28',
        originalText: 'Hello',
        anchorStart: 0,
        anchorEnd: 5,
        status: 'open',
        replies: [],
      },
    ];
    const next = adjustAnchorsForTextEdit('Hello world', 'Hello world!', anns);
    expect(next).toBe(anns);
  });

  it('handles batch accept, reject, resolve, and 600-annotation stress remapping accurately', () => {
    // 1. Mixed revisions + comments
    const text = 'Alpha [OLD1] mid [DEL2] end [INS3] tail.';
    const anns: AnnotationItem[] = [
      {
        id: 'r1',
        type: 'revision',
        revisionKind: 'replace',
        author: 'Reviewer',
        date: '2026-11-28',
        originalText: '[OLD1]',
        suggestedText: '[NEW_ONE]',
        anchorStart: text.indexOf('[OLD1]'),
        anchorEnd: text.indexOf('[OLD1]') + '[OLD1]'.length,
        status: 'open',
        replies: [],
      },
      {
        id: 'r2',
        type: 'revision',
        revisionKind: 'delete',
        author: 'Reviewer',
        date: '2026-11-28',
        originalText: '[DEL2]',
        anchorStart: text.indexOf('[DEL2]'),
        anchorEnd: text.indexOf('[DEL2]') + '[DEL2]'.length,
        status: 'open',
        replies: [],
      },
      {
        id: 'r3',
        type: 'revision',
        revisionKind: 'insert',
        author: 'Reviewer',
        date: '2026-11-28',
        originalText: '[INS3]',
        suggestedText: '[INS3]',
        anchorStart: text.indexOf('[INS3]'),
        anchorEnd: text.indexOf('[INS3]') + '[INS3]'.length,
        status: 'open',
        replies: [],
      },
      {
        id: 'c1',
        type: 'comment',
        author: 'Advisor',
        date: '2026-11-28',
        commentText: 'Check tail',
        originalText: 'tail',
        anchorStart: text.indexOf('tail'),
        anchorEnd: text.indexOf('tail') + 4,
        status: 'open',
        replies: [],
      },
    ];

    // Reject only r1 and r3 (r1 keeps text, r3 insert is removed)
    const rejected = applyBatchAnnotationAction({
      text,
      annotations: anns,
      action: 'reject-revisions',
      targetIds: ['r1', 'r3'],
    });
    expect(rejected.affectedCount).toBe(2);
    expect(rejected.text).toBe('Alpha [OLD1] mid [DEL2] end  tail.');
    const c1AfterReject = rejected.annotations.find((a) => a.id === 'c1')!;
    expect(rejected.text.slice(c1AfterReject.anchorStart, c1AfterReject.anchorEnd)).toBe('tail');
    expect(rejected.annotations.find((a) => a.id === 'r2')?.status).toBe('open');

    // Accept remaining r2 (delete)
    const accepted = applyBatchAnnotationAction({
      text: rejected.text,
      annotations: rejected.annotations,
      action: 'accept-revisions',
    });
    expect(accepted.affectedCount).toBe(1);
    expect(accepted.text).toBe('Alpha [OLD1] mid  end  tail.');
    const c1AfterAccept = accepted.annotations.find((a) => a.id === 'c1')!;
    expect(accepted.text.slice(c1AfterAccept.anchorStart, c1AfterAccept.anchorEnd)).toBe('tail');

    // Resolve comments
    const resolved = applyBatchAnnotationAction({
      text: accepted.text,
      annotations: accepted.annotations,
      action: 'resolve-comments',
    });
    expect(resolved.affectedCount).toBe(1);
    expect(resolved.annotations.find((a) => a.id === 'c1')?.status).toBe('resolved');

    // 2. 600-annotation stress test (300 revisions + 300 comments)
    const parts: string[] = [];
    const stressAnns: AnnotationItem[] = [];
    let pos = 0;
    for (let i = 0; i < 300; i++) {
      const revTok = `old_${i}`;
      const comTok = `com_${i}`;
      const chunk = `P${i} ${revTok} and ${comTok}. `;
      const revStart = pos + `P${i} `.length;
      const comStart = pos + `P${i} ${revTok} and `.length;
      stressAnns.push(
        {
          id: `sr_${i}`,
          type: 'revision',
          revisionKind: 'replace',
          author: 'Reviewer',
          date: '2026-11-28',
          originalText: revTok,
          suggestedText: `NEW_WORD_${i}`,
          anchorStart: revStart,
          anchorEnd: revStart + revTok.length,
          status: 'open',
          replies: [],
        },
        {
          id: `sc_${i}`,
          type: 'comment',
          author: 'Advisor',
          date: '2026-11-28',
          commentText: `Note ${i}`,
          originalText: comTok,
          anchorStart: comStart,
          anchorEnd: comStart + comTok.length,
          status: 'open',
          replies: [],
        },
      );
      parts.push(chunk);
      pos += chunk.length;
    }
    const bigText = parts.join('');
    const batchRes = applyBatchAnnotationAction({
      text: bigText,
      annotations: stressAnns,
      action: 'accept-revisions',
    });
    expect(batchRes.affectedCount).toBe(300);
    for (let i = 0; i < 300; i++) {
      const c = batchRes.annotations.find((a) => a.id === `sc_${i}`)!;
      expect(batchRes.text.slice(c.anchorStart, c.anchorEnd)).toBe(`com_${i}`);
      const r = batchRes.annotations.find((a) => a.id === `sr_${i}`)!;
      expect(batchRes.text.slice(r.anchorStart, r.anchorEnd)).toBe(`NEW_WORD_${i}`);
      expect(r.status).toBe('accepted');
    }
  });
});
