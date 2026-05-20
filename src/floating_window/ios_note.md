# iOS 端悬浮窗替代方案说明

## 系统限制

iOS 系统对跨 App 悬浮窗（全局悬浮窗）有严格限制：
- **不允许**任何第三方 App 在其他 App 之上显示悬浮窗
- `UIWindow` 只能在本 App 的 UIWindowScene 内显示
- App 进入后台后，UI 完全不可见

因此，iOS 端**无法实现** Android 端 `SYSTEM_ALERT_WINDOW` 那样的跨 App 悬浮窗。

## iOS 替代方案

### 方案一：本地通知栏（已实现）
使用 `UNUserNotificationCenter` 发送实时通知，在通知栏展示护航状态。

```swift
// iOS 通知栏替代实现（已在 React Native / Expo 端通过 expo-notifications 实现）
import UserNotifications

func updateGuardStatus(phase: String, remainingTime: String) {
    let content = UNMutableNotificationContent()
    content.title = "🛡 牌局环境守护"
    content.body = "护航中 · 剩余 \(remainingTime)"
    content.sound = .none

    // 更新现有通知（使用固定 identifier 覆盖）
    let request = UNNotificationRequest(
        identifier: "guard_status",
        content: content,
        trigger: nil
    )
    UNUserNotificationCenter.current().add(request)
}
```

### 方案二：应用内悬浮窗（App 在前台时）
当用户在本 App 内时，可使用 `UIWindow` 级别的浮层实现应用内悬浮窗：

```swift
// 仅在 App 内有效，切换至其他 App 后不可见
let floatWindow = UIWindow(frame: CGRect(x: screenWidth - 70, y: screenHeight / 2, width: 56, height: 56))
floatWindow.windowLevel = .alert + 1
floatWindow.rootViewController = FloatingButtonVC()
floatWindow.isHidden = false
```

### 方案三：Today Widget（iOS 14+）
使用 WidgetKit 在锁屏/桌面展示护航状态（仅展示，无交互）。

## 功能对比

| 功能 | Android | iOS |
|------|---------|-----|
| 跨 App 悬浮窗 | ✅ 完整支持 | ❌ 不支持 |
| 应用内悬浮窗 | ✅ 支持 | ✅ UIWindow 实现 |
| 状态通知推送 | ✅ 通知栏 | ✅ UNUserNotificationCenter |
| 桌面 Widget | ✅ Android Widget | ✅ WidgetKit |

## 代码标注规范

在涉及悬浮窗的代码中，使用以下注释标记 iOS 端差异：

```typescript
// 🤖 ANDROID ONLY: 悬浮窗原生服务调用
// 📱 iOS FALLBACK: 改为使用通知栏（expo-notifications）
```
