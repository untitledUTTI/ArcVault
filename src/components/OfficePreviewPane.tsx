import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Presentation,
  Table2,
  FileText,
} from 'lucide-react';
import type { OfficePreviewData } from '../types/archive';

interface OfficePreviewPaneProps {
  isZh?: boolean;
  title: string;
  preview: OfficePreviewData;
}

export const OfficePreviewPane: React.FC<OfficePreviewPaneProps> = ({ isZh = true, title, preview }) => {
  const [slideIdx, setSlideIdx] = useState(0);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [copiedCsv, setCopiedCsv] = useState(false);

  if (preview.kind === 'pptx') {
    const slides = preview.slides;
    const current = slides[slideIdx] ?? slides[0];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
            <Presentation size={15} color="var(--accent)" />
            <span>{isZh ? `演示文稿幻灯片预览 (${slides.length} 页)` : `Presentation Preview (${slides.length} slides)`}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              className="arc-btn arc-icon-btn"
              disabled={slideIdx <= 0}
              onClick={() => setSlideIdx((i) => Math.max(0, i - 1))}
            >
              <ChevronLeft size={14} />
            </button>
            <span className="arc-badge">
              {slides.length > 0 ? `${slideIdx + 1} / ${slides.length}` : '0 / 0'}
            </span>
            <button
              className="arc-btn arc-icon-btn"
              disabled={slideIdx >= slides.length - 1}
              onClick={() => setSlideIdx((i) => Math.min(slides.length - 1, i + 1))}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {current ? (
          <div
            style={{
              padding: 20,
              borderRadius: 14,
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
              boxShadow: 'var(--shadow-sm)',
              minHeight: 220,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                {title} · Slide {current.index}
              </div>
              <h3 style={{ margin: '0 0 12px', fontSize: 17 }}>{current.title}</h3>
              <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.75, fontSize: 13.5 }}>
                {current.bullets.map((b, bi) => (
                  <li key={bi}>{b}</li>
                ))}
              </ul>
            </div>

            {current.notes && (
              <div
                style={{
                  marginTop: 16,
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'var(--bg-subtle)',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}
              >
                <strong>{isZh ? '演讲者备注：' : 'Speaker Notes: '}</strong>
                {current.notes}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
            {isZh ? '未解析到幻灯片内容' : 'No slide content parsed'}
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {slides.map((s, idx) => (
            <button
              key={s.index}
              className={`arc-btn ${idx === slideIdx ? 'arc-btn-primary' : ''}`}
              style={{ height: 26, fontSize: 11.5 }}
              onClick={() => setSlideIdx(idx)}
            >
              P{s.index} · {s.title.slice(0, 10)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (preview.kind === 'xlsx') {
    const sheets = preview.sheets;
    const current = sheets[sheetIdx] ?? sheets[0];

    const copyCsv = () => {
      if (!current) return;
      const csv = current.rows
        .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
        .join('\n');
      navigator.clipboard?.writeText(csv).catch(() => {});
      setCopiedCsv(true);
      setTimeout(() => setCopiedCsv(false), 1500);
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
            <Table2 size={15} color="var(--accent)" />
            <span>{isZh ? `电子表格预览 (${sheets.length} 个工作表)` : `Spreadsheet Preview (${sheets.length} sheet(s))`}</span>
          </span>
          <button className="arc-btn" style={{ height: 26, fontSize: 11.5 }} onClick={copyCsv}>
            {copiedCsv ? <Check size={12} /> : <Copy size={12} />}
            <span>{copiedCsv ? (isZh ? '已复制 CSV' : 'Copied CSV') : isZh ? '复制当前表 CSV' : 'Copy CSV'}</span>
          </button>
        </div>

        <div className="arc-segmented" style={{ alignSelf: 'flex-start' }}>
          {sheets.map((sh, idx) => (
            <button
              key={sh.name}
              className={idx === sheetIdx ? 'active' : ''}
              onClick={() => setSheetIdx(idx)}
            >
              {sh.name}
            </button>
          ))}
        </div>

        {current && current.rows.length > 0 ? (
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr>
                  <th style={{ width: 34, textAlign: 'center', color: 'var(--text-muted)' }}>#</th>
                  {current.rows[0].map((cell, ci) => (
                    <th key={ci}>{cell}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {current.rows.slice(1).map((row, ri) => (
                  <tr key={ri}>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{ri + 1}</td>
                    {row.map((cell, ci) => (
                      <td key={ci}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
            {isZh ? '当前工作表暂无数据' : 'No data in current sheet'}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>
          <FileText size={15} color="var(--accent)" />
          <span>{isZh ? 'PDF 文档内嵌预览' : 'Embedded PDF Preview'}</span>
        </span>
        <span className="arc-badge">{(preview.sizeBytes / 1024).toFixed(1)} KB</span>
      </div>
      <iframe
        title={title}
        src={preview.dataUrl}
        style={{
          width: '100%',
          minHeight: 460,
          flex: 1,
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          background: '#ffffff',
        }}
      />
    </div>
  );
};
