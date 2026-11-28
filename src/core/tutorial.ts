export const TUTORIAL_COMPLETED_STORAGE_KEY = 'arcvault_onboarding_completed';
export const TUTORIAL_WARNING_COUNTDOWN_SECONDS = 10;
export const TUTORIAL_CONFIRM_PHRASE = '我已了解';
export const TUTORIAL_WARNING_TEXT =
  '推荐使用付费模型如Claude Fable/Sonnet、GPT Astra/Sol、Gemini Carbon/Neon（国内顶尖模型也可）。注意合理消费，请勿通过第三方平台、二手平台进行充值，谨防受骗！不要过度依赖AI，理性辨别AI生成的内容，AI给出的建议可能不准确！';

export type TutorialModuleId =
  | 'workspace'
  | 'word-annotations'
  | 'version-dome'
  | 'academic-ai'
  | 'sync-security'
  | 'themes-multidevice'
  | 'format-matrix'
  | 'limitations';

export type TutorialMode = 'first-run' | 'replay';

export type TutorialPhase = 'welcome' | 'permissions' | 'picker' | 'player';

export function getInitialTutorialPhase(mode: TutorialMode): TutorialPhase {
  return mode === 'first-run' ? 'welcome' : 'picker';
}

export interface MobilePermissionCardDef {
  id: 'storage' | 'camera' | 'local-network' | 'biometric';
  title: string;
  description: string;
  actionLabel: string;
  required: boolean;
}

export const MOBILE_PERMISSION_CARDS: MobilePermissionCardDef[] = [
  {
    id: 'storage',
    title: '文件与存储访问权限',
    description: '用于读写本地文档、自定义缓存目录、CAS 去重快照与定时备份。',
    actionLabel: '前往授权',
    required: true,
  },
  {
    id: 'camera',
    title: '相机权限',
    description: '用于「纸质稿扫描导入」与局域网同步扫码配对。',
    actionLabel: '点击授权',
    required: false,
  },
  {
    id: 'local-network',
    title: '局域网 / 附近设备权限',
    description: '用于同一 Wi-Fi 下与电脑端高速直连同步，零网盘流量消耗。',
    actionLabel: '前往设置',
    required: false,
  },
  {
    id: 'biometric',
    title: '生物识别（指纹 / 面容）',
    description: '用于快速解锁「档案保险箱」中的加密私密文档。',
    actionLabel: '点击验证',
    required: false,
  },
];

export function shouldShowMobilePermissionsStep(
  mode: TutorialMode,
  deviceEnv: { os?: string; isPhone?: boolean; isTablet?: boolean },
): boolean {
  if (mode !== 'first-run') return false;
  if (deviceEnv.os !== 'android') return false;
  return Boolean(deviceEnv.isPhone || deviceEnv.isTablet);
}

export function areAllMobilePermissionsGranted(
  grantedIds: readonly string[],
  cards: readonly MobilePermissionCardDef[] = MOBILE_PERMISSION_CARDS,
): boolean {
  const grantedSet = new Set(grantedIds);
  return cards.every((c) => grantedSet.has(c.id));
}

export type TutorialSceneId =
  | 'workspace-sidebar'
  | 'trash-modal'
  | 'workspace-format'
  | 'cover-split'
  | 'annotations'
  | 'snapshot-topbar'
  | 'timeline-dome'
  | 'diff-darlings'
  | 'branch-modal'
  | 'editor-ai-bar'
  | 'phrasebank-capsule'
  | 'paper-studio'
  | 'context-assets'
  | 'evolution-studio'
  | 'vault-lock'
  | 'sync-modal'
  | 'settings-themes'
  | 'settings-ai'
  | 'export-topbar'
  | 'format-office'
  | 'limitations-overview';

export interface TutorialActionGate {
  /** CSS selector matching the real interactive control the user should click */
  triggerSelector: string;
  /** Optional fallback selector (e.g. cancel button on CoverSplitModal so closing doesn't orphan the tour) */
  fallbackTriggerSelector?: string;
  /** Button name displayed inside disabled Next button, e.g. '确认切分并提取正文' */
  buttonLabel: string;
}

export interface TutorialSpotlightStep {
  id: string;
  moduleId: TutorialModuleId;
  title: string;
  description: string;
  bullets?: string[];
  /** Independent mobile/touch copy so phone & tablet never show desktop keyboard shortcuts */
  mobileTitle?: string;
  mobileDescription?: string;
  mobileBullets?: string[];
  scene: TutorialSceneId;
  /** Ordered list of CSS selectors to resolve the spotlight target; empty = centered card over full dark mask */
  targetSelectors: string[];
  /** Optional additional selectors whose visible rects are unioned into the spotlight cutout */
  unionSelectors?: string[];
  /** Padding around spotlight cutout in px (default 6) */
  padding?: number;
  /** Preferred guide card placement relative to cutout */
  preferredPlacement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  /** When true, pin guide card to bottom of screen on phone/tablet-portrait viewports regardless of cutout space */
  phoneForceBottom?: boolean;
  /** When true, always pin guide card to bottom of screen across all viewports */
  forceBottom?: boolean;
  /** When set, the Next button is disabled and shows "点击「xxx」按钮进入下一步/下一板块"; clicking the real element auto-advances */
  actionGate?: TutorialActionGate;
}

export interface TutorialModuleDef {
  id: TutorialModuleId;
  title: string;
  shortTitle: string;
  badge: string;
  summary: string;
  points: string[];
  steps: TutorialSpotlightStep[];
}

export type TutorialStep =
  | {
      kind: 'step';
      module: TutorialModuleDef;
      step: TutorialSpotlightStep;
      stepIndexInModule: number;
      moduleStepCount: number;
    }
  | { kind: 'cache-setup' }
  | { kind: 'warning' };

export type TutorialAdvanceRelation =
  | 'next-step'
  | 'next-module'
  | 'cache-setup'
  | 'warning'
  | 'finish';

export interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export const TUTORIAL_MODULES: TutorialModuleDef[] = [
  {
    id: 'workspace',
    title: '空间分区、回收站与双模编辑',
    shortTitle: '空间编辑',
    badge: '核心工作台',
    summary: '四大空间按场景隔离文档，支持左侧栏内置永久回收站与 Markdown / LaTeX 双向编辑。',
    points: [
      '四大空间：论文工作区、办公文档、写作笔记、档案保险箱（强制本地加密锁）。',
      '内置永久回收站：左侧栏可将文档移入内置回收站，项目永久保留永不自动清理，底部入口随时还原。',
      '双模编辑：MD 与 LaTeX 互通切换，右侧分栏支持 KaTeX 数学公式与表格实时渲染。',
      '自由布局：电脑端可拖动分栏边界调整宽度，支持保存和一键切换多套布局预设。',
    ],
    steps: [
      {
        id: 'ws-spaces',
        moduleId: 'workspace',
        title: '四大空间分区、文档入口与移入回收站',
        description:
          '左侧边栏将文档按场景划分为「论文工作区、办公文档、写作笔记、档案保险箱」四大独立空间，互不混杂。你可以直接在此导入文件、载入示例论文，或点击文档卡片右侧的回收站图标将不再需要的文档移入内置回收站。',
        bullets: [
          '点击上方四个空间按钮即可切换工作区（保险箱强制本地加密与 AI 隔离）。',
          '点击文档标题旁的回收站图标可将其安全移入内置回收站（已封存锁定文档受保护，需先解除封存）。',
        ],
        scene: 'workspace-sidebar',
        targetSelectors: ['[data-tour="sidebar-panel"]'],
        preferredPlacement: 'right',
        padding: 6,
      },
      {
        id: 'ws-trash-btn',
        moduleId: 'workspace',
        title: '左侧栏底部：软件内置永久回收站',
        description:
          '高亮按钮就是位于左侧栏最底部的「回收站」入口！放入回收站的文档项目将永久保留、永不自动清理，随时可预览或一键还原到原空间。请点击「回收站」按钮打开查看：',
        bullets: [
          '所有从左侧栏移入的文档都会集中保存在这里，版本历史、分支与批注完整无损。',
          '不同于普通系统回收站，穹档回收站支持永久保留，不会因时间过期而自动清空。',
        ],
        scene: 'workspace-sidebar',
        targetSelectors: ['[data-tour="sidebar-trash-btn"]'],
        preferredPlacement: 'right',
        padding: 6,
        actionGate: {
          triggerSelector: '[data-tour="sidebar-trash-btn"]',
          buttonLabel: '回收站',
        },
      },
      {
        id: 'ws-trash-modal',
        moduleId: 'workspace',
        title: '回收站界面：永久保留与一键还原',
        description:
          '已为你打开「内置回收站」界面：这里集中保管所有移入回收站的文档，支持按标题或片段检索、展开只读内容预览，并可随时点击「一键还原」将其放回原本所在的工作空间。',
        bullets: [
          '回收站中的项目永久保留，不会自动清理或过期销毁，彻底避免误删损失。',
          '查看完成后点击「下一步」，继续体验 Markdown / LaTeX 双模编辑。',
        ],
        scene: 'trash-modal',
        targetSelectors: ['[data-tour="trash-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        forceBottom: true,
        padding: 6,
      },
      {
        id: 'ws-format',
        moduleId: 'workspace',
        title: 'Markdown / LaTeX 双模切换与实时预览',
        description:
          '高亮区域支持一键切换 MD 与 LaTeX 双源码视图，并实时双向同步。现在请你亲自点击一次「预览」按钮，开启右侧 KaTeX 公式与排版实时分栏预览！',
        bullets: [
          '点击「MD / LaTeX」可在两种学术语法间无损互转编辑。',
          '电脑端支持拖动分栏边界与保存多套布局预设，手机端自动适配底部快捷格式条。',
        ],
        mobileBullets: [
          '点击「MD / LaTeX」可在两种学术语法间无损互转编辑。',
          '底部快捷格式条可一键切换双模与实时预览，触控操作无需外接键盘。',
        ],
        scene: 'workspace-format',
        targetSelectors: ['[data-tour="topbar-format-switch"]', '[data-tour="mobile-format-bar"]'],
        preferredPlacement: 'bottom',
        padding: 6,
        actionGate: {
          triggerSelector: '[data-tour="format-preview-btn"]',
          buttonLabel: '预览',
        },
      },
    ],
  },
  {
    id: 'word-annotations',
    title: 'Word 封面识别与平行批注',
    shortTitle: '封面批注',
    badge: 'Word 专属',
    summary: '导入 .docx 时自动剥离封面排版，导出时原封不动拼回，配合平行批注连线高效改稿。',
    points: [
      '无损封面切分：导入 .docx 后可手动微调“正文起点”，正文改写不破坏原封面 XML。',
      '底部三键分工：支持全部导入、取消返回、确认切分并提取正文。',
      '分屏与平行审阅：桌面端带 Arc-Link 平行连线；移动端长按正文胶囊「进入审阅模式」，分屏拖动句柄调整大小，顶栏缩为悬浮球、底栏胶囊随原文宽度自适应。',
      '黑板便签与贴纸存档：长按审阅区进入黑板视图（第一行批注、第二行修订，双指缩放与底部章节/搜索胶囊），切换便签自动独立存档草稿并绑定贴纸（最新在最下方）。',
    ],
    steps: [
      {
        id: 'cover-pick-line',
        moduleId: 'word-annotations',
        title: '第一步：选择正文开始处是哪一行',
        description:
          '已为你自动打开「智能封面识别与切分微调」界面！黑色遮罩外无法操作，请直接在高亮列表里点击任意段落行（或顶部的「快速定位分界点」标签）来指定「▼ 正文从此开始」的位置；前方的封面段落将被无损封存，导出 Word 时原封不动拼回。',
        bullets: [
          '黄色「封面保留区」不会混入正文编辑器，校徽、学院表格、签名栏零格式破坏。',
          '选好正文起点行后，点击本指引卡片右下角的「下一步」。',
        ],
        scene: 'cover-split',
        targetSelectors: ['[data-tour="cover-split-body"]'],
        preferredPlacement: 'right',
        phoneForceBottom: true,
        padding: 4,
      },
      {
        id: 'cover-footer-btns',
        moduleId: 'word-annotations',
        title: '第二步：认识底部三个功能按钮并体验确认',
        description:
          '高亮区域是封面识别界面的底部操作栏，三个按钮各司其职，请你查看说明后亲自点击「确认切分并提取正文」体验生效过程：',
        bullets: [
          '「不剥离封面（全部导入）」：将第 1 段起所有内容全部当作正文导入编辑。',
          '「取消」：放弃本次切分微调，关闭弹窗保持原样。',
          '「确认切分并提取正文」：锁定封存前方封面 XML，只把选定起点之后的正文提取进编辑器。',
        ],
        scene: 'cover-split',
        targetSelectors: ['[data-tour="cover-split-footer"]'],
        preferredPlacement: 'top',
        phoneForceBottom: true,
        padding: 6,
        actionGate: {
          triggerSelector: '[data-tour="cover-confirm-btn"]',
          fallbackTriggerSelector: '[data-tour="cover-cancel-btn"]',
          buttonLabel: '确认切分并提取正文',
        },
      },
      {
        id: 'ann-open-card',
        moduleId: 'word-annotations',
        title: '第三步：分屏审阅模式与黑板便签视图',
        description:
          '导入带批注的 .docx 后，电脑端可在右侧平行批注栏审阅；移动端点击标红/标蓝高亮不再弹出卡片，而是长按任意正文通过胶囊菜单「进入审阅模式」开启分屏审阅（可拖动句柄调整比例），长按审阅区还可切换为黑板大头针便签视图！',
        bullets: [
          '蓝色标识为「批注」，红色标识为「修订建议」，点击正文高亮仅定位选中，长按文本即可呼出胶囊菜单进入审阅模式。',
          '黑板视图第一行为批注便签、第二行为修订便签，支持上下左右滑动切签、双指缩放黑板，底部淡入胶囊支持快速切换章节与搜索。',
        ],
        mobileDescription:
          '导入带批注的 .docx 后，点击标红/标蓝高亮可定位选中；长按任意正文通过胶囊菜单「进入审阅模式」即可开启分屏审阅（可拖动句柄调整比例），长按审阅区还可切换为黑板大头针便签视图！',
        mobileBullets: [
          '蓝色标识为「批注」，红色标识为「修订建议」，长按正文呼出胶囊菜单进入分屏审阅模式。',
          '黑板视图第一行为批注便签、第二行为修订便签，支持滑动切签与双指缩放，底部胶囊支持章节跳转与搜索。',
        ],
        scene: 'annotations',
        targetSelectors: ['[data-tour="annotation-sidebar"]'],
        preferredPlacement: 'left',
        padding: 6,
      },
      {
        id: 'ann-actions',
        moduleId: 'word-annotations',
        title: '第四步：修订处理、独立草稿与贴纸存档',
        description:
          '在平行批注栏或分屏审阅区中，你可以直接处理批注与修订，未保存的草稿也会与便签独立绑定并生成贴纸存档：',
        bullets: [
          '修订支持「采纳修订 / 拒绝修订」，一键同步修改正文并支持 Ctrl+Z 撤销；批注支持「标记解决 / 回复」与「AI 改写建议」。',
          '切换便签时未保存的草稿自动独立保存并绑定贴纸显示在黑板下方（支持自定义贴纸与导入 PNG，最新存档始终在贴纸列最下方，点击贴纸即可回到上次存档）。',
        ],
        mobileBullets: [
          '修订支持「采纳修订 / 拒绝修订」，一键同步修改正文并可通过顶部「撤销」按钮撤回；批注支持「标记解决 / 回复」与「AI 改写建议」。',
          '切换便签时未保存的草稿自动独立保存并绑定贴纸显示在黑板下方（支持自定义贴纸与导入 PNG，最新存档始终在贴纸列最下方，点击贴纸即可回到上次存档）。',
        ],
        scene: 'annotations',
        targetSelectors: ['[data-tour="annotation-sidebar"]'],
        preferredPlacement: 'left',
        padding: 6,
      },
    ],
  },
  {
    id: 'version-dome',
    title: '版本穹顶、分支与废稿考古',
    shortTitle: '版本分支',
    badge: '版本演进',
    summary: '每次快照按内容哈希去重存储，支持底部弧形时间轴、A/B 分支合并与废稿墓地捡回。',
    points: [
      'CAS 去重快照：未改动内容不占额外空间，每次里程碑在底部“穹顶弧形时间轴”留档。',
      'A/B 平行分支：可分出多条改稿路线独立实验，满意后再一键合并回主线（可 Ctrl+Z 撤销）。',
      '废稿墓地 & 全文考古：跨历史版本搜索已删除句段，大段删除自动保留在废稿墓地。',
    ],
    steps: [
      {
        id: 'ver-snapshot',
        moduleId: 'version-dome',
        title: '一键打里程碑快照（CAS 哈希去重）',
        description:
          '点击顶栏高亮的「快照」按钮（快捷键 Ctrl/Cmd + S），系统会对当前正文计算内容哈希：若有改动则生成增量版本节点；若正文完全未改动则自动命中去重，0 字节冗余写入！请点击「快照」按钮体验：',
        mobileDescription:
          '点击顶栏高亮的「快照」按钮，系统会对当前正文计算内容哈希：若有改动则生成增量版本节点；若正文完全未改动则自动命中去重，0 字节冗余写入！请点击「快照」按钮体验：',
        scene: 'snapshot-topbar',
        targetSelectors: ['[data-tour="topbar-snapshot-btn"]'],
        preferredPlacement: 'bottom',
        padding: 6,
        actionGate: {
          triggerSelector: '[data-tour="topbar-snapshot-btn"]',
          buttonLabel: '快照',
        },
      },
      {
        id: 'ver-timeline',
        moduleId: 'version-dome',
        title: '底部穹顶弧形时间轴与跨版本考古',
        description:
          '下方高亮区就是穹档的核心时间轴：主弧线展示主线里程碑，内圈虚线弧展示平行分支；点击任意两颗版本节点再点「对比」，即可生成逐行 Diff；在中间搜索框输入关键词还能直接搜出历史上任意旧版本里的段落！',
        scene: 'timeline-dome',
        targetSelectors: ['[data-tour="timeline-panel"]'],
        preferredPlacement: 'top',
        padding: 6,
      },
      {
        id: 'ver-darlings-btn',
        moduleId: 'version-dome',
        title: '打开「废稿墓地」找回删掉的灵感段落',
        description:
          '如果说左侧栏底部的「回收站」用来永久保管整份文档，那么这里的「废稿墓地」则专管文档内部改稿时整段删掉（≥50字）的文字片段。请点击高亮的「废稿墓地」按钮打开查看！',
        scene: 'timeline-dome',
        targetSelectors: ['[data-tour="timeline-darlings-btn"]'],
        preferredPlacement: 'top',
        padding: 6,
        actionGate: {
          triggerSelector: '[data-tour="timeline-darlings-btn"]',
          buttonLabel: '废稿墓地',
        },
      },
      {
        id: 'ver-diff-modal',
        moduleId: 'version-dome',
        title: '废稿墓地与跨版本智能 Diff',
        description:
          '现在已经为你打开实际面板：你可以在这里一键复制捡回曾删掉的背景综述，也可以点击左上角切换到「跨版本智能 Diff」查看增删行高亮对比。',
        scene: 'diff-darlings',
        targetSelectors: ['[data-tour="diff-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        forceBottom: true,
        padding: 6,
      },
      {
        id: 'ver-branch-modal',
        moduleId: 'version-dome',
        title: 'A/B 平行思路分支与可视化合并',
        description:
          '无需任何 Git 命令！在「A/B 平行思路分支」界面（工具箱 → 平行分支），你可以同时维护主线稿与「方案 B · 理论推导强化版」，随时切换试验或点击「对比合并到主线」逐块挑选保留段落。',
        scene: 'branch-modal',
        targetSelectors: ['[data-tour="branch-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        forceBottom: true,
        padding: 6,
      },
    ],
  },
  {
    id: 'academic-ai',
    title: '学术科研套件与三档 AI 隐私锁',
    shortTitle: '学术 AI',
    badge: '智能辅助',
    summary: '内置三档 AI 隐私锁、学术句库胶囊、一致性体检官、Rebuttal 生成器与进化回放。',
    points: [
      '三档隐私锁：支持“云端或本地 / 仅本地模型 / 完全禁用”，保险箱空间强制禁用云端 AI。',
      '学术句库悬浮胶囊：快捷键 Alt+P（Mac 为 ⌥P）呼出常用学术表达、占位符与段落骨架。',
      '一致性体检 & 返修：自动核查摘要/图表/结论数值口径，一键生成中英文审稿回复草稿。',
      '动机留痕 & 进化回放：绑定导师邮件/科研资产快照，查看 14 天热力图并导出纪念海报。',
    ],
    steps: [
      {
        id: 'ai-privacy-lock',
        moduleId: 'academic-ai',
        title: '切换文档级三档 AI 隐私锁',
        description:
          '编辑器顶部栏集成了当前文档的隐私闸门、Skills 状态与学术句库开关。点击高亮的「AI 隐私锁」按钮即可在「云端或本地 → 仅本地模型 → 完全禁用 AI」之间实时切换。请点击一次按钮试试：',
        scene: 'editor-ai-bar',
        targetSelectors: ['[data-tour="editor-ai-bar"]'],
        preferredPlacement: 'bottom',
        padding: 6,
        actionGate: {
          triggerSelector: '[data-tour="editor-ai-policy-btn"]',
          buttonLabel: 'AI 隐私锁',
        },
      },
      {
        id: 'ai-phrasebank',
        moduleId: 'academic-ai',
        title: '学术写作句库悬浮胶囊（Alt+P / ⌥P）',
        description:
          '已为你呼出悬浮学术句库胶囊！你可以点击胶囊上的图标体验「智能辅助、章节导航、上下文分析、快速查词、段落骨架」等工具，点选句式即可直接插入光标处；桌面端还可拖拽悬浮条调整位置。',
        mobileTitle: '学术写作句库面板',
        mobileDescription:
          '已为你呼出学术写作句库！在手机与平板竖屏下，点击右下角悬浮按钮或底部快捷条即可随时打开，体验「智能辅助、章节导航、上下文分析、快速查词、段落骨架」等工具，并支持拖动顶部句柄调节面板高度。',
        scene: 'phrasebank-capsule',
        targetSelectors: ['[data-tour="phrasebank-capsule"]'],
        unionSelectors: ['[data-tour="phrasebank-capsule"]', '[data-tour="phrasebank-panel"]'],
        preferredPlacement: 'top',
        padding: 8,
      },
      {
        id: 'ai-paper-studio',
        moduleId: 'academic-ai',
        title: '一致性体检官 & Rebuttal 返修生成器',
        description:
          '已为你打开学术体检台（工具箱 → 体检与返修）：系统已自动扫描出示例论文里「94.2% 与 93.6% 口径不一致」以及「悬空图 3 引用」，支持一键修正；切换顶部标签即可体验「返修说明 Rebuttal 生成器」。',
        scene: 'paper-studio',
        targetSelectors: ['[data-tour="paper-studio-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        padding: 6,
      },
      {
        id: 'ai-context-assets',
        moduleId: 'academic-ai',
        title: '修改动机留痕 & 科研资产快照关联',
        description:
          '这里可将导师邮件、微信截图、审稿意见等「修改原因」以及 .svg / .csv / .bib 等科研资产哈希绑定到对应版本快照，半年后再回头看也能立刻明白当时为何这么改。',
        scene: 'context-assets',
        targetSelectors: ['[data-tour="context-assets-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        padding: 6,
      },
      {
        id: 'ai-evolution',
        moduleId: 'academic-ai',
        title: '写作热力图、进化延时回放与纪念海报',
        description:
          '在「进化工作室」中可查看近 14 天每日写作贡献格、深夜专注时段统计，点击顶部切换到「论文进化延时回放」播放成稿过程，或一键导出精美的 SVG 演进纪念海报！',
        scene: 'evolution-studio',
        targetSelectors: ['[data-tour="evolution-studio-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        padding: 6,
      },
    ],
  },
  {
    id: 'sync-security',
    title: '保险箱加密与跨端同步',
    shortTitle: '同步安全',
    badge: '多端互联',
    summary: '保险箱支持 AES-256-GCM 主密码与生物识别锁定；跨端同步支持局域网扫码、WebDAV 与 S3。',
    points: [
      '保险箱与生物识别：设置主密码后正文加密封存，支持指纹/面容解锁与 SHA-256 完整性校验。',
      '局域网直连（推荐）：扫码配对同一 Wi-Fi 内高速直传，零网盘流量、不触发限流。',
      'WebDAV / S3：内置坚果云等预设与配置口令导入，单队列限速 + 403/503 熔断 + 流量统计。',
    ],
    steps: [
      {
        id: 'sec-vault',
        moduleId: 'sync-security',
        title: '档案保险箱与 AES-256-GCM 加密锁',
        description:
          '已自动切换到「档案保险箱」空间并打开安全中心：在这里可设置主密码、绑定本机生物识别（指纹/面容），对私密协议一键执行 AES-256-GCM 加密上锁，并可随时核验已封存文档的 SHA-256 指纹是否被篡改。',
        scene: 'vault-lock',
        targetSelectors: ['[data-tour="vault-lock-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        padding: 6,
      },
      {
        id: 'sec-sync',
        moduleId: 'sync-security',
        title: '跨端加密同步（局域网扫码 / WebDAV / S3）',
        description:
          '所有离端数据包均先执行 AES-256-GCM 端到端加密。推荐同 Wi-Fi 下使用「局域网直连」扫码配对零流量互传；也可切换到「WebDAV / S3」绑定坚果云或 R2/OSS（内置单队列限速与 403/503 熔断保护），并在冲突标签下进行 HLC 三方合并。',
        scene: 'sync-modal',
        targetSelectors: ['[data-tour="sync-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        padding: 6,
      },
    ],
  },
  {
    id: 'themes-multidevice',
    title: '六套主题引擎、设置与文档导出',
    shortTitle: '主题导出',
    badge: '界面交付',
    summary: '提供六套动态与护眼主题，多端交互深度适配，并支持带原封面与修订红线的 Word 导出。',
    points: [
      '六大主题：浅色极简、深邃夜色、护眼纸感、M3 莫奈动态取色、天象光影、实时天气。',
      'AI 与多端设置：可配置云端/本地模型、导入 Markdown Skills，并在电脑端模拟手机/平板预览。',
      '无损导出：支持导出带原封面的交付版 Word、带修订红线的对比版 Word，以及 .md / .tex。',
    ],
    steps: [
      {
        id: 'theme-cards',
        moduleId: 'themes-multidevice',
        title: '六大主题引擎实时切换体验',
        description:
          '已为你打开设置中心的「外观与主题」页面！点击高亮区域里的任意主题卡片（浅色、深邃、纸感、M3 莫奈动态取色、天象光影、实时天气），整个软件界面都会实时焕然一新，选好后点「下一步」。',
        scene: 'settings-themes',
        targetSelectors: ['[data-tour="settings-themes-grid"]'],
        preferredPlacement: 'bottom',
        padding: 6,
      },
      {
        id: 'settings-ai-device',
        moduleId: 'themes-multidevice',
        title: 'AI 模型、Skills 技能包与多端适配设置',
        description:
          '设置中心已切换到「AI 与 Skills」页签：这里可以连接你的大模型接口或本地模型、开关与导入自定义 Markdown Skill；左侧导航还可进入「排版字体」「多端预览与触感反馈」（含桌面端模拟手机/平板视图）。',
        scene: 'settings-ai',
        targetSelectors: ['[data-tour="settings-modal"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        padding: 6,
      },
      {
        id: 'export-delivery',
        moduleId: 'themes-multidevice',
        title: '无损交付：带原封面与修订红线导出',
        description:
          '改稿定稿后，点击顶栏高亮的「导出」按钮（手机端在右上角「更多」菜单中），即可选择「导出 Word（原封面无损拼回）」「导出带修订红线对比版 .docx」，或直接导出纯文本 .md / .tex。',
        mobileDescription:
          '改稿定稿后，点击右上角「更多」菜单中的「导出」（平板横屏可直接点击顶栏「导出」），即可选择「导出 Word（原封面无损拼回）」「导出带修订红线对比版 .docx」，或直接导出纯文本 .md / .tex。',
        scene: 'export-topbar',
        targetSelectors: ['[data-tour="topbar-export-btn"]', '[data-tour="topbar-more-btn"]'],
        unionSelectors: [
          '[data-tour="topbar-export-btn"]',
          '[data-tour="topbar-export-menu"]',
          '[data-tour="topbar-more-btn"]',
        ],
        preferredPlacement: 'bottom',
        padding: 6,
      },
    ],
  },
  {
    id: 'format-matrix',
    title: '不同格式文件的支持能力差异',
    shortTitle: '格式支持',
    badge: '格式说明',
    summary: '不同格式在解析深度、双模编辑与无损导出上的支持程度不同，点击下方可逐一对照。',
    points: [
      '.docx：完整支持。剥离保留原封面 XML、提取批注修订，并支持带封面/红线导出。',
      '.doc（旧版二进制）：部分支持。可提取正文文本进入双模编辑，但无现代 OOXML 封面包结构。',
      '.md / .tex / .txt：完整支持。原生双向转换编辑、公式预览与纯文本/Word 导出。',
      '.pptx / .xlsx：部分支持。可解析幻灯片/多表结构进行只读结构化预览与摘要整理，不能回写原文件。',
      '.pdf / 其他二进制：仅内嵌预览或档案留存。PDF 支持对照审阅与批注，不能直接修改 PDF 排版。',
    ],
    steps: [
      {
        id: 'fmt-office-live',
        moduleId: 'format-matrix',
        title: '真实界面对照：不同文件格式的能力边界',
        description:
          '已为你切到「办公文档」空间的真实 PPTX 示例并开启双栏预览：左侧记录结构化摘要与笔记，右侧只读预览幻灯片结构。各格式支持差异如下：',
        bullets: [
          '.docx / .md / .tex：完整读写。支持双模互转、无损封面拼回与修订红线导出。',
          '.doc（旧版）：可提取正文进入双模编辑，但不保留旧版二进制封面结构。',
          '.pptx / .xlsx：可解析幻灯片备注与多表数据作结构化只读预览及摘要，不能回写原文件。',
          '.pdf / 其他：右侧内嵌阅读 PDF + 左侧记批注摘录，不支持直接改动 PDF 原文排版。',
        ],
        scene: 'format-office',
        targetSelectors: ['[data-tour="workspace-main"]'],
        preferredPlacement: 'bottom',
        phoneForceBottom: true,
        padding: 4,
      },
    ],
  },
  {
    id: 'limitations',
    title: '当前版本不能做到的事（能力边界）',
    shortTitle: '能力边界',
    badge: '必读说明',
    summary: '提前了解工具边界，避免在关键交付前走弯路；随时可从工具箱或设置中重播任意板块教程。',
    points: [
      '不支持直接编辑 PDF、PPTX、XLSX 或旧版 .doc 的原始排版并原格式写回。',
      '不支持多人同时在线协同光标编辑（采用单人离线优先 + HLC 冲突三方合并）。',
      '软件不自带免费云盘容量，也无法绕过第三方网盘（如坚果云免费版 1GB/月）的限流与配额。',
      '浏览器 Web 预览版受沙盒限制，无法直接监听桌面本地目录或开启原生局域网接收端口。',
    ],
    steps: [
      {
        id: 'lim-boundaries',
        moduleId: 'limitations',
        title: '重要边界清单与随时重播入口',
        description:
          '在正式开始创作前，请知悉以下四项软件当前无法直接做到的能力边界：',
        bullets: [
          '无法直接编辑 PDF / PPTX / XLSX / 旧版 .doc 的原始排版并写回原二进制格式。',
          '不支持多人同时在线协同光标编辑（采用单人本地优先 + HLC 冲突三方合并）。',
          '不自带免费云盘空间，也无法突破坚果云等第三方网盘的 1GB/月 等流量配额。',
          'Web 预览版受浏览器沙盒限制，桌面目录监听与原生局域网直连端口需在桌面/移动端运行。',
          '日后如需回顾任何功能，可随时点击顶栏「工具箱 → 使用教程」或「设置 → 关于」自选板块重播！',
        ],
        scene: 'limitations-overview',
        targetSelectors: [],
        preferredPlacement: 'auto',
      },
    ],
  },
];

export function hasCompletedOnboarding(storage?: StorageLike | null): boolean {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return false;
    const raw = target.getItem(TUTORIAL_COMPLETED_STORAGE_KEY);
    if (!raw) return false;
    if (raw === '1' || raw === 'true') return true;
    const parsed = JSON.parse(raw) as { completed?: boolean } | null;
    return Boolean(parsed?.completed);
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(storage?: StorageLike | null): void {
  try {
    const target =
      storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    if (!target) return;
    target.setItem(
      TUTORIAL_COMPLETED_STORAGE_KEY,
      JSON.stringify({ completed: true, completedAt: new Date().toISOString() }),
    );
  } catch {
    // Ignore storage quota errors in restricted WebViews
  }
}

export function buildTutorialFlow(
  mode: TutorialMode,
  selectedModuleIds?: TutorialModuleId[],
): TutorialStep[] {
  let modules: TutorialModuleDef[];
  if (mode === 'replay' && selectedModuleIds && selectedModuleIds.length > 0) {
    const selectedSet = new Set(selectedModuleIds);
    modules = TUTORIAL_MODULES.filter((m) => selectedSet.has(m.id));
  } else {
    modules = [...TUTORIAL_MODULES];
  }

  const steps: TutorialStep[] = [];
  for (const mod of modules) {
    mod.steps.forEach((step, idx) => {
      steps.push({
        kind: 'step',
        module: mod,
        step,
        stepIndexInModule: idx,
        moduleStepCount: mod.steps.length,
      });
    });
  }

  if (mode === 'first-run') {
    steps.push({ kind: 'cache-setup' });
    steps.push({ kind: 'warning' });
  }

  return steps;
}

export function getStepAdvanceRelation(
  steps: TutorialStep[],
  stepIndex: number,
): TutorialAdvanceRelation {
  const cur = steps[stepIndex];
  const next = steps[stepIndex + 1];
  if (!next) return 'finish';
  if (next.kind === 'cache-setup') return 'cache-setup';
  if (next.kind === 'warning') return 'warning';
  if (cur?.kind === 'step' && next.kind === 'step' && cur.module.id !== next.module.id) {
    return 'next-module';
  }
  return 'next-step';
}

export function resolveTutorialStepCopy(
  step: TutorialSpotlightStep,
  isMobile: boolean,
): { title: string; description: string; bullets?: string[] } {
  if (!isMobile) {
    return {
      title: step.title,
      description: step.description,
      bullets: step.bullets,
    };
  }
  return {
    title: step.mobileTitle ?? step.title,
    description: step.mobileDescription ?? step.description,
    bullets: step.mobileBullets ?? step.bullets,
  };
}

export function formatActionGateButtonText(
  buttonLabel: string,
  relation: TutorialAdvanceRelation,
): string {
  switch (relation) {
    case 'next-module':
      return `点击「${buttonLabel}」按钮进入下一板块`;
    case 'cache-setup':
      return `点击「${buttonLabel}」按钮设置缓存目录`;
    case 'warning':
      return `点击「${buttonLabel}」按钮进入必读警告`;
    case 'finish':
      return `点击「${buttonLabel}」按钮完成教程`;
    case 'next-step':
    default:
      return `点击「${buttonLabel}」按钮进入下一步`;
  }
}

export function computeGuideCardPlacement(params: {
  containerWidth: number;
  containerHeight: number;
  cutout: SpotlightRect | null;
  cardWidth: number;
  cardHeight: number;
  preferredPlacement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  forcePlacement?: 'bottom';
  margin?: number;
  topMargin?: number;
  gap?: number;
}): {
  top: number;
  left: number;
  placement: 'center' | 'top' | 'bottom' | 'left' | 'right';
  maxHeight?: number;
} {
  const {
    containerWidth,
    containerHeight,
    cutout,
    cardWidth,
    cardHeight,
    preferredPlacement = 'auto',
    forcePlacement,
    margin = 12,
    topMargin,
    gap = 12,
  } = params;

  const effectiveTopMargin = topMargin ?? margin;
  const maxLeft = Math.max(margin, containerWidth - cardWidth - margin);
  const maxTop = Math.max(effectiveTopMargin, containerHeight - cardHeight - margin);
  const clampLeft = (v: number) => Math.max(margin, Math.min(maxLeft, Math.round(v)));
  const clampTop = (v: number) => Math.max(effectiveTopMargin, Math.min(maxTop, Math.round(v)));

  if (forcePlacement === 'bottom') {
    const centerLeft = cutout
      ? cutout.left + cutout.width / 2 - cardWidth / 2
      : (containerWidth - cardWidth) / 2;
    return {
      top: clampTop(containerHeight - cardHeight - margin),
      left: clampLeft(centerLeft),
      placement: 'bottom',
    };
  }

  if (!cutout) {
    return {
      top: clampTop((containerHeight - cardHeight) / 2),
      left: clampLeft((containerWidth - cardWidth) / 2),
      placement: 'center',
    };
  }

  const cutRight = cutout.left + cutout.width;
  const cutBottom = cutout.top + cutout.height;

  const spaceTop = cutout.top - effectiveTopMargin;
  const spaceBottom = containerHeight - cutBottom - margin;
  const spaceLeft = cutout.left - margin;
  const spaceRight = containerWidth - cutRight - margin;

  const fits: Record<'top' | 'bottom' | 'left' | 'right', boolean> = {
    top: spaceTop >= cardHeight + gap,
    bottom: spaceBottom >= cardHeight + gap,
    left: spaceLeft >= cardWidth + gap,
    right: spaceRight >= cardWidth + gap,
  };

  const candidates: Array<'bottom' | 'top' | 'right' | 'left'> = ['bottom', 'top', 'right', 'left'];
  let chosen: 'top' | 'bottom' | 'left' | 'right' | null = null;

  if (preferredPlacement !== 'auto' && fits[preferredPlacement]) {
    chosen = preferredPlacement;
  } else {
    chosen =
      candidates.find((c) => fits[c]) ??
      candidates.slice().sort((a, b) => {
        const spaceMap = { top: spaceTop, bottom: spaceBottom, left: spaceLeft, right: spaceRight };
        return spaceMap[b] - spaceMap[a];
      })[0];
  }

  if (chosen === 'bottom') {
    const rawTop = fits.bottom ? cutBottom + gap : containerHeight - cardHeight - margin;
    return {
      top: clampTop(rawTop),
      left: clampLeft(cutout.left + cutout.width / 2 - cardWidth / 2),
      placement: 'bottom',
    };
  }
  if (chosen === 'top') {
    const availableTop = cutout.top - effectiveTopMargin - gap;
    const rawTop = fits.top ? cutout.top - cardHeight - gap : effectiveTopMargin;
    const clampedTop = Math.max(
      effectiveTopMargin,
      Math.min(
        Math.max(effectiveTopMargin, cutout.top - cardHeight - gap),
        clampTop(rawTop),
      ),
    );
    return {
      top: clampedTop,
      left: clampLeft(cutout.left + cutout.width / 2 - cardWidth / 2),
      placement: 'top',
      // Always cap maxHeight to availableTop when placed above a cutout so ResizeObserver
      // measuring the constrained card never drops maxHeight and causes it to re-expand over the cutout.
      maxHeight: availableTop > 0 ? Math.max(96, availableTop) : undefined,
    };
  }
  if (chosen === 'right') {
    const rawLeft = fits.right ? cutRight + gap : containerWidth - cardWidth - margin;
    return {
      top: clampTop(cutout.top + cutout.height / 2 - cardHeight / 2),
      left: clampLeft(rawLeft),
      placement: 'right',
    };
  }
  const rawLeft = fits.left ? cutout.left - cardWidth - gap : margin;
  return {
    top: clampTop(cutout.top + cutout.height / 2 - cardHeight / 2),
    left: clampLeft(rawLeft),
    placement: 'left',
  };
}

export function canProceedFromCacheSetup(
  choice: 'default' | 'custom' | null,
  customPath: string,
): boolean {
  if (choice === 'default') return true;
  if (choice === 'custom') return customPath.trim().length > 0;
  return false;
}

export function canUnlockWarningInput(remainingSeconds: number): boolean {
  return remainingSeconds <= 0;
}

export function canConfirmWarning(
  remainingSeconds: number,
  inputValue: string,
): boolean {
  return (
    canUnlockWarningInput(remainingSeconds) &&
    inputValue.trim() === TUTORIAL_CONFIRM_PHRASE
  );
}
