import type { CelestialMood, CelestialSettings } from '../../types/archive';

export const DEFAULT_CELESTIAL: CelestialSettings = {
  renderMode: 'auto',
  quality: 'balanced',
  mood: 'venus-dusk',
  particleDensity: 1.0,
  glassOpacity: 0.05,
  darkMaskOpacity: 0.3,
  enableConstellations: true,
};

export function resolveMoodIndex(mood: CelestialMood): number {
  if (mood === 'venus-dusk') return 0;
  if (mood === 'parhelion-night') return 1;
  if (mood === 'dawn-rays') return 2;

  // auto-solar based on real local hour
  const hr = new Date().getHours();
  if (hr >= 5 && hr < 10) return 2; // dawn-rays
  if (hr >= 16 && hr < 20) return 0; // venus-dusk
  return 1; // parhelion-night
}

export const SKY_VERTEX_SHADER = `#version 300 es
precision highp float;
in vec2 a_pos;
out vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

/**
 * Multi-phenomenon atmospheric optics fragment shader:
 * - Belt of Venus anti-twilight pink-violet arch + Earth's Shadow
 * - Volumetric Crepuscular God-Rays with mouse parallax
 * - 22-degree Ice Halo, Chromatic Parhelia (Sundogs), and Circumzenithal Arc ("穹")
 * - Procedural twinkling deep-sky starfield
 */
export const SKY_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;
uniform int u_mood;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(17.1, 31.7);
    a *= 0.5;
  }
  return v;
}

vec3 spectrumColor(float t) {
  // Subtle ice-crystal chromatic dispersion (red inner -> gold -> cyan -> violet outer)
  vec3 r = vec3(0.98, 0.52, 0.45);
  vec3 g = vec3(0.95, 0.88, 0.68);
  vec3 b = vec3(0.50, 0.82, 1.00);
  return t < 0.5 ? mix(r, g, t * 2.0) : mix(g, b, (t - 0.5) * 2.0);
}

void main() {
  vec2 aspect = vec2(u_resolution.x / max(1.0, u_resolution.y), 1.0);
  vec2 uv = v_uv;
  vec2 parallax = (u_mouse - 0.5) * 0.045;
  vec2 p = (uv - 0.5) * aspect;

  // 1. Sky base palette by atmospheric mood
  vec3 zenithCol;
  vec3 midSkyCol;
  vec3 venusPink;
  vec3 horizonShadow;
  float rayStrength;
  float starIntensity;

  if (u_mood == 1) {
    // Parhelion Night
    zenithCol = vec3(0.015, 0.028, 0.085);
    midSkyCol = vec3(0.045, 0.085, 0.21);
    venusPink = vec3(0.32, 0.28, 0.55);
    horizonShadow = vec3(0.025, 0.04, 0.11);
    rayStrength = 0.34;
    starIntensity = 1.0;
  } else if (u_mood == 2) {
    // Dawn Rays
    zenithCol = vec3(0.035, 0.065, 0.18);
    midSkyCol = vec3(0.14, 0.20, 0.38);
    venusPink = vec3(0.86, 0.48, 0.56);
    horizonShadow = vec3(0.08, 0.09, 0.18);
    rayStrength = 0.58;
    starIntensity = 0.48;
  } else {
    // Belt of Venus Dusk (default)
    zenithCol = vec3(0.022, 0.036, 0.115);
    midSkyCol = vec3(0.105, 0.135, 0.30);
    venusPink = vec3(0.78, 0.41, 0.56);
    horizonShadow = vec3(0.035, 0.048, 0.13);
    rayStrength = 0.46;
    starIntensity = 0.72;
  }

  // Belt of Venus arch across lower-mid horizon
  float archCurve = 0.24 - 0.12 * pow((uv.x - 0.5 - parallax.x * 0.8), 2.0);
  float bandDist = uv.y - archCurve;
  float venusBand = exp(-pow(bandDist / 0.14, 2.0));
  float earthShadow = smoothstep(archCurve + 0.04, archCurve - 0.18, uv.y);

  vec3 col = mix(midSkyCol, zenithCol, smoothstep(0.28, 0.94, uv.y));
  col = mix(col, venusPink, venusBand * 0.72);
  col = mix(col, horizonShadow, earthShadow * 0.85);

  // Subtle atmospheric cirrus cloud texture
  float cloud = fbm(vec2(uv.x * 3.2 + u_time * 0.008, uv.y * 5.0) + parallax * 0.5);
  col += venusPink * cloud * 0.06 * smoothstep(0.05, 0.65, uv.y);

  // 2. Seamless Twilight Crepuscular God-Rays (zero atan seam, zero spinning)
  vec2 sunPos = vec2(0.5 + parallax.x * 1.4, 0.26 + parallax.y * 0.7);
  vec2 toSun = (uv - sunPos) * aspect;
  float sunDist = length(toSun);
  float radialFade = exp(-sunDist * 1.55) * smoothstep(0.035, 0.36, sunDist);
  if (radialFade > 0.003) {
    vec2 rDir = toSun / max(sunDist, 0.0001);
    float skyDomeMask = smoothstep(-0.10, 0.36, rDir.y);
    vec2 rayDrift = vec2(u_time * 0.014, u_time * 0.004);
    float broadRays = fbm(rDir * 2.4 + rayDrift);
    float fineRays = fbm(rDir * 5.2 - rayDrift * 0.65 + vec2(4.2, 1.9));
    float rayPattern = pow(clamp((broadRays * 0.62 + fineRays * 0.38 - 0.34) / 0.56, 0.0, 1.0), 1.75);
    vec3 rayCol = mix(venusPink, vec3(0.68, 0.85, 1.0), clamp(0.28 + rDir.y * 0.45 + sunDist * 0.35, 0.0, 1.0));
    col += rayCol * (rayPattern * radialFade * skyDomeMask * rayStrength * 0.42);
  }

  // 3. 22-degree Halo + Left/Right Parhelia (Sundogs) + Circumzenithal Arc ("穹")
  vec2 opticCenter = vec2(0.5 + parallax.x * 1.1, 0.44 + parallax.y * 0.7);
  vec2 dOpt = (uv - opticCenter) * aspect;
  float rOpt = length(dOpt);
  float haloRadius = 0.33;
  float haloMask = exp(-pow((rOpt - haloRadius) / 0.022, 2.0));
  float haloSpec = clamp((rOpt - (haloRadius - 0.03)) / 0.06, 0.0, 1.0);
  col += spectrumColor(haloSpec) * haloMask * 0.15;

  // Left & Right Parhelia (Sundogs)
  for (int side = -1; side <= 1; side += 2) {
    vec2 dogPos = opticCenter + vec2(float(side) * (haloRadius / aspect.x) * 1.02, 0.0);
    vec2 dd = (uv - dogPos) * aspect;
    float dogGlow = exp(-dot(dd * vec2(1.1, 2.3), dd * vec2(1.1, 2.3)) * 160.0);
    float dogDisp = clamp(0.5 + (dd.x * float(side)) * 14.0, 0.0, 1.0);
    col += spectrumColor(dogDisp) * dogGlow * 0.45;
  }

  // Circumzenithal Arc (inverted luminous arc near upper dome)
  vec2 czaCenter = opticCenter + vec2(0.0, 0.54);
  float czaDist = length((uv - czaCenter) * aspect);
  float czaMask = exp(-pow((czaDist - 0.31) / 0.016, 2.0)) * smoothstep(opticCenter.y + 0.16, opticCenter.y + 0.32, uv.y);
  float czaSpec = clamp((czaDist - 0.29) / 0.04, 0.0, 1.0);
  col += spectrumColor(1.0 - czaSpec) * czaMask * 0.24;

  // Subtle cursor ice-diffraction shimmer
  float mDist = length((uv - u_mouse) * aspect);
  col += vec3(0.52, 0.78, 1.0) * exp(-mDist * 7.5) * 0.08;

  // 4. Twinkling Starfield in upper sky
  vec2 starGrid = (uv + parallax * 0.3) * vec2(95.0, 56.0);
  vec2 cell = floor(starGrid);
  vec2 fcell = fract(starGrid) - 0.5;
  float starRnd = hash21(cell);
  if (starRnd > 0.968) {
    float dStar = length(fcell - (vec2(hash21(cell + 3.1), hash21(cell + 7.7)) - 0.5) * 0.55);
    float twinkle = 0.55 + 0.45 * sin(u_time * (1.8 + starRnd * 3.0) + starRnd * 40.0);
    float starMask = smoothstep(0.24, 0.02, dStar) * smoothstep(0.24, 0.72, uv.y);
    col += vec3(0.84, 0.92, 1.0) * starMask * twinkle * starIntensity * 0.85;
  }

  // Vignette for comfortable reading focus
  float vig = 1.0 - dot(p * 0.52, p * 0.52);
  col *= clamp(vig, 0.72, 1.02);

  outColor = vec4(col, 1.0);
}
`;

export const PARTICLE_VERTEX_SHADER = `#version 300 es
precision highp float;

in vec2 a_seed;      // x: baseX [0..1], y: baseY [0..1]
in vec2 a_meta;      // x: speed/depth, y: phase

uniform float u_time;
uniform vec2 u_mouse;
uniform float u_dpr;

out float v_alpha;
out float v_phase;

void main() {
  float speed = 0.012 + a_meta.x * 0.022;
  float x = fract(a_seed.x + u_time * speed * 0.65 + sin(u_time * 0.35 + a_meta.y) * 0.015);
  float y = fract(a_seed.y - u_time * speed * 0.42);

  vec2 pos = vec2(x, y);
  // Pointer flow-field swirl: diamond dust scatters gently when brushed by mouse
  vec2 diff = pos - u_mouse;
  float dist = length(diff);
  if (dist < 0.22 && dist > 0.001) {
    float push = (1.0 - dist / 0.22);
    pos += normalize(diff) * push * 0.045;
  }

  float glint = pow(0.5 + 0.5 * sin(u_time * (2.2 + a_meta.x * 2.5) + a_meta.y * 6.283), 4.0);
  float proximityBoost = dist < 0.24 ? (1.0 - dist / 0.24) * 0.55 : 0.0;

  v_alpha = (0.18 + glint * 0.68 + proximityBoost) * (0.5 + a_meta.x * 0.5);
  v_phase = a_meta.y;

  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = (3.5 + a_meta.x * 6.0 + glint * 3.0) * u_dpr;
}
`;

export const PARTICLE_FRAGMENT_SHADER = `#version 300 es
precision highp float;

in float v_alpha;
in float v_phase;
out vec4 outColor;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  // 4-point diamond crystal sparkle shape
  float star = exp(-abs(c.x) * 14.0) * exp(-abs(c.y) * 3.2) +
               exp(-abs(c.y) * 14.0) * exp(-abs(c.x) * 3.2);
  float core = smoothstep(0.32, 0.0, length(c));
  float mask = clamp(star * 0.75 + core * 0.85, 0.0, 1.0);

  // Subtle ice-prism iridescence
  vec3 tint = mix(vec3(0.75, 0.90, 1.0), vec3(1.0, 0.80, 0.92), 0.5 + 0.5 * sin(v_phase * 12.0));
  outColor = vec4(tint, mask * v_alpha);
}
`;
