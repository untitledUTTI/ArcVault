# ArcVault · 穹档 六端编译与部署指南

> 目标平台：**Windows** · **macOS** · **Web 预览** · **Android（手机 + 平板）** · **iOS / iPadOS**

---

## 1. 平台与工程对应关系

| 目标平台 | 推荐工程目录 | 技术栈 | 说明 |
| :--- | :--- | :--- | :--- |
| **Windows / macOS 桌面端** | 根目录 + `src-tauri/` | Tauri v2 + React 19 + Rust | 原生窗口、文件监听、本地目录与打包 |
| **Web 开发与多端视口预览** | 根目录 `src/` | Vite 6 + React 19 + TypeScript | 快速联调，支持设置页模拟手机/平板布局 |
| **Android（手机 + 平板） / iOS / iPadOS** | [`mobile_flutter/`](../mobile_flutter/README.md) | Flutter (`>= 3.29.0`) + Pure Dart | **移动端推荐主力方案**（液态玻璃、原生性能与沉浸状态栏） |
| Tauri Mobile（备用参考） | `src-tauri/` | Tauri v2 Android / iOS | 保留备用宿主配置，日常移动端构建请使用 `mobile_flutter/` |

---

## 2. 桌面端（Windows / macOS）与 Web 构建

### 环境要求
- **Node.js** `>= 20`（执行 `npm install`）
- **Rust 工具链**（`rustup`）与 **Tauri CLI v2**
- **Windows 附加依赖**：Visual Studio C++ Build Tools + WebView2 Runtime
- **macOS 附加依赖**：Xcode 15+（Command Line Tools）

### 常用命令
```bash
# 安装前端依赖
npm install

# 启动 Web 开发预览
npm run dev

# 运行 Vitest 单元测试
npm test

# TypeScript 类型检查与前端生产构建
npm run build

# 启动 Tauri 桌面端开发环境
npm run tauri dev

# 构建 Windows (.msi / .exe) 或 macOS (.app / .dmg) 安装包
npm run tauri build
```

### 在桌面端模拟手机与平板布局（无需真机）
启动桌面应用或 `npm run dev` 后，打开 **设置 → 多端与触控 → 模拟预览设备**，可一键切换：
- **手机竖屏 (`390×844`)**：左侧抽屉、底部键盘快捷学术条、半屏批注抽屉、吸边句库浮钮。
- **平板竖屏 (`820×1120`)**：紧凑抽屉 + 半屏批注 Sheet + 触控放大手柄。
- **平板横屏 (`1180×800`)**：展开多栏工作区 + Arc-Link 光学连线 + 加宽触控分隔条。

---

## 3. 移动端独立 Flutter 工程（Android & iOS/iPadOS · 推荐）

移动端工程位于 [`mobile_flutter/`](../mobile_flutter/README.md)，应用包名为 `com.arcvault.mobile`。

### 环境要求
- **Flutter SDK** `>= 3.29.0`（Dart SDK `>= 3.5.0 < 4.0.0`）
- **Android 构建环境**：
  - JDK 17（`android/app/build.gradle.kts` 使用 `JavaVersion.VERSION_17`）
  - Android Studio + Android SDK（`minSdk = 26`）+ NDK
  - 若使用本地 SDK 路径，可在 `mobile_flutter/android/local.properties` 中配置 `flutter.sdk` 与 `sdk.dir`（该文件已加入 `.gitignore`，切勿提交）
- **iOS / iPadOS 构建环境**（需在 macOS 主机运行）：
  - Xcode 15+ + CocoaPods

### 常用开发、校验与打包命令
```bash
cd mobile_flutter

# 获取 Flutter 依赖
flutter pub get

# 静态代码检查
flutter analyze

# 运行全部 Dart 单元测试
flutter test

# 连接真机或模拟器运行（Debug）
flutter run

# 构建 Android Release APK
flutter build apk --release

# 按 ABI 分包构建更小体积 APK
flutter build apk --split-per-abi

# 构建 Google Play App Bundle
flutter build appbundle --release

# 构建 iOS / iPadOS 发布包（需在 macOS 上执行）
flutter build ipa --release
```

### Android 关键构建与运行时说明
- **Gradle 与 Kotlin 构建参数**（[`mobile_flutter/android/gradle.properties`](../mobile_flutter/android/gradle.properties)）：
  - 默认配置 `org.gradle.jvmargs=-Xmx4G` 保障 Gradle 编译内存充足。
  - 已设置 `android.useAndroidX=true`、`android.newDsl=false`、`android.builtInKotlin=false`、`kotlin.incremental=false` 以稳定兼容现有 Flutter 插件与 AGP 构建链。
- **Release 签名**：[`mobile_flutter/android/app/build.gradle.kts`](../mobile_flutter/android/app/build.gradle.kts) 默认在 `release` 下使用 `debug` 签名方便本地验证测试；正式上架分发前，请在 `mobile_flutter/android/key.properties` 配置正式 keystore（已在 `.gitignore` 中忽略 `key.properties`、`*.keystore`、`*.jks`）并切换为正式 `signingConfig`。
- **Impeller 与液态玻璃渲染**：[`AndroidManifest.xml`](../mobile_flutter/android/app/src/main/AndroidManifest.xml) 已启用 `io.flutter.embedding.android.EnableImpeller=true`，确保 `liquid_glass_renderer` 真实折射着色器正常绘制（低端设备可在设置页开启兼容降级模式）。
- **沉浸式状态栏与系统分享入库**：应用启动时启用 `SystemUiMode.edgeToEdge`，状态栏始终保持可见并与主题/液态玻璃背景融合；`AndroidManifest.xml` 已注册 `android.intent.action.SEND`（`text/plain` 与 `*/*`）以接收系统分享内容直接入库。
- **Android 权限声明**：包含存储读写、`CAMERA`（纸质稿扫描与扫码配对）、`INTERNET` / `ACCESS_WIFI_STATE` / `NEARBY_WIFI_DEVICES`（局域网同步）、`USE_BIOMETRIC`（保险箱生物识别）与 `VIBRATE`（触感反馈）；首次启动时会在欢迎页后引导逐项授权（可选择忽略并二次确认）。

### iOS / iPadOS 权限配置（`mobile_flutter/ios/Runner/Info.plist`）
确保包含以下隐私用途说明：
- `NSCameraUsageDescription`：用于纸质稿拍照扫描入库与局域网同步扫码配对
- `NSFaceIDUsageDescription`：用于面容 ID 解锁私密档案保险箱
- `NSLocalNetworkUsageDescription`：用于同一 Wi-Fi 下局域网高速直连同步
- `NSPhotoLibraryUsageDescription`：用于选择壁纸或图片提取莫奈取色/导入扫描件

---

## 4. 备用路径：Tauri v2 Mobile (`src-tauri/`)

如需调试基于 Tauri Rust 宿主的移动端原型，可执行以下命令（需安装对应 `rustup target`）：

```bash
# Android（aarch64-linux-android / armv7-linux-androideabi / x86_64-linux-android）
npm run tauri android init
npm run tauri android dev
npm run tauri android build -- --apk

# iOS / iPadOS（仅 macOS，aarch64-apple-darwin / aarch64-apple-ios / aarch64-apple-ios-sim）
npm run tauri ios init
npm run tauri ios dev
npm run tauri ios build
```
