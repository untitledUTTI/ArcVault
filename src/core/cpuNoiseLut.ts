export function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function fract(x: number): number {
  return x - Math.floor(x);
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function acesToneMapChannel(x: number): number {
  const v = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14);
  return clamp01(v);
}

export function interleavedGradientNoise(px: number, py: number): number {
  return fract(52.9829189 * fract(px * 0.06711056 + py * 0.00583715));
}

const LUT_SIZE = 256;
const LUT_MASK = LUT_SIZE - 1;

function hash2dPeriodic(ix: number, iy: number): number {
  const wx = ix & LUT_MASK;
  const wy = iy & LUT_MASK;
  let n = Math.sin(wx * 127.1 + wy * 311.7) * 43758.5453123;
  n = n - Math.floor(n);
  return n;
}

const VALUE_LUT = (() => {
  const arr = new Float32Array(LUT_SIZE * LUT_SIZE);
  for (let y = 0; y < LUT_SIZE; y++) {
    for (let x = 0; x < LUT_SIZE; x++) {
      arr[y * LUT_SIZE + x] = hash2dPeriodic(x, y);
    }
  }
  return arr;
})();

/**
 * Cache-friendly periodic bilinear value noise in [0, 1].
 */
export function noise2dLut(x: number, y: number): number {
  const fx = Math.floor(x);
  const fy = Math.floor(y);
  const tx = x - fx;
  const ty = y - fy;
  const ux = tx * tx * (3 - 2 * tx);
  const uy = ty * ty * (3 - 2 * ty);

  const ix0 = fx & LUT_MASK;
  const iy0 = fy & LUT_MASK;
  const ix1 = (ix0 + 1) & LUT_MASK;
  const iy1 = (iy0 + 1) & LUT_MASK;

  const row0 = iy0 * LUT_SIZE;
  const row1 = iy1 * LUT_SIZE;
  const v00 = VALUE_LUT[row0 + ix0];
  const v10 = VALUE_LUT[row0 + ix1];
  const v01 = VALUE_LUT[row1 + ix0];
  const v11 = VALUE_LUT[row1 + ix1];

  const a = v00 + (v10 - v00) * ux;
  const b = v01 + (v11 - v01) * ux;
  return a + (b - a) * uy;
}

/**
 * Rotated multi-octave fractal Brownian motion matching weatherSkyShader.ts.
 */
export function fbmLut(x: number, y: number, octaves = 4): number {
  let sum = 0;
  let amp = 0.5;
  let px = x;
  let py = y;
  for (let i = 0; i < octaves; i++) {
    sum += amp * noise2dLut(px, py);
    const nx = 0.8 * px - 0.6 * py;
    const ny = 0.6 * px + 0.8 * py;
    px = nx * 2.03 + 17.1;
    py = ny * 2.03 + 31.7;
    amp *= 0.5;
  }
  return sum;
}

/**
 * Geometric-series normalized FBM in [0, 1] whose mean stays centered ~0.5
 * across 2, 3, or 4 octaves.
 */
export function fbmNormLut(x: number, y: number, octaves = 4): number {
  const maxAmp = 1 - Math.pow(0.5, octaves);
  return clamp01(fbmLut(x, y, octaves) / (maxAmp > 0 ? maxAmp : 1));
}

function triWave(x: number): number {
  const d = Math.abs(fract(x) - 0.5);
  return d < 0.01 ? 0.01 : d > 0.49 ? 0.49 : d;
}

/**
 * Nimitz-style iterative triangular wave curtain noise for CPU aurora curtains.
 */
export function triNoise2dCpu(
  pxIn: number,
  pyIn: number,
  spd: number,
  t: number,
): number {
  let z = 1.8;
  let z2 = 2.5;
  let rz = 0;

  const initAng = pxIn * 0.06;
  const ic = Math.cos(initAng);
  const is = Math.sin(initAng);
  let px = pxIn * ic + pyIn * is;
  let py = -pxIn * is + pyIn * ic;

  let bpx = px;
  let bpy = py;

  const tAng = t * spd;
  const tc = Math.cos(tAng);
  const ts = Math.sin(tAng);

  const stepAng = 0.95532;
  const sc = Math.cos(stepAng);
  const ss = Math.sin(stepAng);

  for (let i = 0; i < 3; i++) {
    const tSum = triWave(bpx * 1.85 + bpy * 1.85);
    const dgx = (triWave(bpx * 1.85) + triWave(bpy * 1.85)) * 0.75;
    const dgy = (triWave(bpy * 1.85 + tSum * 0.5) + triWave(bpx * 1.85)) * 0.75;
    const rdgx = dgx * tc + dgy * ts;
    const rdgy = -dgx * ts + dgy * tc;

    px -= rdgx / z2;
    py -= rdgy / z2;
    bpx *= 1.3;
    bpy *= 1.3;
    z2 *= 0.45;
    z *= 0.42;

    const warp = 1.21 + (rz - 1.0) * 0.02;
    px *= warp;
    py *= warp;
    rz += triWave(px + triWave(py)) * z;

    const npx = -(px * sc + py * ss);
    const npy = -(-px * ss + py * sc);
    px = npx;
    py = npy;
  }

  const val = 1.0 / Math.max(0.001, Math.pow(rz * 28.0, 1.28));
  return val < 0 ? 0 : val > 0.55 ? 0.55 : val;
}
