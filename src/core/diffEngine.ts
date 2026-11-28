import { diffArrays, diffChars, diffLines, diffWordsWithSpace } from 'diff';
import type { DeletedDarling } from '../types/archive';

export interface DiffHunk {
  id: string;
  type: 'added' | 'removed' | 'unchanged';
  value: string;
  lineCount: number;
}

export interface DiffReport {
  hunks: DiffHunk[];
  addedChars: number;
  removedChars: number;
  changedBlocks: number;
  summary: string;
}

export interface DiffLineToken {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export interface DiffLine {
  index: number;
  tokens: DiffLineToken[];
  hasAdded: boolean;
  hasRemoved: boolean;
  chapterId?: string;
  chapterLevel?: number;
}

interface InternalDiffLine extends DiffLine {
  carriedPrefixOnly?: boolean;
}

export type DiffHeadingStatus = 'unchanged' | 'modified' | 'added' | 'removed';

export interface DiffChapter {
  id: string;
  title: string;
  level: number;
  lineIndex: number;
  endLineIndex: number;
  addedChars: number;
  removedChars: number;
  changedCount: number;
  hasChanges: boolean;
  headingStatus: DiffHeadingStatus;
  isPreamble?: boolean;
}

export interface DiffSectionBlock {
  chapter: DiffChapter;
  lines: DiffLine[];
}

export interface StructuredDiffView {
  lines: DiffLine[];
  chapters: DiffChapter[];
  sections: DiffSectionBlock[];
}

type DiffOp = -1 | 0 | 1;
type RawDiff = [DiffOp, string];

const MAX_CHAR_DIFF_PRODUCT = 2_500_000;
const MAX_SEGMENT_CHAR_DIFF_PRODUCT = 500_000;
const MAX_CLEANUP_PASSES = 64;

function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) {
    i++;
  }
  return i;
}

function commonSuffixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)) {
    i++;
  }
  return i;
}

function commonOverlapLength(a: string, b: string): number {
  const aLen = a.length;
  const bLen = b.length;
  if (aLen === 0 || bLen === 0) return 0;
  let text1 = a;
  let text2 = b;
  if (aLen > bLen) {
    text1 = a.slice(aLen - bLen);
  } else if (aLen < bLen) {
    text2 = b.slice(0, aLen);
  }
  const len = Math.min(aLen, bLen);
  if (text1 === text2) return len;

  let best = 0;
  let length = 1;
  while (true) {
    const pattern = text1.slice(len - length);
    const found = text2.indexOf(pattern);
    if (found === -1) return best;
    length += found;
    if (found === 0 || text1.slice(len - length) === text2.slice(0, length)) {
      best = length;
      length++;
    }
  }
}

function runDiffCharsChunk(a: string, b: string): RawDiff[] {
  if (a === b) return a ? [[0, a]] : [];
  if (!a) return [[1, b]];
  if (!b) return [[-1, a]];

  const prefixLen = commonPrefixLength(a, b);
  const prefix = prefixLen > 0 ? a.slice(0, prefixLen) : '';
  let remA = a.slice(prefixLen);
  let remB = b.slice(prefixLen);

  const suffixLen = commonSuffixLength(remA, remB);
  const suffix = suffixLen > 0 ? remA.slice(remA.length - suffixLen) : '';
  if (suffixLen > 0) {
    remA = remA.slice(0, remA.length - suffixLen);
    remB = remB.slice(0, remB.length - suffixLen);
  }

  const out: RawDiff[] = [];
  if (prefix) out.push([0, prefix]);

  if (!remA && !remB) {
    // nothing between prefix and suffix
  } else if (!remA) {
    out.push([1, remB]);
  } else if (!remB) {
    out.push([-1, remA]);
  } else if (remA.length * remB.length <= MAX_CHAR_DIFF_PRODUCT) {
    for (const part of diffChars(remA, remB)) {
      if (!part.value) continue;
      out.push([part.added ? 1 : part.removed ? -1 : 0, part.value]);
    }
  } else {
    // Fallback for huge dissimilar blocks: clause/sentence segmentation + char diff on smaller pairs
    const segA = remA.split(/(?<=[。！？；.!?;，,\n])/).filter(Boolean);
    const segB = remB.split(/(?<=[。！？；.!?;，,\n])/).filter(Boolean);
    const arrParts = diffArrays(segA, segB);
    let pendingDel = '';
    let pendingIns = '';
    const flushPending = () => {
      if (pendingDel && pendingIns) {
        if (pendingDel.length * pendingIns.length <= MAX_SEGMENT_CHAR_DIFF_PRODUCT) {
          for (const cp of diffChars(pendingDel, pendingIns)) {
            if (!cp.value) continue;
            out.push([cp.added ? 1 : cp.removed ? -1 : 0, cp.value]);
          }
        } else {
          out.push([-1, pendingDel], [1, pendingIns]);
        }
      } else if (pendingDel) {
        out.push([-1, pendingDel]);
      } else if (pendingIns) {
        out.push([1, pendingIns]);
      }
      pendingDel = '';
      pendingIns = '';
    };

    for (const part of arrParts) {
      const joined = part.value.join('');
      if (!joined) continue;
      if (part.removed) {
        pendingDel += joined;
      } else if (part.added) {
        pendingIns += joined;
      } else {
        flushPending();
        out.push([0, joined]);
      }
    }
    flushPending();
  }

  if (suffix) out.push([0, suffix]);
  return out;
}

/**
 * Merges adjacent same-op hunks, extracts common prefixes/suffixes across adjacent
 * delete+insert pairs, and shifts single edits across equalities when redundant.
 */
function diffCleanupMerge(diffs: RawDiff[]): void {
  for (let pass = 0; pass < MAX_CLEANUP_PASSES; pass++) {
    diffs.push([0, '']);
    let pointer = 0;
    let countDelete = 0;
    let countInsert = 0;
    let textDelete = '';
    let textInsert = '';

    while (pointer < diffs.length) {
      switch (diffs[pointer][0]) {
        case 1:
          countInsert++;
          textInsert += diffs[pointer][1];
          pointer++;
          break;
        case -1:
          countDelete++;
          textDelete += diffs[pointer][1];
          pointer++;
          break;
        case 0:
          if (countDelete + countInsert > 1) {
            if (countDelete !== 0 && countInsert !== 0) {
              const prefixLen = commonPrefixLength(textInsert, textDelete);
              if (prefixLen !== 0) {
                const prefix = textInsert.slice(0, prefixLen);
                if (pointer - countDelete - countInsert > 0 && diffs[pointer - countDelete - countInsert - 1][0] === 0) {
                  diffs[pointer - countDelete - countInsert - 1][1] += prefix;
                } else {
                  diffs.splice(0, 0, [0, prefix]);
                  pointer++;
                }
                textInsert = textInsert.slice(prefixLen);
                textDelete = textDelete.slice(prefixLen);
              }
              const suffixLen = commonSuffixLength(textInsert, textDelete);
              if (suffixLen !== 0) {
                diffs[pointer][1] = textInsert.slice(textInsert.length - suffixLen) + diffs[pointer][1];
                textInsert = textInsert.slice(0, textInsert.length - suffixLen);
                textDelete = textDelete.slice(0, textDelete.length - suffixLen);
              }
            }
            pointer -= countDelete + countInsert;
            diffs.splice(pointer, countDelete + countInsert);
            if (textDelete.length) {
              diffs.splice(pointer, 0, [-1, textDelete]);
              pointer++;
            }
            if (textInsert.length) {
              diffs.splice(pointer, 0, [1, textInsert]);
              pointer++;
            }
            pointer++;
          } else if (pointer !== 0 && diffs[pointer - 1][0] === 0) {
            diffs[pointer - 1][1] += diffs[pointer][1];
            diffs.splice(pointer, 1);
          } else {
            pointer++;
          }
          countInsert = 0;
          countDelete = 0;
          textDelete = '';
          textInsert = '';
          break;
      }
    }

    if (diffs[diffs.length - 1][1] === '') {
      diffs.pop();
    }

    let changes = false;
    pointer = 1;
    while (pointer < diffs.length - 1) {
      if (diffs[pointer - 1][0] === 0 && diffs[pointer + 1][0] === 0) {
        const cur = diffs[pointer][1];
        const prev = diffs[pointer - 1][1];
        const next = diffs[pointer + 1][1];
        if (prev && cur.endsWith(prev)) {
          diffs[pointer][1] = prev + cur.slice(0, cur.length - prev.length);
          diffs[pointer + 1][1] = prev + next;
          diffs.splice(pointer - 1, 1);
          changes = true;
          continue;
        } else if (next && cur.startsWith(next)) {
          diffs[pointer - 1][1] = prev + next;
          diffs[pointer][1] = cur.slice(next.length) + next;
          diffs.splice(pointer + 1, 1);
          changes = true;
          continue;
        }
      }
      pointer++;
    }

    if (!changes) break;
  }
}

function semanticScore(one: string, two: string): number {
  if (!one || !two) return 6;
  const char1 = one.charAt(one.length - 1);
  const char2 = two.charAt(0);
  const nonAlphaNum1 = /[^a-zA-Z0-9\u4e00-\u9fff]/.test(char1);
  const nonAlphaNum2 = /[^a-zA-Z0-9\u4e00-\u9fff]/.test(char2);
  const ws1 = /\s/.test(char1);
  const ws2 = /\s/.test(char2);
  const lb1 = char1 === '\r' || char1 === '\n';
  const lb2 = char2 === '\r' || char2 === '\n';
  const blank1 = lb1 && /\n\r?\n$/.test(one);
  const blank2 = lb2 && /^\r?\n\r?\n/.test(two);

  if (blank1 || blank2) return 5;
  if (lb1 || lb2) return 4;
  if (nonAlphaNum1 && !ws1 && ws2) return 3;
  if (ws1 || ws2) return 2;
  if (nonAlphaNum1 || nonAlphaNum2) return 1;
  return 0;
}

/**
 * Shifts single edits surrounded by equalities to natural word/line/sentence boundaries.
 */
function diffCleanupSemanticLossless(diffs: RawDiff[]): void {
  let pointer = 1;
  while (pointer < diffs.length - 1) {
    if (diffs[pointer - 1][0] === 0 && diffs[pointer + 1][0] === 0) {
      let equality1 = diffs[pointer - 1][1];
      let edit = diffs[pointer][1];
      let equality2 = diffs[pointer + 1][1];

      const commonOffset = commonSuffixLength(equality1, edit);
      if (commonOffset) {
        const commonString = edit.slice(edit.length - commonOffset);
        equality1 = equality1.slice(0, equality1.length - commonOffset);
        edit = commonString + edit.slice(0, edit.length - commonOffset);
        equality2 = commonString + equality2;
      }

      let bestEquality1 = equality1;
      let bestEdit = edit;
      let bestEquality2 = equality2;
      let bestScore = semanticScore(equality1, edit) + semanticScore(edit, equality2);

      while (edit.length > 0 && equality2.length > 0 && edit.charAt(0) === equality2.charAt(0)) {
        equality1 += edit.charAt(0);
        edit = edit.slice(1) + equality2.charAt(0);
        equality2 = equality2.slice(1);
        const score = semanticScore(equality1, edit) + semanticScore(edit, equality2);
        if (score >= bestScore) {
          bestScore = score;
          bestEquality1 = equality1;
          bestEdit = edit;
          bestEquality2 = equality2;
        }
      }

      if (diffs[pointer - 1][1] !== bestEquality1) {
        if (bestEquality1) {
          diffs[pointer - 1][1] = bestEquality1;
        } else {
          diffs.splice(pointer - 1, 1);
          pointer--;
        }
        diffs[pointer][1] = bestEdit;
        if (bestEquality2) {
          diffs[pointer + 1][1] = bestEquality2;
        } else {
          diffs.splice(pointer + 1, 1);
          pointer--;
        }
      }
    }
    pointer++;
  }
}

/**
 * Google diff-match-patch semantic cleanup: reduces human-unfriendly fragmented equalities.
 */
function diffCleanupSemantic(diffs: RawDiff[]): void {
  let changes = false;
  const equalities: number[] = [];
  let lastEquality: string | null = null;
  let pointer = 0;
  let lengthInsertions1 = 0;
  let lengthDeletions1 = 0;
  let lengthInsertions2 = 0;
  let lengthDeletions2 = 0;

  while (pointer < diffs.length) {
    if (diffs[pointer][0] === 0) {
      equalities.push(pointer);
      lengthInsertions1 = lengthInsertions2;
      lengthDeletions1 = lengthDeletions2;
      lengthInsertions2 = 0;
      lengthDeletions2 = 0;
      lastEquality = diffs[pointer][1];
    } else {
      if (diffs[pointer][0] === 1) {
        lengthInsertions2 += diffs[pointer][1].length;
      } else {
        lengthDeletions2 += diffs[pointer][1].length;
      }
      if (
        lastEquality !== null &&
        lastEquality.length <= Math.max(lengthInsertions1, lengthDeletions1) &&
        lastEquality.length <= Math.max(lengthInsertions2, lengthDeletions2)
      ) {
        const eqIdx = equalities[equalities.length - 1];
        diffs.splice(eqIdx, 0, [-1, lastEquality]);
        diffs[eqIdx + 1][0] = 1;
        equalities.pop();
        equalities.pop();
        pointer = equalities.length > 0 ? equalities[equalities.length - 1] : -1;
        lengthInsertions1 = 0;
        lengthDeletions1 = 0;
        lengthInsertions2 = 0;
        lengthDeletions2 = 0;
        lastEquality = null;
        changes = true;
      }
    }
    pointer++;
  }

  if (changes) {
    diffCleanupMerge(diffs);
  }
  diffCleanupSemanticLossless(diffs);

  pointer = 1;
  while (pointer < diffs.length) {
    if (diffs[pointer - 1][0] === -1 && diffs[pointer][0] === 1) {
      const deletion = diffs[pointer - 1][1];
      const insertion = diffs[pointer][1];
      const overlapLength1 = commonOverlapLength(deletion, insertion);
      const overlapLength2 = commonOverlapLength(insertion, deletion);
      if (overlapLength1 >= overlapLength2) {
        if (overlapLength1 >= deletion.length / 2 || overlapLength1 >= insertion.length / 2) {
          diffs.splice(pointer, 0, [0, insertion.slice(0, overlapLength1)]);
          diffs[pointer - 1][1] = deletion.slice(0, deletion.length - overlapLength1);
          diffs[pointer + 1][1] = insertion.slice(overlapLength1);
          pointer++;
        }
      } else if (overlapLength2 >= deletion.length / 2 || overlapLength2 >= insertion.length / 2) {
        diffs.splice(pointer, 0, [0, deletion.slice(0, overlapLength2)]);
        diffs[pointer - 1][0] = 1;
        diffs[pointer - 1][1] = insertion.slice(0, insertion.length - overlapLength2);
        diffs[pointer + 1][0] = -1;
        diffs[pointer + 1][1] = deletion.slice(overlapLength2);
        pointer++;
      }
      pointer++;
    }
    pointer++;
  }
}

export function computeDocumentDiff(oldText: string, newText: string): DiffReport {
  if (oldText === newText) {
    const lineCount = oldText ? oldText.split('\n').length : 0;
    return {
      hunks: oldText ? [{ id: 'h_0', type: 'unchanged', value: oldText, lineCount }] : [],
      addedChars: 0,
      removedChars: 0,
      changedBlocks: 0,
      summary: '+0 字 / -0 字（共 0 处差异）',
    };
  }

  const raw: RawDiff[] = [];
  if (!oldText) {
    raw.push([1, newText]);
  } else if (!newText) {
    raw.push([-1, oldText]);
  } else {
    const lineParts = diffLines(oldText, newText);
    let pendingDel = '';
    let pendingIns = '';

    const flushChangedBlock = () => {
      if (pendingDel && pendingIns) {
        raw.push(...runDiffCharsChunk(pendingDel, pendingIns));
      } else if (pendingDel) {
        raw.push([-1, pendingDel]);
      } else if (pendingIns) {
        raw.push([1, pendingIns]);
      }
      pendingDel = '';
      pendingIns = '';
    };

    for (const part of lineParts) {
      if (!part.value) continue;
      if (part.removed) {
        pendingDel += part.value;
      } else if (part.added) {
        pendingIns += part.value;
      } else {
        flushChangedBlock();
        raw.push([0, part.value]);
      }
    }
    flushChangedBlock();

    diffCleanupMerge(raw);
    diffCleanupSemantic(raw);
    diffCleanupMerge(raw);
  }

  const hunks: DiffHunk[] = [];
  let addedChars = 0;
  let removedChars = 0;
  let changedBlocks = 0;
  let inChangeCluster = false;

  for (const [op, value] of raw) {
    if (!value) continue;
    const cleanLen = value.replace(/\s+/g, '').length;
    const lineCount = value.split('\n').length;
    const idx = hunks.length;

    if (op === 1) {
      addedChars += cleanLen;
      if (!inChangeCluster) {
        changedBlocks += 1;
        inChangeCluster = true;
      }
      hunks.push({ id: `h_${idx}`, type: 'added', value, lineCount });
    } else if (op === -1) {
      removedChars += cleanLen;
      if (!inChangeCluster) {
        changedBlocks += 1;
        inChangeCluster = true;
      }
      hunks.push({ id: `h_${idx}`, type: 'removed', value, lineCount });
    } else {
      inChangeCluster = false;
      hunks.push({ id: `h_${idx}`, type: 'unchanged', value, lineCount });
    }
  }

  const summary = `+${addedChars} 字 / -${removedChars} 字（共 ${changedBlocks} 处差异）`;

  return {
    hunks,
    addedChars,
    removedChars,
    changedBlocks,
    summary,
  };
}

export interface InlineTokenDiff {
  type: 'added' | 'removed' | 'unchanged';
  value: string;
}

export function computeInlineDiff(oldText: string, newText: string): InlineTokenDiff[] {
  return diffWordsWithSpace(oldText, newText).map((p) => ({
    type: p.added ? 'added' : p.removed ? 'removed' : 'unchanged',
    value: p.value,
  }));
}

function cleanDiffHeadingTitle(raw: string): string {
  return raw
    .replace(/\[@(?:zotero|endnote):\d{3}\]/g, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\{|\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const STANDALONE_ACADEMIC_HEADING_RE =
  /^(?:(?:\d+(?:\.\d+)*|[IVX]+)\s*[.、]\s*)?(?:摘要|Abstract|引言|Introduction|文献综述|Literature Review|Related Work|研究方法|Methodology|Methods|实验结果|Results|讨论|Discussion|结论|Conclusion|Conclusions|致谢|Acknowledgements?)$/i;

export function parseDiffHeadingLine(rawLine: string): { title: string; level: number } | null {
  const trimmed = rawLine.trim();
  if (!trimmed) return null;

  const mdMatch = /^(#{1,6})\s+(.+?)\s*#*$/.exec(trimmed);
  if (mdMatch) {
    const title = cleanDiffHeadingTitle(mdMatch[2]);
    return title ? { title, level: mdMatch[1].length } : null;
  }

  const texMatch = /^\\(part|chapter|section|subsection|subsubsection)\*?\{([^}]+)\}/.exec(trimmed);
  if (texMatch) {
    const cmd = texMatch[1];
    const level =
      cmd === 'part' || cmd === 'chapter'
        ? 1
        : cmd === 'section'
          ? 2
          : cmd === 'subsection'
            ? 3
            : 4;
    const title = cleanDiffHeadingTitle(texMatch[2]);
    return title ? { title, level } : null;
  }

  if (/^\\begin\{abstract\}/i.test(trimmed)) {
    return { title: 'Abstract', level: 1 };
  }

  const zhMatch = /^第[一二三四五六七八九十百零\d]+([章节篇部])(?:\s+|[:：、.]|$)/.exec(trimmed);
  if (trimmed.length <= 48 && zhMatch) {
    const title = cleanDiffHeadingTitle(trimmed);
    const level = zhMatch[1] === '节' ? 2 : 1;
    return title ? { title, level } : null;
  }

  if (STANDALONE_ACADEMIC_HEADING_RE.test(trimmed)) {
    const title = cleanDiffHeadingTitle(trimmed);
    return title ? { title, level: 1 } : null;
  }

  return null;
}

/**
 * Splits character-level hunks into visual lines and extracts a chapter outline with per-chapter diff stats.
 */
export function buildDiffLinesAndChapters(
  hunks: DiffHunk[],
  preambleTitle = '文首导言',
): StructuredDiffView {
  const lines: InternalDiffLine[] = [];
  let currentTokens: DiffLineToken[] = [];
  let hasAdded = false;
  let hasRemoved = false;
  let currentCarriedPrefixOnly = false;

  const pushToken = (type: DiffLineToken['type'], value: string) => {
    if (!value) return;
    const prev = currentTokens[currentTokens.length - 1];
    if (prev && prev.type === type) {
      prev.value += value;
    } else {
      currentTokens.push({ type, value });
    }
    if (type === 'added') hasAdded = true;
    if (type === 'removed') hasRemoved = true;
  };

  const commitLine = () => {
    lines.push({
      index: lines.length,
      tokens: currentTokens,
      hasAdded,
      hasRemoved,
      carriedPrefixOnly: currentCarriedPrefixOnly,
    });
    currentTokens = [];
    hasAdded = false;
    hasRemoved = false;
    currentCarriedPrefixOnly = false;
  };

  const appendText = (type: DiffLineToken['type'], rawValue: string) => {
    const normalized = rawValue.replace(/\r\n/g, '\n');
    const parts = normalized.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (parts[i]) {
        pushToken(type, parts[i]);
      }
      if (i < parts.length - 1) {
        commitLine();
      }
    }
  };

  for (let hIdx = 0; hIdx < hunks.length; hIdx++) {
    const hunk = hunks[hIdx];
    if (!hunk.value) continue;

    // When a multi-line removed block is immediately followed by an added block,
    // separate the removed lines from the added lines while carrying any shared
    // line prefix (such as "# ") onto the first added line so headings stay intact.
    if (hunk.type === 'removed') {
      let delEnd = hIdx + 1;
      while (delEnd < hunks.length && hunks[delEnd].type === 'removed') {
        delEnd++;
      }
      let addEnd = delEnd;
      while (addEnd < hunks.length && hunks[addEnd].type === 'added') {
        addEnd++;
      }

      const removedValue = hunks
        .slice(hIdx, delEnd)
        .map((h) => h.value)
        .join('');
      const hasMultiLineRemoved =
        removedValue.includes('\n') || removedValue.includes('\r');

      if (addEnd > delEnd && hasMultiLineRemoved) {
        const prefixTokens = currentTokens.map((t) => ({ ...t }));
        appendText('removed', removedValue);
        if (currentTokens.length > 0) {
          commitLine();
        }
        if (prefixTokens.length > 0) {
          for (const pt of prefixTokens) {
            pushToken(pt.type, pt.value);
          }
          currentCarriedPrefixOnly = true;
        }
        const addedValue = hunks
          .slice(delEnd, addEnd)
          .map((h) => h.value)
          .join('');
        appendText('added', addedValue);
        hIdx = addEnd - 1;
        continue;
      }
    }

    appendText(hunk.type, hunk.value);
  }
  if (currentTokens.length > 0 || lines.length === 0) {
    commitLine();
  }

  const rawChapters: Array<{
    id: string;
    title: string;
    level: number;
    lineIndex: number;
    headingStatus: DiffHeadingStatus;
  }> = [];

  let inCodeFence = false;
  for (const line of lines) {
    let oldLineText = '';
    let newLineText = '';
    for (const tok of line.tokens) {
      if (tok.type !== 'added') oldLineText += tok.value;
      if (tok.type !== 'removed') newLineText += tok.value;
    }

    const fenceCheck = newLineText.trim() || oldLineText.trim();
    if (/^```/.test(fenceCheck)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    const newHeading = parseDiffHeadingLine(newLineText);
    if (newHeading) {
      const headingStatus: DiffHeadingStatus =
        ((oldLineText.trim().length === 0 || line.carriedPrefixOnly) && line.hasAdded)
          ? 'added'
          : line.hasAdded || line.hasRemoved
            ? 'modified'
            : 'unchanged';
      const id = `diff_ch_${rawChapters.length}_${line.index}`;
      rawChapters.push({
        id,
        title: newHeading.title,
        level: newHeading.level,
        lineIndex: line.index,
        headingStatus,
      });
      line.chapterId = id;
      line.chapterLevel = newHeading.level;
      continue;
    }

    const oldHeading = parseDiffHeadingLine(oldLineText);
    if (oldHeading) {
      const headingStatus: DiffHeadingStatus =
        newLineText.trim().length === 0 || (line.hasRemoved && !line.hasAdded && !parseDiffHeadingLine(newLineText))
          ? 'removed'
          : 'modified';
      const id = `diff_ch_${rawChapters.length}_${line.index}`;
      rawChapters.push({
        id,
        title: oldHeading.title,
        level: oldHeading.level,
        lineIndex: line.index,
        headingStatus,
      });
      line.chapterId = id;
      line.chapterLevel = oldHeading.level;
    }
  }

  if (rawChapters.length === 0) {
    return { lines, chapters: [], sections: [] };
  }

  const chapters: DiffChapter[] = [];
  const firstHeadingLine = rawChapters[0].lineIndex;
  if (firstHeadingLine > 0) {
    const hasPreambleContent = lines
      .slice(0, firstHeadingLine)
      .some((ln) => ln.tokens.some((tok) => tok.value.trim().length > 0));
    if (hasPreambleContent) {
      chapters.push({
        id: 'diff_ch_preamble',
        title: preambleTitle,
        level: 1,
        lineIndex: 0,
        endLineIndex: firstHeadingLine,
        addedChars: 0,
        removedChars: 0,
        changedCount: 0,
        hasChanges: false,
        headingStatus: 'unchanged',
        isPreamble: true,
      });
    }
  }

  for (let i = 0; i < rawChapters.length; i++) {
    const cur = rawChapters[i];
    const endLineIndex = i + 1 < rawChapters.length ? rawChapters[i + 1].lineIndex : lines.length;
    chapters.push({
      id: cur.id,
      title: cur.title,
      level: cur.level,
      lineIndex: cur.lineIndex,
      endLineIndex,
      addedChars: 0,
      removedChars: 0,
      changedCount: 0,
      hasChanges: false,
      headingStatus: cur.headingStatus,
    });
  }

  const sections: DiffSectionBlock[] = chapters.map((ch) => {
    const slice = lines.slice(ch.lineIndex, ch.endLineIndex);
    let added = 0;
    let removed = 0;
    let changedCount = 0;

    for (const ln of slice) {
      let lineChanged = false;
      for (const tok of ln.tokens) {
        const cleanLen = tok.value.replace(/\s+/g, '').length;
        if (tok.type === 'added') {
          added += cleanLen;
          lineChanged = true;
        } else if (tok.type === 'removed') {
          removed += cleanLen;
          lineChanged = true;
        }
      }
      if (lineChanged) changedCount += 1;
    }

    ch.addedChars = added;
    ch.removedChars = removed;
    ch.changedCount = changedCount;
    ch.hasChanges = added > 0 || removed > 0 || ch.headingStatus !== 'unchanged';

    return { chapter: ch, lines: slice };
  });

  return { lines, chapters, sections };
}

/**
 * Automatically captures removed segments >= minChars (default 50) as "Deleted Darlings" (废稿墓地).
 */
export function extractDeletedDarlings(params: {
  oldText: string;
  newText: string;
  documentId: string;
  snapshotId: string;
  minChars?: number;
}): DeletedDarling[] {
  const { oldText, newText, documentId, snapshotId, minChars = 50 } = params;
  const diff = computeDocumentDiff(oldText, newText);
  const results: DeletedDarling[] = [];
  const now = new Date().toISOString();

  diff.hunks.forEach((part, idx) => {
    if (part.type !== 'removed') return;
    const trimmed = part.value.trim();
    const charCount = trimmed.replace(/\s+/g, '').length;
    if (charCount >= minChars) {
      results.push({
        id: `darling_${Date.now()}_${idx}`,
        documentId,
        snapshotId,
        deletedAt: now,
        text: trimmed,
        charCount,
        tags: ['废稿回收'],
      });
    }
  });

  return results;
}
