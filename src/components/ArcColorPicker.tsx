import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pipette } from 'lucide-react';

interface ArcColorPickerProps {
  value: string;
  presets: string[];
  onChange: (hex: string) => void;
  ariaLabel?: string;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex.trim());
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return { h: 220, s: 0.85, v: 0.92 };
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const s = max === 0 ? 0 : d / max;
  const v = max;
  return { h, s, v };
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;

  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  const toHex = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const ArcColorPicker: React.FC<ArcColorPickerProps> = ({
  value,
  presets,
  onChange,
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexDraft, setHexDraft] = useState(value);
  const [coords, setCoords] = useState<{ top: number; left: number; dropUp: boolean }>({
    top: 0,
    left: 0,
    dropUp: false,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const svPadRef = useRef<HTMLDivElement>(null);
  const hueBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setHexDraft(value);
    if (isValidHex(value)) {
      const next = hexToHsv(value);
      // Avoid jumping hue when saturation/value is 0
      setHsv((prev) => ({
        h: next.s === 0 ? prev.h : next.h,
        s: next.s,
        v: next.v,
      }));
    }
  }, [value]);

  const updateCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const popW = 246;
    const popH = 266;
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropUp = spaceBelow < popH + 16 && rect.top > popH + 16;
    const left = Math.min(window.innerWidth - popW - 12, Math.max(12, rect.left));
    setCoords({
      top: dropUp ? rect.top - 8 : rect.bottom + 8,
      left,
      dropUp,
    });
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', updateCoords);
    window.addEventListener('scroll', updateCoords, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [open]);

  const updateSvFromPointer = (clientX: number, clientY: number) => {
    const pad = svPadRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const s = clamp((clientX - rect.left) / rect.width, 0, 1);
    const v = clamp(1 - (clientY - rect.top) / rect.height, 0, 1);
    const nextHsv = { ...hsv, s, v };
    setHsv(nextHsv);
    const hex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v);
    setHexDraft(hex);
    onChange(hex);
  };

  const updateHueFromPointer = (clientX: number) => {
    const bar = hueBarRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    const h = Math.round(ratio * 359);
    const nextHsv = { ...hsv, h };
    setHsv(nextHsv);
    const hex = hsvToHex(nextHsv.h, nextHsv.s, nextHsv.v);
    setHexDraft(hex);
    onChange(hex);
  };

  const startDrag = (onDrag: (x: number, y: number) => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    onDrag(e.clientX, e.clientY);
    const onMove = (me: PointerEvent) => onDrag(me.clientX, me.clientY);
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const hueColor = hsvToHex(hsv.h, 1, 1);

  const popoverEl = (
    <div
      ref={popoverRef}
      className={`arc-color-popover ${open ? 'is-open' : ''} ${coords.dropUp ? 'drop-up' : ''}`}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        transform: coords.dropUp
          ? open
            ? 'translateY(-100%) scale(1)'
            : 'translateY(calc(-100% + 8px)) scale(0.95)'
          : undefined,
      }}
      role="dialog"
      aria-label={ariaLabel ?? 'Color Picker'}
    >
      {/* 2D Saturation x Value Pad */}
      <div
        ref={svPadRef}
        className="arc-color-sv"
        style={{ backgroundColor: hueColor }}
        onPointerDown={startDrag(updateSvFromPointer)}
      >
        <div
          className="arc-color-sv-handle"
          style={{
            left: `${hsv.s * 100}%`,
            top: `${(1 - hsv.v) * 100}%`,
            backgroundColor: value,
          }}
        />
      </div>

      {/* Hue Bar */}
      <div
        ref={hueBarRef}
        className="arc-color-hue"
        onPointerDown={startDrag((x) => updateHueFromPointer(x))}
      >
        <div
          className="arc-color-hue-handle"
          style={{
            left: `${(hsv.h / 359) * 100}%`,
            backgroundColor: hueColor,
          }}
        />
      </div>

      {/* Presets + Hex Input */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              className="arc-color-dot"
              style={{
                background: c,
                outline: c.toLowerCase() === value.toLowerCase() ? '2px solid var(--accent)' : 'none',
                outlineOffset: 1,
              }}
              onClick={() => {
                setHexDraft(c);
                onChange(c);
              }}
              title={c}
            />
          ))}
        </div>

        <input
          className="arc-input"
          value={hexDraft}
          onChange={(e) => {
            const next = e.target.value;
            setHexDraft(next);
            if (isValidHex(next)) onChange(next.toLowerCase());
          }}
          maxLength={7}
          style={{ width: 84, height: 28, fontSize: 12, fontFamily: 'var(--arc-font-mono)' }}
          aria-label="HEX Color"
        />
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`arc-color-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="arc-color-trigger-swatch" style={{ background: value }} />
        <code style={{ fontSize: 11.5 }}>{value}</code>
        <Pipette size={12} style={{ opacity: 0.65 }} />
      </button>
      {typeof document !== 'undefined' && createPortal(popoverEl, document.body)}
    </>
  );
};
