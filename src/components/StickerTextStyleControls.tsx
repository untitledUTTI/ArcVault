import React from 'react';
import { Bold, Italic, Underline } from 'lucide-react';
import { ArcColorPicker } from './ArcColorPicker';
import {
  STICKER_FONT_PRESETS,
  STICKER_STROKE_COLOR_PRESETS,
  STICKER_TEXT_COLOR_PRESETS,
  type StickerTextShadow,
  type StickerTextStyle,
} from '../core/revisionStickers';

interface StickerTextStyleControlsProps {
  value: StickerTextStyle;
  onChange: (next: StickerTextStyle) => void;
  isZh: boolean;
  surface?: 'dark' | 'theme';
  draftFallbackText?: string;
  compact?: boolean;
  onColorTouched?: () => void;
}

export const StickerTextStyleControls: React.FC<StickerTextStyleControlsProps> = ({
  value,
  onChange,
  isZh,
  surface = 'dark',
  draftFallbackText,
  compact = false,
  onColorTouched,
}) => {
  const isTheme = surface === 'theme';
  const clsSuffix = isTheme ? ' is-theme' : '';

  const update = (patch: Partial<StickerTextStyle>) => {
    onChange({ ...value, ...patch });
  };

  const shadows: Array<{ id: StickerTextShadow; zh: string; en: string }> = [
    { id: 'none', zh: '无', en: 'None' },
    { id: 'soft', zh: '柔影', en: 'Soft' },
    { id: 'retro', zh: '复古', en: 'Retro' },
  ];

  return (
    <div className={`arc-sticker-style-panel${clsSuffix}${compact ? ' is-compact' : ''}`}>
      {/* 1. Overlay Text */}
      <div className="arc-sticker-style-row">
        <div className="arc-sticker-style-head">
          <span>{isZh ? '叠加文字' : 'Overlay Text'}</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {draftFallbackText && draftFallbackText.trim() && (
              <button
                type="button"
                className={`arc-sticker-chip${clsSuffix}`}
                onClick={() => update({ text: draftFallbackText.trim().slice(0, 36) })}
              >
                {isZh ? '填入草稿' : 'Use Draft'}
              </button>
            )}
            {value.text && (
              <button
                type="button"
                className={`arc-sticker-chip${clsSuffix}`}
                onClick={() => update({ text: '' })}
              >
                {isZh ? '清空' : 'Clear'}
              </button>
            )}
          </div>
        </div>
        <input
          type="text"
          className="arc-input"
          style={{ height: 30, fontSize: 12.5, width: '100%' }}
          placeholder={isZh ? '输入贴纸上的手帐文字（支持中英文）...' : 'Type sticker text overlay...'}
          value={value.text}
          maxLength={60}
          onChange={(e) => update({ text: e.target.value })}
        />
      </div>

      {/* 2. Font Presets + Custom Font */}
      <div className="arc-sticker-style-row">
        <div className="arc-sticker-style-head">
          <span>{isZh ? '字体' : 'Font'}</span>
        </div>
        <div className="arc-sticker-font-grid">
          {STICKER_FONT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`arc-sticker-chip${clsSuffix} ${value.fontFamily === preset.id ? 'is-active' : ''}`}
              style={{ fontFamily: preset.id === 'custom' ? undefined : preset.stack }}
              onClick={() => update({ fontFamily: preset.id })}
            >
              {isZh ? preset.label : preset.labelEn}
            </button>
          ))}
        </div>
        {value.fontFamily === 'custom' && (
          <input
            type="text"
            className="arc-input"
            style={{ height: 28, fontSize: 12, width: '100%', marginTop: 4 }}
            placeholder={isZh ? '输入系统字体名，如 霞鹜文楷 / Georgia / PingFang SC' : 'System font name, e.g. Georgia, PingFang SC'}
            value={value.customFontName ?? ''}
            onChange={(e) => update({ customFontName: e.target.value })}
          />
        )}
      </div>

      {/* 3. Text Styles: B/I/U + Shadow + Size + Spacing */}
      <div className="arc-sticker-style-row">
        <div className="arc-sticker-style-head">
          <span>{isZh ? '文字样式' : 'Text Style'}</span>
          <span className="arc-sticker-style-meta">
            {value.fontSize}px · {isZh ? '字距' : 'Spacing'} {value.letterSpacing}px
          </span>
        </div>

        <div className="arc-sticker-style-inline">
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className={`arc-sticker-chip${clsSuffix} ${value.bold ? 'is-active' : ''}`}
              onClick={() => update({ bold: !value.bold })}
              title={isZh ? '加粗' : 'Bold'}
              aria-label="Bold"
            >
              <Bold size={12} />
            </button>
            <button
              type="button"
              className={`arc-sticker-chip${clsSuffix} ${value.italic ? 'is-active' : ''}`}
              onClick={() => update({ italic: !value.italic })}
              title={isZh ? '斜体' : 'Italic'}
              aria-label="Italic"
            >
              <Italic size={12} />
            </button>
            <button
              type="button"
              className={`arc-sticker-chip${clsSuffix} ${value.underline ? 'is-active' : ''}`}
              onClick={() => update({ underline: !value.underline })}
              title={isZh ? '下划线' : 'Underline'}
              aria-label="Underline"
            >
              <Underline size={12} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{isZh ? '阴影' : 'Shadow'}</span>
            {shadows.map((sh) => (
              <button
                key={sh.id}
                type="button"
                className={`arc-sticker-chip${clsSuffix} ${value.shadow === sh.id ? 'is-active' : ''}`}
                onClick={() => update({ shadow: sh.id })}
              >
                {isZh ? sh.zh : sh.en}
              </button>
            ))}
          </div>
        </div>

        <div className="arc-sticker-sliders-grid">
          <label className="arc-sticker-slider-item">
            <span>{isZh ? '字号' : 'Size'}</span>
            <input
              type="range"
              min={9}
              max={20}
              step={0.5}
              value={value.fontSize}
              onChange={(e) => update({ fontSize: Number(e.target.value) })}
            />
          </label>
          <label className="arc-sticker-slider-item">
            <span>{isZh ? '字距' : 'Spacing'}</span>
            <input
              type="range"
              min={0}
              max={4}
              step={0.5}
              value={value.letterSpacing}
              onChange={(e) => update({ letterSpacing: Number(e.target.value) })}
            />
          </label>
        </div>
      </div>

      {/* 4. Text Color */}
      <div className="arc-sticker-style-row">
        <div className="arc-sticker-style-head">
          <span>{isZh ? '文字颜色' : 'Text Color'}</span>
        </div>
        <div className="arc-sticker-color-row">
          <div className="arc-sticker-swatch-list">
            {STICKER_TEXT_COLOR_PRESETS.map((hex) => (
              <button
                key={hex}
                type="button"
                className={`arc-sticker-swatch ${value.color.toLowerCase() === hex.toLowerCase() ? 'is-active' : ''}`}
                style={{ backgroundColor: hex }}
                title={hex}
                onClick={() => {
                  onColorTouched?.();
                  update({ color: hex });
                }}
              />
            ))}
          </div>
          <ArcColorPicker
            value={value.color}
            presets={STICKER_TEXT_COLOR_PRESETS}
            onChange={(hex) => {
              onColorTouched?.();
              update({ color: hex });
            }}
            ariaLabel={isZh ? '自定义文字颜色' : 'Custom Text Color'}
          />
        </div>
      </div>

      {/* 5. Text Stroke */}
      <div className="arc-sticker-style-row">
        <div className="arc-sticker-style-head">
          <span>{isZh ? '文字描边' : 'Text Stroke'}</span>
          <button
            type="button"
            className={`arc-sticker-chip${clsSuffix} ${value.strokeEnabled ? 'is-active' : ''}`}
            onClick={() => update({ strokeEnabled: !value.strokeEnabled })}
          >
            {value.strokeEnabled
              ? isZh
                ? '已开启描边'
                : 'Stroke On'
              : isZh
                ? '开启描边'
                : 'Enable Stroke'}
          </button>
        </div>

        {value.strokeEnabled && (
          <>
            <div className="arc-sticker-color-row">
              <div className="arc-sticker-swatch-list">
                {STICKER_STROKE_COLOR_PRESETS.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    className={`arc-sticker-swatch ${value.strokeColor.toLowerCase() === hex.toLowerCase() ? 'is-active' : ''}`}
                    style={{ backgroundColor: hex }}
                    title={hex}
                    onClick={() => {
                      onColorTouched?.();
                      update({ strokeColor: hex });
                    }}
                  />
                ))}
              </div>
              <ArcColorPicker
                value={value.strokeColor}
                presets={STICKER_STROKE_COLOR_PRESETS}
                onChange={(hex) => {
                  onColorTouched?.();
                  update({ strokeColor: hex });
                }}
                ariaLabel={isZh ? '自定义描边颜色' : 'Custom Stroke Color'}
              />
            </div>
            <label className="arc-sticker-slider-item">
              <span>
                {isZh ? '描边粗细' : 'Stroke Width'} ({value.strokeWidth}px)
              </span>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={value.strokeWidth}
                onChange={(e) => update({ strokeWidth: Number(e.target.value) })}
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
};
