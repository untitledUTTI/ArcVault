import JSZip from 'jszip';
import {
  DOMParser,
  XMLSerializer,
  type Element as XmlElement,
  type Node as XmlNode,
} from '@xmldom/xmldom';
import { ommlNodeToLatex } from './ommlToLatex';
import type {
  AnnotationItem,
  CitationSidecarEntry,
  DocxBlockStyleEntry,
  DocxStyleDef,
  DocxStyleSidecar,
  DocxStyledRun,
  EditorFormat,
  MediaAsset,
} from '../../types/archive';

export interface ParsedSegment {
  text: string;
  commentIds: string[];
  revisionId?: string;
  rPrXml?: string;
}

export interface ParsedBlock {
  index: number;
  kind: 'heading' | 'paragraph' | 'table' | 'math-block' | 'page-break' | 'sdt-cover';
  headingLevel?: number;
  pStyleId?: string;
  pPrXml?: string;
  dominantRPrXml?: string;
  hasReviewMarkup?: boolean;
  previewText: string;
  rawXml: string;
  hasExplicitBreakAfter: boolean;
  isCoverSdt: boolean;
  segments: ParsedSegment[];
  tableRows?: string[][];
}

export interface CommentMeta {
  id: string;
  author: string;
  date: string;
  text: string;
}

export interface RevisionMeta {
  id: string;
  kind: 'delete' | 'insert' | 'replace';
  author: string;
  date: string;
  originalText: string;
  suggestedText: string;
}

export interface ParsedDocxBundle {
  rawBytes: Uint8Array;
  blocks: ParsedBlock[];
  detectedCoverEndIndex: number;
  commentsMap: Record<string, CommentMeta>;
  revisionsMap: Record<string, RevisionMeta>;
  footnotesMap: Record<string, string>;
  citationsSidecar: CitationSidecarEntry[];
  mediaAssets: Record<string, MediaAsset>;
  stylesMap?: Record<string, DocxStyleDef>;
  styleRPrMap?: Record<string, string>;
}

export interface ExtractedDocContent {
  format: EditorFormat;
  text: string;
  annotations: AnnotationItem[];
  coverXmlNodes: string[];
  coverBlockCount: number;
  citationsSidecar: CitationSidecarEntry[];
  styleSidecar?: DocxStyleSidecar;
  mediaAssets: Record<string, MediaAsset>;
}

export const INSERTION_ANCHOR_TOKEN = '⟨待插入⟩';

function localName(node: XmlNode | null | undefined): string {
  if (!node) return '';
  const el = node as XmlElement;
  return el.localName || (el.nodeName ? el.nodeName.replace(/^.*:/, '') : '');
}

function getAttr(el: XmlElement | null | undefined, name: string): string {
  if (!el) return '';
  return el.getAttribute(`w:${name}`) || el.getAttribute(`r:${name}`) || el.getAttribute(name) || '';
}

function childElements(node: XmlNode): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const ch = node.childNodes[i];
    if (ch.nodeType === 1) out.push(ch as XmlElement);
  }
  return out;
}

function findDescendant(node: XmlNode, targetLocal: string): XmlElement | undefined {
  for (let i = 0; i < node.childNodes.length; i++) {
    const ch = node.childNodes[i];
    if (ch.nodeType === 1) {
      if (localName(ch) === targetLocal) return ch as XmlElement;
      const nested = findDescendant(ch, targetLocal);
      if (nested) return nested;
    }
  }
  return undefined;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(bin);
}

export function base64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function mimeFromExt(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

function matchHeadingNameOrId(val: string): number | undefined {
  const clean = val.trim();
  if (!clean) return undefined;
  const match =
    clean.match(/^(?:Heading|标题|H)\s*([1-6])$/i) ||
    clean.match(/^([1-6])$/);
  if (match) return Number(match[1]);
  if (/^Title$/i.test(clean)) return 1;
  return undefined;
}

function detectHeadingLevel(
  pEl: XmlElement,
  stylesMap: Record<string, DocxStyleDef> = {},
): number | undefined {
  const pPr = childElements(pEl).find((c) => localName(c) === 'pPr');
  if (!pPr) return undefined;

  // 1. Direct w:outlineLvl on paragraph
  const directOutline = childElements(pPr).find((c) => localName(c) === 'outlineLvl');
  if (directOutline) {
    const rawLvl = Number(getAttr(directOutline, 'val'));
    if (Number.isInteger(rawLvl) && rawLvl >= 0 && rawLvl <= 5) {
      return rawLvl + 1;
    }
  }

  // 2. Paragraph style ID & styles.xml inheritance chain
  const pStyle = childElements(pPr).find((c) => localName(c) === 'pStyle');
  const styleVal = getAttr(pStyle, 'val');
  if (!styleVal) return undefined;

  const directMatch = matchHeadingNameOrId(styleVal);
  if (directMatch) return directMatch;

  let curId: string | undefined = styleVal;
  const visited = new Set<string>();
  for (let hop = 0; hop < 8 && curId && !visited.has(curId); hop++) {
    visited.add(curId);
    const def: DocxStyleDef | undefined = stylesMap[curId];
    if (!def) break;
    if (
      typeof def.outlineLvl === 'number' &&
      def.outlineLvl >= 0 &&
      def.outlineLvl <= 5
    ) {
      return def.outlineLvl + 1;
    }
    const byName = matchHeadingNameOrId(def.name) ?? matchHeadingNameOrId(def.styleId);
    if (byName) return byName;
    curId = def.basedOn;
  }

  return undefined;
}

function parseStylesXml(
  stylesXmlStr: string | undefined,
  parser: DOMParser,
  serializer: XMLSerializer,
): {
  stylesMap: Record<string, DocxStyleDef>;
  styleRPrMap: Record<string, string>;
} {
  const stylesMap: Record<string, DocxStyleDef> = {};
  const styleRPrMap: Record<string, string> = {};
  if (!stylesXmlStr) return { stylesMap, styleRPrMap };

  const sDom = parser.parseFromString(stylesXmlStr, 'application/xml');
  const nodes = sDom.getElementsByTagName('*');
  for (let i = 0; i < nodes.length; i++) {
    const el = nodes[i];
    if (localName(el) !== 'style') continue;
    const styleId = getAttr(el, 'styleId');
    if (!styleId) continue;

    const rawType = getAttr(el, 'type');
    const type: DocxStyleDef['type'] =
      rawType === 'character' || rawType === 'table' || rawType === 'numbering'
        ? rawType
        : 'paragraph';
    const isDefault = getAttr(el, 'default') === '1' || getAttr(el, 'default') === 'true';

    const children = childElements(el);
    const nameEl = children.find((c) => localName(c) === 'name');
    const basedOnEl = children.find((c) => localName(c) === 'basedOn');
    const pPrEl = children.find((c) => localName(c) === 'pPr');
    const rPrEl = children.find((c) => localName(c) === 'rPr');
    const outlineEl = pPrEl
      ? childElements(pPrEl).find((c) => localName(c) === 'outlineLvl')
      : undefined;
    const outlineNum = outlineEl ? Number(getAttr(outlineEl, 'val')) : NaN;

    stylesMap[styleId] = {
      styleId,
      name: getAttr(nameEl, 'val') || styleId,
      type,
      basedOn: getAttr(basedOnEl, 'val') || undefined,
      outlineLvl:
        Number.isInteger(outlineNum) && outlineNum >= 0 && outlineNum <= 9
          ? outlineNum
          : undefined,
      isDefault,
    };

    if (rPrEl) {
      styleRPrMap[styleId] = serializer.serializeToString(rPrEl);
    }
  }

  return { stylesMap, styleRPrMap };
}

function isBodyStartText(text: string): boolean {
  const t = text.trim();
  return (
    /^(摘要|Abstract|摘\s*要|目\s*录|引言|绪论|第[一二三四五六七八九十1-9]+章|1[\.\s、])/.test(t)
  );
}

function isFrontMatterDeclarationText(text: string): boolean {
  const t = text.trim();
  return /^(原创性声明|独创性声明|学位论文原创性声明|版权使用授权书|学位论文版权使用授权书|关于论文使用授权|授权声明|版权声明|Statement of Originality|Thesis Declaration)/i.test(
    t,
  );
}

/**
 * Parses a real .docx binary into structured blocks, comments, revisions,
 * formulas, images, footnotes, and protected Zotero/EndNote citation fields.
 */
export async function parseDocxBytes(input: Uint8Array | ArrayBuffer): Promise<ParsedDocxBundle> {
  const rawBytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  const zip = await JSZip.loadAsync(rawBytes);
  const parser = new DOMParser();
  const serializer = new XMLSerializer();

  const docXmlStr = await zip.file('word/document.xml')?.async('string');
  if (!docXmlStr) {
    throw new Error('Invalid .docx archive: missing word/document.xml');
  }
  const docDom = parser.parseFromString(docXmlStr, 'application/xml');

  // 0. Parse word/styles.xml for custom & modified style definitions
  const stylesXmlStr = await zip.file('word/styles.xml')?.async('string');
  const { stylesMap, styleRPrMap } = parseStylesXml(stylesXmlStr, parser, serializer);

  // 1. Parse comments.xml
  const commentsMap: Record<string, CommentMeta> = {};
  const commentsXmlStr = await zip.file('word/comments.xml')?.async('string');
  if (commentsXmlStr) {
    const cDom = parser.parseFromString(commentsXmlStr, 'application/xml');
    const cNodes = cDom.getElementsByTagName('*');
    for (let i = 0; i < cNodes.length; i++) {
      const el = cNodes[i];
      if (localName(el) === 'comment') {
        const id = getAttr(el, 'id');
        const author = getAttr(el, 'author') || '批注者';
        const date = getAttr(el, 'date') || new Date().toISOString();
        const text = (el.textContent ?? '').trim();
        if (id) commentsMap[id] = { id, author, date, text };
      }
    }
  }

  // 2. Parse footnotes.xml & endnotes.xml
  const footnotesMap: Record<string, string> = {};
  for (const fnPath of ['word/footnotes.xml', 'word/endnotes.xml']) {
    const fnXml = await zip.file(fnPath)?.async('string');
    if (fnXml) {
      const fDom = parser.parseFromString(fnXml, 'application/xml');
      const all = fDom.getElementsByTagName('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        const ln = localName(el);
        if (ln === 'footnote' || ln === 'endnote') {
          const id = getAttr(el, 'id');
          if (id && Number(id) > 0) {
            footnotesMap[`${ln}:${id}`] = (el.textContent ?? '').trim();
          }
        }
      }
    }
  }

  // 3. Parse relationships & extract embedded media assets
  const relTargetMap: Record<string, string> = {};
  const relsXmlStr = await zip.file('word/_rels/document.xml.rels')?.async('string');
  if (relsXmlStr) {
    const rDom = parser.parseFromString(relsXmlStr, 'application/xml');
    const rels = rDom.getElementsByTagName('*');
    for (let i = 0; i < rels.length; i++) {
      const el = rels[i];
      if (localName(el) === 'Relationship') {
        const id = el.getAttribute('Id') || '';
        const target = el.getAttribute('Target') || '';
        if (id && target) relTargetMap[id] = target;
      }
    }
  }

  const mediaAssets: Record<string, MediaAsset> = {};
  for (const [rId, target] of Object.entries(relTargetMap)) {
    const zipPath = target.startsWith('word/') ? target : `word/${target.replace(/^\//, '')}`;
    const fileEntry = zip.file(zipPath);
    if (fileEntry && /media\//i.test(zipPath)) {
      const bytes = await fileEntry.async('uint8array');
      const mimeType = mimeFromExt(zipPath);
      const filename = zipPath.split('/').pop() || `${rId}.bin`;
      mediaAssets[rId] = {
        id: rId,
        filename,
        mimeType,
        dataUrl: `data:${mimeType};base64,${uint8ToBase64(bytes)}`,
      };
    }
  }

  // 4. Walk word/document.xml body
  const bodyEl = docDom.getElementsByTagName('*');
  let bodyNode: XmlElement | null = null;
  for (let i = 0; i < bodyEl.length; i++) {
    if (localName(bodyEl[i]) === 'body') {
      bodyNode = bodyEl[i];
      break;
    }
  }
  if (!bodyNode) {
    throw new Error('Invalid .docx archive: missing w:body');
  }

  const revisionsMap: Record<string, RevisionMeta> = {};
  const citationsSidecar: CitationSidecarEntry[] = [];
  const activeCommentIds = new Set<string>();
  let revCounter = 1;
  let citCounter = 1;
  let blockIndex = 0;

  const blocks: ParsedBlock[] = [];

  const processParagraph = (pEl: XmlElement): ParsedBlock => {
    const rawXml = serializer.serializeToString(pEl);
    const headingLevel = detectHeadingLevel(pEl, stylesMap);
    const segments: ParsedSegment[] = [];
    let hasExplicitBreakAfter = false;
    let hasReviewMarkup = false;

    const pPr = childElements(pEl).find((c) => localName(c) === 'pPr');
    const pPrXml = pPr ? serializer.serializeToString(pPr) : undefined;
    const pStyleEl = pPr ? childElements(pPr).find((c) => localName(c) === 'pStyle') : undefined;
    const pStyleId = pStyleEl ? getAttr(pStyleEl, 'val') || undefined : undefined;
    const pPrRPrEl = pPr ? childElements(pPr).find((c) => localName(c) === 'rPr') : undefined;
    const pPrRPrXml = pPrRPrEl ? serializer.serializeToString(pPrRPrEl) : undefined;
    if (pPr && findDescendant(pPr, 'sectPr')) {
      hasExplicitBreakAfter = true;
    }

    const extractRPrXml = (rEl: XmlElement): string | undefined => {
      const rPr = childElements(rEl).find((c) => localName(c) === 'rPr');
      return rPr ? serializer.serializeToString(rPr) : undefined;
    };

    const pushSeg = (text: string, revisionId?: string, rPrXml?: string) => {
      if (!text) return;
      segments.push({
        text,
        commentIds: Array.from(activeCommentIds),
        revisionId,
        rPrXml,
      });
    };

    const readPlainRunText = (el: XmlElement): string => {
      let txt = '';
      const walk = (n: XmlNode) => {
        const ln = localName(n);
        if (ln === 't' || ln === 'delText') {
          txt += n.textContent ?? '';
          return;
        }
        if (ln === 'tab') {
          txt += ' ';
          return;
        }
        if (ln === 'br') {
          const brType = getAttr(n as XmlElement, 'type');
          if (brType === 'page') hasExplicitBreakAfter = true;
          else txt += '\n';
          return;
        }
        for (let k = 0; k < n.childNodes.length; k++) {
          walk(n.childNodes[k]);
        }
      };
      walk(el);
      return txt;
    };

    const readFirstRunRPr = (el: XmlElement): string | undefined => {
      if (localName(el) === 'r') return extractRPrXml(el);
      const rChild = childElements(el).find((c) => localName(c) === 'r');
      return rChild ? extractRPrXml(rChild) : undefined;
    };

    const pChildren = childElements(pEl);
    // Track field code state (Zotero / EndNote / Cross-reference)
    let inField = false;
    let inFieldResult = false;
    let fieldInstr = '';
    let fieldResultText = '';
    let fieldNodesXml: string[] = [];

    for (let i = 0; i < pChildren.length; i++) {
      const child = pChildren[i];
      const ln = localName(child);

      if (ln === 'pPr') continue;

      if (ln === 'commentRangeStart') {
        hasReviewMarkup = true;
        const cid = getAttr(child, 'id');
        if (cid) activeCommentIds.add(cid);
        continue;
      }
      if (ln === 'commentRangeEnd') {
        const cid = getAttr(child, 'id');
        if (cid) activeCommentIds.delete(cid);
        continue;
      }

      // Check Word complex field (w:fldChar begin -> instrText -> separate -> result -> end)
      if (ln === 'r') {
        const rPrXml = extractRPrXml(child);
        const fldChar = findDescendant(child, 'fldChar');
        if (fldChar) {
          const fType = getAttr(fldChar, 'fldCharType');
          if (fType === 'begin') {
            inField = true;
            inFieldResult = false;
            fieldInstr = '';
            fieldResultText = '';
            fieldNodesXml = [serializer.serializeToString(child)];
            continue;
          }
          if (fType === 'separate' && inField) {
            inFieldResult = true;
            fieldNodesXml.push(serializer.serializeToString(child));
            continue;
          }
          if (fType === 'end' && inField) {
            fieldNodesXml.push(serializer.serializeToString(child));
            const rawFieldXml = fieldNodesXml.join('');
            const upperInstr = fieldInstr.toUpperCase();
            if (upperInstr.includes('ZOTERO') || upperInstr.includes('EN.CITE')) {
              const provider = upperInstr.includes('ZOTERO') ? 'zotero' : 'endnote';
              const placeholder = `[@${provider}:${String(citCounter++).padStart(3, '0')}]`;
              citationsSidecar.push({
                placeholder,
                provider,
                rawXml: rawFieldXml,
                displayText: fieldResultText.trim() || placeholder,
              });
              pushSeg(placeholder, undefined, rPrXml);
            } else {
              pushSeg(fieldResultText || '', undefined, rPrXml);
            }
            inField = false;
            inFieldResult = false;
            fieldInstr = '';
            fieldResultText = '';
            fieldNodesXml = [];
            continue;
          }
        }

        if (inField) {
          fieldNodesXml.push(serializer.serializeToString(child));
          if (!inFieldResult) {
            const instr = findDescendant(child, 'instrText');
            if (instr) fieldInstr += instr.textContent ?? '';
          } else {
            fieldResultText += readPlainRunText(child);
          }
          continue;
        }

        // Check embedded image (a:blip r:embed)
        const blip = findDescendant(child, 'blip');
        if (blip) {
          const rEmbed = getAttr(blip, 'embed');
          if (rEmbed && mediaAssets[rEmbed]) {
            pushSeg(`![${mediaAssets[rEmbed].filename}](arc-media://${rEmbed})`, undefined, rPrXml);
            continue;
          }
        }

        // Check footnote / endnote reference
        const fnRef = findDescendant(child, 'footnoteReference') || findDescendant(child, 'endnoteReference');
        if (fnRef) {
          const fid = getAttr(fnRef, 'id');
          const key = `${localName(fnRef).startsWith('footnote') ? 'footnote' : 'endnote'}:${fid}`;
          if (fid && footnotesMap[key]) {
            pushSeg(`[^fn${fid}]`, undefined, rPrXml);
            continue;
          }
        }

        // Check inline OMML inside run or plain text
        const inlineMath = findDescendant(child, 'oMath');
        if (inlineMath) {
          pushSeg(`$${ommlNodeToLatex(inlineMath)}$`, undefined, rPrXml);
        } else {
          pushSeg(readPlainRunText(child), undefined, rPrXml);
        }
        continue;
      }

      // OMML math directly under w:p
      if (ln === 'oMath') {
        pushSeg(`$${ommlNodeToLatex(child)}$`);
        continue;
      }
      if (ln === 'oMathPara') {
        pushSeg(`\n$$\n${ommlNodeToLatex(child)}\n$$\n`);
        continue;
      }

      // Track Changes: w:del (optionally paired with adjacent w:ins)
      if (ln === 'del') {
        hasReviewMarkup = true;
        const delAuthor = getAttr(child, 'author') || '导师';
        const delDate = getAttr(child, 'date') || new Date().toISOString();
        const delText = readPlainRunText(child);
        const delRPr = readFirstRunRPr(child);

        // Look ahead to see if next element is w:ins (a replacement edit)
        const nextEl = pChildren[i + 1];
        if (nextEl && localName(nextEl) === 'ins') {
          const insText = readPlainRunText(nextEl);
          const revId = `rev_${revCounter++}`;
          revisionsMap[revId] = {
            id: revId,
            kind: 'replace',
            author: delAuthor,
            date: delDate,
            originalText: delText,
            suggestedText: insText,
          };
          // Keep ORIGINAL text in Markdown/LaTeX body!
          pushSeg(delText, revId, delRPr);
          i += 1; // skip paired w:ins
        } else {
          const revId = `rev_${revCounter++}`;
          revisionsMap[revId] = {
            id: revId,
            kind: 'delete',
            author: delAuthor,
            date: delDate,
            originalText: delText,
            suggestedText: '',
          };
          // Keep ORIGINAL text in Markdown/LaTeX body!
          pushSeg(delText, revId, delRPr);
        }
        continue;
      }

      if (ln === 'ins') {
        hasReviewMarkup = true;
        const insAuthor = getAttr(child, 'author') || '导师';
        const insDate = getAttr(child, 'date') || new Date().toISOString();
        const insText = readPlainRunText(child);
        if (insText) {
          const revId = `rev_${revCounter++}`;
          revisionsMap[revId] = {
            id: revId,
            kind: 'insert',
            author: insAuthor,
            date: insDate,
            originalText: '',
            suggestedText: insText,
          };
          // Emit visible anchor marker at insertion point so user can hover/accept/reject
          pushSeg(INSERTION_ANCHOR_TOKEN, revId, readFirstRunRPr(child));
        }
        continue;
      }

      // Nested smart tags or hyperlinks: preserve per-run rPrXml
      if (ln === 'hyperlink' || ln === 'smartTag') {
        const innerRuns = childElements(child).filter((c) => localName(c) === 'r');
        if (innerRuns.length > 0) {
          for (const ir of innerRuns) {
            pushSeg(readPlainRunText(ir), undefined, extractRPrXml(ir));
          }
        } else {
          pushSeg(readPlainRunText(child));
        }
      }
    }

    // Compute dominant run style by cumulative character length
    const rPrCounts = new Map<string, number>();
    for (const seg of segments) {
      if (seg.rPrXml && seg.text !== INSERTION_ANCHOR_TOKEN) {
        rPrCounts.set(seg.rPrXml, (rPrCounts.get(seg.rPrXml) ?? 0) + seg.text.length);
      }
    }
    let dominantRPrXml: string | undefined;
    let bestCount = -1;
    for (const [xml, cnt] of rPrCounts.entries()) {
      if (cnt > bestCount) {
        bestCount = cnt;
        dominantRPrXml = xml;
      }
    }
    if (!dominantRPrXml && pPrRPrXml) {
      dominantRPrXml = pPrRPrXml;
    }

    const previewText = segments.map((s) => s.text).join('').trim();
    const isPageBreakOnly = hasExplicitBreakAfter && previewText.length === 0;

    return {
      index: blockIndex++,
      kind: isPageBreakOnly ? 'page-break' : headingLevel ? 'heading' : 'paragraph',
      headingLevel,
      pStyleId,
      pPrXml,
      dominantRPrXml,
      hasReviewMarkup,
      previewText: isPageBreakOnly ? '[分页符 / Page Break]' : previewText,
      rawXml,
      hasExplicitBreakAfter,
      isCoverSdt: false,
      segments,
    };
  };

  for (const child of childElements(bodyNode)) {
    const ln = localName(child);
    if (ln === 'sectPr') continue;

    if (ln === 'sdt') {
      const docPartGallery = findDescendant(child, 'docPartGallery');
      const isCoverSdt = /cover/i.test(getAttr(docPartGallery, 'val'));
      const rawXml = serializer.serializeToString(child);
      const text = (child.textContent ?? '').trim();
      blocks.push({
        index: blockIndex++,
        kind: isCoverSdt ? 'sdt-cover' : 'paragraph',
        previewText: text || '[文档内容控件]',
        rawXml,
        hasExplicitBreakAfter: isCoverSdt,
        isCoverSdt,
        segments: text ? [{ text, commentIds: [] }] : [],
      });
      continue;
    }

    if (ln === 'p') {
      blocks.push(processParagraph(child));
      continue;
    }

    if (ln === 'tbl') {
      const rawXml = serializer.serializeToString(child);
      const rows: string[][] = [];
      for (const tr of childElements(child).filter((c) => localName(c) === 'tr')) {
        const rowCells: string[] = [];
        for (const tc of childElements(tr).filter((c) => localName(c) === 'tc')) {
          const cellText = childElements(tc)
            .filter((c) => localName(c) === 'p')
            .map((p) => {
              // Extract plain text including OMML inside table cells
              const parsedCell = processParagraph(p);
              // undo blockIndex increment for inner table cell paragraphs
              blockIndex--;
              return parsedCell.segments.map((s) => s.text).join('').trim();
            })
            .join(' ');
          rowCells.push(cellText);
        }
        if (rowCells.length > 0) rows.push(rowCells);
      }
      blocks.push({
        index: blockIndex++,
        kind: 'table',
        previewText: `[表格 ${rows.length}×${rows[0]?.length ?? 0}] ${rows[0]?.join(' | ') ?? ''}`,
        rawXml,
        hasExplicitBreakAfter: false,
        isCoverSdt: false,
        segments: [],
        tableRows: rows,
      });
    }
  }

  // 5. Smart Cover Detection (scans up to 120 blocks & multi-page front matter)
  let detectedCoverEndIndex = 0;
  const scanLimit = Math.min(blocks.length, 120);
  for (let i = 0; i < scanLimit; i++) {
    const b = blocks[i];
    if (b.isCoverSdt) {
      detectedCoverEndIndex = i + 1;
      continue;
    }
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
        detectedCoverEndIndex = i + 1;
        continue;
      }
      detectedCoverEndIndex = i + 1;
      break;
    }
    if (i > 0 && (b.kind === 'heading' || isBodyStartText(b.previewText))) {
      if (!isFrontMatterDeclarationText(b.previewText)) {
        detectedCoverEndIndex = i;
        break;
      }
    }
  }

  return {
    rawBytes,
    blocks,
    detectedCoverEndIndex,
    commentsMap,
    revisionsMap,
    footnotesMap,
    citationsSidecar,
    mediaAssets,
    stylesMap,
    styleRPrMap,
  };
}

/**
 * Extracts Markdown or LaTeX body text & precisely aligned AnnotationItem offsets
 * starting from `coverEndBlockIndex` (blocks before it stay untouched in coverXmlNodes).
 */
export function extractBodyWithCoverIndex(
  bundle: ParsedDocxBundle,
  coverEndBlockIndex: number,
  format: EditorFormat,
): ExtractedDocContent {
  const safeCutoff = Math.max(0, Math.min(bundle.blocks.length, coverEndBlockIndex));
  const coverBlocks = bundle.blocks.slice(0, safeCutoff);
  const bodyBlocks = bundle.blocks.slice(safeCutoff);

  const coverXmlNodes = coverBlocks.map((b) => b.rawXml);
  const annotationsMap = new Map<string, AnnotationItem>();
  const styleBlocks: DocxBlockStyleEntry[] = [];
  const headingTemplates: Record<number, { styleId: string; pPrXml: string; rPrXml?: string }> = {};
  const bodyCandidateCounts = new Map<
    string,
    { count: number; styleId?: string; pPrXml?: string; rPrXml?: string }
  >();
  let out = '';

  const appendTracked = (
    text: string,
    commentIds: string[],
    revisionId?: string,
  ) => {
    const start = out.length;
    out += text;
    const end = out.length;

    for (const cid of commentIds) {
      const meta = bundle.commentsMap[cid];
      if (!meta) continue;
      const annKey = `comment:${cid}`;
      const existing = annotationsMap.get(annKey);
      if (existing) {
        existing.anchorEnd = end;
        existing.originalText = out.slice(existing.anchorStart, existing.anchorEnd);
      } else {
        annotationsMap.set(annKey, {
          id: annKey,
          type: 'comment',
          author: meta.author,
          date: meta.date,
          commentText: meta.text,
          originalText: text,
          anchorStart: start,
          anchorEnd: end,
          status: 'open',
          replies: [],
        });
      }
    }

    if (revisionId) {
      const rev = bundle.revisionsMap[revisionId];
      if (rev) {
        const annKey = `revision:${revisionId}`;
        annotationsMap.set(annKey, {
          id: annKey,
          type: 'revision',
          revisionKind: rev.kind,
          author: rev.author,
          date: rev.date,
          originalText: rev.originalText,
          suggestedText: rev.suggestedText,
          anchorStart: start,
          anchorEnd: end,
          status: 'open',
          replies: [],
        });
      }
    }
  };

  bodyBlocks.forEach((block, idx) => {
    if (block.kind === 'page-break') return;

    if (block.kind === 'table' && block.tableRows && block.tableRows.length > 0) {
      let tableBlockText = '';
      if (format === 'markdown') {
        const [header, ...rest] = block.tableRows;
        tableBlockText += `| ${header.join(' | ')} |\n`;
        tableBlockText += `| ${header.map(() => '---').join(' | ')} |\n`;
        for (const r of rest) {
          tableBlockText += `| ${r.join(' | ')} |\n`;
        }
      } else {
        const cols = block.tableRows[0].length;
        tableBlockText += `\\begin{table}[htbp]\n\\centering\n\\begin{tabular}{${'l'.repeat(cols)}}\n\\hline\n`;
        block.tableRows.forEach((r, rIdx) => {
          tableBlockText += `${r.join(' & ')} \\\\\n`;
          if (rIdx === 0) tableBlockText += `\\hline\n`;
        });
        tableBlockText += `\\hline\n\\end{tabular}\n\\end{table}\n`;
      }
      out += tableBlockText;
      styleBlocks.push({
        originalBlockText: tableBlockText.trim(),
        plainText: block.previewText,
        kind: 'table',
        runs: [],
        rawXml: block.rawXml,
      });
      if (idx < bodyBlocks.length - 1) out += '\n';
      return;
    }

    if (block.segments.length === 0) return;

    const blockStartOffset = out.length;
    if (block.kind === 'heading' && block.headingLevel) {
      if (format === 'markdown') {
        out += `${'#'.repeat(block.headingLevel)} `;
      } else {
        const cmd =
          block.headingLevel === 1
            ? 'section'
            : block.headingLevel === 2
              ? 'subsection'
              : 'subsubsection';
        out += `\\${cmd}{`;
      }
    }

    const plainStartOffset = out.length;
    const runs: DocxStyledRun[] = [];
    for (const seg of block.segments) {
      appendTracked(seg.text, seg.commentIds, seg.revisionId);
      if (seg.text !== INSERTION_ANCHOR_TOKEN) {
        const prevRun = runs[runs.length - 1];
        if (prevRun && prevRun.rPrXml === seg.rPrXml) {
          prevRun.text += seg.text;
        } else {
          runs.push({ text: seg.text, rPrXml: seg.rPrXml });
        }
      }
    }
    const plainText = out.slice(plainStartOffset).replaceAll(INSERTION_ANCHOR_TOKEN, '').trim();

    if (block.kind === 'heading' && block.headingLevel && format === 'latex') {
      out += '}';
    }
    const originalBlockText = out
      .slice(blockStartOffset)
      .replaceAll(INSERTION_ANCHOR_TOKEN, '')
      .trim();

    const entryKind: DocxBlockStyleEntry['kind'] =
      block.kind === 'heading' && block.headingLevel ? 'heading' : 'paragraph';

    styleBlocks.push({
      originalBlockText,
      plainText,
      kind: entryKind,
      headingLevel: block.headingLevel,
      pStyleId: block.pStyleId,
      pPrXml: block.pPrXml,
      dominantRPrXml: block.dominantRPrXml,
      runs,
      rawXml: block.rawXml,
      hasReviewMarkup: block.hasReviewMarkup,
    });

    if (entryKind === 'heading' && block.headingLevel && !headingTemplates[block.headingLevel]) {
      headingTemplates[block.headingLevel] = {
        styleId: block.pStyleId ?? `Heading${block.headingLevel}`,
        pPrXml: block.pPrXml ?? `<w:pPr><w:pStyle w:val="Heading${block.headingLevel}"/></w:pPr>`,
        rPrXml: block.dominantRPrXml,
      };
    } else if (entryKind === 'paragraph') {
      const key = `${block.pStyleId ?? ''}::${block.pPrXml ?? ''}::${block.dominantRPrXml ?? ''}`;
      const existing = bodyCandidateCounts.get(key);
      if (existing) existing.count += 1;
      else {
        bodyCandidateCounts.set(key, {
          count: 1,
          styleId: block.pStyleId,
          pPrXml: block.pPrXml,
          rPrXml: block.dominantRPrXml,
        });
      }
    }

    if (idx < bodyBlocks.length - 1) {
      out += '\n\n';
    }
  });

  const stylesMap = bundle.stylesMap ?? {};
  const styleRPrMap = bundle.styleRPrMap ?? {};

  // Fill missing heading templates from stylesMap (so user-defined heading styles apply to new headings too)
  for (let lvl = 1; lvl <= 6; lvl++) {
    if (headingTemplates[lvl]) continue;
    const found = Object.values(stylesMap).find(
      (s) =>
        s.type === 'paragraph' &&
        (s.outlineLvl === lvl - 1 ||
          matchHeadingNameOrId(s.name) === lvl ||
          matchHeadingNameOrId(s.styleId) === lvl),
    );
    if (found) {
      headingTemplates[lvl] = {
        styleId: found.styleId,
        pPrXml: `<w:pPr><w:pStyle w:val="${found.styleId}"/></w:pPr>`,
        rPrXml: styleRPrMap[found.styleId],
      };
    }
  }

  let bodyTemplate: DocxStyleSidecar['bodyTemplate'];
  let bestBodyCount = 0;
  for (const cand of bodyCandidateCounts.values()) {
    if (cand.count > bestBodyCount && (cand.pPrXml || cand.rPrXml)) {
      bestBodyCount = cand.count;
      bodyTemplate = {
        styleId: cand.styleId,
        pPrXml: cand.pPrXml,
        rPrXml: cand.rPrXml,
      };
    }
  }
  if (!bodyTemplate) {
    const defaultPara = Object.values(stylesMap).find(
      (s) => s.type === 'paragraph' && s.isDefault,
    );
    if (defaultPara) {
      bodyTemplate = {
        styleId: defaultPara.styleId,
        pPrXml: `<w:pPr><w:pStyle w:val="${defaultPara.styleId}"/></w:pPr>`,
        rPrXml: styleRPrMap[defaultPara.styleId],
      };
    }
  }

  // Append footnotes block if any referenced
  const fnEntries = Object.entries(bundle.footnotesMap);
  if (fnEntries.length > 0) {
    out += '\n\n';
    for (const [k, v] of fnEntries) {
      const id = k.split(':')[1];
      if (format === 'markdown') {
        out += `[^fn${id}]: ${v}\n`;
      } else {
        out += `% [Footnote ${id}]: ${v}\n`;
      }
    }
  }

  return {
    format,
    text: out.trimEnd(),
    annotations: Array.from(annotationsMap.values()).sort((a, b) => a.anchorStart - b.anchorStart),
    coverXmlNodes,
    coverBlockCount: safeCutoff,
    citationsSidecar: bundle.citationsSidecar,
    styleSidecar: {
      stylesMap,
      headingTemplates,
      bodyTemplate,
      blocks: styleBlocks,
    },
    mediaAssets: bundle.mediaAssets,
  };
}
