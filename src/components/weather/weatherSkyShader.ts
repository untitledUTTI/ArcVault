/**
 * Procedural WebGL2 atmospheric optics & volumetric sky renderer for the
 * Real-Time Weather Theme:
 * - Rayleigh + Mie atmospheric scattering across Day, Golden Hour Dusk & Starry Night
 * - Physical HDR solar disk with limb darkening & localized radial Tyndall god-rays
 * - 3D perspective-projected volumetric clouds (cirrus, altocumulus, sculpted cumulus)
 *   with Beer-Lambert directional self-shadowing & silver lining
 * - Physically-based continuous-spectrum double rainbow with Alexander's Dark Band
 * - 24-step nimitz-inspired volumetric raymarched Aurora Borealis curtains
 * - ACES filmic tonemapping
 */

export const WEATHER_SKY_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

export const WEATHER_SKY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_sunWeight;
uniform float u_auroraWeight;
uniform float u_cloudWeight;
uniform float u_stormWeight;
uniform float u_rainbowWeight;
uniform float u_dayFactor;
uniform float u_duskFactor;
uniform float u_nightFactor;
uniform float u_intensity;

float ign(vec2 fragCoord) {
  return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715))));
}

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2d(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm4(vec2 p) {
  float sum = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    sum += amp * noise2d(p);
    p = rot * p * 2.03 + vec2(17.1, 31.7);
    amp *= 0.5;
  }
  return sum;
}

// Normalized 4-octave FBM in [0, 1] with balanced ~0.5 mean
float fbmNorm(vec2 p) {
  return clamp(fbm4(p) / 0.9375, 0.0, 1.0);
}

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, s, -s, c);
}

float tri(float x) {
  return clamp(abs(fract(x) - 0.5), 0.01, 0.49);
}

vec2 tri2(vec2 p) {
  return vec2(tri(p.x) + tri(p.y), tri(p.y + tri(p.x)));
}

// Nimitz-style iterative triangular wave domain-warped curtain noise
float triNoise2d(vec2 p, float spd, float t) {
  float z = 1.8;
  float z2 = 2.5;
  float rz = 0.0;
  p *= rot2(p.x * 0.06);
  vec2 bp = p;
  for (int i = 0; i < 4; i++) {
    vec2 dg = tri2(bp * 1.85) * 0.75;
    dg *= rot2(t * spd);
    p -= dg / z2;
    bp *= 1.3;
    z2 *= 0.45;
    z *= 0.42;
    p *= 1.21 + (rz - 1.0) * 0.02;
    rz += tri(p.x + tri(p.y)) * z;
    p *= -rot2(0.95532);
  }
  return clamp(1.0 / max(0.001, pow(rz * 28.0, 1.28)), 0.0, 0.55);
}

vec4 evalAurora(vec3 rd, float t, float dither) {
  if (rd.y < -0.14) return vec4(0.0);
  vec4 col = vec4(0.0);
  vec4 avgCol = vec4(0.0);
  vec3 ro = vec3(0.0, 0.0, -6.7 + t * 0.02);

  for (int i = 0; i < 24; i++) {
    float fi = float(i) + dither;
    float pt = (0.85 + pow(fi, 1.38) * 0.0022) / (rd.y * 2.0 + 0.44);
    vec3 bpos = ro + pt * rd;
    vec2 p = bpos.zx;
    float rzt = triNoise2d(p, 0.065, t);
    vec4 col2 = vec4(0.0, 0.0, 0.0, rzt);

    vec3 bandHue = sin(1.0 - vec3(2.15, -0.45, 1.25) + fi * 0.048) * 0.5 + 0.5;
    col2.rgb = bandHue * rzt;
    avgCol = mix(avgCol, col2, 0.52);
    col += avgCol * exp2(-fi * 0.068 - 2.35) * smoothstep(0.0, 4.8, fi);
  }

  col *= clamp(rd.y * 15.0 + 0.45, 0.0, 1.0);
  float horizonFade = smoothstep(-0.08, 0.14, rd.y);
  return col * (1.85 * horizonFade);
}

// Henyey-Greenstein Mie scattering phase function
float miePhase(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (12.56637 * pow(max(0.0005, 1.0 + g2 - 2.0 * g * cosTheta), 1.5));
}

// Animated cloud veil density for Tyndall occlusion & near-sun wisps
float sampleCloudVeil(vec2 p, float t, float cloudWeight) {
  vec2 q = p * vec2(1.55, 2.65) + vec2(t * 0.018, -t * 0.004);
  float n = fbm4(q + fbm4(q * 1.4 - vec2(t * 0.01, 0.0)) * 0.45);
  float thresh = mix(0.58, 0.36, cloudWeight);
  return smoothstep(thresh, thresh + 0.28, n);
}

float sampleCloudDensityLayer(vec2 p, float coverage, float t) {
  float macro = fbmNorm(p * 0.55);
  float billow = fbmNorm(p * 1.55 + vec2(macro * 0.65, -macro * 0.45));
  float detail = noise2d(p * 3.8 + vec2(t * 0.03, 0.0));
  float raw = macro * 0.62 + billow * 0.30 + detail * 0.08;
  float thresh = mix(0.68, 0.42, clamp(coverage, 0.0, 1.0));
  return smoothstep(thresh, thresh + 0.16, raw);
}

// Smooth continuous perceptual spectrum: t=0 violet -> indigo -> blue -> cyan -> green -> yellow -> orange -> t=1 red
vec3 spectralColor(float t) {
  float x = clamp(t, 0.0, 1.0);
  float r = exp(-pow((x - 0.86) / 0.17, 2.0)) * 0.98
          + exp(-pow((x - 0.62) / 0.16, 2.0)) * 0.72
          + exp(-pow((x - 0.06) / 0.10, 2.0)) * 0.42;
  float g = exp(-pow((x - 0.56) / 0.22, 2.0)) * 0.95
          + exp(-pow((x - 0.32) / 0.14, 2.0)) * 0.36;
  float b = exp(-pow((x - 0.22) / 0.18, 2.0)) * 0.98
          + exp(-pow((x - 0.06) / 0.10, 2.0)) * 0.62;
  return clamp(vec3(r, g, b), 0.0, 1.0);
}

vec3 starField(vec3 rd, float t) {
  vec2 sp = vec2(atan(rd.x, rd.z) * 1.65, asin(clamp(rd.y, -0.99, 0.99)) * 2.1);
  vec3 acc = vec3(0.0);
  for (int layer = 0; layer < 2; layer++) {
    float scale = layer == 0 ? 48.0 : 92.0;
    vec2 gv = fract(sp * scale) - 0.5;
    vec2 id = floor(sp * scale);
    float rnd = hash21(id + float(layer) * 71.3);
    if (rnd > 0.87) {
      vec2 jitter = (vec2(hash21(id * 1.9), hash21(id * 3.1)) - 0.5) * 0.62;
      float d = length(gv - jitter);
      float twinkle = 0.6 + 0.4 * sin(t * (1.5 + rnd * 3.5) + rnd * 40.0);
      float star = smoothstep(0.11, 0.01, d) * twinkle * pow((rnd - 0.87) / 0.13, 1.35);
      vec3 temp = mix(vec3(0.76, 0.88, 1.0), vec3(1.0, 0.92, 0.78), fract(rnd * 19.7));
      acc += temp * star * (layer == 0 ? 1.15 : 0.72);
    }
  }
  return acc;
}

vec3 acesToneMap(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  float aspect = u_resolution.x / max(1.0, u_resolution.y);
  vec2 uv = (v_uv - 0.5) * vec2(aspect, 1.0);
  vec3 rd = normalize(vec3(uv, 1.32));
  float dither = ign(gl_FragCoord.xy);

  float skyY = clamp(v_uv.y, 0.0, 1.0);
  float storm = clamp(u_stormWeight, 0.0, 1.0);
  float inten = clamp(u_intensity, 0.35, 1.5);

  // Sun 3D direction locked to screen coordinates for zero parallax mismatch
  float sunPosX = mix(0.27, 0.23, u_duskFactor) * aspect + (u_mouse.x - 0.5) * 0.06;
  float sunPosY = mix(0.28, 0.05, u_duskFactor) + (u_mouse.y - 0.5) * 0.035;
  vec3 sunDir = normalize(vec3(sunPosX, sunPosY, 1.32));
  vec2 sunUv = vec2(sunPosX / max(0.001, aspect), sunPosY) + 0.5;
  float cosSun = dot(rd, sunDir);

  // 1. Atmospheric Sky Base (Crisp Rayleigh vertical gradient)
  vec3 daySky = mix(vec3(0.42, 0.72, 0.98), vec3(0.04, 0.24, 0.64), pow(skyY, 0.62));
  vec3 duskSky = mix(vec3(0.88, 0.42, 0.28), vec3(0.07, 0.10, 0.28), pow(skyY, 0.58));
  duskSky += vec3(0.26, 0.11, 0.22) * exp(-pow((skyY - 0.34) * 4.2, 2.0)); // Belt of Venus glow
  vec3 nightSky = mix(vec3(0.045, 0.09, 0.20), vec3(0.008, 0.018, 0.055), pow(skyY, 0.65));

  vec3 skyCol = daySky * u_dayFactor + duskSky * u_duskFactor + nightSky * u_nightFactor;

  if (storm > 0.01) {
    vec3 stormTone = mix(
      vec3(0.07, 0.10, 0.15),
      vec3(0.025, 0.036, 0.062),
      u_nightFactor
    );
    skyCol = mix(skyCol, stormTone, storm * 0.72);
  }

  // 2. Stars & Physically-Shaded Moon at night/twilight
  float starMask = clamp(u_nightFactor + u_duskFactor * 0.28 + u_auroraWeight * 0.55, 0.0, 1.0);
  starMask *= (1.0 - clamp(u_cloudWeight * 0.52 + storm * 0.68, 0.0, 0.9));
  if (starMask > 0.02 && skyY > 0.12) {
    skyCol += starField(rd, u_time) * starMask * smoothstep(0.12, 0.45, skyY);
  }

  float moonVis = u_sunWeight * u_nightFactor * (1.0 - storm * 0.62);
  if (moonVis > 0.02) {
    vec3 moonDir = normalize(vec3(0.25 * aspect + (u_mouse.x - 0.5) * 0.04, 0.26 + (u_mouse.y - 0.5) * 0.03, 1.32));
    float cosMoon = dot(rd, moonDir);
    float angMoon = acos(clamp(cosMoon, -1.0, 1.0));
    float moonDisk = smoothstep(0.032, 0.029, angMoon);
    if (moonDisk > 0.001) {
      float maria = fbm4((rd.xy - moonDir.xy) * 42.0 + vec2(3.1, 7.4));
      float limb = smoothstep(0.032, 0.008, angMoon);
      vec3 moonAlbedo = mix(vec3(0.72, 0.80, 0.92), vec3(1.0, 0.98, 0.94), maria) * (0.62 + 0.42 * limb);
      skyCol = mix(skyCol, moonAlbedo * 1.45, moonDisk * moonVis);
    }
    float moonHalo = pow(max(0.0, cosMoon), 22.0) * 0.20 + miePhase(cosMoon, 0.88) * 0.012;
    skyCol += vec3(0.55, 0.74, 0.98) * moonHalo * moonVis;
  }

  // 3. Nimitz-Style Volumetric Raymarched Aurora
  if (u_auroraWeight > 0.015) {
    vec4 aur = evalAurora(rd, u_time, dither);
    float nightBoost = mix(0.45, 1.25, clamp(u_nightFactor + u_duskFactor * 0.5, 0.0, 1.0));
    float cloudOccl = 1.0 - storm * 0.45;
    skyCol += aur.rgb * (u_auroraWeight * nightBoost * inten * cloudOccl);
  }

  // 4. Physical Solar Disk, 3-Tier Mie Aureole & Volumetric Cloud-Occluded Tyndall Shafts
  float sunVis = u_sunWeight * clamp(u_dayFactor + u_duskFactor * 0.95, 0.0, 1.0);
  if (sunVis > 0.015) {
    float stormSunMask = 1.0 - storm * 0.68;
    float angSun = acos(clamp(cosSun, -1.0, 1.0));
    vec3 sunTint = mix(vec3(1.0, 0.95, 0.84), vec3(1.0, 0.58, 0.24), u_duskFactor);
    vec3 scatterTint = mix(vec3(0.86, 0.93, 1.0), vec3(1.0, 0.64, 0.36), u_duskFactor);

    // 3-tier smooth Mie atmospheric corona (broad wash, silky mid-aureole, tight photographic core)
    float broadWash = miePhase(cosSun, 0.62) * 0.022 * smoothstep(0.28, 0.98, cosSun);
    float midAureole = miePhase(cosSun, 0.88) * 0.026 * smoothstep(0.62, 0.995, cosSun);
    float innerBloom = miePhase(cosSun, 0.978) * 0.020 * smoothstep(0.92, 1.0, cosSun);
    skyCol += mix(scatterTint, sunTint, 0.48) * (broadWash * sunVis * stormSunMask);
    skyCol += mix(sunTint, vec3(1.0, 0.97, 0.90), 0.35) * (midAureole * sunVis * stormSunMask * inten);
    skyCol += vec3(1.0, 0.98, 0.93) * (innerBloom * sunVis * stormSunMask * inten);

    // Seamless volumetric crepuscular rays on unit direction rDir (zero atan seam, zero spinning)
    vec2 deltaSun = uv - vec2(sunPosX, sunPosY);
    float distSun = length(deltaSun);
    float coneEnv = exp(-distSun * 1.95) * smoothstep(1.22, 0.06, distSun) * smoothstep(0.022, 0.12, distSun);
    if (coneEnv > 0.004) {
      vec2 rDir = deltaSun / max(distSun, 0.0001);
      // Rays scatter more strongly diagonally/downward through denser lower troposphere haze
      float atmosBias = mix(0.28, 1.0, smoothstep(0.58, -0.32, rDir.y));
      vec2 drift = vec2(u_time * 0.016, u_time * 0.004);

      float broadBand = fbmNorm(rDir * 2.3 + drift);
      float fineRibbon = fbmNorm(rDir * 4.9 - drift * 0.7 + vec2(3.1, 1.7));
      float nearSilk = noise2d(rDir * 10.5 + drift * 0.5 + vec2(6.4, 2.9));
      float nearWeight = exp(-distSun * 3.6);
      float filament = broadBand * 0.56 + fineRibbon * 0.34 + nearSilk * 0.14 * nearWeight;
      float softFilaments = pow(clamp((filament - 0.36) / 0.54, 0.0, 1.0), 1.85);

      // 12-step IGN-dithered Beer-Lambert radial occlusion marching toward the sun
      float rayTransmittance = 0.0;
      float illumDecay = 1.0;
      float decaySum = 0.0;
      vec2 stepUv = (v_uv - sunUv) / 12.0;
      vec2 sUv = v_uv - stepUv * dither;
      float veilCov = max(u_cloudWeight, 0.28);
      for (int s = 0; s < 12; s++) {
        sUv -= stepUv;
        vec2 sp = (sUv - 0.5) * vec2(aspect, 1.0);
        float occ = sampleCloudVeil(sp, u_time, veilCov);
        rayTransmittance += exp(-occ * 1.45) * illumDecay;
        decaySum += illumDecay;
        illumDecay *= 0.89;
      }
      float rayOcc = rayTransmittance / max(0.001, decaySum);
      float occlusionMod = mix(0.45, 1.15, rayOcc);

      // Distance-based atmospheric warmth near the core shifting softly outward
      vec3 nearCol = mix(vec3(1.0, 0.98, 0.93), sunTint, 0.40);
      vec3 farCol = mix(scatterTint, sunTint, mix(0.45, 0.85, u_duskFactor));
      vec3 rayCol = mix(nearCol, farCol, smoothstep(0.06, 0.72, distSun));

      // Restrained in crystal-clear skies; richer when clouds or golden-hour mist scatter shafts
      float shaftStrength = mix(0.14, 0.36, clamp(u_cloudWeight * 0.85 + u_duskFactor * 0.55, 0.0, 1.0));
      skyCol += rayCol * (softFilaments * occlusionMod * coneEnv * atmosBias * shaftStrength * sunVis * inten * stormSunMask);

      // Ultra-delicate near-sun optical micro-diffraction (6-blade natural aperture glint)
      if (distSun < 0.24) {
        float cos3 = rDir.x * (4.0 * rDir.x * rDir.x - 3.0);
        float sin3 = rDir.y * (3.0 - 4.0 * rDir.y * rDir.y);
        float glintWave = abs(cos3 * 0.94 - sin3 * 0.34);
        float lensShimmer = pow(clamp(glintWave, 0.0, 1.0), 28.0) * exp(-distSun * 15.0) * smoothstep(0.025, 0.055, distSun);
        skyCol += vec3(1.0, 0.97, 0.90) * (lensShimmer * 0.08 * sunVis * inten * stormSunMask);
      }
    }

    // Physical limb-darkened HDR solar photosphere with softened atmospheric edge
    float sunOcc = 1.0 - sampleCloudVeil(uv, u_time, max(u_cloudWeight, 0.22)) * (0.35 + u_cloudWeight * 0.42);
    float disk = smoothstep(0.035, 0.019, angSun);
    float limb = pow(clamp(1.0 - angSun / 0.035, 0.0, 1.0), 0.48);
    vec3 photosphere = sunTint * (2.6 + 2.2 * limb) * sunOcc;
    skyCol += photosphere * (disk * sunVis * stormSunMask);
  }

  // 5. Perspective-Projected Volumetric Layered Clouds (Cirrus, Altocumulus, Sculpted Cumulus)
  float cloudVis = clamp(max(u_cloudWeight, storm * 0.72), 0.0, 1.0);
  bool hasClouds = cloudVis > 0.01 && rd.y > -0.18;

  vec3 cirrusCol = vec3(0.0);
  float cirrusA = 0.0;
  vec3 midCol = vec3(0.0);
  float midA = 0.0;
  vec3 lowCol = vec3(0.0);
  float lowA = 0.0;

  if (hasClouds) {
    float horizonFade = smoothstep(-0.12, 0.12, rd.y);
    vec2 pPlane = rd.xz / max(0.14, rd.y + 0.42);
    pPlane += (u_mouse - 0.5) * vec2(0.16, 0.08);
    // pPlane.y decreases as rd.y rises toward the sky crown/sun, so negative y points toward the sun
    vec2 sunPlaneDir = normalize(vec2(sunDir.x, -max(0.25, sunDir.y + 0.35)));

    vec3 sunCloudTint = mix(
      vec3(1.02, 1.00, 0.97),
      vec3(1.00, 0.74, 0.50),
      u_duskFactor
    );
    sunCloudTint = mix(sunCloudTint, vec3(0.46, 0.58, 0.80), u_nightFactor);

    vec3 shadowCloudTint = mix(
      vec3(0.36, 0.48, 0.66),
      vec3(0.28, 0.20, 0.34),
      u_duskFactor
    );
    shadowCloudTint = mix(shadowCloudTint, vec3(0.08, 0.12, 0.22), u_nightFactor);

    if (storm > 0.01) {
      vec3 stormLit = mix(vec3(0.34, 0.40, 0.49), vec3(0.10, 0.14, 0.22), u_nightFactor);
      vec3 stormBelly = mix(vec3(0.14, 0.18, 0.25), vec3(0.04, 0.06, 0.11), u_nightFactor);
      sunCloudTint = mix(sunCloudTint, stormLit, storm * 0.68);
      shadowCloudTint = mix(shadowCloudTint, stormBelly, storm * 0.80);
    }

    float silverLining = miePhase(cosSun, 0.76) * 0.14 * (1.0 - u_nightFactor * 0.8) * (1.0 - storm * 0.5);

    // Layer 0: High wispy cirrus streaks
    vec2 pCirrus = pPlane * vec2(0.95, 2.2) + vec2(u_time * 0.014, 0.0);
    float cirrusN = fbmNorm(pCirrus + fbmNorm(pCirrus * 1.7) * 0.32);
    cirrusA = smoothstep(0.62, 0.84, cirrusN) * 0.26 * cloudVis * horizonFade * (1.0 - storm * 0.5);
    cirrusCol = mix(sunCloudTint, vec3(0.96, 0.98, 1.0), 0.35);

    // Layer 1: Mid-altitude altocumulus
    vec2 pMid = pPlane * 1.65 + vec2(u_time * 0.026 + 4.3, -u_time * 0.004);
    float midCov = clamp(0.42 * cloudVis + storm * 0.24, 0.0, 0.85);
    float midDen = sampleCloudDensityLayer(pMid, midCov, u_time);
    if (midDen > 0.005) {
      float midSun1 = sampleCloudDensityLayer(pMid + sunPlaneDir * 0.14, midCov, u_time);
      float midSun2 = sampleCloudDensityLayer(pMid + sunPlaneDir * 0.36, midCov, u_time);
      float midShadow = midSun1 * 0.62 + midSun2 * 0.38;
      float midLight = clamp(exp(-midShadow * 2.2) * (0.72 + 0.38 * (1.0 - midDen * 0.4)), 0.0, 1.0);
      float midCrest = clamp((midDen - midSun1) * 1.25, 0.0, 1.0);
      midA = midDen * (0.62 + storm * 0.14) * cloudVis * horizonFade;
      midCol = mix(shadowCloudTint, sunCloudTint, clamp(midLight * 0.85 + midCrest * 0.25 + 0.08, 0.0, 1.0));
      midCol += sunCloudTint * silverLining * (1.0 - midDen * 0.55);
    }

    // Layer 2: Low sculpted cumulus with crisp top-lit crowns & cool atmospheric shadow bellies
    vec2 pLow = pPlane * 1.05 + vec2(u_time * 0.042 + 11.7, u_time * 0.005);
    float lowCov = clamp(0.46 * cloudVis + storm * 0.30, 0.0, 0.88);
    float lowDen = sampleCloudDensityLayer(pLow, lowCov, u_time);
    if (lowDen > 0.005) {
      float lowSun1 = sampleCloudDensityLayer(pLow + sunPlaneDir * 0.15, lowCov, u_time);
      float lowSun2 = sampleCloudDensityLayer(pLow + sunPlaneDir * 0.38, lowCov, u_time);
      float lowShadow = lowSun1 * 0.6 + lowSun2 * 0.4;
      float beer = exp(-lowShadow * 2.65);
      float powder = 1.0 - exp(-lowDen * 3.2) * 0.35;
      float crest = clamp((lowDen - lowSun1) * 1.4, 0.0, 1.0);
      float lowLit = clamp(beer * powder * 0.86 + crest * 0.30 + 0.06, 0.0, 1.0);
      lowA = lowDen * (0.82 + storm * 0.12) * cloudVis * horizonFade;
      lowCol = mix(shadowCloudTint, sunCloudTint, lowLit);
      lowCol += sunCloudTint * silverLining * (1.0 - lowDen * 0.58);
    }
  }

  // 6. Physically-Based Continuous-Spectrum Double Rainbow + Alexander's Dark Band
  vec3 rainbowAdd = vec3(0.0);
  if (u_rainbowWeight > 0.01) {
    float rbW = clamp(u_rainbowWeight, 0.0, 1.0) * clamp(inten, 0.6, 1.35);
    vec2 rbCenter = vec2(0.04 * aspect, -0.56) + (u_mouse - 0.5) * vec2(0.04, 0.02);
    float ang = length(uv - rbCenter);

    float r1 = 0.74;
    float w1 = 0.044;
    float r2 = 0.90;
    float w2 = 0.065;

    float t1 = clamp((ang - (r1 - w1)) / (2.0 * w1), 0.0, 1.0);
    float env1 = exp(-pow((ang - r1) / (w1 * 0.68), 2.0));
    vec3 spec1 = spectralColor(t1) * env1;

    float t2 = clamp((ang - (r2 - w2)) / (2.0 * w2), 0.0, 1.0);
    float env2 = exp(-pow((ang - r2) / (w2 * 0.72), 2.0));
    vec3 spec2 = spectralColor(1.0 - t2) * env2 * 0.30;

    // Inner-bow brightening & Alexander's dark band between r1 and r2
    float innerBright = smoothstep(r1 + 0.02, r1 - 0.09, ang) * 0.036;
    float alexanderDark = smoothstep(r1 + 0.015, r1 + 0.055, ang) * smoothstep(r2 - 0.015, r2 - 0.055, ang);

    float mistMod = 0.72 + 0.28 * fbm4(uv * 2.8 + vec2(u_time * 0.015, -u_time * 0.01));
    float legFade = smoothstep(0.03, 0.28, skyY) * smoothstep(1.04, 0.76, skyY);
    float todBow = clamp(u_dayFactor + u_duskFactor * 0.72 + u_nightFactor * 0.24, 0.0, 1.0);
    float cloudVeil = 1.0 - lowA * 0.55;

    vec3 rawBow = (spec1 + spec2) * 0.42 + vec3(innerBright);
    rawBow = mix(rawBow, rawBow * vec3(1.18, 0.84, 0.62), u_duskFactor * 0.72);
    float bowLuma = dot(rawBow, vec3(0.299, 0.587, 0.114));
    rawBow = mix(rawBow, vec3(bowLuma) * vec3(0.84, 0.92, 1.05), u_nightFactor * 0.78);

    float bandMask = rbW * mistMod * legFade * todBow * cloudVeil;
    skyCol *= (1.0 - alexanderDark * 0.065 * rbW * legFade * (u_dayFactor + u_duskFactor * 0.6) * cloudVeil);
    rainbowAdd = rawBow * bandMask;
  }

  // Sequential atmospheric compositing: Cirrus -> Rainbow -> Altocumulus -> Sculpted Cumulus
  if (cirrusA > 0.002) {
    skyCol = mix(skyCol, cirrusCol, cirrusA);
  }
  skyCol += rainbowAdd;
  if (midA > 0.002) {
    skyCol = mix(skyCol, midCol, midA);
  }
  if (lowA > 0.002) {
    skyCol = mix(skyCol, lowCol, lowA);
    skyCol += rainbowAdd * lowA * 0.15;
  }

  vec3 ldr = acesToneMap(skyCol);
  outColor = vec4(ldr, 1.0);
}
`;

export interface WeatherSkyRenderParams {
  timeSec: number;
  mouseX: number;
  mouseY: number;
  sunWeight: number;
  auroraWeight: number;
  cloudWeight: number;
  stormWeight: number;
  rainbowWeight: number;
  dayFactor: number;
  duskFactor: number;
  nightFactor: number;
  intensity: number;
}

export interface WeatherSkyRenderer {
  resize: (width: number, height: number, dpr: number) => void;
  render: (params: WeatherSkyRenderParams) => void;
  dispose: () => void;
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function createWeatherSkyRenderer(
  glCanvas: HTMLCanvasElement,
  powerPreference: WebGLPowerPreference = 'low-power',
): WeatherSkyRenderer | null {
  const gl = glCanvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    powerPreference,
  });
  if (!gl) return null;

  const vs = compileShader(gl, gl.VERTEX_SHADER, WEATHER_SKY_VERTEX_SHADER);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, WEATHER_SKY_FRAGMENT_SHADER);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const vao = gl.createVertexArray();
  const buf = gl.createBuffer();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const aPos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uMouse = gl.getUniformLocation(program, 'u_mouse');
  const uSunWeight = gl.getUniformLocation(program, 'u_sunWeight');
  const uAuroraWeight = gl.getUniformLocation(program, 'u_auroraWeight');
  const uCloudWeight = gl.getUniformLocation(program, 'u_cloudWeight');
  const uStormWeight = gl.getUniformLocation(program, 'u_stormWeight');
  const uRainbowWeight = gl.getUniformLocation(program, 'u_rainbowWeight');
  const uDayFactor = gl.getUniformLocation(program, 'u_dayFactor');
  const uDuskFactor = gl.getUniformLocation(program, 'u_duskFactor');
  const uNightFactor = gl.getUniformLocation(program, 'u_nightFactor');
  const uIntensity = gl.getUniformLocation(program, 'u_intensity');

  let viewWidth = 1;
  let viewHeight = 1;

  const resize = (width: number, height: number, dprScale: number) => {
    const scale = Math.max(0.45, Math.min(2.0, dprScale));
    viewWidth = Math.max(1, Math.floor(width * scale));
    viewHeight = Math.max(1, Math.floor(height * scale));
    glCanvas.width = viewWidth;
    glCanvas.height = viewHeight;
    gl.viewport(0, 0, viewWidth, viewHeight);
  };

  const render = (p: WeatherSkyRenderParams) => {
    gl.useProgram(program);
    gl.bindVertexArray(vao);

    gl.uniform2f(uResolution, viewWidth, viewHeight);
    gl.uniform1f(uTime, p.timeSec);
    gl.uniform2f(uMouse, p.mouseX, p.mouseY);
    gl.uniform1f(uSunWeight, p.sunWeight);
    gl.uniform1f(uAuroraWeight, p.auroraWeight);
    gl.uniform1f(uCloudWeight, p.cloudWeight);
    gl.uniform1f(uStormWeight, p.stormWeight);
    gl.uniform1f(uRainbowWeight, p.rainbowWeight);
    gl.uniform1f(uDayFactor, p.dayFactor);
    gl.uniform1f(uDuskFactor, p.duskFactor);
    gl.uniform1f(uNightFactor, p.nightFactor);
    gl.uniform1f(uIntensity, p.intensity);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const dispose = () => {
    gl.deleteBuffer(buf);
    gl.deleteVertexArray(vao);
    gl.deleteProgram(program);
  };

  return { resize, render, dispose };
}
