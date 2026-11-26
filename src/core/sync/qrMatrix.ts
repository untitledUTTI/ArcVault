/**
 * Pure-TypeScript QR Code matrix generator (Byte mode, EC Level L, Versions 2-6).
 * Self-contained with GF(256) Reed-Solomon error correction and zero dependencies.
 */

interface QrVersionSpec {
  version: number;
  size: number;
  dataCodewords: number;
  ecCodewordsPerBlock: number;
  blocks: number;
  alignCenters: number[];
}

const VERSION_SPECS: QrVersionSpec[] = [
  { version: 2, size: 25, dataCodewords: 34, ecCodewordsPerBlock: 10, blocks: 1, alignCenters: [6, 18] },
  { version: 3, size: 29, dataCodewords: 55, ecCodewordsPerBlock: 15, blocks: 1, alignCenters: [6, 22] },
  { version: 4, size: 33, dataCodewords: 80, ecCodewordsPerBlock: 20, blocks: 1, alignCenters: [6, 26] },
  { version: 5, size: 37, dataCodewords: 108, ecCodewordsPerBlock: 26, blocks: 1, alignCenters: [6, 30] },
  { version: 6, size: 41, dataCodewords: 136, ecCodewordsPerBlock: 18, blocks: 2, alignCenters: [6, 34] },
];

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);

(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    GF_EXP[i] = GF_EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a] + GF_LOG[b]];
}

function buildRsGenerator(degree: number): Uint8Array {
  let poly: number[] = [1];
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    const root = GF_EXP[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return Uint8Array.from(poly);
}

function computeRsRemainder(data: Uint8Array, ecLen: number): Uint8Array {
  const gen = buildRsGenerator(ecLen);
  const res = new Uint8Array(ecLen);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ res[0];
    res.copyWithin(0, 1);
    res[ecLen - 1] = 0;
    if (factor !== 0) {
      for (let j = 0; j < ecLen; j++) {
        res[j] ^= gfMul(gen[j + 1], factor);
      }
    }
  }
  return res;
}

function pushBits(bits: number[], value: number, count: number): void {
  for (let i = count - 1; i >= 0; i--) {
    bits.push((value >>> i) & 1);
  }
}

function placeFinder(
  modules: boolean[][],
  reserved: boolean[][],
  top: number,
  left: number,
): void {
  const size = modules.length;
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const rr = top + r;
      const cc = left + c;
      if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
      reserved[rr][cc] = true;
      const inOuter = r === 0 || r === 6 || c === 0 || c === 6;
      const inInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      const inBorder = r >= 0 && r <= 6 && c >= 0 && c <= 6;
      modules[rr][cc] = inBorder && (inOuter || inInner);
    }
  }
}

function placeAlignment(
  modules: boolean[][],
  reserved: boolean[][],
  centerR: number,
  centerC: number,
): void {
  if (reserved[centerR][centerC]) return;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rr = centerR + r;
      const cc = centerC + c;
      reserved[rr][cc] = true;
      modules[rr][cc] =
        Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
    }
  }
}

// Precomputed 15-bit BCH format string for EC Level L (01) + Mask 0 (000) => 0x77C4
const FORMAT_BITS_L_MASK0 = 0x77c4;

function writeFormatInfo(modules: boolean[][], reserved: boolean[][]): void {
  const size = modules.length;
  for (let i = 0; i < 15; i++) {
    const bit = ((FORMAT_BITS_L_MASK0 >>> i) & 1) === 1;
    // Top-left vertical + horizontal
    if (i < 6) {
      modules[i][8] = bit;
      reserved[i][8] = true;
    } else if (i < 8) {
      modules[i + 1][8] = bit;
      reserved[i + 1][8] = true;
    } else {
      modules[size - 15 + i][8] = bit;
      reserved[size - 15 + i][8] = true;
    }

    if (i < 8) {
      modules[8][size - i - 1] = bit;
      reserved[8][size - i - 1] = true;
    } else if (i < 9) {
      modules[8][7] = bit;
      reserved[8][7] = true;
    } else {
      modules[8][14 - i] = bit;
      reserved[8][14 - i] = true;
    }
  }
}

export function generateQrMatrix(text: string): boolean[][] {
  const rawBytes = new TextEncoder().encode(text);
  const maxCapacity = VERSION_SPECS[VERSION_SPECS.length - 1].dataCodewords - 2;
  const payload =
    rawBytes.length > maxCapacity ? rawBytes.slice(0, maxCapacity) : rawBytes;

  const spec =
    VERSION_SPECS.find((s) => payload.length + 2 <= s.dataCodewords) ??
    VERSION_SPECS[VERSION_SPECS.length - 1];

  // Encode byte-mode bit stream
  const bits: number[] = [];
  pushBits(bits, 0b0100, 4); // Byte mode indicator
  pushBits(bits, payload.length, 8); // Char count (8 bits for V1-9)
  for (let i = 0; i < payload.length; i++) {
    pushBits(bits, payload[i], 8);
  }

  const maxBits = spec.dataCodewords * 8;
  const termLen = Math.min(4, maxBits - bits.length);
  for (let i = 0; i < termLen; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);

  const dataBytes = new Uint8Array(spec.dataCodewords);
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
    dataBytes[i / 8] = b;
  }
  const padBytes = [0xec, 0x11];
  for (let i = bits.length / 8, p = 0; i < spec.dataCodewords; i++, p++) {
    dataBytes[i] = padBytes[p % 2];
  }

  // Split blocks & compute RS ECC
  const blockSize = Math.floor(spec.dataCodewords / spec.blocks);
  const dataBlocks: Uint8Array[] = [];
  const ecBlocks: Uint8Array[] = [];
  for (let b = 0; b < spec.blocks; b++) {
    const start = b * blockSize;
    const end = b === spec.blocks - 1 ? spec.dataCodewords : start + blockSize;
    const slice = dataBytes.slice(start, end);
    dataBlocks.push(slice);
    ecBlocks.push(computeRsRemainder(slice, spec.ecCodewordsPerBlock));
  }

  const interleaved: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (const blk of dataBlocks) {
      if (i < blk.length) interleaved.push(blk[i]);
    }
  }
  for (let i = 0; i < spec.ecCodewordsPerBlock; i++) {
    for (const ec of ecBlocks) {
      if (i < ec.length) interleaved.push(ec[i]);
    }
  }

  const size = spec.size;
  const modules: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    new Array<boolean>(size).fill(false),
  );

  // Finder patterns
  placeFinder(modules, reserved, 0, 0);
  placeFinder(modules, reserved, 0, size - 7);
  placeFinder(modules, reserved, size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    const dark = i % 2 === 0;
    modules[6][i] = dark;
    reserved[6][i] = true;
    modules[i][6] = dark;
    reserved[i][6] = true;
  }

  // Alignment patterns
  for (const r of spec.alignCenters) {
    for (const c of spec.alignCenters) {
      placeAlignment(modules, reserved, r, c);
    }
  }

  // Dark module & reserve format info strips
  modules[size - 8][8] = true;
  reserved[size - 8][8] = true;
  writeFormatInfo(modules, reserved);

  // Place data bits in zig-zag order + Mask 0 ((r + c) % 2 === 0)
  const bitStream: number[] = [];
  for (const byte of interleaved) {
    pushBits(bitStream, byte, 8);
  }

  let bitIdx = 0;
  let dirUp = true;
  for (let col = size - 1; col >= 1; col -= 2) {
    if (col === 6) col--;
    for (let step = 0; step < size; step++) {
      const row = dirUp ? size - 1 - step : step;
      for (const cOffset of [0, -1]) {
        const c = col + cOffset;
        if (c < 0 || reserved[row][c]) continue;
        const rawBit = bitIdx < bitStream.length ? bitStream[bitIdx++] === 1 : false;
        const maskBit = (row + c) % 2 === 0;
        modules[row][c] = rawBit !== maskBit;
      }
    }
    dirUp = !dirUp;
  }

  return modules;
}
