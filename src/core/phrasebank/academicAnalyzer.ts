import { callAiChat } from '../aiGateway';
import type { AiPrivacyPolicy, AppSettings } from '../../types/archive';
import {
  applyOfflinePhrasebankPolish,
  isPhrasebankAiPriorityEnabled,
} from './phrasebankAiDirective';
import {
  ACADEMIC_VERBS,
  ALL_SECTIONS,
  BRE_US_SPELLING,
  CONNECTING_WORDS_MATRIX,
  EVERYDAY_TO_ACADEMIC,
  GROUP_PHRASES_MAP,
} from './data';
import { INTENT_SYNONYMS, searchModules } from './search';
import type {
  ContextAdviceItem,
  DetectedPaperSection,
  FilterState,
  PhraseBuilder,
  RecommendedPhrase,
  SmartIssue,
} from './types';

interface SectionRule {
  mappedSectionId: string;
  mappedSectionLabel: string;
  recommendedFunctionIds: string[];
  patterns: RegExp[];
  checklistCn: string[];
}

const SECTION_RULES: SectionRule[] = [
  {
    mappedSectionId: 'writing-abstracts',
    mappedSectionLabel: '摘要 · 五要素',
    recommendedFunctionIds: ['writing-abstracts', 'being-cautious', 'describing-quantities'],
    patterns: [/\babstract\b/i, /摘\s*要/, /内容提要/],
    checklistCn: [
      '是否涵盖：研究背景/空白、研究目的、方法样本、核心发现与定量结果、研究意义？',
      '方法与结果句通常使用一般过去时，研究意义/结论常用一般现在时。',
    ],
  },
  {
    mappedSectionId: 'introducing-work',
    mappedSectionLabel: '引言 · 引出研究',
    recommendedFunctionIds: ['shared-knowledge', 'defining-terms', 'signalling-transition'],
    patterns: [/\bintroduc(?:tion|ing)\b/i, /\bbackground\b/i, /\bmotivation\b/i, /引\s*言/, /绪\s*论/, /背\s*景/],
    checklistCn: [
      '遵循 CARS 三步走：建立研究重要性与共识 → 指出争议/稀缺/研究空白 → 交代本文目的与结构路标。',
      '避免在引言中过早展开冗长实验细节，重点突出研究缺口（Research Gap）。',
    ],
  },
  {
    mappedSectionId: 'reviewing-literature',
    mappedSectionLabel: '文献综述 · 评述综合',
    recommendedFunctionIds: ['being-critical', 'comparing-contrasting', 'writing-past'],
    patterns: [
      /\bliterature\s*review\b/i,
      /\brelated\s*work\b/i,
      /\bprior\s*work\b/i,
      /\bstate\s+of\s+the\s+art\b/i,
      /文献综述/,
      /相关工作/,
      /研究现状/,
      /国内外研究/,
    ],
    checklistCn: [
      '避免单纯“流水账式罗列”文献，建议按主题归类并用对比与批判句型串联前人局限。',
      '引用具体学者观点时注意区分一般现在时（当前共识）与一般过去时（特定历史研究）。',
    ],
  },
  {
    mappedSectionId: 'describing-methods',
    mappedSectionLabel: '研究方法 · 设计流程',
    recommendedFunctionIds: ['classifying-listing', 'describing-quantities', 'defining-terms'],
    patterns: [
      /\bmethod(?:ology|s)?\b/i,
      /\bapproach\b/i,
      /\bframework\b/i,
      /\barchitecture\b/i,
      /\bexperimental\s*(?:setup|design)\b/i,
      /\bmaterials?\b/i,
      /研究方法/,
      /实验方法/,
      /方法设计/,
      /方法与/,
      /系统架构/,
      /模型构建/,
      /实验设置/,
      /实验设计/,
      /核心机制/,
      /方\s*法/,
    ],
    checklistCn: [
      '交代数据来源、样本/实验设置、关键参数与对比基线，确保可复现性。',
      '英文描述实验流程多用一般过去时与被动/非人称语态。',
    ],
  },
  {
    mappedSectionId: 'reporting-results',
    mappedSectionLabel: '结果报告 · 数据主题',
    recommendedFunctionIds: ['describing-trends', 'describing-quantities', 'comparing-contrasting'],
    patterns: [
      /\bresults?\b/i,
      /\bfindings?\b/i,
      /\bevaluation\b/i,
      /\bablation\b/i,
      /\bperformance\b/i,
      /\bexperiments?\b/i,
      /实验结果/,
      /结果报告/,
      /结果与分析/,
      /消融实验/,
      /性能评估/,
    ],
    checklistCn: [
      '先呈现总体结果与关键数值，再引导读者关注图表中的显著差异或消融对比。',
      '注意保持全文指标口径、图表编号与正文字段完全一致。',
    ],
  },
  {
    mappedSectionId: 'discussing-findings',
    mappedSectionLabel: '结果讨论 · 阐释对照',
    recommendedFunctionIds: ['being-cautious', 'explaining-causality', 'being-critical'],
    patterns: [/\bdiscussion\b/i, /\bimplications?\b/i, /\blimitations?\b/i, /结果讨论/, /讨论/, /局限性/, /分析与讨论/],
    checklistCn: [
      '将本文发现与前人文献（一致/矛盾）对照，并给出因果阐释。',
      '推断性解释请配合谨慎避险词（may / suggest / appear to）并坦诚说明研究局限性。',
    ],
  },
  {
    mappedSectionId: 'writing-conclusions',
    mappedSectionLabel: '结论 · 总结展望',
    recommendedFunctionIds: ['being-cautious', 'signalling-transition'],
    patterns: [/\bconclusions?\b/i, /\bsummary\b/i, /\bfuture\s*work\b/i, /结\s*论/, /总\s*结/, /展望/, /未来工作/],
    checklistCn: [
      '凝练核心贡献与关键定量结论，避免直接复制摘要原句。',
      '明确指出研究边界与可行的未来工作方向（Future Work）。',
    ],
  },
  {
    mappedSectionId: 'writing-acknowledgements',
    mappedSectionLabel: '致谢 · 从公到私',
    recommendedFunctionIds: ['writing-acknowledgements'],
    patterns: [/\backnowledg(?:e)?ments?\b/i, /\bfunding\b/i, /致\s*谢/, /鸣\s*谢/],
    checklistCn: ['按“基金资助项目 → 导师与合作者 → 实验平台/受试者 → 亲友”从公到私致谢。'],
  },
];

const DEFAULT_SECTION_RULE = SECTION_RULES[1]; // introducing-work

function matchSectionRule(title: string): SectionRule {
  for (const rule of SECTION_RULES) {
    if (rule.patterns.some((re) => re.test(title))) {
      return rule;
    }
  }
  return DEFAULT_SECTION_RULE;
}

export function getSectionChecklist(mappedSectionId: string): string[] {
  return SECTION_RULES.find((r) => r.mappedSectionId === mappedSectionId)?.checklistCn ?? [];
}

/**
 * Extracts paper sections from Markdown headings, LaTeX \section commands, or numbered titles.
 */
export function detectPaperSections(text: string): DetectedPaperSection[] {
  if (!text.trim()) return [];

  const rawHeadings: Array<{ title: string; level: number; startOffset: number }> = [];
  const lines = text.split('\n');
  let offset = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    const mdMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (mdMatch) {
      rawHeadings.push({
        title: mdMatch[2].replace(/[#*`]/g, '').trim(),
        level: mdMatch[1].length,
        startOffset: offset,
      });
    } else {
      const texMatch = trimmed.match(/^\\(section|subsection|subsubsection)\*?\{([^}]+)\}/);
      if (texMatch) {
        const lvl = texMatch[1] === 'section' ? 1 : texMatch[1] === 'subsection' ? 2 : 3;
        rawHeadings.push({
          title: texMatch[2].trim(),
          level: lvl,
          startOffset: offset,
        });
      } else if (/^\\begin\{abstract\}/i.test(trimmed)) {
        rawHeadings.push({
          title: 'Abstract',
          level: 1,
          startOffset: offset,
        });
      } else if (
        /^(?:(?:\d+(?:\.\d+)*|[IVX]+)\s*[.、]\s*)?(?:摘要|Abstract|引言|Introduction|文献综述|Literature Review|Related Work|研究方法|Methodology|Methods|实验结果|Results|讨论|Discussion|结论|Conclusion|Conclusions|致谢|Acknowledgements?)$/i.test(
          trimmed,
        )
      ) {
        rawHeadings.push({
          title: trimmed,
          level: 1,
          startOffset: offset,
        });
      }
    }
    offset += line.length + 1;
  }

  return rawHeadings.map((h, idx) => {
    const endOffset = idx + 1 < rawHeadings.length ? rawHeadings[idx + 1].startOffset : text.length;
    const slice = text.slice(h.startOffset, endOffset);
    const rule = matchSectionRule(h.title);
    const wordCount = slice
      .replace(/[#\\*_`]/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;

    return {
      id: `sec_${idx}_${h.startOffset}`,
      title: h.title,
      level: h.level,
      startOffset: h.startOffset,
      endOffset,
      mappedSectionId: rule.mappedSectionId,
      mappedSectionLabel: rule.mappedSectionLabel,
      recommendedFunctionIds: rule.recommendedFunctionIds,
      wordCount,
      source: 'heading',
    };
  });
}

/**
 * Finds the active section around cursorPos, or falls back to content heuristics when no headings exist.
 */
export function detectCurrentSection(
  text: string,
  cursorPos: number,
  precomputedSections?: DetectedPaperSection[],
): DetectedPaperSection | null {
  const sections = precomputedSections ?? detectPaperSections(text);
  if (sections.length > 0) {
    let best: DetectedPaperSection | null = null;
    for (const sec of sections) {
      if (cursorPos >= sec.startOffset && cursorPos <= sec.endOffset) {
        if (!best || sec.startOffset >= best.startOffset) {
          best = sec;
        }
      }
    }
    return best ?? sections[0];
  }

  if (!text.trim()) return null;

  const sample = text.toLowerCase();
  let matchedRule = DEFAULT_SECTION_RULE;

  if (/\b(?:abstract|this paper aims to)\b|本文旨在|摘要/.test(sample)) {
    matchedRule = SECTION_RULES[0];
  } else if (/\b(?:in conclusion|taken together|future work)\b|综上所述|未来工作|本文总结/.test(sample)) {
    matchedRule = SECTION_RULES[6];
  } else if (/\b(?:limitation|however, these findings|consistent with previous)\b|局限性|值得注意的是|与前人研究/.test(sample)) {
    matchedRule = SECTION_RULES[5];
  } else if (/\b(?:p\s*[<>=]\s*0\.\d+|ablation|table\s*\d|figure\s*\d|accuracy)\b|准确率|消融|实验结果|如图|如表/.test(sample)) {
    matchedRule = SECTION_RULES[4];
  } else if (/\b(?:dataset|participants|procedure|architecture|algorithm)\b|数据集|算法|框架|实验设置|目标函数/.test(sample)) {
    matchedRule = SECTION_RULES[3];
  } else if (/\b(?:previous studies|et al\.|literature)\b|已有研究|现有方法|文献/.test(sample)) {
    matchedRule = SECTION_RULES[2];
  }

  return {
    id: 'sec_heuristic',
    title: matchedRule.mappedSectionLabel,
    level: 1,
    startOffset: 0,
    endOffset: text.length,
    mappedSectionId: matchedRule.mappedSectionId,
    mappedSectionLabel: matchedRule.mappedSectionLabel,
    recommendedFunctionIds: matchedRule.recommendedFunctionIds,
    wordCount: text.trim().split(/\s+/).filter(Boolean).length,
    source: 'heuristic',
  };
}

function matchCase(source: string, replacement: string): string {
  if (!source || !replacement) return replacement;
  const first = source[0];
  if (first >= 'A' && first <= 'Z') {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

const CONTRACTION_EXPANSIONS: Record<string, string[]> = {
  "it's": ['it is', 'it has'],
  "don't": ['do not'],
  "doesn't": ['does not'],
  "didn't": ['did not'],
  "isn't": ['is not'],
  "aren't": ['are not'],
  "wasn't": ['was not'],
  "weren't": ['were not'],
  "won't": ['will not'],
  "can't": ['cannot'],
  "couldn't": ['could not'],
  "wouldn't": ['would not'],
  "shouldn't": ['should not'],
  "haven't": ['have not'],
  "hasn't": ['has not'],
  "hadn't": ['had not'],
  "there's": ['there is'],
  "that's": ['that is'],
};

const EVERYDAY_REGEX_ENTRIES: Array<{
  pattern: RegExp;
  everyday: string;
  replacements: string[];
  note: string;
}> = EVERYDAY_TO_ACADEMIC.map((item) => {
  const cleanPhrase = item.everyday
    .replace(/\s*\(of doing\)/i, '')
    .split('/')[0]
    .trim();
  const escaped = cleanPhrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
  return {
    pattern: new RegExp(`\\b${escaped}\\b`, 'gi'),
    everyday: item.everyday,
    replacements: item.academic
      .split('/')
      .map((s) => s.trim())
      .filter(Boolean),
    note: item.noteCn ? `${item.categoryCn} · ${item.noteCn}` : item.categoryCn,
  };
});

const HEDGING_FIXES: Array<{ pattern: RegExp; title: string; replacements: string[]; detail: string }> = [
  {
    pattern: /\bproves\b/gi,
    title: '断言过强：proves',
    replacements: ['suggests', 'indicates', 'demonstrates'],
    detail: '学术写作通常避免用 prove 绝对化断言因果，建议改用 suggest / indicate / demonstrate。',
  },
  {
    pattern: /\bproved\b/gi,
    title: '断言过强：proved',
    replacements: ['suggested', 'indicated', 'demonstrated'],
    detail: '建议采用更审慎的实证动词（suggested / indicated / demonstrated）。',
  },
  {
    pattern: /\bobviously\b/gi,
    title: '主观绝对副词：obviously',
    replacements: ['evidently', 'notably', 'as shown in the results'],
    detail: 'obviously 带有主观武断色彩，审稿人易质疑，建议改为客观表述。',
  },
  {
    pattern: /\bundoubtedly\b/gi,
    title: '绝对化副词：undoubtedly',
    replacements: ['arguably', 'plausibly', 'likely'],
    detail: '建议替换为审慎程度副词以符合学术避险规范。',
  },
  {
    pattern: /\bdefinitely\b/gi,
    title: '绝对化副词：definitely',
    replacements: ['likely', 'presumably', 'consistently'],
    detail: '建议替换为审慎程度副词。',
  },
  {
    pattern: /毫无疑问|绝对证明|彻底证明|显然可以证明/g,
    title: '中文断言过强表达',
    replacements: ['在一定程度上表明', '初步表明', '倾向于支持'],
    detail: '学术写作应避免绝对化结论，建议使用审慎/客观措辞以防审稿人反例质疑。',
  },
];

const ZH_COLLOQUIAL_FIXES: Array<{
  pattern: RegExp;
  title: string;
  replacements: string[];
  detail: string;
}> = [
  {
    pattern: /我们可以看到|我们可以发现/g,
    title: '口语化第一人称引导',
    replacements: ['由实验结果可见', '结果表明', '进一步观察发现'],
    detail: '正式学术论文建议减少“我们可以看到”，改用非人称客观主语引导。',
  },
  {
    pattern: /非常多|很多研究|很多方法/g,
    title: '口语化量词表达',
    replacements: ['大量研究', '诸多现有方法', '多项前期工作'],
    detail: '使用“大量 / 诸多 / 多项”替代口语化“很多 / 非常多”。',
  },
  {
    pattern: /特别好|非常好|很好地/g,
    title: '口语化程度评价',
    replacements: ['显著优异', '较为理想', '有效地'],
    detail: '学术评价建议用“显著 / 有效 / 优越”并配合定量指标。',
  },
  {
    pattern: /也就是说/g,
    title: '偏口语过渡词',
    replacements: ['即', '换言之'],
    detail: '正式论文中“换言之 / 即”更为紧凑书面。',
  },
];

const CONFUSED_TOKENS: Array<{ token: string; pair: string; summaryCn: string }> = [
  { token: 'affect', pair: 'affect / effect', summaryCn: 'affect 常用作动词“影响”；effect 常用作名词“效应/结果”' },
  { token: 'effect', pair: 'affect / effect', summaryCn: 'effect 作可数单数名词时需加限定词（an / the / this），作动词意为“促使实现”' },
  { token: 'comprise', pair: 'comprise / consist', summaryCn: 'comprise 直接跟组成部分（勿用 is comprised of）；consist 必须搭配 of' },
  { token: 'complement', pair: 'compliment / complement', summaryCn: 'complement 表“互补/完善”；compliment 表“称赞”' },
  { token: 'compliment', pair: 'compliment / complement', summaryCn: '检查是否本意为“互补（complement）”而非“赞美（compliment）”' },
  { token: 'principal', pair: 'principle / principal', summaryCn: 'principal 表“主要的/核心的”（形容词）；principle 表“原则/原理”（名词）' },
  { token: 'principle', pair: 'principle / principal', summaryCn: 'principle 为名词“原理/准则”；形容词“主要的”应拼作 principal' },
  { token: 'discrete', pair: 'discrete / discreet', summaryCn: 'discrete 表“离散/独立”；discreet 表“言行谨慎”' },
  { token: 'discreet', pair: 'discrete / discreet', summaryCn: '学术数据/变量通常为 discrete（离散），而非 discreet（谨慎）' },
];

const WEAK_REPETITIVE_VERBS: Array<{ verb: string; alternatives: string[] }> = [
  { verb: 'show', alternatives: ['demonstrate', 'indicate', 'reveal', 'illustrate'] },
  { verb: 'shows', alternatives: ['demonstrates', 'indicates', 'reveals', 'illustrates'] },
  { verb: 'make', alternatives: ['construct', 'formulate', 'generate', 'establish'] },
  { verb: 'do', alternatives: ['conduct', 'perform', 'execute', 'carry out'] },
  { verb: 'get', alternatives: ['obtain', 'acquire', 'achieve', 'yield'] },
  { verb: 'use', alternatives: ['utilize', 'employ', 'adopt', 'leverage'] },
];

/**
 * Scans an academic text slice for replaceable colloquialisms, contractions, BrE spellings,
 * evidence grammar errors, overstatements, and repetitive verbs.
 */
export function analyzeAcademicIssues(text: string, baseOffset = 0): SmartIssue[] {
  if (!text.trim()) return [];

  const issues: SmartIssue[] = [];
  let seq = 0;

  const pushIssue = (issue: Omit<SmartIssue, 'id'>) => {
    issues.push({ ...issue, id: `iss_${seq++}_${issue.startOffset}` });
  };

  // 1. Everyday -> Academic replacement pairs
  for (const entry of EVERYDAY_REGEX_ENTRIES) {
    entry.pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = entry.pattern.exec(text)) !== null) {
      const matchedText = m[0];
      const start = baseOffset + m.index;
      const end = start + matchedText.length;
      pushIssue({
        kind: 'everyday-word',
        severity: 'suggestion',
        title: `口语词可升级：${matchedText}`,
        detail: `${entry.note}。建议替换为更正式的学术表达。`,
        matchedText,
        startOffset: start,
        endOffset: end,
        replacements: entry.replacements.map((r) => matchCase(matchedText, r)),
        ruleRef: 'style-2',
      });
    }
  }

  // 2. Contractions (prohibited in academic prose)
  const contractionRegex =
    /\b(it's|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|won't|can't|couldn't|wouldn't|shouldn't|haven't|hasn't|hadn't|there's|that's)\b/gi;
  let cm: RegExpExecArray | null;
  while ((cm = contractionRegex.exec(text)) !== null) {
    const matchedText = cm[0];
    const key = matchedText.toLowerCase();
    const reps = CONTRACTION_EXPANSIONS[key] ?? [];
    if (reps.length > 0) {
      pushIssue({
        kind: 'contraction',
        severity: 'warning',
        title: `禁用缩写形式：${matchedText}`,
        detail: '正式学术论文应避免使用缩略形式（访谈逐字转录除外）。',
        matchedText,
        startOffset: baseOffset + cm.index,
        endOffset: baseOffset + cm.index + matchedText.length,
        replacements: reps.map((r) => matchCase(matchedText, r)),
        ruleRef: 'style-5',
      });
    }
  }

  // 3. Evidence uncountable grammar errors
  const evAnRegex = /\ban\s+evidence\b/gi;
  let evm: RegExpExecArray | null;
  while ((evm = evAnRegex.exec(text)) !== null) {
    pushIssue({
      kind: 'confused-word',
      severity: 'warning',
      title: `不可数名词误用：${evm[0]}`,
      detail: 'evidence 在学术英语中为不可数名词，不可与不定冠词 an 连用。',
      matchedText: evm[0],
      startOffset: baseOffset + evm.index,
      endOffset: baseOffset + evm.index + evm[0].length,
      replacements: [matchCase(evm[0], 'evidence'), matchCase(evm[0], 'a piece of evidence')],
    });
  }
  const evPluralRegex = /\bevidences\b/gi;
  while ((evm = evPluralRegex.exec(text)) !== null) {
    pushIssue({
      kind: 'confused-word',
      severity: 'warning',
      title: `不可数名词复数误用：${evm[0]}`,
      detail: 'evidence 不可加复数 -s。',
      matchedText: evm[0],
      startOffset: baseOffset + evm.index,
      endOffset: baseOffset + evm.index + evm[0].length,
      replacements: [matchCase(evm[0], 'evidence')],
    });
  }

  // 4. BrE -> US Spelling alignment
  for (const pair of BRE_US_SPELLING.pairs) {
    const usPrimary = pair.us.split('/')[0].trim();
    if (pair.british.toLowerCase() === usPrimary.toLowerCase()) continue;
    const re = new RegExp(`\\b${pair.british}\\b`, 'gi');
    let bm: RegExpExecArray | null;
    while ((bm = re.exec(text)) !== null) {
      pushIssue({
        kind: 'spelling-bre',
        severity: 'suggestion',
        title: `英式拼写转美式：${bm[0]}`,
        detail: `学术句库默认采用美式英语（US），可一键统一为 ${usPrimary}（若投英系期刊可忽略）。`,
        matchedText: bm[0],
        startOffset: baseOffset + bm.index,
        endOffset: baseOffset + bm.index + bm[0].length,
        replacements: [matchCase(bm[0], usPrimary)],
      });
    }
  }
  const breIseRe = /\b(analyse|analysed|summarised|organisation|centre|metre)\b/gi;
  const breIseMap: Record<string, string> = {
    analyse: 'analyze',
    analysed: 'analyzed',
    summarised: 'summarized',
    organisation: 'organization',
    centre: 'center',
    metre: 'meter',
  };
  let brm: RegExpExecArray | null;
  while ((brm = breIseRe.exec(text)) !== null) {
    const target = breIseMap[brm[0].toLowerCase()];
    if (target) {
      pushIssue({
        kind: 'spelling-bre',
        severity: 'suggestion',
        title: `英式拼写转美式：${brm[0]}`,
        detail: `美式标准拼写为 ${target}，建议全文保持拼写体系一致。`,
        matchedText: brm[0],
        startOffset: baseOffset + brm.index,
        endOffset: baseOffset + brm.index + brm[0].length,
        replacements: [matchCase(brm[0], target)],
      });
    }
  }

  // 5. Hedging / overstatement checks
  for (const hf of HEDGING_FIXES) {
    hf.pattern.lastIndex = 0;
    let hm: RegExpExecArray | null;
    while ((hm = hf.pattern.exec(text)) !== null) {
      pushIssue({
        kind: 'hedging',
        severity: 'suggestion',
        title: hf.title,
        detail: hf.detail,
        matchedText: hm[0],
        startOffset: baseOffset + hm.index,
        endOffset: baseOffset + hm.index + hm[0].length,
        replacements: hf.replacements.map((r) => matchCase(hm![0], r)),
        ruleRef: 'style-3',
      });
    }
  }

  // 6. Chinese colloquialisms
  for (const zf of ZH_COLLOQUIAL_FIXES) {
    zf.pattern.lastIndex = 0;
    let zm: RegExpExecArray | null;
    while ((zm = zf.pattern.exec(text)) !== null) {
      pushIssue({
        kind: 'zh-colloquial',
        severity: 'suggestion',
        title: zf.title,
        detail: zf.detail,
        matchedText: zm[0],
        startOffset: baseOffset + zm.index,
        endOffset: baseOffset + zm.index + zm[0].length,
        replacements: zf.replacements,
      });
    }
  }

  // 7. Informal second-person pronouns in English prose
  const youRe = /\b(you|your)\b/gi;
  let ym: RegExpExecArray | null;
  while ((ym = youRe.exec(text)) !== null) {
    pushIssue({
      kind: 'impersonal',
      severity: 'warning',
      title: `非客观人称代词：${ym[0]}`,
      detail: '正式学术语境通常避免直接对读者使用 you / your，建议改为被动或非人称结构（如 it can be observed that...）。',
      matchedText: ym[0],
      startOffset: baseOffset + ym.index,
      endOffset: baseOffset + ym.index + ym[0].length,
      replacements: ym[0].toLowerCase() === 'you' ? ['one', 'researchers'] : ['their', 'the'],
      ruleRef: 'style-4',
    });
  }

  // 8. Confused words advisory (surface once per distinct word)
  const seenConfused = new Set<string>();
  for (const cw of CONFUSED_TOKENS) {
    const re = new RegExp(`\\b${cw.token}\\b`, 'i');
    const m = re.exec(text);
    if (m && !seenConfused.has(cw.token)) {
      seenConfused.add(cw.token);
      pushIssue({
        kind: 'confused-word',
        severity: 'info',
        title: `易混词自查：${cw.pair}`,
        detail: cw.summaryCn,
        matchedText: m[0],
        startOffset: baseOffset + m.index,
        endOffset: baseOffset + m.index + m[0].length,
        replacements: [],
      });
    }
  }

  // 9. Repetitive weak verbs in the current slice (>= 2 times)
  for (const wv of WEAK_REPETITIVE_VERBS) {
    const re = new RegExp(`\\b${wv.verb}\\b`, 'gi');
    const matches = Array.from(text.matchAll(re));
    if (matches.length >= 2) {
      const second = matches[1];
      const idx = second.index ?? 0;
      pushIssue({
        kind: 'weak-verb',
        severity: 'suggestion',
        title: `高频弱动词重复：${wv.verb}（出现 ${matches.length} 次）`,
        detail: `建议在后续句中换用更精准的学术动词（源自学术动词库），避免语义单调。`,
        matchedText: second[0],
        startOffset: baseOffset + idx,
        endOffset: baseOffset + idx + second[0].length,
        replacements: wv.alternatives.map((a) => matchCase(second[0], a)),
      });
    }
  }

  // Deduplicate overlapping offsets (keep higher severity first)
  const sevRank: Record<SmartIssue['severity'], number> = { warning: 3, suggestion: 2, info: 1 };
  issues.sort((a, b) => a.startOffset - b.startOffset || sevRank[b.severity] - sevRank[a.severity]);

  const deduped: SmartIssue[] = [];
  for (const iss of issues) {
    const overlaps = deduped.some(
      (kept) => iss.startOffset < kept.endOffset && iss.endOffset > kept.startOffset,
    );
    if (!overlaps) {
      deduped.push(iss);
    }
  }

  return deduped;
}

const DEFAULT_FILTER: FilterState = { tone: 'all', tense: 'all', coreOnly: false };

/**
 * Recommends relevant Phrasebank sentences & builders based on selected text, active paragraph,
 * detected paper section, and anti-repetition group variants.
 */
export function recommendPhrasesForContext(params: {
  text: string;
  selectedText: string;
  currentParagraph: string;
  currentSection: DetectedPaperSection | null;
  limit?: number;
}): {
  phrases: RecommendedPhrase[];
  builders: Array<{
    builder: PhraseBuilder;
    sectionShortCn: string;
    moveTitleCn: string;
    skeletonSlot?: string;
  }>;
} {
  const { selectedText, currentParagraph, currentSection, limit = 8 } = params;
  const focusText = (selectedText || currentParagraph || '').trim();
  const focusLower = focusText.toLowerCase();

  const scoreMap = new Map<string, RecommendedPhrase>();
  const builderList: Array<{
    builder: PhraseBuilder;
    sectionShortCn: string;
    moveTitleCn: string;
    skeletonSlot?: string;
    score: number;
  }> = [];

  const upsertPhrase = (
    rec: RecommendedPhrase,
  ) => {
    const existing = scoreMap.get(rec.phrase.id);
    if (!existing || rec.score > existing.score) {
      scoreMap.set(rec.phrase.id, rec);
    }
  };

  // 1. Extract Chinese/English cue keywords from focusText
  const matchedIntentKeys: string[] = [];
  for (const key of Object.keys(INTENT_SYNONYMS)) {
    if (focusLower.includes(key)) {
      matchedIntentKeys.push(key);
    }
  }

  const englishKeywords = focusLower
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4)
    .slice(0, 5);

  const queryTerms = Array.from(new Set([...matchedIntentKeys, ...englishKeywords]));
  for (const term of queryTerms.slice(0, 4)) {
    const bundle = searchModules(ALL_SECTIONS, term, DEFAULT_FILTER, ['sections', 'functions']);
    for (const grp of bundle.groups.slice(0, 3)) {
      const inCurrentSection =
        currentSection &&
        (grp.section.id === currentSection.mappedSectionId ||
          currentSection.recommendedFunctionIds.includes(grp.section.id));
      for (const p of grp.phrases.slice(0, 3)) {
        upsertPhrase({
          phrase: p,
          sectionShortCn: grp.section.shortCn,
          moveTitleCn: grp.move.titleCn,
          skeletonSlot: grp.move.skeletonSlot,
          reason: inCurrentSection
            ? `贴合当前「${currentSection?.mappedSectionLabel}」· 意图「${term}」`
            : `语义匹配「${term}」`,
          score: (inCurrentSection ? 22 : 14) + (p.isCore ? 2 : 0),
        });
      }
      for (const b of grp.builders.slice(0, 1)) {
        builderList.push({
          builder: b,
          sectionShortCn: grp.section.shortCn,
          moveTitleCn: grp.move.titleCn,
          skeletonSlot: grp.move.skeletonSlot,
          score: inCurrentSection ? 18 : 10,
        });
      }
    }
  }

  // 2. Anti-repetition: if paragraph already uses a stem from a grouped phrase, elevate sibling variants
  if (focusLower.length > 15) {
    for (const [, groupEntries] of GROUP_PHRASES_MAP.entries()) {
      for (const entry of groupEntries) {
        const stem = entry.phrase.en
          .replace(/\b(?:X|Y|Z|Smith|Jones)\b/g, '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        const words = stem.split(' ').filter((w) => w.length >= 4);
        const anchorStem = words.slice(0, 4).join(' ');
        if (anchorStem.length >= 14 && focusLower.includes(anchorStem)) {
          for (const sib of groupEntries) {
            if (sib.phrase.id !== entry.phrase.id) {
              upsertPhrase({
                phrase: sib.phrase,
                sectionShortCn: sib.section.shortCn,
                moveTitleCn: sib.moveTitleCn,
                skeletonSlot: sib.skeletonSlot,
                reason: '防重复 · 同修辞功能换说法',
                score: 28,
              });
            }
          }
          break;
        }
      }
    }
  }

  // 3. Section baseline core recommendations
  if (currentSection) {
    const targetSectionIds = [
      currentSection.mappedSectionId,
      ...currentSection.recommendedFunctionIds,
    ];
    for (const secId of targetSectionIds) {
      const sec = ALL_SECTIONS.find((s) => s.id === secId);
      if (!sec) continue;
      const isPrimary = sec.id === currentSection.mappedSectionId;
      for (const move of sec.moves) {
        for (const p of move.phrases) {
          if (p.isCore) {
            upsertPhrase({
              phrase: p,
              sectionShortCn: sec.shortCn,
              moveTitleCn: move.titleCn,
              skeletonSlot: move.skeletonSlot,
              reason: isPrimary
                ? `当前章节核心句型 · ${sec.shortCn}`
                : `章节配套功能 · ${sec.shortCn}`,
              score: isPrimary ? 12 : 8,
            });
          }
        }
        if (isPrimary && move.builders && move.builders.length > 0) {
          builderList.push({
            builder: move.builders[0],
            sectionShortCn: sec.shortCn,
            moveTitleCn: move.titleCn,
            skeletonSlot: move.skeletonSlot,
            score: 14,
          });
        }
      }
    }
  }

  const phrases = Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const uniqueBuilders = new Map<string, (typeof builderList)[number]>();
  for (const b of builderList.sort((a, b) => b.score - a.score)) {
    if (!uniqueBuilders.has(b.builder.id)) {
      uniqueBuilders.set(b.builder.id, b);
    }
  }

  return {
    phrases,
    builders: Array.from(uniqueBuilders.values())
      .slice(0, 3)
      .map(({ builder, sectionShortCn, moveTitleCn, skeletonSlot }) => ({
        builder,
        sectionShortCn,
        moveTitleCn,
        skeletonSlot,
      })),
  };
}

/**
 * Builds a clean, safe local rewrite of the target snippet by applying high-confidence replacements.
 */
function buildAutoSafeRewrite(snippet: string, localIssues: SmartIssue[]): string | undefined {
  const actionable = localIssues.filter(
    (iss) =>
      iss.replacements.length > 0 &&
      (iss.kind === 'everyday-word' ||
        iss.kind === 'contraction' ||
        iss.kind === 'spelling-bre' ||
        iss.kind === 'zh-colloquial' ||
        iss.kind === 'hedging'),
  );
  if (actionable.length === 0) return undefined;

  // Apply from back to front so offsets stay valid
  const sorted = [...actionable].sort((a, b) => b.startOffset - a.startOffset);
  let out = snippet;
  for (const iss of sorted) {
    if (iss.startOffset >= 0 && iss.endOffset <= out.length) {
      out = out.slice(0, iss.startOffset) + iss.replacements[0] + out.slice(iss.endOffset);
    }
  }
  return out === snippet ? undefined : out;
}

/**
 * Analyzes the active paragraph / selection together with section context and issues,
 * returning structured advice + actionable rewrites (works offline and with configured AI).
 */
export async function analyzeContextAndSuggest(params: {
  fullText: string;
  selectionText: string;
  selectionStart: number;
  selectionEnd: number;
  paragraphText: string;
  paragraphStart: number;
  paragraphEnd: number;
  currentSection: DetectedPaperSection | null;
  settings: AppSettings;
  policy: AiPrivacyPolicy;
}): Promise<{
  source: 'cloud' | 'ollama' | 'offline-smart';
  summary: string;
  advice: ContextAdviceItem[];
  appliedSkillNames: string[];
  phrasebankPriorityApplied?: boolean;
}> {
  const {
    fullText,
    selectionText,
    selectionStart,
    selectionEnd,
    paragraphText,
    paragraphStart,
    paragraphEnd,
    currentSection,
    settings,
    policy,
  } = params;

  const hasSelection = selectionText.trim().length > 0;
  const targetText = (hasSelection ? selectionText : paragraphText).trim() || fullText.slice(0, 800);
  const targetStart = hasSelection ? selectionStart : paragraphStart;
  const targetEnd = hasSelection ? selectionEnd : paragraphEnd;

  const localIssues = analyzeAcademicIssues(targetText, 0);
  const recs = recommendPhrasesForContext({
    text: fullText,
    selectedText: selectionText,
    currentParagraph: paragraphText,
    currentSection,
    limit: 4,
  });

  const preferPhrasebank = isPhrasebankAiPriorityEnabled(settings);

  const buildOfflineAdvice = (): { summary: string; advice: ContextAdviceItem[] } => {
    const items: ContextAdviceItem[] = [];
    const sectionLabel = currentSection?.mappedSectionLabel ?? '正文段落';

    // 1. Safe batch rewrite if issues exist
    const rawAutoRewrite = buildAutoSafeRewrite(targetText, localIssues);
    const autoRewrite = rawAutoRewrite
      ? preferPhrasebank
        ? applyOfflinePhrasebankPolish(rawAutoRewrite)
        : rawAutoRewrite
      : preferPhrasebank
        ? (() => {
            const polished = applyOfflinePhrasebankPolish(targetText);
            return polished !== targetText ? polished : undefined;
          })()
        : undefined;

    if (autoRewrite) {
      items.push({
        id: 'adv_rewrite_auto',
        category: 'academic-tone',
        title: preferPhrasebank
          ? `Academic Phrasebank 降AI与学术化升级（${localIssues.length} 处优化）`
          : `学术语体与措辞升级（发现 ${localIssues.length} 处可优化项）`,
        rationale:
          localIssues
            .slice(0, 3)
            .map((i) => `${i.title}`)
            .join('；') || '优先套用 Academic Phrasebank 正式用词与谨慎表达以降低 AI 腔。',
        originalExcerpt: targetText,
        startOffset: targetStart,
        endOffset: targetEnd,
        suggestedRewrite: autoRewrite,
        recommendedPhrases: recs.phrases.slice(0, 2).map((r) => r.phrase.en),
      });
    }

    // 2. Section rhetorical alignment check
    const checklist = currentSection
      ? getSectionChecklist(currentSection.mappedSectionId)
      : [];
    const isEnglish = /[a-zA-Z]{4,}/.test(targetText);
    const hasContrast = /\b(however|nevertheless|conversely|whereas|although)\b|然而|相比之下|尽管/.test(
      targetText.toLowerCase(),
    );
    const hasCitationOrEvidence = /\(\d{4}\)|\[@(?:zotero|endnote):\d+\]|\[\d+\]|表明|结果显示|研究表明/.test(
      targetText,
    );

    if (currentSection?.mappedSectionId === 'introducing-work' && !hasContrast) {
      const gapExample = isEnglish
        ? 'However, little attention has been paid to ...'
        : '然而，现有研究较少关注……，在……方面仍存在研究空白。';
      items.push({
        id: 'adv_intro_gap',
        category: 'section-structure',
        title: `【${sectionLabel}】建议显式突出研究转折与空白（Move 2）`,
        rationale:
          checklist[0] ||
          '当前段落缺少明显的转折对比信号，建议用 However / 相比之下 引出前人不足或研究生态位。',
        recommendedPhrases: [
          gapExample,
          ...recs.phrases.slice(0, 2).map((r) => r.phrase.en),
        ],
      });
    } else if (
      (currentSection?.mappedSectionId === 'reporting-results' ||
        currentSection?.mappedSectionId === 'discussing-findings') &&
      !hasCitationOrEvidence
    ) {
      items.push({
        id: 'adv_evidence_link',
        category: 'logic-cohesion',
        title: `【${sectionLabel}】强化证据支撑与文献对照`,
        rationale:
          '当前段落缺少明确的数据指标、图表引用或文献对照（如 Table X / Smith (2020)），建议补充定量或归因句型。',
        recommendedPhrases: recs.phrases.slice(0, 3).map((r) => r.phrase.en),
      });
    }

    // 3. Sentence length & cohesion check
    const sentences = targetText
      .split(/(?<=[.!?。！？])\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
    const longSentences = sentences.filter((s) => s.length > 220 || s.split(/\s+/).length > 42);
    if (longSentences.length > 0) {
      const connRow = CONNECTING_WORDS_MATRIX[1]; // Contrast
      items.push({
        id: 'adv_clarity_split',
        category: 'clarity-conciseness',
        title: '长难句拆分与连接词优化',
        rationale: `检测到 ${longSentences.length} 处超长句（超过 40 词或 220 字符），建议拆分为两个独立分句，并使用跨句连接词（如 ${connRow.acrossSentences.slice(0, 4).join(', ')}）显式标示逻辑关系。`,
        originalExcerpt: longSentences[0],
      });
    }

    // 4. Phrasebank upgrade suggestions
    if (recs.phrases.length > 0) {
      items.push({
        id: 'adv_phrase_upgrade',
        category: 'phrase-upgrade',
        title: `匹配「${sectionLabel}」的高阶学术句型推荐`,
        rationale: `结合当前上下文主题与修辞功能，可直接插入或套用以下 ${ACADEMIC_VERBS[0].verbs.length > 0 ? 'Academic Phrasebank ' : ''}标准学术表达：`,
        recommendedPhrases: recs.phrases.slice(0, 3).map((r) => r.phrase.en),
      });
    }

    const summary = `已基于「${sectionLabel}」修辞规范${preferPhrasebank ? '（优先套用 Academic Phrasebank 句式降 AI）' : ''}完成上下文诊断：共给出 ${items.length} 条可操作建议（${localIssues.length} 处局部语言规范提示）。`;
    return { summary, advice: items };
  };

  const offlineRes = buildOfflineAdvice();

  if (policy === 'disabled' || settings.aiProvider === 'offline-smart') {
    return {
      source: 'offline-smart',
      summary: offlineRes.summary,
      advice: offlineRes.advice,
      appliedSkillNames: [],
      phrasebankPriorityApplied: preferPhrasebank,
    };
  }

  const aiResult = await callAiChat({
    settings,
    policy,
    systemPrompt: [
      '你是一位精通《Manchester Academic Phrasebank》与中英文顶刊学术写作规范的审稿专家。',
      preferPhrasebank
        ? '请优先参考并自然套用 Academic Phrasebank 的标准学术句式、谨慎避险表达与正式词汇来改写，以降低 AI 率与模板化痕迹。'
        : '',
      '请结合论文章节位置与上下文，输出严格 JSON（不要 Markdown 代码块包裹或多余解释），结构为：',
      '{"summary":"一句话总评","advice":[{"title":"建议标题","category":"academic-tone|logic-cohesion|clarity-conciseness|section-structure|phrase-upgrade","rationale":"具体修改理由","suggestedRewrite":"可直接替换原文的改写结果（可选）","recommendedPhrases":["推荐的英文/中文学术句型"]}]}',
    ]
      .filter(Boolean)
      .join('\n'),
    userPrompt: [
      `当前识别章节：${currentSection?.mappedSectionLabel ?? '未知章节'} (${currentSection?.title ?? '无标题'})`,
      `已检出的基础规则问题：${localIssues.map((i) => i.title).join('；') || '无'}`,
      `待分析文本：\n${targetText.slice(0, 1800)}`,
    ].join('\n\n'),
    fallback: () => JSON.stringify(offlineRes),
  });

  if (aiResult.source === 'offline-smart') {
    return {
      source: 'offline-smart',
      summary: offlineRes.summary,
      advice: offlineRes.advice,
      appliedSkillNames: aiResult.appliedSkillNames,
      phrasebankPriorityApplied: aiResult.phrasebankPriorityApplied,
    };
  }

  try {
    const jsonMatch = aiResult.text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : aiResult.text) as {
      summary?: string;
      advice?: Array<{
        title?: string;
        category?: ContextAdviceItem['category'];
        rationale?: string;
        suggestedRewrite?: string;
        recommendedPhrases?: string[];
      }>;
    };
    const mappedAdvice: ContextAdviceItem[] = Array.isArray(parsed.advice)
      ? parsed.advice
          .filter((a) => a && (a.title || a.rationale))
          .map((a, idx) => ({
            id: `adv_ai_${idx}`,
            category: a.category ?? 'academic-tone',
            title: a.title ?? 'AI 语境建议',
            rationale: a.rationale ?? '',
            originalExcerpt: a.suggestedRewrite ? targetText : undefined,
            startOffset: a.suggestedRewrite ? targetStart : undefined,
            endOffset: a.suggestedRewrite ? targetEnd : undefined,
            suggestedRewrite: a.suggestedRewrite,
            recommendedPhrases: Array.isArray(a.recommendedPhrases)
              ? a.recommendedPhrases.slice(0, 4)
              : undefined,
          }))
      : [];

    if (mappedAdvice.length === 0) {
      return {
        source: aiResult.source,
        summary: parsed.summary || offlineRes.summary,
        advice: offlineRes.advice,
        appliedSkillNames: aiResult.appliedSkillNames,
        phrasebankPriorityApplied: aiResult.phrasebankPriorityApplied,
      };
    }

    return {
      source: aiResult.source,
      summary: parsed.summary || offlineRes.summary,
      advice: mappedAdvice,
      appliedSkillNames: aiResult.appliedSkillNames,
      phrasebankPriorityApplied: aiResult.phrasebankPriorityApplied,
    };
  } catch {
    return {
      source: aiResult.source,
      summary: offlineRes.summary,
      advice: offlineRes.advice,
      appliedSkillNames: aiResult.appliedSkillNames,
      phrasebankPriorityApplied: aiResult.phrasebankPriorityApplied,
    };
  }
}
