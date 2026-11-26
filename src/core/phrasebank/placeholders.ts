import { PlaceholderValues } from './types';

export const DEFAULT_PLACEHOLDERS: PlaceholderValues = {
  X: '',
  Y: '',
  Z: '',
  Author: '',
  Year: '',
  Author2: '',
  Year2: '',
};

export interface TextSegment {
  text: string;
  replaced: boolean;
}

function pluralizeTerm(term: string): string {
  const trimmed = term.trim();
  if (!trimmed) return term;
  if (/(?:s|x|z|ch|sh)$/i.test(trimmed)) return trimmed;
  return `${trimmed}s`;
}

/**
 * Safely substitutes placeholder tokens (X, Y, Z, Xs, Ys, Smith, Jones, citation years)
 * using strict word boundaries so regular words like `examine`, `explain`, `matrix`,
 * `analysis`, `next`, `prefix` are NEVER modified.
 */
export function tokenizeWithHighlights(
  text: string,
  values: PlaceholderValues,
  enabled: boolean
): TextSegment[] {
  if (!enabled || !text) {
    return [{ text, replaced: false }];
  }

  const xVal = values.X.trim();
  const yVal = values.Y.trim();
  const zVal = values.Z.trim();
  const a1Val = values.Author.trim();
  const y1Val = values.Year.trim();
  const a2Val = values.Author2.trim();
  const y2Val = values.Year2.trim();

  if (!xVal && !yVal && !zVal && !a1Val && !y1Val && !a2Val && !y2Val) {
    return [{ text, replaced: false }];
  }

  // First handle paired Author + Year citations if Year/Year2 is specified,
  // using sentinel tokens so we can track replaced segments cleanly.
  // Actually, a single pass scanner over regex tokens is deterministic and clean!

  // Build alternation of exact boundary-matched tokens
  // Order matters: longer matches first (e.g. "Smith (2020)" / "Jones (2019)" / "Xs" before "X")
  const tokenPattern =
    /(\bSmith(?:'s)?\s*\(\d{4}[a-z]?(?::\s*\d+)?\)|\bJones(?:'s)?\s*\(\d{4}[a-z]?(?::\s*\d+)?\)|\bSmith(?:'s)?\b|\bJones(?:'s)?\b|\bXs\b|\bYs\b|\bX\b|\bY\b|\bZ\b)/g;

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = tokenPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        text: text.slice(lastIndex, match.index),
        replaced: false,
      });
    }

    const raw = match[0];

    // Check Smith (YYYY...)
    if (raw.startsWith('Smith')) {
      const parenMatch = raw.match(/^(Smith(?:'s)?)\s*\((\d{4}[a-z]?)((?::\s*\d+)?)\)$/);
      if (parenMatch) {
        const prefix = parenMatch[1];
        const hasPossessive = prefix.endsWith("'s");
        const authorOut = a1Val
          ? hasPossessive
            ? `${a1Val}'s`
            : a1Val
          : prefix;
        const yearOut = y1Val || parenMatch[2];
        const pagePart = parenMatch[3] || '';
        const authorReplaced = Boolean(a1Val);
        const yearReplaced = Boolean(y1Val);

        segments.push({ text: authorOut, replaced: authorReplaced });
        segments.push({ text: ' (', replaced: false });
        segments.push({ text: yearOut, replaced: yearReplaced });
        if (pagePart) {
          segments.push({ text: pagePart, replaced: false });
        }
        segments.push({ text: ')', replaced: false });
      } else {
        const hasPossessive = raw.endsWith("'s");
        if (a1Val) {
          segments.push({
            text: hasPossessive ? `${a1Val}'s` : a1Val,
            replaced: true,
          });
        } else {
          segments.push({ text: raw, replaced: false });
        }
      }
    } else if (raw.startsWith('Jones')) {
      const parenMatch = raw.match(/^(Jones(?:'s)?)\s*\((\d{4}[a-z]?)((?::\s*\d+)?)\)$/);
      if (parenMatch) {
        const prefix = parenMatch[1];
        const hasPossessive = prefix.endsWith("'s");
        const authorOut = a2Val
          ? hasPossessive
            ? `${a2Val}'s`
            : a2Val
          : prefix;
        const yearOut = y2Val || y1Val || parenMatch[2];
        const pagePart = parenMatch[3] || '';
        const authorReplaced = Boolean(a2Val);
        const yearReplaced = Boolean(y2Val || y1Val);

        segments.push({ text: authorOut, replaced: authorReplaced });
        segments.push({ text: ' (', replaced: false });
        segments.push({ text: yearOut, replaced: yearReplaced });
        if (pagePart) {
          segments.push({ text: pagePart, replaced: false });
        }
        segments.push({ text: ')', replaced: false });
      } else {
        const hasPossessive = raw.endsWith("'s");
        if (a2Val) {
          segments.push({
            text: hasPossessive ? `${a2Val}'s` : a2Val,
            replaced: true,
          });
        } else {
          segments.push({ text: raw, replaced: false });
        }
      }
    } else if (raw === 'Xs') {
      if (xVal) {
        segments.push({ text: pluralizeTerm(xVal), replaced: true });
      } else {
        segments.push({ text: raw, replaced: false });
      }
    } else if (raw === 'Ys') {
      if (yVal) {
        segments.push({ text: pluralizeTerm(yVal), replaced: true });
      } else {
        segments.push({ text: raw, replaced: false });
      }
    } else if (raw === 'X') {
      if (xVal) {
        segments.push({ text: xVal, replaced: true });
      } else {
        segments.push({ text: raw, replaced: false });
      }
    } else if (raw === 'Y') {
      if (yVal) {
        segments.push({ text: yVal, replaced: true });
      } else {
        segments.push({ text: raw, replaced: false });
      }
    } else if (raw === 'Z') {
      if (zVal) {
        segments.push({ text: zVal, replaced: true });
      } else {
        segments.push({ text: raw, replaced: false });
      }
    }

    lastIndex = tokenPattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({
      text: text.slice(lastIndex),
      replaced: false,
    });
  }

  // Merge adjacent segments with same replaced status
  const merged: TextSegment[] = [];
  for (const seg of segments) {
    if (!seg.text) continue;
    const prev = merged[merged.length - 1];
    if (prev && prev.replaced === seg.replaced) {
      prev.text += seg.text;
    } else {
      merged.push({ ...seg });
    }
  }

  return merged.length > 0 ? merged : [{ text, replaced: false }];
}

export function applyPlaceholders(
  text: string,
  values: PlaceholderValues,
  enabled: boolean
): string {
  return tokenizeWithHighlights(text, values, enabled)
    .map((s) => s.text)
    .join('');
}

export function hasAnyPlaceholderValue(values: PlaceholderValues): boolean {
  return Object.values(values).some((v) => v.trim().length > 0);
}
