import { BuilderColumn } from './types';

const VOWEL_SOUND_EXCEPTIONS_AN = /^(?:honest|honor|honour|hour|heir|herb)/i;
const CONSONANT_SOUND_EXCEPTIONS_A = /^(?:use[rds]?|unit|unique|univers|useful|usual|utensil|one|once|europ|ewe)/i;

function chooseIndefiniteArticle(nextWord: string, uppercase: boolean): string {
  const clean = nextWord.replace(/^[^a-zA-Z0-9]+/, '');
  if (!clean) return uppercase ? 'A' : 'a';

  let useAn = false;
  if (VOWEL_SOUND_EXCEPTIONS_AN.test(clean)) {
    useAn = true;
  } else if (CONSONANT_SOUND_EXCEPTIONS_A.test(clean)) {
    useAn = false;
  } else if (/^[aeiou]/i.test(clean)) {
    useAn = true;
  }

  if (uppercase) {
    return useAn ? 'An' : 'A';
  }
  return useAn ? 'an' : 'a';
}

/**
 * Assembles selected options from a multi-column substitution builder into a clean
 * English sentence, automatically resolving `a(n)` / `a/an` agreement and spacing.
 */
export function assembleBuilder(
  columns: BuilderColumn[],
  selectedIndices: number[]
): string {
  const parts: string[] = [];

  columns.forEach((col, colIdx) => {
    const chosenIdx = selectedIndices[colIdx] ?? 0;
    const raw = col.options[chosenIdx] ?? '';
    const trimmed = raw.trim();
    if (trimmed && trimmed !== '(omit)' && trimmed !== '（省略）') {
      parts.push(trimmed);
    }
  });

  if (parts.length === 0) return '';

  let sentence = parts.join(' ');

  // Normalize multiple spaces
  sentence = sentence.replace(/\s+/g, ' ').trim();

  // Resolve a(n) or a/an before next word
  sentence = sentence.replace(/\b(A|a)\(n\)\s+([a-zA-Z0-9'-]+)/g, (_, art, next) => {
    return `${chooseIndefiniteArticle(next, art === 'A')} ${next}`;
  });
  sentence = sentence.replace(/\b(A|a)\/an\s+([a-zA-Z0-9'-]+)/g, (_, art, next) => {
    return `${chooseIndefiniteArticle(next, art === 'A')} ${next}`;
  });

  // Clean up spaces before punctuation (but preserve space before placeholder ellipsis `...`)
  sentence = sentence.replace(/\s+(?!\.\.\.)([,.;:?!])/g, '$1');

  // Fix ", ," or double punctuation
  sentence = sentence.replace(/,\s*,/g, ',');

  return sentence.trim();
}
