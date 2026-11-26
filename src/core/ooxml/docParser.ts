import { DOMParser, type Element as XmlElement, type Node as XmlNode } from '@xmldom/xmldom';
import {
  INSERTION_ANCHOR_TOKEN,
  parseDocxBytes,
  type CommentMeta,
  type ParsedBlock,
  type ParsedDocxBundle,
  type ParsedSegment,
  type RevisionMeta,
} from './docxParser';
import type { CitationSidecarEntry } from '../../types/archive';

const FREESECT = 0xffffffff;
const ENDOFCHAIN = 0xfffffffe;
const NOSTREAM = 0xffffffff;

// Spec-exact [MS-DOC] FibRgFcLcb97 pair indices (from fcLcbStart = lwStart + cslw*4 + 2)
const IDX_PLCFANDREF = 4; // 0x00BA
const IDX_PLCFANDTXT = 5; // 0x00C2
const IDX_PLCFBTECHPX = 12; // 0x00FA
const IDX_CLX = 33; // 0x01A2
const IDX_GRPXSTATNOWNERS = 36; // 0x01BA
const IDX_PLCFATNBKF = 42; // 0x01EA
const IDX_PLCFATNBKL = 43; // 0x01F2
const IDX_STTBRMARK = 51; // 0x0232

export function isZipHeader(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04
  );
}

export function isOle2Header(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0 &&
    bytes[4] === 0xa1 &&
    bytes[5] === 0xb1 &&
    bytes[6] === 0x1a &&
    bytes[7] === 0xe1
  );
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function decodeUtf16Le(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    return new TextDecoder('utf-16le').decode(bytes);
  }
  let out = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    out += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  }
  return out;
}

function decodeWin1252(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    try {
      return new TextDecoder('windows-1252').decode(bytes);
    } catch {
      // fall through
    }
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function decodeGb18030(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') {
    for (const enc of ['gb18030', 'gbk', 'utf-8']) {
      try {
        return new TextDecoder(enc).decode(bytes);
      } catch {
        // try next
      }
    }
  }
  return decodeWin1252(bytes);
}

function detectHeadingByText(text: string): number | undefined {
  const t = text.trim();
  if (!t || t.length > 90) return undefined;
  // TOC lines typically end with a tab + page number; keep them as body lines, not headings
  if (/\t\s*\d+\s*$/.test(t)) return undefined;
  if (/^第[一二三四五六七八九十百0-9]+章[\s：:]?/.test(t)) return 1;
  if (/^(摘要|Abstract|摘\s*要|目\s*录|引言|绪论|结论|致谢|参考文献)$/i.test(t)) return 1;
  if (/^\d+\.\d+\.\d+\s+\S/.test(t)) return 3;
  if (/^\d+\.\d+\s+\S/.test(t)) return 2;
  if (/^\d+\s+[\u4e00-\u9fa5A-Za-z]/.test(t) && t.length < 48) return 1;
  return undefined;
}

function isBodyStartText(text: string): boolean {
  const t = text.trim();
  if (/\t\s*\d+\s*$/.test(t)) return false;
  return /^(摘要|Abstract|摘\s*要|目\s*录|引言|绪论|第[一二三四五六七八九十1-9]+章|1[\.\s、])/.test(t);
}

function isFrontMatterDeclarationText(text: string): boolean {
  const t = text.trim();
  return /^(原创性声明|独创性声明|学位论文原创性声明|版权使用授权书|学位论文版权使用授权书|关于论文使用授权|授权声明|版权声明|Statement of Originality|Thesis Declaration)/i.test(
    t,
  );
}

function buildParagraphXml(text: string, headingLevel?: number, hasBreakAfter = false): string {
  const pPr = headingLevel ? `<w:pPr><w:pStyle w:val="Heading${headingLevel}"/></w:pPr>` : '';
  const br = hasBreakAfter ? '<w:r><w:br w:type="page"/></w:r>' : '';
  const run = text ? `<w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>` : '';
  return `<w:p>${pPr}${run}${br}</w:p>`;
}

function buildTableXml(rows: string[][]): string {
  const trs = rows
    .map(
      (row) =>
        `<w:tr>${row
          .map(
            (cell) =>
              `<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tcBorders></w:tcPr><w:p><w:r><w:t xml:space="preserve">${escapeXml(cell)}</w:t></w:r></w:p></w:tc>`,
          )
          .join('')}</w:tr>`,
    )
    .join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>${trs}</w:tbl>`;
}

function detectCoverCutoff(blocks: ParsedBlock[]): number {
  const scanLimit = Math.min(blocks.length, 120);
  for (let i = 0; i < scanLimit; i++) {
    const b = blocks[i];
    if (b.isCoverSdt) continue;
    if (b.hasExplicitBreakAfter || b.kind === 'page-break') {
      let nextNonEmpty: ParsedBlock | undefined;
      for (let j = i + 1; j < scanLimit; j++) {
        const nb = blocks[j];
        if (nb.kind !== 'page-break' && nb.previewText.trim().length > 0) {
          nextNonEmpty = nb;
          break;
        }
      }
      if (nextNonEmpty && isFrontMatterDeclarationText(nextNonEmpty.previewText)) {
        continue;
      }
      return i + 1;
    }
    if (i > 0 && (b.kind === 'heading' || isBodyStartText(b.previewText))) {
      if (!isFrontMatterDeclarationText(b.previewText)) {
        return i;
      }
    }
  }
  return 0;
}

/**
 * Reads all streams from a Microsoft Compound File Binary Format (OLE2/CFBF) container.
 */
export function readOle2Streams(bytes: Uint8Array): Map<string, Uint8Array> {
  if (!isOle2Header(bytes) || bytes.length < 512) {
    throw new Error('无效的 OLE2 复合文档头');
  }

  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const sectorShift = dv.getUint16(0x1e, true);
  const miniSectorShift = dv.getUint16(0x20, true);
  const sectorSize = 1 << sectorShift;
  const miniSectorSize = 1 << miniSectorShift;

  if (sectorSize < 512 || sectorSize > 65536 || miniSectorSize < 16 || miniSectorSize > sectorSize) {
    throw new Error('OLE2 扇区尺寸异常');
  }

  const numFatSectors = dv.getUint32(0x2c, true);
  const firstDirSector = dv.getUint32(0x30, true);
  const miniStreamCutoff = dv.getUint32(0x38, true);
  const firstMiniFatSector = dv.getUint32(0x3c, true);
  const firstDifatSector = dv.getUint32(0x44, true);
  const numDifatSectors = dv.getUint32(0x48, true);

  const sectorOffset = (sid: number) => (sid + 1) * sectorSize;

  // 1. Gather FAT sector IDs from header DIFAT (109 entries) + chained DIFAT sectors
  const fatSectorIds: number[] = [];
  for (let i = 0; i < 109 && fatSectorIds.length < numFatSectors; i++) {
    const sid = dv.getUint32(0x4c + i * 4, true);
    if (sid < 0xfffffff0) fatSectorIds.push(sid);
  }

  let difatSid = firstDifatSector;
  let difatSteps = 0;
  const visitedDifat = new Set<number>();
  const entriesPerDifat = sectorSize / 4 - 1;
  while (
    difatSteps < numDifatSectors &&
    difatSid < 0xfffffff0 &&
    !visitedDifat.has(difatSid) &&
    fatSectorIds.length < numFatSectors
  ) {
    visitedDifat.add(difatSid);
    const off = sectorOffset(difatSid);
    if (off + sectorSize > bytes.length) break;
    for (let i = 0; i < entriesPerDifat && fatSectorIds.length < numFatSectors; i++) {
      const sid = dv.getUint32(off + i * 4, true);
      if (sid < 0xfffffff0) fatSectorIds.push(sid);
    }
    difatSid = dv.getUint32(off + entriesPerDifat * 4, true);
    difatSteps++;
  }

  // 2. Build full FAT table
  const entriesPerSector = sectorSize / 4;
  const fat = new Uint32Array(fatSectorIds.length * entriesPerSector);
  for (let s = 0; s < fatSectorIds.length; s++) {
    const off = sectorOffset(fatSectorIds[s]);
    if (off + sectorSize > bytes.length) continue;
    for (let i = 0; i < entriesPerSector; i++) {
      fat[s * entriesPerSector + i] = dv.getUint32(off + i * 4, true);
    }
  }

  const readSectorChain = (startSid: number, maxBytes?: number): Uint8Array => {
    if (startSid >= 0xfffffff0) return new Uint8Array(0);
    const chunks: Uint8Array[] = [];
    const visited = new Set<number>();
    let cur = startSid;
    let total = 0;
    while (cur < 0xfffffff0 && cur < fat.length && !visited.has(cur)) {
      visited.add(cur);
      const off = sectorOffset(cur);
      if (off + sectorSize > bytes.length) break;
      const sliceLen =
        maxBytes !== undefined ? Math.min(sectorSize, Math.max(0, maxBytes - total)) : sectorSize;
      if (sliceLen <= 0) break;
      chunks.push(bytes.subarray(off, off + sliceLen));
      total += sliceLen;
      if (maxBytes !== undefined && total >= maxBytes) break;
      const next = fat[cur];
      if (next === ENDOFCHAIN || next === FREESECT) break;
      cur = next;
    }
    const out = new Uint8Array(total);
    let pos = 0;
    for (const c of chunks) {
      out.set(c, pos);
      pos += c.length;
    }
    return out;
  };

  // 3. Parse directory entries
  const dirBytes = readSectorChain(firstDirSector);
  const dirDv = new DataView(dirBytes.buffer, dirBytes.byteOffset, dirBytes.byteLength);

  interface DirEntry {
    name: string;
    type: number;
    startSid: number;
    size: number;
  }
  const entries: DirEntry[] = [];
  for (let off = 0; off + 128 <= dirBytes.length; off += 128) {
    const type = dirBytes[off + 0x42];
    if (type === 0) continue;
    const nameByteLen = Math.min(64, dirDv.getUint16(off + 0x40, true));
    const rawName = dirBytes.subarray(off, off + Math.max(0, nameByteLen - 2));
    const name = decodeUtf16Le(rawName).replace(/\0/g, '');
    const startSid = dirDv.getUint32(off + 0x74, true);
    const size = dirDv.getUint32(off + 0x78, true);
    entries.push({ name, type, startSid, size });
  }

  const rootEntry = entries.find((e) => e.type === 5);
  const rootMiniStream =
    rootEntry && rootEntry.size > 0 && rootEntry.startSid !== NOSTREAM
      ? readSectorChain(rootEntry.startSid, rootEntry.size)
      : new Uint8Array(0);

  const miniFatBytes =
    firstMiniFatSector < 0xfffffff0 ? readSectorChain(firstMiniFatSector) : new Uint8Array(0);
  const miniFat = new Uint32Array(Math.floor(miniFatBytes.length / 4));
  const mfDv = new DataView(miniFatBytes.buffer, miniFatBytes.byteOffset, miniFatBytes.byteLength);
  for (let i = 0; i < miniFat.length; i++) {
    miniFat[i] = mfDv.getUint32(i * 4, true);
  }

  const readMiniChain = (startSid: number, streamSize: number): Uint8Array => {
    const out = new Uint8Array(streamSize);
    const visited = new Set<number>();
    let cur = startSid;
    let pos = 0;
    while (cur < 0xfffffff0 && cur < miniFat.length && !visited.has(cur) && pos < streamSize) {
      visited.add(cur);
      const off = cur * miniSectorSize;
      if (off + miniSectorSize > rootMiniStream.length) break;
      const copyLen = Math.min(miniSectorSize, streamSize - pos);
      out.set(rootMiniStream.subarray(off, off + copyLen), pos);
      pos += copyLen;
      const next = miniFat[cur];
      if (next === ENDOFCHAIN || next === FREESECT) break;
      cur = next;
    }
    return pos === streamSize ? out : out.subarray(0, pos);
  };

  const streams = new Map<string, Uint8Array>();
  for (const e of entries) {
    if (e.type !== 2) continue;
    if (e.size === 0 || e.startSid >= 0xfffffff0) {
      streams.set(e.name, new Uint8Array(0));
    } else if (e.size < miniStreamCutoff && miniFat.length > 0 && rootMiniStream.length > 0) {
      streams.set(e.name, readMiniChain(e.startSid, e.size));
    } else {
      streams.set(e.name, readSectorChain(e.startSid, e.size));
    }
  }
  return streams;
}

interface TextPiece {
  cpStart: number;
  cpEnd: number;
  byteStart: number;
  byteEnd: number;
  isAnsi: boolean;
  text: string;
}

interface CommentAnchor {
  startCp: number;
  endCp: number;
  commentId: string;
}

interface RawRevisionSpan {
  kind: 'delete' | 'insert';
  cpStart: number;
  cpEnd: number;
  author: string;
  date: string;
}

interface ResolvedRevisionSpan {
  id: string;
  kind: 'delete' | 'insert' | 'replace';
  cpStart: number;
  cpEnd: number;
  origStart: number;
  origEnd: number;
  insStart: number;
  insEnd: number;
}

function sliceCpRange(pieces: TextPiece[], fromCp: number, toCp: number): string {
  if (toCp <= fromCp) return '';
  let out = '';
  for (const p of pieces) {
    if (p.cpEnd <= fromCp || p.cpStart >= toCp) continue;
    const s = Math.max(0, fromCp - p.cpStart);
    const e = Math.min(p.text.length, toCp - p.cpStart);
    if (e > s) out += p.text.slice(s, e);
  }
  return out;
}

function getStreamCaseInsensitive(streams: Map<string, Uint8Array>, target: string): Uint8Array | undefined {
  const exact = streams.get(target);
  if (exact) return exact;
  const lower = target.toLowerCase();
  for (const [k, v] of streams.entries()) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function parseSttbf(bytes: Uint8Array, fc: number, lcb: number): string[] {
  if (lcb < 6 || fc + lcb > bytes.length) return [];
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const fExtend = dv.getUint16(fc, true);
  const out: string[] = [];

  if (fExtend === 0xffff) {
    const cData = dv.getUint16(fc + 2, true);
    const cbExtra = dv.getUint16(fc + 4, true);
    let pos = fc + 6;
    const end = fc + lcb;
    for (let i = 0; i < cData && pos + 2 <= end; i++) {
      const cch = dv.getUint16(pos, true);
      pos += 2;
      const byteLen = cch * 2;
      if (pos + byteLen > end) break;
      out.push(decodeUtf16Le(bytes.subarray(pos, pos + byteLen)).replace(/\0/g, '').trim());
      pos += byteLen + cbExtra;
    }
  } else {
    const cData = fExtend;
    const cbExtra = dv.getUint16(fc + 2, true);
    let pos = fc + 4;
    const end = fc + lcb;
    for (let i = 0; i < cData && pos < end; i++) {
      const cch = bytes[pos++];
      if (pos + cch > end) break;
      out.push(decodeWin1252(bytes.subarray(pos, pos + cch)).replace(/\0/g, '').trim());
      pos += cch + cbExtra;
    }
  }
  return out;
}

function decodeWordDttm(dttm: number): string {
  const dom = (dttm >>> 11) & 0x1f;
  const mon = (dttm >>> 16) & 0x0f;
  const yr = (dttm >>> 20) & 0x1ff;
  if (dttm === 0 || mon < 1 || mon > 12 || dom < 1 || dom > 31) {
    return new Date().toISOString().slice(0, 10);
  }
  return `${1900 + yr}-${String(mon).padStart(2, '0')}-${String(dom).padStart(2, '0')}`;
}

function parseChpxRevisionSprms(grpprl: Uint8Array): {
  isDeleted: boolean;
  isInserted: boolean;
  ibstIns?: number;
  ibstDel?: number;
  dttmIns?: number;
  dttmDel?: number;
} {
  let isDeleted = false;
  let isInserted = false;
  let ibstIns: number | undefined;
  let ibstDel: number | undefined;
  let dttmIns: number | undefined;
  let dttmDel: number | undefined;

  let pos = 0;
  while (pos + 2 <= grpprl.length) {
    const sprm = grpprl[pos] | (grpprl[pos + 1] << 8);
    pos += 2;
    const spra = (sprm >>> 13) & 0x07;
    let opLen = 0;
    switch (spra) {
      case 0:
      case 1:
        opLen = 1;
        break;
      case 2:
      case 4:
      case 5:
        opLen = 2;
        break;
      case 3:
        opLen = 4;
        break;
      case 7:
        opLen = 3;
        break;
      case 6: {
        if (pos >= grpprl.length) {
          pos = grpprl.length;
          break;
        }
        if (sprm === 0xd608 && pos + 2 <= grpprl.length) {
          opLen = grpprl[pos] | (grpprl[pos + 1] << 8);
          pos += 2;
        } else {
          opLen = grpprl[pos];
          pos += 1;
        }
        break;
      }
      default:
        opLen = 0;
        break;
    }

    if (pos + opLen > grpprl.length) break;

    if (sprm === 0x0800 && opLen >= 1) {
      isDeleted = grpprl[pos] !== 0;
    } else if (sprm === 0x0801 && opLen >= 1) {
      isInserted = grpprl[pos] !== 0;
    } else if (sprm === 0x4804 && opLen >= 2) {
      ibstIns = grpprl[pos] | (grpprl[pos + 1] << 8);
    } else if (sprm === 0x4863 && opLen >= 2) {
      ibstDel = grpprl[pos] | (grpprl[pos + 1] << 8);
    } else if (sprm === 0x6805 && opLen >= 4) {
      dttmIns =
        (grpprl[pos] |
          (grpprl[pos + 1] << 8) |
          (grpprl[pos + 2] << 16) |
          (grpprl[pos + 3] << 24)) >>>
        0;
    } else if (sprm === 0x6864 && opLen >= 4) {
      dttmDel =
        (grpprl[pos] |
          (grpprl[pos + 1] << 8) |
          (grpprl[pos + 2] << 16) |
          (grpprl[pos + 3] << 24)) >>>
        0;
    }

    pos += opLen;
  }

  return { isDeleted, isInserted, ibstIns, ibstDel, dttmIns, dttmDel };
}

function parseOle2WordDoc(rawBytes: Uint8Array): ParsedDocxBundle {
  const streams = readOle2Streams(rawBytes);
  const wordDoc = getStreamCaseInsensitive(streams, 'WordDocument');
  if (!wordDoc || wordDoc.length < 0x22) {
    throw new Error('该 .doc 文件缺少 WordDocument 主流，无法解析');
  }

  const wdDv = new DataView(wordDoc.buffer, wordDoc.byteOffset, wordDoc.byteLength);
  const wIdent = wdDv.getUint16(0x00, true);
  if (wIdent !== 0xa5ec && wIdent !== 0xa5dc && wIdent !== 0xa5db) {
    throw new Error('该 OLE2 文件不是有效的 Word (.doc) 二进制文档');
  }

  const flags = wdDv.getUint16(0x0a, true);
  if ((flags & 0x0100) !== 0) {
    throw new Error('该 .doc 文档已加密，暂不支持直接解析受密码保护的旧版 Word 文档');
  }

  const tableName = (flags & 0x0200) !== 0 ? '1Table' : '0Table';
  const tableStream = getStreamCaseInsensitive(streams, tableName);

  // Navigate FibRgW -> FibRgLw -> FibRgFcLcb dynamically per [MS-DOC]
  const csw = wdDv.getUint16(0x20, true);
  const lwBase = 0x22 + csw * 2;
  const cslw = lwBase + 2 <= wordDoc.length ? wdDv.getUint16(lwBase, true) : 0;
  const lwStart = lwBase + 2;
  const getLw = (idx: number): number =>
    idx < cslw && lwStart + idx * 4 + 4 <= wordDoc.length
      ? wdDv.getUint32(lwStart + idx * 4, true)
      : 0;

  const ccpText = getLw(3);
  const ccpFtn = getLw(4);
  const ccpHdd = getLw(5);
  const ccpMcr = getLw(6);
  const ccpAtn = getLw(7);

  const fcLcbBase = lwStart + cslw * 4;
  const cbRgFcLcb = fcLcbBase + 2 <= wordDoc.length ? wdDv.getUint16(fcLcbBase, true) : 0;
  const fcLcbStart = fcLcbBase + 2;
  const getFcLcb = (idx: number): { fc: number; lcb: number } => {
    if (idx >= cbRgFcLcb || fcLcbStart + idx * 8 + 8 > wordDoc.length) {
      return { fc: 0, lcb: 0 };
    }
    return {
      fc: wdDv.getUint32(fcLcbStart + idx * 8, true),
      lcb: wdDv.getUint32(fcLcbStart + idx * 8 + 4, true),
    };
  };

  // Extract Piece Table (Clx, index 33)
  const pieces: TextPiece[] = [];
  const clxInfo = getFcLcb(IDX_CLX);
  if (tableStream && clxInfo.lcb > 0 && clxInfo.fc + clxInfo.lcb <= tableStream.length) {
    const tDv = new DataView(tableStream.buffer, tableStream.byteOffset, tableStream.byteLength);
    let pos = clxInfo.fc;
    const end = clxInfo.fc + clxInfo.lcb;

    while (pos < end && tableStream[pos] === 0x01) {
      if (pos + 3 > end) break;
      const cbGrpprl = tDv.getInt16(pos + 1, true);
      pos += 3 + Math.max(0, cbGrpprl);
    }

    if (pos + 5 <= end && tableStream[pos] === 0x02) {
      const pcdtSize = tDv.getUint32(pos + 1, true);
      const pcdtStart = pos + 5;
      const safePcdtSize = Math.min(pcdtSize, end - pcdtStart);
      if (safePcdtSize >= 16) {
        const nPieces = Math.floor((safePcdtSize - 4) / 12);
        const pcdArrayStart = pcdtStart + (nPieces + 1) * 4;
        for (let i = 0; i < nPieces; i++) {
          const cpStart = tDv.getUint32(pcdtStart + i * 4, true);
          const cpEnd = tDv.getUint32(pcdtStart + (i + 1) * 4, true);
          const charCount = cpEnd - cpStart;
          if (charCount <= 0) continue;

          const fcCompressed = tDv.getUint32(pcdArrayStart + i * 8 + 2, true);
          const isAnsi = (fcCompressed & 0x40000000) !== 0;
          let text = '';
          let byteStart = 0;
          let byteEnd = 0;
          if (isAnsi) {
            byteStart = (fcCompressed & 0x3fffffff) >>> 1;
            byteEnd = Math.min(wordDoc.length, byteStart + charCount);
            if (byteStart < wordDoc.length) {
              text = decodeWin1252(wordDoc.subarray(byteStart, byteEnd));
            }
          } else {
            byteStart = fcCompressed & 0x3fffffff;
            byteEnd = Math.min(wordDoc.length, byteStart + charCount * 2);
            if (byteStart < wordDoc.length) {
              text = decodeUtf16Le(wordDoc.subarray(byteStart, byteEnd));
            }
          }
          pieces.push({ cpStart, cpEnd, byteStart, byteEnd, isAnsi, text });
        }
      }
    }
  }

  // Fallback for non-complex legacy Word files lacking Clx
  if (pieces.length === 0) {
    const fcMin = wdDv.getUint32(0x18, true);
    const fcMac = wdDv.getUint32(0x1c, true);
    if (fcMac > fcMin && fcMac <= wordDoc.length) {
      const slice = wordDoc.subarray(fcMin, fcMac);
      const isAnsi = (flags & 0x0002) !== 0;
      const text = isAnsi ? decodeWin1252(slice) : decodeUtf16Le(slice);
      pieces.push({ cpStart: 0, cpEnd: text.length, byteStart: fcMin, byteEnd: fcMac, isAnsi, text });
    }
  }

  const maxCp = ccpText > 0 ? ccpText : pieces.reduce((m, p) => Math.max(m, p.cpEnd), 0);

  // Extract Word comments using exact FibRgFcLcb97 indices:
  // PlcfandRef (4), PlcfandTxt (5), GrpXstAtnOwners (36), PlcfAtnBkf (42), PlcfAtnBkl (43)
  const commentsMap: Record<string, CommentMeta> = {};
  const commentAnchors: CommentAnchor[] = [];
  if (ccpAtn > 0 && tableStream) {
    const tDv = new DataView(tableStream.buffer, tableStream.byteOffset, tableStream.byteLength);
    const ownersInfo = getFcLcb(IDX_GRPXSTATNOWNERS);
    const owners: string[] = [];
    if (ownersInfo.lcb > 0 && ownersInfo.fc + ownersInfo.lcb <= tableStream.length) {
      let off = ownersInfo.fc;
      const oEnd = ownersInfo.fc + ownersInfo.lcb;
      while (off + 2 <= oEnd) {
        const cch = tDv.getUint16(off, true);
        off += 2;
        const byteLen = cch * 2;
        if (off + byteLen > oEnd) break;
        owners.push(decodeUtf16Le(tableStream.subarray(off, off + byteLen)).replace(/\0/g, '').trim());
        off += byteLen;
      }
    }

    // Parse annotation highlight bookmark spans from PlcfAtnBkf (42) + PlcfAtnBkl (43)
    const atnBookmarks: Array<{ startCp: number; endCp: number }> = [];
    const bkfInfo = getFcLcb(IDX_PLCFATNBKF);
    const bklInfo = getFcLcb(IDX_PLCFATNBKL);
    if (
      bkfInfo.lcb >= 8 &&
      bklInfo.lcb >= 4 &&
      bkfInfo.fc + bkfInfo.lcb <= tableStream.length &&
      bklInfo.fc + bklInfo.lcb <= tableStream.length
    ) {
      const mBkf = Math.floor((bkfInfo.lcb - 4) / 8);
      const mBkl = Math.floor(bklInfo.lcb / 4);
      const fbkfBase = bkfInfo.fc + (mBkf + 1) * 4;
      for (let b = 0; b < mBkf; b++) {
        const startCp = tDv.getUint32(bkfInfo.fc + b * 4, true);
        const ibkl = tDv.getUint16(fbkfBase + b * 4, true);
        const endCp = ibkl < mBkl ? tDv.getUint32(bklInfo.fc + ibkl * 4, true) : startCp;
        atnBookmarks.push({ startCp, endCp: Math.max(startCp, endCp) });
      }
    }

    const refInfo = getFcLcb(IDX_PLCFANDREF);
    const txtInfo = getFcLcb(IDX_PLCFANDTXT);
    if (
      refInfo.lcb >= 38 &&
      txtInfo.lcb >= 8 &&
      refInfo.fc + refInfo.lcb <= tableStream.length &&
      txtInfo.fc + txtInfo.lcb <= tableStream.length
    ) {
      const nRef = Math.floor((refInfo.lcb - 4) / 34);
      const nTxt = Math.floor((txtInfo.lcb - 4) / 4);
      const count = Math.min(nRef, nTxt);
      const atnBase = ccpText + ccpFtn + ccpHdd + ccpMcr;
      const atrdBase = refInfo.fc + (nRef + 1) * 4;

      for (let i = 0; i < count; i++) {
        const anchorCp = tDv.getUint32(refInfo.fc + i * 4, true);
        const atrdOff = atrdBase + i * 30;
        let usrInitl = '';
        if (atrdOff + 22 <= tableStream.length) {
          const initCch = Math.min(9, tDv.getUint16(atrdOff, true));
          if (initCch > 0) {
            usrInitl = decodeUtf16Le(tableStream.subarray(atrdOff + 2, atrdOff + 2 + initCch * 2))
              .replace(/\0/g, '')
              .trim();
          }
        }
        const ibst =
          atrdOff + 22 <= tableStream.length ? tDv.getUint16(atrdOff + 20, true) : 0;

        const cStart = atnBase + tDv.getUint32(txtInfo.fc + i * 4, true);
        const cEnd = atnBase + tDv.getUint32(txtInfo.fc + (i + 1) * 4, true);
        const commentText = sliceCpRange(pieces, cStart, cEnd)
          .replace(/[\x00-\x1f]+/g, ' ')
          .trim();
        if (!commentText) continue;

        let startCp = Math.max(0, anchorCp - 10);
        let endCp = anchorCp;
        if (atnBookmarks.length > 0) {
          const exactBm =
            atnBookmarks.find((bm) => bm.startCp <= anchorCp && anchorCp <= bm.endCp + 2 && bm.endCp > bm.startCp) ??
            (i < atnBookmarks.length ? atnBookmarks[i] : undefined);
          if (exactBm && exactBm.endCp > exactBm.startCp) {
            startCp = exactBm.startCp;
            endCp = exactBm.endCp;
          }
        }

        const cid = `doc_c_${i + 1}`;
        commentsMap[cid] = {
          id: cid,
          author: owners[ibst] || usrInitl || '审阅批注',
          date: new Date().toISOString().slice(0, 10),
          text: commentText,
        };
        commentAnchors.push({ startCp, endCp, commentId: cid });
      }
    }
  }

  // Extract Track Changes (Revisions) via PlcfBteChpx (12) + ChpxFkp + SttbfRMark (51)
  const revisionsMap: Record<string, RevisionMeta> = {};
  const resolvedRevisions: ResolvedRevisionSpan[] = [];
  const bteChpxInfo = getFcLcb(IDX_PLCFBTECHPX);
  if (tableStream && bteChpxInfo.lcb >= 12 && bteChpxInfo.fc + bteChpxInfo.lcb <= tableStream.length) {
    const rmarkInfo = getFcLcb(IDX_STTBRMARK);
    const rmarkAuthors = parseSttbf(tableStream, rmarkInfo.fc, rmarkInfo.lcb);

    const tDv = new DataView(tableStream.buffer, tableStream.byteOffset, tableStream.byteLength);
    const nBins = Math.floor((bteChpxInfo.lcb - 4) / 8);
    const pnBase = bteChpxInfo.fc + (nBins + 1) * 4;
    const rawRevSpans: RawRevisionSpan[] = [];

    for (let b = 0; b < nBins; b++) {
      const pnVal = tDv.getUint32(pnBase + b * 4, true);
      const pn = pnVal & 0x3fffff;
      const pageOff = pn * 512;
      if (pageOff + 512 > wordDoc.length) continue;

      const crun = wordDoc[pageOff + 511];
      if (crun === 0 || (crun + 1) * 4 + crun > 511) continue;

      const rgbBase = pageOff + (crun + 1) * 4;
      for (let r = 0; r < crun; r++) {
        const bOffset = wordDoc[rgbBase + r];
        if (bOffset === 0) continue;
        const chpxOff = pageOff + bOffset * 2;
        if (chpxOff >= pageOff + 511) continue;
        const cb = wordDoc[chpxOff];
        if (chpxOff + 1 + cb > pageOff + 512) continue;

        const grpprl = wordDoc.subarray(chpxOff + 1, chpxOff + 1 + cb);
        const revProps = parseChpxRevisionSprms(grpprl);
        if (!revProps.isDeleted && !revProps.isInserted) continue;

        const fcStart = wdDv.getUint32(pageOff + r * 4, true);
        const fcEnd = wdDv.getUint32(pageOff + (r + 1) * 4, true);
        if (fcEnd <= fcStart) continue;

        const kind: 'delete' | 'insert' = revProps.isDeleted ? 'delete' : 'insert';
        const ibst = kind === 'delete' ? (revProps.ibstDel ?? revProps.ibstIns ?? 0) : (revProps.ibstIns ?? 0);
        const dttm = kind === 'delete' ? (revProps.dttmDel ?? revProps.dttmIns ?? 0) : (revProps.dttmIns ?? 0);
        const author = rmarkAuthors[ibst] || '审阅修订';
        const date = decodeWordDttm(dttm);

        for (const p of pieces) {
          if (p.cpStart >= maxCp) continue;
          const oStart = Math.max(fcStart, p.byteStart);
          const oEnd = Math.min(fcEnd, p.byteEnd);
          if (oEnd <= oStart) continue;
          const charSize = p.isAnsi ? 1 : 2;
          const cpFrom = Math.max(0, p.cpStart + Math.floor((oStart - p.byteStart) / charSize));
          const cpTo = Math.min(maxCp, p.cpStart + Math.ceil((oEnd - p.byteStart) / charSize));
          if (cpTo > cpFrom) {
            rawRevSpans.push({ kind, cpStart: cpFrom, cpEnd: cpTo, author, date });
          }
        }
      }
    }

    // Merge contiguous identical spans
    rawRevSpans.sort((a, b) => a.cpStart - b.cpStart || a.cpEnd - b.cpEnd);
    const mergedSpans: RawRevisionSpan[] = [];
    for (const sp of rawRevSpans) {
      const prev = mergedSpans[mergedSpans.length - 1];
      if (prev && prev.kind === sp.kind && prev.author === sp.author && sp.cpStart <= prev.cpEnd) {
        prev.cpEnd = Math.max(prev.cpEnd, sp.cpEnd);
      } else {
        mergedSpans.push({ ...sp });
      }
    }

    // Pair immediately adjacent delete + insert spans into 'replace' revisions
    let revCounter = 1;
    for (let sIdx = 0; sIdx < mergedSpans.length; sIdx++) {
      const cur = mergedSpans[sIdx];
      const next = mergedSpans[sIdx + 1];

      if (
        cur.kind === 'delete' &&
        next &&
        next.kind === 'insert' &&
        next.cpStart - cur.cpEnd <= 1 &&
        cur.author === next.author
      ) {
        const origText = sliceCpRange(pieces, cur.cpStart, cur.cpEnd).replace(/[\x00-\x1f]+/g, ' ').trim();
        const insText = sliceCpRange(pieces, next.cpStart, next.cpEnd).replace(/[\x00-\x1f]+/g, ' ').trim();
        if (origText || insText) {
          const rid = `doc_rev_${revCounter++}`;
          revisionsMap[rid] = {
            id: rid,
            kind: 'replace',
            author: cur.author,
            date: cur.date,
            originalText: origText,
            suggestedText: insText,
          };
          resolvedRevisions.push({
            id: rid,
            kind: 'replace',
            cpStart: cur.cpStart,
            cpEnd: next.cpEnd,
            origStart: cur.cpStart,
            origEnd: cur.cpEnd,
            insStart: next.cpStart,
            insEnd: next.cpEnd,
          });
        }
        sIdx++;
        continue;
      }

      const spanText = sliceCpRange(pieces, cur.cpStart, cur.cpEnd).replace(/[\x00-\x1f]+/g, ' ').trim();
      if (!spanText) continue;
      const rid = `doc_rev_${revCounter++}`;
      if (cur.kind === 'delete') {
        revisionsMap[rid] = {
          id: rid,
          kind: 'delete',
          author: cur.author,
          date: cur.date,
          originalText: spanText,
          suggestedText: '',
        };
        resolvedRevisions.push({
          id: rid,
          kind: 'delete',
          cpStart: cur.cpStart,
          cpEnd: cur.cpEnd,
          origStart: cur.cpStart,
          origEnd: cur.cpEnd,
          insStart: -1,
          insEnd: -1,
        });
      } else {
        revisionsMap[rid] = {
          id: rid,
          kind: 'insert',
          author: cur.author,
          date: cur.date,
          originalText: '',
          suggestedText: spanText,
        };
        resolvedRevisions.push({
          id: rid,
          kind: 'insert',
          cpStart: cur.cpStart,
          cpEnd: cur.cpEnd,
          origStart: -1,
          origEnd: -1,
          insStart: cur.cpStart,
          insEnd: cur.cpEnd,
        });
      }
    }
  }

  // Extract main document text [0, ccpText) with stack-based nested field machine (TOC / HYPERLINK / PAGEREF / Citations)
  const chars: Array<{ ch: string; cp: number }> = [];
  for (const p of pieces) {
    if (p.cpStart >= maxCp) continue;
    const limit = Math.min(p.text.length, maxCp - p.cpStart);
    for (let idx = 0; idx < limit; idx++) {
      chars.push({ ch: p.text[idx], cp: p.cpStart + idx });
    }
  }

  const citationsSidecar: CitationSidecarEntry[] = [];
  let citationCounter = 1;

  interface ProcessedToken {
    kind: 'char' | 'citation' | 'cell' | 'row' | 'para' | 'page';
    text: string;
    cpStart: number;
    cpEnd: number;
    revisionId?: string;
  }
  const tokens: ProcessedToken[] = [];

  interface FieldFrame {
    instr: string;
    inDisplay: boolean;
    isCitation: boolean;
    citationDisplay: string;
    startCp: number;
  }
  const fieldStack: FieldFrame[] = [];
  const emittedInsertAnchors = new Set<string>();

  const findRevisionAtCp = (cp: number): ResolvedRevisionSpan | undefined =>
    resolvedRevisions.find((r) => cp >= r.cpStart && cp < r.cpEnd);

  for (let i = 0; i < chars.length; i++) {
    const { ch, cp } = chars[i];
    const code = ch.charCodeAt(0);

    // Word Field delimiters: 0x13 begin, 0x14 separator, 0x15 end
    if (code === 0x13) {
      fieldStack.push({
        instr: '',
        inDisplay: false,
        isCitation: false,
        citationDisplay: '',
        startCp: cp,
      });
      continue;
    }

    if (code === 0x14) {
      const top = fieldStack[fieldStack.length - 1];
      if (top) {
        top.inDisplay = true;
        const upper = top.instr.toUpperCase();
        if (upper.includes('ZOTERO') || upper.includes('EN.CITE')) {
          top.isCitation = true;
        }
      }
      continue;
    }

    if (code === 0x15) {
      const frame = fieldStack.pop();
      if (frame?.isCitation) {
        const cleanDisplay = frame.citationDisplay.trim();
        const provider = frame.instr.toUpperCase().includes('ZOTERO') ? 'zotero' : 'endnote';
        const placeholder = `[@${provider}:${String(citationCounter++).padStart(3, '0')}]`;
        citationsSidecar.push({
          placeholder,
          provider,
          rawXml: `<w:r><w:t xml:space="preserve">${escapeXml(cleanDisplay || placeholder)}</w:t></w:r>`,
          displayText: cleanDisplay || placeholder,
        });
        tokens.push({
          kind: 'citation',
          text: placeholder,
          cpStart: frame.startCp,
          cpEnd: cp + 1,
        });
      }
      continue;
    }

    // Hidden instruction region of top-most or outer field
    if (fieldStack.some((f) => !f.inDisplay)) {
      const top = fieldStack[fieldStack.length - 1];
      if (top && !top.inDisplay && code >= 0x20) {
        top.instr += ch;
      }
      continue;
    }

    // Citation display capture
    const activeCitFrame = fieldStack.find((f) => f.isCitation && f.inDisplay);
    if (activeCitFrame) {
      if (code >= 0x20) activeCitFrame.citationDisplay += ch;
      continue;
    }

    if (code === 0x07) {
      const nextCode = i + 1 < chars.length ? chars[i + 1].ch.charCodeAt(0) : -1;
      if (nextCode === 0x07) {
        tokens.push({ kind: 'row', text: '', cpStart: cp, cpEnd: cp + 2 });
        i++;
      } else {
        tokens.push({ kind: 'cell', text: '', cpStart: cp, cpEnd: cp + 1 });
      }
      continue;
    }

    if (code === 0x0c) {
      tokens.push({ kind: 'page', text: '', cpStart: cp, cpEnd: cp + 1 });
      continue;
    }

    if (code === 0x0d || code === 0x0a) {
      tokens.push({ kind: 'para', text: '', cpStart: cp, cpEnd: cp + 1 });
      continue;
    }

    if (code === 0x0b) {
      tokens.push({ kind: 'char', text: '\n', cpStart: cp, cpEnd: cp + 1 });
      continue;
    }

    if (code === 0x09) {
      tokens.push({ kind: 'char', text: '\t', cpStart: cp, cpEnd: cp + 1 });
      continue;
    }

    if (code < 0x20) {
      continue;
    }

    // Apply Track-Changes revisions accurately by CP
    const rev = findRevisionAtCp(cp);
    if (rev) {
      if (rev.kind === 'insert') {
        if (!emittedInsertAnchors.has(rev.id)) {
          emittedInsertAnchors.add(rev.id);
          tokens.push({
            kind: 'char',
            text: INSERTION_ANCHOR_TOKEN,
            cpStart: cp,
            cpEnd: cp + 1,
            revisionId: rev.id,
          });
        }
        continue;
      }
      if (rev.kind === 'replace') {
        if (cp >= rev.insStart && cp < rev.insEnd) {
          continue;
        }
        tokens.push({
          kind: 'char',
          text: ch,
          cpStart: cp,
          cpEnd: cp + 1,
          revisionId: rev.id,
        });
        continue;
      }
      tokens.push({
        kind: 'char',
        text: ch,
        cpStart: cp,
        cpEnd: cp + 1,
        revisionId: rev.id,
      });
      continue;
    }

    tokens.push({ kind: 'char', text: ch, cpStart: cp, cpEnd: cp + 1 });
  }

  // Build blocks (paragraphs, page breaks, and \x07 tables) preserving comment & revision anchors
  const blocks: ParsedBlock[] = [];
  let blockIndex = 0;

  interface SpanRun {
    text: string;
    cpStart: number;
    cpEnd: number;
    revisionId?: string;
  }

  let curRuns: SpanRun[] = [];
  let curRowCells: string[] = [];
  let pendingTableRows: string[][] = [];

  const flushTableIfAny = () => {
    if (pendingTableRows.length === 0) return;
    const rows = pendingTableRows;
    pendingTableRows = [];
    blocks.push({
      index: blockIndex++,
      kind: 'table',
      previewText: `[表格 ${rows.length}×${rows[0]?.length ?? 0}] ${rows[0]?.join(' | ') ?? ''}`,
      rawXml: buildTableXml(rows),
      hasExplicitBreakAfter: false,
      isCoverSdt: false,
      segments: [],
      tableRows: rows,
    });
  };

  const runsToText = (runs: SpanRun[]): string => runs.map((r) => r.text).join('');

  const buildSegmentsWithAnnotations = (runs: SpanRun[]): ParsedSegment[] => {
    const fullText = runsToText(runs);
    if (!fullText) return [];

    const charCps: number[] = [];
    const charRevs: Array<string | undefined> = [];
    for (const r of runs) {
      for (let k = 0; k < r.text.length; k++) {
        charCps.push(r.cpStart + k);
        charRevs.push(r.revisionId);
      }
    }

    const minCp = runs[0]?.cpStart ?? -1;
    const maxRunCp = runs[runs.length - 1]?.cpEnd ?? -1;
    const matchingAnchors = commentAnchors.filter(
      (a) => a.endCp >= Math.max(0, minCp - 1) && a.startCp <= maxRunCp + 1,
    );

    const perCharComments: string[][] = fullText.split('').map(() => []);
    for (const anc of matchingAnchors) {
      let sIdx = charCps.findIndex((c) => c >= anc.startCp);
      if (sIdx === -1) sIdx = Math.max(0, fullText.length - 1);
      let eIdx = charCps.findIndex((c) => c >= anc.endCp);
      if (eIdx === -1) eIdx = fullText.length;
      if (eIdx <= sIdx) eIdx = Math.min(fullText.length, sIdx + 1);
      for (let idx = sIdx; idx < eIdx; idx++) {
        if (!perCharComments[idx].includes(anc.commentId)) {
          perCharComments[idx].push(anc.commentId);
        }
      }
    }

    const segs: ParsedSegment[] = [];
    for (let idx = 0; idx < fullText.length; idx++) {
      const cids = perCharComments[idx];
      const rid = charRevs[idx];
      const prev = segs[segs.length - 1];
      if (
        prev &&
        prev.revisionId === rid &&
        prev.commentIds.length === cids.length &&
        prev.commentIds.every((id, j) => id === cids[j])
      ) {
        prev.text += fullText[idx];
      } else {
        segs.push({ text: fullText[idx], commentIds: [...cids], revisionId: rid });
      }
    }
    return segs;
  };

  const flushParagraph = (hasPageBreak: boolean) => {
    const raw = runsToText(curRuns);
    const trimmed = raw.trim();
    const runsSnapshot = curRuns;
    curRuns = [];

    if (!trimmed && !hasPageBreak) return;
    flushTableIfAny();

    if (!trimmed && hasPageBreak) {
      blocks.push({
        index: blockIndex++,
        kind: 'page-break',
        previewText: '[分页符 / Page Break]',
        rawXml: buildParagraphXml('', undefined, true),
        hasExplicitBreakAfter: true,
        isCoverSdt: false,
        segments: [],
      });
      return;
    }

    const headingLevel = detectHeadingByText(trimmed);
    const segments = buildSegmentsWithAnnotations(runsSnapshot);
    blocks.push({
      index: blockIndex++,
      kind: headingLevel ? 'heading' : 'paragraph',
      headingLevel,
      previewText: trimmed,
      rawXml: buildParagraphXml(trimmed, headingLevel, hasPageBreak),
      hasExplicitBreakAfter: hasPageBreak,
      isCoverSdt: false,
      segments,
    });
  };

  for (const tok of tokens) {
    if (tok.kind === 'char' || tok.kind === 'citation') {
      curRuns.push({
        text: tok.text,
        cpStart: tok.cpStart,
        cpEnd: tok.cpEnd,
        revisionId: tok.revisionId,
      });
    } else if (tok.kind === 'cell') {
      curRowCells.push(runsToText(curRuns).trim());
      curRuns = [];
    } else if (tok.kind === 'row') {
      if (curRuns.length > 0) {
        curRowCells.push(runsToText(curRuns).trim());
        curRuns = [];
      }
      if (curRowCells.length > 0) {
        pendingTableRows.push(curRowCells);
        curRowCells = [];
      }
    } else if (tok.kind === 'para') {
      if (curRowCells.length > 0) {
        if (curRuns.length > 0) {
          curRowCells.push(runsToText(curRuns).trim());
          curRuns = [];
        }
      } else {
        flushParagraph(false);
      }
    } else if (tok.kind === 'page') {
      flushParagraph(true);
    }
  }

  if (curRowCells.length > 0) {
    if (curRuns.length > 0) {
      curRowCells.push(runsToText(curRuns).trim());
      curRuns = [];
    }
    pendingTableRows.push(curRowCells);
  }
  flushTableIfAny();
  flushParagraph(false);

  return {
    rawBytes,
    blocks,
    detectedCoverEndIndex: detectCoverCutoff(blocks),
    commentsMap,
    revisionsMap,
    footnotesMap: {},
    citationsSidecar,
    mediaAssets: {},
  };
}

function buildBundleFromPlainParagraphs(
  rawBytes: Uint8Array,
  items: Array<
    | { kind: 'paragraph'; text: string; headingLevel?: number; pageBreak?: boolean; segments?: ParsedSegment[] }
    | { kind: 'table'; rows: string[][] }
  >,
  commentsMap: Record<string, CommentMeta> = {},
  revisionsMap: Record<string, RevisionMeta> = {},
): ParsedDocxBundle {
  const blocks: ParsedBlock[] = [];
  let idx = 0;

  for (const item of items) {
    if (item.kind === 'table') {
      if (item.rows.length === 0) continue;
      blocks.push({
        index: idx++,
        kind: 'table',
        previewText: `[表格 ${item.rows.length}×${item.rows[0]?.length ?? 0}] ${item.rows[0]?.join(' | ') ?? ''}`,
        rawXml: buildTableXml(item.rows),
        hasExplicitBreakAfter: false,
        isCoverSdt: false,
        segments: [],
        tableRows: item.rows,
      });
      continue;
    }

    const trimmed = item.text.trim();
    if (!trimmed && !item.pageBreak) continue;
    if (!trimmed && item.pageBreak) {
      blocks.push({
        index: idx++,
        kind: 'page-break',
        previewText: '[分页符 / Page Break]',
        rawXml: buildParagraphXml('', undefined, true),
        hasExplicitBreakAfter: true,
        isCoverSdt: false,
        segments: [],
      });
      continue;
    }

    const hl = item.headingLevel ?? detectHeadingByText(trimmed);
    blocks.push({
      index: idx++,
      kind: hl ? 'heading' : 'paragraph',
      headingLevel: hl,
      previewText: trimmed,
      rawXml: buildParagraphXml(trimmed, hl, Boolean(item.pageBreak)),
      hasExplicitBreakAfter: Boolean(item.pageBreak),
      isCoverSdt: false,
      segments: item.segments && item.segments.length > 0 ? item.segments : [{ text: trimmed, commentIds: [] }],
    });
  }

  return {
    rawBytes,
    blocks,
    detectedCoverEndIndex: detectCoverCutoff(blocks),
    commentsMap,
    revisionsMap,
    footnotesMap: {},
    citationsSidecar: [],
    mediaAssets: {},
  };
}

const RTF_SKIP_DESTINATIONS = new Set([
  'fonttbl',
  'colortbl',
  'stylesheet',
  'info',
  'pict',
  'object',
  'header',
  'footer',
  'headerl',
  'headerr',
  'headerf',
  'footerl',
  'footerr',
  'footerf',
  'listtable',
  'listoverridetable',
  'revtbl',
  'rsidtbl',
  'generator',
  'xmlnstbl',
]);

function parseRtfDoc(rawBytes: Uint8Array, rtfStr: string): ParsedDocxBundle {
  const items: Array<{ kind: 'paragraph'; text: string; pageBreak?: boolean }> = [];
  const stack: Array<{ uc: number; skip: boolean }> = [{ uc: 1, skip: false }];
  let curText = '';
  let byteBuf: number[] = [];

  const flushBytes = () => {
    if (byteBuf.length === 0) return;
    curText += decodeGb18030(new Uint8Array(byteBuf));
    byteBuf = [];
  };

  const flushPara = (pageBreak = false) => {
    flushBytes();
    const cleaned = curText.replace(/\r/g, '').trim();
    curText = '';
    if (cleaned || pageBreak) {
      items.push({ kind: 'paragraph', text: cleaned, pageBreak });
    }
  };

  let i = 0;
  const len = rtfStr.length;
  while (i < len) {
    const ch = rtfStr[i];
    const top = stack[stack.length - 1] ?? { uc: 1, skip: false };

    if (ch === '{') {
      flushBytes();
      stack.push({ uc: top.uc, skip: top.skip });
      i++;
      continue;
    }

    if (ch === '}') {
      flushBytes();
      if (stack.length > 1) stack.pop();
      i++;
      continue;
    }

    if (ch === '\r' || ch === '\n') {
      i++;
      continue;
    }

    if (ch === '\\') {
      i++;
      if (i >= len) break;
      const next = rtfStr[i];

      if (next === '*') {
        stack[stack.length - 1].skip = true;
        i++;
        continue;
      }

      if (next === "'" && i + 2 < len) {
        const hex = rtfStr.slice(i + 1, i + 3);
        const val = Number.parseInt(hex, 16);
        if (!top.skip && Number.isFinite(val)) {
          byteBuf.push(val);
        }
        i += 3;
        continue;
      }

      if (next === '\\' || next === '{' || next === '}') {
        flushBytes();
        if (!top.skip) curText += next;
        i++;
        continue;
      }

      if (next === '~') {
        flushBytes();
        if (!top.skip) curText += ' ';
        i++;
        continue;
      }

      if (next === '-' || next === '_') {
        flushBytes();
        if (!top.skip && next === '_') curText += '-';
        i++;
        continue;
      }

      let word = '';
      while (i < len && /[a-zA-Z]/.test(rtfStr[i])) {
        word += rtfStr[i++];
      }
      let paramStr = '';
      if (i < len && (rtfStr[i] === '-' || /\d/.test(rtfStr[i]))) {
        paramStr += rtfStr[i++];
        while (i < len && /\d/.test(rtfStr[i])) {
          paramStr += rtfStr[i++];
        }
      }
      if (i < len && rtfStr[i] === ' ') {
        i++;
      }

      if (RTF_SKIP_DESTINATIONS.has(word)) {
        stack[stack.length - 1].skip = true;
        continue;
      }

      if (word === 'uc' && paramStr) {
        stack[stack.length - 1].uc = Math.max(0, Number(paramStr));
        continue;
      }

      if (top.skip) continue;

      if (word === 'u' && paramStr) {
        flushBytes();
        let codePoint = Number(paramStr);
        if (codePoint < 0) codePoint += 65536;
        curText += String.fromCharCode(codePoint);
        let toSkip = top.uc;
        while (toSkip > 0 && i < len) {
          if (rtfStr[i] === '\\' && rtfStr[i + 1] === "'") {
            i += 4;
          } else if (rtfStr[i] === '{' || rtfStr[i] === '}') {
            break;
          } else {
            i++;
          }
          toSkip--;
        }
        continue;
      }

      if (word === 'par' || word === 'line') {
        flushPara(false);
      } else if (word === 'page') {
        flushPara(true);
      } else if (word === 'tab') {
        flushBytes();
        curText += '\t';
      } else if (word === 'emdash') {
        flushBytes();
        curText += '—';
      } else if (word === 'endash') {
        flushBytes();
        curText += '–';
      }
      continue;
    }

    if (!top.skip) {
      flushBytes();
      curText += ch;
    }
    i++;
  }

  flushPara(false);
  return buildBundleFromPlainParagraphs(rawBytes, items);
}

function xmlLocalName(node: XmlNode | null | undefined): string {
  if (!node) return '';
  const el = node as XmlElement;
  return el.localName || (el.nodeName ? el.nodeName.replace(/^.*:/, '') : '');
}

function xmlAttr(el: XmlElement, name: string): string {
  return (
    el.getAttribute(`w:${name}`) ||
    el.getAttribute(`aml:${name}`) ||
    el.getAttribute(name) ||
    ''
  );
}

function parseWord2003XmlDoc(rawBytes: Uint8Array, xmlStr: string): ParsedDocxBundle {
  const parser = new DOMParser();
  const dom = parser.parseFromString(xmlStr, 'application/xml');
  const root = dom.documentElement;
  if (!root) {
    throw new Error('无法解析 Word XML 文档结构');
  }

  const commentsMap: Record<string, CommentMeta> = {};
  const revisionsMap: Record<string, RevisionMeta> = {};
  let revCounter = 1;
  let commentCounter = 1;
  const activeComments = new Set<string>();

  const items: Array<
    | { kind: 'paragraph'; text: string; headingLevel?: number; pageBreak?: boolean; segments?: ParsedSegment[] }
    | { kind: 'table'; rows: string[][] }
  > = [];

  const extractSegments = (el: XmlElement): ParsedSegment[] => {
    const segs: ParsedSegment[] = [];
    const pushSeg = (text: string, revisionId?: string) => {
      if (!text) return;
      const cids = Array.from(activeComments);
      const prev = segs[segs.length - 1];
      if (
        prev &&
        prev.revisionId === revisionId &&
        prev.commentIds.length === cids.length &&
        prev.commentIds.every((id, j) => id === cids[j])
      ) {
        prev.text += text;
      } else {
        segs.push({ text, commentIds: cids, revisionId });
      }
    };

    const collectPlain = (n: XmlNode): string => {
      if (n.nodeType !== 1) return '';
      const ln = xmlLocalName(n);
      if (ln === 't' || ln === 'delText') return n.textContent ?? '';
      if (ln === 'tab') return '\t';
      if (ln === 'br') return '\n';
      let s = '';
      for (let k = 0; k < n.childNodes.length; k++) s += collectPlain(n.childNodes[k]);
      return s;
    };

    const walk = (n: XmlNode) => {
      if (n.nodeType !== 1) return;
      const xEl = n as XmlElement;
      const ln = xmlLocalName(xEl);

      if (ln === 'annotation') {
        const type = xmlAttr(xEl, 'type');
        const id = xmlAttr(xEl, 'id') || String(commentCounter++);
        if (type === 'Word.Comment.Start') {
          activeComments.add(id);
          return;
        }
        if (type === 'Word.Comment.End') {
          activeComments.delete(id);
          return;
        }
        if (type === 'Word.Comment') {
          const author = xmlAttr(xEl, 'author') || '审阅批注';
          const date = (xmlAttr(xEl, 'date') || new Date().toISOString()).slice(0, 10);
          const contentEl = Array.from({ length: xEl.childNodes.length }, (_, k) => xEl.childNodes[k]).find(
            (c) => c.nodeType === 1 && xmlLocalName(c) === 'content',
          );
          const text = contentEl ? collectPlain(contentEl).trim() : '';
          if (text) {
            commentsMap[id] = { id, author, date, text };
          }
          return;
        }
      }

      if (ln === 'ins') {
        const author = xmlAttr(xEl, 'author') || '审阅修订';
        const date = (xmlAttr(xEl, 'date') || new Date().toISOString()).slice(0, 10);
        const insText = collectPlain(xEl);
        if (insText) {
          const rid = `xml_rev_${revCounter++}`;
          revisionsMap[rid] = {
            id: rid,
            kind: 'insert',
            author,
            date,
            originalText: '',
            suggestedText: insText,
          };
          pushSeg(INSERTION_ANCHOR_TOKEN, rid);
        }
        return;
      }

      if (ln === 'del') {
        const author = xmlAttr(xEl, 'author') || '审阅修订';
        const date = (xmlAttr(xEl, 'date') || new Date().toISOString()).slice(0, 10);
        const delText = collectPlain(xEl);
        if (delText) {
          const rid = `xml_rev_${revCounter++}`;
          revisionsMap[rid] = {
            id: rid,
            kind: 'delete',
            author,
            date,
            originalText: delText,
            suggestedText: '',
          };
          pushSeg(delText, rid);
        }
        return;
      }

      if (ln === 't') {
        pushSeg(xEl.textContent ?? '');
        return;
      }
      if (ln === 'tab') {
        pushSeg('\t');
        return;
      }
      if (ln === 'br') {
        pushSeg('\n');
        return;
      }
      for (let k = 0; k < xEl.childNodes.length; k++) {
        walk(xEl.childNodes[k]);
      }
    };

    walk(el);
    return segs;
  };

  const walkBody = (node: XmlNode) => {
    for (let i = 0; i < node.childNodes.length; i++) {
      const ch = node.childNodes[i];
      if (ch.nodeType !== 1) continue;
      const el = ch as XmlElement;
      const ln = xmlLocalName(el);
      if (ln === 'p') {
        const segments = extractSegments(el);
        const text = segments.map((s) => s.text).join('').trim();
        const brList = el.getElementsByTagName('*');
        let pageBreak = false;
        let headingLevel: number | undefined;
        for (let j = 0; j < brList.length; j++) {
          const bEl = brList[j];
          const bLn = xmlLocalName(bEl);
          if (bLn === 'br' && (bEl.getAttribute('w:type') === 'page' || bEl.getAttribute('type') === 'page')) {
            pageBreak = true;
          }
          if (bLn === 'pStyle') {
            const val = bEl.getAttribute('w:val') || bEl.getAttribute('val') || '';
            const m = val.match(/^(?:Heading|标题|H)\s*([1-6])$/i);
            if (m) headingLevel = Number(m[1]);
          }
        }
        if (text || pageBreak) {
          items.push({ kind: 'paragraph', text, headingLevel, pageBreak, segments });
        }
      } else if (ln === 'tbl') {
        const rows: string[][] = [];
        for (let r = 0; r < el.childNodes.length; r++) {
          const tr = el.childNodes[r];
          if (tr.nodeType !== 1 || xmlLocalName(tr) !== 'tr') continue;
          const rowCells: string[] = [];
          for (let c = 0; c < tr.childNodes.length; c++) {
            const tc = tr.childNodes[c];
            if (tc.nodeType !== 1 || xmlLocalName(tc) !== 'tc') continue;
            const cellParas: string[] = [];
            for (let p = 0; p < tc.childNodes.length; p++) {
              const pNode = tc.childNodes[p];
              if (pNode.nodeType === 1 && xmlLocalName(pNode) === 'p') {
                const segs = extractSegments(pNode as XmlElement);
                const t = segs.map((s) => s.text).join('').trim();
                if (t) cellParas.push(t);
              }
            }
            rowCells.push(cellParas.join(' '));
          }
          if (rowCells.length > 0) rows.push(rowCells);
        }
        if (rows.length > 0) items.push({ kind: 'table', rows });
      } else {
        walkBody(el);
      }
    }
  };

  walkBody(root);
  return buildBundleFromPlainParagraphs(rawBytes, items, commentsMap, revisionsMap);
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
}

function unwrapMhtmlHtml(text: string): string {
  if (!/mime-version:/i.test(text) && !/content-type:\s*text\/html/i.test(text)) {
    return text;
  }
  const htmlMatch = text.match(/<html[\s\S]*?<\/html>/i);
  let body = htmlMatch ? htmlMatch[0] : text;
  if (/content-transfer-encoding:\s*quoted-printable/i.test(text)) {
    body = body
      .replace(/=\r?\n/g, '')
      .replace(/=([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(Number.parseInt(h, 16)));
  }
  return body;
}

function parseHtmlDoc(rawBytes: Uint8Array, rawStr: string): ParsedDocxBundle {
  const html = unwrapMhtmlHtml(rawStr)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<head[\s\S]*?<\/head>/gi, '');

  const items: Array<
    | { kind: 'paragraph'; text: string; headingLevel?: number }
    | { kind: 'table'; rows: string[][] }
  > = [];

  const blockRegex = /<(h[1-6]|p|li|table)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let lastMatched = false;

  for (const m of html.matchAll(blockRegex)) {
    lastMatched = true;
    const tag = m[1].toLowerCase();
    const inner = m[2];
    if (tag === 'table') {
      const rows: string[][] = [];
      for (const trMatch of inner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells: string[] = [];
        for (const tdMatch of trMatch[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)) {
          const cleanCell = decodeHtmlEntities(tdMatch[1].replace(/<[^>]+>/g, ' '))
            .replace(/\s+/g, ' ')
            .trim();
          cells.push(cleanCell);
        }
        if (cells.length > 0) rows.push(cells);
      }
      if (rows.length > 0) items.push({ kind: 'table', rows });
      continue;
    }

    const clean = decodeHtmlEntities(inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
      .replace(/[ \t]+\n/g, '\n')
      .trim();
    if (!clean) continue;
    const headingLevel = tag.startsWith('h') ? Number(tag[1]) : undefined;
    items.push({ kind: 'paragraph', text: clean, headingLevel });
  }

  if (!lastMatched) {
    const plain = decodeHtmlEntities(html.replace(/<[^>]+>/g, '\n'));
    for (const line of plain.split(/\n+/)) {
      const t = line.trim();
      if (t) items.push({ kind: 'paragraph', text: t });
    }
  }

  return buildBundleFromPlainParagraphs(rawBytes, items);
}

/**
 * Natively parses a `.doc` file across all real-world formats:
 * 1. Classic Word 97-2003 OLE2/CFBF `[MS-DOC]` binary (text, tables, comments, track-changes, nested TOC/fields)
 * 2. Renamed OOXML `.docx` (ZIP container)
 * 3. RTF-saved `.doc` (`{\rtf...`)
 * 4. Word 2003 XML (`wordDocument` / `w:t`)
 * 5. HTML / MHTML-saved `.doc`
 */
export async function parseDocBytes(input: Uint8Array | ArrayBuffer): Promise<ParsedDocxBundle> {
  const rawBytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  if (rawBytes.length === 0) {
    throw new Error('该 .doc 文件为空');
  }

  if (isZipHeader(rawBytes)) {
    return parseDocxBytes(rawBytes);
  }

  if (isOle2Header(rawBytes)) {
    return parseOle2WordDoc(rawBytes);
  }

  const headUtf8 = new TextDecoder('utf-8', { fatal: false }).decode(
    rawBytes.subarray(0, Math.min(rawBytes.length, 4096)),
  );
  const headLower = headUtf8.trimStart().toLowerCase();

  if (headLower.startsWith('{\\rtf')) {
    const fullStr = decodeWin1252(rawBytes);
    return parseRtfDoc(rawBytes, fullStr);
  }

  if (
    headLower.startsWith('<?xml') &&
    (headLower.includes('worddocument') || headLower.includes('schemas.microsoft.com/office/word'))
  ) {
    const fullXml = new TextDecoder('utf-8', { fatal: false }).decode(rawBytes);
    return parseWord2003XmlDoc(rawBytes, fullXml);
  }

  if (
    headLower.startsWith('<!doctype') ||
    headLower.startsWith('<html') ||
    headLower.startsWith('mime-version:') ||
    headLower.includes('<body')
  ) {
    const charsetMatch = headLower.match(/charset\s*=\s*["']?([a-z0-9_-]+)/i);
    const enc = charsetMatch?.[1] ?? 'utf-8';
    const fullHtml =
      /gb/i.test(enc)
        ? decodeGb18030(rawBytes)
        : new TextDecoder('utf-8', { fatal: false }).decode(rawBytes);
    return parseHtmlDoc(rawBytes, fullHtml);
  }

  throw new Error('无法识别该 .doc 文件格式，请确认文件未损坏');
}
