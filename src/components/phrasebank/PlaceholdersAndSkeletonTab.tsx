import React from 'react';
import {
  ArrowDown,
  ArrowUp,
  Copy,
  CornerDownLeft,
  FileDown,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { SKELETON_TEMPLATES } from '../../core/phrasebank/data/writingReference';
import { DEFAULT_PLACEHOLDERS, tokenizeWithHighlights } from '../../core/phrasebank/placeholders';
import type { PlaceholderValues, SkeletonItem } from '../../core/phrasebank/types';

interface PlaceholdersTabProps {
  isZh?: boolean;
  values: PlaceholderValues;
  enabled: boolean;
  onChangeValues: (next: PlaceholderValues) => void;
  onToggleEnabled: () => void;
}

export const PlaceholdersTab: React.FC<PlaceholdersTabProps> = ({
  isZh = true,
  values,
  enabled,
  onChangeValues,
  onToggleEnabled,
}) => {
  const samplePreview =
    'In recent years, X has become an essential component of Y; however, Smith (2020) argued that Z remains underexplored compared to Jones (2019).';
  const segments = tokenizeWithHighlights(samplePreview, values, enabled);

  const updateField = (key: keyof PlaceholderValues, val: string) => {
    onChangeValues({ ...values, [key]: val });
  };

  return (
    <div className="apb-stack">
      <div className="apb-ref-card">
        <div className="apb-ref-head" style={{ marginBottom: 8 }}>
          <div>
            <h3 className="apb-ref-title">
              {isZh ? '学术变量与引文占位符自动替换' : 'Academic Variable & Citation Slot Auto-Fill'}
            </h3>
            <div className="apb-hint-text">
              {isZh
                ? '填写你的研究对象（X / Y / Z）与引用文献（Smith / Jones），所有句型与拼句器将自动高亮替换并直接插入。'
                : 'Fill in your study subjects (X / Y / Z) and citations (Smith / Jones). All phrases and builders will auto-replace and highlight them.'}
            </div>
          </div>
          <div className="apb-phrase-actions">
            <button
              type="button"
              className={`apb-filter-chip ${enabled ? 'active' : ''}`}
              onClick={onToggleEnabled}
            >
              {enabled ? (isZh ? '已开启替换' : 'Auto-Fill On') : isZh ? '已暂停替换' : 'Paused'}
            </button>
            <button
              type="button"
              className="arc-btn apb-mini-btn"
              onClick={() => onChangeValues({ ...DEFAULT_PLACEHOLDERS })}
            >
              <RotateCcw size={11} />
              <span>{isZh ? '清空' : 'Reset'}</span>
            </button>
          </div>
        </div>

        <div className="apb-form-grid">
          <label>
            <div className="apb-field-label">{isZh ? 'X（核心研究对象 / 方法）' : 'X (Core Subject / Method)'}</div>
            <input
              type="text"
              className="arc-input"
              placeholder="e.g., incremental semantic retrieval"
              value={values.X}
              onChange={(e) => updateField('X', e.target.value)}
            />
          </label>
          <label>
            <div className="apb-field-label">{isZh ? 'Y（目标任务 / 领域）' : 'Y (Target Task / Domain)'}</div>
            <input
              type="text"
              className="arc-input"
              placeholder="e.g., long-document editing"
              value={values.Y}
              onChange={(e) => updateField('Y', e.target.value)}
            />
          </label>
          <label>
            <div className="apb-field-label">{isZh ? 'Z（第三变量 / 控制因素）' : 'Z (Third Variable / Control)'}</div>
            <input
              type="text"
              className="arc-input"
              placeholder="e.g., citation integrity"
              value={values.Z}
              onChange={(e) => updateField('Z', e.target.value)}
            />
          </label>
          <label>
            <div className="apb-field-label">{isZh ? 'Smith → 第一作者' : 'Smith → First Author'}</div>
            <input
              type="text"
              className="arc-input"
              placeholder="e.g., Zhang et al."
              value={values.Author}
              onChange={(e) => updateField('Author', e.target.value)}
            />
          </label>
          <label>
            <div className="apb-field-label">{isZh ? '2020 → 年份' : '2020 → Year'}</div>
            <input
              type="text"
              className="arc-input"
              placeholder="e.g., 2024"
              value={values.Year}
              onChange={(e) => updateField('Year', e.target.value)}
            />
          </label>
          <label>
            <div className="apb-field-label">{isZh ? 'Jones → 对照作者' : 'Jones → Comparison Author'}</div>
            <input
              type="text"
              className="arc-input"
              placeholder="e.g., Lee"
              value={values.Author2}
              onChange={(e) => updateField('Author2', e.target.value)}
            />
          </label>
          <label>
            <div className="apb-field-label">{isZh ? '2019 → 对照年份' : '2019 → Comparison Year'}</div>
            <input
              type="text"
              className="arc-input"
              placeholder="e.g., 2023"
              value={values.Year2}
              onChange={(e) => updateField('Year2', e.target.value)}
            />
          </label>
        </div>
      </div>

      <div className="apb-builder-preview-box">
        <div className="apb-hint-text" style={{ marginBottom: 4 }}>
          {isZh ? '实时替换预览：' : 'Live Preview:'}
        </div>
        <div className="apb-builder-preview-text">
          {segments.map((seg, i) =>
            seg.replaced ? (
              <span key={i} className="apb-ph-replaced">
                {seg.text}
              </span>
            ) : (
              <React.Fragment key={i}>{seg.text}</React.Fragment>
            ),
          )}
        </div>
      </div>
    </div>
  );
};

interface SkeletonTabProps {
  isZh?: boolean;
  activeTemplateId: string;
  onSelectTemplate: (templateId: string) => void;
  activeSlotId: string;
  onSelectSlot: (slotId: string) => void;
  items: SkeletonItem[];
  readOnly: boolean;
  onUpdateItem: (id: string, text: string) => void;
  onMoveItem: (id: string, dir: -1 | 1) => void;
  onRemoveItem: (id: string) => void;
  onClearAll: () => void;
  onInsert: (text: string, label: string) => void;
  onCopy: (text: string, label: string) => void;
}

export const SkeletonTab: React.FC<SkeletonTabProps> = ({
  isZh = true,
  activeTemplateId,
  onSelectTemplate,
  activeSlotId,
  onSelectSlot,
  items,
  readOnly,
  onUpdateItem,
  onMoveItem,
  onRemoveItem,
  onClearAll,
  onInsert,
  onCopy,
}) => {
  const template =
    SKELETON_TEMPLATES.find((t) => t.id === activeTemplateId) ?? SKELETON_TEMPLATES[0];

  const totalWords = items
    .map((i) => i.text.trim())
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;

  const compilePlain = (): string => {
    const sections: string[] = [];
    for (const slot of template.slots) {
      const slotItems = items.filter((it) => it.slotId === slot.id);
      if (slotItems.length > 0) {
        sections.push(slotItems.map((it) => it.text.trim()).join(' '));
      }
    }
    const orphanItems = items.filter((it) => !template.slots.some((s) => s.id === it.slotId));
    if (orphanItems.length > 0) {
      sections.push(orphanItems.map((it) => it.text.trim()).join(' '));
    }
    return sections.join('\n\n');
  };

  const compileMarkdown = (): string => {
    const sections: string[] = [`# ${template.titleCn}`];
    for (const slot of template.slots) {
      const slotItems = items.filter((it) => it.slotId === slot.id);
      if (slotItems.length > 0) {
        sections.push(
          `## ${slot.labelCn}\n${slotItems.map((it) => `- ${it.text.trim()}`).join('\n')}`,
        );
      }
    }
    const orphanItems = items.filter((it) => !template.slots.some((s) => s.id === it.slotId));
    if (orphanItems.length > 0) {
      sections.push(
        `## ${isZh ? '其他片段' : 'Other Snippets'}\n${orphanItems.map((it) => `- ${it.text.trim()}`).join('\n')}`,
      );
    }
    return sections.join('\n\n');
  };

  const orphanItems = items.filter((it) => !template.slots.some((s) => s.id === it.slotId));

  return (
    <div className="apb-stack">
      <div className="apb-ref-card">
        <div className="apb-ref-head" style={{ marginBottom: 6 }}>
          <div>
            <h3 className="apb-ref-title">{isZh ? '写作骨架拼装台' : 'Draft Skeleton Builder'}</h3>
            <div className="apb-hint-text">
              {isZh ? `已选 ${items.length} 句 · 约 ${totalWords} 词` : `${items.length} sentences · ~${totalWords} words`}
            </div>
          </div>
          <select
            className="arc-input"
            style={{ width: 'auto', maxWidth: 270 }}
            value={template.id}
            onChange={(e) => {
              const nextTpl = SKELETON_TEMPLATES.find((t) => t.id === e.target.value);
              onSelectTemplate(e.target.value);
              if (nextTpl && nextTpl.slots[0]) {
                onSelectSlot(nextTpl.slots[0].id);
              }
            }}
          >
            {SKELETON_TEMPLATES.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.titleCn} — {tpl.subtitleCn}
              </option>
            ))}
          </select>
        </div>

        <div className="apb-stack">
          {template.slots.map((slot) => {
            const slotItems = items.filter((it) => it.slotId === slot.id);
            const isSlotActive = activeSlotId === slot.id;
            return (
              <div
                key={slot.id}
                className={`apb-slot-card ${isSlotActive ? 'is-active' : ''}`}
                onClick={() => onSelectSlot(slot.id)}
              >
                <div className="apb-slot-header">
                  <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                    {slot.labelCn}{' '}
                    {slot.required && (
                      <span style={{ color: '#dc2626', fontSize: 11 }}>
                        {isZh ? '（核心）' : '(Required)'}
                      </span>
                    )}
                  </span>
                  <span className="apb-hint-text">
                    {isSlotActive
                      ? isZh
                        ? '当前接收槽位'
                        : 'Active Slot'
                      : isZh
                        ? `${slotItems.length} 句`
                        : `${slotItems.length} item(s)`}
                  </span>
                </div>
                <div className="apb-hint-text">{slot.hintCn}</div>

                {slotItems.map((it) => (
                  <div key={it.id} className="apb-slot-item" onClick={(e) => e.stopPropagation()}>
                    <textarea
                      className="arc-input"
                      style={{ minHeight: 46, fontSize: 12, padding: '5px 8px', resize: 'vertical' }}
                      value={it.text}
                      onChange={(e) => onUpdateItem(it.id, e.target.value)}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 4 }}>
                      <span className="apb-hint-text" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {it.sourceLabel ?? ''}
                      </span>
                      <div className="apb-phrase-actions">
                        <button
                          type="button"
                          className="arc-btn apb-mini-btn"
                          onClick={() => onMoveItem(it.id, -1)}
                          data-arc-tooltip={isZh ? '上移' : 'Move up'}
                        >
                          <ArrowUp size={11} />
                        </button>
                        <button
                          type="button"
                          className="arc-btn apb-mini-btn"
                          onClick={() => onMoveItem(it.id, 1)}
                          data-arc-tooltip={isZh ? '下移' : 'Move down'}
                        >
                          <ArrowDown size={11} />
                        </button>
                        <button
                          type="button"
                          className="arc-btn apb-mini-btn"
                          style={{ color: '#dc2626' }}
                          onClick={() => onRemoveItem(it.id)}
                          data-arc-tooltip={isZh ? '移除' : 'Remove'}
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {orphanItems.length > 0 && (
            <div className="apb-slot-card">
              <div className="apb-slot-header">
                <span style={{ fontWeight: 600, fontSize: 12.5 }}>
                  {isZh ? `跨模板暂存句 (${orphanItems.length})` : `Unassigned Snippets (${orphanItems.length})`}
                </span>
              </div>
              {orphanItems.map((it) => (
                <div key={it.id} className="apb-slot-item">
                  <textarea
                    className="arc-input"
                    style={{ minHeight: 44, fontSize: 12, padding: '5px 8px' }}
                    value={it.text}
                    onChange={(e) => onUpdateItem(it.id, e.target.value)}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                    <button
                      type="button"
                      className="arc-btn apb-mini-btn"
                      style={{ color: '#dc2626' }}
                      onClick={() => onRemoveItem(it.id)}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="apb-phrase-actions" style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button
            type="button"
            className="arc-btn arc-btn-primary apb-mini-btn"
            disabled={items.length === 0 || readOnly}
            onClick={() => onInsert(compilePlain(), isZh ? '写作骨架整段草稿' : 'Draft Skeleton')}
          >
            <CornerDownLeft size={11.5} />
            <span>{isZh ? '插入整段到正文' : 'Insert Full Draft'}</span>
          </button>
          <button
            type="button"
            className="arc-btn apb-mini-btn"
            disabled={items.length === 0}
            onClick={() => onCopy(compilePlain(), isZh ? '整段草稿' : 'Full Draft')}
          >
            <Copy size={11.5} />
            <span>{isZh ? '复制整段' : 'Copy Draft'}</span>
          </button>
          <button
            type="button"
            className="arc-btn apb-mini-btn"
            disabled={items.length === 0}
            onClick={() => onCopy(compileMarkdown(), isZh ? 'Markdown 草稿' : 'Markdown Draft')}
          >
            <FileDown size={11.5} />
            <span>{isZh ? '复制 Markdown' : 'Copy Markdown'}</span>
          </button>
          {items.length > 0 && (
            <button
              type="button"
              className="arc-btn apb-mini-btn"
              style={{ color: '#dc2626', marginLeft: 'auto' }}
              onClick={onClearAll}
            >
              <Trash2 size={11.5} />
              <span>{isZh ? '清空' : 'Clear'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
