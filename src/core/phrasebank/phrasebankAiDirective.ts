import type { AppSettings } from '../../types/archive';
import {
  ALL_SECTIONS,
  EVERYDAY_TO_ACADEMIC,
} from './data';
import { INTENT_SYNONYMS, searchModules } from './search';
import type { FilterState } from './types';

const DEFAULT_FILTER: FilterState = { tone: 'all', tense: 'all', coreOnly: false };

const FALLBACK_CORE_EXAMPLES = [
  'Previous studies have shown that ...',
  'However, little attention has been paid to ...',
  'Taken together, these findings suggest that ...',
  'It is plausible that these differences stem from ...',
  'One limitation of the present study is that ...',
  'In contrast to earlier findings, ...',
];

export function isPhrasebankAiPriorityEnabled(settings: AppSettings): boolean {
  return settings.phrasebank?.preferPhrasebankForAi ?? true;
}

/**
 * Retrieves up to `limit` context-relevant English Phrasebank patterns from the local corpus.
 */
export function retrieveRelevantPhrasebankExamples(
  contextText: string,
  limit = 6,
): string[] {
  const lower = contextText.toLowerCase();
  const terms: string[] = [];

  for (const key of Object.keys(INTENT_SYNONYMS)) {
    if (lower.includes(key)) {
      terms.push(key);
    }
  }

  const enTokens = lower
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 5);
  for (const t of enTokens) {
    if (!terms.includes(t)) terms.push(t);
  }

  const collected: string[] = [];
  const seen = new Set<string>();

  for (const term of terms.slice(0, 4)) {
    const bundle = searchModules(ALL_SECTIONS, term, DEFAULT_FILTER, ['sections', 'functions']);
    for (const grp of bundle.groups.slice(0, 3)) {
      for (const p of grp.phrases.slice(0, 3)) {
        if (!seen.has(p.en)) {
          seen.add(p.en);
          collected.push(p.en);
          if (collected.length >= limit) return collected;
        }
      }
    }
  }

  for (const fb of FALLBACK_CORE_EXAMPLES) {
    if (!seen.has(fb)) {
      seen.add(fb);
      collected.push(fb);
      if (collected.length >= limit) break;
    }
  }

  return collected;
}

/**
 * Builds the mandatory/preferred Academic Phrasebank de-AI guidance block for AI paper suggestions.
 */
export function buildPhrasebankSystemDirective(contextText: string): string {
  const examples = retrieveRelevantPhrasebankExamples(contextText, 6);
  const lower = contextText.toLowerCase();

  const matchedEverydayHints: string[] = [];
  for (const row of EVERYDAY_TO_ACADEMIC) {
    const base = row.everyday.replace(/\s*\(of doing\)/i, '').split('/')[0].trim().toLowerCase();
    if (base && lower.includes(base)) {
      matchedEverydayHints.push(`${row.everyday} -> ${row.academic}`);
    }
    if (matchedEverydayHints.length >= 5) break;
  }

  const lines: string[] = [
    '[ACADEMIC PHRASEBANK — DE-AI PRIORITY]',
    'When proposing academic paper revisions, prioritize authentic sentence structures, hedging, and formal vocabulary from Academic Phrasebank to reduce AI-generated stylization:',
    '1. Prefer established Phrasebank sentence frames, cautious hedging (appear to, suggest, indicate, may, plausible), precise academic verbs, and grammatically strict connectors (Nevertheless, Conversely, Owing to) over generic LLM clichés (e.g., delve into, tapestry, pivotal, underscore, it is worth noting that, 赋能, 毋庸置疑, 总而言之).',
    '2. Avoid contractions (it\'s -> it is, don\'t -> do not), informal quantifiers (a lot of -> considerable/substantial), and overly absolute claims.',
    '3. Keep domain facts/citations unchanged and match the manuscript language (for Chinese manuscripts, apply the same objective impersonal tone, cautious hedging, and concise academic connectors without translationese).',
    `4. Context-matched Academic Phrasebank patterns you may adapt:\n${examples.map((e) => `   - ${e}`).join('\n')}`,
  ];

  if (matchedEverydayHints.length > 0) {
    lines.push(
      `5. Detected colloquialisms to upgrade using Phrasebank vocabulary:\n${matchedEverydayHints.map((h) => `   - ${h}`).join('\n')}`,
    );
  }

  return lines.join('\n');
}

function matchCase(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  const first = source[0];
  if (first >= 'A' && first <= 'Z') {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const OFFLINE_PHRASEBANK_REPLACEMENTS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bdelve(?:s|d)?\s+into\b/gi, replacement: 'examine' },
  { pattern: /\bunderscore(?:s|d)?\b/gi, replacement: 'highlight' },
  { pattern: /\ba\s+lot\s+of\b/gi, replacement: 'considerable' },
  { pattern: /\bfind\s+out\b/gi, replacement: 'ascertain' },
  { pattern: /\blook\s+into\b/gi, replacement: 'investigate' },
  { pattern: /\bget\s+rid\s+of\b/gi, replacement: 'eliminate' },
  { pattern: /\bnot\s+enough\b/gi, replacement: 'insufficient' },
  { pattern: /\bit's\b/gi, replacement: 'it is' },
  { pattern: /\bdon't\b/gi, replacement: 'do not' },
  { pattern: /\bdoesn't\b/gi, replacement: 'does not' },
  { pattern: /\bisn't\b/gi, replacement: 'is not' },
  { pattern: /\baren't\b/gi, replacement: 'are not' },
  { pattern: /\bcan't\b/gi, replacement: 'cannot' },
  { pattern: /\bproves\b/gi, replacement: 'suggests' },
  { pattern: /总而言之/g, replacement: '综上所述' },
  { pattern: /毋庸置疑/g, replacement: '在一定程度上表明' },
  { pattern: /我们可以看到/g, replacement: '结果表明' },
];

/**
 * Deterministic Phrasebank de-AI vocabulary and phrasing polish for offline-smart outputs.
 */
export function applyOfflinePhrasebankPolish(text: string): string {
  if (!text) return text;
  let out = text;
  for (const rule of OFFLINE_PHRASEBANK_REPLACEMENTS) {
    out = out.replace(rule.pattern, (m) => matchCase(m, rule.replacement));
  }
  return out;
}
