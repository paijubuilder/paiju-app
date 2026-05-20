# 悬浮窗原生代码备存目录

本目录存放悬浮窗功能的 **Android 原生参考代码**，随源码包一并导出。

## 目录结构

```
src/floating_window/
├── README.md                          本说明文档
├── vendor_specific_config.json        各品牌悬浮窗权限路径配置
├── android/
│   ├── FloatingWindowService.kt       Android 悬浮窗服务（WindowManager实现）
│   ├── FloatingWindowManager.kt       悬浮窗生命周期管理类
│   ├── FloatingWindowUI.kt            悬浮窗 View 构建与交互
│   └── PermissionHelper.kt            权限检测与各品牌跳转适配
└── ios_note.md                        iOS 替代方案说明
```

## 集成说明

### 在 Expo Bare Workflow 中使用
1. 运行 `npx expo eject` 转换为 bare workflow
2. 将 `android/` 目录下文件复制至 `android/app/src/main/java/com/miaoda/appbjaapbe7wkqp/`
3. 在 `AndroidManifest.xml` 中添加权限声明（见下方）
4. 在 `MainApplication.kt` 中注册 `FloatingWindowService`

### AndroidManifest.xml 权限声明
```xml
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />

<service
    android:name=".FloatingWindowService"
    android:enabled="true"
    android:exported="false"
    android:foregroundServiceType="specialUse" />
```

### 配置独立性
- 悬浮窗开关状态读取自 `app_dynamic_config` 表的 `floating_window_enabled` 字段
- 不依赖秒哒平台专有 API，导出后可在标准 Android Studio 中独立编译

## 平台说明

| 平台 | 实现方式 | 备注 |
|------|---------|------|
| Android | WindowManager + SYSTEM_ALERT_WINDOW | 完整实现，见 android/ 目录 |
| iOS | 本地通知栏替代 | 系统限制，见 ios_note.md |
| 鸿蒙NEXT | WindowStage + TYPE_FLOAT | 需在 module.json5 声明 CREATE_FLOATING_WINDOW |
