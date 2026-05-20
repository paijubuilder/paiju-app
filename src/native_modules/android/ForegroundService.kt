package com.miaoda.appbjaapbe7wkqp.native_modules

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log

/**
 * ForegroundService — 前台服务保活
 * ────────────────────────────────────────────────────────────────
 * 对应开关：enable_foreground_service（system_switches 表）
 *
 * 功能：
 * 在通知栏显示常驻通知「牌局环境守护正在运行」，防止系统回收进程。
 * 可选地启动 FloatingWindowService 和 GameDetectAccessibilityService。
 *
 * 集成步骤（导出后操作）：
 * 1. 在 AndroidManifest.xml 中声明权限和服务：
 *    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
 *    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />  <!-- API 33+ -->
 *    <service android:name=".native_modules.ForegroundService"
 *             android:foregroundServiceType="specialUse" />
 * 2. 在 SettingsRepository 检查 enable_foreground_service = true 后启动本服务
 * ────────────────────────────────────────────────────────────────
 */
class ForegroundService : Service() {

    companion object {
        private const val TAG               = "ForegroundService"
        private const val NOTIFICATION_ID   = 1002
        private const val CHANNEL_ID        = "guard_foreground_channel"
        private const val CHANNEL_NAME      = "牌局守护服务"
        const val ACTION_START = "ACTION_FG_START"
        const val ACTION_STOP  = "ACTION_FG_STOP"
    }

    // ── 生命周期 ──────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate: 前台服务创建")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return when (intent?.action) {
            ACTION_STOP -> {
                Log.d(TAG, "onStartCommand: 停止前台服务")
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                START_NOT_STICKY
            }
            else -> {
                Log.d(TAG, "onStartCommand: 启动前台服务")
                startForeground(NOTIFICATION_ID, buildNotification())
                // TODO: 在这里根据其他开关状态，启动 FloatingWindowService 或其他服务
                // if (SettingsRepository.isEnabled(applicationContext, "enable_floating_window")) {
                //     startService(Intent(this, FloatingWindowService::class.java))
                // }
                START_STICKY
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Log.d(TAG, "onDestroy: 前台服务销毁")
        // TODO: 在这里停止所有子服务
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── 通知构建 ──────────────────────────────────────────

    /**
     * 创建通知渠道（Android 8.0 / API 26+ 必须）。
     * 渠道重要性设为 LOW，避免发出声音打扰用户。
     */
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "牌局环境守护服务，保持后台运行"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    /**
     * 构建前台通知。
     * 点击通知可打开 MainActivity（TODO: 替换为实际主页 Activity）。
     */
    private fun buildNotification(): Notification {
        // TODO: 替换 MainActivity::class.java 为项目实际的主 Activity
        val openAppIntent = PendingIntent.getActivity(
            this, 0,
            packageManager.getLaunchIntentForPackage(packageName),
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(this, CHANNEL_ID)
                .setContentTitle("🛡 牌局环境守护")
                .setContentText("正在守护您的牌局安全")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(openAppIntent)
                .setOngoing(true)
                .build()
        } else {
            @Suppress("DEPRECATION")
            android.app.Notification.Builder(this)
                .setContentTitle("🛡 牌局环境守护")
                .setContentText("正在守护您的牌局安全")
                .setSmallIcon(android.R.drawable.ic_lock_lock)
                .setContentIntent(openAppIntent)
                .setOngoing(true)
                .build()
        }
    }
}
