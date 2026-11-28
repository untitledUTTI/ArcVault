import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';

import '../models/archive_models.dart';

enum TutorialMode { firstRun, replay }

enum TutorialPhase { welcome, permissions, picker, player }

enum TutorialModuleId {
  workspace('workspace', '空间分区、回收站与双模编辑', '空间编辑', '核心工作台'),
  wordAnnotations('word-annotations', 'Word 封面识别与平行批注', '封面批注', 'Word 专属'),
  versionDome('version-dome', '版本穹顶、Diff 与 A/B 分支', '版本分支', '版本演进'),
  academicAi('academic-ai', '学术科研套件与三档 AI 隐私锁', '学术 AI', '智能辅助'),
  syncSecurity('sync-security', '保险箱加密与跨端同步', '同步安全', '多端互联'),
  themesMultidevice('themes-multidevice', '四套移动主题与导出', '主题导出', '界面交付'),
  formatMatrix('format-matrix', '不同格式文件的支持能力差异', '格式支持', '格式说明'),
  limitations('limitations', '当前版本不能做到的事（能力边界）', '能力边界', '必读说明');

  const TutorialModuleId(this.id, this.title, this.shortTitle, this.badge);
  final String id;
  final String title;
  final String shortTitle;
  final String badge;
}

enum TutorialSceneId {
  workspaceSidebar,
  trashModal,
  workspaceFormat,
  coverSplit,
  annotations,
  snapshotTopbar,
  timelineDome,
  diffDarlings,
  branchModal,
  editorAiBar,
  phrasebankCapsule,
  paperStudio,
  contextAssets,
  evolutionStudio,
  vaultLock,
  syncModal,
  settingsThemes,
  settingsAi,
  exportTopbar,
  formatOffice,
  limitationsOverview,
}

enum TutorialTargetId {
  sidebarPanel,
  sidebarTrashBtn,
  trashModal,
  topbarFormatGroup,
  mobileFormatBar,
  coverSplitBody,
  coverSplitFooter,
  coverConfirmBtn,
  annotationSidebar,
  mobileAnnotationSheet,
  topbarSnapshotBtn,
  mobileSnapshotBtn,
  timelinePanel,
  timelineDarlingsBtn,
  diffModal,
  branchModal,
  editorAiBar,
  editorAiPolicyBtn,
  phrasebankModal,
  paperStudioModal,
  contextAssetsModal,
  evolutionStudioModal,
  vaultLockModal,
  syncModal,
  settingsThemesCard,
  settingsModal,
  topbarMoreBtn,
  workspaceMain,
}

enum TutorialActionId {
  openTrash,
  togglePreview,
  coverConfirm,
  coverCancel,
  coverImportAll,
  selectAnnotation,
  saveSnapshot,
  openDarlings,
  cycleAiPolicy,
}

enum SpotlightPlacement { auto, top, bottom, left, right }

enum GuideCardPlacementKind { center, top, bottom, left, right }

enum TutorialFlowStepKind { spotlight, cacheSetup, warning }

enum TutorialAdvanceRelation { nextStep, nextModule, cacheSetup, warning, finish }

class TutorialActionGate {
  const TutorialActionGate({
    required this.actionId,
    this.fallbackActionIds = const [],
    required this.buttonLabel,
  });

  final TutorialActionId actionId;
  final List<TutorialActionId> fallbackActionIds;
  final String buttonLabel;
}

class SpotlightRect {
  const SpotlightRect({
    required this.top,
    required this.left,
    required this.width,
    required this.height,
  });

  final double top;
  final double left;
  final double width;
  final double height;

  double get right => left + width;
  double get bottom => top + height;

  bool roughlyEquals(SpotlightRect other, {double tolerance = 1.5}) =>
      (top - other.top).abs() <= tolerance &&
      (left - other.left).abs() <= tolerance &&
      (width - other.width).abs() <= tolerance &&
      (height - other.height).abs() <= tolerance;
}

class GuideCardPlacement {
  const GuideCardPlacement({
    required this.top,
    required this.left,
    required this.placement,
    this.maxHeight,
  });

  final double top;
  final double left;
  final GuideCardPlacementKind placement;
  final double? maxHeight;
}

class MobilePermissionCardDef {
  const MobilePermissionCardDef({
    required this.id,
    required this.title,
    required this.description,
    required this.actionLabel,
    required this.required,
  });

  final String id; // 'storage' | 'camera' | 'local-network' | 'biometric'
  final String title;
  final String description;
  final String actionLabel;
  final bool required;
}

class TutorialSpotlightStep {
  const TutorialSpotlightStep({
    required this.id,
    required this.moduleId,
    required this.title,
    required this.description,
    this.bullets = const [],
    required this.scene,
    this.targetIds = const [],
    this.unionTargetIds = const [],
    this.padding = 6.0,
    this.preferredPlacement = SpotlightPlacement.auto,
    this.phoneForceBottom = false,
    this.actionGate,
  });

  final String id;
  final TutorialModuleId moduleId;
  final String title;
  final String description;
  final List<String> bullets;
  final TutorialSceneId scene;
  final List<TutorialTargetId> targetIds;
  final List<TutorialTargetId> unionTargetIds;
  final double padding;
  final SpotlightPlacement preferredPlacement;
  final bool phoneForceBottom;
  final TutorialActionGate? actionGate;
}

class TutorialModuleDef {
  const TutorialModuleDef({
    required this.id,
    required this.summary,
    required this.steps,
  });

  final TutorialModuleId id;
  final String summary;
  final List<TutorialSpotlightStep> steps;
}

class TutorialFlowStep {
  const TutorialFlowStep.spotlight({
    required this.module,
    required this.step,
    required this.stepIndexInModule,
    required this.moduleStepCount,
  }) : kind = TutorialFlowStepKind.spotlight;

  const TutorialFlowStep.cacheSetup()
      : kind = TutorialFlowStepKind.cacheSetup,
        module = null,
        step = null,
        stepIndexInModule = 0,
        moduleStepCount = 0;

  const TutorialFlowStep.warning()
      : kind = TutorialFlowStepKind.warning,
        module = null,
        step = null,
        stepIndexInModule = 0,
        moduleStepCount = 0;

  final TutorialFlowStepKind kind;
  final TutorialModuleDef? module;
  final TutorialSpotlightStep? step;
  final int stepIndexInModule;
  final int moduleStepCount;
}

class TutorialTargetRegistry {
  final Map<TutorialTargetId, GlobalKey> _keys = {};
  final StreamController<TutorialActionId> _actionController =
      StreamController<TutorialActionId>.broadcast();

  GlobalKey keyFor(TutorialTargetId id) => _keys.putIfAbsent(id, () => GlobalKey());

  Stream<TutorialActionId> get actions => _actionController.stream;

  void notifyAction(TutorialActionId action) {
    if (!_actionController.isClosed) {
      _actionController.add(action);
    }
  }

  void dispose() {
    _actionController.close();
  }
}

class TutorialFlow {
  TutorialFlow._();

  static const int warningCountdownSeconds = 10;
  static const String confirmPhrase = '我已了解';
  static const String warningText =
      '推荐使用付费模型如Claude Fable/Sonnet、GPT Astra/Sol、Gemini Carbon/Neon（国内顶尖模型也可）。注意合理消费，请勿通过第三方平台、二手平台进行充值，谨防受骗！不要过度依赖AI，理性辨别AI生成的内容，AI给出的建议可能不准确！';

  static const List<MobilePermissionCardDef> mobilePermissionCards = [
    MobilePermissionCardDef(
      id: 'storage',
      title: '文件与存储访问权限',
      description: '用于读写本地文档、自定义缓存目录、CAS 去重快照与定时备份。',
      actionLabel: '前往授权',
      required: true,
    ),
    MobilePermissionCardDef(
      id: 'camera',
      title: '相机权限',
      description: '用于「纸质稿扫描导入」与局域网同步扫码配对。',
      actionLabel: '点击授权',
      required: false,
    ),
    MobilePermissionCardDef(
      id: 'local-network',
      title: '局域网 / 附近设备权限',
      description: '用于同一 Wi-Fi 下与电脑端高速直连同步，零网盘流量消耗。',
      actionLabel: '前往设置',
      required: false,
    ),
    MobilePermissionCardDef(
      id: 'biometric',
      title: '生物识别（指纹 / 面容）',
      description: '用于快速解锁「档案保险箱」中的加密私密文档。',
      actionLabel: '点击验证',
      required: false,
    ),
  ];

  static const List<MobileThemeId> mobileWelcomeThemes = [
    MobileThemeId.light,
    MobileThemeId.dark,
    MobileThemeId.paper,
    MobileThemeId.m3Expressive,
  ];

  static TutorialPhase getInitialPhase(TutorialMode mode) =>
      mode == TutorialMode.firstRun ? TutorialPhase.welcome : TutorialPhase.picker;

  static bool shouldShowMobilePermissionsStep({
    required TutorialMode mode,
    required bool isAndroid,
  }) =>
      mode == TutorialMode.firstRun && isAndroid;

  static bool areAllPermissionsGranted(Set<String> grantedIds) =>
      mobilePermissionCards.every((c) => grantedIds.contains(c.id));

  static bool canProceedFromCacheSetup({
    required String? choice,
    required String customPath,
  }) {
    if (choice == 'default') return true;
    if (choice == 'custom') return customPath.trim().isNotEmpty;
    return false;
  }

  static bool canUnlockWarningInput(int remainingSeconds) => remainingSeconds <= 0;

  static bool canConfirmWarning({
    required int remainingSeconds,
    required String input,
  }) =>
      canUnlockWarningInput(remainingSeconds) && input.trim() == confirmPhrase;

  static const List<TutorialModuleDef> modules = [
    TutorialModuleDef(
      id: TutorialModuleId.workspace,
      summary: '四大空间按场景隔离文档，支持左侧栏内置永久回收站与 Markdown / LaTeX 双向编辑。',
      steps: [
        TutorialSpotlightStep(
          id: 'ws-spaces',
          moduleId: TutorialModuleId.workspace,
          title: '四大空间分区、文档入口与移入回收站',
          description:
              '左侧边栏将文档按场景划分为「论文工作区、办公文档、写作笔记、档案保险箱」四大独立空间，互不混杂。你可以直接在此导入文件、载入示例论文，或点击文档卡片右侧的回收站图标将不再需要的文档移入内置回收站。',
          bullets: [
            '点击上方四个空间按钮即可切换工作区（保险箱强制本地加密与 AI 隔离）。',
            '点击文档标题旁的回收站图标可将其安全移入内置回收站（已封存锁定文档受保护，需先解除封存）。',
          ],
          scene: TutorialSceneId.workspaceSidebar,
          targetIds: [TutorialTargetId.sidebarPanel],
          preferredPlacement: SpotlightPlacement.right,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'ws-trash-btn',
          moduleId: TutorialModuleId.workspace,
          title: '左侧栏底部：软件内置永久回收站',
          description:
              '高亮按钮就是位于左侧栏最底部的「回收站」入口！放入回收站的文档项目将永久保留、永不自动清理，随时可预览或一键还原到原空间。请点击「回收站」按钮打开查看：',
          bullets: [
            '所有从左侧栏移入的文档都会集中保存在这里，版本历史、分支与批注完整无损。',
            '不同于普通系统回收站，穹档回收站支持永久保留，不会因时间过期而自动清空。',
          ],
          scene: TutorialSceneId.workspaceSidebar,
          targetIds: [TutorialTargetId.sidebarTrashBtn],
          preferredPlacement: SpotlightPlacement.top,
          padding: 6,
          actionGate: TutorialActionGate(
            actionId: TutorialActionId.openTrash,
            buttonLabel: '回收站',
          ),
        ),
        TutorialSpotlightStep(
          id: 'ws-trash-modal',
          moduleId: TutorialModuleId.workspace,
          title: '回收站界面：永久保留与一键还原',
          description:
              '已为你打开「内置回收站」界面：这里集中保管所有移入回收站的文档，支持按标题或片段检索、展开只读内容预览，并可随时点击「一键还原」将其放回原本所在的工作空间。',
          bullets: [
            '回收站中的项目永久保留，不会自动清理或过期销毁，彻底避免误删损失。',
            '查看完成后点击「下一步」，继续体验 Markdown / LaTeX 双模编辑。',
          ],
          scene: TutorialSceneId.trashModal,
          targetIds: [TutorialTargetId.trashModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'ws-format',
          moduleId: TutorialModuleId.workspace,
          title: 'Markdown / LaTeX 双模切换与实时预览',
          description:
              '高亮区域支持一键切换 MD 与 LaTeX 双源码视图，并实时双向同步。现在请你亲自点击一次「预览」按钮，开启 KaTeX 公式与排版实时预览！',
          bullets: [
            '点击「MD / LaTeX」可在两种学术语法间无损互转编辑。',
            '手机端底部快捷学术条支持横向滑动插入常用公式与结构符号。',
          ],
          scene: TutorialSceneId.workspaceFormat,
          targetIds: [TutorialTargetId.topbarFormatGroup, TutorialTargetId.mobileFormatBar],
          preferredPlacement: SpotlightPlacement.top,
          padding: 6,
          actionGate: TutorialActionGate(
            actionId: TutorialActionId.togglePreview,
            buttonLabel: '预览',
          ),
        ),
      ],
    ),
    TutorialModuleDef(
      id: TutorialModuleId.wordAnnotations,
      summary: '导入 .docx 时自动剥离封面排版，导出时原封不动拼回，配合平行批注卡片高效改稿。',
      steps: [
        TutorialSpotlightStep(
          id: 'cover-pick-line',
          moduleId: TutorialModuleId.wordAnnotations,
          title: '第一步：选择正文开始处是哪一行',
          description:
              '已为你自动打开「智能封面识别与切分微调」界面！黑色遮罩外无法操作，请直接在高亮列表里点击任意段落行来指定「▼ 正文从此开始」的位置；前方的封面段落将被无损封存，导出 Word 时原封不动拼回。',
          bullets: [
            '黄色「封面保留区」不会混入正文编辑器，校徽、学院表格、签名栏零格式破坏。',
            '选好正文起点行后，点击本指引卡片右下角的「下一步」。',
          ],
          scene: TutorialSceneId.coverSplit,
          targetIds: [TutorialTargetId.coverSplitBody],
          preferredPlacement: SpotlightPlacement.bottom,
          padding: 4,
        ),
        TutorialSpotlightStep(
          id: 'cover-footer-btns',
          moduleId: TutorialModuleId.wordAnnotations,
          title: '第二步：认识底部三个功能按钮并体验确认',
          description:
              '高亮区域是封面识别界面的底部操作栏，三个按钮各司其职，请你查看说明后亲自点击「确认切分并提取正文」体验生效过程：',
          bullets: [
            '「不剥离(全部导入)」：将第 1 段起所有内容全部当作正文导入编辑。',
            '「取消」：放弃本次切分微调，关闭弹窗保持原样。',
            '「确认切分并提取正文」：锁定封存前方封面 XML，只把选定起点之后的正文提取进编辑器。',
          ],
          scene: TutorialSceneId.coverSplit,
          targetIds: [TutorialTargetId.coverSplitFooter],
          preferredPlacement: SpotlightPlacement.top,
          padding: 6,
          actionGate: TutorialActionGate(
            actionId: TutorialActionId.coverConfirm,
            fallbackActionIds: [
              TutorialActionId.coverCancel,
              TutorialActionId.coverImportAll,
            ],
            buttonLabel: '确认切分并提取正文',
          ),
        ),
        TutorialSpotlightStep(
          id: 'ann-open-card',
          moduleId: TutorialModuleId.wordAnnotations,
          title: '第三步：切换查看平行批注与修订卡片',
          description:
              '导入带批注的 .docx 后，半屏批注抽屉（平板横屏为右侧平行批注栏）会按正文锚点位置自动对齐每条导师批注与修订。请在高亮区域点击「下一条/上一条」或任意批注卡片体验切换！',
          bullets: [
            '蓝色标识为「批注」，红色标识为「修订建议（替换/插入/删除）」。',
            '支持左右滑动批注抽屉快速切卡，点击正文高亮锚点也会自动定位对应批注。',
          ],
          scene: TutorialSceneId.annotations,
          targetIds: [
            TutorialTargetId.annotationSidebar,
            TutorialTargetId.mobileAnnotationSheet,
          ],
          preferredPlacement: SpotlightPlacement.top,
          padding: 6,
          actionGate: TutorialActionGate(
            actionId: TutorialActionId.selectAnnotation,
            buttonLabel: '批注/修订卡片',
          ),
        ),
        TutorialSpotlightStep(
          id: 'ann-actions',
          moduleId: TutorialModuleId.wordAnnotations,
          title: '第四步：Arc-Link 连线与修订处理',
          description:
              '批注卡片内集成了完整的审阅操作栏（平板横屏自动绘制连接正文的 Arc-Link 光学曲线），你可以自由点击体验后再继续：',
          bullets: [
            '修订类卡片支持「接受修订 / 拒绝修订」，一键同步修改正文并支持撤销重做。',
            '批注类卡片支持「标记已解决 / 回复」，也可点击「AI 修改建议」获取润色方案。',
          ],
          scene: TutorialSceneId.annotations,
          targetIds: [
            TutorialTargetId.annotationSidebar,
            TutorialTargetId.mobileAnnotationSheet,
          ],
          preferredPlacement: SpotlightPlacement.top,
          padding: 6,
        ),
      ],
    ),
    TutorialModuleDef(
      id: TutorialModuleId.versionDome,
      summary: '每次快照按内容哈希去重存储，支持穹顶弧形时间轴、A/B 分支与废稿墓地捡回。',
      steps: [
        TutorialSpotlightStep(
          id: 'ver-snapshot',
          moduleId: TutorialModuleId.versionDome,
          title: '一键打里程碑快照（CAS 哈希去重）',
          description:
              '点击高亮的「快照」按钮，系统会对当前正文计算内容哈希：若有改动则生成增量版本节点；若正文完全未改动则自动命中去重，0 字节冗余写入！请点击「快照」按钮体验：',
          scene: TutorialSceneId.snapshotTopbar,
          targetIds: [
            TutorialTargetId.topbarSnapshotBtn,
            TutorialTargetId.mobileSnapshotBtn,
          ],
          preferredPlacement: SpotlightPlacement.top,
          padding: 6,
          actionGate: TutorialActionGate(
            actionId: TutorialActionId.saveSnapshot,
            buttonLabel: '快照',
          ),
        ),
        TutorialSpotlightStep(
          id: 'ver-timeline',
          moduleId: TutorialModuleId.versionDome,
          title: '穹顶弧形时间轴与跨版本考古',
          description:
              '高亮区就是穹档的核心时间轴：上方搜索框可跨历史上任意旧版本直接搜出曾写过的段落；下方弧形卡片支持多选任意两个版本生成逐行 Diff，或一键回滚至历史节点。',
          scene: TutorialSceneId.timelineDome,
          targetIds: [TutorialTargetId.timelinePanel],
          preferredPlacement: SpotlightPlacement.top,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'ver-darlings-btn',
          moduleId: TutorialModuleId.versionDome,
          title: '打开「废稿墓地」找回删掉的灵感段落',
          description:
              '如果说左侧栏底部的「回收站」用来永久保管整份文档，那么这里的「废稿墓地」则专管文档内部改稿时整段删掉（≥50字）的文字片段。请点击高亮的「废稿墓地」按钮打开查看！',
          scene: TutorialSceneId.timelineDome,
          targetIds: [TutorialTargetId.timelineDarlingsBtn],
          preferredPlacement: SpotlightPlacement.top,
          padding: 6,
          actionGate: TutorialActionGate(
            actionId: TutorialActionId.openDarlings,
            buttonLabel: '废稿墓地',
          ),
        ),
        TutorialSpotlightStep(
          id: 'ver-diff-modal',
          moduleId: TutorialModuleId.versionDome,
          title: '废稿墓地与跨版本智能 Diff',
          description:
              '现在已经为你打开实际面板：你可以在这里一键「捞回正文」捡回曾删掉的背景综述，也可以点击左上角切换到「差异对比」查看逐行增删高亮对比。',
          scene: TutorialSceneId.diffDarlings,
          targetIds: [TutorialTargetId.diffModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'ver-branch-modal',
          moduleId: TutorialModuleId.versionDome,
          title: 'A/B 平行思路分支管理',
          description:
              '无需任何 Git 命令！在「A/B 平行写作分支」界面（右上角菜单 → A/B 平行分支），你可以同时维护主线稿与「方案 B · 理论推导强化版」，随时新建并一键切换试验。',
          scene: TutorialSceneId.branchModal,
          targetIds: [TutorialTargetId.branchModal],
          preferredPlacement: SpotlightPlacement.bottom,
          padding: 6,
        ),
      ],
    ),
    TutorialModuleDef(
      id: TutorialModuleId.academicAi,
      summary: '内置三档 AI 隐私锁、学术句库胶囊、一致性体检官、Rebuttal 生成器与进化回放。',
      steps: [
        TutorialSpotlightStep(
          id: 'ai-privacy-lock',
          moduleId: TutorialModuleId.academicAi,
          title: '切换文档级三档 AI 隐私锁',
          description:
              '编辑器顶部信息栏集成了当前文档的封面保护状态、AI 隐私闸门与 Skills 状态。点击高亮区域中的「AI 隐私锁」标签即可在「云端/本地 → 仅本地模型 → 已禁止 AI」间实时切换。请点击一次试试：',
          scene: TutorialSceneId.editorAiBar,
          targetIds: [TutorialTargetId.editorAiBar],
          preferredPlacement: SpotlightPlacement.bottom,
          padding: 6,
          actionGate: TutorialActionGate(
            actionId: TutorialActionId.cycleAiPolicy,
            buttonLabel: 'AI 隐私锁',
          ),
        ),
        TutorialSpotlightStep(
          id: 'ai-phrasebank',
          moduleId: TutorialModuleId.academicAi,
          title: '学术写作句库悬浮胶囊',
          description:
              '已为你打开「学术写作句库胶囊」！日常可在屏幕边缘拖拽吸边悬浮球随时呼出，支持「智能推荐、章节导航、快捷检索、X/Y/Z 占位替换、收藏夹」，点选句式即可一键插入中/英文表达到正文。',
          scene: TutorialSceneId.phrasebankCapsule,
          targetIds: [TutorialTargetId.phrasebankModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'ai-paper-studio',
          moduleId: TutorialModuleId.academicAi,
          title: '一致性体检官 & Rebuttal 返修生成器',
          description:
              '已为你打开学术体检台（右上角菜单 → 一致性体检 & Rebuttal）：系统已自动扫描出示例论文里「94.2% 与 93.6% 口径不一致」等隐患并支持一键修正；切换顶部标签即可生成结构化 Rebuttal 审稿回复草稿。',
          scene: TutorialSceneId.paperStudio,
          targetIds: [TutorialTargetId.paperStudioModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'ai-context-assets',
          moduleId: TutorialModuleId.academicAi,
          title: '修改动机留痕 & 科研资产快照关联',
          description:
              '这里可将导师邮件、微信语音摘录、审稿意见等「修改动机」以及 .csv / .bib / 图表等科研资产哈希绑定到当前文档，半年后再回头看也能立刻明白当时为何这么改。',
          scene: TutorialSceneId.contextAssets,
          targetIds: [TutorialTargetId.contextAssetsModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'ai-evolution',
          moduleId: TutorialModuleId.academicAi,
          title: '近 14 日写作热力图与版本进化回放器',
          description:
              '在「进化工作室」中可查看近 14 天每日写作贡献热力格，拖动下方「版本进化回放器」滑块即可像延时摄影一样回看论文从初稿到终稿的演进全过程！',
          scene: TutorialSceneId.evolutionStudio,
          targetIds: [TutorialTargetId.evolutionStudioModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
      ],
    ),
    TutorialModuleDef(
      id: TutorialModuleId.syncSecurity,
      summary: '保险箱支持 AES-256-GCM 主密码与生物识别锁定；跨端同步支持局域网扫码、WebDAV 与 S3。',
      steps: [
        TutorialSpotlightStep(
          id: 'sec-vault',
          moduleId: TutorialModuleId.syncSecurity,
          title: '档案保险箱与 AES-256-GCM 加密锁',
          description:
              '已自动切换到「档案保险箱」空间并打开安全中心：在这里可设置主密码进行 PBKDF2 + AES-256-GCM 密文封锁，或通过本机指纹 / 面容生物识别快速解锁私密文档。',
          scene: TutorialSceneId.vaultLock,
          targetIds: [TutorialTargetId.vaultLockModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'sec-sync',
          moduleId: TutorialModuleId.syncSecurity,
          title: '跨端加密同步（局域网扫码 / WebDAV / S3）',
          description:
              '所有离端数据包均先执行 AES-256-GCM 端到端加密。推荐同 Wi-Fi 下使用「LAN 局域网」扫码配对零流量互传；也可切换到「WebDAV / S3」绑定坚果云或 R2/OSS 进行多端增量合并。',
          scene: TutorialSceneId.syncModal,
          targetIds: [TutorialTargetId.syncModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
      ],
    ),
    TutorialModuleDef(
      id: TutorialModuleId.themesMultidevice,
      summary: '配备四套动态与护眼移动主题（含 Material 3 Expressive 莫奈引擎），支持全参数调校与带封面 Word 导出。',
      steps: [
        TutorialSpotlightStep(
          id: 'theme-cards',
          moduleId: TutorialModuleId.themesMultidevice,
          title: '四套移动主题与莫奈动态取色引擎',
          description:
              '已为你打开设置中心的「外观与主题」页面！点击高亮区域里的任意主题（浅色极简、深邃夜色、护眼纸感、M3 莫奈动态取色），整个界面与沉浸状态栏都会实时焕然一新。',
          scene: TutorialSceneId.settingsThemes,
          targetIds: [TutorialTargetId.settingsThemesCard],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'settings-ai-device',
          moduleId: TutorialModuleId.themesMultidevice,
          title: 'AI 模型、触控滚动手柄与目录管理设置',
          description:
              '设置中心已切换到「AI 与 Skills」页签：可配置云端/本地模型接口与 Markdown Skill；顶部标签还可进入「字体排版」「目录与归档」「触控与多端」（定制右侧 TouchScrollScrubber 滚动手柄形状与触感强度）。',
          scene: TutorialSceneId.settingsAi,
          targetIds: [TutorialTargetId.settingsModal],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 6,
        ),
        TutorialSpotlightStep(
          id: 'export-delivery',
          moduleId: TutorialModuleId.themesMultidevice,
          title: '无损交付：带原封面与修订红线导出',
          description:
              '改稿定稿后，点击顶栏右上角高亮的「更多菜单（…）」按钮，即可选择「导出带原封面 Word (.docx)」「导出带修订红线 Word (.docx)」，或直接分享导出 .md / .tex。',
          scene: TutorialSceneId.exportTopbar,
          targetIds: [TutorialTargetId.topbarMoreBtn],
          preferredPlacement: SpotlightPlacement.bottom,
          padding: 6,
        ),
      ],
    ),
    TutorialModuleDef(
      id: TutorialModuleId.formatMatrix,
      summary: '不同格式在解析深度、双模编辑与无损导出上的支持程度不同，点击可直接对照。',
      steps: [
        TutorialSpotlightStep(
          id: 'fmt-office-live',
          moduleId: TutorialModuleId.formatMatrix,
          title: '真实界面对照：不同文件格式的能力边界',
          description:
              '已为你切到「办公文档」空间的真实 PPTX 示例并开启内置结构化预览：各格式支持能力差异如下：',
          bullets: [
            '.docx / .md / .tex：完整读写。支持双模互转、无损封面拼回与修订红线导出。',
            '.pptx / .xlsx：可解析幻灯片备注与多表数据作结构化只读预览及摘要，不能回写原二进制文件。',
            '.pdf / 其他：支持档案留存与配对笔记，不支持直接修改 PDF 原文排版。',
          ],
          scene: TutorialSceneId.formatOffice,
          targetIds: [TutorialTargetId.workspaceMain],
          preferredPlacement: SpotlightPlacement.bottom,
          phoneForceBottom: true,
          padding: 4,
        ),
      ],
    ),
    TutorialModuleDef(
      id: TutorialModuleId.limitations,
      summary: '提前了解工具边界，避免在关键交付前走弯路；随时可从右上角菜单或设置中重播任意板块。',
      steps: [
        TutorialSpotlightStep(
          id: 'lim-boundaries',
          moduleId: TutorialModuleId.limitations,
          title: '重要边界清单与随时重播入口',
          description: '在正式开始创作前，请知悉以下四项软件当前无法直接做到的能力边界：',
          bullets: [
            '无法直接编辑 PDF / PPTX / XLSX 或旧版 .doc 的原始排版并写回原二进制格式。',
            '不支持多人同时在线协同光标编辑（采用单人 Local-First + HLC 冲突合并）。',
            '不自带免费云盘空间，也无法突破坚果云等第三方网盘的月度流量配额与限流。',
            '日后如需回顾任何功能，可随时点击右上角「更多 → 使用教程」或「设置 → 触控与多端 → 重播互动使用教程」自选板块体验！',
          ],
          scene: TutorialSceneId.limitationsOverview,
          targetIds: [],
          preferredPlacement: SpotlightPlacement.auto,
        ),
      ],
    ),
  ];

  static TutorialModuleDef moduleById(TutorialModuleId id) =>
      modules.firstWhere((m) => m.id == id);

  static List<TutorialFlowStep> buildFlow(
    TutorialMode mode, {
    Set<TutorialModuleId>? selectedModules,
  }) {
    final List<TutorialModuleDef> activeModules;
    if (mode == TutorialMode.replay &&
        selectedModules != null &&
        selectedModules.isNotEmpty) {
      activeModules = modules.where((m) => selectedModules.contains(m.id)).toList();
    } else {
      activeModules = List<TutorialModuleDef>.from(modules);
    }

    final result = <TutorialFlowStep>[];
    for (final mod in activeModules) {
      for (var i = 0; i < mod.steps.length; i++) {
        result.add(
          TutorialFlowStep.spotlight(
            module: mod,
            step: mod.steps[i],
            stepIndexInModule: i,
            moduleStepCount: mod.steps.length,
          ),
        );
      }
    }

    if (mode == TutorialMode.firstRun) {
      result.add(const TutorialFlowStep.cacheSetup());
      result.add(const TutorialFlowStep.warning());
    }

    return result;
  }

  /// Legacy helper returning only spotlight steps (useful for tests/pickers).
  static List<TutorialSpotlightStep> buildSteps({Set<TutorialModuleId>? selectedModules}) {
    return buildFlow(
      selectedModules == null ? TutorialMode.replay : TutorialMode.replay,
      selectedModules: selectedModules,
    )
        .where((s) => s.kind == TutorialFlowStepKind.spotlight)
        .map((s) => s.step!)
        .toList();
  }

  static TutorialAdvanceRelation getStepAdvanceRelation(
    List<TutorialFlowStep> steps,
    int stepIndex,
  ) {
    if (stepIndex < 0 || stepIndex + 1 >= steps.length) {
      return TutorialAdvanceRelation.finish;
    }
    final cur = steps[stepIndex];
    final next = steps[stepIndex + 1];
    if (next.kind == TutorialFlowStepKind.cacheSetup) {
      return TutorialAdvanceRelation.cacheSetup;
    }
    if (next.kind == TutorialFlowStepKind.warning) {
      return TutorialAdvanceRelation.warning;
    }
    if (cur.kind == TutorialFlowStepKind.spotlight &&
        next.kind == TutorialFlowStepKind.spotlight &&
        cur.module!.id != next.module!.id) {
      return TutorialAdvanceRelation.nextModule;
    }
    return TutorialAdvanceRelation.nextStep;
  }

  static String formatActionGateButtonText(
    String buttonLabel,
    TutorialAdvanceRelation relation,
  ) {
    switch (relation) {
      case TutorialAdvanceRelation.nextModule:
        return '点击「$buttonLabel」按钮进入下一板块';
      case TutorialAdvanceRelation.cacheSetup:
        return '点击「$buttonLabel」按钮设置缓存目录';
      case TutorialAdvanceRelation.warning:
        return '点击「$buttonLabel」按钮进入必读警告';
      case TutorialAdvanceRelation.finish:
        return '点击「$buttonLabel」按钮完成教程';
      case TutorialAdvanceRelation.nextStep:
        return '点击「$buttonLabel」按钮进入下一步';
    }
  }

  static GuideCardPlacement computeGuideCardPlacement({
    required double containerWidth,
    required double containerHeight,
    required SpotlightRect? cutout,
    required double cardWidth,
    required double cardHeight,
    SpotlightPlacement preferredPlacement = SpotlightPlacement.auto,
    bool forcePlacementBottom = false,
    double margin = 12,
    double gap = 12,
    double topInset = 0,
    double bottomInset = 0,
  }) {
    final minTop = margin + topInset;
    final maxBottom = containerHeight - margin - bottomInset;
    final maxLeft = math.max(margin, containerWidth - cardWidth - margin);
    final maxTop = math.max(minTop, maxBottom - cardHeight);

    double clampLeft(double v) => v.clamp(margin, maxLeft).roundToDouble();
    double clampTop(double v) => v.clamp(minTop, maxTop).roundToDouble();

    if (forcePlacementBottom) {
      final centerLeft = cutout != null
          ? cutout.left + cutout.width / 2 - cardWidth / 2
          : (containerWidth - cardWidth) / 2;
      final availableHeight = math.max(160.0, maxBottom - minTop);
      return GuideCardPlacement(
        top: clampTop(maxBottom - math.min(cardHeight, availableHeight)),
        left: clampLeft(centerLeft),
        placement: GuideCardPlacementKind.bottom,
        maxHeight: cardHeight > availableHeight ? availableHeight : null,
      );
    }

    if (cutout == null) {
      final availableHeight = math.max(160.0, maxBottom - minTop);
      return GuideCardPlacement(
        top: clampTop(minTop + (maxBottom - minTop - math.min(cardHeight, availableHeight)) / 2),
        left: clampLeft((containerWidth - cardWidth) / 2),
        placement: GuideCardPlacementKind.center,
        maxHeight: cardHeight > availableHeight ? availableHeight : null,
      );
    }

    final spaceTop = cutout.top - minTop;
    final spaceBottom = maxBottom - cutout.bottom;
    final spaceLeft = cutout.left - margin;
    final spaceRight = containerWidth - cutout.right - margin;

    final fits = <SpotlightPlacement, bool>{
      SpotlightPlacement.top: spaceTop >= cardHeight + gap,
      SpotlightPlacement.bottom: spaceBottom >= cardHeight + gap,
      SpotlightPlacement.left: spaceLeft >= cardWidth + gap,
      SpotlightPlacement.right: spaceRight >= cardWidth + gap,
    };

    const candidates = [
      SpotlightPlacement.bottom,
      SpotlightPlacement.top,
      SpotlightPlacement.right,
      SpotlightPlacement.left,
    ];

    SpotlightPlacement chosen;
    if (preferredPlacement != SpotlightPlacement.auto &&
        (fits[preferredPlacement] ?? false)) {
      chosen = preferredPlacement;
    } else {
      chosen = candidates.firstWhere(
        (c) => fits[c] ?? false,
        orElse: () {
          final spaceMap = {
            SpotlightPlacement.top: spaceTop,
            SpotlightPlacement.bottom: spaceBottom,
            SpotlightPlacement.left: spaceLeft,
            SpotlightPlacement.right: spaceRight,
          };
          final sorted = List<SpotlightPlacement>.from(candidates)
            ..sort((a, b) => spaceMap[b]!.compareTo(spaceMap[a]!));
          return sorted.first;
        },
      );
    }

    if (chosen == SpotlightPlacement.bottom) {
      final availableBottom = maxBottom - cutout.bottom - gap;
      final fitsBottom = fits[SpotlightPlacement.bottom] ?? false;
      final rawTop = fitsBottom ? cutout.bottom + gap : maxBottom - cardHeight;
      return GuideCardPlacement(
        top: clampTop(rawTop),
        left: clampLeft(cutout.left + cutout.width / 2 - cardWidth / 2),
        placement: GuideCardPlacementKind.bottom,
        maxHeight: !fitsBottom && availableBottom >= 150 ? availableBottom : null,
      );
    }

    if (chosen == SpotlightPlacement.top) {
      final availableTop = cutout.top - minTop - gap;
      final fitsTop = fits[SpotlightPlacement.top] ?? false;
      final rawTop = fitsTop ? cutout.top - cardHeight - gap : minTop;
      return GuideCardPlacement(
        top: clampTop(rawTop),
        left: clampLeft(cutout.left + cutout.width / 2 - cardWidth / 2),
        placement: GuideCardPlacementKind.top,
        maxHeight: !fitsTop && availableTop >= 150 ? availableTop : null,
      );
    }

    if (chosen == SpotlightPlacement.right) {
      final fitsRight = fits[SpotlightPlacement.right] ?? false;
      final rawLeft = fitsRight ? cutout.right + gap : containerWidth - cardWidth - margin;
      return GuideCardPlacement(
        top: clampTop(cutout.top + cutout.height / 2 - cardHeight / 2),
        left: clampLeft(rawLeft),
        placement: GuideCardPlacementKind.right,
      );
    }

    final fitsLeft = fits[SpotlightPlacement.left] ?? false;
    final rawLeft = fitsLeft ? cutout.left - cardWidth - gap : margin;
    return GuideCardPlacement(
      top: clampTop(cutout.top + cutout.height / 2 - cardHeight / 2),
      left: clampLeft(rawLeft),
      placement: GuideCardPlacementKind.left,
    );
  }
}
