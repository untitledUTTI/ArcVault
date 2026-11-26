import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AiPrivacyBlockedError,
  callAiChat,
  guardAiPrivacy,
  resolveEffectiveAiPolicy,
  generateSnapshotSummary,
  generateAnnotationRewrite,
} from '../aiGateway';
import { generateRebuttalWithAi } from '../rebuttalGenerator';
import { BUILTIN_SKILLS } from '../skillRegistry';
import type { AnnotationItem, AppSettings } from '../../types/archive';

function makeSettings(provider: AppSettings['aiProvider']): AppSettings {
  return {
    theme: 'light',
    locale: 'zh-CN',
    commentColor: '#2563eb',
    revisionColor: '#dc2626',
    defaultBackupFormat: 'both',
    autoBackup: {
      enabled: true,
      debounceMinutes: 3,
      dailyTime: '23:00',
      minCharChangeThreshold: 80,
    },
    aiProvider: provider,
    aiEndpoint: 'https://api.example.com/v1',
    aiModel: 'test-model',
    aiApiKey: 'sk-test',
    watchDirectory: 'D:\\Drafts',
    watchActive: false,
  };
}

describe('AI Gateway & Privacy Policy Enforcement', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('enforces Vault local-only policy and blocks cloud API providers', () => {
    expect(resolveEffectiveAiPolicy('cloud-or-local', undefined, true)).toBe('local-only');
    expect(resolveEffectiveAiPolicy('cloud-or-local', 'disabled', true)).toBe('disabled');

    expect(() => guardAiPrivacy('openai-compatible', 'local-only')).toThrow(AiPrivacyBlockedError);
    expect(() => guardAiPrivacy('openai-compatible', 'disabled')).toThrow(AiPrivacyBlockedError);
    expect(() => guardAiPrivacy('ollama', 'disabled')).toThrow(AiPrivacyBlockedError);

    // Local Ollama is allowed under local-only policy
    expect(() => guardAiPrivacy('ollama', 'local-only')).not.toThrow();
    expect(() => guardAiPrivacy('offline-smart', 'local-only')).not.toThrow();
  });

  it('generates offline-smart snapshot summaries and annotation rewrites cleanly', async () => {
    const settings = makeSettings('offline-smart');

    const sum = await generateSnapshotSummary({
      oldText: '# 摘要\n\n旧版本准确率 91.6%。',
      newText: '# 摘要\n\n新版本准确率提升至 94.2%，并补充了消融实验分析。',
      settings,
      policy: 'cloud-or-local',
    });
    expect(sum.source).toBe('offline-smart');
    expect(sum.text).toContain('摘要');

    const ann: AnnotationItem = {
      id: 'c1',
      type: 'comment',
      author: '李教授',
      date: '2026-11-25',
      commentText: '请注明对比基线名称',
      originalText: '提升至 94.2%',
      anchorStart: 0,
      anchorEnd: 9,
      status: 'open',
      replies: [],
    };
    const rewrite = await generateAnnotationRewrite({
      annotation: ann,
      contextSnippet: '实验表明准确率提升至 94.2%。',
      settings,
      policy: 'local-only',
    });
    expect(rewrite.text).toContain('基线');
  });

  it('mandatorily injects all enabled Skills into every AI call and rebuttal request', async () => {
    const capturedSystemPrompts: string[] = [];
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        messages?: Array<{ role: string; content: string }>;
      };
      capturedSystemPrompts.push(body.messages?.[0]?.content ?? '');
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Polished rigorous output' } }],
        }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const armedSkills = BUILTIN_SKILLS.map((s) =>
      s.slug === 'academic-humanizer' ||
      s.slug === 'anti-defensive-writing' ||
      s.slug === 'humanizer'
        ? { ...s, enabled: true }
        : s,
    );

    const settings: AppSettings = {
      ...makeSettings('openai-compatible'),
      skills: armedSkills,
    };

    const chatRes = await callAiChat({
      settings,
      policy: 'cloud-or-local',
      systemPrompt: 'Base prompt',
      userPrompt: 'Rewrite paragraph',
      fallback: () => 'fallback',
    });
    expect(chatRes.appliedSkillNames).toEqual([
      'academic-humanizer',
      'anti-defensive-writing',
      'humanizer',
    ]);

    const ann: AnnotationItem = {
      id: 'c2',
      type: 'comment',
      author: 'Reviewer',
      date: '2026-11-26',
      commentText: 'Clarify claim',
      originalText: 'We improve latency.',
      anchorStart: 0,
      anchorEnd: 19,
      status: 'open',
      replies: [],
    };
    const rewriteRes = await generateAnnotationRewrite({
      annotation: ann,
      contextSnippet: 'We improve latency significantly.',
      settings,
      policy: 'cloud-or-local',
    });
    expect(rewriteRes.appliedSkillNames).toContain('academic-humanizer');

    const rebuttalRes = await generateRebuttalWithAi({
      baselineText: '# Intro\nOld claim.',
      revisedText: '# Intro\nRevised claim with N=512 bound.',
      reviewerComments: '1. Clarify scope.',
      language: 'en',
      settings,
      policy: 'cloud-or-local',
    });
    expect(rebuttalRes.appliedSkillNames).toContain('anti-defensive-writing');

    expect(capturedSystemPrompts).toHaveLength(3);
    // call 0: general -> all 3 enabled skills
    expect(capturedSystemPrompts[0]).toContain('academic-humanizer');
    expect(capturedSystemPrompts[0]).toContain('anti-defensive-writing');
    expect(capturedSystemPrompts[0]).toContain('humanizer');
    // call 1 & 2: rewrite / rebuttal -> de-ai + academic + full humanizer
    for (const sys of capturedSystemPrompts) {
      expect(sys).toContain('[ACTIVE SKILLS — ON-DEMAND FULL EXECUTION]');
      expect(sys).toContain('academic-humanizer');
      expect(sys).toContain('anti-defensive-writing');
      expect(sys).toContain('humanizer');
    }
  });

  it('prioritizes Academic Phrasebank patterns by default and respects opt-out', async () => {
    const capturedSystemPrompts: string[] = [];
    const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? '{}')) as {
        messages?: Array<{ role: string; content: string }>;
      };
      capturedSystemPrompts.push(body.messages?.[0]?.content ?? '');
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Polished output' } }],
        }),
      } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    // Default enabled (phrasebank unset)
    const defaultSettings = makeSettings('openai-compatible');
    const resDefault = await callAiChat({
      settings: defaultSettings,
      policy: 'cloud-or-local',
      systemPrompt: 'Base prompt',
      userPrompt: 'A lot of studies delve into research gap.',
      fallback: () => 'fallback',
    });
    expect(resDefault.phrasebankPriorityApplied).toBe(true);
    expect(resDefault.appliedSkillNames).toEqual([]);
    expect(capturedSystemPrompts[0]).toContain('[ACADEMIC PHRASEBANK — DE-AI PRIORITY]');

    // Offline-smart polish when enabled vs disabled
    const offlineEnabled = await callAiChat({
      settings: makeSettings('offline-smart'),
      policy: 'cloud-or-local',
      systemPrompt: 'Base',
      userPrompt: 'Rewrite',
      fallback: () => 'A lot of studies delve into this.',
    });
    expect(offlineEnabled.phrasebankPriorityApplied).toBe(true);
    expect(offlineEnabled.text).toBe('Considerable studies examine this.');

    const disabledSettings: AppSettings = {
      ...makeSettings('openai-compatible'),
      phrasebank: {
        enabled: true,
        scope: 'paper-only',
        visibleIcons: ['smart'],
        collapsed: false,
        preferPhrasebankForAi: false,
      },
    };
    const resDisabled = await callAiChat({
      settings: disabledSettings,
      policy: 'cloud-or-local',
      systemPrompt: 'Base prompt',
      userPrompt: 'Rewrite paragraph',
      fallback: () => 'fallback',
    });
    expect(resDisabled.phrasebankPriorityApplied).toBe(false);
    expect(capturedSystemPrompts[1]).not.toContain('[ACADEMIC PHRASEBANK — DE-AI PRIORITY]');

    const offlineDisabled = await callAiChat({
      settings: { ...disabledSettings, aiProvider: 'offline-smart' },
      policy: 'cloud-or-local',
      systemPrompt: 'Base',
      userPrompt: 'Rewrite',
      fallback: () => 'A lot of studies delve into this.',
    });
    expect(offlineDisabled.phrasebankPriorityApplied).toBe(false);
    expect(offlineDisabled.text).toBe('A lot of studies delve into this.');
  });
});
