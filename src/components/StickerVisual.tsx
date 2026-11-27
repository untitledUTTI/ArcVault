import React from 'react';
import {
  isStripImageSticker,
  resolveStickerFontStack,
  resolveStickerImageUrl,
  type RevisionStickerDef,
  type StickerTextStyle,
} from '../core/revisionStickers';

interface StickerOverlayTextProps {
  style: StickerTextStyle;
  fallbackText?: string;
  maxLines?: number;
  scale?: number;
}

export const StickerOverlayText: React.FC<StickerOverlayTextProps> = ({
  style,
  fallbackText = '',
  maxLines = 2,
  scale = 1,
}) => {
  const displayText = style.text.trim() ? style.text : fallbackText.trim();
  if (!displayText) return null;

  const fontStack = resolveStickerFontStack(style);
  const fontSize = Math.max(8, Math.round(style.fontSize * scale * 10) / 10);
  const letterSpacing = `${Math.round(style.letterSpacing * scale * 10) / 10}px`;

  const shadowCss =
    style.shadow === 'soft'
      ? '0 1px 3px rgba(0, 0, 0, 0.38)'
      : style.shadow === 'retro'
        ? '1.5px 1.5px 0 rgba(0, 0, 0, 0.35)'
        : 'none';

  const sharedTypography: React.CSSProperties = {
    fontFamily: fontStack,
    fontSize,
    fontWeight: style.bold ? 700 : 500,
    fontStyle: style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    letterSpacing,
    lineHeight: 1.25,
    textAlign: 'center',
    wordBreak: 'break-word',
    display: '-webkit-box',
    WebkitLineClamp: maxLines,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  };

  return (
    <span className="arc-sticker-text-wrap">
      {style.strokeEnabled && style.strokeWidth > 0 && (
        <span
          aria-hidden="true"
          className="arc-sticker-text-stroke"
          style={{
            ...sharedTypography,
            color: style.strokeColor,
            WebkitTextStroke: `${Math.max(0.5, style.strokeWidth * 2 * scale)}px ${style.strokeColor}`,
            paintOrder: 'stroke fill',
            textShadow: shadowCss !== 'none' ? shadowCss : undefined,
          }}
        >
          {displayText}
        </span>
      )}
      <span
        className="arc-sticker-text-fill"
        style={{
          ...sharedTypography,
          color: style.color,
          textShadow: !style.strokeEnabled && shadowCss !== 'none' ? shadowCss : undefined,
        }}
      >
        {displayText}
      </span>
    </span>
  );
};

interface StickerVisualProps {
  sticker: RevisionStickerDef;
  textStyle?: StickerTextStyle;
  fallbackText?: string;
  mode: 'tile' | 'board' | 'preview';
  isZh: boolean;
}

export const StickerVisual: React.FC<StickerVisualProps> = ({
  sticker,
  textStyle,
  fallbackText = '',
  mode,
  isZh,
}) => {
  const imgUrl = resolveStickerImageUrl(sticker);
  const label = isZh ? sticker.label : sticker.labelEn || sticker.label;

  if (isStripImageSticker(sticker) && imgUrl) {
    const [top, right, bottom, left] = sticker.textInset ?? [16, 14, 16, 14];
    const effectiveStyle = textStyle ?? sticker.defaultTextStyle;
    const scale = mode === 'tile' ? 0.78 : mode === 'preview' ? 1.1 : 1;
    const maxLines = mode === 'tile' ? 1 : 2;
    const showOverlay = mode !== 'tile' || Boolean(effectiveStyle?.text?.trim());

    return (
      <div className={`arc-journal-sticker-visual is-${mode}`}>
        <img
          src={imgUrl}
          alt={label}
          draggable={false}
          className="arc-journal-sticker-img"
        />
        {showOverlay && effectiveStyle && (
          <div
            className="arc-journal-sticker-overlay"
            style={{
              inset: `${top}% ${right}% ${bottom}% ${left}%`,
            }}
          >
            <StickerOverlayText
              style={effectiveStyle}
              fallbackText={mode === 'board' ? fallbackText : ''}
              maxLines={maxLines}
              scale={scale}
            />
          </div>
        )}
      </div>
    );
  }

  // Fallback / Basic emoji sticker preview
  const effectiveStyle = textStyle ?? sticker.defaultTextStyle;
  return (
    <div
      className={`arc-basic-sticker-preview is-${mode}`}
      style={{ borderColor: sticker.color }}
    >
      <span
        className="arc-basic-sticker-tape"
        style={{ backgroundColor: sticker.color }}
        aria-hidden="true"
      />
      <span className="arc-basic-sticker-emoji">{sticker.emoji ?? '🏷️'}</span>
      <div className="arc-basic-sticker-text">
        {effectiveStyle && (effectiveStyle.text.trim() || fallbackText.trim()) ? (
          <StickerOverlayText
            style={effectiveStyle}
            fallbackText={fallbackText}
            maxLines={2}
            scale={mode === 'preview' ? 1.05 : 0.95}
          />
        ) : (
          <span>{label}</span>
        )}
      </div>
    </div>
  );
};
