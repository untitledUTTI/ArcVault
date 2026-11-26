import '../models/archive_models.dart';

enum TutorialMode { firstRun, replay }

enum TutorialPhase { welcome, permissions, picker, player }

enum TutorialModuleId {
  workspace('workspace', '空间分区、回收站与双模编辑', '空间编辑', '核心工作台'),
  wordAnnotations('word-annotations', 'Word 封面识别与平行批注', '封面批注', 'Word 专属'),
  versionDome('version-dome', '版本穹顶、Diff 与 A/B 分支', '版本穹顶', '历史演进'),
  academicAi('academic-ai', '学术科研套件与 AI 隐私锁', '学术AI', '科研工作流'),
  syncSecurity('sync-security', '保险箱加密与多端 E2EE 同步', '加密同步', '数据安全'),
  themesMultidevice('themes-multidevice', '五套主题引擎与液态玻璃', '主题液态玻璃', '视觉触控'),
  formatMatrix('format-matrix', 'Word / MD / LaTeX / Office 矩阵', '导入导出', '格式矩阵'),
  limitations('limitations', '当前移动端支持范围与边界', '使用边界', '行前须知');

  const TutorialModuleId(this.id, this.title, this.shortTitle, this.badge);
  final String id;
  final String title;
  final String shortTitle;
  final String badge;
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
    this.actionGateLabel,
  });

  final String id;
  final TutorialModuleId moduleId;
  final String title;
  final String description;
  final List<String> bullets;
  final String scene;
  final String? actionGateLabel;
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

  static bool areAllPermissionsGranted(Set<String> grantedIds) =>
      mobilePermissionCards.every((c) => grantedIds.contains(c.id));

  static bool canConfirmWarning({
    required int remainingSeconds,
    required String input,
  }) =>
      remainingSeconds <= 0 && input.trim() == confirmPhrase;

  static const List<MobileThemeId> mobileWelcomeThemes = [
    MobileThemeId.light,
    MobileThemeId.dark,
    MobileThemeId.paper,
    MobileThemeId.m3Expressive,
    MobileThemeId.liquidGlass,
  ];

  static List<TutorialSpotlightStep> buildSteps({Set<TutorialModuleId>? selectedModules}) {
    final allow = selectedModules ?? TutorialModuleId.values.toSet();
    final all = <TutorialSpotlightStep>[
      const TutorialSpotlightStep(
        id: 'ws-spaces',
        moduleId: TutorialModuleId.workspace,
        title: '四大空间分区、文档入口与移入回收站',
        description:
            '左侧抽屉将文档划分为「论文工作区、办公文档、写作笔记、档案保险箱」四大独立空间。每张文档卡片右侧提供安全移入「内置永久回收站」入口。',
        bullets: [
          '点击顶部四空间图标即可切换工作区（保险箱强制本地加密与 AI 隔离）。',
          '内置回收站中的项目永久保留，绝不因时间过期而自动清理。',
        ],
        scene: 'workspace-sidebar',
      ),
      const TutorialSpotlightStep(
        id: 'ws-format',
        moduleId: TutorialModuleId.workspace,
        title: 'Markdown / LaTeX 双模切换与实时预览',
        description:
            '底部快捷学术条支持一键切换 MD / LaTeX、插入公式符号与开启 KaTeX 实时分栏预览。',
        bullets: [
          '支持 Markdown 与 LaTeX 语法无损互转同步。',
          '平板横屏自动展开多栏与 Arc-Link 贝塞尔光学连线。',
        ],
        scene: 'workspace-format',
        actionGateLabel: '预览',
      ),
      const TutorialSpotlightStep(
        id: 'cover-split',
        moduleId: TutorialModuleId.wordAnnotations,
        title: 'Word 智能封面识别与无损剥离',
        description:
            '导入 .docx 时自动识别并封存原封面 XML，正文改写绝不破坏校徽、封面表格与签名栏排版。',
        bullets: [
          '支持「不剥离全部导入」「取消」「确认切分并提取正文」底部三键操作。',
        ],
        scene: 'cover-split',
      ),
      const TutorialSpotlightStep(
        id: 'annotations-sheet',
        moduleId: TutorialModuleId.wordAnnotations,
        title: '平行批注卡片与半屏手势抽屉',
        description:
            '手机/平板竖屏点击「批注」或高亮片段可呼出半屏液态玻璃批注抽屉，左右滑动切卡，支持接受/拒绝修订与 AI 改写建议。',
        scene: 'annotations',
      ),
      const TutorialSpotlightStep(
        id: 'timeline-dome',
        moduleId: TutorialModuleId.versionDome,
        title: '版本穹顶时间轴、Diff 与废稿墓地',
        description:
            '每次打快照都基于 SHA-256/CAS 哈希去重存储，支持跨历史版本碎片考古检索、A/B 平行分支和废稿墓地一键找回。',
        scene: 'timeline-dome',
      ),
      const TutorialSpotlightStep(
        id: 'phrasebank-ai',
        moduleId: TutorialModuleId.academicAi,
        title: '学术句库悬浮胶囊与三档 AI 隐私锁',
        description:
            '屏幕边缘可拖拽吸边悬浮「学术句库胶囊」，内置 8 大写作板块与占位符替换；支持「云端/本地、仅本地 Ollama、禁用 AI」三档分级隐私锁。',
        scene: 'phrasebank-capsule',
      ),
      const TutorialSpotlightStep(
        id: 'vault-sync',
        moduleId: TutorialModuleId.syncSecurity,
        title: 'AES-256-GCM 保险箱与多端 E2EE 同步',
        description:
            '兼容桌面端 PBKDF2 + AES-256-GCM 密文格式与生物识别解锁；支持同一 Wi-Fi 局域网扫码直连、WebDAV 与 S3 加密增量同步。',
        scene: 'sync-modal',
      ),
      const TutorialSpotlightStep(
        id: 'themes-glass',
        moduleId: TutorialModuleId.themesMultidevice,
        title: '五套移动主题与全新「液态玻璃」定制引擎',
        description:
            '移动端配备浅色、深邃夜色、护眼纸感、M3 莫奈动态取色与全新「液态玻璃」主题，支持全参数滑块调节与设置页实时预览底栏！',
        bullets: [
          '沉浸式状态栏与主题背景/流光壁纸自然融为一体，不遮挡系统时间电量。',
          '右侧边缘配备可定制造型的 TouchScrollScrubber 触控滚动手柄。',
        ],
        scene: 'settings-themes',
      ),
      const TutorialSpotlightStep(
        id: 'limits',
        moduleId: TutorialModuleId.limitations,
        title: '移动端能力边界与安全提示',
        description:
            '本机所有文档、快照与保险箱密钥均以 Local-First 方式存储于你指定的缓存与备份目录；接入第三方 AI 时请合理设置隐私锁。',
        scene: 'limitations-overview',
      ),
    ];

    return all.where((s) => allow.contains(s.moduleId)).toList();
  }
}
