package com.miaoda.appbjaapbe7wkqp.native_modules

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * BootReceiver — 开机自启广播接收器
 * ────────────────────────────────────────────────────────────────
 * 对应开关：enable_boot_start（system_switches 表）
 *
 * 工作原理：
 * 监听 android.intent.action.BOOT_COMPLETED 广播，
 * 设备重启后自动根据开关状态启动 ForegroundService 或 FloatingWindowService。
 *
 * 集成步骤（导出后操作）：
 * 1. 在 AndroidManifest.xml 中声明权限和接收器：
 *    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />
 *    <receiver android:name=".native_modules.BootReceiver"
 *              android:enabled="true"
 *              android:exported="true">
 *        <intent-filter>
 *            <action android:name="android.intent.action.BOOT_COMPLETED" />
 *            <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
 *        </intent-filter>
 *    </receiver>
 *
 * 注意：
 * - Android 10+ 限制后台启动 Activity，但允许启动前台服务（需声明 FOREGROUND_SERVICE 权限）
 * - MIUI/EMUI 等系统需用户额外在手机管家中授予「开机自启」权限
 * ────────────────────────────────────────────────────────────────
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        Log.d(TAG, "onReceive: $action")

        if (action != Intent.ACTION_BOOT_COMPLETED &&
            action != Intent.ACTION_MY_PACKAGE_REPLACED) return

        // 检查 enable_boot_start 开关
        if (!SettingsRepository.isEnabled(context, "enable_boot_start")) {
            Log.d(TAG, "开机自启开关已关闭，跳过启动")
            return
        }

        Log.i(TAG, "开机自启: 根据开关配置启动服务")
        startServicesOnBoot(context)
    }

    // ── 启动逻辑 ──────────────────────────────────────────

    /**
     * 根据各功能开关决定启动哪些服务。
     * 仅当对应开关为 true 时才启动，遵守「最小权限」原则。
     */
    private fun startServicesOnBoot(context: Context) {
        // 1. 前台服务保活（优先启动，为悬浮窗等提供宿主进程）
        if (SettingsRepository.isEnabled(context, "enable_foreground_service")) {
            startService(context, ForegroundService::class.java, ForegroundService.ACTION_START)
        }

        // 2. 悬浮窗（依赖 SYSTEM_ALERT_WINDOW 权限，需额外检查）
        if (SettingsRepository.isEnabled(context, "enable_floating_window")) {
            // TODO: 检查 Settings.canDrawOverlays(context) 后再启动
            // if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            //     Settings.canDrawOverlays(context)) {
            startService(context, FloatingWindowService::class.java, FloatingWindowService.ACTION_SHOW)
            // }
        }

        // TODO: 如需开机时做一次环境检测，在此调用 DeviceRiskDetector.generateRiskReport()
    }

    /** 启动指定 Service 的工具方法（兼容 Android 8+ 前台服务要求） */
    private fun <T : android.app.Service> startService(
        context: Context,
        serviceClass: Class<T>,
        action: String? = null,
    ) {
        try {
            val intent = Intent(context, serviceClass).apply {
                action?.let { this.action = it }
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
            Log.d(TAG, "已启动服务: ${serviceClass.simpleName}")
        } catch (e: Exception) {
            Log.e(TAG, "启动服务失败 ${serviceClass.simpleName}: ${e.message}", e)
        }
    }
}
