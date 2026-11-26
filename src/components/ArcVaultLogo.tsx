import React, { useId } from 'react';
import type { ThemeId } from '../types/archive';

interface ArcVaultLogoProps {
  size?: number;
  theme?: ThemeId;
}

export interface MonetFaviconPalette {
  primary: string;
  primaryContainer: string;
  secondary: string;
  tertiary: string;
}

/**
 * Generates an inline SVG favicon data URI matching the active visual theme.
 */
export function buildThemedFaviconDataUrl(
  theme: ThemeId,
  monet?: MonetFaviconPalette,
): string {
  let svg = '';

  if (theme === 'm3-expressive') {
    const p = monet?.primary ?? '#6750a4';
    const pc = monet?.primaryContainer ?? '#eaddff';
    const s = monet?.secondary ?? '#625b71';
    const t = monet?.tertiary ?? '#7d5260';
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id="g" x1="3" y1="4" x2="33" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${pc}"/>
          <stop offset="100%" stop-color="${p}" stop-opacity="0.28"/>
        </linearGradient>
      </defs>
      <path d="M18 2.2C26.5 2.2 33.8 5.2 33.8 18C33.8 30.8 26.5 33.8 18 33.8C9.5 33.8 2.2 30.8 2.2 18C2.2 5.2 9.5 2.2 18 2.2Z" fill="url(#g)" stroke="${p}" stroke-width="1.6"/>
      <path d="M8.5 24C10.5 15 14 11.2 18 11.2C22 11.2 25.5 15 27.5 24" stroke="${p}" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M12.5 25.2C14 19.6 15.9 17.2 18 17.2C20.1 17.2 22 19.6 23.5 25.2" stroke="${s}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M18 6.4L19.1 9.3L22 10.4L19.1 11.5L18 14.4L16.9 11.5L14 10.4L16.9 9.3Z" fill="${t}"/>
    </svg>`;
  } else if (theme === 'celestial-optics') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id="sky" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#070c24"/>
          <stop offset="56%" stop-color="#1e1b4b"/>
          <stop offset="84%" stop-color="#6d3a7c"/>
          <stop offset="100%" stop-color="#d97a86"/>
        </linearGradient>
        <linearGradient id="arc" x1="6" y1="22" x2="30" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#7dd3fc"/>
          <stop offset="50%" stop-color="#c4b5fd"/>
          <stop offset="100%" stop-color="#f472b6"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="32" height="32" rx="10" fill="url(#sky)" stroke="#7dd3fc" stroke-opacity="0.55" stroke-width="1.4"/>
      <circle cx="18" cy="18.5" r="8.2" stroke="#bae6fd" stroke-opacity="0.45" stroke-width="1.2"/>
      <circle cx="9.8" cy="18.5" r="1.8" fill="#e0f2fe"/>
      <circle cx="26.2" cy="18.5" r="1.8" fill="#fbcfe8"/>
      <path d="M10.5 8.5C13 11.6 15.5 12.6 18 12.6C20.5 12.6 23 11.6 25.5 8.5" stroke="url(#arc)" stroke-width="2" stroke-linecap="round"/>
      <path d="M18 13.5L19.1 17.4L23 18.5L19.1 19.6L18 23.5L16.9 19.6L13 18.5L16.9 17.4Z" fill="#fffbeb"/>
      <circle cx="8" cy="10" r="0.9" fill="#e0f2fe"/>
      <circle cx="28.5" cy="10.5" r="0.9" fill="#fde68a"/>
    </svg>`;
  } else if (theme === 'weather-live') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id="wsky" x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#0b4a8f"/>
          <stop offset="58%" stop-color="#2582d6"/>
          <stop offset="100%" stop-color="#7cc4f5"/>
        </linearGradient>
        <linearGradient id="rb" x1="7" y1="23" x2="29" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fb7185"/>
          <stop offset="35%" stop-color="#fbbf24"/>
          <stop offset="68%" stop-color="#4ade80"/>
          <stop offset="100%" stop-color="#38bdf8"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="32" height="32" rx="10" fill="url(#wsky)" stroke="#bae6fd" stroke-opacity="0.5" stroke-width="1.4"/>
      <circle cx="10.5" cy="10.5" r="4" fill="#fde68a" fill-opacity="0.45"/>
      <circle cx="10.5" cy="10.5" r="2.2" fill="#fffbeb"/>
      <path d="M7.5 23.5C10 15 13.8 11 18 11C22.2 11 26 15 28.5 23.5" stroke="url(#rb)" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M12.5 25.5C11 25.5 10 24.4 10 23C10 21.7 11 20.7 12.2 20.6C12.8 18.8 14.5 17.6 16.5 17.6C18.8 17.6 20.7 19.2 21.1 21.2C22.7 21.3 24 22.5 24 23.9C24 25.3 22.8 25.5 21.5 25.5H12.5Z" fill="#ffffff" fill-opacity="0.94"/>
      <path d="M27.2 23.5C27.2 23.5 29 25.8 29 27C29 28 28.2 28.8 27.2 28.8C26.2 28.8 25.4 28 25.4 27C25.4 25.8 27.2 23.5 27.2 23.5Z" fill="#e0f2fe"/>
    </svg>`;
  } else if (theme === 'paper') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id="pbg" x1="4" y1="3" x2="32" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#fffdf7"/>
          <stop offset="56%" stop-color="#f3e9d2"/>
          <stop offset="100%" stop-color="#e5d6b8"/>
        </linearGradient>
        <linearGradient id="pink" x1="7" y1="24" x2="29" y2="10" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#6e411c"/>
          <stop offset="55%" stop-color="#8c5a2b"/>
          <stop offset="100%" stop-color="#c88b4b"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="32" height="32" rx="9" fill="url(#pbg)" stroke="#b89464" stroke-width="1.5"/>
      <rect x="4.5" y="4.5" width="27" height="27" rx="7" stroke="#d5c3a1" stroke-opacity="0.72" stroke-width="0.9"/>
      <path d="M26 2.3V8.2C26 9.2 26.8 10 27.8 10H33.7" stroke="#c5ab82" stroke-width="1" stroke-linecap="round"/>
      <line x1="8" y1="15.5" x2="28" y2="15.5" stroke="#c5ab82" stroke-opacity="0.38" stroke-width="0.9"/>
      <line x1="8" y1="20.5" x2="28" y2="20.5" stroke="#c5ab82" stroke-opacity="0.38" stroke-width="0.9"/>
      <line x1="8" y1="25.5" x2="28" y2="25.5" stroke="#c5ab82" stroke-opacity="0.38" stroke-width="0.9"/>
      <path d="M7.5 23.5C9.8 15 13.8 10.6 18 10.6C22.2 10.6 26.2 15 28.5 23.5" stroke="url(#pink)" stroke-width="2.5" stroke-linecap="round"/>
      <path d="M11.8 25C13.4 19.3 15.5 16.8 18 16.8C20.5 16.8 22.6 19.3 24.2 25" stroke="#a67240" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2.4 2.4"/>
      <circle cx="18" cy="10.6" r="2.3" fill="#b8432e"/>
      <circle cx="17.3" cy="9.9" r="0.7" fill="#fde6c4" fill-opacity="0.85"/>
    </svg>`;
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" fill="none">
      <defs>
        <linearGradient id="def" x1="4" y1="30" x2="32" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#3b5bdb"/>
          <stop offset="55%" stop-color="#6366f1"/>
          <stop offset="100%" stop-color="#0ea5e9"/>
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="32" height="32" rx="10" fill="url(#def)" fill-opacity="0.16" stroke="url(#def)" stroke-width="1.5"/>
      <path d="M7 23C9.5 14.5 13.5 10.5 18 10.5C22.5 10.5 26.5 14.5 29 23" stroke="url(#def)" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M11.5 24.5C13.2 19 15.4 16.5 18 16.5C20.6 16.5 22.8 19 24.5 24.5" stroke="url(#def)" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="2.5 2.5"/>
      <circle cx="18" cy="10.5" r="2.2" fill="#0ea5e9"/>
    </svg>`;
  }

  return `data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}`;
}

export const ArcVaultLogo: React.FC<ArcVaultLogoProps> = ({ size = 30, theme }) => {
  const uid = useId().replace(/:/g, '');

  if (theme === 'm3-expressive') {
    const bgGradId = `arcM3Bg-${uid}`;
    const archGradId = `arcM3Arch-${uid}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ArcVault M3 Expressive Logo"
      >
        <defs>
          <linearGradient id={bgGradId} x1="4" y1="4" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--m3-primary-container, #eaddff)" />
            <stop offset="100%" stopColor="var(--m3-tertiary-container, #ffd8e4)" />
          </linearGradient>
          <linearGradient id={archGradId} x1="8" y1="24" x2="28" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--m3-primary, #6750a4)" />
            <stop offset="100%" stopColor="var(--m3-tertiary, #7d5260)" />
          </linearGradient>
        </defs>
        {/* M3 Expressive organic pillowed squircle */}
        <path
          d="M18 2.2C26.5 2.2 33.8 5.2 33.8 18C33.8 30.8 26.5 33.8 18 33.8C9.5 33.8 2.2 30.8 2.2 18C2.2 5.2 9.5 2.2 18 2.2Z"
          fill={`url(#${bgGradId})`}
          stroke="var(--m3-primary, #6750a4)"
          strokeOpacity="0.68"
          strokeWidth="1.5"
        />
        {/* Expressive bold rounded dome arch */}
        <path
          d="M8.5 24C10.5 15 14 11.2 18 11.2C22 11.2 25.5 15 27.5 24"
          stroke={`url(#${archGradId})`}
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        {/* Tonal inner vault arch */}
        <path
          d="M12.5 25.2C14 19.6 15.9 17.2 18 17.2C20.1 17.2 22 19.6 23.5 25.2"
          stroke="var(--m3-secondary, #625b71)"
          strokeOpacity="0.88"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        {/* Material 4-point zenith sparkle */}
        <path
          d="M18 6.4L19.1 9.3L22 10.4L19.1 11.5L18 14.4L16.9 11.5L14 10.4L16.9 9.3Z"
          fill="var(--m3-tertiary, #7d5260)"
        />
      </svg>
    );
  }

  if (theme === 'celestial-optics') {
    const skyGradId = `arcCelSky-${uid}`;
    const czaGradId = `arcCelCza-${uid}`;
    const starGlowId = `arcCelStar-${uid}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ArcVault Celestial Optics Logo"
      >
        <defs>
          <linearGradient id={skyGradId} x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#070c24" />
            <stop offset="56%" stopColor="#1e1b4b" />
            <stop offset="84%" stopColor="#6d3a7c" />
            <stop offset="100%" stopColor="#d97a86" />
          </linearGradient>
          <linearGradient id={czaGradId} x1="9" y1="9" x2="27" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.85" />
            <stop offset="50%" stopColor="#c4b5fd" />
            <stop offset="100%" stopColor="#f472b6" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id={starGlowId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="48%" stopColor="#bae6fd" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="32"
          height="32"
          rx="10"
          fill={`url(#${skyGradId})`}
          stroke="#7dd3fc"
          strokeOpacity="0.58"
          strokeWidth="1.4"
        />
        {/* 22-degree Ice Halo ring */}
        <circle cx="18" cy="18.5" r="8.2" stroke="#bae6fd" strokeOpacity="0.46" strokeWidth="1.25" />
        {/* Twin Chromatic Parhelia (Sundogs) */}
        <circle cx="9.8" cy="18.5" r="2.8" fill={`url(#${starGlowId})`} />
        <circle cx="26.2" cy="18.5" r="2.8" fill={`url(#${starGlowId})`} />
        <circle cx="9.8" cy="18.5" r="1.25" fill="#e0f2fe" />
        <circle cx="26.2" cy="18.5" r="1.25" fill="#fbcfe8" />
        {/* Inverted Circumzenithal Arc ("穹") */}
        <path
          d="M10.5 8.5C13 11.6 15.5 12.6 18 12.6C20.5 12.6 23 11.6 25.5 8.5"
          stroke={`url(#${czaGradId})`}
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        {/* Central Solar Diamond-Dust Flare */}
        <circle cx="18" cy="18.5" r="5" fill={`url(#${starGlowId})`} />
        <path
          d="M18 13.5L19.1 17.4L23 18.5L19.1 19.6L18 23.5L16.9 19.6L13 18.5L16.9 17.4Z"
          fill="#fffbeb"
        />
        <circle cx="8" cy="10" r="0.85" fill="#e0f2fe" />
        <circle cx="28.2" cy="10.5" r="0.85" fill="#fde68a" />
      </svg>
    );
  }

  if (theme === 'weather-live') {
    const wSkyId = `arcWthSky-${uid}`;
    const wSunId = `arcWthSun-${uid}`;
    const wRainbowId = `arcWthRainbow-${uid}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ArcVault Real-Time Weather Logo"
      >
        <defs>
          <linearGradient id={wSkyId} x1="18" y1="2" x2="18" y2="34" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0b4a8f" />
            <stop offset="58%" stopColor="#2582d6" />
            <stop offset="100%" stopColor="#7cc4f5" />
          </linearGradient>
          <radialGradient id={wSunId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fffbeb" />
            <stop offset="52%" stopColor="#fde68a" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={wRainbowId} x1="7" y1="23" x2="29" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="34%" stopColor="#fbbf24" />
            <stop offset="68%" stopColor="#4ade80" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
        </defs>
        <rect
          x="2"
          y="2"
          width="32"
          height="32"
          rx="10"
          fill={`url(#${wSkyId})`}
          stroke="#bae6fd"
          strokeOpacity="0.54"
          strokeWidth="1.4"
        />
        {/* Radiant Sun orb */}
        <circle cx="10.5" cy="10.5" r="5.6" fill={`url(#${wSunId})`} />
        <circle cx="10.5" cy="10.5" r="2.2" fill="#fffbeb" />
        {/* Rainbow Dome Arch */}
        <path
          d="M7.5 23.5C10 15 13.8 11 18 11C22.2 11 26 15 28.5 23.5"
          stroke={`url(#${wRainbowId})`}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        {/* Volumetric Cloud Silhouette */}
        <path
          d="M12.5 25.8C11 25.8 9.8 24.6 9.8 23.1C9.8 21.8 10.8 20.7 12.1 20.6C12.7 18.7 14.4 17.5 16.5 17.5C18.8 17.5 20.8 19.1 21.2 21.2C22.8 21.3 24.1 22.5 24.1 24C24.1 25.3 22.9 25.8 21.5 25.8H12.5Z"
          fill="#ffffff"
          fillOpacity="0.95"
        />
        {/* Crisp Raindrop */}
        <path
          d="M27.3 23.2C27.3 23.2 29.2 25.7 29.2 27C29.2 28.1 28.3 28.9 27.3 28.9C26.3 28.9 25.4 28.1 25.4 27C25.4 25.7 27.3 23.2 27.3 23.2Z"
          fill="#e0f2fe"
        />
      </svg>
    );
  }

  if (theme === 'paper') {
    const paperBgId = `arcPaperBg-${uid}`;
    const paperInkId = `arcPaperInk-${uid}`;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ArcVault Eye-Care Paper Logo"
      >
        <defs>
          <linearGradient id={paperBgId} x1="4" y1="3" x2="32" y2="33" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fffdf7" />
            <stop offset="56%" stopColor="#f3e9d2" />
            <stop offset="100%" stopColor="#e5d6b8" />
          </linearGradient>
          <linearGradient id={paperInkId} x1="7" y1="24" x2="29" y2="10" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#6e411c" />
            <stop offset="55%" stopColor="#8c5a2b" />
            <stop offset="100%" stopColor="#c88b4b" />
          </linearGradient>
        </defs>
        {/* Warm parchment rounded plate */}
        <rect
          x="2"
          y="2"
          width="32"
          height="32"
          rx="9"
          fill={`url(#${paperBgId})`}
          stroke="#b89464"
          strokeWidth="1.5"
        />
        {/* Subtle inner letterpress frame & top-right folded leaf accent */}
        <rect
          x="4.5"
          y="4.5"
          width="27"
          height="27"
          rx="7"
          stroke="#d5c3a1"
          strokeOpacity="0.72"
          strokeWidth="0.9"
        />
        <path
          d="M26 2.3V8.2C26 9.2 26.8 10 27.8 10H33.7"
          stroke="#c5ab82"
          strokeWidth="1"
          strokeLinecap="round"
        />
        {/* Delicate horizontal manuscript ruled lines */}
        <line x1="8" y1="15.5" x2="28" y2="15.5" stroke="#c5ab82" strokeOpacity="0.38" strokeWidth="0.9" />
        <line x1="8" y1="20.5" x2="28" y2="20.5" stroke="#c5ab82" strokeOpacity="0.38" strokeWidth="0.9" />
        <line x1="8" y1="25.5" x2="28" y2="25.5" stroke="#c5ab82" strokeOpacity="0.38" strokeWidth="0.9" />
        {/* Sepia ink outer Circumzenithal Arc & dashed inner vault arch */}
        <path
          d="M7.5 23.5C9.8 15 13.8 10.6 18 10.6C22.2 10.6 26.2 15 28.5 23.5"
          stroke={`url(#${paperInkId})`}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <path
          d="M11.8 25C13.4 19.3 15.5 16.8 18 16.8C20.5 16.8 22.6 19.3 24.2 25"
          stroke="#a67240"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="2.4 2.4"
        />
        {/* Traditional cinnabar/vermilion zenith seal dot */}
        <circle cx="18" cy="10.6" r="2.3" fill="#b8432e" />
        <circle cx="17.3" cy="9.9" r="0.7" fill="#fde6c4" fillOpacity="0.85" />
      </svg>
    );
  }

  const gradId = `arcDomeGrad-${uid}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ArcVault Logo"
    >
      <defs>
        <linearGradient id={gradId} x1="4" y1="30" x2="32" y2="6" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b5bdb" />
          <stop offset="55%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
      <rect
        x="2"
        y="2"
        width="32"
        height="32"
        rx="10"
        fill={`url(#${gradId})`}
        fillOpacity="0.14"
        stroke={`url(#${gradId})`}
        strokeWidth="1.5"
      />
      {/* Outer Circumzenithal Arc */}
      <path
        d="M7 23C9.5 14.5 13.5 10.5 18 10.5C22.5 10.5 26.5 14.5 29 23"
        stroke={`url(#${gradId})`}
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Inner Vault Arch */}
      <path
        d="M11.5 24.5C13.2 19 15.4 16.5 18 16.5C20.6 16.5 22.8 19 24.5 24.5"
        stroke={`url(#${gradId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="2.5 2.5"
      />
      {/* Zenith Star */}
      <circle cx="18" cy="10.5" r="2.2" fill="#0ea5e9" />
    </svg>
  );
};
