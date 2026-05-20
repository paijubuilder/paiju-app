/**
 * 悬浮窗设置管理页 — 后台专用
 * 管理路径：后台 → 仪表盘 → ③ 系统设置与工具 → 悬浮窗管理
 *
 * 功能：
 * 1. floating_window_enabled       总开关（持久化到 app_dynamic_config + admin_config）
 * 2. floating_window_style         样式选择：圆形 / 方形 / 自定义
 * 3. floating_window_position      默认位置：四角 + 右中
 * 4. floating_window_size          尺寸（dp）
 * 5. enable_overlay_permission_check 启动时检查权限
 * 6. floating_window_auto_hide     闲置自动隐藏
 *
 * 配置来源：独立键存于 app_dynamic_config 表，修改后实时同步
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, Switch, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/client/supabase';
import { C } from '@/lib/colors';

// ── 类型定义 ────────────────────────────────────────────
interface FloatCfg {
  floating_window_enabled: boolean;
  floating_window_style: 'circle' | 'square' | 'custom';
  floating_window_position: 'left_top' | 'right_top' | 'left_bottom' | 'right_bottom' | 'right_middle';
  floating_window_size: number;
  enable_overlay_permission_check: boolean;
  floating_window_auto_hide: boolean;
}

const DEFAULT_CFG: FloatCfg = {
  floating_window_enabled: false,
  floating_window_style: 'circle',
  floating_window_position: 'right_middle',
  floating_window_size: 56,
  enable_overlay_permission_check: true,
  floating_window_auto_hide: false,
};

const CONFIG_KEYS = Object.keys(DEFAULT_CFG) as (keyof FloatCfg)[];

const STYLE_OPTIONS: { value: FloatCfg['floating_window_style']; label: string; desc: string }[] = [
  { value: 'circle',  label: '⭕ 圆形',  desc: '标准圆形悬浮球，默认' },
  { value: 'square',  label: '⬛ 方形',  desc: '方形带圆角，更多内容展示空间' },
  { value: 'custom',  label: '🎨 自定义', desc: '保留代码接口，后续迭代配置' },
];

const POSITION_OPTIONS: { value: FloatCfg['floating_window_position']; label: string }[] = [
  { value: 'left_top',      label: '↖ 左上' },
  { value: 'right_top',     label: '↗ 右上' },
  { value: 'right_middle',  label: '➡ 右中（默认）' },
  { value: 'left_bottom',   label: '↙ 左下' },
  { value: 'right_bottom',  label: '↘ 右下' },
];

// ── 读取配置（从独立键） ────────────────────────────────
async function loadFloatCfg(): Promise<FloatCfg> {
  const { data } = await supabase
    .from('app_dynamic_config')
    .select('config_key, config_value')
    .in('config_key', CONFIG_KEYS);

  const result = { ...DEFAULT_CFG };
  if (!data) return result;

  for (const row of data) {
    const key = row.config_key as keyof FloatCfg;
    try {
      const parsed = JSON.parse(row.config_value);
      (result as Record<string, unknown>)[key] = parsed;
    } catch {
      (result as Record<string, unknown>)[key] = row.config_value;
    }
  }
  return result;
}

// ── 写入单个配置键 ──────────────────────────────────────
async function saveFloatKey<K extends keyof FloatCfg>(key: K, value: FloatCfg[K]) {
  const strVal = typeof value === 'string' ? JSON.stringify(value) : String(value);
  await supabase
    .from('app_dynamic_config')
    .upsert({ config_key: key, config_value: strVal, updated_at: new Date().toISOString() },
      { onConflict: 'config_key' });
}

// ── UI 工具组件 ─────────────────────────────────────────
function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 16 }}>{icon}</Text>
        <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>{title}</Text>
      </View>
      <View style={{ padding: 16, gap: 12 }}>{children}</View>
    </View>
  );
}

function SwitchRow({
  label, desc, value, onChange, saving,
}: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void; saving: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: '500' }}>{label}</Text>
        <Text style={{ color: '#667080', fontSize: 11, lineHeight: 16 }}>{desc}</Text>
        <View style={{
          alignSelf: 'flex-start', marginTop: 2,
          backgroundColor: value ? 'rgba(41,196,112,0.12)' : 'rgba(100,110,130,0.12)',
          borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
        }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: value ? '#29C470' : '#667080' }}>
            {saving ? '⏳ 保存中…' : value ? '✅ 已开启' : '⭕ 已关闭'}
          </Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={saving}
        trackColor={{ false: '#2A3140', true: '#16A34A' }}
        thumbColor={value ? '#ffffff' : '#667080'}
        style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
      />
    </View>
  );
}

// ── 主页面 ──────────────────────────────────────────────
export default function AdminFloatWindowPage() {
  const router = useRouter();
  const [cfg, setCfg] = useState<FloatCfg>(DEFAULT_CFG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Partial<Record<keyof FloatCfg, boolean>>>({});
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sizeInput, setSizeInput] = useState(String(DEFAULT_CFG.floating_window_size));

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadFloatCfg().then(c => {
      setCfg(c);
      setSizeInput(String(c.floating_window_size));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []));

  const save = async <K extends keyof FloatCfg>(key: K, value: FloatCfg[K]) => {
    setSaving(p => ({ ...p, [key]: true }));
    setCfg(p => ({ ...p, [key]: value }));
    try {
      await saveFloatKey(key, value);
      setSaveMsg(`✅ ${key} 已保存`);
      setTimeout(() => setSaveMsg(null), 2000);
    } catch {
      setSaveMsg(`❌ 保存失败，请重试`);
      setTimeout(() => setSaveMsg(null), 3000);
    } finally {
      setSaving(p => ({ ...p, [key]: false }));
    }
  };

  const commitSize = () => {
    const n = parseInt(sizeInput, 10);
    if (isNaN(n) || n < 32 || n > 120) {
      setSizeInput(String(cfg.floating_window_size));
      return;
    }
    save('floating_window_size', n);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0F12' }}>
      <StatusBar style="light" backgroundColor="#0D0F12" />

      {/* 顶部导航 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
        <Pressable cssInterop={false} onPress={() => router.back()} hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 12 })}>
          <Text style={{ color: '#D4AF37', fontSize: 28 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#F0F4FF', fontSize: 17, fontWeight: 'bold' }}>🪟 悬浮窗管理</Text>
          <Text style={{ color: '#667080', fontSize: 11, marginTop: 2 }}>
            配置保存至 app_dynamic_config 表，实时同步到 APP
          </Text>
        </View>
        <Pressable cssInterop={false}
          onPress={() => router.push('/(app)/permission-guide')}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#1E2530' : '#161A1F',
            borderRadius: 8, borderWidth: 1, borderColor: '#2A3140',
            paddingHorizontal: 10, paddingVertical: 6,
          })}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>权限引导 →</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.GOLD} size="large" />
          <Text style={{ color: '#667080', marginTop: 8 }}>加载配置中…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic">

          {/* 保存提示 */}
          {saveMsg && (
            <View style={{ backgroundColor: saveMsg.startsWith('✅') ? 'rgba(41,196,112,0.15)' : 'rgba(239,68,68,0.15)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: saveMsg.startsWith('✅') ? '#29C470' : '#EF4444' }}>
              <Text style={{ color: saveMsg.startsWith('✅') ? '#29C470' : '#EF4444', fontSize: 13, textAlign: 'center' }}>{saveMsg}</Text>
            </View>
          )}

          {/* ① 总开关 */}
          <Card title="① 悬浮窗总开关" icon="🪟">
            <SwitchRow
              label="悬浮窗功能开关（floating_window_enabled）"
              desc="开启后，应用将在用户设备上显示可移动/可缩放的悬浮窗，提供快捷功能入口。关闭时前端保留代码入口，但不渲染 UI。"
              value={cfg.floating_window_enabled}
              onChange={v => save('floating_window_enabled', v)}
              saving={!!saving.floating_window_enabled}
            />
            {cfg.floating_window_enabled && (
              <View style={{ backgroundColor: 'rgba(212,175,55,0.1)', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' }}>
                <Text style={{ color: '#D4AF37', fontSize: 12, lineHeight: 18 }}>
                  ⚠️ 悬浮窗已开启。用户设备需手动授权「悬浮窗权限」，否则将提示：
                  {'\n'}「您的设备需要手动授权"悬浮窗权限"，请前往 设置→应用管理→权限管理，开启悬浮窗权限后重新使用。」
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: '#0D0F12', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#2A3140' }}>
                <Text style={{ color: '#8899AA', fontSize: 10, marginBottom: 4 }}>DB 配置键</Text>
                <Text style={{ color: '#F0F4FF', fontFamily: 'monospace', fontSize: 11 }}>floating_window_enabled</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#0D0F12', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#2A3140' }}>
                <Text style={{ color: '#8899AA', fontSize: 10, marginBottom: 4 }}>当前值</Text>
                <Text style={{ color: cfg.floating_window_enabled ? '#29C470' : '#667080', fontWeight: 'bold', fontSize: 13 }}>
                  {cfg.floating_window_enabled ? 'true（已开启）' : 'false（已关闭）'}
                </Text>
              </View>
            </View>
          </Card>

          {/* ② 样式选择 */}
          <Card title="② 悬浮窗样式（floating_window_style）" icon="🎨">
            <Text style={{ color: '#8899AA', fontSize: 12 }}>circle = 圆形 / square = 方形 / custom = 自定义</Text>
            {STYLE_OPTIONS.map(opt => (
              <Pressable cssInterop={false} key={opt.value}
                onPress={() => save('floating_window_style', opt.value)}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: cfg.floating_window_style === opt.value
                    ? 'rgba(212,175,55,0.12)' : (pressed ? '#1E2530' : '#0D0F12'),
                  borderRadius: 10, borderWidth: 1,
                  borderColor: cfg.floating_window_style === opt.value ? '#D4AF37' : '#2A3140',
                  padding: 12,
                })}>
                <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: cfg.floating_window_style === opt.value ? '#D4AF37' : '#4A5568', alignItems: 'center', justifyContent: 'center' }}>
                  {cfg.floating_window_style === opt.value && (
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#D4AF37' }} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '500' }}>{opt.label}</Text>
                  <Text style={{ color: '#667080', fontSize: 11 }}>{opt.desc}</Text>
                </View>
                {saving.floating_window_style && cfg.floating_window_style === opt.value && (
                  <ActivityIndicator size="small" color={C.GOLD} />
                )}
              </Pressable>
            ))}
          </Card>

          {/* ③ 默认位置 */}
          <Card title="③ 默认位置（floating_window_position）" icon="📍">
            <Text style={{ color: '#8899AA', fontSize: 12 }}>用户首次启动时悬浮窗的初始停靠位置，可拖动后自动记忆。</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {POSITION_OPTIONS.map(opt => (
                <Pressable cssInterop={false} key={opt.value}
                  onPress={() => save('floating_window_position', opt.value)}
                  style={({ pressed }) => ({
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: cfg.floating_window_position === opt.value ? '#D4AF37' : (pressed ? '#1E2530' : '#161A1F'),
                    borderWidth: 1,
                    borderColor: cfg.floating_window_position === opt.value ? '#D4AF37' : '#2A3140',
                  })}>
                  <Text style={{ color: cfg.floating_window_position === opt.value ? '#000' : '#F0F4FF', fontSize: 12, fontWeight: '600' }}>
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ backgroundColor: '#0D0F12', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#2A3140' }}>
              <Text style={{ color: '#8899AA', fontSize: 11, fontFamily: 'monospace' }}>
                当前值: "{cfg.floating_window_position}"
              </Text>
            </View>
          </Card>

          {/* ④ 悬浮窗尺寸 */}
          <Card title="④ 悬浮窗尺寸（floating_window_size）" icon="📐">
            <Text style={{ color: '#8899AA', fontSize: 12 }}>单位：dp（Android密度无关像素）。建议范围：32dp ~ 80dp，默认 56dp。</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TextInput
                value={sizeInput}
                onChangeText={setSizeInput}
                onBlur={commitSize}
                keyboardType="number-pad"
                maxLength={3}
                style={{
                  backgroundColor: '#0D0F12', borderRadius: 10, borderWidth: 1, borderColor: '#2A3140',
                  color: '#F0F4FF', fontSize: 22, fontWeight: 'bold', textAlign: 'center',
                  width: 80, paddingVertical: 10,
                }}
              />
              <Text style={{ color: '#667080', fontSize: 13 }}>dp</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#8899AA', fontSize: 11 }}>预览尺寸</Text>
                <View style={{ width: cfg.floating_window_size, height: cfg.floating_window_size, backgroundColor: '#D4AF37', borderRadius: cfg.floating_window_style === 'circle' ? cfg.floating_window_size : 8, alignItems: 'center', justifyContent: 'center', marginTop: 4 }}>
                  <Text style={{ fontSize: Math.max(10, cfg.floating_window_size * 0.4) }}>🛡</Text>
                </View>
              </View>
            </View>
            <Text style={{ color: '#667080', fontSize: 11 }}>修改后失焦自动保存。支持范围：32～120</Text>
          </Card>

          {/* ⑤ 高级选项 */}
          <Card title="⑤ 高级控制选项" icon="⚙️">
            <SwitchRow
              label="启动时检查悬浮窗权限（enable_overlay_permission_check）"
              desc="开启后，APP 首次启动时将自动检测 SYSTEM_ALERT_WINDOW 权限状态，未授权时弹出引导弹窗。"
              value={cfg.enable_overlay_permission_check}
              onChange={v => save('enable_overlay_permission_check', v)}
              saving={!!saving.enable_overlay_permission_check}
            />
            <View style={{ height: 1, backgroundColor: '#2A3140' }} />
            <SwitchRow
              label="闲置后自动隐藏（floating_window_auto_hide）"
              desc="开启后，悬浮窗在 5 秒无交互时自动缩小至半透明状态，点击恢复原始大小，避免遮挡游戏内容。"
              value={cfg.floating_window_auto_hide}
              onChange={v => save('floating_window_auto_hide', v)}
              saving={!!saving.floating_window_auto_hide}
            />
          </Card>

          {/* ⑥ 配置汇总（只读视图） */}
          <Card title="⑥ 当前配置汇总（DB实时值）" icon="📋">
            <Text style={{ color: '#667080', fontSize: 11, marginBottom: 4 }}>以下为 app_dynamic_config 表中 6 个悬浮窗配置键的当前值</Text>
            {CONFIG_KEYS.map(k => (
              <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#1E2530' }}>
                <View style={{ flex: 2 }}>
                  <Text style={{ color: '#8899AA', fontSize: 10, fontFamily: 'monospace' }}>{k}</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={{ color: '#D4AF37', fontSize: 12, fontFamily: 'monospace' }}>
                    {String(cfg[k as keyof FloatCfg])}
                  </Text>
                </View>
              </View>
            ))}
          </Card>

          {/* ⑦ 权限引导入口 */}
          <Card title="⑦ 悬浮窗权限引导" icon="📱">
            <Text style={{ color: '#8899AA', fontSize: 12, lineHeight: 18 }}>
              不同品牌手机的悬浮窗权限开启路径不同（小米/华为/OPPO/vivo/荣耀等），点击下方按钮进入分品牌权限引导页面。
            </Text>
            <Pressable cssInterop={false}
              onPress={() => router.push('/(app)/permission-guide')}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
                borderRadius: 12, paddingVertical: 13, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              })}>
              <Text style={{ fontSize: 16 }}>📱</Text>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>进入悬浮窗权限引导页面</Text>
            </Pressable>
            <Text style={{ color: '#667080', fontSize: 11, textAlign: 'center' }}>
              支持小米 · 华为 · OPPO · vivo · 荣耀 五大品牌分步引导
            </Text>
          </Card>

          {/* ⑧ 技术备注 */}
          <Card title="⑧ 开发技术备注（导出说明）" icon="💡">
            <Text style={{ color: '#667080', fontSize: 12, lineHeight: 20 }}>
              {'• Android 原生实现：WindowManager + SYSTEM_ALERT_WINDOW\n'}
              {'• 原生参考代码保存于：src/floating_window/（随源码导出）\n'}
              {'• iOS 端：系统限制，改用本地通知栏替代（代码已标注注释）\n'}
              {'• 鸿蒙NEXT：module.json5 声明 CREATE_FLOATING_WINDOW 权限\n'}
              {'• 配置独立存储于 app_dynamic_config，不绑定秒哒平台API\n'}
              {'• 导出代码在 Android Studio 中可独立编译（不依赖平台专有库）'}
            </Text>
          </Card>

        </ScrollView>
      )}
    </View>
  );
}
