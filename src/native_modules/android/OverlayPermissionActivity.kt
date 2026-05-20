package com.miaoda.appbjaapbe7wkqp.native_modules

import android.app.Activity
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.ViewGroup
import android.widget.*

/**
 * OverlayPermissionActivity — 悬浮窗权限授权引导页
 * ────────────────────────────────────────────────────────────────
 * 功能：
 * 1. 显示「为什么需要悬浮窗权限」说明文字
 * 2. 提供「去授权」按钮，跳转到 Settings.ACTION_MANAGE_OVERLAY_PERMISSION
 * 3. onResume 中实时检查 Settings.canDrawOverlays()，已授权则提示成功
 *
 * 触发时机：
 * 在 FloatingWindowService.addFloatingWindow() 调用前，
 * 先检查 Build.VERSION.SDK_INT >= M && !Settings.canDrawOverlays(ctx)，
 * 若无权限则启动本 Activity。
 *
 * 集成步骤（导出后操作）：
 * 在 AndroidManifest.xml 中声明：
 * <activity android:name=".native_modules.OverlayPermissionActivity" />
 * ────────────────────────────────────────────────────────────────
 */
class OverlayPermissionActivity : Activity() {

    companion object {
        private const val TAG = "OverlayPermActivity"
        private const val REQ_CODE_OVERLAY = 1001
    }

    private lateinit var statusText: TextView
    private lateinit var btnAuthorize: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "onCreate")
        buildUI()
    }

    override fun onResume() {
        super.onResume()
        // 从系统设置返回后刷新授权状态
        updatePermissionStatus()
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQ_CODE_OVERLAY) {
            updatePermissionStatus()
        }
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

        root.addView(TextView(this).apply {
            text = "🪟"
            textSize = 48f
            gravity = Gravity.CENTER
        })

        root.addView(TextView(this).apply {
            text = "开启悬浮窗权限"
            textSize = 22f
            setTextColor(android.graphics.Color.parseColor("#F0F4FF"))
            gravity = Gravity.CENTER
            setPadding(0, 24, 0, 12)
        })

        // 说明文字（依据用户知情权，明确说明用途）
        root.addView(TextView(this).apply {
            text = buildString {
                appendLine("使用悬浮窗功能需要您授予「显示在其他应用上层」权限。\n")
                appendLine("此权限用于：")
                appendLine("  • 在游戏运行时显示悬浮窗护航状态")
                appendLine("  • 提供快速检测入口，无需切换应用\n")
                appendLine("⚠️ 本应用仅在游戏运行时显示悬浮窗，")
                appendLine("   不会在其他场景显示任何覆盖内容。")
            }
            textSize = 13f
            setTextColor(android.graphics.Color.parseColor("#8899AA"))
            lineSpacingMultiplier = 1.5f
        })

        root.addView(View(this).apply {
            layoutParams = LinearLayout.LayoutParams(1, 32)
        })

        statusText = TextView(this).apply {
            textSize = 13f
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 16)
        }
        root.addView(statusText)

        btnAuthorize = Button(this).apply {
            text = "去授权"
            textSize = 15f
            setTextColor(android.graphics.Color.WHITE)
            setBackgroundColor(android.graphics.Color.parseColor("#2563EB"))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 0, 0, 16) }
            setOnClickListener { requestOverlayPermission() }
        }
        root.addView(btnAuthorize)

        root.addView(Button(this).apply {
            text = "返回"
            textSize = 14f
            setTextColor(android.graphics.Color.parseColor("#667080"))
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            setOnClickListener { finish() }
        })

        setContentView(root)
    }

    // ── 权限处理 ──────────────────────────────────────────

    /** 更新 UI 中的权限状态提示 */
    private fun updatePermissionStatus() {
        val granted = hasOverlayPermission()
        if (granted) {
            statusText.text = "✅ 悬浮窗权限已授权"
            statusText.setTextColor(android.graphics.Color.parseColor("#29C470"))
            btnAuthorize.text = "已授权（点击可查看设置）"
            btnAuthorize.setBackgroundColor(android.graphics.Color.parseColor("#166534"))
            Log.d(TAG, "悬浮窗权限已授权，可启动 FloatingWindowService")
            // TODO: 权限已授权后，自动回调或发送广播通知启动悬浮窗
        } else {
            statusText.text = "⭕ 悬浮窗权限未授权"
            statusText.setTextColor(android.graphics.Color.parseColor("#EF4444"))
            btnAuthorize.text = "去授权"
            btnAuthorize.setBackgroundColor(android.graphics.Color.parseColor("#2563EB"))
        }
    }

    /** 跳转 Settings.ACTION_MANAGE_OVERLAY_PERMISSION 请求权限 */
    private fun requestOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:$packageName")
                )
                startActivityForResult(intent, REQ_CODE_OVERLAY)
            } catch (e: Exception) {
                Log.e(TAG, "无法打开悬浮窗权限设置: ${e.message}")
                // 降级：使用品牌专属跳转（调用 floating_window 目录中的 PermissionHelper）
                // PermissionHelper.openOverlayPermissionSettings(this)
            }
        }
    }

    private fun hasOverlayPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(this)
        } else true
    }
}
