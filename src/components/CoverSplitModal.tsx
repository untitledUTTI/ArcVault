import React, { useState } from 'react';
import { Scissors, Check, X } from 'lucide-react';
import type { ParsedDocxBundle } from '../core/ooxml/docxParser';

interface CoverSplitModalProps {
  isZh?: boolean;
  bundle: ParsedDocxBundle;
  initialCutoff: number;
  initialRemember?: boolean;
  onConfirm: (coverEndBlockIndex: number, remember: boolean) => void;
  onClose: () => void;
}

export const CoverSplitModal: React.FC<CoverSplitModalProps> = ({
  isZh = true,
  bundle,
  initialCutoff,
  initialRemember = true,
  onConfirm,
  onClose,
}) => {
  const [cutoff, setCutoff] = useState(initialCutoff);
  const [remember, setRemember] = useState(initialRemember);
  const [visibleCount, setVisibleCount] = useState(() =>
    Math.min(bundle.blocks.length, Math.max(80, initialCutoff + 25)),
  );

  const previewBlocks = bundle.blocks.slice(0, Math.min(bundle.blocks.length, visibleCount));

  // Detect key boundary candidates (page breaks, headings, abstract/TOC/chapter starts) for quick jump
  const boundaryCandidates = bundle.blocks
    .map((b, idx) => ({ b, idx }))
    .filter(
      ({ b, idx }) =>
        idx > 0 &&
        idx < 150 &&
        (b.kind === 'page-break' ||
          b.hasExplicitBreakAfter ||
          b.kind === 'heading' ||
          /^(摘要|Abstract|摘\s*要|目\s*录|引言|绪论|第[一二三四五六七八九十1-9]+章)/i.test(
            b.previewText.trim(),
          )),
    )
    .slice(0, 8);

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div className="arc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scissors size={18} color="var(--accent)" />
            <strong>{isZh ? '智能封面识别与切分微调' : 'Smart Cover Detection & Split'}</strong>
          </div>
          <button className="arc-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body" data-tour="cover-split-body">
          <p style={{ marginTop: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
            {isZh ? (
              <>
                穹档已自动识别封面结束位置（前 <strong>{cutoff}</strong> 个段落/分页块将作为原始封面包无损封存，不进入正文 Markdown/LaTeX 编辑区；导出 Word 时将原样拼回）。点击下方任意段落可调整「正文起点」：
              </>
            ) : (
              <>
                ArcVault detected the cover boundary: the first <strong>{cutoff}</strong> blocks/page-breaks will be sealed losslessly and restored verbatim on Word export. Click any block below to adjust the body start point:
              </>
            )}
          </p>

          {boundaryCandidates.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                {isZh ? '快速定位分界点：' : 'Quick jump:'}
              </span>
              {boundaryCandidates.map(({ b, idx }) => {
                const targetCutoff = b.kind === 'page-break' || b.hasExplicitBreakAfter ? idx + 1 : idx;
                const label =
                  b.kind === 'page-break'
                    ? isZh
                      ? `#${idx + 1} 分页符后`
                      : `#${idx + 1} After Break`
                    : `#${idx + 1} ${b.previewText.slice(0, 12)}`;
                return (
                  <button
                    key={`jump-${idx}`}
                    type="button"
                    className={`arc-btn ${cutoff === targetCutoff ? 'arc-btn-primary' : ''}`}
                    style={{ height: 24, padding: '0 8px', fontSize: 11 }}
                    onClick={() => {
                      setCutoff(targetCutoff);
                      if (visibleCount < targetCutoff + 20) {
                        setVisibleCount(Math.min(bundle.blocks.length, targetCutoff + 25));
                      }
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {previewBlocks.map((b, idx) => {
              const isCover = idx < cutoff;
              return (
                <div
                  key={b.index}
                  onClick={() => setCutoff(idx)}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--arc-radius-sm)',
                    border: `1px solid ${idx === cutoff ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    background: isCover ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>#{idx + 1}</span>
                    <span>{b.previewText || (isZh ? '[空行 / 样式段]' : '[Blank / Styled Block]')}</span>
                  </div>
                  <span
                    className="arc-badge"
                    style={{
                      background: isCover ? 'rgba(234, 179, 8, 0.16)' : 'var(--accent-soft)',
                      color: isCover ? '#b45309' : 'var(--accent)',
                    }}
                  >
                    {isCover
                      ? isZh
                        ? '封面保留区'
                        : 'Cover (Sealed)'
                      : idx === cutoff
                        ? isZh
                          ? '▼ 正文从此开始'
                          : '▼ Body Starts Here'
                        : isZh
                          ? '正文区'
                          : 'Body'}
                  </span>
                </div>
              );
            })}
          </div>

          {visibleCount < bundle.blocks.length && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <button
                type="button"
                className="arc-btn"
                style={{ height: 28, fontSize: 12 }}
                onClick={() => setVisibleCount((v) => Math.min(bundle.blocks.length, v + 80))}
              >
                {isZh ? '展开更多 (+80 段)' : 'Show More (+80)'}
              </button>
              <button
                type="button"
                className="arc-btn"
                style={{ height: 28, fontSize: 12 }}
                onClick={() => setVisibleCount(bundle.blocks.length)}
              >
                {isZh ? `显示全部 (共 ${bundle.blocks.length} 段)` : `Show All (${bundle.blocks.length})`}
              </button>
            </div>
          )}

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 14,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>
              {isZh
                ? '记住此文档的封面切分规则（后续监听自动更新时直接沿用）'
                : 'Remember cover split rule for this document'}
            </span>
          </label>
        </div>

        <div className="arc-modal-footer" data-tour="cover-split-footer">
          <button className="arc-btn" onClick={() => setCutoff(0)}>
            {isZh ? '不剥离封面（全部导入）' : 'Do Not Split (Import All)'}
          </button>
          <button className="arc-btn" data-tour="cover-cancel-btn" onClick={onClose}>
            {isZh ? '取消' : 'Cancel'}
          </button>
          <button
            className="arc-btn arc-btn-primary"
            data-tour="cover-confirm-btn"
            onClick={() => onConfirm(cutoff, remember)}
          >
            <Check size={14} />
            <span>{isZh ? '确认切分并提取正文' : 'Confirm Split & Extract'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
