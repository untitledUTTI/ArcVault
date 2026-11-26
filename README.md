# ArcVault · 穹档

**ArcVault · 穹档** 是一款 **Local-First（本地优先）、端到端加密（E2EE）** 的跨平台个人数字档案库与学术论文演进工作台，基于 **Tauri 2 + React 19 + TypeScript + Rust** 构建。

## 核心特性

- **四大独立空间 & 永久回收站**：划分为「论文工作区、办公文档、写作笔记、档案保险箱」四大空间；内置回收站永久保留不自动清理，支持全文检索与一键还原。
- **Word (`.docx`) 无损封面剥离与平行批注**：导入 `.docx` 时自动识别并封存原封面 XML，正文可在 Markdown / LaTeX 双模间实时转换编辑，导出时原封不动拼回原封面并支持修订红线对比；批注与修订卡片通过 Arc-Link 曲线与正文双向对齐。
- **版本穹顶与 A/B 平行分支**：基于内容寻址（CAS）的哈希去重快照，配合底部穹顶弧形时间轴、逐行 Diff、废稿墓地（Deleted Darlings）与跨版本全文考古。
- **学术科研套件 & 三档 AI 隐私锁**：支持「云端/本地可用、仅本地 Ollama、完全禁用 AI」三级策略；内置学术句库悬浮胶囊（`Alt+P`）、一致性体检官、Rebuttal 返修生成器、修改动机留痕与进化延时回放。
- **保险箱加密与多端 E2EE 同步**：保险箱支持 AES-256-GCM 主密码与生物识别解锁；支持局域网扫码直连、WebDAV 与 S3 增量加密同步及 HLC 三方冲突合并。
- **六套主题引擎 & 多端适配**：浅色极简、深邃夜色、护眼纸感、M3 Expressive（莫奈动态取色）、天象光影（WebGL2 Shader）与实时天气。

## 技术栈

- **前端**：React 19, TypeScript, Vite, CodeMirror 6, KaTeX, JSZip, `@xmldom/xmldom`, Material Color Utilities, Lucide React
- **原生宿主**：Tauri v2, Rust (`tokio`, `serde`, `rusqlite`, `blake3`, `reqwest`, `notify`, `chrono`, `uuid`)
- **测试**：Vitest

## 快速开始

### 环境要求

- Node.js `>= 20`
- Rust 工具链（构建桌面/移动端 Tauri 应用时需要，详见 [跨端编译指南](docs/CROSS_PLATFORM_BUILD.md)）

### 安装与运行

```bash
# 安装依赖
npm install

# 启动 Web 开发预览
npm run dev

# 运行单元测试
npm test

# 类型检查与前端生产构建
npm run build

# 启动 Tauri 桌面端开发环境
npm run tauri dev

# 构建 Tauri 原生安装包
npm run tauri build
```

## 文档

- [产品设计与跨端架构方案](docs/ARCHITECTURE.md)
- [六端编译与部署指南](docs/CROSS_PLATFORM_BUILD.md)

## 开源许可

本项目基于 [MIT License](LICENSE) 开源。软件中使用的第三方开源项目致谢与许可清单可在应用内「设置 → 关于穹档」中查看。
