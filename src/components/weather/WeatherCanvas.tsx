import React, { useEffect, useMemo, useRef, useState } from 'react';
import type {
  ActiveRenderBackend,
  GyroscopeSettings,
  RenderBackendMode,
  RenderBackendStatus,
  RenderQualityTier,
  WeatherEffectId,
  WeatherTimeOfDay,
} from '../../types/archive';
import { attachBackgroundMotionController } from '../../platform/backgroundMotion';
import {
  applyMobilePowerBudget,
  createAutoFallbackWatchdog,
  detectWebGL2Capability,
  getRenderQualityProfile,
  resolveInitialRenderBackend,
} from '../../core/renderEngine';
import { createRainGlassRenderer } from './rainGlassShader';
import { createWeatherSkyRenderer } from './weatherSkyShader';
import {
  createCpuRainGlassRenderer,
  createWeatherCpuSkyRenderer,
} from './weatherCpuRenderer';

export interface WeatherCanvasProps {
  effects: WeatherEffectId[];
  timeOfDay: WeatherTimeOfDay;
  isLiveDay?: boolean;
  intensity: number;
  rainStreakOpacity?: number;
  darkMaskOpacity: number;
  renderMode?: RenderBackendMode;
  quality?: RenderQualityTier;
  isMobileOrTablet?: boolean;
  prefersReducedMotion?: boolean;
  gyroscope?: GyroscopeSettings;
  onBackendStatusChange?: (status: RenderBackendStatus) => void;
}

const ALL_EFFECTS: WeatherEffectId[] = [
  'clear-sun',
  'clouds',
  'rain',
  'thunder',
  'snow',
  'fog',
  'rainbow',
  'aurora',
  'wind-petals',
];

type Rgb = [number, number, number];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpRgb(c1: Rgb, c2: Rgb, t: number): Rgb {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

function rgbStr(c: Rgb, alpha = 1): string {
  const r = Math.round(c[0]);
  const g = Math.round(c[1]);
  const b = Math.round(c[2]);
  return alpha >= 0.999 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

function resolveTod(tod: WeatherTimeOfDay, isLiveDay?: boolean): 'day' | 'dusk' | 'night' {
  if (tod === 'day' || tod === 'dusk' || tod === 'night') return tod;
  if (typeof isLiveDay === 'boolean' && !isLiveDay) return 'night';
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 7) return 'dusk';
  if (hr >= 7 && hr < 17) return 'day';
  if (hr >= 17 && hr < 20) return 'dusk';
  return 'night';
}

interface StarParticle {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  tint: string;
}

interface CloudCluster {
  x: number;
  y: number;
  scale: number;
  speed: number;
  layer: number;
  puffs: Array<{ dx: number; dy: number; r: number }>;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  depth: number;
  tier: 0 | 1 | 2;
  alpha: number;
  jitter: number;
}

interface SplashRipple {
  x: number;
  y: number;
  age: number;
  life: number;
  maxR: number;
  sprays: Array<{ dx: number; dy: number }>;
}

interface Snowflake {
  x: number;
  y: number;
  r: number;
  vy: number;
  vxBias: number;
  phase: number;
  rot: number;
  rotSpeed: number;
  depth: number;
  kind: 'dust' | 'dendrite' | 'bokeh';
  variant: 0 | 1 | 2 | 3;
  tumblePhase: number;
  tumbleSpeed: number;
  glintPhase: number;
  alpha: number;
}

interface FogBank {
  x: number;
  y: number;
  rx: number;
  ry: number;
  speed: number;
  phase: number;
  alpha: number;
}

interface PetalParticle {
  x: number;
  y: number;
  size: number;
  vx: number;
  vy: number;
  depth: number;
  variant: 0 | 1 | 2 | 3;
  roll: number;
  vRoll: number;
  pitch: number;
  vPitch: number;
  yaw: number;
  vYaw: number;
  glidePhase: number;
  glideFreq: number;
  blurred: boolean;
}

interface LightningSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
  order: 0 | 1 | 2;
  progress: number;
}

interface LightningBolt {
  kind: 'forked' | 'sheet';
  segments: LightningSegment[];
  age: number;
  duration: number;
  hasRestrike: boolean;
  flashX: number;
  flashY: number;
  lobeX: number;
  lobeY: number;
}

interface ShootingStar {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  len: number;
}

function generateLightningBranch(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  disp: number,
  baseWidth: number,
  order: 0 | 1 | 2,
  depth: number,
  pStart: number,
  pEnd: number,
  out: LightningSegment[],
): void {
  if (depth === 0 || disp < 2.5) {
    const pMid = (pStart + pEnd) * 0.5;
    const taper = order === 0 ? lerp(1.0, 0.52, pMid) : order === 1 ? lerp(0.85, 0.35, pMid) : 0.65;
    out.push({
      x1,
      y1,
      x2,
      y2,
      width: baseWidth * taper,
      order,
      progress: pMid,
    });
    return;
  }

  const biasX = (Math.random() - 0.5) * disp;
  const biasY = (Math.random() - 0.5) * disp * 0.28;
  const mx = (x1 + x2) * 0.5 + biasX;
  const my = (y1 + y2) * 0.5 + biasY;
  const pMid = (pStart + pEnd) * 0.5;

  generateLightningBranch(x1, y1, mx, my, disp * 0.56, baseWidth, order, depth - 1, pStart, pMid, out);
  generateLightningBranch(mx, my, x2, y2, disp * 0.56, baseWidth, order, depth - 1, pMid, pEnd, out);

  // Spawn organic dendritic forks at intermediate subdivision depths
  if (order === 0 && depth >= 2 && depth <= 5 && Math.random() < 0.44) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const forkAngle = Math.PI * 0.5 - side * (0.32 + Math.random() * 0.48); // 18°..46° from vertical
    const remLen = Math.hypot(x2 - mx, y2 - my) * (0.45 + Math.random() * 0.45);
    const fx = mx + Math.cos(forkAngle) * Math.max(48, remLen);
    const fy = my + Math.sin(forkAngle) * Math.max(60, remLen);
    generateLightningBranch(
      mx,
      my,
      fx,
      fy,
      disp * 0.52,
      baseWidth * 0.52,
      1,
      Math.max(2, depth - 2),
      pMid,
      Math.min(1, pMid + 0.32),
      out,
    );
  } else if (order === 1 && depth >= 2 && depth <= 3 && Math.random() < 0.42) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const twigAngle = Math.PI * 0.5 - side * (0.45 + Math.random() * 0.52);
    const twigLen = 28 + Math.random() * 58;
    const tx = mx + Math.cos(twigAngle) * twigLen;
    const ty = my + Math.sin(twigAngle) * twigLen;
    generateLightningBranch(
      mx,
      my,
      tx,
      ty,
      disp * 0.48,
      baseWidth * 0.54,
      2,
      2,
      pMid,
      Math.min(1, pMid + 0.2),
      out,
    );
  }
}

export const WeatherCanvas: React.FC<WeatherCanvasProps> = ({
  effects,
  timeOfDay,
  isLiveDay,
  intensity,
  rainStreakOpacity = 0.55,
  darkMaskOpacity,
  renderMode = 'auto',
  quality = 'balanced',
  isMobileOrTablet = false,
  prefersReducedMotion = false,
  gyroscope,
  onBackendStatusChange,
}) => {
  const initialDecision = useMemo(
    () => resolveInitialRenderBackend(renderMode, detectWebGL2Capability()),
    [renderMode],
  );
  const [activeBackend, setActiveBackend] = useState<ActiveRenderBackend>(initialDecision.backend);
  const [backendReason, setBackendReason] = useState<string>(initialDecision.reason);

  useEffect(() => {
    setActiveBackend(initialDecision.backend);
    setBackendReason(initialDecision.reason);
  }, [initialDecision]);

  useEffect(() => {
    onBackendStatusChange?.({
      mode: renderMode,
      active: activeBackend,
      reason: backendReason,
    });
  }, [renderMode, activeBackend, backendReason, onBackendStatusChange]);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rainGlCanvasRef = useRef<HTMLCanvasElement>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.35, vx: 0, vy: 0 });
  const propsRef = useRef({
    effects,
    timeOfDay,
    isLiveDay,
    intensity,
    rainStreakOpacity,
    renderMode,
    quality,
    isMobileOrTablet,
    prefersReducedMotion,
  });
  propsRef.current = {
    effects,
    timeOfDay,
    isLiveDay,
    intensity,
    rainStreakOpacity,
    renderMode,
    quality,
    isMobileOrTablet,
    prefersReducedMotion,
  };

  useEffect(() => {
    resizeHandlerRef.current?.();
  }, [quality, isMobileOrTablet, prefersReducedMotion]);

  useEffect(() => {
    return attachBackgroundMotionController({
      getContainer: () => containerRef.current,
      isMobileOrTablet,
      gyroscope,
      onUpdate: ({ x, y, vx, vy }) => {
        pointerRef.current.x = x;
        pointerRef.current.y = y;
        pointerRef.current.vx = vx;
        pointerRef.current.vy = vy;
      },
    });
  }, [isMobileOrTablet, gyroscope?.enabled, gyroscope?.sensitivity]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const useGpu = activeBackend === 'gpu';
    const powerPref: WebGLPowerPreference =
      propsRef.current.quality === 'eco' ? 'low-power' : 'high-performance';

    const rainGlCanvas = useGpu ? rainGlCanvasRef.current : null;
    const rainRenderer = rainGlCanvas ? createRainGlassRenderer(rainGlCanvas, powerPref) : null;

    const skyGlCanvas = useGpu ? document.createElement('canvas') : null;
    const skyRenderer = skyGlCanvas ? createWeatherSkyRenderer(skyGlCanvas, powerPref) : null;
    const cpuSkyRenderer = useGpu ? null : createWeatherCpuSkyRenderer();
    const cpuRainRenderer = useGpu ? null : createCpuRainGlassRenderer();

    if (useGpu && (!skyRenderer || !rainRenderer)) {
      rainRenderer?.dispose();
      skyRenderer?.dispose();
      setBackendReason('WebGL2 着色器初始化失败，已自动切至 CPU 渲染');
      setActiveBackend('cpu');
      return;
    }

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      if (propsRef.current.renderMode === 'auto') {
        setBackendReason('自动：GPU 上下文丢失，已切至 CPU 渲染');
        setActiveBackend('cpu');
      }
    };
    skyGlCanvas?.addEventListener('webglcontextlost', handleContextLost);
    rainGlCanvas?.addEventListener('webglcontextlost', handleContextLost);

    const rainbowCanvas = document.createElement('canvas');
    const rainbowCtx = rainbowCanvas.getContext('2d');

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    const getBoxSize = () => ({
      w: Math.max(1, Math.round(containerRef.current?.clientWidth || canvas.clientWidth || window.innerWidth)),
      h: Math.max(1, Math.round(containerRef.current?.clientHeight || canvas.clientHeight || window.innerHeight)),
    });
    let { w: width, h: height } = getBoxSize();
    let dpr = 1;

    const resize = () => {
      const prof = applyMobilePowerBudget(
        getRenderQualityProfile(propsRef.current.quality),
        {
          isMobileOrTablet: propsRef.current.isMobileOrTablet,
          prefersReducedMotion: propsRef.current.prefersReducedMotion || reducedMotion,
        },
      );
      const cap = useGpu ? prof.gpuDprCap : prof.cpuDprCap;
      dpr = Math.min(window.devicePixelRatio || 1, cap);
      const box = getBoxSize();
      width = box.w;
      height = box.h;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      rainbowCanvas.width = Math.max(1, Math.floor(width));
      rainbowCanvas.height = Math.max(1, Math.floor(height));
      const shaderDpr = Math.min(window.devicePixelRatio || 1, prof.shaderDprCap);
      skyRenderer?.resize(width, height, shaderDpr);
      rainRenderer?.resize(width, height, shaderDpr);
    };
    resizeHandlerRef.current = resize;
    resize();

    const pointer = pointerRef.current;
    const pointerSmooth = { x: pointer.x, y: pointer.y };
    window.addEventListener('resize', resize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(containerRef.current ?? canvas);

    // Pre-seed atmospheric particle pools
    const stars: StarParticle[] = Array.from({ length: 130 }, () => ({
      x: Math.random(),
      y: Math.random() * 0.72,
      r: 0.6 + Math.random() * 1.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 2.2,
      tint: Math.random() < 0.2 ? '#fde68a' : Math.random() < 0.35 ? '#bae6fd' : '#ffffff',
    }));

    const clouds: CloudCluster[] = Array.from({ length: 15 }, (_, idx) => {
      const layer = idx % 3;
      const puffCount = 5 + (idx % 4);
      const puffs = Array.from({ length: puffCount }, (__, pIdx) => ({
        dx: (pIdx - puffCount * 0.5) * (36 + (layer * 10)),
        dy: (Math.sin(pIdx * 1.7 + idx) - 0.35) * 26,
        r: 44 + ((pIdx * 17 + idx * 13) % 42) + layer * 14,
      }));
      return {
        x: Math.random() * 1.4 - 0.2,
        y: 0.08 + layer * 0.13 + Math.random() * 0.09,
        scale: 0.8 + layer * 0.26,
        speed: 0.0055 + layer * 0.004 + Math.random() * 0.003,
        layer,
        puffs,
      };
    });

    const rainDrops: RainDrop[] = Array.from({ length: 280 }, (_, idx) => {
      const r = (idx % 100) / 100;
      const tier: 0 | 1 | 2 = r < 0.45 ? 0 : r < 0.87 ? 1 : 2;
      const depth =
        tier === 0
          ? 0.08 + Math.random() * 0.28
          : tier === 1
            ? 0.38 + Math.random() * 0.38
            : 0.8 + Math.random() * 0.2;
      return {
        x: Math.random() * 1.28 - 0.14,
        y: Math.random(),
        len: 16 + depth * 44,
        speed: 540 + depth * 820,
        depth,
        tier,
        alpha: tier === 0 ? 0.1 + depth * 0.18 : tier === 1 ? 0.16 + depth * 0.28 : 0.18 + depth * 0.22,
        jitter: (Math.random() - 0.5) * 0.04,
      };
    });

    const splashes: SplashRipple[] = [];

    // Pre-rendered offscreen sprite atlases for realistic dendritic snowflakes, bokeh flurries, and botanical sakura petals
    const createDendriteSprite = (variant: 0 | 1 | 2 | 3): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const g = c.getContext('2d');
      if (!g) return c;

      g.translate(32, 32);
      g.lineCap = 'round';
      g.lineJoin = 'round';

      // Soft icy ambient halo
      const halo = g.createRadialGradient(0, 0, 2, 0, 0, 28);
      halo.addColorStop(0, 'rgba(255, 255, 255, 0.28)');
      halo.addColorStop(0.55, 'rgba(214, 238, 255, 0.08)');
      halo.addColorStop(1, 'rgba(214, 238, 255, 0)');
      g.fillStyle = halo;
      g.beginPath();
      g.arc(0, 0, 28, 0, Math.PI * 2);
      g.fill();

      // Translucent hexagonal center prism plate
      const plateR = variant === 2 ? 7.5 : variant === 1 ? 5.2 : 4.2;
      g.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const px = Math.cos(a) * plateR;
        const py = Math.sin(a) * plateR;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fillStyle = 'rgba(240, 249, 255, 0.42)';
      g.fill();
      g.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      g.lineWidth = 1.1;
      g.stroke();

      // 6 main crystalline shafts + 2 tiers of 60-degree dendritic side branches
      const armLen = variant === 3 ? 23 : 26;
      const t1Dist = variant === 1 ? 9.5 : 11.5;
      const t1Len = variant === 1 ? 9.2 : variant === 2 ? 6.5 : 8.2;
      const t2Dist = variant === 1 ? 16.5 : 18.5;
      const t2Len = variant === 1 ? 6.0 : 4.6;

      for (let arm = 0; arm < 6; arm++) {
        g.save();
        g.rotate((arm * Math.PI) / 3);

        // Main tapered shaft
        const shaftGrad = g.createLinearGradient(0, 0, armLen, 0);
        shaftGrad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
        shaftGrad.addColorStop(0.7, 'rgba(232, 246, 255, 0.92)');
        shaftGrad.addColorStop(1, 'rgba(220, 242, 255, 0.65)');
        g.strokeStyle = shaftGrad;
        g.lineWidth = variant === 2 ? 1.75 : 1.45;
        g.beginPath();
        g.moveTo(plateR * 0.4, 0);
        g.lineTo(armLen, 0);
        g.stroke();

        // Side dendritic branches at ±60°
        const branchAngle = Math.PI / 3;
        const cosB = Math.cos(branchAngle);
        const sinB = Math.sin(branchAngle);

        g.lineWidth = 1.1;
        g.strokeStyle = 'rgba(242, 250, 255, 0.88)';
        for (const sign of [-1, 1]) {
          g.beginPath();
          g.moveTo(t1Dist, 0);
          g.lineTo(t1Dist + cosB * t1Len, sign * sinB * t1Len);
          g.moveTo(t2Dist, 0);
          g.lineTo(t2Dist + cosB * t2Len, sign * sinB * t2Len);
          if (variant === 1) {
            g.moveTo(t1Dist + cosB * 4.5, sign * sinB * 4.5);
            g.lineTo(t1Dist + cosB * 4.5 + 3.2, sign * sinB * 4.5);
          }
          g.stroke();
        }

        // Tip crystal facet for sectored/stellar variants
        if (variant === 0 || variant === 2) {
          g.fillStyle = 'rgba(255, 255, 255, 0.8)';
          g.beginPath();
          g.arc(armLen, 0, 1.25, 0, Math.PI * 2);
          g.fill();
        }
        g.restore();
      }
      return c;
    };

    const createBokehFlakeSprite = (variant: 0 | 1 | 2): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 48;
      const g = c.getContext('2d');
      if (!g) return c;

      // Irregular multi-lobe out-of-focus snow flurry (never a flat uniform circle)
      const lobes = [
        { x: 24, y: 24, r: 14, a: 0.45 },
        { x: 20 + variant * 1.5, y: 21, r: 10, a: 0.34 },
        { x: 27 - variant, y: 26, r: 11, a: 0.32 },
        { x: 23, y: 27 - variant, r: 9, a: 0.28 },
      ];
      for (const l of lobes) {
        const rg = g.createRadialGradient(l.x, l.y, 0.5, l.x, l.y, l.r);
        rg.addColorStop(0, `rgba(255, 255, 255, ${l.a})`);
        rg.addColorStop(0.55, `rgba(226, 243, 255, ${(l.a * 0.52).toFixed(3)})`);
        rg.addColorStop(1, 'rgba(226, 243, 255, 0)');
        g.fillStyle = rg;
        g.beginPath();
        g.arc(l.x, l.y, l.r, 0, Math.PI * 2);
        g.fill();
      }
      return c;
    };

    const createSakuraPetalSprite = (variant: 0 | 1 | 2 | 3, blurred: boolean): HTMLCanvasElement => {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const g = c.getContext('2d');
      if (!g) return c;

      const tints: Array<{ base: string; mid: string; tip: string; vein: string }> = [
        { base: '#f472b6', mid: '#fbcfe8', tip: '#fff5f8', vein: 'rgba(244, 114, 182, 0.28)' },
        { base: '#fb7185', mid: '#fecdd3', tip: '#fff7f8', vein: 'rgba(251, 113, 133, 0.24)' },
        { base: '#f9a8d4', mid: '#fce7f3', tip: '#ffffff', vein: 'rgba(236, 72, 153, 0.22)' },
        { base: '#f48fb1', mid: '#fde8ef', tip: '#fff9fb', vein: 'rgba(240, 98, 146, 0.25)' },
      ];
      const pal = tints[variant];

      g.save();
      g.translate(32, 34);
      if (blurred && 'filter' in g) {
        g.filter = 'blur(1.6px)';
      }

      // Authentic sakura petal silhouette: tapered base -> flared sides -> twin rounded lobes + iconic V-notch at tip
      const drawPetalShape = () => {
        g.beginPath();
        g.moveTo(0, 18); // pointed petal base
        g.bezierCurveTo(-11, 11, -18, -4, -12, -16);
        g.bezierCurveTo(-9, -22, -3.5, -22, -1.6, -15.5);
        g.lineTo(0, -13.2); // sakura apical V-notch
        g.lineTo(1.8, -15.6);
        g.bezierCurveTo(4, -22.5, 9.5, -22, 12.2, -15.8);
        g.bezierCurveTo(18, -4, 11, 11, 0, 18);
        g.closePath();
      };

      const grad = g.createLinearGradient(0, 18, 0, -21);
      grad.addColorStop(0, pal.base);
      grad.addColorStop(0.35, pal.mid);
      grad.addColorStop(0.85, pal.tip);
      grad.addColorStop(1, 'rgba(255, 255, 255, 0.92)');

      drawPetalShape();
      g.globalAlpha = blurred ? 0.72 : 0.92;
      g.fillStyle = grad;
      g.fill();

      // Delicate translucent longitudinal petal veins
      if (!blurred) {
        g.strokeStyle = pal.vein;
        g.lineWidth = 0.85;
        g.beginPath();
        g.moveTo(0, 16);
        g.quadraticCurveTo(-0.8, 2, 0, -12.5);
        g.moveTo(-0.5, 13);
        g.quadraticCurveTo(-6.5, 1, -7.2, -13);
        g.moveTo(0.5, 13);
        g.quadraticCurveTo(6.5, 1, 7.2, -13);
        g.stroke();

        // Subtle pearlescent rim edge
        drawPetalShape();
        g.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        g.lineWidth = 0.75;
        g.stroke();
      }
      g.restore();
      return c;
    };

    const dendriteSprites = ([0, 1, 2, 3] as const).map(createDendriteSprite);
    const bokehFlakeSprites = ([0, 1, 2] as const).map(createBokehFlakeSprite);
    const sakuraSprites = ([0, 1, 2, 3] as const).map((v) => createSakuraPetalSprite(v, false));
    const sakuraBokehSprites = ([0, 1, 2, 3] as const).map((v) => createSakuraPetalSprite(v, true));

    const snowflakes: Snowflake[] = Array.from({ length: 220 }, (_, idx) => {
      const depth = Math.random();
      const kind: Snowflake['kind'] =
        depth < 0.35 ? 'dust' : depth > 0.78 ? 'bokeh' : idx % 3 === 0 ? 'bokeh' : 'dendrite';
      const r =
        kind === 'dust'
          ? 1.1 + depth * 2.2
          : kind === 'dendrite'
            ? 6.0 + depth * 8.5
            : 7.5 + depth * 10.5;
      return {
        x: Math.random(),
        y: Math.random(),
        r,
        vy: 20 + depth * 68,
        vxBias: (Math.random() - 0.5) * 16,
        phase: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 1.15,
        depth,
        kind,
        variant: (idx % 4) as 0 | 1 | 2 | 3,
        tumblePhase: Math.random() * Math.PI * 2,
        tumbleSpeed: 0.7 + Math.random() * 1.3,
        glintPhase: Math.random() * Math.PI * 2,
        alpha: kind === 'dust' ? 0.35 + depth * 0.45 : kind === 'bokeh' ? 0.24 + depth * 0.34 : 0.48 + depth * 0.45,
      };
    });

    const fogBanks: FogBank[] = Array.from({ length: 9 }, (_, idx) => ({
      x: (idx / 9) * 1.4 - 0.2,
      y: 0.36 + (idx % 4) * 0.16,
      rx: 0.36 + (idx % 3) * 0.12,
      ry: 0.14 + (idx % 2) * 0.08,
      speed: (idx % 2 === 0 ? 1 : -1) * (0.008 + (idx % 3) * 0.004),
      phase: idx * 1.2,
      alpha: 0.16 + (idx % 3) * 0.06,
    }));

    const petals: PetalParticle[] = Array.from({ length: 72 }, (_, idx) => {
      const depth = 0.18 + Math.random() * 0.82;
      return {
        x: Math.random(),
        y: Math.random(),
        size: 6.5 + depth * 11.5,
        vx: 38 + depth * 56,
        vy: 14 + depth * 28,
        depth,
        variant: (idx % 4) as 0 | 1 | 2 | 3,
        roll: Math.random() * Math.PI * 2,
        vRoll: (Math.random() - 0.5) * 1.9,
        pitch: Math.random() * Math.PI * 2,
        vPitch: 1.3 + Math.random() * 1.8,
        yaw: Math.random() * Math.PI * 2,
        vYaw: (Math.random() - 0.5) * 1.1,
        glidePhase: Math.random() * Math.PI * 2,
        glideFreq: 1.3 + Math.random() * 1.4,
        blurred: depth > 0.84,
      };
    });

    const sunMotes = Array.from({ length: 28 }, () => ({
      x: 0.35 + Math.random() * 0.62,
      y: Math.random() * 0.7,
      r: 1.0 + Math.random() * 2.0,
      phase: Math.random() * Math.PI * 2,
      speed: 0.35 + Math.random() * 0.8,
    }));

    let lightningBolt: LightningBolt | null = null;
    let nextLightningIn = 1.4 + Math.random() * 2.2;
    let shootingStar: ShootingStar | null = null;
    let nextShootingStarIn = 2.5 + Math.random() * 4;

    // Smooth atmospheric state weights & palette
    const weights: Record<WeatherEffectId, number> = {
      'clear-sun': 0,
      clouds: 0,
      rain: 0,
      thunder: 0,
      snow: 0,
      fog: 0,
      rainbow: 0,
      aurora: 0,
      'wind-petals': 0,
    };
    for (const id of propsRef.current.effects) {
      weights[id] = 1;
    }

    let skyTop: Rgb = [18, 42, 82];
    let skyMid: Rgb = [42, 82, 138];
    let skyBot: Rgb = [108, 152, 198];

    const initTod = resolveTod(propsRef.current.timeOfDay, propsRef.current.isLiveDay);
    let dayFactor = initTod === 'day' ? 1 : 0;
    let duskFactor = initTod === 'dusk' ? 1 : 0;
    let nightFactor = initTod === 'night' ? 1 : 0;

    const watchdog = createAutoFallbackWatchdog();
    let rafId = 0;
    let lastTs = performance.now();
    let lastDrawnTs = 0;
    let elapsed = 0;

    const frame = (now: number) => {
      rafId = requestAnimationFrame(frame);
      if (document.hidden) {
        lastTs = now;
        return;
      }

      const rawDeltaMs = now - lastTs;
      const cur = propsRef.current;
      const prof = applyMobilePowerBudget(
        getRenderQualityProfile(cur.quality),
        {
          isMobileOrTablet: cur.isMobileOrTablet,
          prefersReducedMotion: cur.prefersReducedMotion || reducedMotion,
        },
      );

      if (useGpu && cur.renderMode === 'auto' && prof.gpuMinFrameMs === 0) {
        if (watchdog.recordFrame(rawDeltaMs)) {
          setBackendReason('自动：检测到连续掉帧，已切至 CPU 渲染');
          setActiveBackend('cpu');
          return;
        }
      }

      const minFrameMs = useGpu ? prof.gpuMinFrameMs : prof.cpuMinFrameMs;
      if (minFrameMs > 0 && now - lastDrawnTs < minFrameMs) {
        return;
      }
      lastDrawnTs = now;

      const rawDt = Math.min(0.05, Math.max(0.001, rawDeltaMs / 1000));
      lastTs = now;
      const dt = reducedMotion ? 0.002 : rawDt;
      elapsed += dt;

      pointer.vx *= 0.92;
      pointer.vy *= 0.92;
      pointerSmooth.x = lerp(pointerSmooth.x, pointer.x, 1 - Math.exp(-dt * 4.5));
      pointerSmooth.y = lerp(pointerSmooth.y, pointer.y, 1 - Math.exp(-dt * 4.5));

      const intensityScale = Math.max(0.25, Math.min(1.6, cur.intensity));
      const activeSet = new Set(cur.effects);
      const weightLerp = 1 - Math.exp(-dt * 2.2);
      for (const id of ALL_EFFECTS) {
        weights[id] = lerp(weights[id], activeSet.has(id) ? 1 : 0, weightLerp);
      }

      const tod = resolveTod(cur.timeOfDay, cur.isLiveDay);
      const stormFactor = Math.min(
        1,
        weights.rain * 0.55 + weights.thunder * 0.75 + weights.fog * 0.32 + weights.clouds * 0.2,
      );

      // Compute target sky stops
      let tTop: Rgb = [26, 98, 186];
      let tMid: Rgb = [72, 154, 224];
      let tBot: Rgb = [168, 214, 246];
      if (tod === 'dusk') {
        tTop = [22, 32, 76];
        tMid = [118, 72, 134];
        tBot = [228, 136, 118];
      } else if (tod === 'night') {
        tTop = [4, 9, 24];
        tMid = [10, 20, 48];
        tBot = [22, 39, 76];
      }

      if (stormFactor > 0.02) {
        const stormTop: Rgb = tod === 'night' ? [6, 9, 18] : [26, 36, 52];
        const stormMid: Rgb = tod === 'night' ? [12, 18, 30] : [44, 58, 78];
        const stormBot: Rgb = tod === 'night' ? [20, 28, 44] : [68, 84, 106];
        tTop = lerpRgb(tTop, stormTop, stormFactor * 0.78);
        tMid = lerpRgb(tMid, stormMid, stormFactor * 0.78);
        tBot = lerpRgb(tBot, stormBot, stormFactor * 0.72);
      }

      if (weights.aurora > 0.02 && tod === 'night') {
        tTop = lerpRgb(tTop, [3, 8, 20], weights.aurora * 0.6);
        tMid = lerpRgb(tMid, [7, 26, 46], weights.aurora * 0.45);
      }

      const skyLerp = 1 - Math.exp(-dt * 2.0);
      dayFactor = lerp(dayFactor, tod === 'day' ? 1 : 0, skyLerp);
      duskFactor = lerp(duskFactor, tod === 'dusk' ? 1 : 0, skyLerp);
      nightFactor = lerp(nightFactor, tod === 'night' ? 1 : 0, skyLerp);
      const factorSum = Math.max(0.001, dayFactor + duskFactor + nightFactor);
      dayFactor /= factorSum;
      duskFactor /= factorSum;
      nightFactor /= factorSum;

      // 1-4. Volumetric Sky, Sun, Tyndall, Clouds, Rainbow & Nimitz Aurora (GPU WebGL2 or CPU Software Shader)
      if (skyRenderer && skyGlCanvas) {
        skyRenderer.render({
          timeSec: elapsed,
          mouseX: pointerSmooth.x,
          mouseY: pointerSmooth.y,
          sunWeight: weights['clear-sun'],
          auroraWeight: weights.aurora,
          cloudWeight: weights.clouds,
          stormWeight: stormFactor,
          rainbowWeight: weights.rainbow,
          dayFactor,
          duskFactor,
          nightFactor,
          intensity: intensityScale,
        });
        ctx.drawImage(skyGlCanvas, 0, 0, width, height);
      } else if (cpuSkyRenderer) {
        cpuSkyRenderer.render(ctx, {
          width,
          height,
          timeSec: elapsed,
          mouseX: pointerSmooth.x,
          mouseY: pointerSmooth.y,
          sunWeight: weights['clear-sun'],
          auroraWeight: weights.aurora,
          cloudWeight: weights.clouds,
          stormWeight: stormFactor,
          rainbowWeight: weights.rainbow,
          dayFactor,
          duskFactor,
          nightFactor,
          intensity: intensityScale,
          quality: cur.quality,
        });
      } else {
        skyTop = lerpRgb(skyTop, tTop, skyLerp);
        skyMid = lerpRgb(skyMid, tMid, skyLerp);
        skyBot = lerpRgb(skyBot, tBot, skyLerp);

        const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
        skyGrad.addColorStop(0, rgbStr(skyTop));
        skyGrad.addColorStop(0.54, rgbStr(skyMid));
        skyGrad.addColorStop(1, rgbStr(skyBot));
        ctx.fillStyle = skyGrad;
        ctx.fillRect(0, 0, width, height);

        const nightStrength = tod === 'night' ? 1 : tod === 'dusk' ? 0.34 : 0;
        const skyClearMask = Math.max(0.15, 1 - (weights.clouds * 0.45 + weights.fog * 0.55));
        const starVis = nightStrength * skyClearMask;
        if (starVis > 0.03 || weights.aurora > 0.05) {
          const effectiveStar = Math.max(starVis, weights.aurora * 0.68);
          for (const s of stars) {
            const twinkle = 0.42 + 0.58 * Math.sin(elapsed * s.speed + s.phase);
            ctx.globalAlpha = effectiveStar * twinkle * 0.85;
            ctx.fillStyle = s.tint;
            ctx.beginPath();
            ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
        }

        // Daytime/Dusk Sun & softly feathered Tyndall light ribbons (CPU 2D fallback)
        if (tod !== 'night' && weights['clear-sun'] > 0.02) {
          const sx = width * (0.78 + (pointerSmooth.x - 0.5) * 0.03);
          const sy = height * ((tod === 'dusk' ? 0.36 : 0.16) + (pointerSmooth.y - 0.5) * 0.03);
          const sunW = weights['clear-sun'] * Math.max(0.25, 1 - stormFactor * 0.72);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const coronaR = Math.min(width, height) * 0.36;
          const corona = ctx.createRadialGradient(sx, sy, 4, sx, sy, coronaR);
          corona.addColorStop(0, `rgba(255, 252, 238, ${(0.92 * sunW).toFixed(3)})`);
          corona.addColorStop(
            0.12,
            tod === 'dusk'
              ? `rgba(253, 186, 116, ${(0.44 * sunW).toFixed(3)})`
              : `rgba(254, 240, 178, ${(0.34 * sunW).toFixed(3)})`,
          );
          corona.addColorStop(0.45, `rgba(253, 224, 158, ${(0.10 * sunW).toFixed(3)})`);
          corona.addColorStop(1, 'rgba(253, 224, 158, 0)');
          ctx.fillStyle = corona;
          ctx.beginPath();
          ctx.arc(sx, sy, coronaR, 0, Math.PI * 2);
          ctx.fill();

          // Softly feathered diagonal Tyndall ribbons (transverse soft falloff, no sharp triangle edges)
          const beamSpecs = [
            { ang: Math.PI * 0.58, len: 0.48, halfW: 52, amp: 0.065 },
            { ang: Math.PI * 0.66, len: 0.58, halfW: 72, amp: 0.082 },
            { ang: Math.PI * 0.73, len: 0.52, halfW: 44, amp: 0.058 },
            { ang: Math.PI * 0.81, len: 0.62, halfW: 84, amp: 0.072 },
            { ang: Math.PI * 0.89, len: 0.44, halfW: 48, amp: 0.048 },
            { ang: Math.PI * 0.46, len: 0.38, halfW: 40, amp: 0.042 },
          ];
          const minDim = Math.min(width, height);
          const baseRgb = tod === 'dusk' ? '254, 208, 154' : '255, 246, 220';
          for (let i = 0; i < beamSpecs.length; i++) {
            const spec = beamSpecs[i];
            const breath = 0.72 + 0.28 * Math.sin(elapsed * 0.45 + i * 1.47);
            const alpha = spec.amp * sunW * breath;
            if (alpha < 0.005) continue;
            const bLen = minDim * spec.len;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(spec.ang);
            const gTrans = ctx.createLinearGradient(0, -spec.halfW, 0, spec.halfW);
            gTrans.addColorStop(0, `rgba(${baseRgb}, 0)`);
            gTrans.addColorStop(0.32, `rgba(${baseRgb}, ${(alpha * 0.45).toFixed(3)})`);
            gTrans.addColorStop(0.5, `rgba(${baseRgb}, ${alpha.toFixed(3)})`);
            gTrans.addColorStop(0.68, `rgba(${baseRgb}, ${(alpha * 0.45).toFixed(3)})`);
            gTrans.addColorStop(1, `rgba(${baseRgb}, 0)`);
            ctx.fillStyle = gTrans;
            ctx.beginPath();
            ctx.moveTo(12, -spec.halfW * 0.14);
            ctx.lineTo(bLen, -spec.halfW);
            ctx.lineTo(bLen, spec.halfW);
            ctx.lineTo(12, spec.halfW * 0.14);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
          ctx.restore();
        }

        if (tod === 'night' && weights['clear-sun'] > 0.03) {
          const mx = width * (0.76 + (pointerSmooth.x - 0.5) * 0.03);
          const my = height * (0.2 + (pointerSmooth.y - 0.5) * 0.03);
          const mAlpha = weights['clear-sun'] * skyClearMask;
          const halo = ctx.createRadialGradient(mx, my, 10, mx, my, 175);
          halo.addColorStop(0, `rgba(226, 240, 255, ${(0.55 * mAlpha).toFixed(3)})`);
          halo.addColorStop(0.3, `rgba(147, 197, 253, ${(0.18 * mAlpha).toFixed(3)})`);
          halo.addColorStop(1, 'rgba(147, 197, 253, 0)');
          ctx.fillStyle = halo;
          ctx.beginPath();
          ctx.arc(mx, my, 175, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = `rgba(241, 248, 255, ${(0.92 * mAlpha).toFixed(3)})`;
          ctx.beginPath();
          ctx.arc(mx, my, 24, 0, Math.PI * 2);
          ctx.fill();
        }

        // 2D Aurora Borealis curtains (CPU mode)
        if (weights.aurora > 0.02) {
          const aW = weights.aurora * Math.min(1.15, intensityScale);
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          const stepPx = cur.quality === 'eco' ? 28 : 16;
          for (let layer = 0; layer < 2; layer++) {
            const baseY = height * (0.28 + layer * 0.08);
            const curtainH = height * (0.26 - layer * 0.04);
            for (let x = 0; x <= width; x += stepPx) {
              const nx = x / Math.max(1, width);
              const wave =
                Math.sin(nx * 5.2 + elapsed * (0.45 + layer * 0.12) + layer * 1.9) * 32 +
                Math.cos(nx * 11.0 - elapsed * 0.35 + layer) * 14;
              const density = 0.45 + 0.55 * Math.sin(nx * 8.4 + elapsed * 0.6 + layer * 2.1);
              if (density <= 0.08) continue;
              const yTop = baseY + wave - curtainH;
              const yBot = baseY + wave + 24;
              const colGrad = ctx.createLinearGradient(x, yBot, x, yTop);
              const alpha = density * aW * (layer === 0 ? 0.24 : 0.16);
              colGrad.addColorStop(0, 'rgba(52, 211, 153, 0)');
              colGrad.addColorStop(0.28, `rgba(52, 211, 153, ${alpha.toFixed(3)})`);
              colGrad.addColorStop(0.65, `rgba(56, 189, 248, ${(alpha * 0.72).toFixed(3)})`);
              colGrad.addColorStop(0.88, `rgba(168, 85, 247, ${(alpha * 0.48).toFixed(3)})`);
              colGrad.addColorStop(1, 'rgba(168, 85, 247, 0)');
              ctx.fillStyle = colGrad;
              ctx.fillRect(x, yTop, stepPx + 1, yBot - yTop);
            }
          }
          ctx.restore();
        }
      }

      // Shooting stars complementing WebGL2 volumetric Aurora
      if (weights.aurora > 0.02 && !reducedMotion) {
        const aW = weights.aurora * Math.min(1.2, intensityScale);
        if (!shootingStar) {
          nextShootingStarIn -= dt;
          if (nextShootingStarIn <= 0) {
            shootingStar = {
              x: width * (0.2 + Math.random() * 0.65),
              y: height * (0.05 + Math.random() * 0.2),
              vx: (Math.random() < 0.5 ? -1 : 1) * (420 + Math.random() * 260),
              vy: 190 + Math.random() * 140,
              age: 0,
              life: 0.75 + Math.random() * 0.35,
              len: 95 + Math.random() * 65,
            };
            nextShootingStarIn = 3.2 + Math.random() * 5.0;
          }
        } else {
          shootingStar.age += dt;
          shootingStar.x += shootingStar.vx * dt;
          shootingStar.y += shootingStar.vy * dt;
          const prog = shootingStar.age / shootingStar.life;
          if (prog >= 1) {
            shootingStar = null;
          } else {
            ctx.save();
            ctx.globalCompositeOperation = 'screen';
            const sAlpha = Math.sin(prog * Math.PI) * Math.min(1, aW);
            const mag = Math.hypot(shootingStar.vx, shootingStar.vy) || 1;
            const tx = shootingStar.x - (shootingStar.vx / mag) * shootingStar.len;
            const ty = shootingStar.y - (shootingStar.vy / mag) * shootingStar.len;
            const sg = ctx.createLinearGradient(shootingStar.x, shootingStar.y, tx, ty);
            sg.addColorStop(0, `rgba(255, 255, 255, ${sAlpha.toFixed(3)})`);
            sg.addColorStop(0.4, `rgba(125, 211, 252, ${(sAlpha * 0.6).toFixed(3)})`);
            sg.addColorStop(1, 'rgba(125, 211, 252, 0)');
            ctx.strokeStyle = sg;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(shootingStar.x, shootingStar.y);
            ctx.lineTo(tx, ty);
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      // Delicate sunlit airborne motes weighted toward the solar quadrant
      const sunVis = weights['clear-sun'] * (tod === 'night' ? 0 : tod === 'dusk' ? 0.86 : 0.9);
      if (sunVis > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const m of sunMotes) {
          const mx = m.x * width + Math.sin(elapsed * m.speed + m.phase) * 16;
          const my = m.y * height + Math.cos(elapsed * (m.speed * 0.8) + m.phase) * 10;
          const ma = (0.10 + 0.16 * Math.sin(elapsed * 1.4 + m.phase)) * sunVis;
          ctx.globalAlpha = Math.max(0, ma);
          ctx.fillStyle = tod === 'dusk' ? '#fed7aa' : '#fef08a';
          ctx.beginPath();
          ctx.arc(mx, my, m.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      // 5. 2D Fallback Spectral Double Rainbow (handled in GPU shader & cpuSkyRenderer)
      if (!skyRenderer && !cpuSkyRenderer && weights.rainbow > 0.02 && rainbowCtx) {
        const rbW = weights.rainbow * Math.min(1.15, intensityScale);
        const arcCx = width * 0.52 + (pointerSmooth.x - 0.5) * 30;
        const arcCy = height * 0.92;
        const baseR = Math.min(width, height) * 0.72;
        const innerR = Math.max(40, baseR - 58);
        const bandHalf = 28;
        const midR = baseR - bandHalf;

        rainbowCtx.save();
        rainbowCtx.clearRect(0, 0, width, height);

        // Wide diffused atmospheric glow (弥散光 + supernumerary inner brightening)
        const glowInner = Math.max(10, midR - 110);
        const glowOuter = midR + 135;
        const haloGrad = rainbowCtx.createRadialGradient(arcCx, arcCy, glowInner, arcCx, arcCy, glowOuter);
        const midNorm = (midR - glowInner) / Math.max(1, glowOuter - glowInner);
        haloGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        haloGrad.addColorStop(Math.max(0.05, midNorm - 0.24), 'rgba(196, 181, 253, 0.045)');
        haloGrad.addColorStop(Math.max(0.1, midNorm - 0.12), 'rgba(125, 211, 252, 0.105)');
        haloGrad.addColorStop(midNorm, 'rgba(254, 240, 215, 0.165)');
        haloGrad.addColorStop(Math.min(0.92, midNorm + 0.14), 'rgba(251, 146, 60, 0.095)');
        haloGrad.addColorStop(Math.min(0.96, midNorm + 0.26), 'rgba(244, 114, 182, 0.04)');
        haloGrad.addColorStop(1, 'rgba(244, 114, 182, 0)');
        rainbowCtx.fillStyle = haloGrad;
        rainbowCtx.beginPath();
        rainbowCtx.arc(arcCx, arcCy, glowOuter, Math.PI * 1.02, Math.PI * 1.98);
        rainbowCtx.arc(arcCx, arcCy, glowInner, Math.PI * 1.98, Math.PI * 1.02, true);
        rainbowCtx.closePath();
        rainbowCtx.fill();

        // Continuous smooth primary rainbow spectrum (violet inside -> red outside)
        const specOuter = baseR + 10;
        const specInner = Math.max(20, innerR - 6);
        const specGrad = rainbowCtx.createRadialGradient(arcCx, arcCy, specInner, arcCx, arcCy, specOuter);
        specGrad.addColorStop(0.0, 'rgba(192, 132, 252, 0)');
        specGrad.addColorStop(0.12, 'rgba(192, 132, 252, 0.22)');
        specGrad.addColorStop(0.25, 'rgba(99, 102, 241, 0.26)');
        specGrad.addColorStop(0.39, 'rgba(56, 189, 248, 0.29)');
        specGrad.addColorStop(0.54, 'rgba(74, 222, 128, 0.28)');
        specGrad.addColorStop(0.68, 'rgba(250, 204, 21, 0.30)');
        specGrad.addColorStop(0.81, 'rgba(249, 115, 22, 0.27)');
        specGrad.addColorStop(0.92, 'rgba(239, 68, 68, 0.23)');
        specGrad.addColorStop(1.0, 'rgba(239, 68, 68, 0)');
        rainbowCtx.fillStyle = specGrad;
        rainbowCtx.beginPath();
        rainbowCtx.arc(arcCx, arcCy, specOuter, Math.PI * 1.04, Math.PI * 1.96);
        rainbowCtx.arc(arcCx, arcCy, specInner, Math.PI * 1.96, Math.PI * 1.04, true);
        rainbowCtx.closePath();
        rainbowCtx.fill();

        // Subtle outer inverted secondary rainbow + diffuse bloom
        const secInner = baseR * 1.13;
        const secOuter = secInner + 42;
        const secGrad = rainbowCtx.createRadialGradient(arcCx, arcCy, secInner, arcCx, arcCy, secOuter);
        secGrad.addColorStop(0.0, 'rgba(239, 68, 68, 0)');
        secGrad.addColorStop(0.18, 'rgba(239, 68, 68, 0.11)');
        secGrad.addColorStop(0.42, 'rgba(250, 204, 21, 0.12)');
        secGrad.addColorStop(0.66, 'rgba(56, 189, 248, 0.12)');
        secGrad.addColorStop(0.86, 'rgba(192, 132, 252, 0.10)');
        secGrad.addColorStop(1.0, 'rgba(192, 132, 252, 0)');
        rainbowCtx.fillStyle = secGrad;
        rainbowCtx.beginPath();
        rainbowCtx.arc(arcCx, arcCy, secOuter, Math.PI * 1.05, Math.PI * 1.95);
        rainbowCtx.arc(arcCx, arcCy, secInner, Math.PI * 1.95, Math.PI * 1.05, true);
        rainbowCtx.closePath();
        rainbowCtx.fill();

        // Soft transparency fade at BOTH horizontal endpoints & near lower horizon
        rainbowCtx.globalCompositeOperation = 'destination-in';
        const spanLeft = Math.max(0, arcCx - secOuter * 1.02);
        const spanRight = Math.min(width, arcCx + secOuter * 1.02);
        const hMask = rainbowCtx.createLinearGradient(spanLeft, 0, spanRight, 0);
        hMask.addColorStop(0.0, 'rgba(255, 255, 255, 0)');
        hMask.addColorStop(0.16, 'rgba(255, 255, 255, 0.45)');
        hMask.addColorStop(0.32, 'rgba(255, 255, 255, 1)');
        hMask.addColorStop(0.68, 'rgba(255, 255, 255, 1)');
        hMask.addColorStop(0.84, 'rgba(255, 255, 255, 0.45)');
        hMask.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
        rainbowCtx.fillStyle = hMask;
        rainbowCtx.fillRect(0, 0, width, height);

        const vMask = rainbowCtx.createLinearGradient(0, 0, 0, Math.min(height, arcCy + 10));
        vMask.addColorStop(0.0, 'rgba(255, 255, 255, 1)');
        vMask.addColorStop(0.55, 'rgba(255, 255, 255, 0.92)');
        vMask.addColorStop(0.78, 'rgba(255, 255, 255, 0.34)');
        vMask.addColorStop(0.98, 'rgba(255, 255, 255, 0)');
        rainbowCtx.fillStyle = vMask;
        rainbowCtx.fillRect(0, 0, width, height);
        rainbowCtx.restore();

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.globalAlpha = Math.min(1, rbW);
        ctx.drawImage(rainbowCanvas, 0, 0, width, height);
        ctx.restore();
      }

      // 6. 2D Fallback Volumetric Clouds (handled in GPU shader & cpuSkyRenderer)
      const cloudVis = Math.max(weights.clouds, stormFactor * 0.72);
      if (!skyRenderer && !cpuSkyRenderer && cloudVis > 0.02) {
        const cloudColor: Rgb =
          tod === 'night'
            ? lerpRgb([36, 48, 76], [22, 28, 44], stormFactor)
            : tod === 'dusk'
              ? lerpRgb([224, 174, 178], [76, 78, 98], stormFactor)
              : lerpRgb([244, 248, 255], [96, 114, 136], stormFactor);

        for (const c of clouds) {
          c.x += c.speed * (1 + weights['wind-petals'] * 1.4) * dt;
          if (c.x > 1.28) c.x = -0.28;
          const cx = c.x * width + (pointerSmooth.x - 0.5) * (14 + c.layer * 18);
          const cy = c.y * height + (pointerSmooth.y - 0.5) * (8 + c.layer * 8);
          const cAlpha = (0.28 + c.layer * 0.14) * cloudVis;

          for (const p of c.puffs) {
            const px = cx + p.dx * c.scale;
            const py = cy + p.dy * c.scale;
            const pr = p.r * c.scale;
            const cg = ctx.createRadialGradient(px, py - pr * 0.2, pr * 0.1, px, py, pr);
            cg.addColorStop(0, rgbStr(cloudColor, cAlpha));
            cg.addColorStop(0.58, rgbStr(cloudColor, cAlpha * 0.55));
            cg.addColorStop(1, rgbStr(cloudColor, 0));
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // 7. Physical Fractal Lightning, Stepped-Leader & Storm-Cloud Sheet Flashes
      let lightningAmbientBoost = 0;
      if (weights.thunder > 0.05) {
        if (!lightningBolt && !reducedMotion) {
          nextLightningIn -= dt * (0.72 + intensityScale * 0.42);
          if (nextLightningIn <= 0) {
            const isSheet = Math.random() < 0.28;
            const sx = width * (0.14 + Math.random() * 0.72);
            const sy = height * (0.04 + Math.random() * 0.14);
            const segs: LightningSegment[] = [];
            if (!isSheet) {
              const ex = sx + (Math.random() - 0.5) * Math.min(260, width * 0.24);
              const ey = height * (0.58 + Math.random() * 0.34);
              generateLightningBranch(sx, sy, ex, ey, 115, 1.85, 0, 6, 0, 1, segs);
            }
            const hasRestrike = !isSheet && Math.random() < 0.65;
            lightningBolt = {
              kind: isSheet ? 'sheet' : 'forked',
              segments: segs,
              age: 0,
              duration: isSheet ? 0.38 : hasRestrike ? 0.54 : 0.40,
              hasRestrike,
              flashX: sx,
              flashY: sy + 36,
              lobeX: sx + (Math.random() - 0.5) * 190,
              lobeY: sy + 20 + Math.random() * 75,
            };
            nextLightningIn = 1.7 + Math.random() * 4.0;
          }
        }

        if (lightningBolt) {
          lightningBolt.age += dt;
          const age = lightningBolt.age;
          const dur = lightningBolt.duration;
          if (age >= dur) {
            lightningBolt = null;
          } else {
            const leaderDur = 0.065;
            const leaderHead = lightningBolt.kind === 'forked' ? Math.min(1, age / leaderDur) : 1;

            // Physical strike intensity envelope: Stepped leader -> Return stroke -> Dart re-strike -> Plasma afterglow
            let mainAlpha = 0;
            let branchAlpha = 0;
            if (lightningBolt.kind === 'sheet') {
              const p = age / dur;
              const doublePulse =
                Math.sin(Math.min(1, p / 0.38) * Math.PI) * 0.85 +
                (p > 0.32 ? Math.sin(Math.min(1, (p - 0.32) / 0.52) * Math.PI) * 0.62 : 0);
              mainAlpha = Math.min(1, doublePulse);
              branchAlpha = mainAlpha;
            } else if (age < leaderDur) {
              mainAlpha = 0.44 + 0.14 * (age / leaderDur);
              branchAlpha = mainAlpha * 0.78;
            } else if (age < 0.18) {
              const decay = Math.exp(-(age - leaderDur) * 18.0);
              mainAlpha = 0.22 + 0.78 * decay;
              branchAlpha = 0.14 + 0.82 * decay;
            } else if (lightningBolt.hasRestrike && age >= 0.21 && age < 0.34) {
              const rt = (age - 0.21) / 0.13;
              const surge = Math.sin(Math.min(1, rt * 2.4) * Math.PI * 0.5) * Math.exp(-rt * 2.6);
              mainAlpha = 0.14 + 0.76 * surge;
              branchAlpha = 0.08 + 0.26 * surge; // Main plasma channel stays superheated while twigs cool
            } else {
              const tailT = Math.max(0, (age - 0.18) / Math.max(0.05, dur - 0.18));
              const afterglow = Math.pow(1 - tailT, 2.2) * 0.26;
              mainAlpha = afterglow;
              branchAlpha = afterglow * 0.45;
            }

            mainAlpha = Math.min(1, mainAlpha * weights.thunder);
            branchAlpha = Math.min(1, branchAlpha * weights.thunder);

            if (mainAlpha > 0.015) {
              lightningAmbientBoost = Math.max(lightningAmbientBoost, mainAlpha);
              ctx.save();
              ctx.globalCompositeOperation = 'screen';

              // Subtle whole-sky ambient electric flash during return stroke & sheet pulses
              const skyFlash = mainAlpha * (lightningBolt.kind === 'sheet' ? 0.14 : 0.09);
              ctx.fillStyle = `rgba(176, 204, 255, ${skyFlash.toFixed(3)})`;
              ctx.fillRect(0, 0, width, height);

              // Dual-lobe volumetric storm-cloud internal scattering bloom
              const primaryBloom = ctx.createRadialGradient(
                lightningBolt.flashX,
                lightningBolt.flashY,
                8,
                lightningBolt.flashX,
                lightningBolt.flashY,
                width * 0.42,
              );
              primaryBloom.addColorStop(0, `rgba(232, 242, 255, ${(mainAlpha * 0.44).toFixed(3)})`);
              primaryBloom.addColorStop(0.28, `rgba(156, 178, 255, ${(mainAlpha * 0.20).toFixed(3)})`);
              primaryBloom.addColorStop(1, 'rgba(130, 148, 248, 0)');
              ctx.fillStyle = primaryBloom;
              ctx.fillRect(0, 0, width, height);

              const secondaryBloom = ctx.createRadialGradient(
                lightningBolt.lobeX,
                lightningBolt.lobeY,
                12,
                lightningBolt.lobeX,
                lightningBolt.lobeY,
                width * 0.34,
              );
              secondaryBloom.addColorStop(0, `rgba(196, 214, 255, ${(mainAlpha * 0.28).toFixed(3)})`);
              secondaryBloom.addColorStop(0.55, `rgba(139, 152, 248, ${(mainAlpha * 0.10).toFixed(3)})`);
              secondaryBloom.addColorStop(1, 'rgba(139, 152, 248, 0)');
              ctx.fillStyle = secondaryBloom;
              ctx.fillRect(0, 0, width, height);

              if (lightningBolt.kind === 'forked') {
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                const visibleSegs = lightningBolt.segments.filter((s) => s.progress <= leaderHead);

                // Pass 1: Wide atmospheric ionization halo
                for (const seg of visibleSegs) {
                  const sAlpha = seg.order === 0 ? mainAlpha : seg.order === 1 ? branchAlpha : branchAlpha * 0.55;
                  if (sAlpha <= 0.01) continue;
                  ctx.strokeStyle = `rgba(142, 178, 255, ${(sAlpha * 0.11).toFixed(3)})`;
                  ctx.lineWidth = seg.width * 14.0;
                  ctx.beginPath();
                  ctx.moveTo(seg.x1, seg.y1);
                  ctx.lineTo(seg.x2, seg.y2);
                  ctx.stroke();
                }

                // Pass 2: Soft violet-blue Corona envelope
                for (const seg of visibleSegs) {
                  const sAlpha = seg.order === 0 ? mainAlpha : seg.order === 1 ? branchAlpha : branchAlpha * 0.6;
                  if (sAlpha <= 0.01) continue;
                  ctx.strokeStyle = `rgba(168, 198, 255, ${(sAlpha * 0.26).toFixed(3)})`;
                  ctx.lineWidth = seg.width * 5.2;
                  ctx.beginPath();
                  ctx.moveTo(seg.x1, seg.y1);
                  ctx.lineTo(seg.x2, seg.y2);
                  ctx.stroke();
                }

                // Pass 3: Cyan-white ionized plasma sheath
                for (const seg of visibleSegs) {
                  const sAlpha = seg.order === 0 ? mainAlpha : seg.order === 1 ? branchAlpha : branchAlpha * 0.7;
                  if (sAlpha <= 0.01) continue;
                  ctx.strokeStyle = `rgba(218, 238, 255, ${(sAlpha * 0.62).toFixed(3)})`;
                  ctx.lineWidth = seg.width * 2.1;
                  ctx.beginPath();
                  ctx.moveTo(seg.x1, seg.y1);
                  ctx.lineTo(seg.x2, seg.y2);
                  ctx.stroke();
                }

                // Pass 4: Razor-sharp pure incandescent white core
                for (const seg of visibleSegs) {
                  const sAlpha = seg.order === 0 ? mainAlpha : seg.order === 1 ? branchAlpha : branchAlpha * 0.78;
                  if (sAlpha <= 0.01) continue;
                  ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, sAlpha * 0.98).toFixed(3)})`;
                  ctx.lineWidth = Math.max(0.55, seg.width);
                  ctx.beginPath();
                  ctx.moveTo(seg.x1, seg.y1);
                  ctx.lineTo(seg.x2, seg.y2);
                  ctx.stroke();
                }
              }

              ctx.restore();
            }
          }
        }
      } else {
        lightningBolt = null;
      }

      // 8. Drifting Mist & Fog Banks
      if (weights.fog > 0.02) {
        const fW = weights.fog;
        const fogTint: Rgb = tod === 'night' ? [148, 172, 206] : tod === 'dusk' ? [226, 196, 210] : [228, 238, 248];
        for (const f of fogBanks) {
          f.x += f.speed * dt;
          if (f.x > 1.35) f.x = -0.35;
          if (f.x < -0.35) f.x = 1.35;
          const fx = f.x * width;
          const fy = f.y * height + Math.sin(elapsed * 0.35 + f.phase) * 18;
          const rx = f.rx * width;
          const ry = f.ry * height;

          ctx.save();
          ctx.translate(fx, fy);
          ctx.scale(1, ry / Math.max(1, rx));
          const fg = ctx.createRadialGradient(0, 0, rx * 0.08, 0, 0, rx);
          fg.addColorStop(0, rgbStr(fogTint, f.alpha * fW));
          fg.addColorStop(0.55, rgbStr(fogTint, f.alpha * 0.48 * fW));
          fg.addColorStop(1, rgbStr(fogTint, 0));
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.arc(0, 0, rx, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // 9. 3-Depth Motion-Blurred Rain Streaks & Splashes (glass drops rendered in Step 12 WebGL2)
      const streakOpacity = Math.max(0, Math.min(1, cur.rainStreakOpacity ?? 0.55));
      if (weights.rain > 0.02 && streakOpacity > 0.005) {
        const rW = weights.rain * streakOpacity;
        const baseTilt = 0.13 + weights['wind-petals'] * 0.22 + (pointerSmooth.x - 0.5) * 0.15;
        const activeDrops = Math.floor(
          rainDrops.length * Math.min(1.15, weights.rain * intensityScale * prof.particleScale),
        );

        const sunGlow = weights['clear-sun'] * (tod === 'night' ? 0 : tod === 'dusk' ? 0.9 : 0.75);
        const baseStreakColor: Rgb =
          tod === 'night'
            ? [176, 206, 242]
            : tod === 'dusk'
              ? lerpRgb([214, 224, 240], [255, 222, 186], sunGlow)
              : lerpRgb([216, 232, 248], [248, 251, 255], sunGlow);
        const streakColor =
          lightningAmbientBoost > 0.02
            ? lerpRgb(baseStreakColor, [226, 240, 255], lightningAmbientBoost * 0.85)
            : baseStreakColor;
        const streakBoost = 1 + lightningAmbientBoost * 0.65;

        ctx.save();
        ctx.lineCap = 'round';
        for (let i = 0; i < activeDrops; i++) {
          const d = rainDrops[i];
          const gust = Math.sin(elapsed * 0.75 + d.x * 3.4) * 0.045;
          const tilt = baseTilt + gust + d.jitter;
          d.y += (d.speed * dt) / Math.max(1, height);
          d.x += (d.speed * tilt * dt) / Math.max(1, width);

          if (d.y > 1.04) {
            if (d.tier >= 1 && Math.random() < 0.11 && splashes.length < 24) {
              splashes.push({
                x: d.x * width,
                y: height * (0.945 + Math.random() * 0.045),
                age: 0,
                life: 0.34 + Math.random() * 0.2,
                maxR: 5 + d.depth * 8,
                sprays: [
                  { dx: -4 - Math.random() * 5, dy: -(5 + Math.random() * 6) },
                  { dx: 4 + Math.random() * 5, dy: -(5 + Math.random() * 6) },
                ],
              });
            }
            d.y = -0.06 - Math.random() * 0.12;
            d.x = Math.random() * 1.28 - 0.14;
          }

          const squall = 0.58 + 0.42 * Math.sin(d.x * 5.2 - elapsed * 0.9 + d.tier * 1.1);
          const alpha = Math.min(0.95, d.alpha * rW * squall * streakBoost);
          if (alpha <= 0.01) continue;

          const px = d.x * width;
          const py = d.y * height;
          const tx = px - d.len * tilt;
          const ty = py - d.len;

          // Motion-blurred tapered streak: faint mist tail -> luminous falling droplet head
          const sg = ctx.createLinearGradient(tx, ty, px, py);
          sg.addColorStop(0.0, rgbStr(streakColor, 0));
          sg.addColorStop(0.68, rgbStr(streakColor, alpha * 0.42));
          sg.addColorStop(0.9, rgbStr(streakColor, alpha));
          sg.addColorStop(1.0, rgbStr(streakColor, alpha * 0.15));

          if (d.tier === 2) {
            ctx.strokeStyle = sg;
            ctx.lineWidth = 2.4;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(px, py);
            ctx.stroke();

            ctx.strokeStyle = rgbStr(streakColor, alpha * 0.55);
            ctx.lineWidth = 0.75;
            ctx.beginPath();
            ctx.moveTo(tx * 0.35 + px * 0.65, ty * 0.35 + py * 0.65);
            ctx.lineTo(px, py);
            ctx.stroke();
          } else {
            ctx.strokeStyle = sg;
            ctx.lineWidth = d.tier === 0 ? 0.65 : 1.05;
            ctx.beginPath();
            ctx.moveTo(tx, ty);
            ctx.lineTo(px, py);
            ctx.stroke();
          }
        }

        // Bottom Splash Ripples & Micro-Spray
        for (let i = splashes.length - 1; i >= 0; i--) {
          const sp = splashes[i];
          sp.age += dt;
          if (sp.age >= sp.life) {
            splashes.splice(i, 1);
            continue;
          }
          const t = sp.age / sp.life;
          const fade = (1 - t) * Math.min(1, rW * 1.2);
          const rad = sp.maxR * t;
          ctx.strokeStyle = rgbStr(streakColor, 0.32 * fade);
          ctx.lineWidth = 0.9;
          ctx.beginPath();
          ctx.ellipse(sp.x, sp.y, rad, rad * 0.3, 0, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = rgbStr(streakColor, 0.48 * fade);
          for (const s of sp.sprays) {
            const sx = sp.x + s.dx * t;
            const sy = sp.y + s.dy * (t - t * t * 0.8);
            ctx.beginPath();
            ctx.arc(sx, sy, 0.85, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        ctx.restore();
      } else {
        splashes.length = 0;
      }

      // 10. Multi-Layer Branched Dendritic Snowflakes & Depth-of-Field Bokeh Flurries
      if (weights.snow > 0.02) {
        const sW = weights.snow;
        const activeSnow = Math.floor(
          snowflakes.length * Math.min(1.15, sW * intensityScale * prof.particleScale),
        );
        const globalWind = 16 * weights['wind-petals'] + (pointerSmooth.x - 0.5) * 38;

        ctx.save();
        for (let i = 0; i < activeSnow; i++) {
          const sf = snowflakes[i];
          const eddy =
            Math.sin(sf.x * 3.2 + sf.y * 1.9 + elapsed * 0.65) * 26 +
            Math.cos(elapsed * 1.1 + sf.phase) * 14;
          sf.y += (sf.vy * dt) / Math.max(1, height);
          sf.x += ((sf.vxBias + globalWind + eddy) * dt) / Math.max(1, width);
          sf.rot += sf.rotSpeed * dt;
          sf.tumblePhase += sf.tumbleSpeed * dt;

          if (sf.y > 1.06) {
            sf.y = -0.05;
            sf.x = Math.random();
          }
          if (sf.x > 1.06) sf.x = -0.05;
          if (sf.x < -0.06) sf.x = 1.05;

          const sx = sf.x * width;
          const sy = sf.y * height;
          const todMod = tod === 'night' ? 0.85 : tod === 'dusk' ? 0.92 : 1.0;
          const thunderLit = 1 + lightningAmbientBoost * 0.45;
          const sa = Math.min(1, sf.alpha * sW * todMod * thunderLit);

          if (sf.kind === 'dust') {
            ctx.globalAlpha = sa;
            ctx.fillStyle = tod === 'dusk' ? '#fef2f2' : '#f0f9ff';
            ctx.beginPath();
            ctx.arc(sx, sy, sf.r, 0, Math.PI * 2);
            ctx.fill();
          } else if (sf.kind === 'dendrite') {
            const tumbleY = 0.55 + 0.45 * Math.cos(sf.tumblePhase);
            const glint = 0.84 + 0.16 * Math.abs(Math.sin(elapsed * 1.8 + sf.glintPhase));
            const drawSize = sf.r * 2.2;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(sf.rot);
            ctx.scale(1, tumbleY);
            ctx.globalAlpha = Math.min(1, sa * glint);
            ctx.drawImage(dendriteSprites[sf.variant], -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
            ctx.restore();
          } else {
            const drawSize = sf.r * 2.3;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(sf.rot * 0.5);
            ctx.globalAlpha = sa;
            ctx.drawImage(bokehFlakeSprites[sf.variant % 3], -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
            ctx.restore();
          }
        }
        ctx.restore();
      }

      // 11. Subtle Organic Airflow Wisps & 3D Aerodynamic Botanical Sakura Petals
      if (weights['wind-petals'] > 0.02) {
        const wW = weights['wind-petals'];
        ctx.save();

        // Delicate, soft-curved airflow wisps (never rigid horizontal sine waves)
        ctx.lineCap = 'round';
        for (let r = 0; r < 4; r++) {
          const cycle = ((elapsed * (0.11 + r * 0.025) + r * 0.27) % 1.45) - 0.22;
          const x0 = cycle * width;
          const y0 = height * (0.20 + r * 0.18);
          const span = 190 + (r % 2) * 70;
          const x1 = x0 + span;
          const y1 = y0 + 24 + Math.sin(elapsed * 0.9 + r) * 14;
          const cx1 = x0 + span * 0.34;
          const cy1 = y0 - 18 + Math.cos(elapsed * 1.1 + r * 1.7) * 16;
          const cx2 = x0 + span * 0.68;
          const cy2 = y1 + 16 + Math.sin(elapsed * 1.2 + r * 2.1) * 14;

          const rg = ctx.createLinearGradient(x0, y0, x1, y1);
          const wispAlpha = (0.045 + (r % 2) * 0.025) * wW;
          rg.addColorStop(0, 'rgba(224, 242, 254, 0)');
          rg.addColorStop(0.45, `rgba(224, 242, 254, ${wispAlpha.toFixed(3)})`);
          rg.addColorStop(1, 'rgba(224, 242, 254, 0)');
          ctx.strokeStyle = rg;
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.bezierCurveTo(cx1, cy1, cx2, cy2, x1, y1);
          ctx.stroke();
        }

        // Botanical sakura petals with V-notch, veins & 3D aerodynamic fluttering
        const activePetals = Math.floor(
          petals.length * Math.min(1.15, wW * intensityScale * prof.particleScale),
        );
        for (let i = 0; i < activePetals; i++) {
          const p = petals[i];
          const cursorDx = p.x - pointerSmooth.x;
          const cursorDy = p.y - pointerSmooth.y;
          const distSq = cursorDx * cursorDx + cursorDy * cursorDy;
          const vortex = distSq < 0.036 ? (0.036 - distSq) * 16 : 0;

          p.glidePhase += p.glideFreq * dt;
          p.roll += p.vRoll * dt;
          p.pitch += p.vPitch * dt;
          p.yaw += p.vYaw * dt;

          // Aerodynamic gliding: slow descent when flat, dip when edge-on, gentle lateral flutter
          const flatLift = Math.abs(Math.cos(p.pitch));
          const vxEff = p.vx + Math.sin(p.glidePhase) * 22 + pointer.vx * 420 * p.depth + vortex * (cursorDx >= 0 ? 18 : -18);
          const vyEff = p.vy * (0.55 + 0.7 * (1 - flatLift)) + Math.cos(p.glidePhase * 1.3) * 10;

          p.x += (vxEff * dt) / Math.max(1, width);
          p.y += (vyEff * dt) / Math.max(1, height);

          if (p.x > 1.07) p.x = -0.06;
          if (p.x < -0.07) p.x = 1.06;
          if (p.y > 1.07) {
            p.y = -0.06;
            p.x = Math.random();
          }

          const px = p.x * width;
          const py = p.y * height;
          const scaleX = 0.55 + 0.45 * Math.cos(p.yaw);
          const scaleY = 0.25 + 0.75 * flatLift;
          const lightContrast = 0.72 + 0.28 * flatLift;
          const todAlpha = tod === 'night' ? 0.62 : tod === 'dusk' ? 0.88 : 0.94;
          const sprite = p.blurred ? sakuraBokehSprites[p.variant] : sakuraSprites[p.variant];
          const drawSize = p.size * 2.2;

          ctx.save();
          ctx.translate(px, py);
          ctx.rotate(p.roll);
          ctx.scale(scaleX, scaleY);
          ctx.globalAlpha = Math.min(1, wW * todAlpha * lightContrast * (p.blurred ? 0.8 : 1));
          ctx.drawImage(sprite, -drawSize * 0.5, -drawSize * 0.5, drawSize, drawSize);
          ctx.restore();
        }
        ctx.restore();
      }

      // 12. Refractive Rain-on-Glass Post-Process (WebGL2 in GPU mode, real optical dome refraction in CPU mode)
      if (rainGlCanvas && rainRenderer) {
        if (weights.rain > 0.015) {
          rainGlCanvas.style.opacity = '1';
          rainRenderer.render(
            canvas,
            elapsed,
            weights.rain,
            intensityScale,
          );
        } else {
          rainGlCanvas.style.opacity = '0';
        }
      } else if (cpuRainRenderer && weights.rain > 0.02) {
        cpuRainRenderer.render(
          ctx,
          canvas,
          width,
          height,
          dt,
          elapsed,
          weights.rain,
          intensityScale,
          cur.quality,
        );
      }
    };

    rafId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      ro?.disconnect();
      skyGlCanvas?.removeEventListener('webglcontextlost', handleContextLost);
      rainGlCanvas?.removeEventListener('webglcontextlost', handleContextLost);
      resizeHandlerRef.current = null;
      rainRenderer?.dispose();
      skyRenderer?.dispose();
      cpuSkyRenderer?.dispose();
      cpuRainRenderer?.dispose();
    };
  }, [activeBackend]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {activeBackend === 'gpu' && (
        <canvas
          ref={rainGlCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            display: 'block',
            opacity: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: '#000000',
          opacity: Math.max(0, Math.min(1, darkMaskOpacity)),
          pointerEvents: 'none',
          transition: 'opacity 120ms ease',
        }}
      />
    </div>
  );
};
