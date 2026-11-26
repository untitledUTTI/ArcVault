import { buildSamplePaperDocx } from './ooxml/sampleDocxBuilder';
import { parseDocxBytes, extractBodyWithCoverIndex, type ParsedDocxBundle } from './ooxml/docxParser';
import { markdownToLatex } from './ooxml/formatConverter';
import {
  buildSamplePptxBytes,
  buildSampleXlsxBytes,
  parsePptxBytes,
  parseXlsxBytes,
} from './officeParser';
import { sha256Hex } from './hash';
import { CasObjectStore, createDocumentSnapshot } from './casStore';
import type {
  ArchiveDocument,
  Branch,
  DeletedDarling,
  LinkedAsset,
  MotivationAttachment,
  Snapshot,
  Space,
  WritingActivityDay,
} from '../types/archive';

export const DEFAULT_SPACES: Space[] = [
  { id: 'sp_paper', kind: 'paper', nameZh: '论文工作区', nameEn: 'Thesis Studio', aiPolicy: 'cloud-or-local' },
  { id: 'sp_office', kind: 'office', nameZh: '办公文档', nameEn: 'Office Docs', aiPolicy: 'cloud-or-local' },
  { id: 'sp_writing', kind: 'writing', nameZh: '写作笔记', nameEn: 'Writing & Notes', aiPolicy: 'cloud-or-local' },
  { id: 'sp_vault', kind: 'vault', nameZh: '档案保险箱', nameEn: 'Private Vault', aiPolicy: 'local-only', locked: false },
];

function uint8ToBase64Browser(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

export async function seedInitialWorkspace(): Promise<{
  cas: CasObjectStore;
  documents: ArchiveDocument[];
  branches: Branch[];
  snapshots: Snapshot[];
  darlings: DeletedDarling[];
  motivations: MotivationAttachment[];
  linkedAssets: LinkedAsset[];
  writingActivity: WritingActivityDay[];
  parsedBundles: Record<string, ParsedDocxBundle>;
}> {
  const cas = new CasObjectStore();
  const sampleBytes = await buildSamplePaperDocx();
  const bundle = await parseDocxBytes(sampleBytes);
  const extracted = extractBodyWithCoverIndex(bundle, bundle.detectedCoverEndIndex, 'markdown');

  // Append a conclusion section with intentional consistency issues (93.6% vs 94.2% & dangling Fig 3)
  // while keeping all earlier annotation offsets intact!
  const conclusionAddon =
    '\n\n# 3 结论与展望\n\n综上所述，本文方法在综合测试集上取得了 93.6% 的检索准确率（系统总体架构如图 3 所示），显著优于传统整文件网盘同步方案。';
  const mainMarkdown = `${extracted.text}${conclusionAddon}`;
  const mainLatex = markdownToLatex(mainMarkdown);

  const docId = 'doc_thesis_demo';
  const mainBranchId = 'branch_main_demo';
  const altBranchId = 'branch_alt_demo';
  const now = new Date();

  const doc: ArchiveDocument = {
    id: docId,
    spaceId: 'sp_paper',
    title: '面向长文档演进的局部语义检索（示例论文）',
    sourceExt: '.docx',
    sourceFileName: '硕士论文_导师批注版.docx',
    backupFormat: 'both',
    activeFormat: 'markdown',
    markdownText: mainMarkdown,
    latexText: mainLatex,
    annotations: extracted.annotations,
    baseDocxBase64: uint8ToBase64Browser(sampleBytes),
    coverXmlNodes: extracted.coverXmlNodes,
    coverRule: {
      documentId: docId,
      coverEndBlockIndex: bundle.detectedCoverEndIndex,
      remember: true,
      coverBlockCount: extracted.coverBlockCount,
    },
    citationsSidecar: extracted.citationsSidecar,
    styleSidecar: extracted.styleSidecar,
    mediaAssets: extracted.mediaAssets,
    isSealed: false,
    aiPolicyOverride: 'cloud-or-local',
    createdAt: new Date(now.getTime() - 86400_000 * 3).toISOString(),
    updatedAt: now.toISOString(),
    currentBranchId: mainBranchId,
    tags: ['学位论文', '导师一审'],
  };

  // Seed 3 historical snapshots on main branch
  const v1Text = `# 摘要\n\n针对论文修改版本混乱问题，本文提出了一种分层内容寻址索引框架。\n\n以下为早期初稿中一段较长的背景冗余综述内容，用于演示自动删除片段捕获进废稿墓地的功能：传统科研写作往往依赖本地文件夹反复另存为副本，研究者不仅难以追溯任意一天具体删除了哪些论证语句，也无法在不打断 Word 封面排版的情况下开展结构化对比。\n\n# 1 引言\n\n传统网盘同步难以感知段落级改动。`;
  const v1Doc: ArchiveDocument = { ...doc, markdownText: v1Text, latexText: markdownToLatex(v1Text) };
  const s1Res = await createDocumentSnapshot({
    cas,
    doc: v1Doc,
    latestSnapshot: null,
    label: '初稿立项版',
    isMilestone: true,
    aiSummary: '搭建论文摘要与引言结构，共录入初稿背景综述。',
  });
  const s1 = s1Res.snapshot!;
  s1.createdAt = new Date(now.getTime() - 86400_000 * 2).toISOString();

  const v2Text = mainMarkdown.replace('94.2%', '91.6%');
  const v2Doc: ArchiveDocument = { ...doc, markdownText: v2Text, latexText: markdownToLatex(v2Text) };
  const s2Res = await createDocumentSnapshot({
    cas,
    doc: v2Doc,
    latestSnapshot: s1,
    label: '补充实验数据',
    isMilestone: false,
    aiSummary: '精简引言冗余综述（已转入废稿墓地），补充第 2 章目标函数与消融实验表。',
  });
  const s2 = s2Res.snapshot!;
  s2.createdAt = new Date(now.getTime() - 86400_000).toISOString();

  const s3Res = await createDocumentSnapshot({
    cas,
    doc,
    latestSnapshot: s2,
    label: '导师批注回传版',
    isMilestone: true,
    aiSummary: '同步李教授 3 条批注与 3 处修订建议，消融实验准确率更新至 94.2%。',
  });
  const s3 = s3Res.snapshot!;

  // Seed a parallel A/B branch ("方案 B · 理论推导强化版") forked from s2
  const altText = mainMarkdown
    .replace('针对多轮论文修改过程中版本混乱与语义漂移难题，本文提出了一种分层内容寻址索引框架。', '从信息论与内容寻址同构视角出发，本文形式化定义了多版本长文档的增量局部语义检索边界。')
    .replace('93.6%', '94.2%');
  const altDoc: ArchiveDocument = {
    ...doc,
    currentBranchId: altBranchId,
    markdownText: altText,
    latexText: markdownToLatex(altText),
  };
  const sAltRes = await createDocumentSnapshot({
    cas,
    doc: altDoc,
    latestSnapshot: s2,
    label: '方案B·理论切入',
    isMilestone: true,
    aiSummary: '重写摘要第一句为信息论形式化切入视角，并统一结论准确率为 94.2%。',
  });
  const sAlt = sAltRes.snapshot!;
  sAlt.createdAt = new Date(now.getTime() - 3600_000 * 6).toISOString();

  const branches: Branch[] = [
    {
      id: mainBranchId,
      documentId: docId,
      name: '主线 · 稳妥工程投稿版',
      isMain: true,
      createdAt: s1.createdAt,
      headSnapshotId: s3.id,
    },
    {
      id: altBranchId,
      documentId: docId,
      name: '方案 B · 理论推导强化版',
      isMain: false,
      createdAt: sAlt.createdAt,
      headSnapshotId: sAlt.id,
    },
  ];

  const darlings: DeletedDarling[] = [
    {
      id: 'darling_seed_1',
      documentId: docId,
      snapshotId: s2.id,
      deletedAt: s2.createdAt,
      text: '传统科研写作往往依赖本地文件夹反复另存为副本，研究者不仅难以追溯任意一天具体删除了哪些论证语句，也无法在不打断 Word 封面排版的情况下开展结构化对比。',
      charCount: 74,
      tags: ['引言背景', '答辩素材'],
    },
  ];

  const motivations: MotivationAttachment[] = [
    {
      id: 'mot_1',
      documentId: docId,
      snapshotId: s3.id,
      kind: 'email',
      title: '李教授一审邮件反馈',
      content: '“摘要和消融实验表的提升数据要严格对齐基线，第 2 章公式后面补一句参数维度与显存占用分析，返修前再检查一遍结论章节的引用编号。”',
      createdAt: new Date(now.getTime() - 3600_000 * 14).toISOString(),
    },
    {
      id: 'mot_2',
      documentId: docId,
      snapshotId: s2.id,
      kind: 'reviewer-comment',
      title: '模拟审稿人 R2 意见',
      content: 'Reviewer #2: Please clarify the memory footprint and chunking overhead compared with full-file hashing baselines.',
      createdAt: new Date(now.getTime() - 86400_000).toISOString(),
    },
  ];

  const linkedAssets: LinkedAsset[] = [
    {
      id: 'asset_1',
      documentId: docId,
      name: 'fig1_arcvault_arch.svg',
      category: 'figure',
      relativePath: 'figures/fig1_arcvault_arch.svg',
      sizeBytes: 42_180,
      contentHash: 'f19a8c32e701',
      updatedAt: s3.createdAt,
      snapshotIds: [s2.id, s3.id],
    },
    {
      id: 'asset_2',
      documentId: docId,
      name: 'ablation_metrics.csv',
      category: 'data',
      relativePath: 'data/ablation_metrics.csv',
      sizeBytes: 18_432,
      contentHash: 'a904b72e1190',
      updatedAt: s3.createdAt,
      snapshotIds: [s2.id, s3.id],
    },
    {
      id: 'asset_3',
      documentId: docId,
      name: 'thesis_refs.bib',
      category: 'bibliography',
      relativePath: 'refs/thesis_refs.bib',
      sizeBytes: 94_510,
      contentHash: 'c3102f8b447d',
      updatedAt: s3.createdAt,
      snapshotIds: [s1.id, s2.id, s3.id],
    },
  ];

  // 14 days of writing activity for heatmap
  const deltas = [320, 0, 580, 910, 140, 0, 760, 1120, 430, 290, 0, 840, 620, 490];
  const hours = [22, 0, 21, 23, 15, 0, 20, 23, 19, 10, 0, 22, 21, 22];
  const writingActivity: WritingActivityDay[] = deltas.map((d, i) => {
    const dt = new Date(now.getTime() - (13 - i) * 86400_000);
    return {
      date: dt.toISOString().slice(0, 10),
      charsDelta: d,
      editSessions: d === 0 ? 0 : Math.max(1, Math.round(d / 260)),
      peakHour: hours[i],
    };
  });

  // Add one general contract/vault item to demonstrate Vault strict AI privacy lock
  const contractMd =
    '# 科研项目联合研发保密协议\n\n甲方与乙方就智能档案与语义检索系统的技术资料保密事项达成如下条款：\n\n1. 保密资料包括未发表论文手稿、实验原始数据集与核心算法源码。\n2. 本档案已在穹档保险箱中启用只读封存校验，并强制锁定仅允许本地 AI，禁止文本流向云端接口。';
  const contractSealedHash = await sha256Hex(contractMd);
  const contractDoc: ArchiveDocument = {
    id: 'doc_vault_contract',
    spaceId: 'sp_vault',
    title: '科研项目联合研发保密协议（2026）',
    sourceExt: '.md',
    sourceFileName: '保密协议_2026.md',
    backupFormat: 'markdown',
    activeFormat: 'markdown',
    markdownText: contractMd,
    latexText: '',
    annotations: [],
    coverXmlNodes: [],
    coverRule: { documentId: 'doc_vault_contract', coverEndBlockIndex: 0, remember: true, coverBlockCount: 0 },
    citationsSidecar: [],
    mediaAssets: {},
    isSealed: true,
    sealedHash: contractSealedHash,
    sealedAt: now.toISOString(),
    aiPolicyOverride: 'local-only',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    currentBranchId: 'branch_vault_1',
    tags: ['合同协议', '保险箱'],
  };

  const sContract = (
    await createDocumentSnapshot({
      cas,
      doc: contractDoc,
      latestSnapshot: null,
      label: '签章封存版',
      isMilestone: true,
      aiSummary: '初始入库并完成只读封存校验。',
    })
  ).snapshot!;

  const vaultBranch: Branch = {
    id: 'branch_vault_1',
    documentId: contractDoc.id,
    name: '主线 · 签章原件',
    isMain: true,
    createdAt: contractDoc.createdAt,
    headSnapshotId: sContract.id,
  };

  // Seed Office space with real parsed PPTX & XLSX showcase documents
  const pptxBytes = await buildSamplePptxBytes();
  const pptxParsed = await parsePptxBytes(pptxBytes);
  const pptxDoc: ArchiveDocument = {
    id: 'doc_office_pptx',
    spaceId: 'sp_office',
    title: '论文中期答辩汇报（示例 PPTX）',
    sourceExt: '.pptx',
    sourceFileName: '论文中期答辩汇报.pptx',
    backupFormat: 'markdown',
    activeFormat: 'markdown',
    markdownText: pptxParsed.markdownSummary,
    latexText: markdownToLatex(pptxParsed.markdownSummary),
    annotations: [],
    coverXmlNodes: [],
    coverRule: { documentId: 'doc_office_pptx', coverEndBlockIndex: 0, remember: true, coverBlockCount: 0 },
    citationsSidecar: [],
    mediaAssets: {},
    officePreview: pptxParsed.preview,
    isSealed: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    currentBranchId: 'branch_pptx_1',
    tags: ['汇报PPT', '办公文档'],
  };
  const sPptx = (
    await createDocumentSnapshot({
      cas,
      doc: pptxDoc,
      latestSnapshot: null,
      label: '答辩一稿',
      isMilestone: true,
      aiSummary: '解析导入 2 页答辩幻灯片及演讲者备注。',
    })
  ).snapshot!;

  const xlsxBytes = await buildSampleXlsxBytes();
  const xlsxParsed = await parseXlsxBytes(xlsxBytes);
  const xlsxDoc: ArchiveDocument = {
    id: 'doc_office_xlsx',
    spaceId: 'sp_office',
    title: '消融实验原始记录（示例 XLSX）',
    sourceExt: '.xlsx',
    sourceFileName: '消融实验原始记录.xlsx',
    backupFormat: 'markdown',
    activeFormat: 'markdown',
    markdownText: xlsxParsed.markdownSummary,
    latexText: markdownToLatex(xlsxParsed.markdownSummary),
    annotations: [],
    coverXmlNodes: [],
    coverRule: { documentId: 'doc_office_xlsx', coverEndBlockIndex: 0, remember: true, coverBlockCount: 0 },
    citationsSidecar: [],
    mediaAssets: {},
    officePreview: xlsxParsed.preview,
    isSealed: false,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    currentBranchId: 'branch_xlsx_1',
    tags: ['实验数据', '办公文档'],
  };
  const sXlsx = (
    await createDocumentSnapshot({
      cas,
      doc: xlsxDoc,
      latestSnapshot: null,
      label: '实验归档表',
      isMilestone: true,
      aiSummary: '解析导入 2 个 Excel 工作表（消融汇总与显存耗时）。',
    })
  ).snapshot!;

  return {
    cas,
    documents: [doc, pptxDoc, xlsxDoc, contractDoc],
    branches: [
      ...branches,
      vaultBranch,
      { id: 'branch_pptx_1', documentId: pptxDoc.id, name: '主线', isMain: true, createdAt: now.toISOString(), headSnapshotId: sPptx.id },
      { id: 'branch_xlsx_1', documentId: xlsxDoc.id, name: '主线', isMain: true, createdAt: now.toISOString(), headSnapshotId: sXlsx.id },
    ],
    snapshots: [s1, s2, s3, sAlt, sPptx, sXlsx, sContract],
    darlings,
    motivations,
    linkedAssets,
    writingActivity,
    parsedBundles: { [docId]: bundle },
  };
}
