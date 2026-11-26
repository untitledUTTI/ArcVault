class PhraseItem {
  const PhraseItem({
    required this.id,
    required this.en,
    required this.zh,
    required this.sectionTitle,
    this.moveTitle = '',
    this.tense = 'Present',
  });

  final String id;
  final String en;
  final String zh;
  final String sectionTitle;
  final String moveTitle;
  final String tense;
}

class PhraseSectionDef {
  const PhraseSectionDef({
    required this.id,
    required this.titleCn,
    required this.titleEn,
    required this.phrases,
  });

  final String id;
  final String titleCn;
  final String titleEn;
  final List<PhraseItem> phrases;
}

class PlaceholderValues {
  const PlaceholderValues({
    this.x = '',
    this.y = '',
    this.z = '',
    this.author = '',
    this.year = '',
    this.author2 = '',
    this.year2 = '',
  });

  final String x;
  final String y;
  final String z;
  final String author;
  final String year;
  final String author2;
  final String year2;

  PlaceholderValues copyWith({
    String? x,
    String? y,
    String? z,
    String? author,
    String? year,
    String? author2,
    String? year2,
  }) =>
      PlaceholderValues(
        x: x ?? this.x,
        y: y ?? this.y,
        z: z ?? this.z,
        author: author ?? this.author,
        year: year ?? this.year,
        author2: author2 ?? this.author2,
        year2: year2 ?? this.year2,
      );

  String apply(String input) {
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

class PhrasebankData {
  PhrasebankData._();

  static const List<PhraseSectionDef> sections = [
    PhraseSectionDef(
      id: 'writing-abstracts',
      titleCn: '摘要 · 五要素',
      titleEn: 'Writing Abstracts',
      phrases: [
        PhraseItem(
          id: 'abs_1',
          sectionTitle: '摘要',
          moveTitle: '研究背景与目的',
          en: 'This paper addresses the problem of X by proposing a novel framework based on Y.',
          zh: '针对 X 问题，本文提出了一种基于 Y 的新框架。',
        ),
        PhraseItem(
          id: 'abs_2',
          sectionTitle: '摘要',
          moveTitle: '定量结果',
          en: 'Experimental results on benchmark datasets demonstrate that the proposed method outperforms state-of-the-art baselines by Z%.',
          zh: '在基准数据集上的实验结果表明，所提方法相较现有最优基线提升了 Z%。',
          tense: 'Present',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'introducing-work',
      titleCn: '引言 · CARS 引出研究',
      titleEn: 'Introducing Work',
      phrases: [
        PhraseItem(
          id: 'intro_1',
          sectionTitle: '引言',
          moveTitle: '建立领域共识',
          en: 'In recent years, there has been growing interest in X due to its crucial role in Y.',
          zh: '近年来，鉴于 X 在 Y 中的关键作用，学术界对其关注度持续提升。',
        ),
        PhraseItem(
          id: 'intro_2',
          sectionTitle: '引言',
          moveTitle: '指出研究缺口',
          en: 'However, far too little attention has been paid to X under constrained conditions.',
          zh: '然而，现有研究对受限条件下的 X 仍缺乏充分探讨。',
        ),
        PhraseItem(
          id: 'intro_3',
          sectionTitle: '引言',
          moveTitle: '本文贡献',
          en: 'The remainder of this paper is organized as follows. Section 2 reviews related work, and Section 3 details our methodology.',
          zh: '本文其余部分安排如下：第 2 节综述相关工作，第 3 节详述本文方法。',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'reviewing-literature',
      titleCn: '文献综述 · 评述综合',
      titleEn: 'Reviewing Literature',
      phrases: [
        PhraseItem(
          id: 'lit_1',
          sectionTitle: '文献综述',
          moveTitle: '前人方法总结',
          en: 'Smith (2020) demonstrated that X significantly improves Y across diverse scenarios.',
          zh: 'Smith (2020) 证明了 X 在多种场景下均能显著提升 Y。',
          tense: 'Past',
        ),
        PhraseItem(
          id: 'lit_2',
          sectionTitle: '文献综述',
          moveTitle: '批判与对比',
          en: 'In contrast to Jones (2019), our formulation explicitly accounts for Z without incurring additional overhead.',
          zh: '与 Jones (2019) 不同，本文公式在不增加额外开销的前提下显式建模了 Z。',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'describing-methods',
      titleCn: '研究方法 · 设计流程',
      titleEn: 'Describing Methods',
      phrases: [
        PhraseItem(
          id: 'mth_1',
          sectionTitle: '研究方法',
          moveTitle: '流程描述',
          en: 'To mitigate the impact of X, we adopt a two-stage strategy consisting of Y and Z.',
          zh: '为缓解 X 的影响，本文采用由 Y 与 Z 构成的两阶段策略。',
        ),
        PhraseItem(
          id: 'mth_2',
          sectionTitle: '研究方法',
          moveTitle: '实验设置',
          en: 'All experiments were conducted under identical hardware configurations and repeated three times to ensure reproducibility.',
          zh: '所有实验均在相同硬件配置下重复三次取均值，以确保可复现性。',
          tense: 'Past',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'reporting-results',
      titleCn: '结果报告 · 数据对比',
      titleEn: 'Reporting Results',
      phrases: [
        PhraseItem(
          id: 'res_1',
          sectionTitle: '实验结果',
          moveTitle: '图表指引',
          en: 'As shown in Table 1, our approach achieves consistent gains in both accuracy and storage efficiency.',
          zh: '如表 1 所示，本文方法在准确率与存储效率两方面均取得稳定提升。',
        ),
        PhraseItem(
          id: 'res_2',
          sectionTitle: '实验结果',
          moveTitle: '消融分析',
          en: 'Ablation studies confirm that removing module X leads to a noticeable degradation in Y.',
          zh: '消融实验证实，移除模块 X 会导致指标 Y 出现明显下降。',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'discussing-findings',
      titleCn: '结果讨论 · 谨慎阐释',
      titleEn: 'Discussing Findings',
      phrases: [
        PhraseItem(
          id: 'dis_1',
          sectionTitle: '讨论',
          moveTitle: '谨慎推论',
          en: 'These findings suggest that X may play a pivotal role in stabilizing Y.',
          zh: '上述发现表明，X 可能在稳定 Y 方面发挥关键作用。',
        ),
        PhraseItem(
          id: 'dis_2',
          sectionTitle: '讨论',
          moveTitle: '研究局限性',
          en: 'A limitation of this study is that experiments were restricted to X; future work will explore Y.',
          zh: '本研究的局限性在于实验仅覆盖 X，后续工作将进一步拓展至 Y。',
        ),
      ],
    ),
    PhraseSectionDef(
      id: 'writing-conclusions',
      titleCn: '结论与致谢',
      titleEn: 'Conclusions & Ack',
      phrases: [
        PhraseItem(
          id: 'con_1',
          sectionTitle: '结论',
          moveTitle: '核心总结',
          en: 'In summary, we have presented a practical and verifiable framework for X that bridges the gap between Y and Z.',
          zh: '综上所述，本文提出了一种实用且可验证的 X 框架，有效弥合了 Y 与 Z 之间的鸿沟。',
        ),
      ],
    ),
  ];

  static List<PhraseItem> search(String query) {
    final q = query.trim().toLowerCase();
    final all = sections.expand((s) => s.phrases).toList();
    if (q.isEmpty) return all;
    return all
        .where((p) =>
            p.en.toLowerCase().contains(q) ||
            p.zh.toLowerCase().contains(q) ||
            p.sectionTitle.toLowerCase().contains(q) ||
            p.moveTitle.toLowerCase().contains(q))
        .toList();
  }

  static List<PhraseItem> recommendForText(String text) {
    final lower = text.toLowerCase();
    if (lower.contains('abstract') || text.contains('摘要')) {
      return [...sections[0].phrases, ...sections[1].phrases];
    }
    if (lower.contains('method') || text.contains('方法') || text.contains('目标函数')) {
      return [...sections[3].phrases, ...sections[4].phrases];
    }
    if (lower.contains('result') || text.contains('实验') || text.contains('消融')) {
      return [...sections[4].phrases, ...sections[5].phrases];
    }
    if (lower.contains('conclusion') || text.contains('结论')) {
      return sections[6].phrases;
    }
    return sections.expand((s) => s.phrases.take(1)).toList();
  }
}
