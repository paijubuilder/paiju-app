package com.miaoda.appbjaapbe7wkqp.native_modules

import android.content.Context
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.provider.Settings
import android.util.Log

/**
 * DeviceRiskDetector — 设备环境风险检测工具
 * ────────────────────────────────────────────────────────────────
 * 对应开关：enable_risk_detection（system_switches 表）
 *
 * 提供静态检测方法，每个方法独立运行，不相互依赖。
 * 所有检测均为「探测式」，不会修改系统设置或触发权限弹窗。
 *
 * 使用示例：
 *   if (SettingsRepository.isEnabled(context, "enable_risk_detection")) {
 *       val report = DeviceRiskDetector.generateRiskReport(context)
 *       Log.d("RiskCheck", report)
 *       // TODO: 将 report 显示在悬浮窗菜单「查看报告」或检测报告页面
 *   }
 * ────────────────────────────────────────────────────────────────
 */
object DeviceRiskDetector {

    private const val TAG = "DeviceRiskDetector"

    // ── 单项检测方法 ──────────────────────────────────────

    /**
     * 检测设备是否已 Root。
     *
     * 检测策略（多重）：
     * 1. 执行 `which su` 命令，检查是否有输出
     * 2. 检查已知 Root 管理器文件路径
     *
     * @return true = 已 Root；false = 未检测到 Root
     */
    fun isRooted(): Boolean {
        // 策略一：执行 su 命令
        val suByCommand = try {
            val process = Runtime.getRuntime().exec(arrayOf("which", "su"))
            val result = process.inputStream.bufferedReader().readLine()
            process.destroy()
            !result.isNullOrBlank()
        } catch (e: Exception) {
            false
        }
        if (suByCommand) return true

        // 策略二：检查已知 Root 路径
        val knownRootPaths = listOf(
            "/system/app/Superuser.apk",
            "/sbin/su", "/system/bin/su", "/system/xbin/su",
            "/data/local/xbin/su", "/data/local/bin/su",
            "/system/sd/xbin/su", "/system/bin/failsafe/su",
            "/data/local/su", "/su/bin/su",
        )
        return knownRootPaths.any { java.io.File(it).exists() }
    }

    /**
     * 检测 Xposed/LSPosed 框架是否已安装。
     *
     * 检测策略（多重）：
     * 1. 检查已知 Xposed 安装器包名
     * 2. 检查 XposedBridge 类是否可被加载
     *
     * @return true = 检测到 Xposed 框架；false = 未检测到
     */
    fun isXposedInstalled(context: Context): Boolean {
        // 策略一：检查包名
        val xposedPackages = listOf(
            "de.robv.android.xposed.installer",
            "io.github.lsposed.manager",
            "org.lsposed.manager",
            "com.solohsu.android.edxp.manager",
        )
        val pm = context.packageManager
        val foundByPackage = xposedPackages.any { pkg ->
            try {
                pm.getPackageInfo(pkg, 0)
                true
            } catch (e: PackageManager.NameNotFoundException) {
                false
            }
        }
        if (foundByPackage) return true

        // 策略二：反射检测 XposedBridge（在被 Hook 的进程中通常能加载）
        return try {
            Class.forName("de.robv.android.xposed.XposedBridge")
            true
        } catch (e: ClassNotFoundException) {
            false
        }
    }

    /**
     * 检测设备是否连接了 VPN 或配置了代理。
     *
     * @return true = 检测到 VPN/代理；false = 未检测到
     */
    fun isVPNActive(context: Context): Boolean {
        return try {
            val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val network = cm.activeNetwork ?: return false
                val caps = cm.getNetworkCapabilities(network) ?: return false
                caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
            } else {
                @Suppress("DEPRECATION")
                val networks = cm.allNetworks
                networks.any { net ->
                    @Suppress("DEPRECATION")
                    cm.getNetworkInfo(net)?.typeName?.contains("VPN", ignoreCase = true) == true
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "VPN检测异常: ${e.message}")
            false
        }
    }

    /**
     * 检测设备是否开启了开发者选项。
     *
     * 注意：部分系统（如 MIUI）即使开发者选项关闭，此值也可能为 1。
     * TODO: 如需更精确，可结合 USB调试、模拟位置等子选项综合判断。
     *
     * @return true = 开发者选项已启用；false = 未启用
     */
    fun isDevOptionsEnabled(context: Context): Boolean {
        return try {
            Settings.Global.getInt(
                context.contentResolver,
                Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
                0
            ) != 0
        } catch (e: Exception) {
            Log.w(TAG, "开发者选项检测异常: ${e.message}")
            false
        }
    }

    /**
     * 检测是否处于模拟器环境（Android Emulator / 云手机）。
     *
     * @return true = 可能是模拟器；false = 可能是真实设备
     */
    fun isEmulator(): Boolean {
        val markers = listOf(
            Build.FINGERPRINT.startsWith("generic"),
            Build.FINGERPRINT.startsWith("unknown"),
            Build.MODEL.contains("google_sdk"),
            Build.MODEL.contains("Emulator"),
            Build.MODEL.contains("Android SDK built for x86"),
            Build.MANUFACTURER.contains("Genymotion"),
            Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic"),
            Build.PRODUCT == "google_sdk",
            Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains("ranchu"),
        )
        return markers.any { it }
    }

    // ── 综合报告 ──────────────────────────────────────────

    /**
     * 生成综合风险检测报告字符串。
     * 供界面展示或日志记录，格式为可读文本。
     *
     * TODO: 在悬浮窗菜单「查看报告」按钮的点击事件中调用此方法并显示结果。
     *
     * @return 检测报告字符串
     */
    fun generateRiskReport(context: Context): String {
        val sb = StringBuilder()
        sb.appendLine("═══════ 设备环境检测报告 ═══════")
        sb.appendLine("检测时间：${java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date())}")
        sb.appendLine()

        val results = mutableListOf<Triple<String, Boolean, String>>()

        // 执行各项检测（捕获异常保证不崩溃）
        results += Triple("Root 权限",    safeCheck { isRooted() },              "设备可能已被 Root，存在篡改风险")
        results += Triple("Xposed 框架",  safeCheck { isXposedInstalled(context) }, "检测到 Hook 框架，可能存在作弊行为")
        results += Triple("VPN/代理",     safeCheck { isVPNActive(context) },     "网络可能被代理，存在流量劫持风险")
        results += Triple("开发者选项",   safeCheck { isDevOptionsEnabled(context) }, "开发者模式已开启，存在调试风险")
        results += Triple("模拟器环境",   safeCheck { isEmulator() },             "可能运行在模拟器或云手机中")

        val riskCount = results.count { it.second }

        for ((name, risk, reason) in results) {
            val icon = if (risk) "⚠️" else "✅"
            sb.appendLine("$icon $name：${if (risk) "检测到风险" else "正常"}")
            if (risk) sb.appendLine("   └─ $reason")
        }

        sb.appendLine()
        sb.appendLine("风险项：$riskCount / ${results.size}")
        sb.appendLine("综合评级：${when (riskCount) {
            0    -> "安全 ✅"
            1    -> "低风险 ⚠️"
            2    -> "中风险 🔶"
            else -> "高风险 ❌"
        }}")
        sb.appendLine("════════════════════════════════")

        return sb.toString().also { Log.d(TAG, "风险报告:\n$it") }
    }

    // ── 工具方法 ──────────────────────────────────────────

    /** 安全执行检测，异常时返回 false 避免影响其他检测项 */
    private fun safeCheck(block: () -> Boolean): Boolean {
        return try { block() }
        catch (e: Exception) { Log.w(TAG, "检测项异常: ${e.message}"); false }
    }
}
