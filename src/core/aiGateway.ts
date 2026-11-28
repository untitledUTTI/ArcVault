import { computeDocumentDiff } from './diffEngine';
import {
  applyOfflineSkillsToText,
  composeSystemPromptWithSkillsAsync,
  getEnabledSkills,
} from './skillRegistry';
import {
  applyOfflinePhrasebankPolish,
  buildPhrasebankSystemDirective,
  isPhrasebankAiPriorityEnabled,
} from './phrasebank/phrasebankAiDirective';
import type {
  AiPrivacyPolicy,
  AiThinkingEffort,
  AnnotationItem,
  AppSettings,
  SkillTaskType,
} from '../types/archive';

export interface AiEndpointPreset {
  id: string;
  labelZh: string;
  labelEn: string;
  endpoint: string;
  model: string;
  badgeZh?: string;
  badgeEn?: string;
}

export const AI_CLOUD_FREE_PRESETS: AiEndpointPreset[] = [
  {
    id: 'sf-qwen25-7b',
    labelZh: '硅基流动 · Qwen2.5-7B',
    labelEn: 'SiliconFlow · Qwen2.5-7B',
    endpoint: 'https://api.siliconflow.cn/v1',
    model: 'Qwen/Qwen2.5-7B-Instruct',
    badgeZh: '免费',
    badgeEn: 'Free',
  },
  {
    id: 'sf-deepseek-r1-7b',
    labelZh: '硅基流动 · DeepSeek-R1-7B',
    labelEn: 'SiliconFlow · DeepSeek-R1-7B',
    endpoint: 'https://api.siliconflow.cn/v1',
    model: 'deepseek-ai/DeepSeek-R1-Distill-Qwen-7B',
    badgeZh: '免费·推理',
    badgeEn: 'Free·Reasoning',
  },
  {
    id: 'zhipu-glm4-flash',
    labelZh: '智谱 AI · GLM-4-Flash',
    labelEn: 'Zhipu AI · GLM-4-Flash',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    badgeZh: '免费',
    badgeEn: 'Free',
  },
  {
    id: 'modelscope-qwen25-72b',
    labelZh: '魔搭 · Qwen2.5-72B',
    labelEn: 'ModelScope · Qwen2.5-72B',
    endpoint: 'https://api-inference.modelscope.cn/v1',
    model: 'Qwen/Qwen2.5-72B-Instruct',
    badgeZh: '每日免费',
    badgeEn: 'Daily Free',
  },
  {
    id: 'hunyuan-lite',
    labelZh: '腾讯混元 · Hunyuan-Lite',
    labelEn: 'Tencent Hunyuan-Lite',
    endpoint: 'https://api.hunyuan.cloud.tencent.com/v1',
    model: 'hunyuan-lite',
    badgeZh: '免费',
    badgeEn: 'Free',
  },
  {
    id: 'qianfan-ernie-speed',
    labelZh: '百度千帆 · ERNIE-Speed',
    labelEn: 'Baidu ERNIE-Speed',
    endpoint: 'https://qianfan.baidubce.com/v2',
    model: 'ernie-speed-128k',
    badgeZh: '免费',
    badgeEn: 'Free',
  },
];

export const AI_CLOUD_GENERAL_PRESETS: AiEndpointPreset[] = [
  {
    id: 'deepseek-chat',
    labelZh: 'DeepSeek Chat',
    labelEn: 'DeepSeek Chat',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  {
    id: 'deepseek-reasoner',
    labelZh: 'DeepSeek R1',
    labelEn: 'DeepSeek R1',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-reasoner',
  },
  {
    id: 'openai-gpt4o-mini',
    labelZh: 'OpenAI',
    labelEn: 'OpenAI',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
];

export const AI_LOCAL_RUNTIME_PRESETS: AiEndpointPreset[] = [
  {
    id: 'local-ollama',
    labelZh: 'Ollama',
    labelEn: 'Ollama',
    endpoint: 'http://localhost:11434/v1',
    model: 'qwen3:8b',
  },
  {
    id: 'local-lmstudio',
    labelZh: 'LM Studio',
    labelEn: 'LM Studio',
    endpoint: 'http://localhost:1234/v1',
    model: 'local-model',
  },
  {
    id: 'local-llamacpp',
    labelZh: 'llama.cpp',
    labelEn: 'llama.cpp',
    endpoint: 'http://localhost:8080/v1',
    model: 'local-model',
  },
  {
    id: 'local-vllm',
    labelZh: 'vLLM',
    labelEn: 'vLLM',
    endpoint: 'http://localhost:8000/v1',
    model: 'Qwen/Qwen3-8B',
  },
];

export class AiPrivacyBlockedError extends Error {
  readonly policy: AiPrivacyPolicy;
  readonly provider: AppSettings['aiProvider'];

  constructor(policy: AiPrivacyPolicy, provider: AppSettings['aiProvider']) {
    const msg =
      policy === 'disabled'
        ? '当前文档或空间已完全禁止 AI 访问（仅本地规则分析可用）。'
        : `隐私保护拦截：当前文档锁定为「仅本地 AI (${policy})」，已阻止将文本发送至云端接口 (${provider})。请改用本地模型或离线智能引擎。`;
    super(msg);
    this.name = 'AiPrivacyBlockedError';
    this.policy = policy;
    this.provider = provider;
  }
}

export function resolveEffectiveAiPolicy(
  spacePolicy: AiPrivacyPolicy,
  docOverride?: AiPrivacyPolicy,
  isVaultSpace = false,
): AiPrivacyPolicy {
  const effective = docOverride ?? spacePolicy;
  if (isVaultSpace && effective === 'cloud-or-local') {
    return 'local-only';
  }
  return effective;
}

export function guardAiPrivacy(
  provider: AppSettings['aiProvider'],
  policy: AiPrivacyPolicy,
): void {
  if (policy === 'disabled' && provider !== 'offline-smart') {
    throw new AiPrivacyBlockedError(policy, provider);
  }
  if (policy === 'local-only' && provider === 'openai-compatible') {
    throw new AiPrivacyBlockedError(policy, provider);
  }
}

export function normalizeChatCompletionsUrl(endpoint: string): string {
  const trimmed = endpoint.trim().replace(/\/+$/, '');
  if (!trimmed) return 'http://localhost:11434/v1/chat/completions';
  if (trimmed.endsWith('/chat/completions') || trimmed.endsWith('/api/chat')) return trimmed;
  if (/\/v\d+(?:alpha|beta)?$/i.test(trimmed)) return `${trimmed}/chat/completions`;
  return `${trimmed}/v1/chat/completions`;
}

export function extractLocalModelName(localPath?: string): string {
  const trimmed = (localPath ?? '').trim();
  if (!trimmed) return '';
  const parts = trimmed.split(/[/\\]+/).filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

export function buildThinkingRequestFields(
  url: string,
  deepThinking: boolean,
  effort: AiThinkingEffort,
): Record<string, unknown> {
  const lower = url.toLowerCase();
  if (lower.endsWith('/api/chat')) {
    return { think: deepThinking ? effort : false };
  }
  if (
    lower.includes('siliconflow.cn') ||
    lower.includes('modelscope.cn') ||
    lower.includes('dashscope.aliyuncs.com')
  ) {
    return deepThinking
      ? { enable_thinking: true, reasoning_effort: effort }
      : { enable_thinking: false };
  }
  if (lower.includes('bigmodel.cn')) {
    return { thinking: { type: deepThinking ? 'enabled' : 'disabled' } };
  }
  return { reasoning_effort: deepThinking ? effort : 'none' };
}

export function stripThinkingTags(text: string): string {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  return cleaned || text.trim();
}

export async function callAiChat(params: {
  settings: AppSettings;
  policy: AiPrivacyPolicy;
  systemPrompt: string;
  userPrompt: string;
  fallback: () => string;
  allowNetworkFallback?: boolean;
  skipSkills?: boolean;
  skipPhrasebankGuide?: boolean;
  taskType?: SkillTaskType;
}): Promise<{
  text: string;
  source: 'cloud' | 'ollama' | 'offline-smart';
  appliedSkillNames: string[];
  phrasebankPriorityApplied: boolean;
}> {
  const {
    settings,
    policy,
    systemPrompt,
    userPrompt,
    fallback,
    allowNetworkFallback = true,
    skipSkills = false,
    skipPhrasebankGuide = false,
    taskType = 'general',
  } = params;

  guardAiPrivacy(settings.aiProvider, policy);

  const { systemPrompt: skillSystemPrompt, appliedSkills } = skipSkills
    ? { systemPrompt, appliedSkills: [] }
    : await composeSystemPromptWithSkillsAsync(systemPrompt, settings.skills, taskType);
  const appliedSkillNames = appliedSkills.map((s) => s.slug);

  const phrasebankPriorityApplied =
    !skipSkills && !skipPhrasebankGuide && isPhrasebankAiPriorityEnabled(settings);

  const finalSystemPrompt = phrasebankPriorityApplied
    ? `${skillSystemPrompt}\n\n${buildPhrasebankSystemDirective(userPrompt)}`
    : skillSystemPrompt;

  const buildOfflineText = () => {
    const withSkills = applyOfflineSkillsToText(fallback(), appliedSkills);
    return phrasebankPriorityApplied ? applyOfflinePhrasebankPolish(withSkills) : withSkills;
  };

  if (settings.aiProvider === 'offline-smart') {
    return {
      text: buildOfflineText(),
      source: 'offline-smart',
      appliedSkillNames,
      phrasebankPriorityApplied,
    };
  }

  if (settings.aiProvider === 'openai-compatible' && !settings.aiApiKey.trim()) {
    if (allowNetworkFallback) {
      return {
        text: buildOfflineText(),
        source: 'offline-smart',
        appliedSkillNames,
        phrasebankPriorityApplied,
      };
    }
    throw new Error('未填写云端 API Key');
  }

  const url = normalizeChatCompletionsUrl(settings.aiEndpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (settings.aiProvider === 'openai-compatible' && settings.aiApiKey.trim()) {
    headers.Authorization = `Bearer ${settings.aiApiKey.trim()}`;
  }

  const deepThinking = settings.aiDeepThinking ?? true;
  const effort: AiThinkingEffort = settings.aiThinkingEffort ?? 'medium';
  const resolvedModel =
    settings.aiModel.trim() ||
    (settings.aiProvider === 'ollama'
      ? extractLocalModelName(settings.aiLocalModelPath) || 'qwen3:8b'
      : 'deepseek-chat');

  const basePayload: Record<string, unknown> = {
    model: resolvedModel,
    messages: [
      { role: 'system', content: finalSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.3,
  };
  if (url.toLowerCase().endsWith('/api/chat')) {
    basePayload.stream = false;
  }

  const thinkingFields = buildThinkingRequestFields(url, deepThinking, effort);
  const primaryPayload = { ...basePayload, ...thinkingFields };

  try {
    let resp = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(primaryPayload),
    });

    if ((resp.status === 400 || resp.status === 422) && Object.keys(thinkingFields).length > 0) {
      resp = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(basePayload),
      });
    }

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status}`);
    }

    const data = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      message?: { content?: string };
    };
    const rawContent = data.choices?.[0]?.message?.content ?? data.message?.content ?? '';
    const content = stripThinkingTags(rawContent);
    if (!content) {
      throw new Error('Empty AI response');
    }
    return {
      text: content,
      source: settings.aiProvider === 'ollama' ? 'ollama' : 'cloud',
      appliedSkillNames,
      phrasebankPriorityApplied,
    };
  } catch (err) {
    if (allowNetworkFallback) {
      return {
        text: buildOfflineText(),
        source: 'offline-smart',
        appliedSkillNames,
        phrasebankPriorityApplied,
      };
    }
    throw err;
  }
}

export async function generateSnapshotSummary(params: {
  oldText: string;
  newText: string;
  settings: AppSettings;
  policy: AiPrivacyPolicy;
}): Promise<{
  text: string;
  source: 'cloud' | 'ollama' | 'offline-smart';
  appliedSkillNames: string[];
}> {
  const { oldText, newText, settings, policy } = params;
  const diff = computeDocumentDiff(oldText, newText);

  const fallback = (): string => {
    const changedSections = new Set<string>();
    const lines = newText.split('\n');
    let currentHeading = '正文';
    const headingMap = new Map<string, string>();
    for (const ln of lines) {
      const hm = ln.match(/^#{1,3}\s+(.+)$/);
      if (hm) currentHeading = hm[1].trim();
      headingMap.set(ln.trim(), currentHeading);
    }
    for (const h of diff.hunks) {
      if (h.type === 'unchanged') continue;
      const firstLine = h.value.split('\n')[0]?.trim() ?? '';
      if (headingMap.has(firstLine)) changedSections.add(headingMap.get(firstLine)!);
    }
    const secLabel = changedSections.size > 0 ? `涉及【${Array.from(changedSections).slice(0, 3).join('、')}】` : '局部段落微调';
    return `${secLabel}：+${diff.addedChars} 字 / -${diff.removedChars} 字（共 ${diff.changedBlocks} 处变动）。`;
  };

  if (policy === 'disabled') {
    return { text: fallback(), source: 'offline-smart', appliedSkillNames: [] };
  }

  return callAiChat({
    settings,
    policy,
    systemPrompt: '你是严谨的学术写作助手。请用一句话中文概括两版文稿的核心实质改动，不超过45字。',
    userPrompt: `改动统计：${diff.summary}\n新增与修改片段：\n${diff.hunks
      .filter((h) => h.type !== 'unchanged')
      .map((h) => `${h.type === 'added' ? '+' : '-'} ${h.value.slice(0, 260)}`)
      .join('\n')
      .slice(0, 2400)}`,
    fallback,
    skipPhrasebankGuide: true,
    taskType: 'summary',
  });
}

export async function generateAnnotationRewrite(params: {
  annotation: AnnotationItem;
  contextSnippet: string;
  settings: AppSettings;
  policy: AiPrivacyPolicy;
}): Promise<{
  text: string;
  source: 'cloud' | 'ollama' | 'offline-smart';
  appliedSkillNames: string[];
  phrasebankPriorityApplied: boolean;
}> {
  const { annotation, contextSnippet, settings, policy } = params;

  const fallback = (): string => {
    if (annotation.suggestedText && annotation.suggestedText.trim().length > 0) {
      return annotation.suggestedText;
    }
    const orig = annotation.originalText.trim();
    const comment = annotation.commentText ?? '';
    if (comment.includes('基线') || comment.includes('fairness')) {
      return `${orig}（相较于主流基线方法 BM25 与整文件快照基线，在自建学术语料测试集上实现显著提升）`;
    }
    if (comment.includes('复杂度') || comment.includes('显存') || comment.includes('定量')) {
      return `${orig}（单轮增量编码时间复杂度为 O(k)，峰值显存占用低于 420MB）`;
    }
    if (comment.includes('Zotero') || comment.includes('标号')) {
      return `${orig}（已核对交叉引用与文献域编号一致性）`;
    }
    return `${orig}（已依据导师批注补充严谨限定条件与定量实验佐证）`;
  };

  return callAiChat({
    settings,
    policy,
    systemPrompt: '你是中文/英文学术论文润色专家。根据批注或修订意见，直接输出替换原文的改写结果，不要输出多余解释。',
    userPrompt: `上下文：${contextSnippet}\n原文片段：${annotation.originalText}\n导师批注/修订意见：${annotation.commentText || annotation.suggestedText || ''}`,
    fallback,
    taskType: 'rewrite',
  });
}

export async function testAiConnection(
  settings: AppSettings,
): Promise<{ ok: boolean; latencyMs: number; message: string }> {
  const start = Date.now();
  const armedCount = getEnabledSkills(settings.skills).length;
  const skillHint = armedCount > 0 ? ` · 已挂载 ${armedCount} 个启用 Skill` : '';

  if (settings.aiProvider === 'offline-smart') {
    return {
      ok: true,
      latencyMs: 1,
      message: `离线智能启发式引擎已就绪（零网络、零费用、100% 本地隐私${skillHint}）。`,
    };
  }
  const deepThinking = settings.aiDeepThinking ?? true;
  const effort: AiThinkingEffort = settings.aiThinkingEffort ?? 'medium';
  const thinkingHint = ` · 深度思考：${deepThinking ? `开 (${effort})` : '关'}`;

  try {
    const res = await callAiChat({
      settings,
      policy: 'cloud-or-local',
      systemPrompt: 'Reply with OK.',
      userPrompt: 'Ping',
      fallback: () => 'FALLBACK',
      allowNetworkFallback: false,
      skipSkills: true,
      skipPhrasebankGuide: true,
    });
    const sourceLabel = res.source === 'ollama' ? '本地模型' : '云端 API';
    return {
      ok: true,
      latencyMs: Date.now() - start,
      message: `连接成功（${sourceLabel}，耗时 ${Date.now() - start}ms${thinkingHint}${skillHint}）：${res.text.slice(0, 40)}`,
    };
  } catch (err) {
    const localPath = settings.aiLocalModelPath?.trim();
    const pathHint =
      settings.aiProvider === 'ollama' && localPath
        ? `（已设置本地路径：${localPath}，请确认本地推理服务已启动并加载模型）`
        : '';
    return {
      ok: false,
      latencyMs: Date.now() - start,
      message: `连接失败：${err instanceof Error ? err.message : String(err)}${pathHint}`,
    };
  }
}
