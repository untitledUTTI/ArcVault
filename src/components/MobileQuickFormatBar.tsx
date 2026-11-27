import React from 'react';
import {
  BookmarkPlus,
  Camera,
  Eye,
  EyeOff,
  GraduationCap,
  MessageSquare,
  Redo2,
  Undo2,
} from 'lucide-react';
import type { EditorFormat, HapticPattern } from '../types/archive';

interface MobileQuickFormatBarProps {
  isZh?: boolean;
  inRevisionMode?: boolean;
  readOnly: boolean;
  activeFormat: EditorFormat;
  splitPreview: boolean;
  canUndo: boolean;
  canRedo: boolean;
  openAnnotationCount: number;
  phrasebankActive: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onInsertSnippet: (snippet: string, wrapPair?: [string, string]) => void;
  onToggleFormat: () => void;
  onToggleSplitPreview: () => void;
  onOpenAnnotations: () => void;
  onTogglePhrasebank: () => void;
  onOpenCameraScan: () => void;
  onSaveMilestone: () => void;
  onHaptic: (pattern: HapticPattern) => void;
}

export const MobileQuickFormatBar: React.FC<MobileQuickFormatBarProps> = ({
  isZh = true,
  inRevisionMode = false,
  readOnly,
  activeFormat,
  splitPreview,
  canUndo,
  canRedo,
  openAnnotationCount,
  phrasebankActive,
  onUndo,
  onRedo,
  onInsertSnippet,
  onToggleFormat,
  onToggleSplitPreview,
  onOpenAnnotations,
  onTogglePhrasebank,
  onOpenCameraScan,
  onSaveMilestone,
  onHaptic,
}) => {
  return (
    <div
      className={`arc-mobile-quickbar ${inRevisionMode ? 'is-revision-capsule' : ''}`}
      data-tour="mobile-format-bar"
      role="toolbar"
      aria-label={isZh ? '移动端快捷学术工具栏' : 'Mobile Quick Format Bar'}
    >
      <div className="arc-mobile-quickbar-scroll">
        <button
          type="button"
          className="arc-quick-btn"
          disabled={!canUndo || readOnly}
          onClick={() => {
            onHaptic('light');
            onUndo();
          }}
          aria-label={isZh ? '撤销' : 'Undo'}
        >
          <Undo2 size={15} />
        </button>

        <button
          type="button"
          className="arc-quick-btn"
          disabled={!canRedo || readOnly}
          onClick={() => {
            onHaptic('light');
            onRedo();
          }}
          aria-label={isZh ? '重做' : 'Redo'}
        >
          <Redo2 size={15} />
        </button>

        <span className="arc-quick-sep" />

        <button
          type="button"
          className="arc-quick-btn arc-quick-mono"
          disabled={readOnly}
          onClick={() => {
            onHaptic('selection');
            onInsertSnippet(isZh ? '**粗体**' : '**bold**', ['**', '**']);
          }}
        >
          B
        </button>

        <button
          type="button"
          className="arc-quick-btn arc-quick-mono"
          disabled={readOnly}
          onClick={() => {
            onHaptic('selection');
            onInsertSnippet('$x$', ['$', '$']);
          }}
        >
          $
        </button>

        <button
          type="button"
          className="arc-quick-btn arc-quick-mono"
          disabled={readOnly}
          onClick={() => {
            onHaptic('selection');
            onInsertSnippet('\n$$\nE = mc^2\n$$\n', ['\n$$\n', '\n$$\n']);
          }}
        >
          $$
        </button>

        <button
          type="button"
          className="arc-quick-btn arc-quick-mono"
          disabled={readOnly}
          onClick={() => {
            onHaptic('selection');
            onInsertSnippet(activeFormat === 'latex' ? '\\section{}' : '## ');
          }}
        >
          #
        </button>

        <button
          type="button"
          className="arc-quick-btn arc-quick-mono"
          disabled={readOnly}
          onClick={() => {
            onHaptic('selection');
            onInsertSnippet('> ');
          }}
        >
          &gt;
        </button>

        <span className="arc-quick-sep" />

        <button
          type="button"
          className="arc-quick-btn arc-quick-pill"
          onClick={() => {
            onHaptic('selection');
            onToggleFormat();
          }}
        >
          {activeFormat === 'markdown' ? 'MD' : 'LaTeX'}
        </button>

        <button
          type="button"
          data-tour="format-preview-btn"
          className={`arc-quick-btn arc-quick-pill ${splitPreview ? 'is-active' : ''}`}
          onClick={() => {
            onHaptic('selection');
            onToggleSplitPreview();
          }}
        >
          {splitPreview ? <EyeOff size={14} /> : <Eye size={14} />}
          <span>{splitPreview ? (isZh ? '编辑' : 'Edit') : isZh ? '预览' : 'Preview'}</span>
        </button>

        <button
          type="button"
          className="arc-quick-btn arc-quick-pill"
          onClick={() => {
            onHaptic('light');
            onOpenAnnotations();
          }}
        >
          <MessageSquare size={14} />
          <span>{isZh ? '批注' : 'Notes'}</span>
          {openAnnotationCount > 0 && (
            <span className="arc-quick-badge">{openAnnotationCount}</span>
          )}
        </button>

        <button
          type="button"
          className={`arc-quick-btn arc-quick-pill ${phrasebankActive ? 'is-active' : ''}`}
          onClick={() => {
            onHaptic('light');
            onTogglePhrasebank();
          }}
        >
          <GraduationCap size={14} />
          <span>{isZh ? '句库' : 'Phrases'}</span>
        </button>

        <button
          type="button"
          className="arc-quick-btn arc-quick-pill"
          onClick={() => {
            onHaptic('light');
            onOpenCameraScan();
          }}
        >
          <Camera size={14} />
          <span>{isZh ? '扫描' : 'Scan'}</span>
        </button>

        <button
          type="button"
          className="arc-quick-btn arc-quick-pill is-primary"
          onClick={() => {
            onHaptic('success');
            onSaveMilestone();
          }}
        >
          <BookmarkPlus size={14} />
          <span>{isZh ? '快照' : 'Snap'}</span>
        </button>
      </div>
    </div>
  );
};
