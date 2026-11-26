import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  FilePlus2,
  ImagePlus,
  RotateCw,
  Upload,
  X,
} from 'lucide-react';
import {
  SCAN_FILTER_META,
  renderEnhancedScanCanvas,
  type ScanFilterMode,
} from '../core/mobileScan';
import type { HapticPattern, Space } from '../types/archive';
import { ArcSlider } from './ArcSlider';
import { ArcSelect } from './ArcSelect';

interface CameraScanModalProps {
  isZh?: boolean;
  spaces: Space[];
  defaultSpaceId: string;
  hasActiveDoc: boolean;
  onCreateScannedDoc: (params: {
    title: string;
    spaceId: string;
    dataUrl: string;
  }) => void;
  onAttachToActiveDoc: (params: { title: string; dataUrl: string }) => void;
  onHaptic: (pattern: HapticPattern) => void;
  onClose: () => void;
}

export const CameraScanModal: React.FC<CameraScanModalProps> = ({
  isZh = true,
  spaces,
  defaultSpaceId,
  hasActiveDoc,
  onCreateScannedDoc,
  onAttachToActiveDoc,
  onHaptic,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [enhancedUrl, setEnhancedUrl] = useState<string>('');
  const [title, setTitle] = useState(
    `${isZh ? '扫描档案_' : 'Scan_'}${new Date().toISOString().slice(0, 10)}`,
  );
  const [targetSpaceId, setTargetSpaceId] = useState(defaultSpaceId);
  const [mode, setMode] = useState<ScanFilterMode>('document-crisp');
  const [rotationDeg, setRotationDeg] = useState(0);
  const [contrast, setContrast] = useState(1.35);
  const [brightness, setBrightness] = useState(14);

  useEffect(() => {
    if (!sourceUrl) return;
    const img = new Image();
    img.onload = () => {
      loadedImageRef.current = img;
      if (canvasRef.current) {
        const out = renderEnhancedScanCanvas(img, canvasRef.current, {
          mode,
          rotationDeg,
          contrast,
          brightness,
        });
        setEnhancedUrl(out);
      }
    };
    img.src = sourceUrl;
  }, [sourceUrl, mode, rotationDeg, contrast, brightness]);

  const handleLoadSamplePage = () => {
    // Generate a realistic sample paper page bitmap for instant preview/testing on desktop & mobile
    const tmp = document.createElement('canvas');
    tmp.width = 720;
    tmp.height = 960;
    const ctx = tmp.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#ddd6c7';
      ctx.fillRect(0, 0, tmp.width, tmp.height);
      ctx.fillStyle = '#ebe5d7';
      ctx.fillRect(36, 42, 648, 876);
      ctx.fillStyle = '#262626';
      ctx.font = 'bold 28px serif';
      ctx.fillText('ArcVault Field Scan Sample', 72, 110);
      ctx.font = '18px serif';
      ctx.fillText('1. Experimental Setup & Boundary Conditions', 72, 175);
      ctx.font = '15px sans-serif';
      const lines = [
        'Measured peak latency dropped from 41.2 ms to 12.8 ms under',
        'the adaptive WebGL2/CPU power budget across mobile devices.',
        'All scanned pages are archived with SHA-256 integrity hashes',
        'and encrypted locally prior to cross-device E2EE sync.',
      ];
      lines.forEach((line, idx) => ctx.fillText(line, 72, 225 + idx * 34));
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 2;
      ctx.strokeRect(72, 400, 576, 220);
      ctx.beginPath();
      ctx.moveTo(96, 580);
      ctx.lineTo(220, 510);
      ctx.lineTo(360, 535);
      ctx.lineTo(540, 440);
      ctx.stroke();
    }
    onHaptic('light');
    setSourceUrl(tmp.toDataURL('image/png'));
  };

  const handlePickFile = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onHaptic('light');
        setSourceUrl(reader.result);
        setTitle(file.name.replace(/\.[^.]+$/, '') || (isZh ? '纸质文档扫描件' : 'Scanned Document'));
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="arc-modal-backdrop" onClick={onClose}>
      <div
        className="arc-modal"
        style={{ width: 'min(760px, 95vw)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="arc-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Camera size={17} color="var(--accent)" />
            <strong>{isZh ? '拍照扫描入库 · 文档滤镜增强' : 'Camera Scan · Document Enhancement'}</strong>
          </div>
          <button type="button" className="arc-btn arc-icon-btn" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="arc-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => {
              handlePickFile(e.target.files);
              e.target.value = '';
            }}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="arc-btn arc-btn-primary"
              onClick={() => {
                onHaptic('light');
                fileInputRef.current?.click();
              }}
            >
              <Camera size={14} />
              <span>{isZh ? '调用相机拍照 / 选图' : 'Take Photo / Choose Image'}</span>
            </button>
            <button
              type="button"
              className="arc-btn"
              onClick={handleLoadSamplePage}
            >
              <Upload size={14} />
              <span>{isZh ? '载入示例纸质页（演练）' : 'Load Sample Page (Demo)'}</span>
            </button>
            {sourceUrl && (
              <button
                type="button"
                className="arc-btn"
                onClick={() => {
                  onHaptic('selection');
                  setRotationDeg((r) => (r + 90) % 360);
                }}
              >
                <RotateCw size={14} />
                <span>{isZh ? '旋转 90°' : 'Rotate 90°'}</span>
              </button>
            )}
          </div>

          <div
            style={{
              minHeight: 220,
              maxHeight: '42vh',
              borderRadius: 12,
              border: '1px dashed var(--border-strong)',
              background: 'var(--bg-app)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              padding: 8,
            }}
          >
            {sourceUrl ? (
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: '100%',
                  maxHeight: '38vh',
                  borderRadius: 8,
                  boxShadow: 'var(--shadow-sm)',
                }}
              />
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, padding: 18 }}>
                {isZh
                  ? '点击上方「调用相机拍照 / 选图」拍摄纸质合同、实验记录或文献页；也可先点击「载入示例纸质页」体验增强滤镜。'
                  : 'Click "Take Photo / Choose Image" to scan contracts, lab notes, or papers, or load the sample page to preview filters.'}
              </div>
            )}
          </div>

          {/* Filter Mode Selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {SCAN_FILTER_META.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`arc-btn ${mode === item.id ? 'arc-btn-primary' : ''}`}
                style={{ fontSize: 12 }}
                title={item.desc}
                onClick={() => {
                  onHaptic('selection');
                  setMode(item.id);
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>{isZh ? '对比度增强' : 'Contrast'}</span>
                <span style={{ color: 'var(--text-muted)' }}>{contrast.toFixed(2)}×</span>
              </div>
              <ArcSlider
                ariaLabel={isZh ? '对比度增强' : 'Contrast'}
                value={contrast}
                min={0.6}
                max={2.2}
                step={0.05}
                formatValue={(v) => `${v.toFixed(2)}×`}
                onChange={setContrast}
              />
            </div>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                <span>{isZh ? '纸面提亮' : 'Brightness'}</span>
                <span style={{ color: 'var(--text-muted)' }}>{brightness > 0 ? `+${brightness}` : brightness}</span>
              </div>
              <ArcSlider
                ariaLabel={isZh ? '纸面提亮' : 'Brightness'}
                value={brightness}
                min={-40}
                max={55}
                step={2}
                formatValue={(v) => `${v > 0 ? '+' : ''}${v}`}
                onChange={setBrightness}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <input
              className="arc-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isZh ? '扫描档案标题...' : 'Scan title...'}
            />
            <ArcSelect
              value={targetSpaceId}
              options={spaces.map((sp) => ({
                value: sp.id,
                label: isZh ? `${sp.nameZh} (${sp.nameEn})` : sp.nameEn,
              }))}
              onChange={setTargetSpaceId}
            />
          </div>
        </div>

        <div className="arc-modal-footer" style={{ flexWrap: 'wrap' }}>
          {hasActiveDoc && (
            <button
              type="button"
              className="arc-btn"
              disabled={!enhancedUrl}
              onClick={() => {
                if (!enhancedUrl) return;
                onHaptic('success');
                onAttachToActiveDoc({ title: title.trim() || (isZh ? '扫描配图' : 'Scanned Figure'), dataUrl: enhancedUrl });
                onClose();
              }}
            >
              <ImagePlus size={14} />
              <span>{isZh ? '插为当前文档配图' : 'Insert as Figure'}</span>
            </button>
          )}
          <button
            type="button"
            className="arc-btn arc-btn-primary"
            disabled={!enhancedUrl}
            onClick={() => {
              if (!enhancedUrl) return;
              onHaptic('success');
              onCreateScannedDoc({
                title: title.trim() || (isZh ? '纸质文档扫描件' : 'Scanned Document'),
                spaceId: targetSpaceId,
                dataUrl: enhancedUrl,
              });
              onClose();
            }}
          >
            <FilePlus2 size={14} />
            <span>{isZh ? '新建扫描档案入库' : 'Save as New Document'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
