import React, { useEffect, useImperativeHandle, useRef } from 'react';
import { EditorState, StateEffect, StateField, RangeSetBuilder } from '@codemirror/state';
import { EditorView, Decoration, type DecorationSet, keymap } from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap } from '@codemirror/commands';
import type { AnnotationItem, EditorFormat } from '../types/archive';

export interface AnchorGeometry {
  id: string;
  top: number;
  left: number;
  right: number;
  height: number;
}

export interface EditorSelectionInfo {
  from: number;
  to: number;
  selectedText: string;
  cursorPos: number;
  currentLineText: string;
  currentParagraph: string;
  paragraphStart: number;
  paragraphEnd: number;
}

export interface DocumentEditorHandle {
  insertAtCursor: (text: string) => void;
  replaceRange: (from: number, to: number, text: string) => void;
  selectAndScrollTo: (from: number, to: number, shouldFocus?: boolean) => void;
  getPositionTop: (pos: number) => number | null;
  focus: () => void;
}

interface DocumentEditorProps {
  value: string;
  format: EditorFormat;
  readOnly: boolean;
  typographyKey?: string;
  annotations: AnnotationItem[];
  hoveredAnnotationId: string | null;
  selectedAnnotationId?: string | null;
  onChange: (nextText: string) => void;
  onHoverAnnotation: (id: string | null) => void;
  onClickAnnotation: (id: string) => void;
  onLongPressMenu?: (info: { x: number; y: number; annotationId: string | null }) => void;
  onAnchorsMeasured: (geometries: Record<string, AnchorGeometry>) => void;
  onSelectionChange?: (info: EditorSelectionInfo) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

function extractSelectionInfo(state: EditorState): EditorSelectionInfo {
  const main = state.selection.main;
  const from = Math.min(main.from, main.to);
  const to = Math.max(main.from, main.to);
  const cursorPos = main.head;
  const doc = state.doc;
  const currentLine = doc.lineAt(cursorPos);

  let startLineNum = currentLine.number;
  while (startLineNum > 1 && doc.line(startLineNum - 1).text.trim().length > 0) {
    startLineNum -= 1;
  }

  let endLineNum = currentLine.number;
  while (endLineNum < doc.lines && doc.line(endLineNum + 1).text.trim().length > 0) {
    endLineNum += 1;
  }

  const paragraphStart = doc.line(startLineNum).from;
  const paragraphEnd = doc.line(endLineNum).to;

  return {
    from,
    to,
    selectedText: from < to ? state.sliceDoc(from, to) : '',
    cursorPos,
    currentLineText: currentLine.text,
    currentParagraph: state.sliceDoc(paragraphStart, paragraphEnd),
    paragraphStart,
    paragraphEnd,
  };
}

const setDecorationsPayload = StateEffect.define<{
  annotations: AnnotationItem[];
  hoveredId: string | null;
  selectedId: string | null;
}>();

function buildDecorations(
  docLen: number,
  annotations: AnnotationItem[],
  hoveredId: string | null,
  selectedId: string | null,
  docText: string,
): DecorationSet {
  const ranges: Array<{ from: number; to: number; deco: Decoration }> = [];

  for (const ann of annotations) {
    if (ann.status === 'resolved' || ann.status === 'accepted' || ann.status === 'rejected') {
      continue;
    }
    const from = Math.max(0, Math.min(docLen, ann.anchorStart));
    const to = Math.max(from, Math.min(docLen, ann.anchorEnd));
    if (to <= from) continue;

    const baseCls = ann.type === 'comment' ? 'cm-arc-comment' : 'cm-arc-revision';
    const hoverCls = hoveredId === ann.id ? ' cm-arc-hovered' : '';
    const selectedCls = selectedId === ann.id ? ' cm-arc-selected' : '';
    ranges.push({
      from,
      to,
      deco: Decoration.mark({
        class: `${baseCls}${hoverCls}${selectedCls}`,
        attributes: { 'data-ann-id': ann.id },
      }),
    });
  }

  // Highlight protected Zotero / EndNote citation tokens
  const citRegex = /\[@(?:zotero|endnote):\d{3}\]/g;
  for (const match of docText.matchAll(citRegex)) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    if (end <= docLen) {
      ranges.push({
        from: start,
        to: end,
        deco: Decoration.mark({
          class: 'cm-arc-citation-shield',
          attributes: { title: 'Protected Zotero/EndNote citation field' },
        }),
      });
    }
  }

  ranges.sort((a, b) => a.from - b.from || a.to - b.to);
  const builder = new RangeSetBuilder<Decoration>();
  for (const r of ranges) {
    builder.add(r.from, r.to, r.deco);
  }
  return builder.finish();
}

const annotationDecoField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const eff of tr.effects) {
      if (eff.is(setDecorationsPayload)) {
        return buildDecorations(
          tr.state.doc.length,
          eff.value.annotations,
          eff.value.hoveredId,
          eff.value.selectedId,
          tr.state.doc.toString(),
        );
      }
    }
    if (tr.docChanged) {
      return decos.map(tr.changes);
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function measurePosGeometry(
  view: EditorView,
  scroller: HTMLElement,
  fromPos: number,
  toPos: number,
): { top: number; left: number; right: number; height: number } | null {
  const docLen = view.state.doc.length;
  const safeFrom = Math.max(0, Math.min(docLen, fromPos));
  const safeTo = Math.max(safeFrom, Math.min(docLen, toPos));
  const scrollerRect = scroller.getBoundingClientRect();

  try {
    const cStart = view.coordsAtPos(safeFrom);
    if (cStart) {
      const cEnd = view.coordsAtPos(Math.max(safeFrom, safeTo - 1));
      return {
        top: Math.round(cStart.top - scrollerRect.top + scroller.scrollTop),
        left: Math.round(cStart.left - scrollerRect.left),
        right: Math.round((cEnd?.right ?? cStart.right) - scrollerRect.left),
        height: Math.round(Math.max(20, (cEnd?.bottom ?? cStart.bottom) - cStart.top)),
      };
    }
  } catch {
    // Fall back to lineBlockAt for off-screen virtualized positions
  }

  try {
    const block = view.lineBlockAt(safeFrom);
    const contentRect = view.contentDOM.getBoundingClientRect();
    const contentTop = contentRect.top - scrollerRect.top + scroller.scrollTop;
    const contentLeft = Math.round(contentRect.left - scrollerRect.left);
    const contentRight = Math.round(contentRect.right - scrollerRect.left);
    return {
      top: Math.round(contentTop + block.top),
      left: contentLeft,
      right: Math.max(contentLeft + 80, contentRight - 24),
      height: Math.round(Math.max(20, block.height)),
    };
  } catch {
    return null;
  }
}

export const DocumentEditor = React.forwardRef<DocumentEditorHandle, DocumentEditorProps>(({
  value,
  readOnly,
  typographyKey,
  annotations,
  hoveredAnnotationId,
  selectedAnnotationId = null,
  onChange,
  onHoverAnnotation,
  onClickAnnotation,
  onLongPressMenu,
  onAnchorsMeasured,
  onSelectionChange,
  scrollContainerRef,
}, ref) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastGeoSigRef = useRef<string>('');
  const lastSelSigRef = useRef<string>('');
  const latestPropsRef = useRef({
    readOnly,
    annotations,
    hoveredAnnotationId,
    selectedAnnotationId,
    onChange,
    onHoverAnnotation,
    onClickAnnotation,
    onLongPressMenu,
    onAnchorsMeasured,
    onSelectionChange,
  });
  latestPropsRef.current = {
    readOnly,
    annotations,
    hoveredAnnotationId,
    selectedAnnotationId,
    onChange,
    onHoverAnnotation,
    onClickAnnotation,
    onLongPressMenu,
    onAnchorsMeasured,
    onSelectionChange,
  };

  useImperativeHandle(
    ref,
    () => ({
      insertAtCursor(text: string) {
        const view = viewRef.current;
        if (!view || latestPropsRef.current.readOnly) return;
        const main = view.state.selection.main;
        const from = Math.min(main.from, main.to);
        const to = Math.max(main.from, main.to);
        const caret = from + text.length;
        view.dispatch({
          changes: { from, to, insert: text },
          selection: { anchor: caret },
          effects: EditorView.scrollIntoView(caret, { y: 'nearest' }),
        });
        view.focus();
      },
      replaceRange(from: number, to: number, text: string) {
        const view = viewRef.current;
        if (!view || latestPropsRef.current.readOnly) return;
        const docLen = view.state.doc.length;
        const safeFrom = Math.max(0, Math.min(docLen, from));
        const safeTo = Math.max(safeFrom, Math.min(docLen, to));
        const caret = safeFrom + text.length;
        view.dispatch({
          changes: { from: safeFrom, to: safeTo, insert: text },
          selection: { anchor: caret },
          effects: EditorView.scrollIntoView(caret, { y: 'center' }),
        });
        view.focus();
      },
      selectAndScrollTo(from: number, to: number, shouldFocus = true) {
        const view = viewRef.current;
        if (!view) return;
        const docLen = view.state.doc.length;
        const safeFrom = Math.max(0, Math.min(docLen, from));
        const safeTo = Math.max(safeFrom, Math.min(docLen, to));
        view.dispatch({
          selection: { anchor: safeFrom, head: safeTo },
          effects: EditorView.scrollIntoView(safeFrom, { y: 'center' }),
        });
        if (shouldFocus) {
          view.focus();
        }
      },
      getPositionTop(pos: number) {
        const view = viewRef.current;
        const scroller = scrollContainerRef.current;
        if (!view || !scroller) return null;
        return measurePosGeometry(view, scroller, pos, pos)?.top ?? null;
      },
      focus() {
        viewRef.current?.focus();
      },
    }),
    [scrollContainerRef],
  );

  const measureAnchors = () => {
    const view = viewRef.current;
    const scroller = scrollContainerRef.current;
    if (!view || !scroller) return;

    const geometries: Record<string, AnchorGeometry> = {};
    const sigParts: string[] = [];

    for (const ann of latestPropsRef.current.annotations) {
      const geo = measurePosGeometry(view, scroller, ann.anchorStart, ann.anchorEnd);
      if (geo) {
        geometries[ann.id] = { id: ann.id, ...geo };
        sigParts.push(`${ann.id}:${geo.top}:${geo.right}`);
      }
    }

    const sig = sigParts.join('|');
    if (sig !== lastGeoSigRef.current) {
      lastGeoSigRef.current = sig;
      latestPropsRef.current.onAnchorsMeasured(geometries);
    }
  };

  useEffect(() => {
    if (!hostRef.current) return;

    // Exclude built-in Ctrl+Z/Y from CodeMirror so our unified CommandHistory handles Undo/Redo globally
    const filteredKeymap = defaultKeymap.filter(
      (k) => k.key !== 'Mod-z' && k.key !== 'Mod-y' && k.key !== 'Mod-Shift-z',
    );

    const caretTheme = EditorView.theme({
      '& .cm-content': {
        caretColor: 'var(--arc-caret-color)',
      },
      '&.cm-focused .cm-cursor': {
        borderLeftColor: 'var(--arc-caret-color)',
      },
      '& .cm-dropCursor': {
        borderLeftColor: 'var(--arc-caret-color)',
      },
    });

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          markdown(),
          EditorView.lineWrapping,
          caretTheme,
          EditorState.readOnly.of(readOnly),
          keymap.of(filteredKeymap),
          annotationDecoField,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              latestPropsRef.current.onChange(update.state.doc.toString());
            }
            if (update.selectionSet || update.docChanged) {
              const info = extractSelectionInfo(update.state);
              const selSig = `${info.from}:${info.to}:${info.paragraphStart}:${info.paragraphEnd}:${info.currentParagraph.length}`;
              if (selSig !== lastSelSigRef.current) {
                lastSelSigRef.current = selSig;
                latestPropsRef.current.onSelectionChange?.(info);
              }
            }
            if (update.docChanged || update.geometryChanged || update.viewportChanged) {
              requestAnimationFrame(measureAnchors);
            }
          }),
          EditorView.domEventHandlers({
            mousemove(event) {
              const target = event.target as HTMLElement | null;
              const annEl = target?.closest('[data-ann-id]') as HTMLElement | null;
              const id = annEl?.getAttribute('data-ann-id') ?? null;
              if (id !== latestPropsRef.current.hoveredAnnotationId) {
                latestPropsRef.current.onHoverAnnotation(id);
              }
            },
            mouseleave() {
              if (latestPropsRef.current.hoveredAnnotationId !== null) {
                latestPropsRef.current.onHoverAnnotation(null);
              }
            },
            mousedown(event) {
              const target = event.target as HTMLElement | null;
              const annEl = target?.closest('[data-ann-id]') as HTMLElement | null;
              const id = annEl?.getAttribute('data-ann-id');
              if (id) {
                latestPropsRef.current.onClickAnnotation(id);
              }
            },
            contextmenu(event) {
              if (!latestPropsRef.current.onLongPressMenu) return;
              // Allow native Android/iOS touch selection & handles; intercept only desktop right-click
              if (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) return;
              event.preventDefault();
              const target = event.target as HTMLElement | null;
              const annEl = target?.closest('[data-ann-id]') as HTMLElement | null;
              const id = annEl?.getAttribute('data-ann-id') ?? null;
              latestPropsRef.current.onLongPressMenu({
                x: event.clientX,
                y: event.clientY,
                annotationId: id,
              });
            },
          }),
        ],
      }),
      parent: hostRef.current,
    });

    const hostEl = hostRef.current;
    let longPressTimer: number | null = null;
    let startX = 0;
    let startY = 0;
    const clearLp = () => {
      if (longPressTimer !== null) {
        window.clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    };
    const onPointerDownLp = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      if (!latestPropsRef.current.onLongPressMenu) return;
      // Do not hijack native cursor/selection handle dragging when text is already selected
      const sel = view.state.selection.main;
      const domSel = typeof window !== 'undefined' ? window.getSelection()?.toString() ?? '' : '';
      if (sel.from !== sel.to || domSel.length > 0) {
        clearLp();
        return;
      }
      clearLp();
      startX = e.clientX;
      startY = e.clientY;
      const target = e.target as HTMLElement | null;
      const annEl = target?.closest('[data-ann-id]') as HTMLElement | null;
      const annId = annEl?.getAttribute('data-ann-id') ?? null;
      longPressTimer = window.setTimeout(() => {
        longPressTimer = null;
        const curSel = view.state.selection.main;
        const curDomSel = typeof window !== 'undefined' ? window.getSelection()?.toString() ?? '' : '';
        if (curSel.from !== curSel.to || curDomSel.length > 0) return;
        latestPropsRef.current.onLongPressMenu?.({
          x: startX,
          y: startY,
          annotationId: annId,
        });
      }, 480);
    };
    const onPointerMoveLp = (e: PointerEvent) => {
      if (longPressTimer === null) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > 8) {
        clearLp();
      }
    };
    document.addEventListener('selectionchange', clearLp);
    hostEl.addEventListener('pointerdown', onPointerDownLp, { passive: true });
    hostEl.addEventListener('pointermove', onPointerMoveLp, { passive: true });
    hostEl.addEventListener('pointerup', clearLp, { passive: true });
    hostEl.addEventListener('pointercancel', clearLp, { passive: true });

    viewRef.current = view;
    const initSel = extractSelectionInfo(view.state);
    lastSelSigRef.current = `${initSel.from}:${initSel.to}:${initSel.paragraphStart}:${initSel.paragraphEnd}:${initSel.currentParagraph.length}`;
    latestPropsRef.current.onSelectionChange?.(initSel);
    view.dispatch({
      effects: setDecorationsPayload.of({
        annotations,
        hoveredId: hoveredAnnotationId,
        selectedId: selectedAnnotationId,
      }),
    });
    requestAnimationFrame(measureAnchors);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && scrollContainerRef.current) {
      ro = new ResizeObserver(() => requestAnimationFrame(measureAnchors));
      ro.observe(scrollContainerRef.current);
    }

    return () => {
      clearLp();
      document.removeEventListener('selectionchange', clearLp);
      hostEl.removeEventListener('pointerdown', onPointerDownLp);
      hostEl.removeEventListener('pointermove', onPointerMoveLp);
      hostEl.removeEventListener('pointerup', clearLp);
      hostEl.removeEventListener('pointercancel', clearLp);
      ro?.disconnect();
      view.destroy();
      viewRef.current = null;
    };
    // Re-create only on readOnly toggle; text & annotations sync below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Sync external text changes (Undo/Redo, format switch, accept revision)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  // Sync annotation highlights & hover/selected state
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setDecorationsPayload.of({
        annotations,
        hoveredId: hoveredAnnotationId,
        selectedId: selectedAnnotationId,
      }),
    });
    requestAnimationFrame(measureAnchors);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations, hoveredAnnotationId, selectedAnnotationId, typographyKey]);

  return <div ref={hostRef} />;
});

DocumentEditor.displayName = 'DocumentEditor';
