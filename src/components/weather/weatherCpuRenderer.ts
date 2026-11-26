import type { RenderQualityTier } from '../../types/archive';
import {
  acesToneMapChannel,
  clamp01,
  fbmLut,
  fbmNormLut,
  interleavedGradientNoise,
  mix,
  noise2dLut,
  smoothstep,
  triNoise2dCpu,
} from '../../core/cpuNoiseLut';
import { getRenderQualityProfile } from '../../core/renderEngine';

export interface WeatherCpuSkyParams {
  width: number;
  height: number;
  timeSec: number;
  mouseX: number; // 0..1 screen X
  mouseY: number; // 0..1 screen top->down Y (converted inside)
  sunWeight: number;
  auroraWeight: number;
  cloudWeight: number;
  stormWeight: number;
  rainbowWeight: number;
  dayFactor: number;
  duskFactor: number;
  nightFactor: number;
  intensity: number;
  quality: RenderQualityTier;
}

export interface WeatherCpuSkyRenderer {
  render: (ctx: CanvasRenderingContext2D, params: WeatherCpuSkyParams) => void;
  dispose: () => void;
}

export interface WeatherPixelInput {
  uvX: number; // 0..1 left -> right
  uvY: number; // 0..1 bottom -> top (GL convention)
  aspect: number;
  fragX: number;
  fragY: number;
  timeSec: number;
  mouseX: number; // 0..1
  mouseY: number; // 0..1 (GL bottom-up)
  sunWeight: number;
  auroraWeight: number;
  cloudWeight: number;
  stormWeight: number;
  rainbowWeight: number;
  dayFactor: number;
  duskFactor: number;
  nightFactor: number;
  intensity: number;
  cloudOctaves?: number;
  auroraSteps?: number;
}

const SCRATCH_SPEC = new Float32Array(3);

function miePhase(cosTheta: number, g: number): number {
  const g2 = g * g;
  return (1 - g2) / (12.56637 * Math.pow(Math.max(0.0005, 1 + g2 - 2 * g * cosTheta), 1.5));
}

function sampleCloudVeilCpu(
  px: number,
  py: number,
  t: number,
  cloudWeight: number,
  octaves: number,
): number {
  const qx = px * 1.55 + t * 0.018;
  const qy = py * 2.65 - t * 0.004;
  const warp = fbmLut(qx * 1.4 - t * 0.01, qy * 1.4, Math.max(2, octaves - 1));
  const n = fbmLut(qx + warp * 0.45, qy + warp * 0.45, octaves);
  const thresh = mix(0.58, 0.36, cloudWeight);
  return smoothstep(thresh, thresh + 0.28, n);
}

function sampleCloudDensityCpu(
  px: number,
  py: number,
  coverage: number,
  t: number,
  octaves: number,
): number {
  const macro = fbmNormLut(px * 0.55, py * 0.55, octaves);
  const billow = fbmNormLut(px * 1.55 + macro * 0.65, py * 1.55 - macro * 0.45, octaves);
  const detail = noise2dLut(px * 3.8 + t * 0.03, py * 3.8);
  const raw = macro * 0.62 + billow * 0.3 + detail * 0.08;
  const thresh = mix(0.68, 0.42, clamp01(coverage));
  return smoothstep(thresh, thresh + 0.16, raw);
}

function writeSpectralColor(t: number, out: Float32Array): void {
  const x = clamp01(t);
  const a1 = (x - 0.86) / 0.17;
  const a2 = (x - 0.62) / 0.16;
  const a3 = (x - 0.06) / 0.1;
  const r =
    Math.exp(-(a1 * a1)) * 0.98 +
    Math.exp(-(a2 * a2)) * 0.72 +
    Math.exp(-(a3 * a3)) * 0.42;

  const g1 = (x - 0.56) / 0.22;
  const g2 = (x - 0.32) / 0.14;
  const g = Math.exp(-(g1 * g1)) * 0.95 + Math.exp(-(g2 * g2)) * 0.36;

  const b1 = (x - 0.22) / 0.18;
  const b2 = (x - 0.06) / 0.1;
  const b = Math.exp(-(b1 * b1)) * 0.98 + Math.exp(-(b2 * b2)) * 0.62;

  out[0] = clamp01(r);
  out[1] = clamp01(g);
  out[2] = clamp01(b);
}

/**
 * Software fragment shader faithfully porting weatherSkyShader.ts:
 * Rayleigh sky gradients, Nimitz volumetric aurora, limb-darkened sun + Tyndall shafts,
 * 3-layer perspective clouds with Beer-Lambert self-shadowing, double rainbow + Alexander's
 * Dark Band, and ACES filmic tonemapping. Zero per-pixel heap allocations.
 */
export function evaluateWeatherSkyPixel(
  input: WeatherPixelInput,
  outRgb: Float32Array,
): void {
  const {
    uvX,
    uvY,
    aspect,
    fragX,
    fragY,
    timeSec,
    mouseX,
    mouseY,
    sunWeight,
    auroraWeight,
    cloudWeight,
    stormWeight,
    rainbowWeight,
    dayFactor,
    duskFactor,
    nightFactor,
    intensity,
    cloudOctaves = 3,
    auroraSteps = 14,
  } = input;

  const pX = (uvX - 0.5) * aspect;
  const pY = uvY - 0.5;
  const rdLen = Math.hypot(pX, pY, 1.32);
  const rdX = pX / rdLen;
  const rdY = pY / rdLen;
  const rdZ = 1.32 / rdLen;

  const dither = interleavedGradientNoise(fragX, fragY);
  const skyY = clamp01(uvY);
  const storm = clamp01(stormWeight);
  const inten = Math.max(0.35, Math.min(1.5, intensity));

  const sunPosX = mix(0.27, 0.23, duskFactor) * aspect + (mouseX - 0.5) * 0.06;
  const sunPosY = mix(0.28, 0.05, duskFactor) + (mouseY - 0.5) * 0.035;
  const sunLen = Math.hypot(sunPosX, sunPosY, 1.32);
  const sunDirX = sunPosX / sunLen;
  const sunDirY = sunPosY / sunLen;
  const sunDirZ = 1.32 / sunLen;
  const sunUvX = sunPosX / Math.max(0.001, aspect) + 0.5;
  const sunUvY = sunPosY + 0.5;
  const cosSun = rdX * sunDirX + rdY * sunDirY + rdZ * sunDirZ;

  // 1. Atmospheric Sky Base (Rayleigh gradient)
  const dayPow = Math.pow(skyY, 0.62);
  const dayR = mix(0.42, 0.04, dayPow);
  const dayG = mix(0.72, 0.24, dayPow);
  const dayB = mix(0.98, 0.64, dayPow);

  const duskPow = Math.pow(skyY, 0.58);
  const venusD = (skyY - 0.34) * 4.2;
  const venusGlow = Math.exp(-(venusD * venusD));
  const duskR = mix(0.88, 0.07, duskPow) + 0.26 * venusGlow;
  const duskG = mix(0.42, 0.10, duskPow) + 0.11 * venusGlow;
  const duskB = mix(0.28, 0.28, duskPow) + 0.22 * venusGlow;

  const nightPow = Math.pow(skyY, 0.65);
  const nightR = mix(0.045, 0.008, nightPow);
  const nightG = mix(0.09, 0.018, nightPow);
  const nightB = mix(0.20, 0.055, nightPow);

  let skyR = dayR * dayFactor + duskR * duskFactor + nightR * nightFactor;
  let skyG = dayG * dayFactor + duskG * duskFactor + nightG * nightFactor;
  let skyB = dayB * dayFactor + duskB * duskFactor + nightB * nightFactor;

  if (storm > 0.01) {
    const stR = mix(0.07, 0.025, nightFactor);
    const stG = mix(0.10, 0.036, nightFactor);
    const stB = mix(0.15, 0.062, nightFactor);
    const stMix = storm * 0.72;
    skyR = mix(skyR, stR, stMix);
    skyG = mix(skyG, stG, stMix);
    skyB = mix(skyB, stB, stMix);
  }

  // 2. Nimitz-style Volumetric Raymarched Aurora
  if (auroraWeight > 0.015 && rdY > -0.14) {
    let colR = 0;
    let colG = 0;
    let colB = 0;
    let avgR = 0;
    let avgG = 0;
    let avgB = 0;
    const roZ = -6.7 + timeSec * 0.02;
    const denom = rdY * 2.0 + 0.44;
    const stepScale = 24 / Math.max(8, auroraSteps);

    for (let i = 0; i < auroraSteps; i++) {
      const fi = i * stepScale + dither;
      const pt = (0.85 + Math.pow(fi, 1.38) * 0.0022) / denom;
      const bz = roZ + pt * rdZ;
      const bx = pt * rdX;
      const rzt = triNoise2dCpu(bz, bx, 0.065, timeSec);

      const bandR = (Math.sin(1.0 - 2.15 + fi * 0.048) * 0.5 + 0.5) * rzt;
      const bandG = (Math.sin(1.0 + 0.45 + fi * 0.048) * 0.5 + 0.5) * rzt;
      const bandB = (Math.sin(1.0 - 1.25 + fi * 0.048) * 0.5 + 0.5) * rzt;

      avgR = mix(avgR, bandR, 0.52);
      avgG = mix(avgG, bandG, 0.52);
      avgB = mix(avgB, bandB, 0.52);

      const fade =
        Math.exp((-fi * 0.068 - 2.35) * Math.LN2) * smoothstep(0.0, 4.8, fi) * stepScale;
      colR += avgR * fade;
      colG += avgG * fade;
      colB += avgB * fade;
    }

    const horizonFade = smoothstep(-0.08, 0.14, rdY);
    const aurScale =
      clamp01(rdY * 15.0 + 0.45) *
      1.85 *
      horizonFade *
      auroraWeight *
      mix(0.45, 1.25, clamp01(nightFactor + duskFactor * 0.5)) *
      inten *
      (1.0 - storm * 0.45);
    skyR += colR * aurScale;
    skyG += colG * aurScale;
    skyB += colB * aurScale;
  }

  // 3. Physical Solar Disk, 3-Tier Mie Aureole & Volumetric Cloud-Occluded Tyndall Shafts
  const sunVis = sunWeight * clamp01(dayFactor + duskFactor * 0.95);
  if (sunVis > 0.015) {
    const stormSunMask = 1 - storm * 0.68;
    const angSun = Math.acos(Math.max(-1, Math.min(1, cosSun)));
    const sunTintR = mix(1.0, 1.0, duskFactor);
    const sunTintG = mix(0.95, 0.58, duskFactor);
    const sunTintB = mix(0.84, 0.24, duskFactor);

    const scTintR = mix(0.86, 1.0, duskFactor);
    const scTintG = mix(0.93, 0.64, duskFactor);
    const scTintB = mix(1.0, 0.36, duskFactor);

    const broadWash =
      cosSun > 0.28 ? miePhase(cosSun, 0.62) * 0.022 * smoothstep(0.28, 0.98, cosSun) : 0;
    const midAureole =
      cosSun > 0.62 ? miePhase(cosSun, 0.88) * 0.026 * smoothstep(0.62, 0.995, cosSun) : 0;
    const innerBloom =
      cosSun > 0.92 ? miePhase(cosSun, 0.978) * 0.020 * smoothstep(0.92, 1.0, cosSun) : 0;

    const bw = broadWash * sunVis * stormSunMask;
    skyR += mix(scTintR, sunTintR, 0.48) * bw;
    skyG += mix(scTintG, sunTintG, 0.48) * bw;
    skyB += mix(scTintB, sunTintB, 0.48) * bw;

    const ma = midAureole * sunVis * stormSunMask * inten;
    skyR += mix(sunTintR, 1.0, 0.35) * ma;
    skyG += mix(sunTintG, 0.97, 0.35) * ma;
    skyB += mix(sunTintB, 0.90, 0.35) * ma;

    const ib = innerBloom * sunVis * stormSunMask * inten;
    skyR += 1.0 * ib;
    skyG += 0.98 * ib;
    skyB += 0.93 * ib;

    // Seamless volumetric crepuscular rays on unit direction rDir (zero atan seam, zero spinning)
    const dSunX = pX - sunPosX;
    const dSunY = pY - sunPosY;
    const distSun = Math.hypot(dSunX, dSunY);
    const coneEnv =
      Math.exp(-distSun * 1.95) *
      smoothstep(1.22, 0.06, distSun) *
      smoothstep(0.022, 0.12, distSun);

    if (coneEnv > 0.004) {
      const invD = 1 / Math.max(distSun, 0.0001);
      const rDirX = dSunX * invD;
      const rDirY = dSunY * invD;
      const atmosBias = mix(0.28, 1.0, smoothstep(0.58, -0.32, rDirY));
      const driftX = timeSec * 0.016;
      const driftY = timeSec * 0.004;

      const broadBand = fbmNormLut(rDirX * 2.3 + driftX, rDirY * 2.3 + driftY, 3);
      const fineRibbon = fbmNormLut(
        rDirX * 4.9 - driftX * 0.7 + 3.1,
        rDirY * 4.9 - driftY * 0.7 + 1.7,
        3,
      );
      const nearSilk = noise2dLut(
        rDirX * 10.5 + driftX * 0.5 + 6.4,
        rDirY * 10.5 + driftY * 0.5 + 2.9,
      );
      const nearWeight = Math.exp(-distSun * 3.6);
      const filament = broadBand * 0.56 + fineRibbon * 0.34 + nearSilk * 0.14 * nearWeight;
      const softFilaments = Math.pow(clamp01((filament - 0.36) / 0.54), 1.85);

      let rayTransmittance = 0;
      let illumDecay = 1;
      let decaySum = 0;
      const stepU = (uvX - sunUvX) / 6;
      const stepV = (uvY - sunUvY) / 6;
      let su = uvX - stepU * dither;
      let sv = uvY - stepV * dither;
      const veilCov = Math.max(cloudWeight, 0.28);
      for (let s = 0; s < 6; s++) {
        su -= stepU;
        sv -= stepV;
        const occ = sampleCloudVeilCpu((su - 0.5) * aspect, sv - 0.5, timeSec, veilCov, 2);
        rayTransmittance += Math.exp(-occ * 1.45) * illumDecay;
        decaySum += illumDecay;
        illumDecay *= 0.85;
      }
      const rayOcc = rayTransmittance / Math.max(0.001, decaySum);
      const occlusionMod = mix(0.45, 1.15, rayOcc);

      const distMix = smoothstep(0.06, 0.72, distSun);
      const duskMix = mix(0.45, 0.85, duskFactor);
      const rayColR = mix(mix(1.0, sunTintR, 0.4), mix(scTintR, sunTintR, duskMix), distMix);
      const rayColG = mix(mix(0.98, sunTintG, 0.4), mix(scTintG, sunTintG, duskMix), distMix);
      const rayColB = mix(mix(0.93, sunTintB, 0.4), mix(scTintB, sunTintB, duskMix), distMix);

      const shaftStrength = mix(0.14, 0.36, clamp01(cloudWeight * 0.85 + duskFactor * 0.55));
      const sh =
        softFilaments *
        occlusionMod *
        coneEnv *
        atmosBias *
        shaftStrength *
        sunVis *
        inten *
        stormSunMask;
      skyR += rayColR * sh;
      skyG += rayColG * sh;
      skyB += rayColB * sh;

      if (distSun < 0.24) {
        const cos3 = rDirX * (4 * rDirX * rDirX - 3);
        const sin3 = rDirY * (3 - 4 * rDirY * rDirY);
        const glintWave = Math.abs(cos3 * 0.94 - sin3 * 0.34);
        const lensShimmer =
          Math.pow(clamp01(glintWave), 28) *
          Math.exp(-distSun * 15) *
          smoothstep(0.025, 0.055, distSun) *
          0.08 *
          sunVis *
          inten *
          stormSunMask;
        skyR += 1.0 * lensShimmer;
        skyG += 0.97 * lensShimmer;
        skyB += 0.90 * lensShimmer;
      }
    }

    // Limb-darkened HDR solar photosphere
    if (angSun < 0.037) {
      const sunOcc =
        1 -
        sampleCloudVeilCpu(pX, pY, timeSec, Math.max(cloudWeight, 0.22), 2) *
          (0.35 + cloudWeight * 0.42);
      const disk = smoothstep(0.035, 0.019, angSun);
      const limb = Math.pow(clamp01(1 - angSun / 0.035), 0.48);
      const photo = (2.6 + 2.2 * limb) * sunOcc * disk * sunVis * stormSunMask;
      skyR += sunTintR * photo;
      skyG += sunTintG * photo;
      skyB += sunTintB * photo;
    }
  }

  // 4. Perspective-Projected Volumetric Layered Clouds + Beer-Lambert Self-Shadowing
  const cloudVis = clamp01(Math.max(cloudWeight, storm * 0.72));
  let cirrusA = 0;
  let cirrusR = 0;
  let cirrusG = 0;
  let cirrusB = 0;
  let midA = 0;
  let midR = 0;
  let midG = 0;
  let midB = 0;
  let lowA = 0;
  let lowR = 0;
  let lowG = 0;
  let lowB = 0;

  if (cloudVis > 0.01 && rdY > -0.18) {
    const horizonFade = smoothstep(-0.12, 0.12, rdY);
    const invProj = 1 / Math.max(0.14, rdY + 0.42);
    const pPlaneX = rdX * invProj + (mouseX - 0.5) * 0.16;
    const pPlaneY = rdZ * invProj + (mouseY - 0.5) * 0.08;

    const spYRaw = -Math.max(0.25, sunDirY + 0.35);
    const spLen = Math.hypot(sunDirX, spYRaw);
    const sunPlaneX = sunDirX / spLen;
    const sunPlaneY = spYRaw / spLen;

    let sunCR = mix(1.02, 1.0, duskFactor);
    let sunCG = mix(1.0, 0.74, duskFactor);
    let sunCB = mix(0.97, 0.5, duskFactor);
    sunCR = mix(sunCR, 0.46, nightFactor);
    sunCG = mix(sunCG, 0.58, nightFactor);
    sunCB = mix(sunCB, 0.8, nightFactor);

    let shdCR = mix(0.36, 0.28, duskFactor);
    let shdCG = mix(0.48, 0.2, duskFactor);
    let shdCB = mix(0.66, 0.34, duskFactor);
    shdCR = mix(shdCR, 0.08, nightFactor);
    shdCG = mix(shdCG, 0.12, nightFactor);
    shdCB = mix(shdCB, 0.22, nightFactor);

    if (storm > 0.01) {
      const stLitR = mix(0.34, 0.1, nightFactor);
      const stLitG = mix(0.4, 0.14, nightFactor);
      const stLitB = mix(0.49, 0.22, nightFactor);
      const stBelR = mix(0.14, 0.04, nightFactor);
      const stBelG = mix(0.18, 0.06, nightFactor);
      const stBelB = mix(0.25, 0.11, nightFactor);

      sunCR = mix(sunCR, stLitR, storm * 0.68);
      sunCG = mix(sunCG, stLitG, storm * 0.68);
      sunCB = mix(sunCB, stLitB, storm * 0.68);
      shdCR = mix(shdCR, stBelR, storm * 0.8);
      shdCG = mix(shdCG, stBelG, storm * 0.8);
      shdCB = mix(shdCB, stBelB, storm * 0.8);
    }

    const silverLining =
      miePhase(cosSun, 0.76) * 0.14 * (1 - nightFactor * 0.8) * (1 - storm * 0.5);

    // Layer 0: High wispy cirrus streaks
    const cirX = pPlaneX * 0.95 + timeSec * 0.014;
    const cirY = pPlaneY * 2.2;
    const cirWarp = fbmNormLut(cirX * 1.7, cirY * 1.7, Math.max(2, cloudOctaves - 1)) * 0.32;
    const cirN = fbmNormLut(cirX + cirWarp, cirY + cirWarp, cloudOctaves);
    cirrusA = smoothstep(0.62, 0.84, cirN) * 0.26 * cloudVis * horizonFade * (1 - storm * 0.5);
    if (cirrusA > 0.002) {
      cirrusR = mix(sunCR, 0.96, 0.35);
      cirrusG = mix(sunCG, 0.98, 0.35);
      cirrusB = mix(sunCB, 1.0, 0.35);
    }

    // Layer 1: Mid-altitude altocumulus
    const midX = pPlaneX * 1.65 + timeSec * 0.026 + 4.3;
    const midY = pPlaneY * 1.65 - timeSec * 0.004;
    const midCov = Math.min(0.85, Math.max(0, 0.42 * cloudVis + storm * 0.24));
    const midDen = sampleCloudDensityCpu(midX, midY, midCov, timeSec, cloudOctaves);
    if (midDen > 0.005) {
      const mSun1 = sampleCloudDensityCpu(
        midX + sunPlaneX * 0.14,
        midY + sunPlaneY * 0.14,
        midCov,
        timeSec,
        Math.max(2, cloudOctaves - 1),
      );
      const mSun2 = sampleCloudDensityCpu(
        midX + sunPlaneX * 0.36,
        midY + sunPlaneY * 0.36,
        midCov,
        timeSec,
        2,
      );
      const midShadow = mSun1 * 0.62 + mSun2 * 0.38;
      const midLight = clamp01(Math.exp(-midShadow * 2.2) * (0.72 + 0.38 * (1 - midDen * 0.4)));
      const midCrest = clamp01((midDen - mSun1) * 1.25);
      const mLit = clamp01(midLight * 0.85 + midCrest * 0.25 + 0.08);
      midA = midDen * (0.62 + storm * 0.14) * cloudVis * horizonFade;
      const sl = silverLining * (1 - midDen * 0.55);
      midR = mix(shdCR, sunCR, mLit) + sunCR * sl;
      midG = mix(shdCG, sunCG, mLit) + sunCG * sl;
      midB = mix(shdCB, sunCB, mLit) + sunCB * sl;
    }

    // Layer 2: Low sculpted cumulus with Beer-Lambert shadows
    const lowX = pPlaneX * 1.05 + timeSec * 0.042 + 11.7;
    const lowY = pPlaneY * 1.05 + timeSec * 0.005;
    const lowCov = Math.min(0.88, Math.max(0, 0.46 * cloudVis + storm * 0.3));
    const lowDen = sampleCloudDensityCpu(lowX, lowY, lowCov, timeSec, cloudOctaves);
    if (lowDen > 0.005) {
      const lSun1 = sampleCloudDensityCpu(
        lowX + sunPlaneX * 0.15,
        lowY + sunPlaneY * 0.15,
        lowCov,
        timeSec,
        Math.max(2, cloudOctaves - 1),
      );
      const lSun2 = sampleCloudDensityCpu(
        lowX + sunPlaneX * 0.38,
        lowY + sunPlaneY * 0.38,
        lowCov,
        timeSec,
        2,
      );
      const lowShadow = lSun1 * 0.6 + lSun2 * 0.4;
      const beer = Math.exp(-lowShadow * 2.65);
      const powder = 1 - Math.exp(-lowDen * 3.2) * 0.35;
      const crest = clamp01((lowDen - lSun1) * 1.4);
      const lowLit = clamp01(beer * powder * 0.86 + crest * 0.3 + 0.06);
      lowA = lowDen * (0.82 + storm * 0.12) * cloudVis * horizonFade;
      const sl = silverLining * (1 - lowDen * 0.58);
      lowR = mix(shdCR, sunCR, lowLit) + sunCR * sl;
      lowG = mix(shdCG, sunCG, lowLit) + sunCG * sl;
      lowB = mix(shdCB, sunCB, lowLit) + sunCB * sl;
    }
  }

  // 5. Continuous-Spectrum Double Rainbow + Alexander's Dark Band
  let rbAddR = 0;
  let rbAddG = 0;
  let rbAddB = 0;
  if (rainbowWeight > 0.01) {
    const rbW = clamp01(rainbowWeight) * Math.max(0.6, Math.min(1.35, inten));
    const rbCx = 0.04 * aspect + (mouseX - 0.5) * 0.04;
    const rbCy = -0.56 + (mouseY - 0.5) * 0.02;
    const ang = Math.hypot(pX - rbCx, pY - rbCy);

    const r1 = 0.74;
    const w1 = 0.044;
    const r2 = 0.9;
    const w2 = 0.065;

    let rawR = 0;
    let rawG = 0;
    let rawB = 0;

    const d1 = (ang - r1) / (w1 * 0.68);
    if (Math.abs(d1) < 3.2) {
      const env1 = Math.exp(-(d1 * d1)) * 0.42;
      writeSpectralColor((ang - (r1 - w1)) / (2 * w1), SCRATCH_SPEC);
      rawR += SCRATCH_SPEC[0] * env1;
      rawG += SCRATCH_SPEC[1] * env1;
      rawB += SCRATCH_SPEC[2] * env1;
    }

    const d2 = (ang - r2) / (w2 * 0.72);
    if (Math.abs(d2) < 3.2) {
      const env2 = Math.exp(-(d2 * d2)) * 0.3 * 0.42;
      writeSpectralColor(1 - clamp01((ang - (r2 - w2)) / (2 * w2)), SCRATCH_SPEC);
      rawR += SCRATCH_SPEC[0] * env2;
      rawG += SCRATCH_SPEC[1] * env2;
      rawB += SCRATCH_SPEC[2] * env2;
    }

    const innerBright = smoothstep(r1 + 0.02, r1 - 0.09, ang) * 0.036;
    rawR += innerBright;
    rawG += innerBright;
    rawB += innerBright;

    const alexanderDark =
      smoothstep(r1 + 0.015, r1 + 0.055, ang) * smoothstep(r2 - 0.015, r2 - 0.055, ang);

    const legFade = smoothstep(0.03, 0.28, skyY) * smoothstep(1.04, 0.76, skyY);
    const cloudVeil = 1 - lowA * 0.55;

    if (rawR + rawG + rawB > 0.001 && legFade > 0.001) {
      const mistMod =
        0.72 + 0.28 * fbmLut(pX * 2.8 + timeSec * 0.015, pY * 2.8 - timeSec * 0.01, 2);
      const todBow = clamp01(dayFactor + duskFactor * 0.72 + nightFactor * 0.24);

      rawR = mix(rawR, rawR * 1.18, duskFactor * 0.72);
      rawG = mix(rawG, rawG * 0.84, duskFactor * 0.72);
      rawB = mix(rawB, rawB * 0.62, duskFactor * 0.72);

      const bowLuma = rawR * 0.299 + rawG * 0.587 + rawB * 0.114;
      rawR = mix(rawR, bowLuma * 0.84, nightFactor * 0.78);
      rawG = mix(rawG, bowLuma * 0.92, nightFactor * 0.78);
      rawB = mix(rawB, bowLuma * 1.05, nightFactor * 0.78);

      const bandMask = rbW * mistMod * legFade * todBow * cloudVeil;
      rbAddR = rawR * bandMask;
      rbAddG = rawG * bandMask;
      rbAddB = rawB * bandMask;
    }

    if (alexanderDark > 0.001 && legFade > 0.001) {
      const darkAtten =
        1 - alexanderDark * 0.065 * rbW * legFade * (dayFactor + duskFactor * 0.6) * cloudVeil;
      skyR *= darkAtten;
      skyG *= darkAtten;
      skyB *= darkAtten;
    }
  }

  // 6. Sequential Atmospheric Compositing + ACES Filmic Tonemapping
  if (cirrusA > 0.002) {
    skyR = mix(skyR, cirrusR, cirrusA);
    skyG = mix(skyG, cirrusG, cirrusA);
    skyB = mix(skyB, cirrusB, cirrusA);
  }
  skyR += rbAddR;
  skyG += rbAddG;
  skyB += rbAddB;
  if (midA > 0.002) {
    skyR = mix(skyR, midR, midA);
    skyG = mix(skyG, midG, midA);
    skyB = mix(skyB, midB, midA);
  }
  if (lowA > 0.002) {
    skyR = mix(skyR, lowR, lowA) + rbAddR * lowA * 0.15;
    skyG = mix(skyG, lowG, lowA) + rbAddG * lowA * 0.15;
    skyB = mix(skyB, lowB, lowA) + rbAddB * lowA * 0.15;
  }

  outRgb[0] = acesToneMapChannel(skyR) * 255;
  outRgb[1] = acesToneMapChannel(skyG) * 255;
  outRgb[2] = acesToneMapChannel(skyB) * 255;
}

function createTexturedMoonSprite(): HTMLCanvasElement {
  const size = 96;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const g = c.getContext('2d');
  if (!g) return c;

  const img = g.createImageData(size, size);
  const data = img.data;
  const half = size * 0.5;
  const diskR = size * 0.38;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px + 0.5 - half;
      const dy = py + 0.5 - half;
      const d = Math.hypot(dx, dy);
      const alpha = smoothstep(diskR, diskR - 1.8, d);
      if (alpha <= 0.002) continue;

      const nx = dx / diskR;
      const ny = dy / diskR;
      const maria = fbmNormLut(nx * 2.2 + 3.1, ny * 2.2 + 7.4, 4);
      const limb = Math.pow(clamp01(1 - d / diskR), 0.35);
      const lum = 0.68 + 0.34 * limb;

      const idx = (py * size + px) * 4;
      data[idx] = clamp01(mix(0.72, 1.0, maria) * lum) * 255;
      data[idx + 1] = clamp01(mix(0.80, 0.98, maria) * lum) * 255;
      data[idx + 2] = clamp01(mix(0.92, 0.94, maria) * lum) * 255;
      data[idx + 3] = alpha * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

export function createWeatherCpuSkyRenderer(): WeatherCpuSkyRenderer {
  const skyCanvas = document.createElement('canvas');
  const skyCtx = skyCanvas.getContext('2d');
  let imgData: ImageData | null = null;
  const pixelOut = new Float32Array(3);
  const moonSprite = createTexturedMoonSprite();

  const stars = Array.from({ length: 160 }, () => ({
    x: Math.random(),
    y: Math.random() * 0.74,
    r: 0.55 + Math.random() * 1.35,
    phase: Math.random() * Math.PI * 2,
    speed: 1.4 + Math.random() * 2.8,
    tint: Math.random() < 0.28 ? '#fde68a' : Math.random() < 0.6 ? '#dbeafe' : '#ffffff',
  }));

  const render = (ctx: CanvasRenderingContext2D, params: WeatherCpuSkyParams) => {
    const {
      width,
      height,
      timeSec,
      mouseX,
      mouseY,
      sunWeight,
      auroraWeight,
      cloudWeight,
      stormWeight,
      rainbowWeight,
      dayFactor,
      duskFactor,
      nightFactor,
      intensity,
      quality,
    } = params;

    if (width <= 0 || height <= 0) return;
    const prof = getRenderQualityProfile(quality);
    const aspect = width / Math.max(1, height);
    const mouseGlY = 1 - mouseY;

    // 1. Render software atmospheric sky fragment shader into adaptive offscreen buffer
    if (skyCtx) {
      const bufW = Math.max(96, Math.min(width, prof.cpuShaderMaxWidth));
      const bufH = Math.max(64, Math.round((bufW * height) / Math.max(1, width)));
      if (skyCanvas.width !== bufW || skyCanvas.height !== bufH || !imgData) {
        skyCanvas.width = bufW;
        skyCanvas.height = bufH;
        imgData = skyCtx.createImageData(bufW, bufH);
      }

      const data = imgData.data;
      for (let py = 0; py < bufH; py++) {
        const uvY = 1 - (py + 0.5) / bufH;
        const rowOffset = py * bufW * 4;
        for (let px = 0; px < bufW; px++) {
          const uvX = (px + 0.5) / bufW;
          evaluateWeatherSkyPixel(
            {
              uvX,
              uvY,
              aspect,
              fragX: px,
              fragY: py,
              timeSec,
              mouseX,
              mouseY: mouseGlY,
              sunWeight,
              auroraWeight,
              cloudWeight,
              stormWeight,
              rainbowWeight,
              dayFactor,
              duskFactor,
              nightFactor,
              intensity,
              cloudOctaves: prof.cpuCloudOctaves,
              auroraSteps: prof.cpuAuroraSteps,
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

    // 2. Razor-sharp Native-DPR Twinkling Stars (never softened by sky buffer upscale)
    const starMask =
      clamp01(nightFactor + duskFactor * 0.28 + auroraWeight * 0.55) *
      (1 - clamp01(cloudWeight * 0.52 + stormWeight * 0.68));
    if (starMask > 0.02) {
      const starCount = Math.round(stars.length * (0.45 + 0.55 * prof.particleScale));
      ctx.save();
      for (let i = 0; i < starCount; i++) {
        const s = stars[i];
        const skyFade = smoothstep(0.76, 0.16, s.y);
        const twinkle = 0.55 + 0.45 * Math.sin(timeSec * s.speed + s.phase);
        const alpha = starMask * skyFade * twinkle * 0.9;
        if (alpha < 0.02) continue;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = s.tint;
        ctx.beginPath();
        ctx.arc(s.x * width, s.y * height, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 3. Textured Lunar Maria Moon Sprite + Soft Mie Halo at Night
    const moonVis = sunWeight * nightFactor * (1 - stormWeight * 0.62);
    if (moonVis > 0.02) {
      const mx = width * (0.72 + (mouseX - 0.5) * 0.03);
      const my = height * (0.24 + (mouseY - 0.5) * 0.02);
      const moonSize = Math.max(46, Math.min(82, Math.min(width, height) * 0.075));

      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const halo = ctx.createRadialGradient(mx, my, moonSize * 0.2, mx, my, moonSize * 2.5);
      halo.addColorStop(0, `rgba(214, 234, 255, ${(0.34 * moonVis).toFixed(3)})`);
      halo.addColorStop(0.38, `rgba(147, 197, 253, ${(0.14 * moonVis).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(147, 197, 253, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(mx, my, moonSize * 2.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = Math.min(1, moonVis * 1.15);
      ctx.drawImage(
        moonSprite,
        mx - moonSize * 0.5,
        my - moonSize * 0.5,
        moonSize,
        moonSize,
      );
      ctx.restore();
    }
  };

  const dispose = () => {
    skyCanvas.width = 0;
    skyCanvas.height = 0;
    moonSprite.width = 0;
    moonSprite.height = 0;
    imgData = null;
  };

  return { render, dispose };
}

export interface CpuRainGlassRenderer {
  render: (
    ctx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    dt: number,
    timeSec: number,
    rainWeight: number,
    intensity: number,
    quality: RenderQualityTier,
  ) => void;
  dispose: () => void;
}

interface CpuGlassSliderDrop {
  x: number;
  y: number;
  baseX: number;
  freq: number;
  seed: number;
  r: number;
  speed: number;
  lifeOffset: number;
  trailY: number;
}

interface CpuGlassStaticBead {
  x: number;
  y: number;
  r: number;
  aspectY: number;
  phase: number;
}

function trackWobbleX(py: number, baseX: number, seed: number, freq: number): number {
  return baseX + Math.sin(py * freq + seed * Math.PI * 2) * 0.0085;
}

/**
 * Real optical dome refraction renderer for CPU Rain-on-Glass:
 * copies the scene into an offscreen refraction buffer, then renders vertically inverted,
 * magnified sky/scene refractions, bottom caustic crescents, specular highlights & wet trails
 * inside every gravity-sliding droplet and condensation micro-bead.
 */
export function createCpuRainGlassRenderer(): CpuRainGlassRenderer {
  const refractCanvas = document.createElement('canvas');
  const refractCtx = refractCanvas.getContext('2d');

  const sliders: CpuGlassSliderDrop[] = Array.from({ length: 42 }, (_, idx) => {
    const baseX = (idx + 0.5) / 42 + (Math.random() - 0.5) * 0.022;
    return {
      baseX,
      x: baseX,
      y: Math.random(),
      freq: 22 + Math.random() * 14,
      seed: Math.random(),
      r: 3.4 + Math.random() * 3.4,
      speed: 0.055 + Math.random() * 0.05,
      lifeOffset: Math.random() * 10,
      trailY: 0,
    };
  });

  const staticBeads: CpuGlassStaticBead[] = Array.from({ length: 56 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 1.4 + Math.random() * 2.1,
    aspectY: 1.0 + Math.random() * 0.22,
    phase: Math.random() * Math.PI * 2,
  }));

  const drawRefractedDome = (
    ctx: CanvasRenderingContext2D,
    srcW: number,
    srcH: number,
    width: number,
    height: number,
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    alpha: number,
    isSlider: boolean,
  ) => {
    ctx.save();
    ctx.globalAlpha = alpha;

    // 1. Delicate dark contact refraction rim
    ctx.beginPath();
    if (isSlider) {
      // Teardrop lens narrower at top tail, plump at bottom head
      ctx.moveTo(cx, cy - ry * 1.18);
      ctx.bezierCurveTo(cx + rx * 0.95, cy - ry * 0.45, cx + rx * 1.06, cy + ry * 0.52, cx, cy + ry);
      ctx.bezierCurveTo(cx - rx * 1.06, cy + ry * 0.52, cx - rx * 0.95, cy - ry * 0.45, cx, cy - ry * 1.18);
    } else {
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.closePath();

    ctx.shadowColor = 'rgba(4, 10, 24, 0.36)';
    ctx.shadowBlur = Math.max(2, rx * 0.7);
    ctx.shadowOffsetY = 1.2;
    ctx.fillStyle = 'rgba(200, 230, 255, 0.08)';
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 2. Real inverted spherical-lens refraction sampled from refractCanvas
    ctx.save();
    ctx.clip();

    const normX = clamp01(cx / Math.max(1, width));
    const normY = clamp01(cy / Math.max(1, height));
    const sampleW = Math.max(18, (rx / Math.max(1, width)) * srcW * 5.2);
    const sampleH = Math.max(18, (ry / Math.max(1, height)) * srcH * 5.2);
    const sx = Math.max(0, Math.min(srcW - sampleW, normX * srcW - sampleW * 0.5));
    const sy = Math.max(0, Math.min(srcH - sampleH, normY * srcH - sampleH * 0.5));

    ctx.translate(cx, cy);
    ctx.scale(1, -1); // Optical inversion inside convex water dome
    ctx.drawImage(refractCanvas, sx, sy, sampleW, sampleH, -rx * 1.08, -ry * 1.18, rx * 2.16, ry * 2.36);

    // Subtle cool glass Fresnel rim shading
    const rimGrad = ctx.createRadialGradient(0, 0, rx * 0.25, 0, 0, Math.max(rx, ry) * 1.05);
    rimGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    rimGrad.addColorStop(0.75, 'rgba(186, 230, 253, 0.12)');
    rimGrad.addColorStop(1, 'rgba(15, 23, 42, 0.32)');
    ctx.fillStyle = rimGrad;
    ctx.fillRect(-rx * 1.2, -ry * 1.25, rx * 2.4, ry * 2.5);
    ctx.restore();

    // 3. Bottom caustic crescent (sky light focused at lower edge of dome)
    ctx.strokeStyle = 'rgba(240, 249, 255, 0.72)';
    ctx.lineWidth = Math.max(0.75, rx * 0.22);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy + ry * 0.14, rx * 0.74, Math.PI * 0.18, Math.PI * 0.82);
    ctx.stroke();

    // 4. Crisp upper-left specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.32, cy - ry * 0.34, Math.max(0.7, rx * 0.22), Math.max(0.55, ry * 0.16), -0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  const render = (
    ctx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    width: number,
    height: number,
    dt: number,
    timeSec: number,
    rainWeight: number,
    intensity: number,
    quality: RenderQualityTier,
  ) => {
    if (!refractCtx || rainWeight <= 0.02 || width <= 0 || height <= 0) return;

    const prof = getRenderQualityProfile(quality);
    const bufW = Math.max(120, Math.floor(width * 0.5));
    const bufH = Math.max(80, Math.floor(height * 0.5));
    if (refractCanvas.width !== bufW || refractCanvas.height !== bufH) {
      refractCanvas.width = bufW;
      refractCanvas.height = bufH;
    }
    refractCtx.drawImage(sourceCanvas, 0, 0, bufW, bufH);

    const dropDensity = Math.min(1.15, rainWeight * intensity * prof.particleScale);
    const activeSliders = Math.max(6, Math.round(sliders.length * dropDensity));
    const activeBeads = Math.max(10, Math.round(staticBeads.length * dropDensity));
    const visAlpha = clamp01(rainWeight * 1.15);

    // 1. Static condensation micro-beads across the glass
    for (let i = 0; i < activeBeads; i++) {
      const b = staticBeads[i];
      const shimmer = 0.78 + 0.22 * Math.sin(timeSec * 0.9 + b.phase);
      drawRefractedDome(
        ctx,
        bufW,
        bufH,
        width,
        height,
        b.x * width,
        b.y * height,
        b.r,
        b.r * b.aspectY,
        visAlpha * 0.78 * shimmer,
        false,
      );
    }

    // 2. Gravity-sliding stick-slip droplets with sinuous wet trails & wake micro-beads
    for (let i = 0; i < activeSliders; i++) {
      const d = sliders[i];
      const stickSlip = 0.38 + 0.62 * Math.pow(0.5 + 0.5 * Math.sin(timeSec * 3.8 + d.lifeOffset), 1.4);
      d.y += d.speed * stickSlip * dt;
      if (d.y > 1.06) {
        d.y = -0.04;
        d.trailY = -0.04;
        d.seed = Math.random();
      }
      d.x = trackWobbleX(d.y, d.baseX, d.seed, d.freq);

      const trailSpan = Math.min(0.24, Math.max(0.03, d.y - d.trailY));
      const yStart = Math.max(0, d.y - trailSpan);
      const px = d.x * width;
      const py = d.y * height;

      // Subtle refracted wet track & left-behind wake micro-beads above sliding drop
      if (trailSpan > 0.04) {
        ctx.save();
        ctx.globalAlpha = visAlpha * 0.45;
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(214, 238, 255, 0.36)';
        ctx.lineWidth = Math.max(1.1, d.r * 0.45);
        ctx.beginPath();
        const segs = 6;
        for (let s = 0; s <= segs; s++) {
          const ty = mix(yStart, d.y, s / segs);
          const tx = trackWobbleX(ty, d.baseX, d.seed, d.freq) * width;
          if (s === 0) ctx.moveTo(tx, ty * height);
          else ctx.lineTo(tx, ty * height);
        }
        ctx.stroke();

        // 2 micro-beads nucleated inside the wet wake
        for (let w = 1; w <= 2; w++) {
          const wy = mix(yStart + 0.015, d.y - 0.025, w / 3);
          const wx = trackWobbleX(wy, d.baseX, d.seed, d.freq) * width;
          drawRefractedDome(
            ctx,
            bufW,
            bufH,
            width,
            height,
            wx,
            wy * height,
            d.r * 0.36,
            d.r * 0.42,
            visAlpha * 0.62,
            false,
          );
        }
        ctx.restore();
      }

      drawRefractedDome(
        ctx,
        bufW,
        bufH,
        width,
        height,
        px,
        py,
        d.r,
        d.r * 1.42,
        visAlpha * 0.92,
        true,
      );
    }
  };

  const dispose = () => {
    refractCanvas.width = 0;
    refractCanvas.height = 0;
  };

  return { render, dispose };
}
