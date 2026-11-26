import { computeDocumentDiff } from './diffEngine';
import { callAiChat } from './aiGateway';
import type { AiPrivacyPolicy, AppSettings } from '../types/archive';

export interface RebuttalParams {
  baselineText: string;
  revisedText: string;
  reviewerComments: string;
  language: 'zh' | 'en';
}

export function parseReviewerComments(rawText: string): string[] {
  const trimmed = rawText.trim();
  if (!trimmed) return [];

  // Split on numbered items or Reviewer Comment markers
  const byNumber = trimmed
    .split(/\n(?=(?:\d+[\.\)、]|(?:Comment|审稿意见|审稿人)\s*\d*[:：]))/i)
    .map((s) => s.trim())
    .filter(Boolean);

  if (byNumber.length > 1) return byNumber;

  return trimmed
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function locateChangedSections(baselineText: string, revisedText: string): Array<{
  section: string;
  removed: string;
  added: string;
}> {
  const diff = computeDocumentDiff(baselineText, revisedText);
  const changed: Array<{ section: string; removed: string; added: string }> = [];

  const headingOf = (txt: string, fallbackHeading: string) => {
    const lines = txt.split('\n');
    for (const l of lines) {
      const m = l.match(/^#{1,3}\s+(.+)$/);
      if (m) return m[1].trim();
    }
    return fallbackHeading;
  };

  let curSection = '全文局部';
  for (let i = 0; i < diff.hunks.length; i++) {
    const h = diff.hunks[i];
    if (h.type === 'unchanged') {
      curSection = headingOf(h.value, curSection);
      continue;
    }
    if (h.type === 'removed') {
      const next = diff.hunks[i + 1];
      const added = next && next.type === 'added' ? next.value.trim() : '';
      if (added) i += 1;
      changed.push({
        section: curSection,
        removed: h.value.trim().slice(0, 180),
        added: added.slice(0, 180),
      });
    } else if (h.type === 'added') {
      changed.push({
        section: curSection,
        removed: '',
        added: h.value.trim().slice(0, 180),
      });
    }
  }
  return changed;
}

export function buildStructuredRebuttalDraft(params: RebuttalParams): string {
  const { baselineText, revisedText, reviewerComments, language } = params;
  const comments = parseReviewerComments(reviewerComments);
  const diff = computeDocumentDiff(baselineText, revisedText);
  const changes = locateChangedSections(baselineText, revisedText);

  if (language === 'en') {
    const lines: string[] = [
      '# Point-by-Point Response to Reviewers',
      '',
      `> **Summary of Manuscript Revisions**: ${diff.changedBlocks} modified blocks (+${diff.addedChars} / -${diff.removedChars} chars across ${new Set(changes.map((c) => c.section)).size || 1} section(s)).`,
      '',
    ];

    const list = comments.length > 0 ? comments : ['General Revision Summary'];
    list.forEach((c, idx) => {
      const matched = changes[idx % Math.max(1, changes.length)];
      lines.push(`## Comment ${idx + 1}`);
      lines.push(`**Reviewer's Comment:** ${c}`);
      lines.push('');
      lines.push(
        `**Response:** Thank you for this insightful suggestion. We have carefully revised the manuscript${matched ? ` in section **${matched.section}**` : ''} to address this concern.`,
      );
      if (matched) {
        if (matched.removed) lines.push(`- **Original:** ${matched.removed}`);
        if (matched.added) lines.push(`- **Revised:** ${matched.added}`);
      }
      lines.push('');
    });
    return lines.join('\n');
  }

  const lines: string[] = [
    '# 审稿人 / 导师意见逐条返修说明（Response Letter 草稿）',
    '',
    `> **本次修回改动概览**：共修改 ${diff.changedBlocks} 处段落（+${diff.addedChars} 字 / -${diff.removedChars} 字）。`,
    '',
  ];

  const list = comments.length > 0 ? comments : ['请在此粘贴审稿人/导师具体意见，以下为自动提取的修改对比定位：'];
  list.forEach((c, idx) => {
    const matched = changes[idx % Math.max(1, changes.length)];
    lines.push(`## 意见 ${idx + 1}`);
    lines.push(`**审稿/导师意见：** ${c}`);
    lines.push('');
    lines.push(
      `**回复与修改说明：** 非常感谢专家的宝贵建议！我们已据此对论文${matched ? `【${matched.section}】` : ''}进行了针对性补充与完善。具体修改对照如下：`,
    );
    if (matched) {
      if (matched.removed) lines.push(`- **修改前原文：** ${matched.removed}`);
      if (matched.added) lines.push(`- **修改后定稿：** ${matched.added}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}

export async function generateRebuttalWithAi(
  params: RebuttalParams & { settings: AppSettings; policy: AiPrivacyPolicy },
): Promise<{ draft: string; source: 'cloud' | 'ollama' | 'offline-smart'; appliedSkillNames: string[] }> {
  const structured = buildStructuredRebuttalDraft(params);
  if (params.policy === 'disabled') {
    return { draft: structured, source: 'offline-smart', appliedSkillNames: [] };
  }

  const res = await callAiChat({
    settings: params.settings,
    policy: params.policy,
    systemPrompt:
      params.language === 'en'
        ? 'You are an experienced academic author. Polish the following Point-by-Point Response Letter draft into polite, rigorous publication-ready Markdown.'
        : '你是资深学术作者。请将以下返修说明草稿润色为礼貌、严谨、条理清晰的 Markdown 逐条回复信，保留原文与修改后对照片段。',
    userPrompt: structured,
    fallback: () => structured,
    taskType: 'rebuttal',
  });

  return { draft: res.text, source: res.source, appliedSkillNames: res.appliedSkillNames };
}
