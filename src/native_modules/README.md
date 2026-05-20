# src/native_modules — 原生功能代码骨架说明

本目录包含所有需要原生 Android 环境才能运行的功能的完整代码骨架，  
随秒哒源码包一并导出，下载后在 **Android Studio** 中可直接编译。

---

## 目录结构

```
src/native_modules/
├── README.md                              本说明文档
├── SettingsRepository.kt                 开关状态读取工具（SharedPreferences + 远程同步）
├── AndroidManifest_additions.xml         权限声明 + 组件注册（合并到项目 Manifest）
├── android/
│   ├── FloatingWindowService.kt          悬浮窗服务（WindowManager + 拖拽 + 菜单）
│   ├── GameDetectAccessibilityService.kt 无障碍服务（前台包名监听）
│   ├── AccessibilityHelper.kt            无障碍服务状态检测 + 跳转工具
│   ├── AccessibilityGuideActivity.kt     无障碍服务引导页（含状态实时刷新）
│   ├── ForegroundService.kt              前台服务（通知栏常驻 + 进程保活）
│   ├── BootReceiver.kt                   开机自启广播接收器
│   ├── DeviceRiskDetector.kt             设备环境风险检测（Root/Xposed/VPN/开发者选项）
│   └── OverlayPermissionActivity.kt      悬浮窗权限引导页（含状态实时刷新）
└── res/
    ├── xml/
    │   └── accessibility_service_config.xml   无障碍服务配置
    └── layout/
        └── floating_layout.xml               悬浮窗 View 布局（含使用说明注释）
```

---

## 功能开关对照表

| 开关键名 | 默认值 | 对应文件 | 说明 |
|---------|--------|---------|------|
| `enable_floating_window` | 关 | FloatingWindowService.kt + OverlayPermissionActivity.kt | 需 SYSTEM_ALERT_WINDOW 权限 |
| `enable_accessibility_detect` | 关 | GameDetectAccessibilityService.kt + AccessibilityHelper.kt | 需用户在系统设置授权 |
| `enable_foreground_service` | 关 | ForegroundService.kt | 需 FOREGROUND_SERVICE 权限 |
| `enable_boot_start` | 关 | BootReceiver.kt | 需 RECEIVE_BOOT_COMPLETED 权限 |
| `enable_risk_detection` | 关 | DeviceRiskDetector.kt | 纯代码检测，无需额外权限 |

开关状态存储在 `system_switches` 数据库表，由 `SettingsRepository` 读取。

---

## 快速集成步骤（5步）

### 步骤 ① 复制 Kotlin 源文件
将 `android/*.kt` 复制到原生项目的 Java/Kotlin 源码目录：
```
android/app/src/main/java/com/你的包名/native_modules/
```
同时将 `SettingsRepository.kt` 复制到相同目录。

### 步骤 ② 合并 AndroidManifest
将 `AndroidManifest_additions.xml` 中的内容合并到：
```
android/app/src/main/AndroidManifest.xml
```
- `<uses-permission>` 标签放在 `<manifest>` 根元素下
- `<service>` / `<receiver>` / `<activity>` 标签放在 `<application>` 元素内

### 步骤 ③ 复制资源文件
```bash
# 无障碍服务配置
cp res/xml/accessibility_service_config.xml android/app/src/main/res/xml/

# 悬浮窗布局
cp res/layout/floating_layout.xml android/app/src/main/res/layout/
```

### 步骤 ④ 配置 SettingsRepository 远程同步
编辑 `SettingsRepository.kt`，填入 Supabase 项目地址和 anon key：
```kotlin
val supabaseUrl = "https://YOUR_PROJECT_ID.supabase.co"
val supabaseKey = "YOUR_ANON_KEY"
```
推荐通过 `BuildConfig` 或 `local.properties` 管理，避免硬编码到代码中。

### 步骤 ⑤ 初始化（在 Application.onCreate 中）
```kotlin
class MyApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // 异步同步远程开关 → 本地 SharedPreferences
        SettingsRepository.syncFromRemote(this)

        // 根据开关值启动对应服务
        if (SettingsRepository.isEnabled(this, "enable_foreground_service")) {
            val intent = Intent(this, ForegroundService::class.java)
                .setAction(ForegroundService.ACTION_START)
            startForegroundService(intent)  // Android 8+
        }
        if (SettingsRepository.isEnabled(this, "enable_floating_window") &&
            Settings.canDrawOverlays(this)) {
            startService(Intent(this, FloatingWindowService::class.java)
                .setAction(FloatingWindowService.ACTION_SHOW))
        }
    }
}
```

---

## 填充业务逻辑（TODO 清单）

每个文件都包含 `// TODO:` 注释，指明需要填充的业务逻辑位置：

| 文件 | TODO 位置 | 要做什么 |
|------|-----------|---------|
| `GameDetectAccessibilityService.kt` | `TARGET_GAME_PACKAGES` 常量 | 填入目标游戏包名列表 |
| `GameDetectAccessibilityService.kt` | `onGameEnvironmentChanged()` | 实现进/退游戏时的悬浮窗控制 |
| `FloatingWindowService.kt` | `showFloatingMenu()` | 实现菜单项「检测环境」「查看报告」的点击逻辑 |
| `FloatingWindowService.kt` | `buildFloatingView()` | 替换为 `floating_layout.xml` 的 LayoutInflater |
| `ForegroundService.kt` | `onStartCommand()` | 添加子服务启动逻辑 |
| `BootReceiver.kt` | `startServicesOnBoot()` | 调整开机启动的服务组合 |
| `SettingsRepository.kt` | `syncFromRemote()` | 替换为正式的网络请求框架（Retrofit/Ktor）|

---

## 与 src/floating_window/ 的关系

`src/floating_window/` 目录（Phase 7 早期创建）包含更早版本的悬浮窗骨架。  
本目录 `src/native_modules/` 是**完整版本**，内容更丰富，且包含：
- 5 大功能模块全覆盖（悬浮窗 + 无障碍 + 前台服务 + 开机自启 + 风险检测）
- SettingsRepository 统一开关读取
- 完整的 AndroidManifest 声明
- 品牌适配引导页

**建议以本目录为准，`src/floating_window/` 的 Kotlin 文件可作为补充参考。**

---

## 秒哒平台兼容性

| 功能 | 秒哒平台 | 原生 Android |
|------|---------|-------------|
| 悬浮窗 | ❌ 不支持 | ✅ 完整可用 |
| 无障碍服务 | ❌ 不支持 | ✅ 需授权 |
| 前台服务 | ❌ 不支持 | ✅ 完整可用 |
| 开机自启 | ❌ 不支持 | ✅ 需授权（部分品牌）|
| 风险检测 | ⚠️ 仅基础项 | ✅ 完整五项检测 |
| 开关后台管理 | ✅ 完整可用 | ✅ 完整可用 |
