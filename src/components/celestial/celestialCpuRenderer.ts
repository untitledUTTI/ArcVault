import type { CelestialSettings } from '../../types/archive';
import { clamp01, fbmLut } from '../../core/cpuNoiseLut';
import { getRenderQualityProfile } from '../../core/renderEngine';
import { resolveMoodIndex } from './celestialShaders';

export interface CelestialCpuRenderParams {
  width: number;
  height: number;
  timeSec: number;
  mouseX: number; // 0..1, bottom-up GL convention
  mouseY: number; // 0..1, bottom-up GL convention
  settings: CelestialSettings;
}

export interface CelestialCpuRenderer {
  render: (ctx: CanvasRenderingContext2D, params: CelestialCpuRenderParams) => void;
  dispose: () => void;
}

interface CpuStar {
  x: number;
  y: number; // screen top-down [0..0.76]
  r: number;
  phase: number;
  speed: number;
  tint: string;
}

interface DiamondParticle {
  seedX: number;
  seedY: number; // bottom-up [0..1] matching GLSL
  depth: number;
  phase: number;
  variant: 0 | 1 | 2 | 3;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function writeSpectrumColor(t: number, out: Float32Array): void {
  const c = clamp01(t);
  if (c < 0.5) {
    const k = c * 2;
    out[0] = mix(0.98, 0.95, k);
    out[1] = mix(0.52, 0.88, k);
    out[2] = mix(0.45, 0.68, k);
  } else {
    const k = (c - 0.5) * 2;
    out[0] = mix(0.95, 0.50, k);
    out[1] = mix(0.88, 0.82, k);
    out[2] = mix(0.68, 1.00, k);
  }
}

const SCRATCH_SPEC = new Float32Array(3);

export interface CelestialPixelInput {
  uvX: number; // 0..1 left -> right
  uvY: number; // 0..1 bottom -> top (GL convention)
  aspect: number;
  mouseX: number;
  mouseY: number;
  timeSec: number;
  moodIdx: number;
  octaves?: number;
}

/**
 * Software fragment shader matching celestialShaders.ts SKY_FRAGMENT_SHADER.
 * Writes [r, g, b] in 0..255 into outRgb[0..2] with zero per-pixel heap allocations.
 */
export function evaluateCelestialSkyPixel(
  input: CelestialPixelInput,
  outRgb: Float32Array,
): void {
  const {
    uvX,
    uvY,
    aspect,
    mouseX,
    mouseY,
    timeSec,
    moodIdx,
    octaves = 3,
  } = input;

  const parX = (mouseX - 0.5) * 0.045;
  const parY = (mouseY - 0.5) * 0.045;
  const px = (uvX - 0.5) * aspect;
  const py = uvY - 0.5;

  // 1. Sky base palette by atmospheric mood
  let zenR: number;
  let zenG: number;
  let zenB: number;
  let midR: number;
  let midG: number;
  let midB: number;
  let venR: number;
  let venG: number;
  let venB: number;
  let horR: number;
  let horG: number;
  let horB: number;
  let rayStrength: number;

  if (moodIdx === 1) {
    // Parhelion Night
    zenR = 0.015;
    zenG = 0.028;
    zenB = 0.085;
    midR = 0.045;
    midG = 0.085;
    midB = 0.21;
    venR = 0.32;
    venG = 0.28;
    venB = 0.55;
    horR = 0.025;
    horG = 0.04;
    horB = 0.11;
    rayStrength = 0.34;
  } else if (moodIdx === 2) {
    // Dawn Rays
    zenR = 0.035;
    zenG = 0.065;
    zenB = 0.18;
    midR = 0.14;
    midG = 0.20;
    midB = 0.38;
    venR = 0.86;
    venG = 0.48;
    venB = 0.56;
    horR = 0.08;
    horG = 0.09;
    horB = 0.18;
    rayStrength = 0.58;
  } else {
    // Belt of Venus Dusk
    zenR = 0.022;
    zenG = 0.036;
    zenB = 0.115;
    midR = 0.105;
    midG = 0.135;
    midB = 0.30;
    venR = 0.78;
    venG = 0.41;
    venB = 0.56;
    horR = 0.035;
    horG = 0.048;
    horB = 0.13;
    rayStrength = 0.46;
  }

  // Belt of Venus arch + Earth's Shadow
  const archDelta = uvX - 0.5 - parX * 0.8;
  const archCurve = 0.24 - 0.12 * archDelta * archDelta;
  const bandDist = (uvY - archCurve) / 0.14;
  const venusBand = Math.exp(-(bandDist * bandDist));
  const earthShadow = smoothstep(archCurve + 0.04, archCurve - 0.18, uvY);

  const skyT = smoothstep(0.28, 0.94, uvY);
  let r = mix(midR, zenR, skyT);
  let g = mix(midG, zenG, skyT);
  let b = mix(midB, zenB, skyT);

  const venBlend = venusBand * 0.72;
  r = mix(r, venR, venBlend);
  g = mix(g, venG, venBlend);
  b = mix(b, venB, venBlend);

  const esBlend = earthShadow * 0.85;
  r = mix(r, horR, esBlend);
  g = mix(g, horG, esBlend);
  b = mix(b, horB, esBlend);

  // Subtle atmospheric cirrus cloud veil
  const cirrusMask = smoothstep(0.05, 0.65, uvY);
  if (cirrusMask > 0.01) {
    const cloud = fbmLut(uvX * 3.2 + timeSec * 0.008 + parX * 0.5, uvY * 5.0 + parY * 0.5, octaves);
    const addC = cloud * 0.06 * cirrusMask;
    r += venR * addC;
    g += venG * addC;
    b += venB * addC;
  }

  // 2. Seamless Twilight Crepuscular God-Rays (zero atan seam, zero spinning)
  const sunPosX = 0.5 + parX * 1.4;
  const sunPosY = 0.26 + parY * 0.7;
  const toSunX = (uvX - sunPosX) * aspect;
  const toSunY = uvY - sunPosY;
  const sunDist = Math.hypot(toSunX, toSunY);
  const radialFade = Math.exp(-sunDist * 1.55) * smoothstep(0.035, 0.36, sunDist);

  if (radialFade > 0.003) {
    const invD = 1 / Math.max(sunDist, 0.0001);
    const rDirX = toSunX * invD;
    const rDirY = toSunY * invD;
    const skyDomeMask = smoothstep(-0.10, 0.36, rDirY);
    const driftX = timeSec * 0.014;
    const driftY = timeSec * 0.004;
    const broadRays = fbmLut(rDirX * 2.4 + driftX, rDirY * 2.4 + driftY, octaves);
    const fineRays = fbmLut(
      rDirX * 5.2 - driftX * 0.65 + 4.2,
      rDirY * 5.2 - driftY * 0.65 + 1.9,
      octaves,
    );
    const rayMix = broadRays * 0.62 + fineRays * 0.38;
    const rayPattern = Math.pow(clamp01((rayMix - 0.34) / 0.56), 1.75);
    const rayIntensity = rayPattern * radialFade * skyDomeMask * rayStrength * 0.42;
    const coolShift = clamp01(0.28 + rDirY * 0.45 + sunDist * 0.35);
    const rayR = mix(venR, 0.68, coolShift);
    const rayG = mix(venG, 0.85, coolShift);
    const rayB = mix(venB, 1.0, coolShift);
    r += rayR * rayIntensity;
    g += rayG * rayIntensity;
    b += rayB * rayIntensity;
  }

  // 3. 22-degree Ice Halo + Twin Chromatic Parhelia + Circumzenithal Arc
  const optX = 0.5 + parX * 1.1;
  const optY = 0.44 + parY * 0.7;
  const dOptX = (uvX - optX) * aspect;
  const dOptY = uvY - optY;
  const rOpt = Math.hypot(dOptX, dOptY);
  const haloRadius = 0.33;

  const haloDelta = (rOpt - haloRadius) / 0.022;
  if (Math.abs(haloDelta) < 3.0) {
    const haloMask = Math.exp(-(haloDelta * haloDelta)) * 0.15;
    writeSpectrumColor((rOpt - (haloRadius - 0.03)) / 0.06, SCRATCH_SPEC);
    r += SCRATCH_SPEC[0] * haloMask;
    g += SCRATCH_SPEC[1] * haloMask;
    b += SCRATCH_SPEC[2] * haloMask;
  }

  // Left & Right Parhelia (Sundogs)
  for (let side = -1; side <= 1; side += 2) {
    const dogX = optX + (side * haloRadius * 1.02) / aspect;
    const ddx = (uvX - dogX) * aspect;
    const ddy = dOptY;
    const sx = ddx * 1.1;
    const sy = ddy * 2.3;
    const d2 = (sx * sx + sy * sy) * 160.0;
    if (d2 < 8.0) {
      const dogGlow = Math.exp(-d2) * 0.45;
      writeSpectrumColor(0.5 + ddx * side * 14.0, SCRATCH_SPEC);
      r += SCRATCH_SPEC[0] * dogGlow;
      g += SCRATCH_SPEC[1] * dogGlow;
      b += SCRATCH_SPEC[2] * dogGlow;
    }
  }

  // Circumzenithal Arc ("穹")
  if (uvY > optY + 0.16) {
    const czaCenterY = optY + 0.54;
    const czaDist = Math.hypot(dOptX, uvY - czaCenterY);
    const czaDelta = (czaDist - 0.31) / 0.016;
    if (Math.abs(czaDelta) < 3.0) {
      const czaMask =
        Math.exp(-(czaDelta * czaDelta)) *
        smoothstep(optY + 0.16, optY + 0.32, uvY) *
        0.24;
      const czaSpec = clamp01((czaDist - 0.29) / 0.04);
      writeSpectrumColor(1.0 - czaSpec, SCRATCH_SPEC);
      r += SCRATCH_SPEC[0] * czaMask;
      g += SCRATCH_SPEC[1] * czaMask;
      b += SCRATCH_SPEC[2] * czaMask;
    }
  }

  // Subtle cursor ice-diffraction shimmer
  const mdx = (uvX - mouseX) * aspect;
  const mdy = uvY - mouseY;
  const mDist = Math.hypot(mdx, mdy);
  if (mDist < 0.7) {
    const mGlow = Math.exp(-mDist * 7.5) * 0.08;
    r += 0.52 * mGlow;
    g += 0.78 * mGlow;
    b += 1.0 * mGlow;
  }

  // Soft vignette
  const vp2 = (px * 0.52) * (px * 0.52) + (py * 0.52) * (py * 0.52);
  const vig = Math.max(0.72, Math.min(1.02, 1.0 - vp2));

  outRgb[0] = clamp01(r * vig) * 255;
  outRgb[1] = clamp01(g * vig) * 255;
  outRgb[2] = clamp01(b * vig) * 255;
}

function createDiamondSpriteAtlas(): HTMLCanvasElement[] {
  return ([0, 1, 2, 3] as const).map((variant) => {
    const size = 48;
    const c = document.createElement('canvas');
    c.width = size;
    c.height = size;
    const g = c.getContext('2d');
    if (!g) return c;

    const img = g.createImageData(size, size);
    const data = img.data;
    const mixAmt = variant / 3;
    const tintR = mix(0.75, 1.0, mixAmt) * 255;
    const tintG = mix(0.90, 0.80, mixAmt) * 255;
    const tintB = mix(1.00, 0.92, mixAmt) * 255;

    for (let y = 0; y < size; y++) {
      const cy = (y + 0.5) / size - 0.5;
      for (let x = 0; x < size; x++) {
        const cx = (x + 0.5) / size - 0.5;
        const ax = Math.abs(cx);
        const ay = Math.abs(cy);
        const star =
          Math.exp(-ax * 14.0) * Math.exp(-ay * 3.2) +
          Math.exp(-ay * 14.0) * Math.exp(-ax * 3.2);
        const core = smoothstep(0.32, 0.0, Math.hypot(cx, cy));
        const mask = clamp01(star * 0.75 + core * 0.85);
        const idx = (y * size + x) * 4;
        data[idx] = tintR;
        data[idx + 1] = tintG;
        data[idx + 2] = tintB;
        data[idx + 3] = mask * 255;
      }
    }
    g.putImageData(img, 0, 0);
    return c;
  });
}

export function createCelestialCpuRenderer(): CelestialCpuRenderer {
  const skyCanvas = document.createElement('canvas');
  const skyCtx = skyCanvas.getContext('2d');
  let imgData: ImageData | null = null;
  const pixelOut = new Float32Array(3);
  const diamondSprites = createDiamondSpriteAtlas();

  const stars: CpuStar[] = Array.from({ length: 140 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.75,
    r: 0.65 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
    speed: 1.3 + Math.random() * 2.5,
    tint: Math.random() < 0.22 ? '#fde68a' : Math.random() < 0.55 ? '#e0f2fe' : '#ffffff',
  }));

  const particles: DiamondParticle[] = Array.from({ length: 240 }, (_, i) => ({
    seedX: Math.random(),
    seedY: Math.random(),
    depth: Math.random(),
    phase: Math.random(),
    variant: (i % 4) as 0 | 1 | 2 | 3,
  }));

  const render = (ctx: CanvasRenderingContext2D, params: CelestialCpuRenderParams) => {
    const { width, height, timeSec, mouseX, mouseY, settings } = params;
    if (width <= 0 || height <= 0) return;

    const prof = getRenderQualityProfile(settings.quality);
    const aspect = width / Math.max(1, height);
    const moodIdx = resolveMoodIndex(settings.mood);

    // 1. Render software fragment shader into scaled offscreen buffer
    if (skyCtx) {
      const bufW = Math.max(96, Math.min(width, prof.cpuShaderMaxWidth));
      const bufH = Math.max(64, Math.round((bufW * height) / Math.max(1, width)));
      if (skyCanvas.width !== bufW || skyCanvas.height !== bufH || !imgData) {
        skyCanvas.width = bufW;
        skyCanvas.height = bufH;
        imgData = skyCtx.createImageData(bufW, bufH);
      }

      const data = imgData.data;
      const octaves = prof.cpuCloudOctaves;
      for (let py = 0; py < bufH; py++) {
        // Map top row py=0 -> uvY near 1 (GL bottom-up convention)
        const uvY = 1 - (py + 0.5) / bufH;
        const rowOffset = py * bufW * 4;
        for (let px = 0; px < bufW; px++) {
          const uvX = (px + 0.5) / bufW;
          evaluateCelestialSkyPixel(
            {
              uvX,
              uvY,
              aspect,
              mouseX,
              mouseY,
              timeSec,
              moodIdx,
              octaves,
            },
            pixelOut,
          );
          const idx = rowOffset + px * 4;
          data[idx] = pixelOut[0];
          data[idx + 1] = pixelOut[1];
          data[idx + 2] = pixelOut[2];
          data[idx + 3] = 255;
        }
      }
      skyCtx.putImageData(imgData, 0, 0);

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(skyCanvas, 0, 0, width, height);
      ctx.restore();
    }

    // 2. Crisp Native-DPR Twinkling Deep-Sky Starfield
    const starVis = moodIdx === 1 ? 1.0 : moodIdx === 2 ? 0.48 : 0.72;
    const parX = (mouseX - 0.5) * 0.045 * 0.3 * width;
    const parY = (mouseY - 0.5) * 0.045 * 0.3 * height;
    const activeStars = Math.round(stars.length * (0.45 + 0.55 * prof.particleScale));

    ctx.save();
    for (let i = 0; i < activeStars; i++) {
      const s = stars[i];
      const twinkle = 0.52 + 0.48 * Math.sin(timeSec * s.speed + s.phase);
      const skyMask = smoothstep(0.76, 0.28, s.y);
      const alpha = starVis * twinkle * skyMask * 0.85;
      if (alpha < 0.02) continue;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = s.tint;
      ctx.beginPath();
      ctx.arc((s.x * width + parX + width) % width, s.y * height - parY, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // 3. Crisp 4-Point Diamond Dust Crystal Sprites with Pointer Flow-Field Swirl
    const activeDust = Math.max(
      20,
      Math.min(particles.length, Math.round(140 * settings.particleDensity * prof.particleScale)),
    );

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < activeDust; i++) {
      const p = particles[i];
      const speed = 0.012 + p.depth * 0.022;
      let ux =
        ((p.seedX + timeSec * speed * 0.65 + Math.sin(timeSec * 0.35 + p.phase) * 0.015) % 1 + 1) %
        1;
      let uy = ((p.seedY - timeSec * speed * 0.42) % 1 + 1) % 1;

      const dx = ux - mouseX;
      const dy = uy - mouseY;
      const dist = Math.hypot(dx, dy);
      if (dist < 0.22 && dist > 0.001) {
        const push = 1 - dist / 0.22;
        ux += (dx / dist) * push * 0.045;
        uy += (dy / dist) * push * 0.045;
      }

      const glint = Math.pow(
        0.5 + 0.5 * Math.sin(timeSec * (2.2 + p.depth * 2.5) + p.phase * 6.283),
        4.0,
      );
      const proximityBoost = dist < 0.24 ? (1 - dist / 0.24) * 0.55 : 0;
      const alpha = Math.min(
        1,
        (0.18 + glint * 0.68 + proximityBoost) * (0.5 + p.depth * 0.5),
      );
      if (alpha < 0.03) continue;

      const ptSize = (5.0 + p.depth * 7.5 + glint * 4.5) * 1.45;
      const drawX = ux * width;
      const drawY = (1 - uy) * height;
      ctx.globalAlpha = alpha;
      ctx.drawImage(
        diamondSprites[p.variant],
        drawX - ptSize * 0.5,
        drawY - ptSize * 0.5,
        ptSize,
        ptSize,
      );
    }
    ctx.restore();
  };

  const dispose = () => {
    skyCanvas.width = 0;
    skyCanvas.height = 0;
    for (const spr of diamondSprites) {
      spr.width = 0;
      spr.height = 0;
    }
    imgData = null;
  };

  return { render, dispose };
}
