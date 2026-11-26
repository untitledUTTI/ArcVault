import 'dart:convert';
import '../models/archive_models.dart';
import 'cas_store.dart';
import 'ooxml_engine.dart';
import 'vault_crypto.dart';

class DemoSeedResult {
  const DemoSeedResult({
    required this.cas,
    required this.documents,
    required this.branches,
    required this.snapshots,
    required this.darlings,
    required this.motivations,
    required this.linkedAssets,
    required this.writingActivity,
  });

  final CasObjectStore cas;
  final List<ArchiveDocument> documents;
  final List<Branch> branches;
  final List<Snapshot> snapshots;
  final List<DeletedDarling> darlings;
  final List<MotivationAttachment> motivations;
  final List<LinkedAsset> linkedAssets;
  final List<WritingActivityDay> writingActivity;
}

class DemoSeed {
  DemoSeed._();

  static const List<Space> defaultSpaces = [
    Space(
      id: 'sp_paper',
      kind: SpaceKind.paper,
      nameZh: '论文工作区',
      nameEn: 'Thesis Studio',
      aiPolicy: AiPrivacyPolicy.cloudOrLocal,
    ),
    Space(
      id: 'sp_office',
      kind: SpaceKind.office,
      nameZh: '办公文档',
      nameEn: 'Office Docs',
      aiPolicy: AiPrivacyPolicy.cloudOrLocal,
    ),
    Space(
      id: 'sp_writing',
      kind: SpaceKind.writing,
      nameZh: '写作笔记',
      nameEn: 'Writing & Notes',
      aiPolicy: AiPrivacyPolicy.cloudOrLocal,
    ),
    Space(
      id: 'sp_vault',
      kind: SpaceKind.vault,
      nameZh: '档案保险箱',
      nameEn: 'Private Vault',
      aiPolicy: AiPrivacyPolicy.localOnly,
    ),
  ];

  static DemoSeedResult createInitialWorkspace() {
    final cas = CasObjectStore();
    final sampleBytes = OoxmlEngine.buildSamplePaperDocx();
    final bundle = OoxmlEngine.parseDocxBytes(sampleBytes);
    final extracted = OoxmlEngine.extractBodyWithCoverIndex(
      bundle,
      bundle.detectedCoverEndIndex,
      EditorFormat.markdown,
    );

    const conclusionAddon =
        '\n\n# 3 结论与展望\n\n综上所述，本文方法在综合测试集上取得了 93.6% 的检索准确率（系统总体架构如图 3 所示），显著优于传统整文件网盘同步方案。';
    final mainMarkdown = '${extracted.text}$conclusionAddon';
    final mainLatex = OoxmlEngine.markdownToLatex(mainMarkdown);

    const docId = 'doc_thesis_demo';
    const mainBranchId = 'branch_main_demo';
    const altBranchId = 'branch_alt_demo';
    final now = DateTime.now();

    final paperDoc = ArchiveDocument(
      id: docId,
      spaceId: 'sp_paper',
      title: '面向长文档演进的局部语义检索（示例论文）',
      sourceExt: '.docx',
      sourceFileName: '硕士论文_导师批注版.docx',
      backupFormat: BackupFormat.both,
      activeFormat: EditorFormat.markdown,
      markdownText: mainMarkdown,
      latexText: mainLatex,
      annotations: extracted.annotations,
      baseDocxBase64: base64Encode(sampleBytes),
      coverXmlNodes: extracted.coverXmlNodes,
      coverRule: CoverRule(
        documentId: docId,
        coverEndBlockIndex: bundle.detectedCoverEndIndex,
        remember: true,
        coverBlockCount: extracted.coverBlockCount,
      ),
      citationsSidecar: extracted.citationsSidecar,
      mediaAssets: extracted.mediaAssets,
      isSealed: false,
      aiPolicyOverride: AiPrivacyPolicy.cloudOrLocal,
      createdAt: now.subtract(const Duration(days: 3)).toIso8601String(),
      updatedAt: now.toIso8601String(),
      currentBranchId: mainBranchId,
      tags: const ['学位论文', '导师一审'],
    );

    const v1Text =
        '# 摘要\n\n针对论文修改版本混乱问题，本文提出了一种分层内容寻址索引框架。\n\n以下为早期初稿中一段较长的背景冗余综述内容，用于演示自动删除片段捕获进废稿墓地的功能：传统科研写作往往依赖本地文件夹反复另存为副本，研究者不仅难以追溯任意一天具体删除了哪些论证语句，也无法在不打断 Word 封面排版的情况下开展结构化对比。\n\n# 1 引言\n\n传统网盘同步难以感知段落级改动。';
    final v1Doc = paperDoc.copyWith(
      markdownText: v1Text,
      latexText: OoxmlEngine.markdownToLatex(v1Text),
    );
    final s1 = createDocumentSnapshot(
      cas: cas,
      doc: v1Doc,
      label: '初稿立项版',
      isMilestone: true,
      aiSummary: '搭建论文摘要与引言结构，共录入初稿背景综述。',
    ).snapshot!.copyWith(
          createdAt: now.subtract(const Duration(days: 2)).toIso8601String(),
        );

    final v2Text = mainMarkdown.replaceFirst('94.2%', '91.6%');
    final v2Doc = paperDoc.copyWith(
      markdownText: v2Text,
      latexText: OoxmlEngine.markdownToLatex(v2Text),
    );
    final s2 = createDocumentSnapshot(
      cas: cas,
      doc: v2Doc,
      latestSnapshot: s1,
      label: '补充实验数据',
      isMilestone: false,
      aiSummary: '精简引言冗余综述（已转入废稿墓地），补充第 2 章目标函数与消融实验表。',
    ).snapshot!.copyWith(
          createdAt: now.subtract(const Duration(days: 1)).toIso8601String(),
        );

    final s3 = createDocumentSnapshot(
      cas: cas,
      doc: paperDoc,
      latestSnapshot: s2,
      label: '导师批注回传版',
      isMilestone: true,
      aiSummary: '同步李教授 3 条批注与 3 处修订建议，消融实验准确率更新至 94.2%。',
    ).snapshot!;

    final altText = mainMarkdown
        .replaceFirst(
          '针对多轮论文修改过程中版本混乱与语义漂移难题，本文提出了一种分层内容寻址索引框架。',
          '从信息论与内容寻址同构视角出发，本文形式化定义了多版本长文档的增量局部语义检索边界。',
        )
        .replaceFirst('93.6%', '94.2%');
    final altDoc = paperDoc.copyWith(
      currentBranchId: altBranchId,
      markdownText: altText,
      latexText: OoxmlEngine.markdownToLatex(altText),
    );
    final sAlt = createDocumentSnapshot(
      cas: cas,
      doc: altDoc,
      latestSnapshot: s2,
      label: '方案B·理论切入',
      isMilestone: true,
      aiSummary: '重写摘要第一句为信息论形式化切入视角，并统一结论准确率为 94.2%。',
    ).snapshot!.copyWith(
          createdAt: now.subtract(const Duration(hours: 6)).toIso8601String(),
        );

    final branches = [
      Branch(
        id: mainBranchId,
        documentId: docId,
        name: '主线 · 稳妥工程投稿版',
        isMain: true,
        createdAt: s1.createdAt,
        headSnapshotId: s3.id,
      ),
      Branch(
        id: altBranchId,
        documentId: docId,
        name: '方案 B · 理论推导强化版',
        isMain: false,
        createdAt: sAlt.createdAt,
        headSnapshotId: sAlt.id,
      ),
    ];

    final darlings = [
      DeletedDarling(
        id: 'darling_seed_1',
        documentId: docId,
        snapshotId: s2.id,
        deletedAt: s2.createdAt,
        text: '传统科研写作往往依赖本地文件夹反复另存为副本，研究者不仅难以追溯任意一天具体删除了哪些论证语句，也无法在不打断 Word 封面排版的情况下开展结构化对比。',
        charCount: 74,
        tags: const ['引言背景', '自动捕获废稿'],
      ),
    ];

    const officeText =
        '# 项目中期评审汇报提纲\n\n- 汇报主题：ArcVault 跨端数字档案库阶段进展\n- 核心指标：CAS 块级去重节省存储 78.4%\n- 下一步：完成手机与平板端液态玻璃主题及 E2EE 同步联调。';
    final officeDoc = ArchiveDocument(
      id: 'doc_office_demo',
      spaceId: 'sp_office',
      title: '项目评审汇报（PPTX 演示）',
      sourceExt: '.pptx',
      sourceFileName: '项目评审汇报.pptx',
      backupFormat: BackupFormat.markdown,
      activeFormat: EditorFormat.markdown,
      markdownText: officeText,
      latexText: OoxmlEngine.markdownToLatex(officeText),
      coverRule: const CoverRule(
        documentId: 'doc_office_demo',
        coverEndBlockIndex: 0,
        remember: false,
        coverBlockCount: 0,
      ),
      officePreview: const OfficePreviewData(
        kind: 'pptx',
        slides: [
          PptxSlideData(
            index: 1,
            title: 'ArcVault · 穹档 阶段汇报',
            bullets: ['Local-First 个人数字档案库', 'Word 无损封面剥离 & 平行批注'],
            notes: '开场 2 分钟说明架构优势',
          ),
          PptxSlideData(
            index: 2,
            title: '跨端同步与安全架构',
            bullets: ['PBKDF2 + AES-256-GCM 保险箱', '局域网扫码直连 / WebDAV / S3'],
          ),
        ],
      ),
      updatedAt: now.toIso8601String(),
      createdAt: now.subtract(const Duration(days: 1)).toIso8601String(),
      currentBranchId: 'br_office_main',
      tags: const ['汇报材料'],
    );

    const writingText =
        '# 学术写作灵感札记\n\n## 液态玻璃交互的克制原则\n\n液态玻璃只应出现在**悬浮导航条、底部学术快捷条、悬浮胶囊与弹出抽屉**上；正文阅读与编辑区必须保持清晰通透、低干扰高对比度，以免光学折射扭曲文字可读性。';
    final writingDoc = ArchiveDocument(
      id: 'doc_writing_demo',
      spaceId: 'sp_writing',
      title: '设计思考：克制的液态玻璃交互',
      sourceExt: '.md',
      sourceFileName: '设计思考.md',
      backupFormat: BackupFormat.both,
      activeFormat: EditorFormat.markdown,
      markdownText: writingText,
      latexText: OoxmlEngine.markdownToLatex(writingText),
      coverRule: const CoverRule(
        documentId: 'doc_writing_demo',
        coverEndBlockIndex: 0,
        remember: false,
        coverBlockCount: 0,
      ),
      updatedAt: now.toIso8601String(),
      createdAt: now.subtract(const Duration(days: 2)).toIso8601String(),
      currentBranchId: 'br_writing_main',
      tags: const ['随笔', '设计'],
    );

    const vaultText =
        '# 专利核心技术交底书（机密）\n\n本文档存放于私密档案保险箱，默认开启「仅本地 AI」隐私锁与「只读封存锁定」完整性校验。\n\n- 核心算法哈希指纹受 SHA-256 保护\n- 离线加密密钥仅在用户本机派生，不上传任何云端服务器。';
    final vaultDoc = ArchiveDocument(
      id: 'doc_vault_demo',
      spaceId: 'sp_vault',
      title: '专利技术交底书（已封存）',
      sourceExt: '.md',
      sourceFileName: '专利技术交底书.md',
      backupFormat: BackupFormat.markdown,
      activeFormat: EditorFormat.markdown,
      markdownText: vaultText,
      latexText: OoxmlEngine.markdownToLatex(vaultText),
      coverRule: const CoverRule(
        documentId: 'doc_vault_demo',
        coverEndBlockIndex: 0,
        remember: false,
        coverBlockCount: 0,
      ),
      isSealed: true,
      sealedHash: VaultCrypto.sha256Hex(vaultText),
      sealedAt: now.subtract(const Duration(hours: 12)).toIso8601String(),
      aiPolicyOverride: AiPrivacyPolicy.disabled,
      updatedAt: now.toIso8601String(),
      createdAt: now.subtract(const Duration(days: 4)).toIso8601String(),
      currentBranchId: 'br_vault_main',
      tags: const ['专利', '封存'],
    );

    final officeSnap = createDocumentSnapshot(
      cas: cas,
      doc: officeDoc,
      label: '初版归档',
      isMilestone: true,
      aiSummary: '导入 PPTX 汇报提纲结构。',
    ).snapshot!;

    final writingSnap = createDocumentSnapshot(
      cas: cas,
      doc: writingDoc,
      label: '初稿札记',
      isMilestone: true,
      aiSummary: '记录液态玻璃克制式适配设计笔记。',
    ).snapshot!;

    final vaultSnap = createDocumentSnapshot(
      cas: cas,
      doc: vaultDoc,
      label: '封存基线',
      isMilestone: true,
      aiSummary: '完成交底书封存并生成 SHA-256 校验指纹。',
    ).snapshot!;

    final motivations = [
      MotivationAttachment(
        id: 'mot_demo_1',
        documentId: docId,
        snapshotId: s3.id,
        kind: 'reviewer-comment',
        title: '李教授微信语音转文字：补齐消融数据',
        content: '建议把 91.6% 到 94.2% 的消融实验参数差异写清楚，并在第 2 章加一段显存对比。',
        createdAt: s3.createdAt,
      ),
    ];

    final linkedAssets = [
      LinkedAsset(
        id: 'asset_demo_1',
        documentId: docId,
        name: 'ablation_benchmark.csv',
        category: 'data',
        relativePath: 'assets/data/ablation_benchmark.csv',
        sizeBytes: 18432,
        contentHash: VaultCrypto.sha256Hex('ablation_benchmark_v3'),
        updatedAt: s3.createdAt,
        snapshotIds: [s2.id, s3.id],
      ),
    ];

    final activity = List.generate(14, (i) {
      final day = now.subtract(Duration(days: 13 - i));
      final dateStr = day.toIso8601String().substring(0, 10);
      return WritingActivityDay(
        date: dateStr,
        charsDelta: (i % 4 == 0) ? 420 : (160 + i * 35),
        editSessions: (i % 3) + 1,
        peakHour: 10 + (i % 12),
      );
    });

    return DemoSeedResult(
      cas: cas,
      documents: [paperDoc, officeDoc, writingDoc, vaultDoc],
      branches: branches,
      snapshots: [s1, s2, s3, sAlt, officeSnap, writingSnap, vaultSnap],
      darlings: darlings,
      motivations: motivations,
      linkedAssets: linkedAssets,
      writingActivity: activity,
    );
  }
}
