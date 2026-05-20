package com.miaoda.appbjaapbe7wkqp.floatingwindow

import android.content.Context
import android.graphics.PixelFormat
import android.os.Build
import android.util.Log
import android.view.Gravity
import android.view.View
import android.view.WindowManager

/**
 * FloatingWindowManager — 悬浮窗生命周期管理
 *
 * 负责：
 * - 向 WindowManager 添加/移除悬浮窗 View
 * - 读取 floating_window_* 配置（位置、尺寸、样式）
 * - 管理悬浮窗显示/隐藏/更新状态
 *
 * 配置键对应关系（来自 app_dynamic_config）：
 *   floating_window_position → layoutParams.gravity
 *   floating_window_size     → layoutParams.width/height
 *   floating_window_style    → FloatingWindowUI 样式参数
 *   floating_window_auto_hide → 闲置自动隐藏定时器
 */
class FloatingWindowManager(private val context: Context) {

    companion object {
        private const val TAG = "FloatingWindowManager"
    }

    private var windowManager: WindowManager? = null
    private var floatingView: View? = null
    private var isShowing = false

    fun show() {
        if (isShowing) {
            Log.w(TAG, "悬浮窗已显示，跳过重复创建")
            return
        }
        try {
            windowManager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager

            // 读取配置（实际使用时从 SharedPreferences 或 app_dynamic_config 读取）
            val config = loadConfig()

            // 构建悬浮窗 View
            val ui = FloatingWindowUI(context)
            floatingView = ui.build(config)

            // 构建 WindowManager.LayoutParams
            val params = buildLayoutParams(config)

            // 添加触摸拖动支持
            ui.attachDragListener(floatingView!!, params, windowManager!!)

            windowManager!!.addView(floatingView, params)
            isShowing = true
            Log.d(TAG, "悬浮窗显示成功，位置: ${config.position}，尺寸: ${config.sizeDp}dp")
        } catch (e: Exception) {
            Log.e(TAG, "悬浮窗显示失败: ${e.message}", e)
        }
    }

    fun hide() {
        if (!isShowing) return
        try {
            floatingView?.let { windowManager?.removeView(it) }
            floatingView = null
            isShowing = false
            Log.d(TAG, "悬浮窗已隐藏")
        } catch (e: Exception) {
            Log.e(TAG, "悬浮窗隐藏失败: ${e.message}", e)
        }
    }

    fun updateStatus(status: String, phase: String) {
        floatingView?.let { view ->
            // 通过 tag 或子 View 更新状态文字
            val ui = view.tag as? FloatingWindowUI ?: return
            ui.updateStatus(view, status, phase)
            Log.d(TAG, "悬浮窗状态更新: $status ($phase)")
        }
    }

    private fun loadConfig(): FloatConfig {
        // TODO：实际项目中通过 Supabase / SharedPreferences 读取
        // 此处使用默认值，对应 app_dynamic_config 中的默认配置
        return FloatConfig(
            enabled = true,
            style = "circle",
            position = "right_middle",
            sizeDp = 56,
            autoHide = false,
            permissionCheck = true,
        )
    }

    private fun buildLayoutParams(config: FloatConfig): WindowManager.LayoutParams {
        val density = context.resources.displayMetrics.density
        val sizePx = (config.sizeDp * density).toInt()

        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val gravity = when (config.position) {
            "left_top"      -> Gravity.START or Gravity.TOP
            "right_top"     -> Gravity.END or Gravity.TOP
            "left_bottom"   -> Gravity.START or Gravity.BOTTOM
            "right_bottom"  -> Gravity.END or Gravity.BOTTOM
            "right_middle"  -> Gravity.END or Gravity.CENTER_VERTICAL
            else            -> Gravity.END or Gravity.CENTER_VERTICAL
        }

        return WindowManager.LayoutParams(
            sizePx, sizePx, type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            this.gravity = gravity
            x = 16
            y = 0
        }
    }
}

/** 悬浮窗配置数据类，对应 app_dynamic_config 中 floating_window_* 字段 */
data class FloatConfig(
    val enabled: Boolean,
    val style: String,          // circle / square / custom
    val position: String,       // right_middle / left_top / right_top / left_bottom / right_bottom
    val sizeDp: Int,            // 32~120
    val autoHide: Boolean,
    val permissionCheck: Boolean,
)
