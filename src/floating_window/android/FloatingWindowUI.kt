package com.miaoda.appbjaapbe7wkqp.floatingwindow

import android.content.Context
import android.graphics.Color
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import kotlin.math.abs

/**
 * FloatingWindowUI — 悬浮窗 View 构建与交互
 *
 * 功能：
 * - 构建圆形/方形悬浮窗 View
 * - 实现拖动支持（触摸事件处理）
 * - 状态颜色变化（空闲/检测中/护航中/已过期）
 * - 闲置自动半透明收起
 */
class FloatingWindowUI(private val context: Context) {

    companion object {
        private const val AUTO_HIDE_DELAY_MS = 5000L
        /** 护航阶段颜色映射 */
        private val PHASE_COLORS = mapOf(
            "idle"      to Color.parseColor("#4A5568"),
            "waiting"   to Color.parseColor("#2563EB"),
            "scanning"  to Color.parseColor("#F59E0B"),
            "guarding"  to Color.parseColor("#D4AF37"),
            "expired"   to Color.parseColor("#EF4444"),
        )
    }

    private var autoHideRunnable: Runnable? = null

    /**
     * 构建悬浮窗 View
     * @param config 来自 app_dynamic_config 的悬浮窗配置
     */
    fun build(config: FloatConfig): View {
        val density = context.resources.displayMetrics.density
        val sizePx = (config.sizeDp * density).toInt()

        val container = FrameLayout(context).apply {
            layoutParams = FrameLayout.LayoutParams(sizePx, sizePx)
            // 圆形：使用 clipToOutline（需 API 21+）
            if (config.style == "circle") {
                clipToOutline = true
            }
            setBackgroundColor(PHASE_COLORS["idle"] ?: Color.GRAY)
            alpha = 0.85f
            tag = this@FloatingWindowUI
        }

        // 护盾图标
        val icon = TextView(context).apply {
            text = "🛡"
            textSize = sizePx * 0.35f / density
            gravity = android.view.Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        container.addView(icon)

        return container
    }

    /**
     * 更新悬浮窗护航状态（颜色 + 文字）
     */
    fun updateStatus(view: View, status: String, phase: String) {
        val color = PHASE_COLORS[phase] ?: PHASE_COLORS["idle"]!!
        view.setBackgroundColor(color)
        view.alpha = 0.9f
        // 恢复可见度（如自动隐藏后有更新）
        cancelAutoHide(view)
    }

    /**
     * 附加拖动监听器（触摸拖动 + 单击展开）
     */
    fun attachDragListener(
        view: View,
        params: WindowManager.LayoutParams,
        wm: WindowManager,
    ) {
        var initialX = 0
        var initialY = 0
        var touchX = 0f
        var touchY = 0f
        var isDragging = false

        view.setOnTouchListener { _, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    initialX = params.x
                    initialY = params.y
                    touchX = event.rawX
                    touchY = event.rawY
                    isDragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - touchX
                    val dy = event.rawY - touchY
                    if (abs(dx) > 5 || abs(dy) > 5) {
                        isDragging = true
                        params.x = (initialX + dx).toInt()
                        params.y = (initialY + dy).toInt()
                        wm.updateViewLayout(view, params)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging) {
                        // 单击：展开详情（触发 onClick）
                        view.performClick()
                    }
                    true
                }
                else -> false
            }
        }
    }

    private fun cancelAutoHide(view: View) {
        autoHideRunnable?.let { view.removeCallbacks(it) }
        view.alpha = 0.9f
    }
}
