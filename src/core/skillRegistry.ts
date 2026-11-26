import type { AiSkill, SkillCategory, SkillTaskType } from '../types/archive';

export interface SkillCategoryMeta {
  id: SkillCategory;
  labelZh: string;
  labelEn: string;
}

export const SKILL_CATEGORY_META: SkillCategoryMeta[] = [
  { id: 'de-ai', labelZh: '学术降AI', labelEn: 'De-AI' },
  { id: 'academic', labelZh: '学术润色', labelEn: 'Academic' },
  { id: 'rebuttal', labelZh: '返修沟通', labelEn: 'Rebuttal' },
  { id: 'formatting', labelZh: '排版守护', labelEn: 'Formatting' },
  { id: 'custom', labelZh: '自定义/载入', labelEn: 'Custom' },
];

export const BUILTIN_SKILLS: AiSkill[] = [
  {
    id: 'skill_academic_humanizer',
    slug: 'academic-humanizer',
    name: 'Academic Humanizer（学术降 AI 专项）',
    description:
      '来自开源项目 AIScientists-Dev/academic-humanizer（完整原版按需懒加载）：优化学术论文与基金申请书的表达清晰度与学者语感，严格保留数据与引文。',
    category: 'de-ai',
    language: 'zh-en',
    enabled: false,
    source: 'builtin',
    hasFullSource: true,
    origin: 'AIScientists-Dev/academic-humanizer (MIT · On-Demand)',
    tags: ['academic-humanizer', '学术降AI', '按需加载原文'],
    instructions: [
      'Lightweight Registry Summary (Full AIScientists-Dev/academic-humanizer SKILL.md loads on demand):',
      '- Improve clarity and scholarly voice of AI-assisted academic papers, theses, rebuttals, and grant proposals.',
      '- Match claims to evidence and preserve every number, result, citation, and LaTeX math delimiter.',
    ].join('\n'),
  },
  {
    id: 'skill_anti_defensive_writing',
    slug: 'anti-defensive-writing',
    name: 'Anti-Defensive Writing（去防御性写作 · 中文版）',
    description:
      '来自开源项目 Adkid-Zephyr/anti-defensive-writing-Skill 中文版（完整原版按需懒加载）：以「学术发布会原则」构建有利、完整、有说服力的论文叙事。',
    category: 'de-ai',
    language: 'zh',
    enabled: false,
    source: 'builtin',
    hasFullSource: true,
    origin: 'Adkid-Zephyr/anti-defensive-writing-Skill (MIT · 中文版 · On-Demand)',
    tags: ['anti-defensive-writing', '中文版', '按需加载原文'],
    instructions: [
      'Lightweight Registry Summary (Full Chinese anti-defensive-writing SKILL.md loads on demand):',
      '- 论文是一场学术发布会，而不是实验日志或自我审查报告；围绕最值得发表的核心价值建立有力叙事，避免主动示弱与过度防御性对冲。',
    ].join('\n'),
  },
  {
    id: 'skill_anti_defensive_writing_en',
    slug: 'anti-defensive-writing-en',
    name: 'Anti-Defensive Writing (English Edition)',
    description:
      'English edition from Adkid-Zephyr/anti-defensive-writing-Skill (full SKILL.md loaded on demand): applies the Press-Release Principle across paper writing and rebuttal.',
    category: 'de-ai',
    language: 'en',
    enabled: false,
    source: 'builtin',
    hasFullSource: true,
    origin: 'Adkid-Zephyr/anti-defensive-writing-Skill (MIT · English · On-Demand)',
    tags: ['anti-defensive-writing', 'English', '按需加载原文'],
    instructions: [
      'Lightweight Registry Summary (Full English anti-defensive-writing-en SKILL.md loads on demand):',
      '- Treat a paper as a press conference rather than a lab log or self-audit; build a persuasive narrative around the strongest contribution.',
    ].join('\n'),
  },
  {
    id: 'skill_humanizer',
    slug: 'humanizer',
    name: 'Humanizer（去 AI 味通用精修）',
    description:
      '来自开源项目 blader/humanizer（完整原版按需懒加载），系统消除 24 类 AI 写作痕迹与机械排比。',
    category: 'de-ai',
    language: 'zh-en',
    enabled: false,
    source: 'builtin',
    hasFullSource: true,
    origin: 'blader/humanizer (MIT · On-Demand)',
    tags: ['blader/humanizer', 'Wikipedia规则', '按需加载原文'],
    instructions: [
      'Lightweight Registry Summary (Full 24-pattern blader/humanizer SKILL.md loads on demand at execution time):',
      '- Remove staging/not-X-but-Y contrasts, one-line closers, forced triads, em-dash overuse, inflated claims, stock AI vocabulary, and chatbot meta-talk.',
      '- Preserve facts, numbers, citations, and natural human voice.',
    ].join('\n'),
  },
  {
    id: 'skill_humanizer_zh',
    slug: 'humanizer-zh',
    name: 'Humanizer-zh（中文去 AI 味精修）',
    description:
      '来自开源项目 op7418/Humanizer-zh（完整原版按需懒加载）：编辑中文文章与学术文档中的空话、重复、翻译腔及模板化表达。',
    category: 'de-ai',
    language: 'zh',
    enabled: false,
    source: 'builtin',
    hasFullSource: true,
    origin: 'op7418/Humanizer-zh (MIT · On-Demand)',
    tags: ['Humanizer-zh', '中文润色', '按需加载原文'],
    instructions: [
      'Lightweight Registry Summary (Full op7418/Humanizer-zh SKILL.md loads on demand):',
      '- 清除中文文本中的空话、重复、长定语翻译腔与模板化表达，保留事实、确定程度与作者原有声音。',
    ].join('\n'),
  },
  {
    id: 'skill_peer_review_rebuttal_pro',
    slug: 'peer-review-rebuttal-pro',
    name: '审稿返修大师（Peer-Review Rebuttal Pro）',
    description:
      '优化审稿人与导师返修回复：不卑不亢、先给明确结论与改动定位，杜绝虚浮奉承与对抗式辩解。',
    category: 'rebuttal',
    language: 'zh-en',
    enabled: false,
    source: 'builtin',
    origin: 'Built-in Curated · Top-Venue Rebuttal Protocol',
    tags: ['Rebuttal', '审稿回复', '导师返修'],
    instructions: [
      '1. Answer-First Structure: Start each point with a concise direct decision/action ("We agree and added...", "Thank you — we have clarified Section X lines Y–Z"), followed immediately by concrete quoted changes or experimental numbers.',
      '2. Anti-Sycophancy & Non-Defensive Tone: Express brief gratitude once without exaggerated praise ("Thank you for your brilliant/monumental comment"); when disagreeing or scoping out an extra experiment, argue neutrally using existing data or physical constraints.',
      '3. Traceable Evidence: Always preserve before/after snippet comparisons and exact section/table anchors so reviewers can verify fixes in seconds.',
    ].join('\n'),
  },
  {
    id: 'skill_latex_citation_guardian',
    slug: 'latex-citation-guardian',
    name: 'LaTeX 公式与引文域无损守护',
    description:
      '强约束保护 [@zotero:NNN]、[@endnote:NNN]、$...$ / $$...$$ 公式及 \\ref{}/\\cite{} 语法完整不被破坏。',
    category: 'formatting',
    language: 'zh-en',
    enabled: false,
    source: 'builtin',
    origin: 'Built-in Curated · ArcVault Integrity Guard',
    tags: ['LaTeX', 'Zotero引文', '格式锁定'],
    instructions: [
      '1. Strict Token Preservation: Copy every citation token ([@zotero:NNN], [@endnote:NNN], \\cite{...}, \\ref{...}) character-for-character without translating, renumbering, or dropping them.',
      '2. Math & Table Fence Integrity: Keep all inline ($...$), display ($$...$$), \\begin{...} environments, and Markdown table column alignments intact; never alter symbols or variable casing inside math delimiters.',
      '3. Keep Term Casing Consistent: Preserve domain acronyms (e.g., CAS, WebGL2, OOXML) consistently across headings, prose, and captions.',
    ].join('\n'),
  },
];

function slugifySkillName(input: string): string {
  const ascii = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (ascii.length >= 2) return ascii.slice(0, 48);
  return `custom-skill-${Date.now().toString(36)}`;
}

function normalizeCategory(raw: string | undefined): SkillCategory {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'de-ai' || v === 'humanizer' || v === 'aigc') return 'de-ai';
  if (v === 'academic' || v === 'writing' || v === 'polish') return 'academic';
  if (v === 'rebuttal' || v === 'review') return 'rebuttal';
  if (v === 'formatting' || v === 'latex' || v === 'format') return 'formatting';
  if (v === 'custom' || v === 'imported') return 'custom';
  return 'custom';
}

function normalizeLanguage(raw: string | undefined): AiSkill['language'] {
  const v = (raw ?? '').trim().toLowerCase();
  if (v === 'zh' || v === 'zh-cn' || v === 'chinese') return 'zh';
  if (v === 'en' || v === 'en-us' || v === 'english') return 'en';
  return 'zh-en';
}

/**
 * Merges persisted user skills with the built-in curated library, keeping user toggles
 * and imported/custom skills intact while backfilling any newly added built-ins.
 */
export function resolveMergedSkills(saved?: AiSkill[]): AiSkill[] {
  if (!saved || saved.length === 0) {
    return BUILTIN_SKILLS.map((s) => ({ ...s }));
  }

  const savedByKey = new Map<string, AiSkill>();
  for (const item of saved) {
    savedByKey.set(item.id, item);
    savedByKey.set(item.slug, item);
  }

  const mergedBuiltins = BUILTIN_SKILLS.map((builtin) => {
    const match = savedByKey.get(builtin.id) ?? savedByKey.get(builtin.slug);
    if (!match) return { ...builtin };
    return {
      ...builtin,
      enabled: Boolean(match.enabled),
    };
  });

  const builtinIds = new Set(BUILTIN_SKILLS.map((b) => b.id));
  const builtinSlugs = new Set(BUILTIN_SKILLS.map((b) => b.slug));

  const userExtras = saved
    .filter((item) => !builtinIds.has(item.id) && !builtinSlugs.has(item.slug))
    .map((item) => ({
      ...item,
      source: item.source === 'builtin' ? ('custom' as const) : item.source,
    }));

  return [...mergedBuiltins, ...userExtras];
}

export function getEnabledSkills(skills?: AiSkill[]): AiSkill[] {
  return resolveMergedSkills(skills).filter((s) => s.enabled);
}

/**
 * Parses uploaded Skill files in YAML-frontmatter SKILL.md, plain Markdown/TXT, or JSON format.
 */
export function parseSkillFileContent(content: string, fileName: string): AiSkill[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const lower = fileName.toLowerCase();
  const baseStem = fileName.replace(/\.[^.]+$/, '') || 'imported-skill';
  const nowIso = new Date().toISOString();

  // 1. JSON format (single object or array of skills)
  if (lower.endsWith('.json') || trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      const list = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { skills?: unknown }).skills)
          ? (parsed as { skills: unknown[] }).skills
          : [parsed];

      const out: AiSkill[] = [];
      for (const raw of list) {
        if (!raw || typeof raw !== 'object') continue;
        const obj = raw as Record<string, unknown>;
        const instructions = String(
          obj.instructions ?? obj.prompt ?? obj.systemPrompt ?? obj.content ?? '',
        ).trim();
        const name = String(obj.name ?? obj.title ?? obj.slug ?? baseStem).trim();
        if (!instructions) continue;
        const slug = slugifySkillName(String(obj.slug ?? name));
        out.push({
          id: `skill_imp_${slug}_${Date.now().toString(36)}_${out.length}`,
          slug,
          name,
          description:
            String(obj.description ?? '').trim() ||
            instructions.split(/\r?\n/)[0].slice(0, 90),
          category: normalizeCategory(typeof obj.category === 'string' ? obj.category : undefined),
          language: normalizeLanguage(typeof obj.language === 'string' ? obj.language : undefined),
          instructions,
          enabled: obj.enabled === undefined ? true : Boolean(obj.enabled),
          source: 'imported',
          origin: typeof obj.origin === 'string' ? obj.origin : `导入文件：${fileName}`,
          tags: Array.isArray(obj.tags) ? obj.tags.map(String) : ['已载入'],
          fileName,
          createdAt: nowIso,
        });
      }
      if (out.length > 0) return out;
    } catch {
      // Fall through to Markdown parser if JSON parse fails
    }
  }

  // 2. SKILL.md with YAML frontmatter
  const fmMatch = trimmed.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (fmMatch) {
    const yamlBlock = fmMatch[1];
    const body = fmMatch[2].trim();
    const meta: Record<string, string> = {};

    for (const line of yamlBlock.split(/\r?\n/)) {
      const kv = line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.+?)\s*$/);
      if (kv) {
        meta[kv[1].toLowerCase()] = kv[2].replace(/^['"]|['"]$/g, '').trim();
      }
    }

    const name = meta.name || meta.title || baseStem;
    const slug = slugifySkillName(meta.slug || name);
    const description =
      meta.description ||
      body.split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith('#'))?.trim().slice(0, 100) ||
      `从 ${fileName} 载入的 Skill 规则`;
    const tags = meta.tags
      ? meta.tags
          .replace(/^\[|\]$/g, '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean)
      : ['SKILL.md'];

    return [
      {
        id: `skill_imp_${slug}_${Date.now().toString(36)}`,
        slug,
        name,
        description,
        category: normalizeCategory(meta.category),
        language: normalizeLanguage(meta.language),
        instructions: body || description,
        enabled: true,
        source: 'imported',
        origin: meta.origin || `导入文件：${fileName}`,
        tags,
        fileName,
        createdAt: nowIso,
      },
    ];
  }

  // 3. Plain Markdown / TXT skill file
  const lines = trimmed.split(/\r?\n/);
  const headingLine = lines.find((l) => /^#\s+/.test(l.trim()));
  const derivedName = headingLine
    ? headingLine.replace(/^#\s+/, '').trim()
    : baseStem;
  const firstBodyLine =
    lines.find((l) => l.trim() && !l.trim().startsWith('#'))?.trim() ??
    `从 ${fileName} 载入的自定义规则`;

  return [
    {
      id: `skill_imp_${slugifySkillName(derivedName)}_${Date.now().toString(36)}`,
      slug: slugifySkillName(derivedName),
      name: derivedName,
      description: firstBodyLine.slice(0, 100),
      category: 'custom',
      language: 'zh-en',
      instructions: trimmed,
      enabled: true,
      source: 'imported',
      origin: `导入文件：${fileName}`,
      tags: ['已载入'],
      fileName,
      createdAt: nowIso,
    },
  ];
}

export function exportSkillAsMarkdown(skill: AiSkill): string {
  const tagsLine =
    skill.tags && skill.tags.length > 0 ? `[${skill.tags.join(', ')}]` : '[custom]';
  return [
    '---',
    `name: ${skill.name}`,
    `slug: ${skill.slug}`,
    `description: ${skill.description}`,
    `category: ${skill.category}`,
    `language: ${skill.language}`,
    `origin: ${skill.origin ?? 'ArcVault Custom Skill'}`,
    `tags: ${tagsLine}`,
    '---',
    '',
    skill.instructions.trim(),
    '',
  ].join('\n');
}

/**
 * Strips YAML frontmatter from a SKILL.md document so only executable instructions remain.
 */
function stripSkillFrontmatter(raw: string): string {
  const trimmed = raw.trim();
  const fmMatch = trimmed.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  return (fmMatch ? fmMatch[1] : trimmed).trim();
}

const fullSkillSourceCache = new Map<string, string>();

const LAZY_BUILTIN_SKILL_LOADERS: Record<string, () => Promise<{ default: string }>> = {
  'academic-humanizer': () => import('./skills/academic-humanizer.SKILL.md?raw'),
  'anti-defensive-writing': () => import('./skills/anti-defensive-writing-zh.SKILL.md?raw'),
  'anti-defensive-writing-en': () => import('./skills/anti-defensive-writing-en.SKILL.md?raw'),
  humanizer: () => import('./skills/blader-humanizer.SKILL.md?raw'),
  'humanizer-zh': () => import('./skills/humanizer-zh.SKILL.md?raw'),
};

/**
 * Loads the full Skill instructions on demand (lazy-loaded & cached in memory)
 * so heavy SKILL.md documents never sit permanently in settings or base context.
 */
export async function loadSkillFullInstructions(skill: AiSkill): Promise<string> {
  if (skill.source === 'builtin' && skill.hasFullSource) {
    const cached = fullSkillSourceCache.get(skill.slug);
    if (cached) return cached;
    const loader = LAZY_BUILTIN_SKILL_LOADERS[skill.slug];
    if (loader) {
      try {
        const mod = await loader();
        const body = stripSkillFrontmatter(mod.default);
        if (body) {
          fullSkillSourceCache.set(skill.slug, body);
          return body;
        }
      } catch {
        // Fall back to lightweight registry summary if chunk load fails
      }
    }
  }
  return skill.instructions.trim();
}

const TASK_CATEGORY_ALLOWLIST: Record<SkillTaskType, Set<SkillCategory> | null> = {
  summary: new Set(),
  consistency: new Set(['formatting', 'academic', 'custom']),
  rewrite: new Set(['de-ai', 'academic', 'formatting', 'custom']),
  rebuttal: new Set(['rebuttal', 'academic', 'de-ai', 'formatting', 'custom']),
  general: null,
};

/**
 * Filters enabled skills by task relevance so unrelated full Skills
 * (e.g. 33KB humanizer during a diff summary or consistency check) are not injected.
 */
export function selectRelevantSkillsForTask(
  enabledSkills: AiSkill[],
  taskType: SkillTaskType = 'general',
): AiSkill[] {
  const allowlist = TASK_CATEGORY_ALLOWLIST[taskType];
  if (allowlist === null) return enabledSkills;
  if (allowlist.size === 0) return [];
  return enabledSkills.filter((s) => allowlist.has(s.category));
}

/**
 * Synchronously appends enabled Skill summaries/instructions to the system prompt.
 * Prefer `composeSystemPromptWithSkillsAsync` for runtime AI calls so full SKILL.md
 * sources are loaded on demand and filtered by task relevance.
 */
export function composeSystemPromptWithSkills(
  baseSystemPrompt: string,
  skills?: AiSkill[],
): { systemPrompt: string; appliedSkills: AiSkill[] } {
  const appliedSkills = getEnabledSkills(skills);
  if (appliedSkills.length === 0) {
    return { systemPrompt: baseSystemPrompt, appliedSkills: [] };
  }

  const skillSections = appliedSkills.map(
    (s, idx) =>
      `### Skill ${idx + 1}: ${s.name} [${s.slug}]\n${s.instructions.trim()}`,
  );

  const combined = [
    baseSystemPrompt.trim(),
    '',
    '[ACTIVE SKILLS — MANDATORY EXECUTION]',
    'You MUST strictly satisfy ALL active Skill rules below on this request without exception:',
    ...skillSections,
  ].join('\n');

  return { systemPrompt: combined, appliedSkills };
}

/**
 * Progressive Skill Loader:
 * 1. Keeps only lightweight skill registry metadata in settings.
 * 2. Selects enabled skills relevant to `taskType`.
 * 3. Lazy-loads full SKILL.md instructions on demand only for those selected skills.
 */
export async function composeSystemPromptWithSkillsAsync(
  baseSystemPrompt: string,
  skills?: AiSkill[],
  taskType: SkillTaskType = 'general',
): Promise<{ systemPrompt: string; appliedSkills: AiSkill[] }> {
  const enabled = getEnabledSkills(skills);
  const appliedSkills = selectRelevantSkillsForTask(enabled, taskType);
  if (appliedSkills.length === 0) {
    return { systemPrompt: baseSystemPrompt, appliedSkills: [] };
  }

  const fullTexts = await Promise.all(
    appliedSkills.map((s) => loadSkillFullInstructions(s)),
  );

  const skillSections = appliedSkills.map(
    (s, idx) => `### Skill ${idx + 1}: ${s.name} [${s.slug}]\n${fullTexts[idx]}`,
  );

  const combined = [
    baseSystemPrompt.trim(),
    '',
    '[ACTIVE SKILLS — ON-DEMAND FULL EXECUTION]',
    'You MUST strictly satisfy ALL task-relevant Skill rules below on this request without exception:',
    ...skillSections,
  ].join('\n');

  return { systemPrompt: combined, appliedSkills };
}

/**
 * Deterministic rule-based pass for offline-smart mode so enabling de-AI /
 * anti-defensive / concise skills visibly refines offline fallback output while
 * keeping protected citation placeholders and LaTeX math delimiters untouched.
 */
export function applyOfflineSkillsToText(
  text: string,
  appliedSkills: AiSkill[],
): string {
  if (!text || appliedSkills.length === 0) return text;

  const slugs = new Set(appliedSkills.map((s) => s.slug));
  const cats = new Set(appliedSkills.map((s) => s.category));
  const useDeAi =
    cats.has('de-ai') ||
    slugs.has('academic-humanizer') ||
    slugs.has('humanizer') ||
    slugs.has('humanizer-zh');
  const useAntiDefensive =
    slugs.has('anti-defensive-writing') || slugs.has('anti-defensive-writing-en');

  if (!useDeAi && !useAntiDefensive) {
    return text;
  }

  // Shield protected citations and LaTeX math spans before rewriting
  const shields: string[] = [];
  const shieldToken = (raw: string): string => {
    const id = `__ARC_SHIELD_${shields.length}__`;
    shields.push(raw);
    return id;
  };

  let work = text
    .replace(/\[@(?:zotero|endnote):\d{3}\]/g, (m) => shieldToken(m))
    .replace(/\$\$[\s\S]+?\$\$/g, (m) => shieldToken(m))
    .replace(/\$[^$\n]+?\$/g, (m) => shieldToken(m));

  if (useDeAi) {
    work = work
      .replace(/值得(?:特别)?(?:指出|注意|一提)的是[，,、：:\s]*/g, '')
      .replace(/需要(?:特别)?(?:指出|说明)的是[，,、：:\s]*/g, '')
      .replace(/综上所述[，,、：:\s]*/g, '')
      .replace(/总而言之[，,、：:\s]*/g, '')
      .replace(/显而易见的是[，,、：:\s]*/g, '')
      .replace(/毋庸置疑[，,、：:\s]*/g, '')
      .replace(/毫无疑问[，,、：:\s]*/g, '')
      .replace(/从而为.*?奠定了坚实基础/g, '')
      .replace(/\bIt is worth noting that\s+/gi, '')
      .replace(/\bIn conclusion,\s*/gi, '')
      .replace(/\bFurthermore,\s*/gi, 'In addition, ')
      .replace(/\bMoreover,\s*/gi, 'Also, ')
      .replace(/\bdelve(?:s|d)? into\b/gi, 'examine')
      .replace(/\bplays a (?:crucial|pivotal|vital) role in\b/gi, 'shapes');
  }

  if (useAntiDefensive) {
    work = work
      .replace(/(?:在)?一定程度上(?:或许|可能)?(?:可以)?(?:认为)?/g, '')
      .replace(/从某种意义上来看[，,\s]*/g, '')
      .replace(/一般而言往往/g, '通常')
      .replace(/\bIt could potentially be argued that\s+/gi, '')
      .replace(/\bmay perhaps\b/gi, 'may')
      .replace(/\bmight possibly\b/gi, 'can')
      .replace(/\bin order to\b/gi, 'to')
      .replace(/\bthe fact that\b/gi, 'that');
  }

  // Normalize accidental double spaces / leading punctuation left by phrase removals
  work = work
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/^[，,、\s]+/gm, '')
    .replace(/([。；！？])\s*[，,]+/g, '$1');

  // Restore shielded tokens verbatim
  work = work.replace(/__ARC_SHIELD_(\d+)__/g, (_, idxStr) => {
    const idx = Number(idxStr);
    return shields[idx] ?? '';
  });

  return work.trim();
}
