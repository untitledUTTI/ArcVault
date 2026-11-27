import '../models/archive_models.dart';

class ArcHighlightItem {
  const ArcHighlightItem({required this.title, required this.desc});
  final String title;
  final String desc;
}

class ArcStrings {
  const ArcStrings._(this.isZh);
  final bool isZh;

  factory ArcStrings.of(LocaleId locale) => ArcStrings._(locale.isZh);

  String get brandName => isZh ? 'ArcVault · 穹档' : 'ArcVault';
  String get brandSubtitle =>
      isZh ? '个人数字档案库 & 论文演进工作台' : 'Personal Archive & Thesis Evolution Studio';

  String themeName(MobileThemeId id) {
    switch (id) {
      case MobileThemeId.light:
        return isZh ? '浅色极简' : 'Light Minimal';
      case MobileThemeId.dark:
        return isZh ? '深邃夜色' : 'Deep Night';
      case MobileThemeId.paper:
        return isZh ? '护眼纸感' : 'Warm Paper';
      case MobileThemeId.m3Expressive:
        return 'Material 3 Expressive';
    }
  }

  String themeDesc(MobileThemeId id) {
    switch (id) {
      case MobileThemeId.light:
        return isZh ? '明亮通透，日常办公首选' : 'Crisp and bright for everyday work';
      case MobileThemeId.dark:
        return isZh ? '低眩光暗调，深夜爆肝护眼' : 'Low-glare dark mode for late-night focus';
      case MobileThemeId.paper:
        return isZh ? '暖米纸墨质感，长文精读舒适' : 'Warm parchment tone for long reading sessions';
      case MobileThemeId.m3Expressive:
        return isZh ? '柔紫灵动色阶与莫奈动态取色' : 'Expressive tonal palette with Monet dynamic color';
    }
  }

  // Actions
  String get importDocx => isZh ? '导入 Word / 文档' : 'Import Word / Doc';
  String get importSample => isZh ? '生成示例论文 .docx' : 'Load Sample Thesis .docx';
  String get newDoc => isZh ? '新建空白文档' : 'New Blank Doc';
  String get snapshot => isZh ? '打里程碑快照' : 'Save Milestone';
  String get undo => isZh ? '撤销' : 'Undo';
  String get redo => isZh ? '重做' : 'Redo';
  String get seal => isZh ? '封存锁定' : 'Seal Lock';
  String get unseal => isZh ? '解除封存' : 'Unseal';
  String get exportMenu => isZh ? '导出交付' : 'Export';
  String get exportCleanWord => isZh ? '导出带原封面 Word (.docx)' : 'Export Word with Original Cover (.docx)';
  String get exportRedlineWord => isZh ? '导出带修订红线 Word (.docx)' : 'Export Redline Word (.docx)';
  String get exportMd => isZh ? '导出 Markdown (.md)' : 'Export Markdown (.md)';
  String get exportTex => isZh ? '导出 LaTeX (.tex)' : 'Export LaTeX (.tex)';
  String get adjustCover => isZh ? '微调封面切分' : 'Adjust Cover Split';
  String get settings => isZh ? '设置' : 'Settings';
  String get diffCompare => isZh ? '版本对比 (Diff)' : 'Compare Versions';
  String get acceptRevision => isZh ? '接受修订' : 'Accept Revision';
  String get rejectRevision => isZh ? '拒绝修订' : 'Reject Revision';
  String get resolveComment => isZh ? '标记已解决' : 'Mark Resolved';
  String get reopenComment => isZh ? '重新打开' : 'Reopen';
  String get aiSuggest => isZh ? 'AI 修改建议' : 'AI Rewrite';
  String get applyAi => isZh ? '应用建议' : 'Apply Suggestion';
  String get reply => isZh ? '回复' : 'Reply';

  // Topbar
  String get brandShort => isZh ? '穹档' : 'ArcVault';
  String get preview => isZh ? '预览' : 'Preview';
  String get edit => isZh ? '编辑' : 'Edit';
  String get toolbox => isZh ? '工具箱' : 'Toolbox';
  String get snapshotShort => isZh ? '快照' : 'Snap';
  String get exportShort => isZh ? '导出' : 'Export';
  String get fullscreen => isZh ? '全屏' : 'Focus';
  String get exitFullscreen => isZh ? '退出全屏' : 'Exit Focus';
  String get branches => isZh ? 'A/B 平行分支' : 'A/B Parallel Branches';
  String get paperStudioShort => isZh ? '一致性体检 & Rebuttal' : 'Consistency & Rebuttal';
  String get contextAssetsShort => isZh ? '修改动机 & 科研资产' : 'Motivations & Assets';
  String get evolutionStudioShort => isZh ? '写作热力图 & 进化回放' : 'Heatmap & Evolution';
  String get phrasebankShort => isZh ? '学术句库' : 'Phrasebank';
  String get tutorialShort => isZh ? '使用教程（支持自选重播）' : 'Interactive Tutorial';
  String get syncLabel => isZh ? '跨端加密同步' : 'E2EE Sync';
  String get timelineSheet => isZh ? '版本穹顶时间轴 & Diff' : 'Arc Dome Timeline & Diff';
  String get annotationsSheet => isZh ? '批注与修订卡片' : 'Annotations & Revisions';
  String get cameraScan => isZh ? '拍照扫描入库' : 'Camera Scan Intake';
  String get shareIntake => isZh ? '系统分享 / 剪贴板入库' : 'System Share / Clipboard Intake';
  String get switchTheme => isZh ? '切换主题' : 'Theme';
  String get switchLanguage => isZh ? '切换语言' : 'Language';
  String get openMenu => isZh ? '打开档案列表' : 'Open Archive Drawer';

  // Sidebar
  String get sidebarHeader => isZh ? '空间与数字档案库' : 'Spaces & Digital Archive';
  String get closeDrawer => isZh ? '关闭档案抽屉' : 'Close Archive Drawer';
  String get cameraScanShort => isZh ? '拍照扫描' : 'Scan';
  String get shareIntakeShort => isZh ? '分享入库' : 'Share Intake';
  String get vaultUnlocked => isZh ? '保险箱加密保护 / 验真' : 'Vault Encrypted / Verified';
  String get vaultLocked => isZh ? '保险箱已上锁 · 点击解锁' : 'Vault Locked · Click to Unlock';
  String get sidebarEmpty => isZh
      ? '当前空间暂无档案，点击上方导入 `.docx` 或新建文档。'
      : 'No documents in this space. Import `.docx` or create a new doc above.';
  String get snapUnit => isZh ? '版' : 'v';
  String get openAnnotations => isZh ? '待处理批注/修订' : 'open annotations/revisions';
  String get trashEntry => isZh ? '回收站' : 'Trash';
  String get trashPermanentBadge => isZh ? '永久保留' : 'Kept Forever';
  String get moveToTrash => isZh ? '移入回收站（永久保留）' : 'Move to Trash (Kept Permanently)';

  // Trash
  String get trashTitle => isZh ? '内置回收站' : 'Built-in Trash';
  String get trashPermanentLong => isZh ? '永久保留 · 不自动清理' : 'Kept Permanently · Never Auto-Purged';
  String get trashNotice => isZh
      ? '回收站中的项目永久保留，不会自动清理或过期销毁，可随时预览内容或一键还原至原空间（完整保留版本历史、分支与批注）。'
      : 'Items in Trash are retained permanently and will never expire or be auto-purged. You can preview content or restore any document back to its original space with all snapshots, branches, and annotations intact.';
  String get trashSearchPlaceholder =>
      isZh ? '搜索回收站中的文档标题或正文片段...' : 'Search trashed document titles or excerpts...';
  String get trashEmptyTitle => isZh ? '回收站当前为空' : 'Trash is empty';
  String get trashEmptyDesc => isZh
      ? '点击左侧栏任意文档卡片上的回收站图标，即可将文档安全移入此处永久保管。'
      : 'Tap the trash icon on any document card in the sidebar to move it here safely.';
  String get restoreBtn => isZh ? '一键还原' : 'Restore';

  // Timeline
  String get timelineTitle => isZh ? '版本穹顶时间轴' : 'Arc Dome Timeline';
  String get arcDome => isZh ? '穹顶弧形时间轴' : 'Arc Dome Timeline';
  String get listCalendar => isZh ? '时间轴 & 碎片考古' : 'Timeline & Fragment Search';
  String get deletedDarlings => isZh ? '废稿墓地' : 'Deleted Darlings';
  String get compareSelected => isZh ? '对比所选 2 个版本' : 'Compare Selected (2)';
  String get compareLatest => isZh ? '对比最近两版差异' : 'Compare Latest Two';
  String get rollbackBtn => isZh ? '回滚到此版' : 'Restore This Version';
  String get mainBranch => isZh ? '主线' : 'Main';

  // Editor & Annotations
  String get annotationsEmpty => isZh
      ? '当前文档暂无 Word 批注或修订卡片。导入带导师批注/修订的 `.docx` 后，卡片将在此显示。'
      : 'No Word comments or track-changes yet. Import a `.docx` with reviewer comments to see them here.';
  String get aiPolicyLabel => isZh ? 'AI 隐私锁：' : 'AI Privacy: ';
  String get aiCloudLocal => isZh ? '云端/本地可用' : 'Cloud / Local';
  String get aiLocalOnly => isZh ? '仅本地 Ollama' : 'Local Ollama Only';
  String get aiDisabled => isZh ? '已禁止 AI' : 'AI Disabled';
  String get settingsTitle => isZh ? 'ArcVault · 穹档设置中心' : 'ArcVault Settings';
  String get done => isZh ? '完成' : 'Done';

  // Welcome
  String get welcomeBadge => isZh ? '首次启动 · 欢迎' : 'First Launch · Welcome';
  String get welcomeTitle => isZh ? '欢迎使用 ArcVault · 穹档' : 'Welcome to ArcVault';
  String get welcomeSubtitle => isZh
      ? '本地优先的个人数字档案库与学术论文演进工作台'
      : 'Local-First Personal Archive & Academic Writing Studio';
  String get welcomeHintTouch =>
      isZh ? '进入教程前，可先选择喜欢的界面主题与语言' : 'Choose your preferred theme and language before starting';
  String get enterTutorialBtn => isZh ? '进入并开始使用教程' : 'Enter & Start Tutorial';
  String get preparingBtn => isZh ? '正在准备工作区...' : 'Preparing workspace...';
  String get tutorialHint => isZh
      ? '点击下方按钮后将进入实景互动使用教程，直接在真实工作台界面上逐步引导体验核心功能。'
      : 'Tap below to enter the live interactive tutorial on the real workspace.';

  List<ArcHighlightItem> get welcomeHighlights => isZh
      ? const [
          ArcHighlightItem(title: '四大空间与永久回收站', desc: '按场景隔离档案，内置回收站永久保留不自动清理'),
          ArcHighlightItem(title: 'Word 无损封面与平行批注', desc: '自动剥离封面 XML，导出原封不动拼回并支持修订连线'),
          ArcHighlightItem(title: '版本穹顶与 A/B 平行分支', desc: 'CAS 哈希去重快照、弧形时间轴、Diff 与废稿考古'),
          ArcHighlightItem(title: '保险箱加密与 E2EE 同步', desc: 'AES-256-GCM 本地加密锁与局域网扫码 / WebDAV / S3'),
        ]
      : const [
          ArcHighlightItem(title: '4 Spaces & Permanent Trash', desc: 'Separate workspaces with a built-in trash that never auto-purges'),
          ArcHighlightItem(title: 'Lossless Word Cover & Annotations', desc: 'Preserves original cover XML and aligns margin comments'),
          ArcHighlightItem(title: 'Version Dome & A/B Branches', desc: 'CAS-deduplicated snapshots, arc timeline, Diff & darlings'),
          ArcHighlightItem(title: 'AES-256-GCM Vault & E2EE Sync', desc: 'Local encrypted vault lock with LAN QR, WebDAV & S3 sync'),
        ];
}
