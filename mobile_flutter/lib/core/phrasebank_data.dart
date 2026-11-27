class PhraseItem {
  const PhraseItem({
    required this.id,
    required this.en,
    required this.zh,
    required this.sectionId,
    required this.sectionTitle,
    this.moveTitle = '',
    this.tense = 'Present',
    this.tone = 'neutral', // 'cautious' | 'neutral' | 'assertive'
    this.isCore = false,
  });

  final String id;
  final String en;
  final String zh;
  final String sectionId;
  final String sectionTitle;
  final String moveTitle;
  final String tense;
  final String tone;
  final bool isCore;
}

class PhraseBuilderColumn {
  const PhraseBuilderColumn({
    required this.labelCn,
    required this.labelEn,
    required this.options,
  });

  final String labelCn;
  final String labelEn;
  final List<String> options;
}

class PhraseBuilderDef {
  const PhraseBuilderDef({
    required this.id,
    required this.titleCn,
    required this.titleEn,
    required this.descCn,
    required this.sectionId,
    required this.skeletonSlot,
    required this.columns,
  });

  final String id;
  final String titleCn;
  final String titleEn;
  final String descCn;
  final String sectionId;
  final String skeletonSlot;
  final List<PhraseBuilderColumn> columns;

  String assemble(List<int> indices) {
    final parts = <String>[];
    for (var i = 0; i < columns.length; i++) {
      final opts = columns[i].options;
      final idx = (i < indices.length ? indices[i] : 0).clamp(0, opts.length - 1);
      final val = opts[idx];
      if (val != '(omit)') {
        parts.add(val);
      }
    }
    return parts.join(' ').replaceAll(' ,', ',').replaceAll(' .', '.');
  }
}

class PhraseSectionDef {
  const PhraseSectionDef({
    required this.id,
    required this.titleCn,
    required this.titleEn,
    required this.shortCn,
    required this.summaryCn,
    required this.skeletonSlot,
    required this.phrases,
    this.builders = const [],
    this.isFunction = false,
  });

  final String id;
  final String titleCn;
  final String titleEn;
  final String shortCn;
  final String summaryCn;
  final String skeletonSlot;
  final List<PhraseItem> phrases;
  final List<PhraseBuilderDef> builders;
  final bool isFunction;
}

class PlaceholderValues {
  const PlaceholderValues({
    this.enabled = true,
    this.x = '',
    this.y = '',
    this.z = '',
    this.author = '',
    this.year = '',
    this.author2 = '',
    this.year2 = '',
  });

  final bool enabled;
  final String x;
  final String y;
  final String z;
  final String author;
  final String year;
  final String author2;
  final String year2;

  bool get hasAny =>
      x.trim().isNotEmpty ||
      y.trim().isNotEmpty ||
      z.trim().isNotEmpty ||
      author.trim().isNotEmpty ||
      year.trim().isNotEmpty ||
      author2.trim().isNotEmpty ||
      year2.trim().isNotEmpty;

  PlaceholderValues copyWith({
    bool? enabled,
    String? x,
    String? y,
    String? z,
    String? author,
    String? year,
    String? author2,
    String? year2,
  }) =>
      PlaceholderValues(
        enabled: enabled ?? this.enabled,
        x: x ?? this.x,
        y: y ?? this.y,
        z: z ?? this.z,
        author: author ?? this.author,
        year: year ?? this.year,
        author2: author2 ?? this.author2,
        year2: year2 ?? this.year2,
      );

  String apply(String input) {
    if (!enabled) return input;
    var out = input;
    if (x.trim().isNotEmpty) out = out.replaceAll(RegExp(r'\bX\b'), x.trim());
    if (y.trim().isNotEmpty) out = out.replaceAll(RegExp(r'\bY\b'), y.trim());
    if (z.trim().isNotEmpty) out = out.replaceAll(RegExp(r'\bZ\b'), z.trim());
    if (author.trim().isNotEmpty) out = out.replaceAll(RegExp(r'\bSmith\b'), author.trim());
    if (year.trim().isNotEmpty) out = out.replaceAll(RegExp(r'\b2020\b'), year.trim());
    if (author2.trim().isNotEmpty) out = out.replaceAll(RegExp(r'\bJones\b'), author2.trim());
    if (year2.trim().isNotEmpty) out = out.replaceAll(RegExp(r'\b2019\b'), year2.trim());
    return out;
  }
}

class DetectedHeadingSection {
  const DetectedHeadingSection({
    required this.title,
    required this.mappedSectionId,
    required this.mappedLabel,
    required this.wordCount,
  });

  final String title;
  final String mappedSectionId;
  final String mappedLabel;
  final int wordCount;
}

class AcademicIssueItem {
  const AcademicIssueItem({
    required this.id,
    required this.kind,
    required this.severity, // 'warning' | 'suggestion' | 'info'
    required this.matchedText,
    required this.titleCn,
    required this.titleEn,
    required this.explanationCn,
    required this.explanationEn,
    required this.replacements,
  });

  final String id;
  final String kind;
  final String severity;
  final String matchedText;
  final String titleCn;
  final String titleEn;
  final String explanationCn;
  final String explanationEn;
  final List<String> replacements;
}

class ContextAdvice {
  const ContextAdvice({
    required this.id,
    required this.category,
    required this.title,
    required this.rationale,
    this.suggestedRewrite,
    this.recommendedPhrases = const [],
  });

  final String id;
  final String category; // 'academic-tone' | 'logic-cohesion' | 'clarity-conciseness' | 'section-structure'
  final String title;
  final String rationale;
  final String? suggestedRewrite;
  final List<String> recommendedPhrases;
}

class CustomPhraseItem {
  const CustomPhraseItem({
    required this.id,
    required this.en,
    required this.zh,
    required this.sectionLabel,
    required this.tone,
  });

  final String id;
  final String en;
  final String zh;
  final String sectionLabel;
  final String tone;

  Map<String, dynamic> toJson() => {
        'id': id,
        'en': en,
        'zh': zh,
        'sectionLabel': sectionLabel,
        'tone': tone,
      };

  factory CustomPhraseItem.fromJson(Map<String, dynamic> json) => CustomPhraseItem(
        id: json['id']?.toString() ?? '',
        en: json['en']?.toString() ?? '',
        zh: json['zh']?.toString() ?? '',
        sectionLabel: json['sectionLabel']?.toString() ?? 'Custom',
        tone: json['tone']?.toString() ?? 'neutral',
      );
}

class SkeletonSlotItem {
  const SkeletonSlotItem({
    required this.id,
    required this.slotId,
    required this.text,
    required this.sourceLabel,
  });

  final String id;
  final String slotId;
  final String text;
  final String sourceLabel;

  SkeletonSlotItem copyWith({String? text}) => SkeletonSlotItem(
        id: id,
        slotId: slotId,
        text: text ?? this.text,
        sourceLabel: sourceLabel,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'slotId': slotId,
        'text': text,
        'sourceLabel': sourceLabel,
      };

  factory SkeletonSlotItem.fromJson(Map<String, dynamic> json) => SkeletonSlotItem(
        id: json['id']?.toString() ?? '',
        slotId: json['slotId']?.toString() ?? 'intro',
        text: json['text']?.toString() ?? '',
        sourceLabel: json['sourceLabel']?.toString() ?? '',
      );
}

class PhrasebankData {
  PhrasebankData._();

  static const List<({String id, String labelCn, String labelEn})> skeletonSlots = [
    (id: 'abstract', labelCn: '摘要 Abstract', labelEn: 'Abstract'),
    (id: 'intro', labelCn: '引言 Intro', labelEn: 'Introduction'),
    (id: 'literature', labelCn: '综述 Related', labelEn: 'Related Work'),
    (id: 'methods', labelCn: '方法 Methods', labelEn: 'Methods'),
    (id: 'results', labelCn: '结果 Results', labelEn: 'Results'),
    (id: 'discussion', labelCn: '讨论 Discussion', labelEn: 'Discussion'),
    (id: 'conclusion', labelCn: '结论 Conclusion', labelEn: 'Conclusion'),
  ];

  static const List<PhraseSectionDef> sections = [
    PhraseSectionDef(
      id: 'writing-abstracts',
      titleCn: '摘要 · 五要素结构',
      titleEn: 'Writing Abstracts',
      shortCn: '摘要',
      summaryCn: '覆盖背景动机、研究目标、核心方法、定量结果与结论影响五大核心要素。',
      skeletonSlot: 'abstract',
      phrases: [
        PhraseItem(
          id: 'abs_1',
          sectionId: 'writing-abstracts',
          sectionTitle: '摘要',
          moveTitle: '研究背景与目的',
          en: 'This paper addresses the problem of X by proposing a novel framework based on Y.',
          zh: '针对 X 问题，本文提出了一种基于 Y 的新框架。',
          isCore: true,
        ),
        PhraseItem(
          id: 'abs_2',
          sectionId: 'writing-abstracts',
          sectionTitle: '摘要',
          moveTitle: '定量结果',
          en: 'Experimental results on benchmark datasets demonstrate that the proposed method outperforms state-of-the-art baselines by Z%.',
          zh: '在基准数据集上的实验结果表明，所提方法相较现有最优基线提升了 Z%。',
          tone: 'assertive',
          isCore: true,
        ),
        PhraseItem(
          id: 'abs_3',
          sectionId: 'writing-abstracts',
          sectionTitle: '摘要',
          moveTitle: '应用与意义',
          en: 'These findings provide a practical foundation for advancing Y under resource-constrained settings.',
          zh: '上述发现为在资源受限场景下推进 Y 提供了切实可行的基础。',
          tone: 'cautious',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'introducing-work',
      titleCn: '引言 · CARS 引出研究',
      titleEn: 'Introducing Work',
      shortCn: '引言',
      summaryCn: '遵循 Swales CARS 模型：建立研究领域 → 指出研究缺口 → 阐明本文贡献与结构。',
      skeletonSlot: 'intro',
      builders: [
        PhraseBuilderDef(
          id: 'bld_intro',
          titleCn: '引言研究缺口拼句器',
          titleEn: 'Introduction Gap Builder',
          descCn: '自由组合转折词、研究关注度表达与核心缺口句式',
          sectionId: 'introducing-work',
          skeletonSlot: 'intro',
          columns: [
            PhraseBuilderColumn(
              labelCn: '转折衔接',
              labelEn: 'Transition',
              options: ['However,', 'Nevertheless,', 'Despite these advances,', '(omit)'],
            ),
            PhraseBuilderColumn(
              labelCn: '缺口程度',
              labelEn: 'Gap Scope',
              options: [
                'far too little attention has been paid to',
                'little is currently known about',
                'previous studies have largely overlooked',
              ],
            ),
            PhraseBuilderColumn(
              labelCn: '研究对象',
              labelEn: 'Subject',
              options: ['X in the context of Y.', 'the interplay between X and Y.', 'how X affects Z under Y.'],
            ),
          ],
        ),
      ],
      phrases: [
        PhraseItem(
          id: 'intro_1',
          sectionId: 'introducing-work',
          sectionTitle: '引言',
          moveTitle: '建立领域共识',
          en: 'In recent years, there has been growing interest in X due to its crucial role in Y.',
          zh: '近年来，鉴于 X 在 Y 中的关键作用，学术界对其关注度持续提升。',
          isCore: true,
        ),
        PhraseItem(
          id: 'intro_2',
          sectionId: 'introducing-work',
          sectionTitle: '引言',
          moveTitle: '指出研究缺口',
          en: 'However, far too little attention has been paid to X under constrained conditions.',
          zh: '然而，现有研究对受限条件下的 X 仍缺乏充分探讨。',
          tone: 'assertive',
          isCore: true,
        ),
        PhraseItem(
          id: 'intro_3',
          sectionId: 'introducing-work',
          sectionTitle: '引言',
          moveTitle: '研究问题陈述',
          en: 'The primary objective of this study is to investigate the impact of X on Y.',
          zh: '本研究的首要目标是探究 X 对 Y 的影响机制。',
        ),
        PhraseItem(
          id: 'intro_4',
          sectionId: 'introducing-work',
          sectionTitle: '引言',
          moveTitle: '本文结构安排',
          en: 'The remainder of this paper is organized as follows. Section 2 reviews related work, and Section 3 details our methodology.',
          zh: '本文其余部分安排如下：第 2 节综述相关工作，第 3 节详述本文方法。',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'reviewing-literature',
      titleCn: '文献综述 · 评述综合',
      titleEn: 'Reviewing Literature',
      shortCn: '文献综述',
      summaryCn: '客观归纳前人工作、对比不同学派观点并指出尚未解决的理论或工程瓶颈。',
      skeletonSlot: 'literature',
      builders: [
        PhraseBuilderDef(
          id: 'bld_lit',
          titleCn: '文献评述对比拼句器',
          titleEn: 'Literature Comparison Builder',
          descCn: '快速拼装引文主语、报告动词与研究发现',
          sectionId: 'reviewing-literature',
          skeletonSlot: 'literature',
          columns: [
            PhraseBuilderColumn(
              labelCn: '引文主语',
              labelEn: 'Citation',
              options: ['Smith (2020)', 'A seminal study by Smith (2020)', 'In contrast to Jones (2019), Smith (2020)'],
            ),
            PhraseBuilderColumn(
              labelCn: '报告动词',
              labelEn: 'Reporting Verb',
              options: ['demonstrated that', 'argued that', 'observed that', 'questioned whether'],
            ),
            PhraseBuilderColumn(
              labelCn: '核心结论',
              labelEn: 'Finding',
              options: [
                'X significantly improves Y.',
                'X alone is insufficient for Z.',
                'the effectiveness of X depends heavily on Y.',
              ],
            ),
          ],
        ),
      ],
      phrases: [
        PhraseItem(
          id: 'lit_1',
          sectionId: 'reviewing-literature',
          sectionTitle: '文献综述',
          moveTitle: '前人方法总结',
          en: 'Smith (2020) demonstrated that X significantly improves Y across diverse scenarios.',
          zh: 'Smith (2020) 证明了 X 在多种场景下均能显著提升 Y。',
          tense: 'Past',
          isCore: true,
        ),
        PhraseItem(
          id: 'lit_2',
          sectionId: 'reviewing-literature',
          sectionTitle: '文献综述',
          moveTitle: '批判与对比',
          en: 'In contrast to Jones (2019), our formulation explicitly accounts for Z without incurring additional overhead.',
          zh: '与 Jones (2019) 不同，本文公式在不增加额外开销的前提下显式建模了 Z。',
          tone: 'assertive',
          isCore: true,
        ),
        PhraseItem(
          id: 'lit_3',
          sectionId: 'reviewing-literature',
          sectionTitle: '文献综述',
          moveTitle: '综合多篇文献',
          en: 'Several studies (Smith, 2020; Jones, 2019) have highlighted the importance of X in stabilizing Y.',
          zh: '多项研究（Smith, 2020; Jones, 2019）均强调了 X 在稳定 Y 中的重要作用。',
          tense: 'PresentPerfect',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'describing-methods',
      titleCn: '研究方法 · 设计流程',
      titleEn: 'Describing Methods',
      shortCn: '研究方法',
      summaryCn: '清晰交代实验设计、数据处理、模型架构与可复现性细节（多用过去时或客观被动语态）。',
      skeletonSlot: 'methods',
      builders: [
        PhraseBuilderDef(
          id: 'bld_mth',
          titleCn: '方法合理性辩护拼句器',
          titleEn: 'Method Rationale Builder',
          descCn: '阐明选择特定方法、工具或实验协议的原因',
          sectionId: 'describing-methods',
          skeletonSlot: 'methods',
          columns: [
            PhraseBuilderColumn(
              labelCn: '目的导向',
              labelEn: 'Purpose',
              options: ['To mitigate the impact of X,', 'To ensure reproducibility,', 'Following the protocol of Smith (2020),'],
            ),
            PhraseBuilderColumn(
              labelCn: '动作主体',
              labelEn: 'Action',
              options: ['we adopt', 'we implemented', 'all samples were evaluated using'],
            ),
            PhraseBuilderColumn(
              labelCn: '具体方案',
              labelEn: 'Protocol',
              options: ['a two-stage strategy based on Y.', 'standardized parameters across Z.', 'cross-validation on Y.'],
            ),
          ],
        ),
      ],
      phrases: [
        PhraseItem(
          id: 'mth_1',
          sectionId: 'describing-methods',
          sectionTitle: '研究方法',
          moveTitle: '流程描述',
          en: 'To mitigate the impact of X, we adopt a two-stage strategy consisting of Y and Z.',
          zh: '为缓解 X 的影响，本文采用由 Y 与 Z 构成的两阶段策略。',
          isCore: true,
        ),
        PhraseItem(
          id: 'mth_2',
          sectionId: 'describing-methods',
          sectionTitle: '研究方法',
          moveTitle: '实验设置',
          en: 'All experiments were conducted under identical hardware configurations and repeated three times to ensure reproducibility.',
          zh: '所有实验均在相同硬件配置下重复三次取均值，以确保可复现性。',
          tense: 'Past',
          isCore: true,
        ),
        PhraseItem(
          id: 'mth_3',
          sectionId: 'describing-methods',
          sectionTitle: '研究方法',
          moveTitle: '参数与基线说明',
          en: 'Unless otherwise stated, all hyperparameters for Y were tuned on the validation split.',
          zh: '除非另有说明，Y 的所有超参数均在验证集上调优得到。',
          tense: 'Past',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'reporting-results',
      titleCn: '结果报告 · 数据对比',
      titleEn: 'Reporting Results',
      shortCn: '实验结果',
      summaryCn: '客观呈现定量表格、消融分析与显著性趋势，避免在结果段过度主观臆断。',
      skeletonSlot: 'results',
      phrases: [
        PhraseItem(
          id: 'res_1',
          sectionId: 'reporting-results',
          sectionTitle: '实验结果',
          moveTitle: '图表指引',
          en: 'As shown in Table 1, our approach achieves consistent gains in both accuracy and storage efficiency.',
          zh: '如表 1 所示，本文方法在准确率与存储效率两方面均取得稳定提升。',
          isCore: true,
        ),
        PhraseItem(
          id: 'res_2',
          sectionId: 'reporting-results',
          sectionTitle: '实验结果',
          moveTitle: '消融分析',
          en: 'Ablation studies confirm that removing module X leads to a noticeable degradation in Y.',
          zh: '消融实验证实，移除模块 X 会导致指标 Y 出现明显下降。',
          tone: 'assertive',
          isCore: true,
        ),
        PhraseItem(
          id: 'res_3',
          sectionId: 'reporting-results',
          sectionTitle: '实验结果',
          moveTitle: '例外与边界情况',
          en: 'Notably, no significant difference was observed between X and Y when Z exceeded the threshold.',
          zh: '值得注意的是，当 Z 超过阈值时，X 与 Y 之间未观察到显著差异。',
          tense: 'Past',
          tone: 'cautious',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'discussing-findings',
      titleCn: '结果讨论 · 谨慎阐释',
      titleEn: 'Discussing Findings',
      shortCn: '讨论',
      summaryCn: '使用恰当的模糊限制语（Hedging）解释机理、与文献互证并坦诚研究局限性。',
      skeletonSlot: 'discussion',
      builders: [
        PhraseBuilderDef(
          id: 'bld_dis',
          titleCn: '谨慎推论 (Hedging) 拼句器',
          titleEn: 'Hedging Interpretation Builder',
          descCn: '避免绝对化断言，用学术谨慎语气阐释实验发现',
          sectionId: 'discussing-findings',
          skeletonSlot: 'discussion',
          columns: [
            PhraseBuilderColumn(
              labelCn: '依据指引',
              labelEn: 'Basis',
              options: ['These findings', 'The observed trend', 'Taken together, these results'],
            ),
            PhraseBuilderColumn(
              labelCn: '谨慎动词',
              labelEn: 'Hedging Verb',
              options: ['suggest that', 'indicate that', 'lend support to the view that'],
            ),
            PhraseBuilderColumn(
              labelCn: '推论内容',
              labelEn: 'Claim',
              options: [
                'X may play a pivotal role in Y.',
                'X is likely associated with improvements in Z.',
                'the effect of X could be partially explained by Y.',
              ],
            ),
          ],
        ),
      ],
      phrases: [
        PhraseItem(
          id: 'dis_1',
          sectionId: 'discussing-findings',
          sectionTitle: '讨论',
          moveTitle: '谨慎推论',
          en: 'These findings suggest that X may play a pivotal role in stabilizing Y.',
          zh: '上述发现表明，X 可能在稳定 Y 方面发挥关键作用。',
          tone: 'cautious',
          isCore: true,
        ),
        PhraseItem(
          id: 'dis_2',
          sectionId: 'discussing-findings',
          sectionTitle: '讨论',
          moveTitle: '研究局限性',
          en: 'A limitation of this study is that experiments were restricted to X; future work will explore Y.',
          zh: '本研究的局限性在于实验仅覆盖 X，后续工作将进一步拓展至 Y。',
          tone: 'cautious',
          isCore: true,
        ),
        PhraseItem(
          id: 'dis_3',
          sectionId: 'discussing-findings',
          sectionTitle: '讨论',
          moveTitle: '与前人一致',
          en: 'This observation aligns well with Smith (2020), who reported a comparable trend in Y.',
          zh: '这一观察结果与 Smith (2020) 的报道高度一致，后者在 Y 中也发现了类似趋势。',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'writing-conclusions',
      titleCn: '结论与致谢',
      titleEn: 'Conclusions & Ack',
      shortCn: '结论',
      summaryCn: '凝练全文贡献、指出实际应用价值并提出切实可行的未来研究方向。',
      skeletonSlot: 'conclusion',
      phrases: [
        PhraseItem(
          id: 'con_1',
          sectionId: 'writing-conclusions',
          sectionTitle: '结论',
          moveTitle: '核心总结',
          en: 'In summary, we have presented a practical and verifiable framework for X that bridges the gap between Y and Z.',
          zh: '综上所述，本文提出了一种实用且可验证的 X 框架，有效弥合了 Y 与 Z 之间的鸿沟。',
          tense: 'PresentPerfect',
          isCore: true,
        ),
        PhraseItem(
          id: 'con_2',
          sectionId: 'writing-conclusions',
          sectionTitle: '结论',
          moveTitle: '未来展望',
          en: 'Future research should investigate how X scales to larger Y settings.',
          zh: '未来研究可进一步探索 X 如何扩展至更大规模的 Y 场景。',
          tone: 'cautious',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'comparing-contrasting',
      titleCn: '修辞功能 · 对比与对照',
      titleEn: 'Comparing & Contrasting',
      shortCn: '对比对照',
      summaryCn: '通用学术修辞：用于文献对比、基线比较与多组实验差异阐述。',
      skeletonSlot: 'results',
      isFunction: true,
      phrases: [
        PhraseItem(
          id: 'cmp_1',
          sectionId: 'comparing-contrasting',
          sectionTitle: '对比',
          moveTitle: '指出相似性',
          en: 'Similarly, X exhibits a consistent pattern when evaluated under Y.',
          zh: '类似地，X 在 Y 条件下也呈现出一致的变化规律。',
        ),
        PhraseItem(
          id: 'cmp_2',
          sectionId: 'comparing-contrasting',
          sectionTitle: '对比',
          moveTitle: '指出显著差异',
          en: 'Whereas Smith (2020) relies on X, our approach directly optimizes Y.',
          zh: 'Smith (2020) 依赖 X，而本文方法则直接对 Y 进行优化。',
          isCore: true,
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'being-critical',
      titleCn: '修辞功能 · 批判性评价',
      titleEn: 'Being Critical',
      shortCn: '批判评价',
      summaryCn: '以学术礼貌、客观精准的措辞指出已有工作的假设前提或不足之处。',
      skeletonSlot: 'literature',
      isFunction: true,
      phrases: [
        PhraseItem(
          id: 'crt_1',
          sectionId: 'being-critical',
          sectionTitle: '批判评价',
          moveTitle: '指出方法前提受限',
          en: 'A major drawback of this approach is its reliance on X, which rarely holds in Y.',
          zh: '该方法的一个主要不足在于其高度依赖 X，而这一前提在 Y 中往往难以成立。',
          tone: 'assertive',
          isCore: true,
        ),
        PhraseItem(
          id: 'crt_2',
          sectionId: 'being-critical',
          sectionTitle: '批判评价',
          moveTitle: '委婉质疑',
          en: 'It remains unclear whether the conclusions of Smith (2020) generalize beyond X.',
          zh: 'Smith (2020) 的结论是否能够推广至 X 以外的场景仍有待商榷。',
          tone: 'cautious',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'signalling-transition',
      titleCn: '修辞功能 · 逻辑衔接',
      titleEn: 'Signalling Transition',
      shortCn: '逻辑衔接',
      summaryCn: '增强段落与句间连贯性，清晰引导读者理解递进、转折与因果脉络。',
      skeletonSlot: 'intro',
      isFunction: true,
      phrases: [
        PhraseItem(
          id: 'trn_1',
          sectionId: 'signalling-transition',
          sectionTitle: '逻辑衔接',
          moveTitle: '递进补充',
          en: 'Furthermore, empirical evidence indicates that X contributes directly to Y.',
          zh: '此外，实证证据表明 X 对 Y 具有直接贡献。',
          isCore: true,
        ),
        PhraseItem(
          id: 'trn_2',
          sectionId: 'signalling-transition',
          sectionTitle: '逻辑衔接',
          moveTitle: '因果推导',
          en: 'Consequently, optimizing X becomes indispensable for achieving reliable Y.',
          zh: '因此，优化 X 成为实现可靠 Y 不可或缺的关键步骤。',
        ),
      ],
    ),
  ];

  // Reference Tools Data
  static const List<({String everyday, String academic, String categoryCn})> everydayToAcademic = [
    (everyday: 'a lot of / lots of', academic: 'substantial / considerable / numerous', categoryCn: '数量程度'),
    (everyday: 'big / large', academic: 'pronounced / substantial / extensive', categoryCn: '规模程度'),
    (everyday: 'good', academic: 'beneficial / effective / favorable', categoryCn: '正面评价'),
    (everyday: 'bad', academic: 'detrimental / adverse / suboptimal', categoryCn: '负面评价'),
    (everyday: 'get', academic: 'obtain / acquire / derive', categoryCn: '动词升级'),
    (everyday: 'show', academic: 'demonstrate / illustrate / reveal', categoryCn: '动词升级'),
    (everyday: 'use', academic: 'utilize / employ / adopt', categoryCn: '动词升级'),
    (everyday: 'find out', academic: 'ascertain / determine / establish', categoryCn: '动词升级'),
    (everyday: 'very', academic: 'notably / markedly / significantly', categoryCn: '副词修饰'),
    (everyday: 'but', academic: 'however / nevertheless / whereas', categoryCn: '转折衔接'),
    (everyday: 'so', academic: 'consequently / therefore / hence', categoryCn: '因果衔接'),
  ];

  static const List<({String categoryCn, String categoryEn, String words, String grammarTipCn})> connectorsMatrix = [
    (
      categoryCn: '转折与对比',
      categoryEn: 'Contrast',
      words: 'However / Nevertheless / Whereas / While / In contrast',
      grammarTipCn: 'However / In contrast 后接逗号引导完整句；Whereas / While 连接两个对比分句；Despite 后接名词短语。',
    ),
    (
      categoryCn: '递进与补充',
      categoryEn: 'Addition',
      words: 'Furthermore / Moreover / In addition / Beyond that',
      grammarTipCn: '用于句首补充同向论据，后接逗号；避免连续在相邻句重复使用 Moreover。',
    ),
    (
      categoryCn: '因果与推论',
      categoryEn: 'Cause & Effect',
      words: 'Consequently / Therefore / Thus / Hence / Owing to',
      grammarTipCn: 'Owing to / Due to 后接名词或动名词短语；Therefore / Consequently 引导独立结果句。',
    ),
    (
      categoryCn: '让步与限定',
      categoryEn: 'Concession',
      words: 'Although / Even though / Notwithstanding / Granted that',
      grammarTipCn: '英文中 Although 与 but 不可同时连用（常见中式英语错误）。',
    ),
  ];

  static const List<({String pair, String summaryCn, String detailEn})> confusedWords = [
    (
      pair: 'affect vs. effect',
      summaryCn: 'affect 通常作动词“影响”；effect 通常作名词“效果/影响”（作动词意为“促成”）。',
      detailEn: 'X affects Y. / X has a pronounced effect on Y.',
    ),
    (
      pair: 'comprise vs. compose',
      summaryCn: '整体 comprise 部分（不用 of）；部分 compose 整体，或整体 be composed of 部分。',
      detailEn: 'The framework comprises three modules. / It is composed of three modules.',
    ),
    (
      pair: 'imply vs. infer',
      summaryCn: '作者/数据 imply（暗示/表明）；读者/研究者 infer（推断）。',
      detailEn: 'The results imply that X holds. / We infer from Table 1 that Y.',
    ),
    (
      pair: 'fewer vs. less',
      summaryCn: 'fewer 修饰可数名词复数；less 修饰不可数名词或连续数值。',
      detailEn: 'fewer iterations, fewer samples vs. less overhead, less memory.',
    ),
  ];

  static const List<({String bre, String use})> usBreSpelling = [
    (bre: 'analyse', use: 'analyze'),
    (bre: 'behaviour', use: 'behavior'),
    (bre: 'centre', use: 'center'),
    (bre: 'modelling', use: 'modeling'),
    (bre: 'optimise', use: 'optimize'),
    (bre: 'programme (general)', use: 'program'),
  ];

  static const List<String> evidenceTypes = [
    'empirical',
    'experimental',
    'quantitative',
    'anecdotal',
    'compelling',
    'preliminary',
  ];
  static const List<String> evidencePredicates = [
    'consistent with prior work',
    'inconclusive under noise',
    'statistically significant',
    'strongly supportive of hypothesis H1',
  ];
  static const List<String> evidenceVerbs = [
    'suggests that',
    'demonstrates that',
    'corroborates the claim that',
    'casts doubt on the assumption that',
  ];

  static List<PhraseItem> get allPhrases => sections.expand((s) => s.phrases).toList();

  static List<PhraseItem> search(
    String query, {
    String tone = 'all',
    bool coreOnly = false,
  }) {
    final q = query.trim().toLowerCase();
    return allPhrases.where((p) {
      if (tone != 'all' && p.tone != tone) return false;
      if (coreOnly && !p.isCore) return false;
      if (q.isEmpty) return true;
      return p.en.toLowerCase().contains(q) ||
          p.zh.toLowerCase().contains(q) ||
          p.sectionTitle.toLowerCase().contains(q) ||
          p.moveTitle.toLowerCase().contains(q);
    }).toList();
  }

  static List<PhraseItem> recommendForText(String text) {
    final lower = text.toLowerCase();
    if (lower.contains('abstract') || text.contains('摘要')) {
      return [...sections[0].phrases, ...sections[1].phrases];
    }
    if (lower.contains('related') || lower.contains('literature') || text.contains('综述')) {
      return [...sections[2].phrases, ...sections[8].phrases];
    }
    if (lower.contains('method') || text.contains('方法') || text.contains('目标函数')) {
      return [...sections[3].phrases, ...sections[4].phrases];
    }
    if (lower.contains('result') || text.contains('实验') || text.contains('消融')) {
      return [...sections[4].phrases, ...sections[5].phrases];
    }
    if (lower.contains('discussion') || text.contains('讨论')) {
      return [...sections[5].phrases, ...sections[6].phrases];
    }
    if (lower.contains('conclusion') || text.contains('结论')) {
      return sections[6].phrases;
    }
    return sections.expand((s) => s.phrases.take(1)).toList();
  }
}

class PhrasebankAnalyzer {
  PhrasebankAnalyzer._();

  static List<DetectedHeadingSection> detectPaperSections(String text) {
    if (text.trim().isEmpty) return const [];
    final lines = text.split(RegExp(r'\r?\n'));
    final result = <DetectedHeadingSection>[];
    for (final raw in lines) {
      final line = raw.trim();
      String? title;
      final md = RegExp(r'^#{1,4}\s+(.+)$').firstMatch(line);
      if (md != null) {
        title = md.group(1)!.trim();
      } else {
        final tex = RegExp(r'^\\(?:section|subsection)\*?\{([^}]+)\}').firstMatch(line);
        if (tex != null) title = tex.group(1)!.trim();
      }
      if (title == null || title.isEmpty) continue;
      final mapped = _mapHeadingToSectionId(title);
      result.add(DetectedHeadingSection(
        title: title,
        mappedSectionId: mapped.$1,
        mappedLabel: mapped.$2,
        wordCount: title.split(RegExp(r'\s+')).length,
      ));
    }
    return result;
  }

  static (String, String) _mapHeadingToSectionId(String title) {
    final l = title.toLowerCase();
    if (l.contains('abstract') || title.contains('摘要')) {
      return ('writing-abstracts', '摘要');
    }
    if (l.contains('intro') || title.contains('引言') || title.contains('绪论')) {
      return ('introducing-work', '引言');
    }
    if (l.contains('related') || l.contains('literature') || title.contains('综述')) {
      return ('reviewing-literature', '文献综述');
    }
    if (l.contains('method') || l.contains('approach') || title.contains('方法') || title.contains('设计')) {
      return ('describing-methods', '研究方法');
    }
    if (l.contains('result') || l.contains('experiment') || title.contains('实验') || title.contains('结果')) {
      return ('reporting-results', '实验结果');
    }
    if (l.contains('discuss') || title.contains('讨论')) {
      return ('discussing-findings', '讨论');
    }
    if (l.contains('conclu') || title.contains('结论')) {
      return ('writing-conclusions', '结论');
    }
    return ('introducing-work', '通用正文');
  }

  static List<AcademicIssueItem> analyzeAcademicIssues(String text) {
    final slice = text.length > 4000 ? text.substring(0, 4000) : text;
    final issues = <AcademicIssueItem>[];
    var idx = 0;

    final contractions = {
      "don't": 'do not',
      "can't": 'cannot',
      "won't": 'will not',
      "it's": 'it is',
      "isn't": 'is not',
      "aren't": 'are not',
      "we've": 'we have',
      "they're": 'they are',
    };
    for (final entry in contractions.entries) {
      final m = RegExp('\\b${RegExp.escape(entry.key)}\\b', caseSensitive: false).firstMatch(slice);
      if (m != null) {
        issues.add(AcademicIssueItem(
          id: 'iss_${idx++}',
          kind: 'contraction',
          severity: 'warning',
          matchedText: m.group(0)!,
          titleCn: '避免英文缩略形式',
          titleEn: 'Avoid Contraction',
          explanationCn: '学术论文正文中应展开缩略词 "${m.group(0)}" 为 "${entry.value}"。',
          explanationEn: 'Expand "${m.group(0)}" to "${entry.value}" in formal academic prose.',
          replacements: [entry.value],
        ));
      }
    }

    final everydayMap = {
      'a lot of': ['substantial', 'considerable'],
      'very big': ['substantial', 'pronounced'],
      'good': ['effective', 'beneficial'],
      'showed': ['demonstrated', 'revealed'],
      'used': ['utilized', 'employed'],
      '我觉得': ['本文认为', '本研究指出'],
      '很多': ['大量', '诸多'],
      '搞定': ['实现', '完成'],
    };
    for (final entry in everydayMap.entries) {
      final isAscii = RegExp(r'^[a-zA-Z\s]+$').hasMatch(entry.key);
      final pattern = isAscii
          ? RegExp('\\b${RegExp.escape(entry.key)}\\b', caseSensitive: false)
          : RegExp(RegExp.escape(entry.key));
      final m = pattern.firstMatch(slice);
      if (m != null) {
        issues.add(AcademicIssueItem(
          id: 'iss_${idx++}',
          kind: 'everyday',
          severity: 'suggestion',
          matchedText: m.group(0)!,
          titleCn: '口语化表达可升级为学术用语',
          titleEn: 'Colloquial Expression',
          explanationCn: '建议将 "${m.group(0)}" 替换为更正式的学术表达。',
          explanationEn: 'Consider upgrading "${m.group(0)}" to a more formal academic term.',
          replacements: entry.value,
        ));
      }
    }

    return issues;
  }

  static ({String summary, List<ContextAdvice> advice}) analyzeContextAndSuggest(
    String text, {
    required bool isZh,
  }) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) {
      return (
        summary: isZh ? '当前文档为空，输入内容后即可进行学术语体与结构诊断。' : 'Document is empty. Add text to run analysis.',
        advice: const [],
      );
    }

    final issues = analyzeAcademicIssues(trimmed);
    final sections = detectPaperSections(trimmed);
    final advice = <ContextAdvice>[];

    if (issues.isNotEmpty) {
      advice.add(ContextAdvice(
        id: 'adv_tone',
        category: 'academic-tone',
        title: isZh ? '检测到 ${issues.length} 处可学术化润色的表达' : 'Found ${issues.length} tone upgrade opportunities',
        rationale: isZh
            ? '文稿中出现「${issues.take(3).map((e) => e.matchedText).join(' / ')}」等偏口语或缩略表达，建议统一替换为学术书面语。'
            : 'Detected informal or contracted terms (${issues.take(3).map((e) => e.matchedText).join(', ')}).',
        suggestedRewrite: issues.first.replacements.isNotEmpty ? issues.first.replacements.first : null,
      ));
    }

    final hasContrast = RegExp(r'\b(however|nevertheless|whereas|in contrast)\b|然而|相比之下', caseSensitive: false)
        .hasMatch(trimmed);
    if (!hasContrast) {
      advice.add(ContextAdvice(
        id: 'adv_cohesion',
        category: 'logic-cohesion',
        title: isZh ? '建议补充转折与对比衔接句' : 'Add Contrast / Transition Signposting',
        rationale: isZh
            ? '当前上下文缺少显式的转折或基线对比信号词，加入过渡句可显著提升论证推进感。'
            : 'Adding explicit transition signals strengthens logical flow between claims.',
        recommendedPhrases: const [
          'However, far too little attention has been paid to X under constrained conditions.',
          'In contrast to Jones (2019), our formulation explicitly accounts for Z without incurring additional overhead.',
        ],
      ));
    }

    final hasHedging = RegExp(r'\b(may|might|suggest|indicate|appear|likely)\b|可能|表明', caseSensitive: false)
        .hasMatch(trimmed);
    if (!hasHedging) {
      advice.add(ContextAdvice(
        id: 'adv_hedge',
        category: 'clarity-conciseness',
        title: isZh ? '适当引入学术谨慎限定语 (Hedging)' : 'Consider Academic Hedging',
        rationale: isZh
            ? '在阐释实验结论或外推规律时，适度使用 suggest / may / indicate 能有效避免过度断言。'
            : 'Hedging verbs (suggest, indicate, may) protect claims from overstatement.',
        recommendedPhrases: const [
          'These findings suggest that X may play a pivotal role in stabilizing Y.',
          'A limitation of this study is that experiments were restricted to X; future work will explore Y.',
        ],
      ));
    }

    if (sections.isEmpty) {
      advice.add(ContextAdvice(
        id: 'adv_struct',
        category: 'section-structure',
        title: isZh ? '建议补充清晰的章节标题结构' : 'Add Clear Section Headings',
        rationale: isZh
            ? '暂未识别到 Markdown（## 引言）或 LaTeX（\\section{...}）标题，添加后句库可自动匹配对应章节语境。'
            : 'Adding Markdown or LaTeX headings enables automatic section-aware phrase matching.',
      ));
    }

    final summary = isZh
        ? '已完成本地学术规则诊断：识别 ${sections.length} 个章节标题，发现 ${issues.length} 处语体可优化项，生成 ${advice.length} 条可执行建议。'
        : 'Offline analysis complete: ${sections.length} headings detected, ${issues.length} style items, ${advice.length} suggestions.';

    return (summary: summary, advice: advice);
  }
}
