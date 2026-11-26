import {
  FilterState,
  MoveCategory,
  PhraseBuilder,
  PhraseItem,
  SectionModule,
} from './types';

/**
 * Bilingual Chinese -> English/Chinese intent synonym map so users can search
 * naturally in Chinese ("研究空白", "局限性", "反驳", "显著差异", "谨慎推测")
 * or English ("paucity", "limitation", "hedging", "ANOVA").
 */
export const INTENT_SYNONYMS: Record<string, string[]> = {
  空白: ['gap', 'paucity', 'lack', 'unexamined', 'understudied', 'scant', 'no previous', '空白', '不足'],
  欠缺: ['gap', 'paucity', 'lack', 'little', 'scant', 'insufficient', '欠缺', '缺乏'],
  不足: ['inadequate', 'insufficient', 'paucity', 'lack', 'limited', 'shortcoming', '不足', '欠缺'],
  创新: ['first study', 'novel', 'original', 'new light', 'contribution', '创新', '首次'],
  意义: ['importance', 'significance', 'value', 'vital', 'crucial', 'contribution', '意义', '价值'],
  背景: ['background', 'context', 'importance', 'recent years', 'established', '背景'],
  问题: ['problem', 'issue', 'challenge', 'obstacle', 'concern', 'drawback', '问题', '挑战'],
  争议: ['controversy', 'debate', 'dispute', 'conflicting', 'contradictory', 'divergent', '争议', '争论'],
  局限: ['limitation', 'weakness', 'drawback', 'flaw', 'bias', 'sample size', 'generalize', '局限', '限制'],
  缺点: ['limitation', 'drawback', 'weakness', 'flaw', 'disadvantage', 'shortcoming', '缺点'],
  偏差: ['bias', 'confounding', 'skewed', 'recall bias', 'selection', '偏差'],
  样本: ['sample', 'cohort', 'participants', 'subjects', 'recruited', '样本', '参与者'],
  反驳: ['dispute', 'challenge', 'contradict', 'contrary', 'refute', 'question', 'rebuttal', '反驳', '质疑'],
  批评: ['critic', 'critique', 'flawed', 'fail to', 'overlook', 'neglect', 'deficient', '批评', '批判'],
  批判: ['critical', 'critic', 'flawed', 'fail to', 'weakness', 'questionable', '批判'],
  质疑: ['question', 'doubt', 'challenge', 'contested', 'skeptical', '质疑'],
  谨慎: ['cautious', 'caution', 'tentative', 'hedge', 'may', 'might', 'could', 'appear', 'seem', '谨慎', '委婉'],
  委婉: ['may', 'might', 'could', 'suggest', 'indicate', 'appear', 'seem', 'tendency', '委婉', '谨慎'],
  推测: ['may', 'might', 'could', 'possible', 'probable', 'likely', 'hypothesis', 'speculate', '推测', '假设'],
  显著: ['significant', 'significantly', 'p <', 'p =', 'ANOVA', 't-test', 'striking', 'marked', '显著'],
  相关: ['correlation', 'associated', 'association', 'link', 'relationship', 'related', '相关', '关联'],
  差异: ['difference', 'differ', 'disparity', 'contrast', 'unlike', 'vary', '差异', '不同'],
  因果: ['cause', 'causality', 'lead to', 'result in', 'attribute', 'due to', 'factor', 'stem from', '因果', '导致'],
  导致: ['cause', 'lead to', 'result in', 'give rise to', 'trigger', 'contribute to', '导致'],
  促进: ['facilitate', 'promote', 'enhance', 'boost', 'foster', 'amplify', 'stimulate', '促进'],
  抑制: ['inhibit', 'prevent', 'reduce', 'hinder', 'impede', 'impair', 'weaken', 'suppress', '抑制', '阻碍'],
  对比: ['compare', 'contrast', 'whereas', 'while', 'unlike', 'similar', 'comparable', '对比', '比较'],
  比较: ['compare', 'comparison', 'whereas', 'while', 'similar', 'comparable', '比较'],
  相似: ['similar', 'likewise', 'same vein', 'consistent', 'corroborate', 'comparable', '相似', '一致'],
  相反: ['contrary', 'contrast', 'unlike', 'conversely', 'however', 'whereas', '相反'],
  趋势: ['trend', 'rise', 'fall', 'increase', 'decrease', 'decline', 'peak', 'project', '趋势'],
  上升: ['rise', 'increase', 'growth', 'surge', 'peak', '上升', '增长'],
  下降: ['fall', 'drop', 'decline', 'decrease', 'low point', '下降', '减少'],
  预测: ['project', 'forecast', 'likely to', 'expected to', 'anticipated', '预测'],
  比例: ['proportion', 'percent', 'percentage', 'ratio', 'half', 'third', 'majority', 'minority', '比例', '百分比'],
  定义: ['define', 'definition', 'term', 'refer to', 'encompass', 'clarify', '定义', '术语'],
  分类: ['classify', 'categorize', 'taxonomy', 'divide', 'typology', 'heading', '分类'],
  列举: ['list', 'firstly', 'secondly', 'following', 'consist of', '列举'],
  举例: ['example', 'instance', 'exemplify', 'illustrate', 'case', 'such as', '举例', '例证'],
  共识: ['well known', 'consensus', 'widely accepted', 'established', 'of course', 'common knowledge', '共识'],
  过渡: ['transition', 'turning now', 'move on', 'following section', 'as discussed', 'preview', '过渡', '衔接'],
  总结: ['summarize', 'summary', 'conclusion', 'taken together', 'overall', 'in summary', '总结', '归纳'],
  目的: ['aim', 'objective', 'purpose', 'set out to', 'hypothesis', 'research question', '目的', '目标'],
  方法: ['method', 'methodology', 'approach', 'procedure', 'technique', 'design', 'protocol', '方法'],
  问卷: ['questionnaire', 'survey', 'Likert', 'respondent', 'response rate', '问卷', '调查'],
  访谈: ['interview', 'interviewee', 'informant', 'participant', 'theme', 'excerpt', '访谈'],
  统计: ['statistical', 'SPSS', 'ANOVA', 't-test', 'regression', 'Cronbach', 'mean', 'standard deviation', '统计'],
  图表: ['table', 'figure', 'chart', 'graph', 'shown in', 'stands out', '图表'],
  摘要: ['abstract', 'overview', 'aim', 'finding', 'implication', '摘要'],
  致谢: ['acknowledgement', 'grateful', 'gratitude', 'thank', 'funding', 'supervisor', '致谢', '感谢'],
  引用: ['Smith', 'Jones', 'cite', 'cited in', 'according to', 'quotation', '引用'],
  过去: ['past', '1990', 'century', 'historical', 'previously', 'formerly', '过去', '历史'],
  汇报: ['presentation', 'talk', 'slide', 'afternoon', 'questions', 'focus for a moment', '汇报', '演讲', '答辩'],
  答辩: ['presentation', 'question', 'conclude', 'visual', 'diagram', '答辩', '汇报'],
};

const ENGLISH_STOPWORDS = new Set([
  'a', 'an', 'the', 'this', 'that', 'is', 'are', 'was', 'were',
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'and', 'or',
]);

function getTokenCandidates(token: string): string[] {
  const candidates = new Set<string>([token]);
  for (const [key, synonyms] of Object.entries(INTENT_SYNONYMS)) {
    if (token.includes(key) || key.includes(token)) {
      synonyms.forEach((s) => candidates.add(s.toLowerCase()));
    }
  }
  return Array.from(candidates);
}

export interface SearchMatchGroup {
  section: SectionModule;
  move: MoveCategory;
  phrases: PhraseItem[];
  builders: PhraseBuilder[];
  score: number;
}

export interface SearchResultBundle {
  groups: SearchMatchGroup[];
  totalPhrases: number;
  totalBuilders: number;
  crossDomainMatchCount: number;
}

export function matchesFilters(phrase: PhraseItem, filters: FilterState): boolean {
  if (filters.tone !== 'all' && phrase.tone !== filters.tone) return false;
  if (filters.tense !== 'all' && phrase.tense !== filters.tense) return false;
  if (filters.coreOnly && !phrase.isCore) return false;
  return true;
}

function matchesTokenGroups(haystack: string, tokenGroups: string[][]): boolean {
  return tokenGroups.every((candidates) => candidates.some((c) => haystack.includes(c)));
}

export function searchModules(
  modules: SectionModule[],
  rawQuery: string,
  filters: FilterState,
  includeDomains: ('sections' | 'functions' | 'presentations')[]
): SearchResultBundle {
  const q = rawQuery.trim().toLowerCase();
  const rawTokens = q.split(/[\s,，、/]+/).filter(Boolean);
  const meaningfulTokens = rawTokens.filter((t) => !ENGLISH_STOPWORDS.has(t));
  const activeTokens = meaningfulTokens.length > 0 ? meaningfulTokens : rawTokens;
  const tokenGroups = activeTokens.map(getTokenCandidates);

  const groups: SearchMatchGroup[] = [];
  let totalPhrases = 0;
  let totalBuilders = 0;
  let crossDomainMatchCount = 0;

  for (const section of modules) {
    const inTargetDomain = includeDomains.includes(section.domain);

    for (const move of section.moves) {
      const moveText = `${section.titleCn} ${section.titleEn} ${move.titleCn} ${move.titleEn} ${move.tipCn ?? ''}`.toLowerCase();

      const matchedPhrases: { item: PhraseItem; score: number }[] = [];
      for (const phrase of move.phrases) {
        if (inTargetDomain && !matchesFilters(phrase, filters)) continue;

        const haystack = `${phrase.en} ${phrase.intentCn} ${phrase.tags.join(' ')} ${moveText}`.toLowerCase();

        if (!matchesTokenGroups(haystack, tokenGroups)) continue;

        let score = 2;
        if (q && phrase.en.toLowerCase().includes(q)) score += 12;
        if (q && phrase.intentCn.toLowerCase().includes(q)) score += 10;
        if (rawTokens.every((t) => haystack.includes(t))) score += 6;
        if (phrase.isCore) score += 1;
        matchedPhrases.push({ item: phrase, score });
      }

      const matchedBuilders: PhraseBuilder[] = [];
      for (const builder of move.builders ?? []) {
        if (inTargetDomain && filters.tone !== 'all' && builder.tone && builder.tone !== filters.tone) {
          continue;
        }
        const builderText = `${builder.titleCn} ${builder.descCn ?? ''} ${builder.tags.join(' ')} ${builder.columns
          .map((c) => `${c.labelCn} ${c.options.join(' ')}`)
          .join(' ')} ${moveText}`.toLowerCase();

        if (matchesTokenGroups(builderText, tokenGroups)) {
          matchedBuilders.push(builder);
        }
      }

      if (matchedPhrases.length > 0 || matchedBuilders.length > 0) {
        if (!inTargetDomain) {
          crossDomainMatchCount += matchedPhrases.length + matchedBuilders.length;
        } else {
          matchedPhrases.sort((a, b) => b.score - a.score);
          const maxScore = Math.max(
            matchedPhrases[0]?.score ?? 0,
            matchedBuilders.length > 0 ? 5 : 0
          );
          groups.push({
            section,
            move,
            phrases: matchedPhrases.map((m) => m.item),
            builders: matchedBuilders,
            score: maxScore,
          });
          totalPhrases += matchedPhrases.length;
          totalBuilders += matchedBuilders.length;
        }
      }
    }
  }

  groups.sort((a, b) => b.score - a.score);

  return {
    groups,
    totalPhrases,
    totalBuilders,
    crossDomainMatchCount,
  };
}
