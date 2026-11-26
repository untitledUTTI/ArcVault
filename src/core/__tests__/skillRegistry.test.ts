import { describe, expect, it } from 'vitest';
import {
  BUILTIN_SKILLS,
  applyOfflineSkillsToText,
  composeSystemPromptWithSkills,
  composeSystemPromptWithSkillsAsync,
  exportSkillAsMarkdown,
  loadSkillFullInstructions,
  parseSkillFileContent,
  resolveMergedSkills,
} from '../skillRegistry';

describe('AI Skill Registry, Loader & Execution Helpers', () => {
  it('provides curated academic de-AI & writing skills disabled by default', () => {
    const slugs = BUILTIN_SKILLS.map((s) => s.slug);
    expect(slugs).toEqual([
      'academic-humanizer',
      'anti-defensive-writing',
      'anti-defensive-writing-en',
      'humanizer',
      'humanizer-zh',
      'peer-review-rebuttal-pro',
      'latex-citation-guardian',
    ]);
    expect(slugs).not.toContain('nature-science-concise');

    for (const s of BUILTIN_SKILLS) {
      expect(s.enabled).toBe(false);
      expect(s.instructions.length).toBeGreaterThan(40);
    }
  });

  it('merges persisted user toggles and custom skills cleanly without duplicates', () => {
    const partialSaved = [
      { ...BUILTIN_SKILLS[0], enabled: true },
      {
        id: 'skill_custom_1',
        slug: 'my-lab-style',
        name: 'Lab Style',
        description: 'Custom style',
        category: 'custom' as const,
        language: 'en' as const,
        instructions: 'Use crisp active verbs.',
        enabled: true,
        source: 'custom' as const,
      },
    ];

    const merged = resolveMergedSkills(partialSaved);
    expect(merged.length).toBe(BUILTIN_SKILLS.length + 1);
    expect(merged.find((s) => s.slug === BUILTIN_SKILLS[0].slug)?.enabled).toBe(true);
    expect(merged.find((s) => s.slug === BUILTIN_SKILLS[1].slug)?.enabled).toBe(false);
    expect(merged.find((s) => s.slug === 'my-lab-style')?.enabled).toBe(true);
  });

  it('parses SKILL.md YAML frontmatter, plain Markdown, and JSON bundles and round-trips exports', () => {
    const mdWithFm = `---
name: Academic Tone Shield
slug: academic-tone-shield
description: Remove hyped verbs in IEEE papers
category: de-ai
language: en
origin: community-repo
tags: [IEEE, de-ai]
---

1. Avoid "delve into" and "tapestry".
2. State empirical bounds clearly.`;

    const parsedFm = parseSkillFileContent(mdWithFm, 'academic-tone-shield.SKILL.md');
    expect(parsedFm).toHaveLength(1);
    expect(parsedFm[0].slug).toBe('academic-tone-shield');
    expect(parsedFm[0].category).toBe('de-ai');
    expect(parsedFm[0].language).toBe('en');
    expect(parsedFm[0].enabled).toBe(true);
    expect(parsedFm[0].instructions).toContain('Avoid "delve into"');

    const exported = exportSkillAsMarkdown(parsedFm[0]);
    const reimported = parseSkillFileContent(exported, 'exported.SKILL.md');
    expect(reimported[0].name).toBe('Academic Tone Shield');
    expect(reimported[0].instructions).toContain('empirical bounds');

    const plainMd = `# 清华论文降AI规范\n\n消除“综上所述”与翻译腔，保持公式原样。`;
    const parsedPlain = parseSkillFileContent(plainMd, 'thu-style.md');
    expect(parsedPlain).toHaveLength(1);
    expect(parsedPlain[0].name).toBe('清华论文降AI规范');
    expect(parsedPlain[0].enabled).toBe(true);

    const jsonBundle = JSON.stringify([
      {
        name: 'Custom JSON Humanizer',
        slug: 'json-humanizer',
        category: 'de-ai',
        language: 'zh-en',
        instructions: 'Replace filler words.',
      },
    ]);
    const parsedJson = parseSkillFileContent(jsonBundle, 'bundle.json');
    expect(parsedJson).toHaveLength(1);
    expect(parsedJson[0].slug).toBe('json-humanizer');
  });

  it('injects only enabled skills into system prompt and preserves citations/math in offline cleanup', () => {
    const skills = BUILTIN_SKILLS.map((s) =>
      s.slug === 'academic-humanizer' || s.slug === 'anti-defensive-writing'
        ? { ...s, enabled: true }
        : s,
    );

    const composed = composeSystemPromptWithSkills('Base system prompt.', skills);
    expect(composed.appliedSkills.map((s) => s.slug)).toEqual([
      'academic-humanizer',
      'anti-defensive-writing',
    ]);
    expect(composed.systemPrompt).toContain('[ACTIVE SKILLS — MANDATORY EXECUTION]');
    expect(composed.systemPrompt).toContain('academic-humanizer');
    expect(composed.systemPrompt).toContain('anti-defensive-writing');
    expect(composed.systemPrompt).not.toContain('peer-review-rebuttal-pro');

    const raw =
      '值得注意的是，[@zotero:001] 在一定程度上或许可以认为 $E = mc^2$ plays a crucial role in energy.';
    const cleaned = applyOfflineSkillsToText(raw, composed.appliedSkills);
    expect(cleaned).not.toContain('值得注意的是');
    expect(cleaned).not.toContain('在一定程度上或许可以认为');
    expect(cleaned).toContain('[@zotero:001]');
    expect(cleaned).toContain('$E = mc^2$');
  });

  it('keeps lightweight summary in registry and lazy-loads full upstream SKILL.md files on demand per task', async () => {
    for (const slug of [
      'academic-humanizer',
      'anti-defensive-writing',
      'anti-defensive-writing-en',
      'humanizer',
      'humanizer-zh',
    ]) {
      const entry = BUILTIN_SKILLS.find((s) => s.slug === slug)!;
      expect(entry.hasFullSource).toBe(true);
      expect(entry.instructions.length).toBeLessThan(1000);
      const fullText = await loadSkillFullInstructions(entry);
      expect(fullText.length).toBeGreaterThan(1500);
      expect(fullText.length).toBeGreaterThan(entry.instructions.length * 3);
    }

    const humanizerEntry = BUILTIN_SKILLS.find((s) => s.slug === 'humanizer')!;
    const fullHumanizer = await loadSkillFullInstructions(humanizerEntry);
    expect(fullHumanizer).toContain('# Humanizer: remove AI writing patterns');
    expect(fullHumanizer).toContain('Not X but Y');

    const antiDefZh = await loadSkillFullInstructions(
      BUILTIN_SKILLS.find((s) => s.slug === 'anti-defensive-writing')!,
    );
    expect(antiDefZh).toContain('The Press-Release Principle');

    const antiDefEn = await loadSkillFullInstructions(
      BUILTIN_SKILLS.find((s) => s.slug === 'anti-defensive-writing-en')!,
    );
    expect(antiDefEn).toContain('Paper as Press Conference');

    const skills = BUILTIN_SKILLS.map((s) =>
      s.slug === 'humanizer' || s.slug === 'peer-review-rebuttal-pro'
        ? { ...s, enabled: true }
        : s,
    );

    // Summary task injects zero writing/rebuttal skills
    const summaryComposed = await composeSystemPromptWithSkillsAsync('Summarize diff.', skills, 'summary');
    expect(summaryComposed.appliedSkills).toEqual([]);
    expect(summaryComposed.systemPrompt).toBe('Summarize diff.');

    // Rewrite task lazy-loads full humanizer, skips rebuttal skill
    const rewriteComposed = await composeSystemPromptWithSkillsAsync('Rewrite prose.', skills, 'rewrite');
    expect(rewriteComposed.appliedSkills.map((s) => s.slug)).toEqual(['humanizer']);
    expect(rewriteComposed.systemPrompt).toContain('# Humanizer: remove AI writing patterns');
    expect(rewriteComposed.systemPrompt).not.toContain('peer-review-rebuttal-pro');
  });
});
