# ArcVault · 穹档 六端编译与部署指南（Phase 4）

> 目标平台：**Windows** · **macOS** · **iPadOS** · **iOS** · **Android（手机 + 平板）**

## 1. 环境准备

- **Node.js** `>= 20` + `npm install`
- **Rust Toolchain** (`rustup`)
- **Tauri CLI v2** (`npm run tauri`)

### 各平台附加工具链
- **Windows**：Visual Studio C++ Build Tools + WebView2 Runtime
- **macOS / iOS / iPadOS**：Xcode 15+（需在 macOS 主机编译）+ CocoaPods + Apple 开发者签名证书
  ```bash
  rustup target add aarch64-apple-darwin x86_64-apple-darwin aarch64-apple-ios aarch64-apple-ios-sim
  ```
- **Android（手机 + 平板）**：Android Studio + SDK (API 26–35) + NDK + `JAVA_HOME`
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi x86_64-linux-android
  ```

---

## 2. 一键初始化与构建命令

### Windows / macOS 桌面端
```bash
npm run dev              # 前端快速开发预览（支持设置页「模拟预览设备」直接体验手机/平板）
npm run tauri dev        # 启动桌面端 Tauri 窗口
npm run tauri build      # 生成 Windows (.msi / .exe) 或 macOS (.app / .dmg)
```

### Android（手机 + 平板通用 APK / AAB）
```bash
npm run tauri android init
npm run tauri android dev
npm run tauri android build -- --apk
```
> 建议在 `src-tauri/gen/android/app/src/main/AndroidManifest.xml` 中保留相机权限（`CAMERA`）以供拍照扫描入库，以及局域网权限（`INTERNET` / `ACCESS_WIFI_STATE`）供扫码直连同步。

### iOS / iPadOS（Universal App）
```bash
npm run tauri ios init
npm run tauri ios dev
npm run tauri ios build
```
> 在 Xcode Signing & Capabilities 中配置 Team ID，并在 `Info.plist` 添加：
> - `NSCameraUsageDescription`：用于拍照扫描纸质资料并增强归档
> - `NSFaceIDUsageDescription`：用于生物识别解锁私密档案保险箱
> - `NSLocalNetworkUsageDescription`：用于局域网扫码直连同步

---

## 3. 桌面端测试手机与平板适配（无需真机）
在 Windows / macOS 启动应用（或 `npm run dev`）后，打开 **设置 → 多端与触控 → 模拟预览设备**，即可一键切换：
- **手机竖屏 (390×844)**：左侧抽屉、底部键盘快捷学术条、点正文高亮弹出半屏批注卡片、吸边句库浮钮。
- **平板竖屏 (820×1120)**：紧凑抽屉 + 半屏批注 Sheet + 触控放大手柄。
- **平板横屏 (1180×800)**：展开近桌面多栏 + Arc-Link 光学连线 + 加宽触控分隔条。
