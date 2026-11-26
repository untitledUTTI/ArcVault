# ArcVault · 穹档 — 产品设计与跨端架构方案

> **"Arc（穹）" 寓意穹顶庇护、环天顶弧光与跨越版本的连续弧线。**
> ArcVault · 穹档是一款 **Local-First（本地优先）、端到端加密（E2EE）** 的跨平台个人数字档案库与学术写作工作台，覆盖 **Windows / macOS / Web** 与 **Android（手机 + 平板）/ iOS / iPadOS** 六端场景。

---

## 一、 产品定位、四大空间与永久回收站

采用 **「通用档案底座 + 场景专属工作区」** 架构：

| 空间类型 | 适用资料 | 专属核心能力 |
| :--- | :--- | :--- |
| **论文工作区（`sp_paper`）** | `.docx`、`.tex`、`.md`、`.bib`、实验图表/数据/脚本 | 智能去封面提取 MD/LaTeX、批注修订平行卡片 + Arc-Link 光学连线、Zotero/EndNote 引文域保护、关联资产联动快照、A/B 思路分支、Rebuttal 返修草稿、一致性体检、写作热力图与进化回放 |
| **办公与文档空间（`sp_office`）** | PDF、PPTX、XLSX、Word | 自动版本时间轴、PPTX/XLSX 内置结构化预览与内容摘要、关联资料打包、规范命名一键交付 |
| **写作与知识空间（`sp_writing`）** | Markdown、LaTeX、TXT | 大纲导航、跨版本段落/句子 Diff、片段考古全文检索、废稿墓地（Deleted Darlings） |
| **私密档案保险箱（`sp_vault`）** | 合同、协议、证件扫描件、未发表核心稿件 | 独立主密码 / 生物识别解锁、只读封存锁定、SHA-256 完整性校验、强制本地/禁用云端 AI |

### 内置永久回收站与自定义目录体系
- **内置永久回收站**：从任意工作区移入回收站的文档永久保留、绝不因时间过期而自动清理；已封存锁定或保险箱未解锁的文档受保护拦截，还原时完整保留版本快照、分支与批注。
- **自定义缓存与备份目录**：支持在首次引导及设置页中随时指定/迁移本地 CAS 对象库缓存目录与自动定时备份目录（桌面端依托 Tauri FS/Dialog，移动端依托 `path_provider` / `file_picker` 与 `WorkspaceStorage`）。

---

## 二、 双轨跨端技术选型与互通协议

仓库采用 **「桌面端 Tauri v2 + 移动端独立 Flutter 原生工程」** 双轨架构，在保持两端最佳原生性能与交互体验的同时，共享 100% 互通的本地存储与加密同步协议：

1. **桌面端 & Web 端（`src/` + `src-tauri/`）**：
   - **前端工作台（`src/`）**：React 19 + TypeScript + Vite 6 + CodeMirror 6 + KaTeX + 自研纯前端 OOXML 引擎（`jszip` + `@xmldom/xmldom`）+ WebGL2 GLSL Shader 引擎。
   - **原生宿主（`src-tauri/`）**：Tauri v2 + Rust（`rusqlite`、CAS、`blake3`、`notify` 文件防抖监听、`reqwest`、局域网服务与原生窗口控制）。
2. **移动端原生端（`mobile_flutter/`）**：
   - **Flutter 3.29+ / Dart 3.5+ 原生工程**：面向 Android（手机 + 平板）与 iOS / iPadOS，彻底规避移动 WebView 下的键盘遮挡、滚动冲突与光学模糊性能瓶颈。
   - **纯 Dart 核心引擎（`mobile_flutter/lib/core/`）**：`ooxml_engine.dart`、`office_parser.dart`、`cas_store.dart`、`diff_engine.dart`、`academic_engines.dart`、`vault_crypto.dart`、`sync_engine.dart`、`monet_engine.dart`、`workspace_storage.dart`、`tutorial_flow.dart`。
3. **跨端 100% 兼容协议**：
   - **加密信封**：PBKDF2-HMAC-SHA256（`120000` 次迭代）密钥派生 + AES-256-GCM 认证加密（桌面端 `vault.ts` / `sync.ts` 与移动端 `vault_crypto.dart` / `sync_engine.dart` 密文互通）。
   - **CAS 去重对象库**：基于内容哈希去重存储，未改动内容零冗余写入；大段删除（≥ 50 字）自动沉淀到废稿墓地。
   - **增量同步模型**：混合逻辑时钟（HLC）`sync_oplog` + 并发三方冲突合并。

---

## 三、 核心机制设计

### 1. Word (`.docx`) ↔ Markdown / LaTeX 双向流转与封面剥离
1. **智能识别 + 可视化微调**：
   - 自动检测封面结束位置（Cover Page SDT / 分页符 / 首个 `Heading1` / `"摘要"` / `"Abstract"`）。
   - 支持打开「Word 智能封面识别与切分微调」弹窗，用户可点选任意段落指定「▼ 正文从此开始」，勾选记住规则；底部三键支持「不剥离（全部导入）」「取消」「确认切分并提取正文」。
   - 原始封面 XML 与媒体资源无损留存；导出 `.docx` 时原封不动拼回原封面，并支持生成带修订红线对比的 `.docx`。
2. **复杂元素保真**：
   - OMML 公式 ↔ LaTeX（`$...$` / `$$...$$`）双向转换、嵌入式图片/表格保留、Zotero / EndNote 引文域（`w:fldChar` / `w:instrText`）注入 `citationsSidecar` 保护并在回写时原样还原。

### 2. 批注 & 修订平行卡片、Arc-Link 连线与统一撤销重做
- **保留原文**：Word 批注（`comments.xml`）与修订（`w:ins` / `w:del`）在提取正文时保留原文，结构化信息进入批注侧栏 / 抽屉。
- **多端形态自适应**：
  - 桌面端与平板横屏：右侧平行批注栏按正文锚点对齐，并绘制发光 Bezier **Arc-Link** 光学连线。
  - 手机与平板竖屏：点击高亮锚点或顶栏/底栏「批注」呼出半屏手势抽屉，支持左右滑动切卡、接受/拒绝修订、标记解决、回复与 AI 改写建议。
- **统一撤销重做（`CommandHistory`）**：同步维护正文与批注锚点偏移量，编辑与修订操作均可连续撤销/重做。

### 3. 学术科研套件、三档 AI 隐私锁与句库胶囊
- **三档文档级隐私锁**：`云端或本地` / `仅本地 Ollama` / `完全禁用 AI`（保险箱空间强制禁止云端 AI）。
- **科研辅助工具链**：学术句库悬浮胶囊（内置 8 大写作板块、智能推荐、中英互插与占位替换）、跨章节数值/引用一致性体检官、Rebuttal 审稿回复生成器、修改动机与科研资产关联、近 14 天写作热力图与版本进化延时回放、内置及可导入的 Markdown Skills。

### 4. 实景聚光灯交互式引导教程架构
桌面端（`src/core/tutorial.ts` + `src/components/TutorialOverlay.tsx`）与移动端（`mobile_flutter/lib/core/tutorial_flow.dart` + `mobile_flutter/lib/widgets/modals/tutorial_overlay.dart`）采用统一的**实景聚光灯引导模型**：
1. **真实界面调度**：按步骤自动切换到对应工作空间、展开抽屉/批注抽屉/时间轴，或打开真实弹窗（桌面端通过 `applyTutorialScene`，移动端通过 `WorkspaceShell` 内联弹窗层确保弹窗位于教程遮罩层之下）。
2. **四片式黑色遮罩与防误触**：实时测量目标组件边界（桌面端基于 `getBoundingClientRect` + ResizeObserver/MutationObserver；移动端基于 `GlobalKey` + `RenderBox`），在目标高亮框四周铺设 4 块半透明黑色遮罩拦截外部交互，浮层指引卡通过 `computeGuideCardPlacement` 自动避让高亮区域与安全区（移动端另提供一键「半透明 / 恢复」按钮便于透视底部内容）。
3. **体验按钮门禁（Action-Gate）**：需用户亲自操作的步骤会将「下一步」按钮置灰并提示 `点击「xxx」按钮进入下一步 / 进入下一板块`；用户点击真实高亮按钮执行功能后自动推进至下一步。
4. **首启与重播分离**：
   - **首次启动**：`欢迎页（选主题/语言）` →（Android 端显示可忽略的权限申请页）→ `8 大板块 25+ 步实景交互引导` → `首次必选缓存目录配置` → **`10 秒倒计时 +「我已了解」末尾必读安全与消费警告`**（不可跳过）。
   - **自选重播**：从「工具箱 / 更多菜单 / 设置」打开板块选择器，支持多选或单节体验，无末尾缓存配置与警告门禁。

### 5. 跨端 E2EE 同步协议
- **局域网高速直连**：同一 Wi-Fi 下通过配对 URI + 二维码扫码配对互传，零流量消耗。
- **WebDAV / S3 加密兜底**：支持坚果云、Alist、Nextcloud 与 Cloudflare R2 / OSS；离端前全部执行 AES-256-GCM 加密，具备单队列限速与 403/503 熔断保护。

### 6. 双轨视觉与触控系统
- **桌面端（6 套主题）**：`light`、`dark`、`paper`、`m3-expressive`（莫奈动态取色）、`celestial-optics`（WebGL2 天象光影）、`weather-live`（实时天气）。
- **移动端（5 套主题）**：`light`、`dark`、`paper`、`m3-expressive` 与基于 `liquid_glass_renderer` 的 **`liquid-glass`（液态玻璃）**；遵循「克制式液态玻璃」原则（仅悬浮导航、底部快捷条、悬浮胶囊、弹窗与设置预览底栏启用折射，长文编辑与阅读区保持高对比柔和底衬），并集成 Edge-to-Edge 沉浸状态栏与右侧可定制造型 `TouchScrollScrubber` 触控滚动手柄。

---

## 四、 演进里程碑状态

| 阶段 | 核心目标 | 状态 |
| :--- | :--- | :--- |
| **Phase 1：核心底座闭环** | CAS 去重存储、四大空间与永久回收站、Word 去封面双向转换与批注修订平行卡片、Arc-Link 连线、统一 Undo/Redo、带封面/红线导出、穹顶弧形时间轴/Diff/废稿墓地 | **已完成** |
| **Phase 2：AI 网关与学术套件** | 云端/Ollama 三档隐私锁、学术句库悬浮胶囊、一致性体检官、Rebuttal 返修生成器、A/B 分支、写作热力图与进化回放、修改动机与科研资产关联、Markdown Skills | **已完成** |
| **Phase 3：视觉引擎与保险箱深化** | 桌面端 WebGL2「天象光影 / 实时天气」、M3 Expressive 莫奈引擎、AES-256-GCM 保险箱与生物识别、Office (`.pptx`/`.xlsx`) 结构化预览 | **已完成** |
| **Phase 4：跨端同步与移动端 Flutter 重构** | E2EE 局域网扫码 / WebDAV / S3 同步与 HLC 冲突合并；移动端独立 Flutter 工程（Edge-to-Edge 沉浸状态栏、液态玻璃引擎、系统分享入库、实景聚光灯互动教程） | **已完成** |
| **后续持续打磨** | iOS 真机真签名流水线完善、更多科研格式导入导出适配、大文档千级节点虚拟化性能优化 | 持续演进中 |
