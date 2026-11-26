import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/archive_models.dart';
import 'diff_engine.dart';

class AiPrivacyBlockedException implements Exception {
  AiPrivacyBlockedException(this.policy, this.provider)
      : message = policy == AiPrivacyPolicy.disabled
            ? '当前文档或空间已完全禁止 AI 访问（仅本地规则分析可用）。'
            : '隐私保护拦截：当前文档锁定为「仅本地 AI (${policy.wire})」，已阻止将文本发送至云端接口 ($provider)。请改用本地 Ollama 或离线智能引擎。';

  final AiPrivacyPolicy policy;
  final String provider;
  final String message;

  @override
  String toString() => message;
}

class AiChatResponse {
  const AiChatResponse({
    required this.text,
    required this.source, // 'cloud' | 'ollama' | 'offline-smart'
    this.appliedSkillNames = const [],
  });

  final String text;
  final String source;
  final List<String> appliedSkillNames;
}

class SkillRegistry {
  SkillRegistry._();

  static const List<AiSkillModel> builtinSkills = [
    AiSkillModel(
      id: 'skill_academic_humanizer',
      slug: 'academic-humanizer',
      name: 'Academic Humanizer（学术降 AI 专项）',
      description: '优化学术论文与基金申请书的表达清晰度与学者语感，严格保留数据与引文。',
      category: 'de-ai',
      language: 'zh-en',
      enabled: false,
      source: 'builtin',
      origin: 'AIScientists-Dev/academic-humanizer (MIT)',
      tags: ['academic-humanizer', '学术降AI'],
      instructions:
          'Improve clarity and scholarly voice of academic papers, theses, and rebuttals. Match claims to evidence and preserve every number, citation token, and LaTeX math delimiter.',
    ),
    AiSkillModel(
      id: 'skill_anti_defensive_writing',
      slug: 'anti-defensive-writing',
      name: 'Anti-Defensive Writing（去防御性写作 · 中文版）',
      description: '以「学术发布会原则」构建有利、完整、有说服力的论文叙事。',
      category: 'de-ai',
      language: 'zh',
      enabled: false,
      source: 'builtin',
      origin: 'Adkid-Zephyr/anti-defensive-writing-Skill (MIT)',
      tags: ['anti-defensive-writing', '中文版'],
      instructions:
          '论文是一场学术发布会，而不是实验日志或自我审查报告；围绕最值得发表的核心价值建立有力叙事，避免主动示弱与过度防御性对冲。',
    ),
    AiSkillModel(
      id: 'skill_humanizer',
      slug: 'humanizer',
      name: 'Humanizer（去 AI 味通用精修）',
      description: '系统消除 24 类 AI 写作痕迹与机械排比，恢复自然学者表达。',
      category: 'de-ai',
      language: 'zh-en',
      enabled: false,
      source: 'builtin',
      origin: 'blader/humanizer (MIT)',
      tags: ['blader/humanizer', '去AI味'],
      instructions:
          'Remove staging/not-X-but-Y contrasts, forced triads, em-dash overuse, inflated claims, and stock AI vocabulary while preserving facts, numbers, and citations.',
    ),
    AiSkillModel(
      id: 'skill_humanizer_zh',
      slug: 'humanizer-zh',
      name: 'Humanizer-zh（中文去 AI 味精修）',
      description: '清除中文学术文档中的空话、重复、长定语翻译腔及模板化表达。',
      category: 'de-ai',
      language: 'zh',
      enabled: false,
      source: 'builtin',
      origin: 'op7418/Humanizer-zh (MIT)',
      tags: ['Humanizer-zh', '中文润色'],
      instructions:
          '清除中文文本中的空话、重复、长定语翻译腔与模板化表达，保留事实、确定程度与作者原有声音。',
    ),
    AiSkillModel(
      id: 'skill_peer_review_rebuttal_pro',
      slug: 'peer-review-rebuttal-pro',
      name: '审稿返修大师（Peer-Review Rebuttal Pro）',
      description: '优化审稿人与导师返修回复：不卑不亢、先给明确结论与改动定位。',
      category: 'rebuttal',
      language: 'zh-en',
      enabled: false,
      source: 'builtin',
      origin: 'Built-in Curated · Top-Venue Rebuttal Protocol',
      tags: ['Rebuttal', '审稿回复'],
      instructions:
          'Start each point with a concise direct decision/action, followed by concrete quoted changes or experimental numbers. Avoid exaggerated sycophancy.',
    ),
    AiSkillModel(
      id: 'skill_latex_citation_guardian',
      slug: 'latex-citation-guardian',
      name: 'LaTeX 公式与引文域无损守护',
      description: '强约束保护 [@zotero:NNN]、[@endnote:NNN]、\$...\$ 公式及引用语法不被破坏。',
      category: 'formatting',
      language: 'zh-en',
      enabled: false,
      source: 'builtin',
      origin: 'Built-in Curated · ArcVault Integrity Guard',
      tags: ['LaTeX', 'Zotero引文'],
      instructions:
          'Copy every citation token ([@zotero:NNN], [@endnote:NNN], \\cite{}, \\ref{}) and math delimiter (\$...\$, \$\$...\$\$) verbatim.',
    ),
  ];

  static List<AiSkillModel> resolveMerged(List<AiSkillModel>? saved) {
    if (saved == null || saved.isEmpty) {
      return builtinSkills.map((s) => s.copyWith()).toList();
    }
    final byId = <String, AiSkillModel>{};
    for (final s in saved) {
      byId[s.id] = s;
      byId[s.slug] = s;
    }
    final merged = builtinSkills.map((b) {
      final match = byId[b.id] ?? byId[b.slug];
      return match != null ? b.copyWith(enabled: match.enabled) : b.copyWith();
    }).toList();
    final builtinIds = builtinSkills.map((b) => b.id).toSet();
    final builtinSlugs = builtinSkills.map((b) => b.slug).toSet();
    for (final extra in saved) {
      if (!builtinIds.contains(extra.id) && !builtinSlugs.contains(extra.slug)) {
        merged.add(extra);
      }
    }
    return merged;
  }

  static List<AiSkillModel> enabledSkills(List<AiSkillModel>? skills) =>
      resolveMerged(skills).where((s) => s.enabled).toList();
}

class ConsistencyChecker {
  ConsistencyChecker._();

  static List<ConsistencyIssue> runCheck(
    String text, {
    List<CitationSidecarEntry> citationsSidecar = const [],
  }) {
    final issues = <ConsistencyIssue>[];
    final sections = _splitSections(text);

    // 1. Cross-section metric percentage consistency
    final metricGroups = <String, List<({String value, String section, String snippet})>>{};
    final metricRegex = RegExp(
      r'(准确率|精度|F1|压缩率|召回率|提升至|达到|accuracy|precision)[^。\n%]{0,18}?(\d+(?:\.\d+)?%)',
      caseSensitive: false,
    );
    for (final sec in sections) {
      for (final m in metricRegex.allMatches(sec.body)) {
        final rawKey = m.group(1)!.toLowerCase();
        final canonical = (rawKey.contains('准确率') ||
                rawKey.contains('accuracy') ||
                rawKey == '提升至' ||
                rawKey == '达到')
            ? '核心指标准确率'
            : rawKey;
        final val = m.group(2)!;
        metricGroups.putIfAbsent(canonical, () => []).add(
              (value: val, section: sec.title, snippet: m.group(0)!),
            );
      }
    }

    metricGroups.forEach((metricName, occurrences) {
      final distinct = occurrences.map((o) => o.value).toSet().toList();
      if (distinct.length > 1) {
        final freq = <String, int>{};
        for (final o in occurrences) {
          freq[o.value] = (freq[o.value] ?? 0) + 1;
        }
        distinct.sort((a, b) => (freq[b] ?? 0).compareTo(freq[a] ?? 0));
        final primary = distinct.first;
        final outlier = occurrences.firstWhere(
          (o) => o.value != primary,
          orElse: () => occurrences.last,
        );
        issues.add(ConsistencyIssue(
          id: 'issue_num_${issues.length + 1}',
          severity: 'error',
          category: 'numeric-mismatch',
          title: '跨章节指标数值不一致（$metricName）',
          detail:
              '文中同时出现了 ${distinct.join(' 与 ')}：多数/前文章节为 $primary，而「${outlier.section}」中写作 ${outlier.value}。',
          snippet: outlier.snippet,
          suggestedFix: outlier.snippet.replaceFirst(outlier.value, primary),
        ));
      }
    });

    // 2. Dangling Figure references
    final definedFigs = <String>{};
    for (final m in RegExp(r'(?:!\[.*?图\s*(\d+)|^图\s*(\d+)\s*[：:.]|\\caption\{[^}]*图\s*(\d+))',
            multiLine: true)
        .allMatches(text)) {
      final num = m.group(1) ?? m.group(2) ?? m.group(3);
      if (num != null) definedFigs.add(num);
    }
    final imgs = RegExp(r'!\[[^\]]*\]\([^)]+\)').allMatches(text).length;
    for (var i = 1; i <= imgs; i++) {
      definedFigs.add('$i');
    }
    final seenMissingFigs = <String>{};
    for (final m in RegExp(r'(?:如图|图|Fig\.?)\s*(\d+)').allMatches(text)) {
      final num = m.group(1)!;
      if (!definedFigs.contains(num) && seenMissingFigs.add(num)) {
        issues.add(ConsistencyIssue(
          id: 'issue_fig_$num',
          severity: 'warning',
          category: 'broken-ref',
          title: '疑似悬空图片引用（图 $num）',
          detail: '正文引用了「${m.group(0)}」，但当前文档未检测到对应的图 $num 题注或图片插入标记。',
          snippet: m.group(0)!,
        ));
      }
    }

    // 3. Footnotes
    final fnRefs = RegExp(r'\[\^fn(\d+)\](?!:)').allMatches(text).map((m) => m.group(1)!).toSet();
    final fnDefs = RegExp(r'^\[\^fn(\d+)\]:', multiLine: true)
        .allMatches(text)
        .map((m) => m.group(1)!)
        .toSet();
    for (final id in fnRefs) {
      if (!fnDefs.contains(id)) {
        issues.add(ConsistencyIssue(
          id: 'issue_fn_$id',
          severity: 'warning',
          category: 'broken-ref',
          title: '脚注定义缺失（[^fn$id]）',
          detail: '正文引用了脚注 [^fn$id]，但文末未找到对应脚注内容定义。',
          snippet: '[^fn$id]',
        ));
      }
    }

    // 4. Math delimiters
    final strippedDisplay = text.replaceAll(RegExp(r'\$\$[\s\S]*?\$\$'), '');
    final singleDollars = RegExp(r'(?<!\\)\$').allMatches(strippedDisplay).length;
    if (singleDollars.isOdd) {
      issues.add(const ConsistencyIssue(
        id: 'issue_math_unbalanced',
        severity: 'error',
        category: 'math-syntax',
        title: '行内数学公式定界符 `$` 未成对闭合',
        detail: '检测到奇数个未转义的 `$` 符号，可能导致 LaTeX 或 Word OMML 回写失败。',
        snippet: r'$ ...',
      ));
    }

    // 5. Zotero / EndNote sidecar integrity
    final sidecarSet = citationsSidecar.map((c) => c.placeholder).toSet();
    for (final m in RegExp(r'\[@(?:zotero|endnote):\d{3}\]').allMatches(text)) {
      final ph = m.group(0)!;
      if (!sidecarSet.contains(ph)) {
        issues.add(ConsistencyIssue(
          id: 'issue_cit_$ph',
          severity: 'warning',
          category: 'citation-integrity',
          title: '文献占位符未在 Sidecar 中登记（$ph）',
          detail: '占位符 $ph 缺少原始 Word 引文域 XML 映射，导出 Word 时将按纯文本输出。',
          snippet: ph,
        ));
      }
    }

    // 6. Terminology casing
    if (RegExp(r'\bCAS\b').hasMatch(text) && RegExp(r'\bcas\b').hasMatch(text)) {
      issues.add(const ConsistencyIssue(
        id: 'issue_term_cas',
        severity: 'info',
        category: 'terminology',
        title: '专有名词大小写不统一（CAS / cas）',
        detail: '正文中同时出现了全大写 CAS 与全小写 cas，建议统一为大写的 CAS。',
        snippet: 'cas',
        suggestedFix: 'CAS',
      ));
    }

    return issues;
  }

  static List<({String title, String body})> _splitSections(String text) {
    final lines = text.split('\n');
    final sections = <({String title, String body})>[];
    var curTitle = '导语 / 前言';
    var curLines = <String>[];

    for (final ln in lines) {
      final mdH = RegExp(r'^#{1,4}\s+(.+)$').firstMatch(ln);
      final texH =
          RegExp(r'^\\(?:section|subsection|subsubsection)\{(.+)\}$').firstMatch(ln);
      if (mdH != null || texH != null) {
        if (curLines.isNotEmpty) {
          sections.add((title: curTitle, body: curLines.join('\n')));
        }
        curTitle = (mdH?.group(1) ?? texH?.group(1) ?? curTitle).trim();
        curLines = [ln];
      } else {
        curLines.add(ln);
      }
    }
    if (curLines.isNotEmpty) {
      sections.add((title: curTitle, body: curLines.join('\n')));
    }
    return sections;
  }
}

class AiGateway {
  AiGateway._();

  static AiPrivacyPolicy resolveEffectivePolicy(
    AiPrivacyPolicy spacePolicy, {
    AiPrivacyPolicy? docOverride,
    bool isVaultSpace = false,
  }) {
    final effective = docOverride ?? spacePolicy;
    if (isVaultSpace && effective == AiPrivacyPolicy.cloudOrLocal) {
      return AiPrivacyPolicy.localOnly;
    }
    return effective;
  }

  static void guardPrivacy(String provider, AiPrivacyPolicy policy) {
    if (policy == AiPrivacyPolicy.disabled && provider != 'offline-smart') {
      throw AiPrivacyBlockedException(policy, provider);
    }
    if (policy == AiPrivacyPolicy.localOnly && provider == 'openai-compatible') {
      throw AiPrivacyBlockedException(policy, provider);
    }
  }

  static String _normalizeChatUrl(String endpoint) {
    final trimmed = endpoint.trim().replaceAll(RegExp(r'/+$'), '');
    if (trimmed.endsWith('/chat/completions')) return trimmed;
    if (trimmed.endsWith('/v1')) return '$trimmed/chat/completions';
    return '$trimmed/v1/chat/completions';
  }

  static Future<AiChatResponse> callChat({
    required AppSettingsModel settings,
    required AiPrivacyPolicy policy,
    required String systemPrompt,
    required String userPrompt,
    required String Function() fallback,
    bool allowNetworkFallback = true,
  }) async {
    guardPrivacy(settings.aiProvider, policy);
    final activeSkills = SkillRegistry.enabledSkills(settings.skills);
    final appliedNames = activeSkills.map((s) => s.slug).toList();

    final skillPrompt = activeSkills.isEmpty
        ? systemPrompt
        : '$systemPrompt\n\nActive Skills:\n${activeSkills.map((s) => '- ${s.name}: ${s.instructions}').join('\n')}';

    if (settings.aiProvider == 'offline-smart' ||
        (settings.aiProvider == 'openai-compatible' && settings.aiApiKey.trim().isEmpty && allowNetworkFallback)) {
      return AiChatResponse(
        text: fallback(),
        source: 'offline-smart',
        appliedSkillNames: appliedNames,
      );
    }

    try {
      final url = Uri.parse(_normalizeChatUrl(settings.aiEndpoint));
      final headers = <String, String>{'Content-Type': 'application/json'};
      if (settings.aiProvider == 'openai-compatible' && settings.aiApiKey.trim().isNotEmpty) {
        headers['Authorization'] = 'Bearer ${settings.aiApiKey.trim()}';
      }
      final resp = await http
          .post(
            url,
            headers: headers,
            body: jsonEncode({
              'model': settings.aiModel.isEmpty ? 'qwen2.5:14b' : settings.aiModel,
              'messages': [
                {'role': 'system', 'content': skillPrompt},
                {'role': 'user', 'content': userPrompt},
              ],
              'temperature': 0.3,
            }),
          )
          .timeout(const Duration(seconds: 25));

      if (resp.statusCode < 200 || resp.statusCode >= 300) {
        throw Exception('HTTP ${resp.statusCode}');
      }
      final data = jsonDecode(resp.body) as Map<String, dynamic>;
      final choices = data['choices'] as List<dynamic>?;
      final content = (choices?.isNotEmpty == true
              ? (choices!.first as Map<String, dynamic>)['message']?['content']
              : data['message']?['content'])
          ?.toString()
          .trim();
      if (content == null || content.isEmpty) {
        throw Exception('Empty AI response');
      }
      return AiChatResponse(
        text: content,
        source: settings.aiProvider == 'ollama' ? 'ollama' : 'cloud',
        appliedSkillNames: appliedNames,
      );
    } catch (_) {
      if (allowNetworkFallback) {
        return AiChatResponse(
          text: fallback(),
          source: 'offline-smart',
          appliedSkillNames: appliedNames,
        );
      }
      rethrow;
    }
  }

  static Future<AiChatResponse> generateSnapshotSummary({
    required String oldText,
    required String newText,
    required AppSettingsModel settings,
    required AiPrivacyPolicy policy,
  }) {
    final diff = computeDocumentDiff(oldText, newText);
    String fallback() =>
        '局部段落调整：+${diff.addedChars} 字 / -${diff.removedChars} 字（共 ${diff.changedBlocks} 处变动）。';

    if (policy == AiPrivacyPolicy.disabled) {
      return Future.value(AiChatResponse(text: fallback(), source: 'offline-smart'));
    }

    return callChat(
      settings: settings,
      policy: policy,
      systemPrompt: '你是严谨的学术写作助手。请用一句话中文概括两版文稿的核心实质改动，不超过45字。',
      userPrompt: '改动统计：${diff.summary}\n${diff.hunks.where((h) => h.type != DiffHunkType.unchanged).map((h) => h.value).join('\n').charactersTake2000}',
      fallback: fallback,
    );
  }

  static Future<AiChatResponse> generateAnnotationRewrite({
    required AnnotationItem annotation,
    required String contextSnippet,
    required AppSettingsModel settings,
    required AiPrivacyPolicy policy,
  }) {
    String fallback() {
      if (annotation.suggestedText != null && annotation.suggestedText!.trim().isNotEmpty) {
        return annotation.suggestedText!;
      }
      final orig = annotation.originalText.trim();
      if (orig.isEmpty) return '（建议补充具体实验指标与对比基线说明。）';
      return '$orig（注：已结合定量对比数据与学术表述规范进行精修）';
    }

    return callChat(
      settings: settings,
      policy: policy,
      systemPrompt: '你是资深学术编辑。请根据审稿/导师意见改写目标文本，直接返回可替换正文。',
      userPrompt:
          '批注意见：${annotation.commentText ?? '修订建议'}\n原文：$contextSnippet\n目标片段：${annotation.originalText}',
      fallback: fallback,
    );
  }

  static Future<({bool ok, String message})> testConnection(AppSettingsModel settings) async {
    if (settings.aiProvider == 'offline-smart') {
      return (ok: true, message: '离线智能规则引擎就绪（零网络泄露风险）');
    }
    try {
      final res = await callChat(
        settings: settings,
        policy: AiPrivacyPolicy.cloudOrLocal,
        systemPrompt: 'Reply with OK only.',
        userPrompt: 'Ping',
        fallback: () => 'FAILED',
        allowNetworkFallback: false,
      );
      return (ok: true, message: '连接成功（${res.source}）：${res.text}');
    } catch (e) {
      return (ok: false, message: '连接失败：$e');
    }
  }
}

class RebuttalGenerator {
  RebuttalGenerator._();

  static List<String> parseComments(String raw) {
    final trimmed = raw.trim();
    if (trimmed.isEmpty) return const [];
    final parts = trimmed
        .split(RegExp(r'\n(?=(?:\d+[\.\)、]|(?:Comment|审稿意见|审稿人)\s*\d*[:：]))', caseSensitive: false))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty)
        .toList();
    if (parts.length > 1) return parts;
    return trimmed.split(RegExp(r'\n{2,}')).map((s) => s.trim()).where((s) => s.isNotEmpty).toList();
  }

  static String buildDraft({
    required String baselineText,
    required String revisedText,
    required String reviewerComments,
    bool isEn = false,
  }) {
    final comments = parseComments(reviewerComments);
    final diff = computeDocumentDiff(baselineText, revisedText);
    final list = comments.isNotEmpty
        ? comments
        : [isEn ? 'General Revision Summary' : '请在此粘贴审稿人/导师具体意见，以下为自动提取的修改对比概览：'];

    final buf = StringBuffer();
    if (isEn) {
      buf.writeln('# Point-by-Point Response to Reviewers\n');
      buf.writeln(
          '> **Revision Summary**: ${diff.changedBlocks} modified blocks (+${diff.addedChars} / -${diff.removedChars} chars).\n');
      for (var i = 0; i < list.length; i++) {
        buf.writeln('## Comment ${i + 1}');
        buf.writeln('**Reviewer:** ${list[i]}\n');
        buf.writeln(
            '**Response:** Thank you for this insightful suggestion. We have revised the manuscript accordingly.\n');
      }
    } else {
      buf.writeln('# 审稿人 / 导师意见逐条返修说明（Response Letter 草稿）\n');
      buf.writeln(
          '> **本次修回改动概览**：共修改 ${diff.changedBlocks} 处变动（+${diff.addedChars} 字 / -${diff.removedChars} 字）。\n');
      for (var i = 0; i < list.length; i++) {
        buf.writeln('## 意见 ${i + 1}');
        buf.writeln('**审稿/导师意见：** ${list[i]}\n');
        buf.writeln('**回复与修改说明：** 非常感谢专家的宝贵建议！我们已据此补充定量实验对比并完善正文表述。\n');
      }
    }
    return buf.toString();
  }
}

extension _StringCharactersFallback on String {
  String get charactersTake2000 => length <= 2000 ? this : substring(0, 2000);
}
