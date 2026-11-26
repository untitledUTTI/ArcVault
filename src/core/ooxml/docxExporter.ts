import JSZip from 'jszip';
import { diffChars, diffWordsWithSpace } from 'diff';
import {
  DOMParser,
  XMLSerializer,
  type Element as XmlElement,
  type Node as XmlNode,
} from '@xmldom/xmldom';
import { latexToOmmlXml } from './ommlToLatex';
import { base64ToUint8, INSERTION_ANCHOR_TOKEN } from './docxParser';
import type {
  CitationSidecarEntry,
  DocxBlockStyleEntry,
  DocxStyleSidecar,
  DocxStyledRun,
  EditorFormat,
} from '../../types/archive';

export interface ExportDocxParams {
  baseDocxBase64?: string;
  coverXmlNodes: string[];
  bodyText: string;
  format: EditorFormat;
  citationsSidecar: CitationSidecarEntry[];
  styleSidecar?: DocxStyleSidecar;
  mode: 'clean' | 'redline';
  baselineText?: string;
  author?: string;
  title?: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function localName(node: XmlNode | null | undefined): string {
  if (!node) return '';
  const el = node as XmlElement;
  return el.localName || (el.nodeName ? el.nodeName.replace(/^.*:/, '') : '');
}

function childElements(node: XmlNode): XmlElement[] {
  const out: XmlElement[] = [];
  for (let i = 0; i < node.childNodes.length; i++) {
    const ch = node.childNodes[i];
    if (ch.nodeType === 1) out.push(ch as XmlElement);
  }
  return out;
}

interface InlineFormatFlags {
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
}

/**
 * Safely merges Markdown/LaTeX inline formatting flags (<w:b/>, <w:i/>, <w:strike/>)
 * into an existing <w:rPr>...</w:rPr> XML string without clobbering original fonts/sizes/colors.
 */
function mergeRPrXml(
  baseRPrXml: string | undefined,
  fmt: InlineFormatFlags,
): string {
  const needsBold = Boolean(fmt.bold);
  const needsItalic = Boolean(fmt.italic);
  const needsStrike = Boolean(fmt.strike);

  if (!needsBold && !needsItalic && !needsStrike) {
    return baseRPrXml ?? '';
  }

  let inner = '';
  if (baseRPrXml) {
    const m = baseRPrXml.match(/^<w:rPr(?:\s[^>]*)?>([\s\S]*)<\/w:rPr>$/);
    if (m) inner = m[1];
  }

  if (needsBold && !/<w:b(?:\s|\/|>)/.test(inner)) {
    inner += '<w:b/>';
  }
  if (needsItalic && !/<w:i(?:\s|\/|>)/.test(inner)) {
    inner += '<w:i/>';
  }
  if (needsStrike && !/<w:strike(?:\s|\/|>)/.test(inner)) {
    inner += '<w:strike/>';
  }

  return inner ? `<w:rPr>${inner}</w:rPr>` : '';
}

function makeRunXml(text: string, rPrXml?: string): string {
  const rPr = rPrXml || '';
  return `<w:r>${rPr}<w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

type StyledToken =
  | { kind: 'math'; latex: string }
  | { kind: 'citation'; placeholder: string }
  | { kind: 'footnote'; id: string }
  | { kind: 'text'; text: string; fmt: InlineFormatFlags };

function tokenizeInlineContent(
  text: string,
  format: EditorFormat,
): StyledToken[] {
  const tokens: StyledToken[] = [];
  const pattern =
    format === 'markdown'
      ? /(\$[^$\n]+\$|\[@(?:zotero|endnote):\d{3}\]|\[\^fn\d+\]|\*\*[^*\n]+\*\*|~~[^~\n]+~~|\*[^*\n]+\*)/g
      : /(\$[^$\n]+\$|\[@(?:zotero|endnote):\d{3}\]|\[\^fn\d+\]|\\textbf\{[^{}]+\}|\\textit\{[^{}]+\})/g;

  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      tokens.push({
        kind: 'text',
        text: text.slice(lastIndex, idx),
        fmt: {},
      });
    }
    const raw = match[0];
    if (raw.startsWith('$') && raw.endsWith('$')) {
      tokens.push({ kind: 'math', latex: raw.slice(1, -1) });
    } else if (/^\[@(?:zotero|endnote):\d{3}\]$/.test(raw)) {
      tokens.push({ kind: 'citation', placeholder: raw });
    } else if (/^\[\^fn(\d+)\]$/.test(raw)) {
      const m = raw.match(/^\[\^fn(\d+)\]$/);
      if (m) tokens.push({ kind: 'footnote', id: m[1] });
    } else if (format === 'markdown' && raw.startsWith('**') && raw.endsWith('**')) {
      tokens.push({ kind: 'text', text: raw.slice(2, -2), fmt: { bold: true } });
    } else if (format === 'markdown' && raw.startsWith('~~') && raw.endsWith('~~')) {
      tokens.push({ kind: 'text', text: raw.slice(2, -2), fmt: { strike: true } });
    } else if (format === 'markdown' && raw.startsWith('*') && raw.endsWith('*')) {
      tokens.push({ kind: 'text', text: raw.slice(1, -1), fmt: { italic: true } });
    } else if (format === 'latex' && raw.startsWith('\\textbf{')) {
      tokens.push({ kind: 'text', text: raw.slice(8, -1), fmt: { bold: true } });
    } else if (format === 'latex' && raw.startsWith('\\textit{')) {
      tokens.push({ kind: 'text', text: raw.slice(8, -1), fmt: { italic: true } });
    }
    lastIndex = idx + raw.length;
  }

  if (lastIndex < text.length) {
    tokens.push({ kind: 'text', text: text.slice(lastIndex), fmt: {} });
  }
  return tokens;
}

/**
 * Maps each character in `editedPlain` back to the best original `<w:rPr>` XML
 * from `originalRuns` via character-level diffing, so unchanged words keep exact
 * original fonts/colors/bold/italic and inserted words inherit neighboring run styles.
 */
function buildCharRPrLookup(
  originalRuns: DocxStyledRun[],
  editedPlain: string,
  fallbackRPrXml?: string,
): Array<string | undefined> {
  if (editedPlain.length === 0) return [];
  if (originalRuns.length === 0) {
    return new Array<string | undefined>(editedPlain.length).fill(fallbackRPrXml);
  }

  let origText = '';
  const origCharRPr: Array<string | undefined> = [];
  for (const run of originalRuns) {
    for (let i = 0; i < run.text.length; i++) {
      origText += run.text[i];
      origCharRPr.push(run.rPrXml ?? fallbackRPrXml);
    }
  }

  if (origText === editedPlain) {
    return origCharRPr;
  }

  const out: Array<string | undefined> = [];
  const diffs = diffChars(origText, editedPlain);
  let origCursor = 0;

  for (const part of diffs) {
    if (part.removed) {
      origCursor += part.value.length;
      continue;
    }
    if (part.added) {
      const inherited =
        origCharRPr[Math.max(0, Math.min(origCharRPr.length - 1, origCursor - 1))] ??
        origCharRPr[Math.min(origCharRPr.length - 1, origCursor)] ??
        fallbackRPrXml;
      for (let i = 0; i < part.value.length; i++) {
        out.push(inherited);
      }
      continue;
    }
    for (let i = 0; i < part.value.length; i++) {
      out.push(origCharRPr[origCursor] ?? fallbackRPrXml);
      origCursor += 1;
    }
  }

  return out;
}

function renderStyledInlineToOoxml(
  content: string,
  format: EditorFormat,
  citationMap: Map<string, CitationSidecarEntry>,
  originalRuns: DocxStyledRun[],
  defaultRPrXml?: string,
): string {
  const tokens = tokenizeInlineContent(content, format);
  if (tokens.length === 0) {
    return makeRunXml('', defaultRPrXml);
  }

  // Reconstruct flat plain string of all inline tokens so char offsets align with originalRuns
  const flatStr = tokens
    .map((t) => {
      if (t.kind === 'text') return t.text;
      if (t.kind === 'math') return `$${t.latex}$`;
      if (t.kind === 'citation') return t.placeholder;
      return `[^fn${t.id}]`;
    })
    .join('');

  const charRPr = buildCharRPrLookup(originalRuns, flatStr, defaultRPrXml);
  let cursor = 0;
  let xml = '';

  for (const tok of tokens) {
    if (tok.kind === 'math') {
      cursor += tok.latex.length + 2;
      xml += latexToOmmlXml(tok.latex, false);
      continue;
    }
    if (tok.kind === 'citation') {
      cursor += tok.placeholder.length;
      if (citationMap.has(tok.placeholder)) {
        xml += citationMap.get(tok.placeholder)!.rawXml;
      } else {
        xml += makeRunXml(tok.placeholder, defaultRPrXml);
      }
      continue;
    }
    if (tok.kind === 'footnote') {
      cursor += `[^fn${tok.id}]`.length;
      xml += `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/></w:rPr><w:footnoteReference w:id="${escapeXml(tok.id)}"/></w:r>`;
      continue;
    }

    // Group contiguous characters sharing identical merged <w:rPr>
    let segStart = 0;
    let curRPr = mergeRPrXml(charRPr[cursor] ?? defaultRPrXml, tok.fmt);
    for (let i = 1; i <= tok.text.length; i++) {
      const nextRPr =
        i < tok.text.length
          ? mergeRPrXml(charRPr[cursor + i] ?? defaultRPrXml, tok.fmt)
          : '__END__';
      if (nextRPr !== curRPr) {
        xml += makeRunXml(tok.text.slice(segStart, i), curRPr || undefined);
        segStart = i;
        curRPr = nextRPr;
      }
    }
    cursor += tok.text.length;
  }

  return xml || makeRunXml('', defaultRPrXml);
}

function normalizeBodyLines(bodyText: string): string[] {
  const cleaned = bodyText.replaceAll(INSERTION_ANCHOR_TOKEN, '');
  return cleaned.split(/\n{2,}/);
}

interface ParsedEditBlock {
  raw: string;
  trimmed: string;
  kind: DocxBlockStyleEntry['kind'];
  headingLevel?: number;
  content: string;
  tableRows?: string[][];
}

function parseTableRowsFromMarkdown(trimmed: string): string[][] {
  return trimmed
    .split('\n')
    .map((r) => r.trim())
    .filter((r) => r.startsWith('|'))
    .map((r) =>
      r
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim()),
    )
    .filter((cells) => !cells.every((c) => /^:?-+:?$/.test(c)));
}

function classifyEditedBlock(block: string, format: EditorFormat): ParsedEditBlock | null {
  const trimmed = block.trim();
  if (!trimmed) return null;
  if (/^\[\^fn\d+\]:/.test(trimmed) || /^%\s*\[Footnote/.test(trimmed)) {
    return null;
  }
  if (trimmed.startsWith('$$') && trimmed.endsWith('$$')) {
    return {
      raw: block,
      trimmed,
      kind: 'math-block',
      content: trimmed.slice(2, -2).trim(),
    };
  }
  if (format === 'markdown' && trimmed.startsWith('|')) {
    const rows = parseTableRowsFromMarkdown(trimmed);
    if (rows.length > 0) {
      return {
        raw: block,
        trimmed,
        kind: 'table',
        content: trimmed,
        tableRows: rows,
      };
    }
  }

  if (format === 'markdown') {
    const hm = trimmed.match(/^(#{1,6})\s+(.+)$/s);
    if (hm) {
      return {
        raw: block,
        trimmed,
        kind: 'heading',
        headingLevel: hm[1].length,
        content: hm[2],
      };
    }
  } else {
    const lm = trimmed.match(/^\\(section|subsection|subsubsection)\{(.+)\}$/s);
    if (lm) {
      const lvl = lm[1] === 'section' ? 1 : lm[1] === 'subsection' ? 2 : 3;
      return {
        raw: block,
        trimmed,
        kind: 'heading',
        headingLevel: lvl,
        content: lm[2],
      };
    }
  }

  return {
    raw: block,
    trimmed,
    kind: 'paragraph',
    content: trimmed,
  };
}

function bigramSimilarity(a: string, b: string): number {
  const s1 = a.trim();
  const s2 = b.trim();
  if (!s1 || !s2) return 0;
  if (s1 === s2) return 1;
  if (s1.length < 2 || s2.length < 2) {
    return s1 === s2 ? 1 : 0;
  }
  const set1 = new Set<string>();
  for (let i = 0; i < s1.length - 1; i++) set1.add(s1.slice(i, i + 2));
  let hits = 0;
  let total2 = 0;
  for (let i = 0; i < s2.length - 1; i++) {
    total2++;
    if (set1.has(s2.slice(i, i + 2))) hits++;
  }
  return (2 * hits) / Math.max(1, set1.size + total2);
}

function alignBlocksToSidecar(
  editedBlocks: ParsedEditBlock[],
  sidecarBlocks: DocxBlockStyleEntry[],
): Array<DocxBlockStyleEntry | undefined> {
  const matches: Array<DocxBlockStyleEntry | undefined> = new Array(editedBlocks.length).fill(
    undefined,
  );
  if (sidecarBlocks.length === 0) return matches;

  const usedSidecar = new Set<number>();
  const matchedSidecarIndex: number[] = new Array(editedBlocks.length).fill(-1);

  // Pass 1: Exact text match in order
  let minSidecarIdx = 0;
  for (let i = 0; i < editedBlocks.length; i++) {
    const eb = editedBlocks[i];
    for (let j = minSidecarIdx; j < sidecarBlocks.length; j++) {
      if (usedSidecar.has(j)) continue;
      const sb = sidecarBlocks[j];
      if (sb.kind !== eb.kind) continue;
      if (
        sb.originalBlockText === eb.trimmed ||
        (sb.kind !== 'table' && sb.plainText === eb.content)
      ) {
        matches[i] = sb;
        matchedSidecarIndex[i] = j;
        usedSidecar.add(j);
        minSidecarIdx = j + 1;
        break;
      }
    }
  }

  // Pass 2: Similarity match between anchor bounds
  for (let i = 0; i < editedBlocks.length; i++) {
    if (matches[i]) continue;
    const eb = editedBlocks[i];
    let prevAnchor = -1;
    for (let k = i - 1; k >= 0; k--) {
      if (matchedSidecarIndex[k] >= 0) {
        prevAnchor = matchedSidecarIndex[k];
        break;
      }
    }
    let nextAnchor = sidecarBlocks.length;
    for (let k = i + 1; k < editedBlocks.length; k++) {
      if (matchedSidecarIndex[k] >= 0) {
        nextAnchor = matchedSidecarIndex[k];
        break;
      }
    }

    let bestScore = 0.28;
    let bestJ = -1;
    for (let j = prevAnchor + 1; j < nextAnchor; j++) {
      if (usedSidecar.has(j)) continue;
      const sb = sidecarBlocks[j];
      if (sb.kind !== eb.kind) continue;
      const score = Math.max(
        bigramSimilarity(eb.trimmed, sb.originalBlockText),
        bigramSimilarity(eb.content, sb.plainText),
      );
      if (score > bestScore) {
        bestScore = score;
        bestJ = j;
      }
    }

    if (bestJ >= 0) {
      matches[i] = sidecarBlocks[bestJ];
      matchedSidecarIndex[i] = bestJ;
      usedSidecar.add(bestJ);
    }
  }

  // Pass 3: Positional slot fallback for completely rewritten paragraphs at the same slot
  for (let i = 0; i < editedBlocks.length; i++) {
    if (matches[i]) continue;
    const eb = editedBlocks[i];
    let prevAnchor = -1;
    for (let k = i - 1; k >= 0; k--) {
      if (matchedSidecarIndex[k] >= 0) {
        prevAnchor = matchedSidecarIndex[k];
        break;
      }
    }
    let nextAnchor = sidecarBlocks.length;
    for (let k = i + 1; k < editedBlocks.length; k++) {
      if (matchedSidecarIndex[k] >= 0) {
        nextAnchor = matchedSidecarIndex[k];
        break;
      }
    }
    for (let j = prevAnchor + 1; j < nextAnchor; j++) {
      if (!usedSidecar.has(j) && sidecarBlocks[j].kind === eb.kind) {
        matches[i] = sidecarBlocks[j];
        matchedSidecarIndex[i] = j;
        usedSidecar.add(j);
        break;
      }
    }
  }

  return matches;
}

/**
 * Updates an original Word `<w:tbl>` XML with edited Markdown table cell contents
 * while preserving original `<w:tblPr>`, `<w:tblGrid>`, `<w:trPr>`, `<w:tcPr>` (borders/shading/widths),
 * and cell paragraph/run formatting.
 */
function patchOriginalTableXml(
  rawTableXml: string,
  editedRows: string[][],
  format: EditorFormat,
  citationMap: Map<string, CitationSidecarEntry>,
): string | null {
  try {
    const parser = new DOMParser();
    const serializer = new XMLSerializer();
    const doc = parser.parseFromString(rawTableXml, 'application/xml');
    const tblEl = doc.documentElement;
    if (!tblEl || localName(tblEl) !== 'tbl') return null;

    const origTrs = childElements(tblEl).filter((c) => localName(c) === 'tr');
    if (origTrs.length === 0) return null;

    const fallbackTr = origTrs[origTrs.length - 1];
    // Remove extra trailing rows if rows were deleted
    for (let r = editedRows.length; r < origTrs.length; r++) {
      tblEl.removeChild(origTrs[r]);
    }

    for (let r = 0; r < editedRows.length; r++) {
      const targetCells = editedRows[r];
      let trEl = origTrs[r];
      if (!trEl) {
        trEl = fallbackTr.cloneNode(true) as XmlElement;
        tblEl.appendChild(trEl);
      }

      const origTcs = childElements(trEl).filter((c) => localName(c) === 'tc');
      if (origTcs.length === 0) continue;
      const fallbackTc = origTcs[origTcs.length - 1];

      for (let c = 0; c < targetCells.length; c++) {
        const cellText = targetCells[c] ?? '';
        let tcEl = origTcs[c];
        if (!tcEl) {
          tcEl = fallbackTc.cloneNode(true) as XmlElement;
          trEl.appendChild(tcEl);
        }

        const pEls = childElements(tcEl).filter((ch) => localName(ch) === 'p');
        const firstP = pEls[0];
        let pPrXml = '';
        let firstRPrXml: string | undefined;
        if (firstP) {
          const pPr = childElements(firstP).find((ch) => localName(ch) === 'pPr');
          if (pPr) pPrXml = serializer.serializeToString(pPr);
          const firstR = childElements(firstP).find((ch) => localName(ch) === 'r');
          const rPr = firstR
            ? childElements(firstR).find((ch) => localName(ch) === 'rPr')
            : undefined;
          if (rPr) firstRPrXml = serializer.serializeToString(rPr);
        }

        // Replace cell paragraphs with a single styled paragraph carrying original pPr/rPr
        for (const oldP of pEls) {
          tcEl.removeChild(oldP);
        }

        const newRunsXml = renderStyledInlineToOoxml(
          cellText,
          format,
          citationMap,
          [],
          firstRPrXml,
        );
        const newPDoc = parser.parseFromString(
          `<w:p xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${pPrXml}${newRunsXml}</w:p>`,
          'application/xml',
        );
        if (newPDoc.documentElement) {
          const importedP = doc.importNode
            ? doc.importNode(newPDoc.documentElement, true)
            : newPDoc.documentElement;
          if (importedP) tcEl.appendChild(importedP);
        }
      }
    }

    return serializer.serializeToString(tblEl);
  } catch {
    return null;
  }
}

function buildBlockXml(params: {
  block: ParsedEditBlock;
  matched?: DocxBlockStyleEntry;
  styleSidecar?: DocxStyleSidecar;
  format: EditorFormat;
  citationMap: Map<string, CitationSidecarEntry>;
  mode: 'clean' | 'redline';
  redlineBaseline?: string;
  author: string;
}): string {
  const {
    block,
    matched,
    styleSidecar,
    format,
    citationMap,
    mode,
    redlineBaseline,
    author,
  } = params;

  // 1. Display math block
  if (block.kind === 'math-block') {
    if (mode === 'clean' && matched && matched.originalBlockText === block.trimmed) {
      return matched.rawXml;
    }
    const pPr = matched?.pPrXml ?? '';
    return `<w:p>${pPr}${latexToOmmlXml(block.content, true)}</w:p>`;
  }

  // 2. Table block
  if (block.kind === 'table' && block.tableRows && block.tableRows.length > 0) {
    if (matched?.kind === 'table') {
      if (mode === 'clean' && matched.originalBlockText === block.trimmed) {
        return matched.rawXml;
      }
      const patched = patchOriginalTableXml(
        matched.rawXml,
        block.tableRows,
        format,
        citationMap,
      );
      if (patched) return patched;
    }

    const trs = block.tableRows
      .map(
        (row) =>
          `<w:tr>${row
            .map(
              (cell) =>
                `<w:tc><w:tcPr><w:tcBorders><w:top w:val="single" w:sz="4"/><w:bottom w:val="single" w:sz="4"/><w:left w:val="single" w:sz="4"/><w:right w:val="single" w:sz="4"/></w:tcBorders></w:tcPr><w:p>${renderStyledInlineToOoxml(cell, format, citationMap, [])}</w:p></w:tc>`,
            )
            .join('')}</w:tr>`,
      )
      .join('');
    return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/></w:tblPr>${trs}</w:tbl>`;
  }

  // 3. Verbatim lossless return for unmodified clean paragraphs/headings without review markup
  if (
    mode === 'clean' &&
    matched &&
    !matched.hasReviewMarkup &&
    matched.kind === block.kind &&
    matched.originalBlockText === block.trimmed
  ) {
    return matched.rawXml;
  }

  // 4. Resolve paragraph properties (<w:pPr>) & dominant run properties (<w:rPr>)
  let pPr = '';
  let defaultRPr: string | undefined;

  if (block.kind === 'heading' && block.headingLevel) {
    if (matched?.kind === 'heading' && matched.headingLevel === block.headingLevel) {
      pPr = matched.pPrXml ?? `<w:pPr><w:pStyle w:val="Heading${block.headingLevel}"/></w:pPr>`;
      defaultRPr = matched.dominantRPrXml;
    } else {
      const tpl = styleSidecar?.headingTemplates[block.headingLevel];
      pPr = tpl?.pPrXml ?? `<w:pPr><w:pStyle w:val="Heading${block.headingLevel}"/></w:pPr>`;
      defaultRPr = tpl?.rPrXml ?? matched?.dominantRPrXml;
    }
  } else {
    if (matched?.kind === 'paragraph') {
      pPr = matched.pPrXml ?? '';
      defaultRPr = matched.dominantRPrXml;
    } else if (styleSidecar?.bodyTemplate) {
      pPr = styleSidecar.bodyTemplate.pPrXml ?? '';
      defaultRPr = styleSidecar.bodyTemplate.rPrXml;
    }
  }

  const originalRuns = matched?.runs ?? [];

  // 5. Redline Track Changes Mode (<w:ins> / <w:del> with inherited <w:rPr>)
  if (mode === 'redline' && redlineBaseline !== undefined && redlineBaseline !== block.trimmed) {
    const cleanBase = redlineBaseline
      .replace(/^(#{1,6})\s+/, '')
      .replace(/^\\(?:section|subsection|subsubsection)\{(.+)\}$/s, '$1')
      .trim();
    const hasCjk = /[\u4e00-\u9fff]/.test(cleanBase + block.content);
    const parts = hasCjk
      ? diffChars(cleanBase, block.content)
      : diffWordsWithSpace(cleanBase, block.content);
    const nowIso = new Date().toISOString();
    let revId = 100;
    const revRuns = parts
      .map((p) => {
        if (p.added) {
          return `<w:ins w:id="${revId++}" w:author="${escapeXml(author)}" w:date="${nowIso}">${makeRunXml(p.value, defaultRPr)}</w:ins>`;
        }
        if (p.removed) {
          const rPr = defaultRPr || '';
          return `<w:del w:id="${revId++}" w:author="${escapeXml(author)}" w:date="${nowIso}"><w:r>${rPr}<w:delText xml:space="preserve">${escapeXml(p.value)}</w:delText></w:r></w:del>`;
        }
        return renderStyledInlineToOoxml(
          p.value,
          format,
          citationMap,
          originalRuns,
          defaultRPr,
        );
      })
      .join('');
    return `<w:p>${pPr}${revRuns}</w:p>`;
  }

  // 6. Clean reconstructed paragraph with character-level run style inheritance
  const runsXml = renderStyledInlineToOoxml(
    block.content,
    format,
    citationMap,
    originalRuns,
    defaultRPr,
  );
  return `<w:p>${pPr}${runsXml}</w:p>`;
}

async function createMinimalDocxZip(title: string): Promise<JSZip> {
  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/contenttypes">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );
  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
  );
  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/></w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>
</w:styles>`,
  );
  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body><w:p><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p><w:sectPr/></w:body>
</w:document>`,
  );
  return zip;
}

function extractDocumentRootTag(origDocXml?: string): string {
  const defaultTag =
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">';
  if (!origDocXml) return defaultTag;
  const m = origDocXml.match(/<w:document\b[^>]*>/);
  if (!m) return defaultTag;
  let tag = m[0];
  if (!tag.includes('xmlns:w=')) {
    tag = tag.replace(
      '>',
      ' xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
    );
  }
  if (!tag.includes('xmlns:m=')) {
    tag = tag.replace(
      '>',
      ' xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math">',
    );
  }
  if (!tag.includes('xmlns:r=')) {
    tag = tag.replace(
      '>',
      ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
    );
  }
  return tag;
}

/**
 * Exports edited Markdown/LaTeX back into a real .docx binary:
 * - Preserves original styles.xml, media, headers/footers, root namespaces, and untouched cover XML
 * - Losslessly restores custom/modified paragraph styles (<w:pPr>), run fonts/bold/colors (<w:rPr>), and tables
 * - Restores Zotero/EndNote raw field XML from sidecar
 * - Supports 'redline' mode generating native Word Track Changes (<w:ins>/<w:del>)
 */
export async function exportToDocx(params: ExportDocxParams): Promise<Uint8Array> {
  const {
    baseDocxBase64,
    coverXmlNodes,
    bodyText,
    format,
    citationsSidecar,
    styleSidecar,
    mode,
    baselineText,
    author = 'ArcVault Author',
    title = 'ArcVault Document',
  } = params;

  const zip = baseDocxBase64
    ? await JSZip.loadAsync(base64ToUint8(baseDocxBase64))
    : await createMinimalDocxZip(title);

  const origDocXml = await zip.file('word/document.xml')?.async('string');
  const sectPrMatch = origDocXml?.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/);
  const sectPrXml = sectPrMatch ? sectPrMatch[0] : '<w:sectPr/>';
  const docOpenTag = extractDocumentRootTag(origDocXml);

  const citationMap = new Map<string, CitationSidecarEntry>();
  for (const c of citationsSidecar) {
    citationMap.set(c.placeholder, c);
  }

  const rawBlocks = normalizeBodyLines(bodyText);
  const parsedBlocks: ParsedEditBlock[] = [];
  for (const raw of rawBlocks) {
    const pb = classifyEditedBlock(raw, format);
    if (pb) parsedBlocks.push(pb);
  }

  const alignedSidecar = styleSidecar
    ? alignBlocksToSidecar(parsedBlocks, styleSidecar.blocks)
    : [];

  const baseBlocks =
    mode === 'redline' && baselineText !== undefined
      ? normalizeBodyLines(baselineText)
      : [];

  const bodyXmlParts: string[] = [];

  // Re-attach exact stripped cover blocks first
  if (coverXmlNodes.length > 0) {
    bodyXmlParts.push(...coverXmlNodes);
    const hasBreakAlready = coverXmlNodes.some(
      (x) => x.includes('w:type="page"') || x.includes('w:sectPr'),
    );
    if (!hasBreakAlready) {
      bodyXmlParts.push('<w:p><w:r><w:br w:type="page"/></w:r></w:p>');
    }
  }

  parsedBlocks.forEach((blk, idx) => {
    const matched = alignedSidecar[idx];
    const baseBlk = mode === 'redline' ? (baseBlocks[idx] ?? '') : undefined;
    const xml = buildBlockXml({
      block: blk,
      matched,
      styleSidecar,
      format,
      citationMap,
      mode,
      redlineBaseline: baseBlk,
      author,
    });
    if (xml) bodyXmlParts.push(xml);
  });

  const newDocXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
${docOpenTag}
  <w:body>
    ${bodyXmlParts.join('\n    ')}
    ${sectPrXml}
  </w:body>
</w:document>`;

  zip.file('word/document.xml', newDocXml);
  return zip.generateAsync({ type: 'uint8array' });
}
