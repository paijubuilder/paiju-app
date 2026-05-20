package com.miaoda.appbjaapbe7wkqp.floatingwindow

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.NotificationCompat

/**
 * FloatingWindowService — Android 悬浮窗后台服务
 *
 * 使用 WindowManager + SYSTEM_ALERT_WINDOW 实现悬浮窗效果。
 * 本服务以前台服务运行，确保在游戏/其他App切换时悬浮窗持续可见。
 *
 * ⚠️ iOS 端说明：iOS 系统对悬浮窗有严格限制，无法实现跨 App 悬浮窗。
 *    iOS 端改为使用本地通知栏（UNUserNotificationCenter）作为替代方案。
 *    相关代码见 ios_note.md。
 *
 * ⚠️ 鸿蒙NEXT端说明：需在 module.json5 中声明
 *    "ohos.permission.CREATE_FLOATING_WINDOW" 权限，
 *    通过 WindowStage.createSubWindow() + WindowType.TYPE_FLOAT 实现。
 *
 * 配置来源：app_dynamic_config 表 floating_window_* 字段
 * 不依赖秒哒平台专有库，可在标准 Android Studio 中独立编译。
 */
class FloatingWindowService : Service() {

    companion object {
        private const val TAG = "FloatingWindowService"
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "floating_window_channel"
        const val ACTION_START = "ACTION_START_FLOATING_WINDOW"
        const val ACTION_STOP = "ACTION_STOP_FLOATING_WINDOW"
        const val ACTION_UPDATE_STATUS = "ACTION_UPDATE_STATUS"
        const val EXTRA_STATUS = "extra_status"
        const val EXTRA_GUARD_PHASE = "extra_guard_phase"
    }

    private var floatingWindowManager: FloatingWindowManager? = null

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "FloatingWindowService 创建")
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> {
                Log.d(TAG, "启动悬浮窗")
                startForeground(NOTIFICATION_ID, buildNotification("护航中"))
                floatingWindowManager = FloatingWindowManager(applicationContext)
                floatingWindowManager?.show()
            }
            ACTION_STOP -> {
                Log.d(TAG, "停止悬浮窗")
                floatingWindowManager?.hide()
                floatingWindowManager = null
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
            }
            ACTION_UPDATE_STATUS -> {
                val status = intent.getStringExtra(EXTRA_STATUS) ?: return START_STICKY
                val phase = intent.getStringExtra(EXTRA_GUARD_PHASE) ?: "idle"
                Log.d(TAG, "更新状态: $status, phase: $phase")
                floatingWindowManager?.updateStatus(status, phase)
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        floatingWindowManager?.hide()
        floatingWindowManager = null
        Log.d(TAG, "FloatingWindowService 销毁")
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "悬浮窗服务",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "牌局环境守护悬浮窗常驻服务"
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(status: String): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("🛡 牌局环境守护")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build()
    }
}
