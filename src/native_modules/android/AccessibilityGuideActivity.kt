package com.miaoda.appbjaapbe7wkqp.native_modules

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*

/**
 * AccessibilityGuideActivity — 无障碍服务授权引导页
 * ────────────────────────────────────────────────────────────────
 * 功能：
 * 1. 显示「为什么需要无障碍权限」说明文字
 * 2. 提供「去开启」按钮，跳转到系统无障碍设置
 * 3. onResume 中实时检查服务是否已开启，若已开启则显示成功提示
 *
 * 集成步骤（导出后操作）：
 * 1. 在 AndroidManifest.xml 中声明此 Activity
 * 2. 调用入口：AccessibilityHelper.openAccessibilityGuide(context)
 * ────────────────────────────────────────────────────────────────
 */
class AccessibilityGuideActivity : Activity() {

    companion object {
        private const val TAG = "AccessGuide"
    }

    private lateinit var statusText: TextView
    private lateinit var btnEnable: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate")
        buildUI()
    }

    override fun onResume() {
        super.onResume()
        // 每次 onResume（包括从系统设置返回后）重新检查授权状态
        updatePermissionStatus()
    }

    // ── UI 构建 ───────────────────────────────────────────

    private fun buildUI() {
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER_HORIZONTAL
            setPadding(48, 80, 48, 48)
            setBackgroundColor(android.graphics.Color.parseColor("#0D0F12"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        // 图标
        root.addView(TextView(this).apply {
            text = "♿"
            textSize = 48f
            gravity = Gravity.CENTER
        })

        // 标题
        root.addView(TextView(this).apply {
            text = "开启无障碍服务"
            textSize = 22f
            setTextColor(android.graphics.Color.parseColor("#F0F4FF"))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 12)
        })

        // 说明文字
        root.addView(TextView(this).apply {
            text = buildString {
                appendLine("使用「游戏环境检测」功能需要开启无障碍服务。\n")
                appendLine("此服务用于：")
                appendLine("  • 检测当前前台应用是否为支持的棋牌/麻将游戏")
                appendLine("  • 在进入游戏时自动显示悬浮窗检测入口\n")
                appendLine("⚠️ 本应用不会收集您的输入内容或屏幕文字，")
                appendLine("   仅读取当前前台应用的包名信息。")
            }
            textSize = 13f
            setTextColor(android.graphics.Color.parseColor("#8899AA"))
            lineSpacingMultiplier = 1.5f
        })

        root.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(1, 32)
        })

        // 授权状态提示
        statusText = TextView(this).apply {
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }
        root.addView(statusText)

        // 「去开启」按钮
        btnEnable = Button(this).apply {
            text = "去开启无障碍服务"
            textSize = 15f
            setTextColor(android.graphics.Color.WHITE)
            setBackgroundColor(android.graphics.Color.parseColor("#2563EB"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, 16) }
            setOnClickListener { openAccessibilitySettings() }
        }
        root.addView(btnEnable)

        // 「返回」按钮
        root.addView(Button(this).apply {
            text = "返回"
            textSize = 14f
            setTextColor(android.graphics.Color.parseColor("#667080"))
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            setOnClickListener { finish() }
        })

        setContentView(root)
    }

    // ── 权限检查 ──────────────────────────────────────────

    /** 更新 UI 中的授权状态提示 */
    private fun updatePermissionStatus() {
        val granted = AccessibilityHelper.isAccessibilityServiceEnabled(this)
        if (granted) {
            statusText.text = "✅ 无障碍服务已开启"
            statusText.setTextColor(android.graphics.Color.parseColor("#29C470"))
            btnEnable.text = "已开启（点击可查看设置）"
            btnEnable.setBackgroundColor(android.graphics.Color.parseColor("#166534"))
        } else {
            statusText.text = "⭕ 无障碍服务未开启"
            statusText.setTextColor(android.graphics.Color.parseColor("#EF4444"))
            btnEnable.text = "去开启无障碍服务"
            btnEnable.setBackgroundColor(android.graphics.Color.parseColor("#2563EB"))
        }
    }

    /** 跳转系统无障碍设置 */
    private fun openAccessibilitySettings() {
        AccessibilityHelper.openAccessibilitySettings(this)
    }
}
