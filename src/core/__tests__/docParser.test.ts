import { describe, expect, it } from 'vitest';
import { isOle2Header, isZipHeader, parseDocBytes, readOle2Streams } from '../ooxml/docParser';
import { extractBodyWithCoverIndex, INSERTION_ANCHOR_TOKEN, parseDocxBytes } from '../ooxml/docxParser';
import { exportToDocx } from '../ooxml/docxExporter';
import { buildSamplePaperDocx } from '../ooxml/sampleDocxBuilder';

function encodeUtf16Le(str: string): Uint8Array {
  const out = new Uint8Array(str.length * 2);
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out[i * 2] = code & 0xff;
    out[i * 2 + 1] = (code >>> 8) & 0xff;
  }
  return out;
}

function encodeAscii(str: string): Uint8Array {
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    out[i] = str.charCodeAt(i) & 0xff;
  }
  return out;
}

function encodeWordDttm(yrSince1900: number, mon: number, dom: number, hr = 10, mint = 30): number {
  return ((yrSince1900 & 0x1ff) << 20) | ((mon & 0x0f) << 16) | ((dom & 0x1f) << 11) | ((hr & 0x1f) << 6) | (mint & 0x3f);
}

/**
 * Builds a spec-compliant OLE2/CFBF container containing the given named streams.
 */
function buildSyntheticOle2(streams: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const SECTOR_SIZE = 512;
  const ENDOFCHAIN = 0xfffffffe;
  const FREESECT = 0xffffffff;

  const streamMeta = streams.map((s) => ({
    name: s.name,
    data: s.data,
    sectors: Math.max(1, Math.ceil(s.data.length / SECTOR_SIZE)),
    startSid: 0,
  }));

  let nextSid = 1;
  for (const sm of streamMeta) {
    sm.startSid = sm.data.length === 0 ? ENDOFCHAIN : nextSid;
    if (sm.data.length > 0) nextSid += sm.sectors;
  }

  const fatSid = nextSid;
  const totalSectors = fatSid + 1;
  const out = new Uint8Array((1 + totalSectors) * SECTOR_SIZE);
  const dv = new DataView(out.buffer);

  out.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], 0);
  dv.setUint16(0x18, 0x003e, true);
  dv.setUint16(0x1a, 0x0003, true);
  dv.setUint16(0x1c, 0xfffe, true);
  dv.setUint16(0x1e, 9, true);
  dv.setUint16(0x20, 6, true);
  dv.setUint32(0x2c, 1, true);
  dv.setUint32(0x30, 0, true);
  dv.setUint32(0x38, 0, true);
  dv.setUint32(0x3c, ENDOFCHAIN, true);
  dv.setUint32(0x40, 0, true);
  dv.setUint32(0x44, ENDOFCHAIN, true);
  dv.setUint32(0x48, 0, true);
  for (let i = 0; i < 109; i++) {
    dv.setUint32(0x4c + i * 4, i === 0 ? fatSid : FREESECT, true);
  }

  const writeDirEntry = (
    slot: number,
    name: string,
    type: number,
    startSid: number,
    size: number,
  ) => {
    const off = (1 + 0) * SECTOR_SIZE + slot * 128;
    const nameBytes = encodeUtf16Le(name);
    out.set(nameBytes.subarray(0, 62), off);
    dv.setUint16(off + 0x40, Math.min(64, nameBytes.length + 2), true);
    out[off + 0x42] = type;
    dv.setUint32(off + 0x44, 0xffffffff, true);
    dv.setUint32(off + 0x48, 0xffffffff, true);
    dv.setUint32(off + 0x4c, slot === 0 && streamMeta.length > 0 ? 1 : 0xffffffff, true);
    dv.setUint32(off + 0x74, startSid, true);
    dv.setUint32(off + 0x78, size, true);
  };

  writeDirEntry(0, 'Root Entry', 5, ENDOFCHAIN, 0);
  streamMeta.forEach((sm, idx) => {
    writeDirEntry(idx + 1, sm.name, 2, sm.startSid, sm.data.length);
    if (sm.data.length > 0) {
      out.set(sm.data, (1 + sm.startSid) * SECTOR_SIZE);
    }
  });

  const fatOff = (1 + fatSid) * SECTOR_SIZE;
  for (let i = 0; i < 128; i++) {
    dv.setUint32(fatOff + i * 4, FREESECT, true);
  }
  dv.setUint32(fatOff + 0 * 4, ENDOFCHAIN, true);
  for (const sm of streamMeta) {
    if (sm.data.length === 0) continue;
    for (let s = 0; s < sm.sectors; s++) {
      const sid = sm.startSid + s;
      const next = s + 1 < sm.sectors ? sid + 1 : ENDOFCHAIN;
      dv.setUint32(fatOff + sid * 4, next, true);
    }
  }
  dv.setUint32(fatOff + fatSid * 4, 0xfffffffd, true);

  return out;
}

/**
 * Builds a spec-compliant [MS-DOC] binary `.doc` with:
 * - Multi-page front matter (> 25 blocks: Cover + Declaration page -> TOC + Body)
 * - Inserted nested Word TOC field (TOC -> HYPERLINK -> PAGEREF)
 * - Zotero citation field
 * - `\x07` table
 * - Range-highlighted comment (PlcfandRef=4, PlcfandTxt=5, GrpXstAtnOwners=36, PlcfAtnBkf=42, PlcfAtnBkl=43)
 * - Track-Changes revisions in PlcfBteChpx (12) + ChpxFkp + SttbfRMark (51): delete, insert, replace
 */
function buildSyntheticMsDoc(opts?: { encrypted?: boolean }): Uint8Array {
  // Multi-page front matter (> 26 blocks) to test expanded cover scanning
  const extraCoverLines = Array.from({ length: 24 }, (_, idx) => `封面信息行 ${idx + 1}`).join('\r');

  // Nested TOC field + body + revisions + table
  const tocBlock =
    '目录\r' +
    '\x13 TOC \\o "1-3" \\h \\z \\u \x14' +
    '\x13 HYPERLINK \\l "_Toc1" \x14第1章 引言\t\x13 PAGEREF _Toc1 \\h \x141\x15\x15\r' +
    '\x13 HYPERLINK \\l "_Toc2" \x141.1 研究背景\t\x13 PAGEREF _Toc2 \\h \x142\x15\x15\r' +
    '\x15';

  const bodyPrefix =
    '第1章 引言\r' +
    '面向长文档演进的';
  const commentTarget = '局部语义检索框架';
  const bodyMid = '\x13 ADDIN ZOTERO_ITEM CSL_CITATION \x14[1]\x15实现';
  const delWord = '88.0%';
  const insWord = '94.2%';
  const bodyAfterReplace = '准确率，并且';
  const pureInsWord = '支持无感缓存';
  const bodyAfterIns = '降低';
  const pureDelWord = '大量冗余';
  const bodyTail =
    '存储开销。\r' +
    '指标\x07数值\x07\x07准确率\x0794.2%\x07\x07';

  const bodyPiece =
    tocBlock +
    bodyPrefix +
    commentTarget +
    bodyMid +
    delWord +
    insWord +
    bodyAfterReplace +
    pureInsWord +
    bodyAfterIns +
    pureDelWord +
    bodyTail;

  const commentStr = '请补充消融实验参数说明。\r';

  // Use ANSI for a pure-ASCII cover header, UTF-16LE for Chinese front-matter + body + comment
  const asciiCover = 'ArcVault University Thesis Cover\r';
  const utf16FrontAndBody =
    extraCoverLines +
    '\r\x0C' +
    '原创性声明\r本人郑重声明所呈交的学位论文是独立研究成果。\r\x0C' +
    bodyPiece;

  const p1Off = 0x400;
  const p1Bytes = encodeAscii(asciiCover);
  const p2Off = p1Off + p1Bytes.length;
  const p2Bytes = encodeUtf16Le(utf16FrontAndBody);
  const p3Off = p2Off + p2Bytes.length;
  const p3Bytes = encodeUtf16Le(commentStr);

  // Align ChpxFkp page on the next 512-byte boundary
  const chpxPageIdx = Math.ceil((p3Off + p3Bytes.length + 16) / 512);
  const chpxPageOff = chpxPageIdx * 512;
  const wordDoc = new Uint8Array(chpxPageOff + 512);

  wordDoc.set(p1Bytes, p1Off);
  wordDoc.set(p2Bytes, p2Off);
  wordDoc.set(p3Bytes, p3Off);

  const wdDv = new DataView(wordDoc.buffer);
  wdDv.setUint16(0x00, 0xa5ec, true);
  wdDv.setUint16(0x02, 0x00c1, true);
  let flags = 0x0200; // fWhichTblStm = 1 (1Table)
  if (opts?.encrypted) flags |= 0x0100;
  wdDv.setUint16(0x0a, flags, true);

  const csw = 14;
  wdDv.setUint16(0x20, csw, true);
  const lwBase = 0x22 + csw * 2;
  const cslw = 22;
  wdDv.setUint16(lwBase, cslw, true);
  const lwStart = lwBase + 2;

  const cp0 = 0;
  const cp1 = asciiCover.length;
  const cp2 = cp1 + utf16FrontAndBody.length;
  const cp3 = cp2 + commentStr.length;

  wdDv.setUint32(lwStart + 3 * 4, cp2, true); // ccpText
  wdDv.setUint32(lwStart + 7 * 4, commentStr.length, true); // ccpAtn

  const fcLcbBase = lwStart + cslw * 4;
  const cbRgFcLcb = 60;
  wdDv.setUint16(fcLcbBase, cbRgFcLcb, true);
  const fcLcbStart = fcLcbBase + 2;
  const setFcLcb = (idx: number, fc: number, lcb: number) => {
    wdDv.setUint32(fcLcbStart + idx * 8, fc, true);
    wdDv.setUint32(fcLcbStart + idx * 8 + 4, lcb, true);
  };

  // Compute exact byte offsets inside p2Bytes for comment anchor & revisions
  const frontPrefixLen =
    (extraCoverLines + '\r\x0C' + '原创性声明\r本人郑重声明所呈交的学位论文是独立研究成果。\r\x0C').length;
  const p2BodyOffsetChars = frontPrefixLen;
  const cmtRelStart = p2BodyOffsetChars + (tocBlock + bodyPrefix).length;
  const cmtRelEnd = cmtRelStart + commentTarget.length;
  const cmtCpStart = cp1 + cmtRelStart;
  const cmtCpEnd = cp1 + cmtRelEnd;

  const del1CharOff = p2BodyOffsetChars + (tocBlock + bodyPrefix + commentTarget + bodyMid).length;
  const ins1CharOff = del1CharOff + delWord.length;
  const ins2CharOff = ins1CharOff + insWord.length + bodyAfterReplace.length;
  const del2CharOff = ins2CharOff + pureInsWord.length + bodyAfterIns.length;

  const fcOfChar = (charIdx: number) => p2Off + charIdx * 2;
  const dttmVal = encodeWordDttm(126, 11, 26); // 2026-11-26

  // Build 1 ChpxFkp page at chpxPageOff covering 7 runs in p2Off:
  // [normal, del1, ins1, normal, ins2, normal, del2]
  const runs = [
    { fcStart: fcOfChar(0), fcEnd: fcOfChar(del1CharOff), kind: 'none' as const },
    { fcStart: fcOfChar(del1CharOff), fcEnd: fcOfChar(del1CharOff + delWord.length), kind: 'del' as const },
    { fcStart: fcOfChar(ins1CharOff), fcEnd: fcOfChar(ins1CharOff + insWord.length), kind: 'ins' as const },
    { fcStart: fcOfChar(ins1CharOff + insWord.length), fcEnd: fcOfChar(ins2CharOff), kind: 'none' as const },
    { fcStart: fcOfChar(ins2CharOff), fcEnd: fcOfChar(ins2CharOff + pureInsWord.length), kind: 'ins' as const },
    { fcStart: fcOfChar(ins2CharOff + pureInsWord.length), fcEnd: fcOfChar(del2CharOff), kind: 'none' as const },
    { fcStart: fcOfChar(del2CharOff), fcEnd: fcOfChar(del2CharOff + pureDelWord.length), kind: 'del' as const },
  ];

  const crun = runs.length;
  for (let r = 0; r < crun; r++) {
    wdDv.setUint32(chpxPageOff + r * 4, runs[r].fcStart, true);
  }
  wdDv.setUint32(chpxPageOff + crun * 4, runs[crun - 1].fcEnd, true);

  const rgbBase = chpxPageOff + (crun + 1) * 4;
  let chpxWriteOff = rgbBase + crun;
  if (chpxWriteOff % 2 !== 0) chpxWriteOff++;

  const writeChpx = (grpprl: number[]): number => {
    const wordOff = (chpxWriteOff - chpxPageOff) / 2;
    wordDoc[chpxWriteOff] = grpprl.length;
    wordDoc.set(grpprl, chpxWriteOff + 1);
    chpxWriteOff += 1 + grpprl.length;
    if (chpxWriteOff % 2 !== 0) chpxWriteOff++;
    return wordOff;
  };

  const delSprmBytes = [
    0x00, 0x08, 0x01, // sprmCFRMarkDel = 1
    0x63, 0x48, 0x00, 0x00, // sprmCIbstRMarkDel = 0
    0x64, 0x68, dttmVal & 0xff, (dttmVal >>> 8) & 0xff, (dttmVal >>> 16) & 0xff, (dttmVal >>> 24) & 0xff,
  ];
  const insSprmBytes = [
    0x01, 0x08, 0x01, // sprmCFRMarkIns = 1
    0x04, 0x48, 0x00, 0x00, // sprmCIbstRMark = 0
    0x05, 0x68, dttmVal & 0xff, (dttmVal >>> 8) & 0xff, (dttmVal >>> 16) & 0xff, (dttmVal >>> 24) & 0xff,
  ];
  const delWordOff = writeChpx(delSprmBytes);
  const insWordOff = writeChpx(insSprmBytes);

  for (let r = 0; r < crun; r++) {
    wordDoc[rgbBase + r] =
      runs[r].kind === 'del' ? delWordOff : runs[r].kind === 'ins' ? insWordOff : 0;
  }
  wordDoc[chpxPageOff + 511] = crun;

  // Build 1Table
  const tableBuf = new Uint8Array(1024);
  const tDv = new DataView(tableBuf.buffer);
  let tPos = 0;

  // 1) Clx (idx 33)
  const clxFc = tPos;
  const nPieces = 3;
  const pcdtSize = (nPieces + 1) * 4 + nPieces * 8;
  tableBuf[tPos] = 0x02;
  tDv.setUint32(tPos + 1, pcdtSize, true);
  let p = tPos + 5;
  tDv.setUint32(p + 0, cp0, true);
  tDv.setUint32(p + 4, cp1, true);
  tDv.setUint32(p + 8, cp2, true);
  tDv.setUint32(p + 12, cp3, true);
  p += 16;
  tDv.setUint32(p + 2, ((p1Off << 1) | 0x40000000) >>> 0, true);
  tDv.setUint32(p + 8 + 2, p2Off, true);
  tDv.setUint32(p + 16 + 2, p3Off, true);
  const clxLcb = 5 + pcdtSize;
  tPos += clxLcb;
  setFcLcb(33, clxFc, clxLcb);

  // 2) GrpXstAtnOwners (idx 36)
  const ownersFc = tPos;
  const ownerName = '李教授';
  tDv.setUint16(tPos, ownerName.length, true);
  tableBuf.set(encodeUtf16Le(ownerName), tPos + 2);
  const ownersLcb = 2 + ownerName.length * 2;
  tPos += ownersLcb;
  setFcLcb(36, ownersFc, ownersLcb);

  // 3) PlcfandRef (idx 4)
  const refFc = tPos;
  tDv.setUint32(tPos, cmtCpEnd, true);
  tDv.setUint32(tPos + 4, cp2, true);
  tDv.setUint16(tPos + 8 + 20, 0, true); // ibst = 0
  const refLcb = 38;
  tPos += refLcb;
  setFcLcb(4, refFc, refLcb);

  // 4) PlcfandTxt (idx 5)
  const txtFc = tPos;
  tDv.setUint32(tPos, 0, true);
  tDv.setUint32(tPos + 4, commentStr.length, true);
  const txtLcb = 8;
  tPos += txtLcb;
  setFcLcb(5, txtFc, txtLcb);

  // 5) PlcfAtnBkf (idx 42) + PlcfAtnBkl (idx 43)
  const bkfFc = tPos;
  tDv.setUint32(tPos, cmtCpStart, true);
  tDv.setUint32(tPos + 4, cp2, true);
  tDv.setUint16(tPos + 8, 0, true); // ibkl = 0
  const bkfLcb = 12;
  tPos += bkfLcb;
  setFcLcb(42, bkfFc, bkfLcb);

  const bklFc = tPos;
  tDv.setUint32(tPos, cmtCpEnd, true);
  tDv.setUint32(tPos + 4, cp2, true);
  const bklLcb = 8;
  tPos += bklLcb;
  setFcLcb(43, bklFc, bklLcb);

  // 6) PlcfBteChpx (idx 12) -> 2 FCs + 1 PN
  const bteFc = tPos;
  tDv.setUint32(tPos, runs[0].fcStart, true);
  tDv.setUint32(tPos + 4, runs[crun - 1].fcEnd, true);
  tDv.setUint32(tPos + 8, chpxPageIdx, true);
  const bteLcb = 12;
  tPos += bteLcb;
  setFcLcb(12, bteFc, bteLcb);

  // 7) SttbfRMark (idx 51): extended UTF-16LE STTB with 1 author "张审阅"
  const rmarkFc = tPos;
  const revAuthor = '张审阅';
  tDv.setUint16(tPos, 0xffff, true);
  tDv.setUint16(tPos + 2, 1, true); // cData = 1
  tDv.setUint16(tPos + 4, 0, true); // cbExtra = 0
  tDv.setUint16(tPos + 6, revAuthor.length, true);
  tableBuf.set(encodeUtf16Le(revAuthor), tPos + 8);
  const rmarkLcb = 8 + revAuthor.length * 2;
  tPos += rmarkLcb;
  setFcLcb(51, rmarkFc, rmarkLcb);

  return buildSyntheticOle2([
    { name: 'WordDocument', data: wordDoc },
    { name: '1Table', data: tableBuf.subarray(0, tPos) },
  ]);
}

describe('docParser (.doc native support)', () => {
  it('parses native OLE2/CFBF [MS-DOC] binaries including extended cover split, nested TOC, comments, revisions & export', async () => {
    const docBytes = buildSyntheticMsDoc();
    expect(isOle2Header(docBytes)).toBe(true);
    expect(isZipHeader(docBytes)).toBe(false);

    const streams = readOle2Streams(docBytes);
    expect(streams.has('WordDocument')).toBe(true);
    expect(streams.has('1Table')).toBe(true);

    const bundle = await parseDocBytes(docBytes);
    // Cover has 25 lines + page break + 2 declaration lines + page break = 29 blocks
    expect(bundle.detectedCoverEndIndex).toBe(29);
    expect(bundle.citationsSidecar).toHaveLength(1);
    expect(bundle.citationsSidecar[0].provider).toBe('zotero');
    expect(Object.keys(bundle.commentsMap)).toHaveLength(1);
    expect(Object.keys(bundle.revisionsMap)).toHaveLength(3);

    const extracted = extractBodyWithCoverIndex(bundle, bundle.detectedCoverEndIndex, 'markdown');
    expect(extracted.coverBlockCount).toBe(29);

    // Nested TOC field renders cleanly without leaked TOC/HYPERLINK/PAGEREF instruction text
    expect(extracted.text).toContain('# 目录');
    expect(extracted.text).toContain('第1章 引言\t1');
    expect(extracted.text).toContain('1.1 研究背景\t2');
    expect(extracted.text).not.toContain('HYPERLINK');
    expect(extracted.text).not.toContain('PAGEREF');

    // Main body + Zotero citation + table
    expect(extracted.text).toContain('# 第1章 引言');
    expect(extracted.text).toContain('面向长文档演进的局部语义检索框架[@zotero:001]');
    expect(extracted.text).toContain(INSERTION_ANCHOR_TOKEN);
    expect(extracted.text).toContain('| 指标 | 数值 |');
    expect(extracted.text).toContain('| 准确率 | 94.2% |');

    // Comment + Replace + Insert + Delete annotations
    const comment = extracted.annotations.find((a) => a.type === 'comment');
    expect(comment).toBeDefined();
    expect(comment?.author).toBe('李教授');
    expect(comment?.originalText).toBe('局部语义检索框架');
    expect(comment?.commentText).toBe('请补充消融实验参数说明。');

    const replaceRev = extracted.annotations.find((a) => a.type === 'revision' && a.revisionKind === 'replace');
    expect(replaceRev).toBeDefined();
    expect(replaceRev?.author).toBe('张审阅');
    expect(replaceRev?.date).toBe('2026-11-26');
    expect(replaceRev?.originalText).toBe('88.0%');
    expect(replaceRev?.suggestedText).toBe('94.2%');

    const insertRev = extracted.annotations.find((a) => a.type === 'revision' && a.revisionKind === 'insert');
    expect(insertRev).toBeDefined();
    expect(insertRev?.suggestedText).toBe('支持无感缓存');

    const deleteRev = extracted.annotations.find((a) => a.type === 'revision' && a.revisionKind === 'delete');
    expect(deleteRev).toBeDefined();
    expect(deleteRev?.originalText).toBe('大量冗余');

    // Round-trip export preserves cover & body cleanly
    const exportedDocx = await exportToDocx({
      baseDocxBase64: undefined,
      coverXmlNodes: extracted.coverXmlNodes,
      bodyText: extracted.text,
      format: 'markdown',
      citationsSidecar: extracted.citationsSidecar,
      mode: 'clean',
      title: 'LegacyDocTest',
    });
    const reparsed = await parseDocxBytes(exportedDocx);
    expect(reparsed.blocks.some((b) => b.previewText.includes('ArcVault University Thesis Cover'))).toBe(true);
    expect(reparsed.blocks.some((b) => b.previewText.includes('面向长文档演进的局部语义检索框架'))).toBe(true);
  });

  it('rejects password-encrypted OLE2 .doc files with a clear Chinese error', async () => {
    const encryptedDoc = buildSyntheticMsDoc({ encrypted: true });
    await expect(parseDocBytes(encryptedDoc)).rejects.toThrow('已加密');
  });

  it('parses RTF-saved .doc files with Unicode and GBK escapes', async () => {
    const rtf =
      '{\\rtf1\\ansi\\ansicpg936{\\fonttbl{\\f0 SimSun;}}\\pard \\u31532?1\\u31456? \\u27010?\\u36848?\\par ' +
      '\\\'b2\\\'e2\\\'ca\\\'d4GBK\\\'d6\\\'d0\\\'ce\\\'c4\\par}';
    const bytes = encodeAscii(rtf);
    const bundle = await parseDocBytes(bytes);
    const extracted = extractBodyWithCoverIndex(bundle, 0, 'markdown');
    expect(extracted.text).toContain('第1章 概述');
    expect(extracted.text).toContain('测试GBK中文');
  });

  it('parses HTML-saved .doc and Word 2003 XML .doc files including XML annotations & revisions', async () => {
    const htmlDoc =
      '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:SimSun}</style></head>' +
      '<body><h1>实验报告</h1><p>这是一份 HTML 封装的 .doc 文档。</p>' +
      '<table><tr><th>模型</th><th>得分</th></tr><tr><td>ArcVault</td><td>95.4</td></tr></table></body></html>';
    const htmlBundle = await parseDocBytes(new TextEncoder().encode(htmlDoc));
    const htmlExtracted = extractBodyWithCoverIndex(htmlBundle, 0, 'markdown');
    expect(htmlExtracted.text).toContain('# 实验报告');
    expect(htmlExtracted.text).toContain('这是一份 HTML 封装的 .doc 文档。');
    expect(htmlExtracted.text).toContain('| 模型 | 得分 |');

    const xmlDoc =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<w:wordDocument xmlns:w="http://schemas.microsoft.com/office/word/2003/wordml" xmlns:aml="http://schemas.microsoft.com/aml/2001/core">' +
      '<w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>研究背景</w:t></w:r></w:p>' +
      '<w:p><aml:annotation aml:id="0" w:type="Word.Comment.Start"/><w:r><w:t>Word 2003 XML 正文</w:t></w:r><aml:annotation aml:id="0" w:type="Word.Comment.End"/>' +
      '<aml:annotation aml:id="0" w:type="Word.Comment" aml:author="导师" aml:date="2026-11-26T00:00:00Z"><aml:content><w:p><w:r><w:t>XML批注内容</w:t></w:r></w:p></aml:content></aml:annotation>' +
      '<aml:ins aml:author="作者" aml:date="2026-11-26T00:00:00Z"><w:r><w:t>新增文字</w:t></w:r></aml:ins>' +
      '</w:p></w:body></w:wordDocument>';
    const xmlBundle = await parseDocBytes(new TextEncoder().encode(xmlDoc));
    const xmlExtracted = extractBodyWithCoverIndex(xmlBundle, 0, 'markdown');
    expect(xmlExtracted.text).toContain('# 研究背景');
    expect(xmlExtracted.text).toContain('Word 2003 XML 正文');
    expect(xmlExtracted.annotations.some((a) => a.type === 'comment' && a.commentText === 'XML批注内容')).toBe(true);
    expect(xmlExtracted.annotations.some((a) => a.type === 'revision' && a.suggestedText === '新增文字')).toBe(true);
  });

  it('delegates renamed .docx files (ZIP bytes with .doc extension) seamlessly', async () => {
    const sampleDocx = await buildSamplePaperDocx();
    const bundle = await parseDocBytes(sampleDocx);
    expect(isZipHeader(sampleDocx)).toBe(true);
    expect(bundle.blocks.length).toBeGreaterThan(2);
    expect(Object.keys(bundle.commentsMap).length).toBeGreaterThan(0);
  });
});
