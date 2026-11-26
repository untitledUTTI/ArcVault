# ArcVault · 穹档

**ArcVault · 穹档** 是一款 **Local-First（本地优先）、端到端加密（E2EE）** 的跨平台个人数字档案库与学术论文演进工作台，覆盖 **Windows / macOS / Web** 与 **Android（手机 + 平板）/ iOS / iPadOS**：

- **桌面端 & Web 预览**（根目录 `src/` + `src-tauri/`）：基于 **Tauri v2 + React 19 + TypeScript + Rust** 构建。
- **移动端原生端**（[`mobile_flutter/`](mobile_flutter/README.md)）：基于 **Flutter + 纯 Dart 引擎** 独立构建，数据格式与加密协议和桌面端 100% 互通。

## 核心特性

- **四大独立空间 & 内置永久回收站**：划分为「论文工作区、办公文档、写作笔记、档案保险箱」四大空间；内置回收站项目永久保留不自动清理，支持全文检索、只读预览与一键还原至原空间（完整保留版本历史、分支与批注）。
- **Word (`.docx`) 无损封面剥离与平行批注**：导入 `.docx` 时自动识别并封存原封面 XML，支持在切分界面手动微调正文起点；正文可在 Markdown / LaTeX 双模间实时转换编辑，导出时原封不动拼回原封面并支持修订红线对比；批注与修订卡片在桌面端/平板横屏通过 Arc-Link 曲线与正文双向对齐，手机端自动适配为可滑动手势半屏抽屉。
- **版本穹顶与 A/B 平行分支**：基于内容寻址（CAS）的哈希去重快照，配合穹顶弧形时间轴、逐行 Diff、废稿墓地（Deleted Darlings，自动捕获删改片段）与跨版本全文考古检索。
- **学术科研套件 & 三档 AI 隐私锁**：支持「云端或本地 / 仅本地 Ollama / 完全禁用 AI」三级策略；内置学术句库悬浮胶囊（桌面端 `Alt+P` / 移动端可吸边拖拽）、一致性体检官、Rebuttal 返修生成器、修改动机留痕、写作热力图与进化延时回放，并支持自定义 Markdown Skills。
- **保险箱加密与多端 E2EE 同步**：保险箱支持 PBKDF2-HMAC-SHA256 + AES-256-GCM 主密码与本机生物识别（指纹 / 面容）解锁及 SHA-256 只读封存校验；支持局域网扫码直连、WebDAV 与 S3 增量加密同步及 HLC 三方冲突合并。
- **自定义缓存与自动备份目录**：支持在首次引导及「设置 → 归档与目录」中随时指定和迁移本地 CAS 缓存目录与自动备份目录。
- **双轨主题引擎与移动端液态玻璃**：
  - **桌面端六套主题**：浅色极简、深邃夜色、护眼纸感、Material 3 Expressive（莫奈动态取色）、天象光影（WebGL2 GLSL Shader）、实时天气。
  - **移动端五套主题**：浅色极简、深邃夜色、护眼纸感、Material 3 Expressive（10 种莫奈风格 + 壁纸取色）与全新 **液态玻璃（Liquid Glass）**（基于 `liquid_glass_renderer`，支持 Edge-to-Edge 沉浸状态栏、光学参数滑块调节与 `TouchScrollScrubber` 触控滚动手柄）。
- **实景聚光灯互动教程**：桌面端与移动端流程对齐，直接在真实软件界面上以半透明黑色遮罩高亮目标控件引导操作，支持体验按钮（Action-Gate）点击后自动推进、自选板块重播、首次启动自定义缓存目录配置与末尾 10 秒必读安全提示。

## 仓库结构

```text
ArcVault/
├── src/                  # 桌面端 & Web 前端（React 19 + TypeScript + CodeMirror 6 + KaTeX + WebGL2）
├── src-tauri/            # Tauri v2 Rust 原生宿主（CAS / SQLite / Notify / Sync / 移动端备用宿主）
├── mobile_flutter/       # 移动端独立 Flutter 工程（Android 手机/平板 + iOS / iPadOS）
└── docs/                 # 架构设计文档与六端编译部署指南
```

## 技术栈

- **桌面端前端**：React 19, TypeScript, Vite 6, CodeMirror 6, KaTeX, JSZip, `@xmldom/xmldom`, Material Color Utilities, Lucide React, Vitest
- **桌面端原生宿主**：Tauri v2, Rust (`tokio`, `serde`, `rusqlite`, `blake3`, `reqwest`, `notify`, `chrono`, `uuid`)
- **移动端原生工程 (`mobile_flutter/`)**：Flutter (`>= 3.29.0`), Dart (`>= 3.5.0`), `liquid_glass_renderer`, `material_color_utilities`, `flutter_markdown`, `flutter_math_fork`, `archive`, `xml`, `diff_match_patch`, `cryptography`, `crypto`, `http`, `qr_flutter`, `mobile_scanner`, `local_auth`, `permission_handler`, `file_picker`, `image_picker`, `share_plus`

## 快速开始

### 桌面端 & Web（`Node.js >= 20`）

```bash
# 安装依赖
npm install

# 启动 Web 开发预览（可在「设置 → 多端与触控」模拟手机/平板视口）
npm run dev

# 运行前端单元测试
npm test

# TypeScript 类型检查与前端生产构建
npm run build

# 启动 Tauri 桌面端开发环境（需 Rust 工具链）
npm run tauri dev

# 构建 Tauri 原生安装包
npm run tauri build
```

### 移动端 Flutter（`Flutter >= 3.29.0`）

```bash
cd mobile_flutter

# 获取依赖
flutter pub get

# 静态分析与单元测试
flutter analyze
flutter test

# 连接真机或模拟器运行
flutter run

# 构建 Android Release APK
flutter build apk --release
```

## 文档

- [产品设计与跨端架构方案](docs/ARCHITECTURE.md)
- [六端编译与部署指南](docs/CROSS_PLATFORM_BUILD.md)
- [移动端 Flutter 工程说明](mobile_flutter/README.md)

## 开源许可

本项目基于 [MIT License](LICENSE) 开源。软件中使用的第三方开源项目致谢与许可清单可在应用内「设置 → 关于穹档」中查看。
