package com.miaoda.appbjaapbe7wkqp.native_modules

import android.content.Context
import android.util.Log

/**
 * SettingsRepository — 原生功能开关状态读取工具
 * ────────────────────────────────────────────────────────────────
 * 在导出的原生 App 中，本类负责读取 system_switches 开关状态。
 *
 * 数据来源优先级：
 * 1. SharedPreferences（本地缓存）→ 速度最快，离线可用
 * 2. 远程数据库（Supabase REST API）→ 实时同步，需网络
 *
 * 使用示例（在 Application.onCreate 中初始化）：
 *   class MyApplication : Application() {
 *       override fun onCreate() {
 *           super.onCreate()
 *           // 异步从远程同步开关状态到本地 SharedPreferences
 *           SettingsRepository.syncFromRemote(this)
 *       }
 *   }
 *
 *   // 在各 Service / Activity 中读取（同步，使用本地缓存）
 *   if (SettingsRepository.isEnabled(context, "enable_floating_window")) {
 *       startService(Intent(this, FloatingWindowService::class.java))
 *   }
 * ────────────────────────────────────────────────────────────────
 */
object SettingsRepository {

    private const val TAG         = "SettingsRepository"
    private const val PREFS_NAME  = "native_feature_switches"

    // 所有已知开关键名（与 system_switches 表 switch_key 字段对应）
    val ALL_SWITCH_KEYS = listOf(
        "enable_floating_window",
        "enable_accessibility_detect",
        "enable_foreground_service",
        "enable_boot_start",
        "enable_risk_detection",
    )

    // ── 本地读取 ──────────────────────────────────────────

    /**
     * 读取指定开关的状态（本地 SharedPreferences 缓存）。
     *
     * @param context      Android Context
     * @param switchKey    开关键名（如 "enable_floating_window"）
     * @param defaultValue 键不存在时的默认值（默认 false）
     * @return true = 开启；false = 关闭
     */
    fun isEnabled(context: Context, switchKey: String, defaultValue: Boolean = false): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return prefs.getBoolean(switchKey, defaultValue).also {
            Log.v(TAG, "isEnabled[$switchKey] = $it")
        }
    }

    /**
     * 批量读取所有开关状态。
     * @return Map<switchKey, isEnabled>
     */
    fun getAllSwitches(context: Context): Map<String, Boolean> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return ALL_SWITCH_KEYS.associateWith { key ->
            prefs.getBoolean(key, false)
        }
    }

    // ── 本地写入 ──────────────────────────────────────────

    /**
     * 更新指定开关状态到本地 SharedPreferences。
     * 通常由 [syncFromRemote] 调用，不建议业务代码直接调用。
     */
    fun setEnabled(context: Context, switchKey: String, enabled: Boolean) {
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putBoolean(switchKey, enabled)
            .apply()
        Log.d(TAG, "setEnabled[$switchKey] = $enabled")
    }

    /** 批量写入开关状态（通常在远程同步后调用）*/
    fun setAllSwitches(context: Context, switches: Map<String, Boolean>) {
        val editor = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
        switches.forEach { (key, value) -> editor.putBoolean(key, value) }
        editor.apply()
        Log.d(TAG, "批量写入 ${switches.size} 条开关状态")
    }

    // ── 远程同步 ──────────────────────────────────────────

    /**
     * 从 Supabase 远程数据库同步开关状态到本地 SharedPreferences。
     *
     * TODO: 在导出代码后，将 SUPABASE_URL 和 SUPABASE_ANON_KEY 替换为真实值，
     *       或从 BuildConfig 读取（推荐）。
     *
     * 调用时机建议：
     * - Application.onCreate() 异步调用（不阻塞主线程）
     * - App 前台恢复时调用（onResume）
     * - 用户登录成功后调用（确保获取最新配置）
     */
    fun syncFromRemote(context: Context) {
        // TODO: 替换为正式的异步网络请求（推荐使用 OkHttp/Retrofit/Ktor）
        Thread {
            try {
                // 示例：使用 HttpURLConnection 调用 Supabase REST API
                val supabaseUrl  = "https://YOUR_PROJECT.supabase.co"  // TODO: 替换为真实 URL
                val supabaseKey  = "YOUR_ANON_KEY"                     // TODO: 替换为真实 Key
                val url = java.net.URL("$supabaseUrl/rest/v1/system_switches?select=switch_key,is_enabled")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.setRequestProperty("apikey", supabaseKey)
                conn.setRequestProperty("Authorization", "Bearer $supabaseKey")
                conn.connectTimeout = 5000
                conn.readTimeout = 5000

                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().readText()
                    // TODO: 使用 Gson/Moshi 解析 JSON，此处为演示用简单解析
                    val switches = parseSimpleSwitchJson(body)
                    if (switches.isNotEmpty()) {
                        setAllSwitches(context, switches)
                        Log.i(TAG, "远程同步完成：${switches.size} 条开关")
                    }
                } else {
                    Log.w(TAG, "远程同步失败，HTTP ${conn.responseCode}，使用本地缓存")
                }
                conn.disconnect()
            } catch (e: Exception) {
                Log.w(TAG, "远程同步异常，使用本地缓存: ${e.message}")
            }
        }.start()
    }

    // ── 工具方法 ──────────────────────────────────────────

    /**
     * 简单解析 Supabase 返回的 JSON 数组。
     * TODO: 建议替换为 Gson/Moshi 等正规 JSON 库。
     * 示例输入：[{"switch_key":"enable_floating_window","is_enabled":false}, ...]
     */
    private fun parseSimpleSwitchJson(json: String): Map<String, Boolean> {
        val result = mutableMapOf<String, Boolean>()
        try {
            // 使用 org.json（Android 内置）
            val array = org.json.JSONArray(json)
            for (i in 0 until array.length()) {
                val obj = array.getJSONObject(i)
                val key     = obj.getString("switch_key")
                val enabled = obj.getBoolean("is_enabled")
                result[key] = enabled
            }
        } catch (e: Exception) {
            Log.e(TAG, "JSON 解析失败: ${e.message}")
        }
        return result
    }
}
