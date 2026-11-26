import React, { useState } from 'react';

interface ArcSliderProps {
  value: number;
  min: number;
  max: number;
  step: number;
  formatValue?: (val: number) => string;
  onChange: (val: number) => void;
  ariaLabel?: string;
}

export const ArcSlider: React.FC<ArcSliderProps> = ({
  value,
  min,
  max,
  step,
  formatValue = (v) => String(v),
  onChange,
  ariaLabel,
}) => {
  const [engaged, setEngaged] = useState(false);
  const ratio = max > min ? (value - min) / (max - min) : 0;
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const sliderClasses = [
    'arc-slider',
    engaged ? 'is-engaged' : '',
    pct >= 97 ? 'is-near-max' : '',
    pct <= 12 ? 'tooltip-left' : pct >= 88 ? 'tooltip-right' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={sliderClasses}
      style={{ '--slider-pct': `${pct}%` } as React.CSSProperties}
      onMouseEnter={() => setEngaged(true)}
      onMouseLeave={() => setEngaged(false)}
    >
      <div className="arc-slider-track-wrap" aria-hidden="true">
        <div className="arc-slider-active" />
        <div className="arc-slider-inactive">
          <span className="arc-slider-stop-dot" />
        </div>
        <div className="arc-slider-thumb">
          <span className="arc-slider-tooltip">{formatValue(value)}</span>
        </div>
      </div>

      <input
        className="arc-slider-native"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={ariaLabel}
        onFocus={() => setEngaged(true)}
        onBlur={() => setEngaged(false)}
        onPointerDown={() => setEngaged(true)}
        onPointerUp={() => setEngaged(false)}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
};
