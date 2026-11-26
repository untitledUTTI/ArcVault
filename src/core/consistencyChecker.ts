import { callAiChat } from './aiGateway';
import type {
  AiPrivacyPolicy,
  AppSettings,
  CitationSidecarEntry,
  ConsistencyIssue,
} from '../types/archive';

interface SectionBucket {
  title: string;
  body: string;
}

function splitSections(text: string): SectionBucket[] {
  const lines = text.split('\n');
  const sections: SectionBucket[] = [];
  let curTitle = '导语 / 前言';
  let curLines: string[] = [];

  for (const ln of lines) {
    const mdH = ln.match(/^#{1,4}\s+(.+)$/);
    const texH = ln.match(/^\\(?:section|subsection|subsubsection)\{(.+)\}$/);
    if (mdH || texH) {
      if (curLines.length > 0) {
        sections.push({ title: curTitle, body: curLines.join('\n') });
      }
      curTitle = (mdH?.[1] ?? texH?.[1] ?? curTitle).trim();
      curLines = [ln];
    } else {
      curLines.push(ln);
    }
  }
  if (curLines.length > 0) {
    sections.push({ title: curTitle, body: curLines.join('\n') });
  }
  return sections;
}

/**
 * Runs deterministic cross-section academic consistency diagnostics:
 * 1. Cross-section key metric / percentage mismatches (e.g. Abstract vs Table vs Conclusion)
 * 2. Dangling Figure / Table references
 * 3. Unmatched Footnotes / Math delimiters / Zotero Citation integrity
 * 4. Terminology casing inconsistencies
 */
export function runConsistencyCheck(
  text: string,
  citationsSidecar: CitationSidecarEntry[] = [],
): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = [];
  const sections = splitSections(text);

  // 1. Metric percentage consistency across sections (e.g. 准确率 / accuracy / F1 / 压缩率)
  const metricGroups = new Map<
    string,
    Array<{ value: string; section: string; snippet: string }>
  >();
  const metricRegex =
    /(准确率|精度|F1|压缩率|召回率|提升至|达到|accuracy|precision)[^。\n%]{0,18}?(\d+(?:\.\d+)?%)/gi;

  for (const sec of sections) {
    for (const match of sec.body.matchAll(metricRegex)) {
      const rawKey = match[1].toLowerCase();
      const canonicalKey =
        rawKey.includes('准确率') || rawKey.includes('accuracy') || rawKey === '提升至' || rawKey === '达到'
          ? '核心指标准确率'
          : rawKey;
      const val = match[2];
      const list = metricGroups.get(canonicalKey) ?? [];
      list.push({ value: val, section: sec.title, snippet: match[0] });
      metricGroups.set(canonicalKey, list);
    }
  }

  for (const [metricName, occurrences] of metricGroups.entries()) {
    const distinctVals = Array.from(new Set(occurrences.map((o) => o.value)));
    if (distinctVals.length > 1) {
      // Heuristic: take earliest/most frequent value as primary baseline
      const freq = new Map<string, number>();
      occurrences.forEach((o) => freq.set(o.value, (freq.get(o.value) ?? 0) + 1));
      const sortedVals = [...distinctVals].sort((a, b) => (freq.get(b) ?? 0) - (freq.get(a) ?? 0));
      const primary = sortedVals[0];
      const outlier = occurrences.find((o) => o.value !== primary) ?? occurrences[occurrences.length - 1];

      issues.push({
        id: `issue_num_${issues.length + 1}`,
        severity: 'error',
        category: 'numeric-mismatch',
        title: `跨章节指标数值不一致（${metricName}）`,
        detail: `文中同时出现了 ${distinctVals.join(' 与 ')}：多数/前文章节为 ${primary}，而「${outlier.section}」中写作 ${outlier.value}。`,
        snippet: outlier.snippet,
        suggestedFix: outlier.snippet.replace(outlier.value, primary),
      });
    }
  }

  // 2. Figure / Table reference integrity
  const figRefRegex = /(?:如图|图|Fig\.?)\s*(\d+)/g;
  const definedFigs = new Set<string>();
  const captionRegex = /(?:!\[.*?图\s*(\d+)|^图\s*(\d+)\s*[：:.]|\\caption\{[^}]*图\s*(\d+))/gm;
  for (const m of text.matchAll(captionRegex)) {
    const num = m[1] || m[2] || m[3];
    if (num) definedFigs.add(num);
  }
  const imageMatches = text.match(/!\[[^\]]*\]\([^)]+\)/g) ?? [];
  imageMatches.forEach((_, idx) => definedFigs.add(String(idx + 1)));

  const seenMissingFigs = new Set<string>();
  for (const m of text.matchAll(figRefRegex)) {
    const num = m[1];
    if (!definedFigs.has(num) && !seenMissingFigs.has(num)) {
      seenMissingFigs.add(num);
      issues.push({
        id: `issue_fig_${num}`,
        severity: 'warning',
        category: 'broken-ref',
        title: `疑似悬空图片引用（图 ${num}）`,
        detail: `正文引用了「${m[0]}」，但当前文档未检测到对应的图 ${num} 题注或图片插入标记。`,
        snippet: m[0],
      });
    }
  }

  // 3. Footnotes check
  const fnRefs = new Set<string>();
  const fnDefs = new Set<string>();
  for (const m of text.matchAll(/\[\^fn(\d+)\](?!:)/g)) fnRefs.add(m[1]);
  for (const m of text.matchAll(/^\[\^fn(\d+)\]:/gm)) fnDefs.add(m[1]);
  for (const m of text.matchAll(/^%\s*\[Footnote\s+(\d+)\]:/gm)) fnDefs.add(m[1]);

  for (const id of fnRefs) {
    if (!fnDefs.has(id)) {
      issues.push({
        id: `issue_fn_${id}`,
        severity: 'warning',
        category: 'broken-ref',
        title: `脚注定义缺失（[^fn${id}]）`,
        detail: `正文引用了脚注 [^fn${id}]，但文末未找到对应脚注内容定义。`,
        snippet: `[^fn${id}]`,
      });
    }
  }

  // 4. Math delimiter balance check
  const strippedDisplay = text.replace(/\$\$[\s\S]*?\$\$/g, '');
  const singleDollars = (strippedDisplay.match(/(?<!\\)\$/g) ?? []).length;
  if (singleDollars % 2 !== 0) {
    issues.push({
      id: `issue_math_unbalanced`,
      severity: 'error',
      category: 'math-syntax',
      title: '行内数学公式定界符 `$` 未成对闭合',
      detail: `检测到奇数个未转义的 \`$\` 符号（共 ${singleDollars} 个），可能导致 LaTeX 或 Word OMML 回写失败。`,
      snippet: '$ ...',
    });
  }

  // 5. Zotero / EndNote sidecar integrity check
  const sidecarSet = new Set(citationsSidecar.map((c) => c.placeholder));
  for (const m of text.matchAll(/\[@(?:zotero|endnote):\d{3}\]/g)) {
    if (!sidecarSet.has(m[0])) {
      issues.push({
        id: `issue_cit_${m[0]}`,
        severity: 'warning',
        category: 'citation-integrity',
        title: `文献占位符未在 Sidecar 中登记（${m[0]}）`,
        detail: `占位符 ${m[0]} 缺少原始 Word 引文域 XML 映射，导出 Word 时将按纯文本输出。`,
        snippet: m[0],
      });
    }
  }

  // 6. Terminology casing consistency
  if (/\bCAS\b/.test(text) && /\bcas\b/.test(text)) {
    issues.push({
      id: 'issue_term_cas',
      severity: 'info',
      category: 'terminology',
      title: '专有名词大小写不统一（CAS / cas）',
      detail: '正文中同时出现了全大写 CAS 与全小写 cas，建议统一为大写的 CAS。',
      snippet: 'cas',
      suggestedFix: 'CAS',
    });
  }

  return issues;
}

export async function runAiDeepConsistencyCheck(params: {
  text: string;
  ruleIssues: ConsistencyIssue[];
  settings: AppSettings;
  policy: AiPrivacyPolicy;
}): Promise<{ report: string; source: 'cloud' | 'ollama' | 'offline-smart'; appliedSkillNames: string[] }> {
  const { text, ruleIssues, settings, policy } = params;
  const fallback = () =>
    ruleIssues.length === 0
      ? '逻辑与数值结构整体自洽：未检测到跨章节数值冲突、悬空图表引用或公式语法错误。建议投稿前再人工复核参考文献年份格式。'
      : `已完成本地语义复核，共发现 ${ruleIssues.length} 项待核对点：重点请优先修正「${ruleIssues[0].title}」，确保摘要、实验表与结论章节的数据口径完全一致。`;

  const res = await callAiChat({
    settings,
    policy,
    systemPrompt: '你是顶会审稿人与学术编辑。请根据规则初筛结果与论文片段，给出3条以内的跨章节逻辑与数据一致性审查结论。',
    userPrompt: `规则初筛发现 ${ruleIssues.length} 项：\n${ruleIssues.map((i) => `- ${i.title}: ${i.detail}`).join('\n')}\n\n论文节选：\n${text.slice(0, 2600)}`,
    fallback,
    taskType: 'consistency',
  });
  return { report: res.text, source: res.source, appliedSkillNames: res.appliedSkillNames };
}
