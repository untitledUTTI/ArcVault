# ArcVault · 穹档 Mobile (Flutter Edition)

面向 **Android（手机 + 平板）** 与 **iOS / iPadOS** 的纯 Dart / Flutter 移动端，界面与核心功能 1:1 复刻桌面端，并针对移动端进行了沉浸式状态栏、触控滚动手柄、手势批注抽屉与全新 **液态玻璃（Liquid Glass）** 主题适配。

## 核心亮点

- **沉浸式状态栏（Edge-to-Edge，非隐藏）**：状态栏始终可见，主题底色或液态玻璃流动渐变背景无缝延伸至状态栏与底部导航手势条后方，状态栏图标与文字明暗随当前主题实时自适应。
- **移动端五套主题引擎**（弃用桌面端天象光影与实时天气）：
  1. 浅色极简 (`light`)
  2. 深邃夜色 (`dark`)
  3. 护眼纸感 (`paper`)
  4. Material 3 Expressive (`m3-expressive`，完整 10 种莫奈风格 + 壁纸取色)
  5. **液态玻璃 (`liquid-glass`)**：基于开源项目 [`whynotmake-it/flutter_liquid_glass`](https://github.com/whynotmake-it/flutter_liquid_glass) (`liquid_glass_renderer`)，支持浅/深模式、4 套流光渐变底景、自定义壁纸、3 个一键预设与 6 项光学参数实时调节，并提供**仅在设置-外观与主题页下方显示的液态玻璃预览底栏开关**。
- **克制式组件适配**：真液态玻璃仅用于悬浮浮层（顶栏、底部快捷学术条、吸边句库胶囊、设置预览底栏、弹窗/Sheet/抽屉、Toast）；长文编辑区、Diff 与预览区保持高可读性柔和底衬。
- **协议与桌面端 100% 兼容**：PBKDF2-HMAC-SHA256 (`120000` 次) + AES-256-GCM 信封、CAS 去重快照、Word `.docx` 无损封面剥离与回写、HLC + E2EE 局域网扫码 / WebDAV / S3 同步。

## 运行与构建

```bash
cd mobile_flutter
flutter pub get
flutter test
flutter run          # Android / iOS 真机或模拟器
flutter build apk --release
```
