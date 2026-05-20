package com.miaoda.appbjaapbe7wkqp.native_modules

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.text.TextUtils

/**
 * AccessibilityHelper — 无障碍服务状态检测与引导跳转
 * ────────────────────────────────────────────────────────────────
 * 提供：
 * - isAccessibilityServiceEnabled()    检查本 App 的无障碍服务是否已授权
 * - openAccessibilitySettings()        跳转到系统无障碍设置页面
 * - openAccessibilityGuide()           打开 App 内引导页（AccessibilityGuideActivity）
 * ────────────────────────────────────────────────────────────────
 */
object AccessibilityHelper {

    /**
     * 检查 [GameDetectAccessibilityService] 是否已被用户授权启用。
     *
     * 实现原理：读取 Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES，
     * 检查其中是否包含 "packageName/.ServiceName" 格式的本服务组件名。
     *
     * @return true = 已开启；false = 未开启（需引导用户授权）
     */
    fun isAccessibilityServiceEnabled(context: Context): Boolean {
        val serviceComponent = ComponentName(
            context.packageName,
            GameDetectAccessibilityService::class.java.name
        ).flattenToShortString()  // 格式：packageName/ClassName

        val enabledServices = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false

        return TextUtils.SimpleStringSplitter(':').apply {
            setString(enabledServices)
        }.any { it.equals(serviceComponent, ignoreCase = true) }
    }

    /**
     * 跳转到系统无障碍设置总页面（Settings → 辅助功能）。
     * 用户需在该页面手动找到并开启本 App 的无障碍服务。
     *
     * 注意：部分厂商（MIUI/EMUI）的路径不同，参考 vendor_specific_config.json。
     */
    fun openAccessibilitySettings(context: Context) {
        try {
            context.startActivity(
                Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (e: Exception) {
            // 降级：打开通用设置
            context.startActivity(
                Intent(Settings.ACTION_SETTINGS).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        }
    }

    /**
     * 打开 App 内无障碍服务引导页 [AccessibilityGuideActivity]，
     * 向用户展示品牌适配的分步教程后跳转系统设置。
     */
    fun openAccessibilityGuide(context: Context) {
        context.startActivity(
            Intent(context, AccessibilityGuideActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
        )
    }
}
