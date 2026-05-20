package com.miaoda.appbjaapbe7wkqp.native_modules

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.content.Intent
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * GameDetectAccessibilityService — 游戏前台检测无障碍服务
 * ────────────────────────────────────────────────────────────────
 * 对应开关：enable_accessibility_detect（system_switches 表）
 *
 * 工作原理：
 * 监听 TYPE_WINDOW_STATE_CHANGED 事件，当前台 App 包名切换时触发。
 * 与预设的游戏包名列表比对，若匹配则显示悬浮窗或触发护航逻辑。
 *
 * 集成步骤（导出后操作）：
 * 1. 在 AndroidManifest.xml 中声明：
 *    <service android:name=".native_modules.GameDetectAccessibilityService"
 *             android:permission="android.permission.BIND_ACCESSIBILITY_SERVICE">
 *        <intent-filter>
 *            <action android:name="android.accessibilityservice.AccessibilityService" />
 *        </intent-filter>
 *        <meta-data android:name="android.accessibilityservice"
 *                   android:resource="@xml/accessibility_service_config" />
 *    </service>
 * 2. 调用 AccessibilityHelper.isAccessibilityServiceEnabled() 检查是否已授权
 * 3. 未授权时调用 AccessibilityHelper.openAccessibilitySettings() 引导用户开启
 * ────────────────────────────────────────────────────────────────
 */
class GameDetectAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "GameDetectAS"

        /**
         * 预设游戏包名列表（后续在原生 App 中填充真实包名）
         * TODO: 将常用棋牌/麻将游戏的包名添加到此列表
         */
        private val TARGET_GAME_PACKAGES = setOf(
            "com.example.mj.game",        // TODO: 替换为真实麻将游戏包名
            "com.example.poker.game",     // TODO: 替换为真实棋牌游戏包名
            // 添加更多包名…
        )

        /** 当前检测到的前台包名（供外部读取） */
        var currentForegroundPackage: String = ""
            private set

        /** 是否正处于游戏环境 */
        var isInGameEnvironment: Boolean = false
            private set
    }

    // ── 生命周期 ──────────────────────────────────────────

    override fun onServiceConnected() {
        super.onServiceConnected()
        Log.d(TAG, "onServiceConnected: 无障碍服务已连接")
        configureService()
    }

    override fun onUnbind(intent: Intent?): Boolean {
        Log.d(TAG, "onUnbind: 无障碍服务断开连接")
        return super.onUnbind(intent)
    }

    override fun onInterrupt() {
        Log.w(TAG, "onInterrupt: 无障碍服务中断")
    }

    // ── 核心事件处理 ──────────────────────────────────────

    override fun onAccessibilityEvent(event: AccessibilityEvent) {
        if (event.eventType == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            val packageName = event.packageName?.toString() ?: return

            // 忽略系统 UI 和本 App 自身
            if (packageName == applicationContext.packageName ||
                packageName == "com.android.systemui") return

            currentForegroundPackage = packageName
            Log.v(TAG, "前台切换: $packageName")

            // TODO: 在这里将 packageName 与你预设的游戏包名列表进行匹配
            // 如果匹配成功，发送广播或调用悬浮窗显示
            val isGame = isTargetGame(packageName)
            if (isGame != isInGameEnvironment) {
                isInGameEnvironment = isGame
                onGameEnvironmentChanged(packageName, isGame)
            }
        }
    }

    // ── 检测逻辑 ──────────────────────────────────────────

    /**
     * 判断包名是否属于目标游戏。
     * TODO: 如需模糊匹配（如包名包含 "mahjong"），在此调整判断逻辑。
     */
    private fun isTargetGame(packageName: String): Boolean {
        return TARGET_GAME_PACKAGES.contains(packageName)
        // TODO: 如需从远程动态获取包名列表，替换为读取本地配置文件的逻辑
    }

    /**
     * 游戏环境变化回调（进入/退出游戏）。
     * TODO: 在这里实现进入游戏时显示悬浮窗、退出时隐藏悬浮窗的逻辑。
     */
    private fun onGameEnvironmentChanged(packageName: String, entered: Boolean) {
        Log.i(TAG, "${if (entered) "进入" else "退出"}游戏: $packageName")

        if (entered) {
            // TODO: 发送广播通知 FloatingWindowService 显示悬浮窗
            // sendBroadcast(Intent(FloatingWindowService.ACTION_SHOW))

            // TODO: 或直接启动悬浮窗服务
            // val intent = Intent(this, FloatingWindowService::class.java)
            //     .setAction(FloatingWindowService.ACTION_SHOW)
            // startService(intent)
        } else {
            // TODO: 通知悬浮窗服务隐藏
            // sendBroadcast(Intent(FloatingWindowService.ACTION_HIDE))
        }
    }

    // ── 服务配置 ──────────────────────────────────────────

    /**
     * 动态配置服务监听范围（补充 XML 配置的不足）。
     * 目前监听所有应用，TODO: 可限制为 TARGET_GAME_PACKAGES 以降低资源消耗。
     */
    private fun configureService() {
        serviceInfo = AccessibilityServiceInfo().apply {
            eventTypes = AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 100
            // TODO: 若只监听特定应用，添加 packageNames = TARGET_GAME_PACKAGES.toTypedArray()
        }
    }
}
