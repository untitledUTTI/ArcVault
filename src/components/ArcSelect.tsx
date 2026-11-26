import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface ArcSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface ArcSelectProps {
  value: string;
  options: ArcSelectOption[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export const ArcSelect: React.FC<ArcSelectProps> = ({
  value,
  options,
  onChange,
  ariaLabel,
}) => {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; dropUp: boolean }>({
    top: 0,
    left: 0,
    width: 220,
    dropUp: false,
  });

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? options[0];

  const updateCoords = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const estHeight = Math.min(260, options.length * 36 + 16);
    const dropUp = spaceBelow < estHeight && rect.top > estHeight;
    const width = Math.min(rect.width, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    setCoords({
      top: dropUp ? rect.top - 6 : rect.bottom + 6,
      left,
      width,
      dropUp,
    });
  };

  useEffect(() => {
    if (!open) return;
    updateCoords();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
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
    const onScrollOrResize = () => updateCoords();
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length]);

  const menuEl = (
    <div
      ref={menuRef}
      className={`arc-select-menu ${open ? 'is-open' : ''} ${coords.dropUp ? 'drop-up' : ''}`}
      style={{
        position: 'fixed',
        top: coords.top,
        left: coords.left,
        width: coords.width,
        transform: coords.dropUp
          ? open
            ? 'translateY(-100%) scale(1)'
            : 'translateY(calc(-100% + 8px)) scale(0.96)'
          : undefined,
      }}
      role="listbox"
    >
      {options.map((opt) => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isActive}
            className={`arc-select-option ${isActive ? 'active' : ''}`}
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {opt.label}
            </span>
            {isActive && <Check size={14} style={{ flexShrink: 0 }} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        className={`arc-select-trigger ${open ? 'is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span style={{ minWidth: 0, flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected?.label ?? value}
        </span>
        <ChevronDown size={14} style={{ flexShrink: 0 }} className={`arc-chevron-rot ${open ? 'is-open' : ''}`} />
      </button>
      {typeof document !== 'undefined' && createPortal(menuEl, document.body)}
    </>
  );
};
