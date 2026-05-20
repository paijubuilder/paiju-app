package com.miaoda.appbjaapbe7wkqp.floatingwindow

import android.app.AppOpsManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log

/**
 * PermissionHelper — 悬浮窗权限检测与品牌适配跳转
 *
 * 功能：
 * 1. 检测 SYSTEM_ALERT_WINDOW 权限状态
 * 2. 检测当前设备品牌（小米/华为/OPPO/vivo/荣耀/三星/通用）
 * 3. 生成品牌专属的权限设置跳转 Intent
 * 4. 提供通用兜底跳转方案
 *
 * 品牌对应关系参见 vendor_specific_config.json
 */
object PermissionHelper {

    private const val TAG = "PermissionHelper"

    // ── 品牌枚举 ──────────────────────────────────────────
    enum class Brand {
        XIAOMI, HUAWEI, OPPO, VIVO, HONOR, SAMSUNG, DEFAULT
    }

    // ── 权限检测 ──────────────────────────────────────────

    /**
     * 检测是否拥有悬浮窗权限（SYSTEM_ALERT_WINDOW）
     * Android 6.0+ 需要显式授权
     */
    fun hasOverlayPermission(context: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            // Android 6.0 以下默认拥有权限
            true
        }
    }

    /**
     * 针对 MIUI 的额外权限检测（小米系统有双重权限控制）
     */
    fun hasMiuiOverlayPermission(context: Context): Boolean {
        return try {
            val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val op = AppOpsManager.nameToOp("android:system_alert_window") ?: return false
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ops.unsafeCheckOpNoThrow(op, android.os.Process.myUid(), context.packageName)
            } else {
                @Suppress("DEPRECATION")
                ops.checkOpNoThrow(op, android.os.Process.myUid(), context.packageName)
            }
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            Log.w(TAG, "MIUI 权限检测失败，使用通用方法: ${e.message}")
            hasOverlayPermission(context)
        }
    }

    // ── 品牌识别 ──────────────────────────────────────────

    fun detectBrand(): Brand {
        val manufacturer = Build.MANUFACTURER.lowercase()
        val brand = Build.BRAND.lowercase()
        return when {
            manufacturer.contains("xiaomi") || brand.contains("redmi") || brand.contains("poco") -> Brand.XIAOMI
            manufacturer.contains("huawei") && !brand.contains("honor") -> Brand.HUAWEI
            brand.contains("honor") -> Brand.HONOR
            manufacturer.contains("oppo") || brand.contains("oneplus") || brand.contains("realme") -> Brand.OPPO
            manufacturer.contains("vivo") || brand.contains("iqoo") -> Brand.VIVO
            manufacturer.contains("samsung") -> Brand.SAMSUNG
            else -> Brand.DEFAULT
        }
    }

    // ── 品牌专属跳转 Intent ───────────────────────────────

    /**
     * 获取品牌专属悬浮窗权限设置 Intent
     * 失败时自动降级至通用 Settings
     */
    fun getOverlayPermissionIntent(context: Context): Intent {
        val brand = detectBrand()
        Log.d(TAG, "检测到品牌: $brand")

        return when (brand) {
            Brand.XIAOMI -> getMiuiPermissionIntent(context) ?: getDefaultIntent(context)
            Brand.HUAWEI -> getHuaweiPermissionIntent(context) ?: getDefaultIntent(context)
            Brand.OPPO   -> getOppoPermissionIntent(context) ?: getDefaultIntent(context)
            Brand.VIVO   -> getVivoPermissionIntent(context) ?: getDefaultIntent(context)
            Brand.HONOR  -> getHonorPermissionIntent(context) ?: getDefaultIntent(context)
            Brand.SAMSUNG, Brand.DEFAULT -> getDefaultIntent(context)
        }
    }

    // ── 各品牌专属 Intent ─────────────────────────────────

    private fun getMiuiPermissionIntent(context: Context): Intent? {
        return try {
            Intent("miui.intent.action.APP_PERM_EDITOR").apply {
                setPackage("com.miui.securitycenter")
                putExtra("extra_pkgname", context.packageName)
            }.also { resolveOrNull(context, it) ?: return null }
        } catch (e: Exception) { null }
    }

    private fun getHuaweiPermissionIntent(context: Context): Intent? {
        return try {
            Intent().apply {
                component = ComponentName(
                    "com.huawei.systemmanager",
                    "com.huawei.systemmanager.additionalmng.ui.PermissionExtraActivity"
                )
            }.also { resolveOrNull(context, it) ?: return null }
        } catch (e: Exception) { null }
    }

    private fun getOppoPermissionIntent(context: Context): Intent? {
        return try {
            Intent("com.coloros.safecenter.permission.floatwindow.FloatWindowListActivity").apply {
                setPackage("com.coloros.safecenter")
            }.also { resolveOrNull(context, it) ?: return null }
        } catch (e: Exception) { null }
    }

    private fun getVivoPermissionIntent(context: Context): Intent? {
        return try {
            Intent("com.iqoo.secure.safeguard.FloatWindowManager").apply {
                setPackage("com.iqoo.secure")
            }.also { resolveOrNull(context, it) ?: return null }
        } catch (e: Exception) { null }
    }

    private fun getHonorPermissionIntent(context: Context): Intent? {
        // 荣耀使用与华为相似的系统管理器，降级为通用
        return try {
            Intent().apply {
                component = ComponentName(
                    "com.hihonor.systemmanager",
                    "com.hihonor.systemmanager.additionalmng.ui.PermissionExtraActivity"
                )
            }.also { resolveOrNull(context, it) ?: return null }
        } catch (e: Exception) { null }
    }

    private fun getDefaultIntent(context: Context): Intent {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:${context.packageName}")
            )
        } else {
            Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.parse("package:${context.packageName}")
            }
        }
    }

    private fun resolveOrNull(context: Context, intent: Intent): Intent? {
        return if (context.packageManager.resolveActivity(intent, 0) != null) intent else null
    }

    // ── 直接跳转（调用方直接使用） ───────────────────────

    /**
     * 一键跳转到悬浮窗权限设置（自动选择品牌专属路径）
     */
    fun openOverlayPermissionSettings(context: Context) {
        try {
            val intent = getOverlayPermissionIntent(context)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            context.startActivity(intent)
            Log.d(TAG, "跳转悬浮窗权限设置: $intent")
        } catch (e: ActivityNotFoundException) {
            Log.e(TAG, "跳转失败，使用通用Settings兜底: ${e.message}")
            try {
                context.startActivity(
                    Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                )
            } catch (e2: Exception) {
                Log.e(TAG, "通用Settings也无法跳转: ${e2.message}")
            }
        }
    }
}
