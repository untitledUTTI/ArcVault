import { SkeletonTemplate } from '../types';

export interface StyleRuleItem {
  id: string;
  titleCn: string;
  titleEn: string;
  explanationCn: string;
  badExample?: string;
  goodExample?: string;
}

export const ACADEMIC_STYLE_RULES: StyleRuleItem[] = [
  {
    id: 'style-1',
    titleCn: '1. 以证据为基石（Evidence-based）',
    titleEn: 'Academic writing is evidence-based',
    explanationCn: '所有论断都需依托文献归因或真实案例支撑，不能空口断言。',
    goodExample: 'Previous studies have shown that ... / According to Smith (2020), ...',
  },
  {
    id: 'style-2',
    titleCn: '2. 偏爱拉丁/希腊词源正式词汇',
    titleEn: 'High frequency of classical-origin words',
    explanationCn: '用正式单动词和拉丁词根词替代口语短语动词（如 bring together → synthesize；get rid of → eradicate）。',
    badExample: 'a lot of trouble / not much research',
    goodExample: 'considerable difficulty / little research',
  },
  {
    id: 'style-3',
    titleCn: '3. 措辞审慎（Cautious / Hedging）',
    titleEn: 'Avoid absolute certainty & over-generalization',
    explanationCn: '存在不确定性时削弱断言强度，避免被审稿人用反例推翻。',
    badExample: 'Drinking alcohol causes breast cancer.',
    goodExample: 'Some studies suggest that drinking alcohol may increase the risk of breast cancer.',
  },
  {
    id: 'style-4',
    titleCn: '4. 客观非人称（Impersonal，含学科例外）',
    titleEn: 'Normally impersonal (avoiding you; cautious with I/we)',
    explanationCn: '聚焦研究对象与过程，几乎不用 you；人文/民族志或团队科研报告（we）属常见例外。',
    badExample: 'You could say that Churchill made some catastrophic decisions.',
    goodExample: 'It can be said that Churchill made some catastrophic decisions.',
  },
  {
    id: 'style-5',
    titleCn: '5. 严禁缩写形式（No Contracted Forms）',
    titleEn: 'Avoid contractions',
    explanationCn: "正式论文中不要出现 it's, don't, isn't, aren't（仅在逐字转录访谈原话时例外）。",
    badExample: "There isn't any evidence / It's well established",
    goodExample: 'There is no evidence / It is well established',
  },
  {
    id: 'style-6',
    titleCn: '6. 适度名词化（Nominalization）',
    titleEn: 'Transform actions into noun phrases (but do not overdo)',
    explanationCn: '把动词转为名词短语可提升书面紧凑度，但连串过长名词化会牺牲可读性。',
    badExample: 'The railway opened in 1830. This brought prosperity.',
    goodExample: 'The opening of the railway in 1830 brought prosperity.',
  },
  {
    id: 'style-7',
    titleCn: '7. 避免反问句（Avoid Rhetorical Questions）',
    titleEn: 'Replace rhetorical questions with declarative statements',
    explanationCn: '不要用自问自答引入新观点（引言中正式罗列 Research Questions 除外）。',
    badExample: 'Is the welfare system good or not?',
    goodExample: 'It is important to consider the effectiveness of the welfare system.',
  },
  {
    id: 'style-8',
    titleCn: '8. 复用句型不构成抄袭的边界（Davis & Morley, 2015）',
    titleEn: 'Acceptability criteria for reusing generic academic phrases',
    explanationCn: '调研 45 位学者得出：可安全复用的模板句应满足：① 不含他人独创观点；② 非独特修辞结构；③ 长度通常不超过 9 个实词；④ 最多含 4 个通用实义词，具体领域词（如 X/Y）必须替换。',
  },
];

export interface EverydayAcademicPair {
  everyday: string;
  academic: string;
  categoryCn: string;
  noteCn?: string;
}

export const EVERYDAY_TO_ACADEMIC: EverydayAcademicPair[] = [
  { everyday: 'a lot of', academic: 'considerable / substantial', categoryCn: '原书词表', noteCn: '不可数名词前尤佳' },
  { everyday: 'big', academic: 'significant / major', categoryCn: '原书词表' },
  { everyday: 'bring together', academic: 'synthesize', categoryCn: '原书词表', noteCn: '美式拼写 -ize' },
  { everyday: 'get rid of', academic: 'eradicate / eliminate', categoryCn: '原书词表' },
  { everyday: 'not enough', academic: 'insufficient', categoryCn: '原书词表' },
  { everyday: 'story', academic: 'anecdote / narrative', categoryCn: '原书词表', noteCn: 'anecdotal evidence = 轶事证据' },
  { everyday: 'thing', academic: 'object / phenomenon / factor', categoryCn: '原书词表' },
  { everyday: 'trouble', academic: 'difficulty', categoryCn: '原书词表' },
  { everyday: 'way (of doing)', academic: 'method / approach', categoryCn: '原书词表' },
  { everyday: 'worry', academic: 'concern', categoryCn: '原书词表' },
  { everyday: 'not much research', academic: 'little research', categoryCn: '原书语法改写', noteCn: '避免口语否定句式' },
  { everyday: 'not many studies', academic: 'few studies', categoryCn: '原书语法改写', noteCn: '可数名词用 few' },
  { everyday: "isn't any evidence", academic: 'no evidence', categoryCn: '原书语法改写', noteCn: '禁止缩写 + 强学术否定' },
  { everyday: 'find out', academic: 'ascertain / determine / identify', categoryCn: '高频扩展' },
  { everyday: 'look into', academic: 'investigate / examine', categoryCn: '高频扩展' },
  { everyday: 'point out', academic: 'indicate / highlight / demonstrate', categoryCn: '高频扩展' },
  { everyday: 'make up for', academic: 'compensate for', categoryCn: '高频扩展' },
  { everyday: 'go up / go down', academic: 'increase / decline / decrease', categoryCn: '高频扩展' },
  { everyday: 'show up', academic: 'emerge / appear', categoryCn: '高频扩展' },
  { everyday: 'keep on', academic: 'persist / maintain / continue', categoryCn: '高频扩展' },
];

export interface ConnectingWordRow {
  relationEn: string;
  relationCn: string;
  acrossSentences: string[];
  beforeNounPhrase: string[];
  subordinators: string[];
  exampleAcross: string;
  exampleNounPhrase?: string;
  exampleSubordinator?: string;
}

export const CONNECTING_WORDS_MATRIX: ConnectingWordRow[] = [
  {
    relationEn: 'Addition',
    relationCn: '递进补充',
    acrossSentences: ['also', 'moreover', 'in addition', 'furthermore'],
    beforeNounPhrase: ['in addition to'],
    subordinators: [],
    exampleAcross: 'Furthermore, these findings indicate that X plays a vital role.',
    exampleNounPhrase: 'In addition to X, Y also contributed to the outcome.',
  },
  {
    relationEn: 'Adversativity',
    relationCn: '让步转折',
    acrossSentences: ['yet', 'however', 'nevertheless', 'on the other hand'],
    beforeNounPhrase: ['despite', 'in spite of'],
    subordinators: ['although', 'even though'],
    exampleAcross: 'He did not sleep very much; however, he still managed to pass the exam.',
    exampleNounPhrase: 'Despite the lack of sleep, he still managed to pass the exam.',
    exampleSubordinator: 'Even though he was unable to sleep, he still managed to pass the exam.',
  },
  {
    relationEn: 'Aspect',
    relationCn: '视角切换',
    acrossSentences: ['in this respect', 'in other respects', 'from this perspective'],
    beforeNounPhrase: [],
    subordinators: [],
    exampleAcross: 'From this perspective, the current model remains incomplete.',
  },
  {
    relationEn: 'Clarification',
    relationCn: '重述澄清',
    acrossSentences: ['that is', 'in other words'],
    beforeNounPhrase: [],
    subordinators: [],
    exampleAcross: 'In other words, X is a necessary but insufficient condition.',
  },
  {
    relationEn: 'Consequence',
    relationCn: '因果结果',
    acrossSentences: ['thus', 'hence', 'therefore', 'as a result', 'consequently'],
    beforeNounPhrase: [],
    subordinators: [],
    exampleAcross: 'Therefore, these results must be interpreted with caution.',
  },
  {
    relationEn: 'Contrast',
    relationCn: '对比反差',
    acrossSentences: ['however', 'in contrast', 'on the other hand'],
    beforeNounPhrase: ['unlike', 'in contrast to'],
    subordinators: ['while', 'whereas'],
    exampleAcross: 'In contrast, Jones (2021) reported no significant difference.',
    exampleNounPhrase: 'Unlike Smith, Jones (2021) focuses on longitudinal data.',
    exampleSubordinator: 'Oral societies focus on the present, whereas literate societies record the past.',
  },
  {
    relationEn: 'Illustration',
    relationCn: '举例说明',
    acrossSentences: ['for example', 'for instance'],
    beforeNounPhrase: [],
    subordinators: [],
    exampleAcross: 'For example, Smith (2020) conducted semi-structured interviews.',
  },
  {
    relationEn: 'Reason',
    relationCn: '原因解释',
    acrossSentences: [],
    beforeNounPhrase: ['due to', 'owing to', 'because of', 'on account of'],
    subordinators: ['as', 'since', 'because'],
    exampleAcross: '',
    exampleNounPhrase: 'This discrepancy occurred due to the small sample size.',
    exampleSubordinator: 'Because the sample was small, the results may not generalize.',
  },
  {
    relationEn: 'Sequence',
    relationCn: '逻辑顺序',
    acrossSentences: ['first', 'first of all', 'second', 'finally', 'in conclusion'],
    beforeNounPhrase: [],
    subordinators: [],
    exampleAcross: 'First, the data were normalized; second, a t-test was performed.',
  },
];

export interface ConfusedWordPair {
  id: string;
  pair: string;
  summaryCn: string;
  detailEn: string;
  example: string;
}

export const CONFUSED_WORDS: ConfusedWordPair[] = [
  {
    id: 'cw-1',
    pair: 'abbreviation / acronym',
    summaryCn: '一般缩写 vs. 首字母缩略词（拼成新词）',
    detailEn: 'Abbreviation is a shortened form (Dr., Prof.); an acronym forms a pronounceable new word from initials (NATO, UNESCO).',
    example: 'Dr. Smith works for UNESCO.',
  },
  {
    id: 'cw-2',
    pair: 'affect / effect',
    summaryCn: 'affect 常用作动词“影响”；effect 常用作名词“效应/结果”',
    detailEn: 'Affect is a verb (A affects B); Effect as a singular noun requires a determiner (an / the / this).',
    example: 'X may affect Y. / The Greenhouse Effect is well documented.',
  },
  {
    id: 'cw-3',
    pair: 'compliment / complement',
    summaryCn: 'compliment 表“称赞”；complement 表“互补/完善”',
    detailEn: 'Compliment means to praise; complement means to complete or enhance something.',
    example: "Smith's (2020) findings complement earlier quantitative studies.",
  },
  {
    id: 'cw-4',
    pair: 'comprise / consist',
    summaryCn: '两者都表“由……组成”，但只有 consist 必须搭配 of',
    detailEn: 'Both mean "to be made up of", but only consist is followed by "of" (avoid "is comprised of").',
    example: 'The sample comprises 50 students. / The sample consists of 50 students.',
  },
  {
    id: 'cw-5',
    pair: 'discrete / discreet',
    summaryCn: 'discrete 表“离散/独立”；discreet 表“言行谨慎”',
    detailEn: 'Discrete means separate or distinct; discreet means keeping silent or tactful.',
    example: 'Two discrete categories emerged from the dataset.',
  },
  {
    id: 'cw-6',
    pair: 'formerly / formally',
    summaryCn: 'formerly 表“从前”；formally 表“正式地/常规地”',
    detailEn: 'Formerly means earlier; formally means officially or conventionally.',
    example: 'X was formerly classified as Y, and has now been formally tested.',
  },
  {
    id: 'cw-7',
    pair: 'i.e. / e.g.',
    summaryCn: 'i.e. 表“即/换言之”；e.g. 表“例如”',
    detailEn: 'i.e. (id est) means "that is / in other words"; e.g. (exempli gratia) means "for example".',
    example: 'Quantitative methods (e.g., ANOVA) measure a single construct (i.e., X).',
  },
  {
    id: 'cw-8',
    pair: "its / it's",
    summaryCn: "its 为所有格“它的”；it's 为 it is/has 缩写（论文中禁用）",
    detailEn: "its is a possessive determiner; it's is a contraction of it is/it has and should be avoided in academic writing.",
    example: 'The model is limited by its reliance on self-report data.',
  },
  {
    id: 'cw-9',
    pair: 'later / latter',
    summaryCn: 'later 表时间“稍后”；latter 表前文提及两者中的“后者”',
    detailEn: 'Later is an adverb of time; latter refers to the second/last mentioned item in a list.',
    example: 'We compared X and Y; the latter proved more reliable.',
  },
  {
    id: 'cw-10',
    pair: 'practice / practise',
    summaryCn: '美式拼写名词动词均用 practice；英式名词 c 动词 s',
    detailEn: 'American English uses "practice" for both noun and verb. In British English, "practice" is a noun and "practise" is a verb.',
    example: 'In clinical practice, researchers practice evidence-based methods (US).',
  },
  {
    id: 'cw-11',
    pair: 'precede / proceed',
    summaryCn: 'precede 表“在……之前”；proceed 表“继续推进/着手进行”',
    detailEn: 'Precede means to come before; proceed means to go forward or begin carrying out.',
    example: 'The pilot phase preceded the main trial, which then proceeded as follows.',
  },
  {
    id: 'cw-12',
    pair: 'principle / principal',
    summaryCn: 'principle 表“原则/原理”（名词）；principal 表“主要的/校长”',
    detailEn: 'Principle is a noun (basic rule/theory); principal is an adjective meaning main/most important (or noun: school head).',
    example: 'The principal limitation lies in violating a core statistical principle.',
  },
  {
    id: 'cw-13',
    pair: 'there / their',
    summaryCn: 'there 表存在（There is）；their 表所有格“他们的”',
    detailEn: 'There indicates existence; their indicates possession.',
    example: 'There are two flaws in their experimental design.',
  },
  {
    id: 'cw-14',
    pair: 'prescribe / proscribe',
    summaryCn: 'prescribe 表“开处方/规定采用”；proscribe 表“明令禁止”',
    detailEn: 'Prescribe means to advise or authorize use; proscribe means to forbid or restrict.',
    example: 'The guidelines prescribe safety checks and proscribe unverified shortcuts.',
  },
];

export const EVIDENCE_COLLOCATIONS = {
  types: [
    'clinical',
    'archival',
    'indirect',
    'historical',
    'empirical',
    'statistical',
    'anecdotal',
    'supporting',
    'documentary',
    'experimental',
    'archeological',
    'observational',
    'epidemiological',
  ],
  subjects: ['The current', 'The existing', 'The available'],
  adverbs: ['very', 'quite', 'rather', 'particularly'],
  weakPredicates: ['weak.', 'flimsy.', 'limited.', 'inconsistent.', 'unconvincing.', 'controversial.'],
  strongPredicates: ['clear.', 'strong.', 'convincing.', 'persuasive.', 'compelling.', 'encouraging.'],
  premodifiersNo: ['no', 'little', 'scant', 'limited', 'insufficient'],
  premodifiersGrowing: ['some', 'growing', 'mounting', 'emerging', 'increasing', 'accumulating'],
  premodifiersStrong: ['good', 'strong', 'robust', 'ample', 'reliable', 'sufficient', 'convincing', 'widespread', 'considerable'],
  locations: ['here', 'above', 'thus far', 'up to now', 'in this paper', 'in this thesis', 'in this review'],
  verbsWithEvidence: [
    'shows that ...',
    'suggests that ...',
    'confirms that ...',
    'casts doubt on ...',
    'clearly indicates ...',
    'points to a need for ...',
    'supports the view that ...',
    'provides some support for ...',
    'raises important questions about ...',
    'highlights the important role that ...',
    'has three important policy implications.',
    'challenges our current understanding of ...',
    'indicates a need to monitor and improve ...',
  ],
};

export interface VerbCategoryGroup {
  id: string;
  labelCn: string;
  verbs: string[];
}

export const ACADEMIC_VERBS: VerbCategoryGroup[] = [
  {
    id: 'verbs-investigate',
    labelCn: '研究与分析（Investigate & Analyze）',
    verbs: [
      'analyze', 'appraise', 'ascertain', 'assess', 'calculate', 'categorize', 'classify',
      'compare', 'compute', 'conduct', 'consider', 'contrast', 'correlate', 'deduce',
      'define', 'determine', 'diagnose', 'differentiate', 'discover', 'dissect',
      'distinguish', 'document', 'elucidate', 'estimate', 'evaluate', 'examine',
      'explore', 'extrapolate', 'gauge', 'identify', 'inquire', 'inspect',
      'interpret', 'investigate', 'measure', 'observe', 'quantify', 'research',
      'review', 'survey', 'synthesize', 'tabulate', 'test', 'trace', 'verify',
    ],
  },
  {
    id: 'verbs-argue',
    labelCn: '论证、主张与引述（Argue & Report）',
    verbs: [
      'acknowledge', 'advocate', 'argue', 'assert', 'assume', 'attribute', 'caution',
      'cite', 'claim', 'clarify', 'comment', 'concede', 'conclude', 'confirm',
      'contend', 'corroborate', 'credit', 'demonstrate', 'denote', 'describe',
      'discuss', 'emphasize', 'establish', 'explain', 'express', 'highlight',
      'hypothesize', 'illustrate', 'implicate', 'imply', 'indicate', 'infer',
      'maintain', 'mention', 'note', 'outline', 'paraphrase', 'point out',
      'pose', 'postulate', 'predict', 'present', 'presume', 'propose', 'prove',
      'quote', 'recognize', 'recommend', 'refer', 'reflect', 'remark', 'report',
      'represent', 'reveal', 'show', 'signify', 'speculate', 'specify', 'state',
      'stress', 'substantiate', 'suggest', 'summarize', 'support', 'validate',
    ],
  },
  {
    id: 'verbs-critical',
    labelCn: '批判、质疑与对比（Critique & Challenge）',
    verbs: [
      'abandon', 'cast doubt on', 'challenge', 'conflict', 'confound', 'contest',
      'contradict', 'counteract', 'criticize', 'critique', 'debate', 'deny',
      'deviate', 'disagree', 'dispute', 'exclude', 'fail', 'ignore', 'lack',
      'mislead', 'negate', 'neglect', 'oppose', 'overlook', 'prohibit', 'question',
      'refuse', 'reject', 'rule out', 'skew', 'take issue with', 'underestimate', 'violate',
    ],
  },
  {
    id: 'verbs-methods',
    labelCn: '实验设计、构建与操作（Design & Execute）',
    verbs: [
      'adapt', 'administer', 'allocate', 'anonymize', 'append', 'apply', 'arrange',
      'assay', 'assemble', 'assign', 'automate', 'base on', 'code', 'collect',
      'compile', 'compose', 'conceptualize', 'configure', 'construct', 'control',
      'convert', 'coordinate', 'create', 'design', 'develop', 'devise', 'draft',
      'edit', 'employ', 'extract', 'fabricate', 'format', 'formulate', 'gather',
      'generate', 'implement', 'incorporate', 'input', 'insert', 'integrate',
      'interview', 'isolate', 'label', 'locate', 'manipulate', 'model', 'modify',
      'monitor', 'normalize', 'obtain', 'operate', 'organize', 'perform', 'plot',
      'prepare', 'process', 'recruit', 'refine', 'register', 'regulate', 'repeat',
      'replicate', 'sample', 'secure', 'select', 'separate', 'sequence', 'set up',
      'simulate', 'standardize', 'structure', 'subject to', 'subdivide', 'transcribe',
      'transfer', 'transform', 'treat', 'utilize', 'visualize',
    ],
  },
  {
    id: 'verbs-causality',
    labelCn: '因果、促进与抑制（Cause, Boost & Inhibit）',
    verbs: [
      'accelerate', 'accentuate', 'affect', 'aggravate', 'aid', 'allow', 'alter',
      'amplify', 'assist', 'benefit', 'block', 'boost', 'bring about', 'cause',
      'change', 'constrain', 'contribute', 'curtail', 'decrease', 'delay', 'depress',
      'deter', 'diminish', 'drive', 'eliminate', 'enable', 'encourage', 'enhance',
      'ensure', 'exacerbate', 'exceed', 'exert', 'facilitate', 'fluctuate', 'foster',
      'fuel', 'grow', 'heighten', 'hinder', 'impair', 'impede', 'improve', 'incline',
      'increase', 'induce', 'influence', 'inhibit', 'initiate', 'intensify', 'interact',
      'interfere', 'intervene', 'lead to', 'level off', 'limit', 'link', 'maximize',
      'mediate', 'minimize', 'moderate', 'obstruct', 'occur', 'offset', 'originate',
      'perpetuate', 'prevent', 'promote', 'prompt', 'raise', 'reduce', 'reinforce',
      'remedy', 'result from', 'result in', 'retain', 'reverse', 'rise', 'shape',
      'shift', 'shrink', 'simplify', 'solve', 'speed up', 'stimulate', 'strengthen',
      'suffer', 'suppress', 'sustain', 'tackle', 'target', 'tend', 'trigger', 'weaken',
    ],
  },
];

export interface SpellingComparison {
  british: string;
  us: string;
}

export const BRE_US_SPELLING: {
  patterns: { ruleCn: string; examples: string }[];
  pairs: SpellingComparison[];
} = {
  patterns: [
    { ruleCn: '-ise / -yse（英）→ -ize / -yze（美）', examples: 'analyse → analyze; industrialise → industrialize; summarise → summarize; organisation → organization' },
    { ruleCn: '-re（英）→ -er（美）', examples: 'centre → center; metre → meter; litre → liter' },
    { ruleCn: '-our（英）→ -or（美）', examples: 'behaviour → behavior; colour → color; rigour → rigor; endeavour → endeavor' },
    { ruleCn: '-ll- 双写与保留 e（英）→ 单 l / 去 e（美）', examples: 'travelled → traveled; modelling → modeling; skilful → skillful; programme → program' },
  ],
  pairs: [
    { british: 'aeroplane', us: 'airplane' },
    { british: 'analogue', us: 'analog' },
    { british: 'behaviour', us: 'behavior' },
    { british: 'catalogue', us: 'catalog' },
    { british: 'colour', us: 'color' },
    { british: 'connection', us: 'connexion / connection' },
    { british: 'defence', us: 'defense' },
    { british: 'dialogue', us: 'dialog' },
    { british: 'endeavour', us: 'endeavor' },
    { british: 'encyclopaedia', us: 'encyclopedia' },
    { british: 'fibre', us: 'fiber' },
    { british: 'foetus', us: 'fetus' },
    { british: 'instalment', us: 'installment' },
    { british: 'labour', us: 'labor' },
    { british: 'paediatric', us: 'pediatric' },
    { british: 'plough', us: 'plow' },
    { british: 'programme', us: 'program' },
    { british: 'rigour', us: 'rigor' },
    { british: 'sceptical', us: 'skeptical' },
    { british: 'skilful', us: 'skillful' },
    { british: 'travelled', us: 'traveled' },
  ],
};

export interface WritingNoteCard {
  id: string;
  titleCn: string;
  titleEn: string;
  bullets: { headingCn: string; detailCn: string; exampleEn?: string }[];
}

export const WRITING_NOTES_CARDS: WritingNoteCard[] = [
  {
    id: 'note-gender',
    titleCn: '性别中性语言',
    titleEn: 'Gender-Neutral Language',
    bullets: [
      {
        headingCn: '职业头衔中性化',
        detailCn: 'chairman/woman → chair/chairperson；policeman → police officer；businessman → businessperson / executive。',
      },
      {
        headingCn: '已知 vs. 未知个人代词',
        detailCn: '已知性别可用 he/she（In her analysis, Smith...）；未知或无关紧要时用单数 they/their。',
        exampleEn: 'Participant 24 commented that they had not experienced ...',
      },
      {
        headingCn: '泛指人群与人类',
        detailCn: '避免用 he or she 或 man/mankind 泛指人类，改用 person + they 或 humans / humanity / humankind。',
        exampleEn: 'It is important for a person to seek help if ... They should contact ...',
      },
    ],
  },
  {
    id: 'note-punctuation',
    titleCn: '学术标点精要',
    titleEn: 'Punctuation in Academic Writing',
    bullets: [
      {
        headingCn: '冒号（Colon :）',
        detailCn: '引出解释、复杂列表或较长直接引语。',
        exampleEn: 'The reason the experiment failed was obvious: the equipment was faulty.',
      },
      {
        headingCn: '分号（Semi-colon ;）',
        detailCn: '连接语义紧密的两个独立句子（替代句号），或分隔内部已含逗号的复杂列表项。',
        exampleEn: 'Some students prefer to write essays; others prefer to give presentations.',
      },
      {
        headingCn: '破折号（Dash –）与引号',
        detailCn: '正式学术写作尽量少用破折号，优先用冒号、分号或括号；引用嵌套时内外引号成对区分（美式常用双引号在外、单引号在内）。',
      },
    ],
  },
  {
    id: 'note-articles',
    titleCn: '冠词避坑（a / an / the）',
    titleEn: 'Article Use Rules',
    bullets: [
      {
        headingCn: '单数可数名词必须带限定词',
        detailCn: '高频易错单数可数词：system, model, method, approach, group, problem, effect, level, investigation, sector, study, participant, condition, category —— 即使前面有形容词也必须加 a/an/the！',
        exampleEn: 'a systematic approach / the control group / an exploratory investigation',
      },
      {
        headingCn: '复数可数与不可数名词',
        detailCn: '泛指时不加冠词（Learners tend to... / Reliability is...）；但若被 of... 或 which... 后置修饰特指，则需加 the。',
        exampleEn: 'The reliability of this instrument is poor. / The science of global warming...',
      },
      {
        headingCn: '机构与国家专有名词',
        detailCn: '含 of 结构或 organisation/association/institute 词时加 the：The University of Manchester, The World Health Organization。',
      },
    ],
  },
  {
    id: 'note-sentence-paragraph',
    titleCn: '句段结构与常见病句',
    titleEn: 'Sentence & Paragraph Structure',
    bullets: [
      {
        headingCn: '避坑 1：残缺从句（Fragment）',
        detailCn: '绝对不能把由 although / whereas / because 引导的从句单独加句号成句！',
        exampleEn: '✗ Whereas literate societies have awareness of the past. (缺少主句)',
      },
      {
        headingCn: '避坑 2：逗号拼接（Comma Splice）',
        detailCn: '两个完整独立分句（各有主谓）不能只用逗号相连，必须用句号、分号（;）或连词（and/but/so）。',
      },
      {
        headingCn: '黄金段落：主题句 + 支撑 + 主题链（Thematic Linking）',
        detailCn: '段首用概括性 Topic Sentence 抛出新观点，后续句子用统计/案例/文献支撑，并用代词或同义词回指前一句核心词形成语义链。',
      },
    ],
  },
  {
    id: 'note-process',
    titleCn: '学术写作八大工作法',
    titleEn: '8 Tips on the Writing Process',
    bullets: [
      { headingCn: '1. 先画路线图再动笔', detailCn: '用思维导图梳理概念关系并细化章节提纲，防止在细节中迷路。' },
      { headingCn: '2. 克服“写作卡顿”', detailCn: '给自己 4 分钟不间断自由打字（Freewriting），先产出想法再回头精修语法与逻辑。' },
      { headingCn: '3. 固定每日写作时段', detailCn: '哪怕每天只写几段初稿，让身体形成规律写作节奏远胜过憋大招。' },
      { headingCn: '4. 随身带灵感笔记本', detailCn: '散步、运动等非专注状态下常涌现最佳洞见，及时捕捉以免流失。' },
      { headingCn: '5. 接纳递归修改（Recursive）', detailCn: '学术写作不是一次性工程，而是“初稿 → 重写 → 终稿 → 编辑”的螺旋迭代。' },
      { headingCn: '6. 大声朗读自己的文字', detailCn: '朗读检查两个问题：① 我懂自己在写什么吗？② 读起来自然流畅吗？' },
      { headingCn: '7. 拉开时间距离审视全局', detailCn: '搁置几天后以“登山者退到山脚看全貌”的视角检查通往山顶的逻辑阶梯是否连贯。' },
      { headingCn: '8. 与同行交流互评', detailCn: '打破孤独写作，找写作小组互读并给出建设性反馈。' },
    ],
  },
];

export const SKELETON_TEMPLATES: SkeletonTemplate[] = [
  {
    id: 'cars-intro',
    titleCn: 'CARS 引言骨架',
    subtitleCn: 'Swales 三步走：建领地 → 找生态位 → 占生态位',
    slots: [
      { id: 'intro-territory', labelCn: 'Move 1 · 建立领地', hintCn: '主题重要性 + 已有研究共识', required: true },
      { id: 'intro-niche', labelCn: 'Move 2 · 指出生态位', hintCn: '争议 / 研究稀缺 / 前人局限 / 知识空白', required: true },
      { id: 'intro-niche-occupy', labelCn: 'Move 3 · 占据生态位', hintCn: '研究目的 + 方法概览 + 贡献 + 论文结构', required: true },
    ],
  },
  {
    id: 'abstract-5',
    titleCn: '五要素摘要骨架',
    subtitleCn: '极简高密度摘要草稿（* 为必选刚需要素）',
    slots: [
      { id: 'abs-bg', labelCn: '1. 背景 / 空白', hintCn: '可选 1 句点明重要性或研究缺口' },
      { id: 'abs-aim', labelCn: '2. 研究目的 *', hintCn: '必选：The aim of this study was to...', required: true },
      { id: 'abs-method', labelCn: '3. 方法简述', hintCn: '样本、设计与分析手段' },
      { id: 'abs-findings', labelCn: '4. 关键发现 *', hintCn: '必选：核心数据或主要结论', required: true },
      { id: 'abs-value', labelCn: '5. 启示与价值', hintCn: '对学界或实践的意义' },
    ],
  },
  {
    id: 'lit-review',
    titleCn: '文献综述对话骨架',
    subtitleCn: '总体脉络 → 专题述评 → 交叉综合 → 收拢空白',
    slots: [
      { id: 'lit-overview', labelCn: '领域总体与演进', hintCn: '文献体量、历史节点与主要研究范式' },
      { id: 'lit-thematic', labelCn: '关键研究引述', hintCn: '里程碑文献、学者观点与实证细节' },
      { id: 'lit-synthesis', labelCn: '支持与对立综合', hintCn: '谁印证了谁，谁与谁相冲突' },
      { id: 'lit-gap-summary', labelCn: '综述小结与过渡', hintCn: '指出遗留盲区并引出本研究', required: true },
    ],
  },
  {
    id: 'discussion-cycle',
    titleCn: '结果讨论循环骨架',
    subtitleCn: '重述发现 → 文献对照 → 谨慎归因 → 启示展望',
    slots: [
      { id: 'disc-cycle', labelCn: '重述核心发现', hintCn: '回扣研究问题，点出是否符合预期', required: true },
      { id: 'disc-compare', labelCn: '文献印证/反驳', hintCn: '与前人结果一致或矛盾之处' },
      { id: 'disc-explain', labelCn: '谨慎解释与局限', hintCn: '用 may/might 归因并提示审慎解读' },
      { id: 'disc-implications', labelCn: '启示与未来工作', hintCn: '理论假设、应用意义与后续方向' },
    ],
  },
  {
    id: 'conclusion-draft',
    titleCn: '结论段骨架',
    subtitleCn: '回扣目的 → 贡献 → 平衡局限 → 建议',
    slots: [
      { id: 'conc-recap', labelCn: '回扣目的与主发现', hintCn: '首尾呼应解答核心问题' },
      { id: 'conc-contribution', labelCn: '原创贡献与启示', hintCn: '明确增加的新知识或新模型' },
      { id: 'conc-limits', labelCn: '优势与让步局限', hintCn: 'Notwithstanding limitations...' },
      { id: 'conc-future', labelCn: '政策/实践与未来研究', hintCn: '落地建议与下一步方向' },
    ],
  },
  {
    id: 'free-draft',
    titleCn: '自由拼接草稿',
    subtitleCn: '无固定槽位限制，随手收集备选句',
    slots: [
      { id: 'general', labelCn: '草稿区', hintCn: '收集的所有句子将按顺序排列于此' },
    ],
  },
];
