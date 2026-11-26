export type ScanFilterMode =
  | 'original'
  | 'document-crisp'
  | 'bw-scan'
  | 'warm-paper';

export const SCAN_FILTER_META: Array<{
  id: ScanFilterMode;
  label: string;
  desc: string;
}> = [
  { id: 'document-crisp', label: '清晰文档', desc: '提亮纸面底色、锐化文字对比度' },
  { id: 'bw-scan', label: '黑白扫描', desc: '高对比二值化，适合打印与 OCR' },
  { id: 'warm-paper', label: '护眼纸感', desc: '保留柔和纸纹，适合长文批注留档' },
  { id: 'original', label: '原图直出', desc: '保留原始拍摄色彩' },
];

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

/**
 * Pure deterministic pixel enhancer for scanned document photos.
 * Contrast: 0.5..2.2 (default 1.35), Brightness: -60..60 (default 14).
 */
export function enhanceDocumentPixels(
  data: Uint8ClampedArray,
  mode: ScanFilterMode,
  contrast = 1.35,
  brightness = 14,
): void {
  if (mode === 'original' && Math.abs(contrast - 1) < 0.01 && brightness === 0) {
    return;
  }

  const cFactor = Math.max(0.4, Math.min(2.6, contrast));
  for (let i = 0; i < data.length; i += 4) {
    const r0 = data[i];
    const g0 = data[i + 1];
    const b0 = data[i + 2];

    if (mode === 'original') {
      data[i] = clamp255((r0 - 128) * cFactor + 128 + brightness);
      data[i + 1] = clamp255((g0 - 128) * cFactor + 128 + brightness);
      data[i + 2] = clamp255((b0 - 128) * cFactor + 128 + brightness);
      continue;
    }

    const lum = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;

    if (mode === 'bw-scan') {
      const stretched = (lum - 128) * (cFactor * 1.45) + 128 + brightness;
      const bw = stretched > 142 ? 252 : stretched < 92 ? 18 : clamp255(stretched);
      data[i] = bw;
      data[i + 1] = bw;
      data[i + 2] = bw;
      continue;
    }

    if (mode === 'warm-paper') {
      const r = (r0 - 128) * cFactor + 132 + brightness;
      const g = (g0 - 128) * cFactor + 128 + brightness;
      const b = (b0 - 128) * cFactor + 114 + brightness;
      data[i] = clamp255(r);
      data[i + 1] = clamp255(g);
      data[i + 2] = clamp255(b);
      continue;
    }

    // 'document-crisp': whiten near-white background & sharpen ink
    const bgBoost = lum > 165 ? (lum - 165) * 0.45 : 0;
    data[i] = clamp255((r0 - 128) * cFactor + 128 + brightness + bgBoost);
    data[i + 1] = clamp255((g0 - 128) * cFactor + 128 + brightness + bgBoost);
    data[i + 2] = clamp255((b0 - 128) * cFactor + 128 + brightness + bgBoost);
  }
}

export function renderEnhancedScanCanvas(
  img: HTMLImageElement,
  canvas: HTMLCanvasElement,
  opts: {
    mode: ScanFilterMode;
    rotationDeg: number;
    contrast: number;
    brightness: number;
    maxDimension?: number;
  },
): string {
  const maxDim = opts.maxDimension ?? 1600;
  const scale = Math.min(
    1,
    maxDim / Math.max(1, img.naturalWidth, img.naturalHeight),
  );
  const w0 = Math.max(1, Math.round(img.naturalWidth * scale));
  const h0 = Math.max(1, Math.round(img.naturalHeight * scale));
  const rot = ((opts.rotationDeg % 360) + 360) % 360;
  const swap = rot === 90 || rot === 270;

  canvas.width = swap ? h0 : w0;
  canvas.height = swap ? w0 : h0;

  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rot * Math.PI) / 180);
  ctx.drawImage(img, -w0 / 2, -h0 / 2, w0, h0);
  ctx.restore();

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  enhanceDocumentPixels(
    imgData.data,
    opts.mode,
    opts.contrast,
    opts.brightness,
  );
  ctx.putImageData(imgData, 0, 0);

  return canvas.toDataURL('image/jpeg', 0.9);
}
