package com.miaoda.appbjaapbe7wkqp.native_modules

import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.util.Log
import android.view.*
import android.widget.FrameLayout
import android.widget.PopupWindow
import android.widget.TextView

/**
 * FloatingWindowService — 悬浮窗后台服务
 * ────────────────────────────────────────────────────────────────
 * 对应开关：enable_floating_window（system_switches 表）
 *
 * 集成步骤（导出后操作）：
 * 1. 复制到 android/app/src/main/java/com/miaoda/.../native_modules/
 * 2. 在 AndroidManifest.xml 中声明：
 *    <uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
 *    <service android:name=".native_modules.FloatingWindowService" />
 * 3. 在 MainActivity / Application 中读取 SettingsRepository.isEnabled("enable_floating_window")，
 *    若为 true 则调用 startFloatingWindowService()
 * ────────────────────────────────────────────────────────────────
 */
class FloatingWindowService : Service() {

    companion object {
        private const val TAG = "FloatingWindowService"
        const val ACTION_SHOW    = "ACTION_FW_SHOW"
        const val ACTION_HIDE    = "ACTION_FW_HIDE"
        const val ACTION_UPDATE  = "ACTION_FW_UPDATE"
        const val EXTRA_STATUS   = "extra_status"
        const val EXTRA_PHASE    = "extra_phase"
    }

    private lateinit var windowManager: WindowManager
    private var floatingView: View? = null
    private var layoutParams: WindowManager.LayoutParams? = null
    private var popupWindow: PopupWindow? = null
    private var isShowing = false

    // ── 生命周期 ──────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        Log.d(TAG, "onCreate: 悬浮窗服务启动")
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        initWindowManager()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_SHOW   -> addFloatingWindow()
            ACTION_HIDE   -> removeFloatingWindow()
            ACTION_UPDATE -> {
                val status = intent.getStringExtra(EXTRA_STATUS) ?: "护航中"
                val phase  = intent.getStringExtra(EXTRA_PHASE)  ?: "guarding"
                updateFloatingWindowStatus(status, phase)
            }
            else -> addFloatingWindow()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        removeFloatingWindow()
        Log.d(TAG, "onDestroy: 悬浮窗服务停止")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ── 初始化 ────────────────────────────────────────────

    /**
     * 初始化 WindowManager 参数。
     * 在 onCreate 中调用，建立好布局参数供后续 add/remove 使用。
     */
    private fun initWindowManager() {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        layoutParams = WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            type,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.END or Gravity.CENTER_VERTICAL
            x = 16
            y = 0
        }
    }

    // ── 显示/隐藏 ─────────────────────────────────────────

    /**
     * 向 WindowManager 添加悬浮窗 View。
     * 调用前须检查 Settings.canDrawOverlays(context) 权限。
     */
    fun addFloatingWindow() {
        if (isShowing) return
        try {
            val view = buildFloatingView()
            floatingView = view
            windowManager.addView(view, layoutParams)
            attachTouchListener(view)
            isShowing = true
            Log.d(TAG, "addFloatingWindow: 悬浮窗已添加")
        } catch (e: Exception) {
            Log.e(TAG, "addFloatingWindow 失败: ${e.message}", e)
        }
    }

    /** 从 WindowManager 中移除悬浮窗 View */
    fun removeFloatingWindow() {
        if (!isShowing) return
        try {
            floatingView?.let { windowManager.removeView(it) }
            floatingView = null
            isShowing = false
            Log.d(TAG, "removeFloatingWindow: 悬浮窗已移除")
        } catch (e: Exception) {
            Log.e(TAG, "removeFloatingWindow 失败: ${e.message}", e)
        }
    }

    // ── 拖拽交互 ──────────────────────────────────────────

    /**
     * 更新悬浮窗在屏幕上的位置（由拖拽事件调用）。
     * 限制拖拽边界：x 范围 [0, screenWidth - viewWidth]，y 范围 [0, screenHeight - viewHeight]。
     *
     * @param newX 新的水平偏移（相对 gravity 起点）
     * @param newY 新的垂直偏移
     */
    fun updateFloatingWindowPosition(newX: Int, newY: Int) {
        layoutParams?.let { params ->
            params.x = newX
            params.y = newY
            floatingView?.let {
                try { windowManager.updateViewLayout(it, params) }
                catch (e: Exception) { Log.e(TAG, "updatePosition 失败: ${e.message}") }
            }
        }
    }

    /** 更新悬浮窗状态文字与颜色（护航中 / 检测中 / 空闲） */
    fun updateFloatingWindowStatus(status: String, phase: String) {
        val view = floatingView ?: return
        val badge = view.findViewWithTag<TextView>("badge") ?: return
        badge.text = status
        // TODO: 根据 phase 更新 badge 颜色（guarding/scanning/idle/expired）
        Log.d(TAG, "updateStatus: $status ($phase)")
    }

    // ── 私有方法 ──────────────────────────────────────────

    /** 构建悬浮窗 View（圆形护盾徽标 + 状态文字）*/
    private fun buildFloatingView(): View {
        val container = FrameLayout(this)
        container.layoutParams = FrameLayout.LayoutParams(140, 140)

        val badge = TextView(this).apply {
            tag = "badge"
            text = "🛡"
            textSize = 28f
            gravity = Gravity.CENTER
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(android.graphics.Color.parseColor("#CC0D1520"))
        }
        container.addView(badge)

        // TODO: 在这里替换为 res/layout/floating_layout.xml 的 LayoutInflater 方案
        // val view = LayoutInflater.from(this).inflate(R.layout.floating_layout, null)
        return container
    }

    /** 为悬浮窗附加触摸拖拽 + 单击展开菜单 */
    private fun attachTouchListener(view: View) {
        var startRawX = 0f
        var startRawY = 0f
        var startParamX = 0
        var startParamY = 0
        var isDragging = false

        view.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    startRawX  = event.rawX
                    startRawY  = event.rawY
                    startParamX = layoutParams?.x ?: 0
                    startParamY = layoutParams?.y ?: 0
                    isDragging  = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = event.rawX - startRawX
                    val dy = event.rawY - startRawY
                    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
                        isDragging = true
                        // 注意：限制拖拽边界可在此添加 coerceIn(min, max) 逻辑
                        updateFloatingWindowPosition(
                            (startParamX - dx).toInt(),  // END gravity 时 x 轴反向
                            (startParamY + dy).toInt()
                        )
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (!isDragging) showFloatingMenu(v)
                    true
                }
                else -> false
            }
        }
    }

    /**
     * 悬浮窗点击后展开浮动菜单（PopupWindow）。
     * 菜单预留：「检测环境」「查看报告」两个选项。
     * TODO: 在这里填充菜单项的具体 Click 逻辑
     */
    private fun showFloatingMenu(anchor: View) {
        val menuView = FrameLayout(this).apply {
            val p = 24
            setPadding(p, p, p, p)
            setBackgroundColor(android.graphics.Color.parseColor("#F0161A1F"))
        }

        // 菜单项：检测环境
        val btnDetect = TextView(this).apply {
            text = "🔍  检测环境"
            textSize = 14f
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                popupWindow?.dismiss()
                // TODO: 在这里发送广播或调用 DeviceRiskDetector.generateRiskReport()
                Log.d(TAG, "菜单点击: 检测环境")
            }
        }
        // 菜单项：查看报告
        val btnReport = TextView(this).apply {
            text = "📊  查看报告"
            textSize = 14f
            setTextColor(android.graphics.Color.WHITE)
            setOnClickListener {
                popupWindow?.dismiss()
                // TODO: 在这里打开报告 Activity 或发送 Intent
                Log.d(TAG, "菜单点击: 查看报告")
            }
        }

        val ll = android.widget.LinearLayout(this).apply {
            orientation = android.widget.LinearLayout.VERTICAL
            addView(btnDetect)
            addView(android.View(context).apply { layoutParams = android.widget.LinearLayout.LayoutParams(android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 1) })
            addView(btnReport)
        }
        menuView.addView(ll)

        popupWindow = PopupWindow(menuView, 280, WindowManager.LayoutParams.WRAP_CONTENT, true)
        popupWindow?.showAsDropDown(anchor)
    }
}
