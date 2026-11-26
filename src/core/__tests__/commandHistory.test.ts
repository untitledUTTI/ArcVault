import { describe, it, expect } from 'vitest';
import {
  CommandHistory,
  adjustAnchorsForTextEdit,
  applyAnnotationTextReplacement,
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
});
