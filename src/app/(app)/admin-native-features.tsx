/**
 * 原生功能配置页 — 管理员后台专用
 *
 * 路径：【经营】→【原生功能配置】
 * 权限：仅管理员可见
 *
 * 5 个原生功能开关（全部默认关闭）+ 导出项目类型选择：
 *   1. enable_floating_window        悬浮窗功能
 *   2. enable_accessibility_detect   无障碍服务监听
 *   3. enable_foreground_service     前台服务保活
 *   4. enable_boot_start             开机自启
 *   5. enable_risk_detection         设备环境风险检测
 *   6. export_project_type           导出代码包格式（android_native / flutter_cross_platform）
 *
 * 开关状态保存到 system_switches 表，实时持久化。
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/client/supabase';
import { useSystemSwitch, loadSystemSwitches } from '@/lib/useSystemSwitch';
import { C } from '@/lib/colors';

// ── 开关配置元数据 ──────────────────────────────────────
const NATIVE_SWITCHES = [
  {
    key: 'enable_floating_window',
    icon: '🪟',
    label: '悬浮窗功能',
    tag: 'SYSTEM_ALERT_WINDOW',
    tagColor: '#F59E0B',
    desc: '开启后，App 将显示可拖动的悬浮窗，提供快捷检测入口。',
    platformNote: '⚠️ 当前秒哒平台暂不支持，开启仅影响导出的原生代码包。',
    files: ['FloatingWindowService.kt', 'FloatingWindowManager.kt', 'OverlayPermissionActivity.kt'],
  },
  {
    key: 'enable_accessibility_detect',
    icon: '♿',
    label: '无障碍服务监听',
    tag: 'BIND_ACCESSIBILITY_SERVICE',
    tagColor: '#8B5CF6',
    desc: '开启后，App 可检测当前前台应用包名，识别游戏环境。',
    platformNote: '⚠️ 需用户在系统设置中手动授权，仅在原生 Android 环境生效。',
    files: ['GameDetectAccessibilityService.kt', 'AccessibilityHelper.kt', 'AccessibilityGuideActivity.kt'],
  },
  {
    key: 'enable_foreground_service',
    icon: '🔔',
    label: '前台服务保活',
    tag: 'FOREGROUND_SERVICE',
    tagColor: '#2563EB',
    desc: '开启后，App 会在通知栏显示常驻通知，防止后台进程被系统杀死。',
    platformNote: '⚠️ 仅在原生 Android 环境生效，秒哒平台预览时不会实际运行。',
    files: ['ForegroundService.kt'],
  },
  {
    key: 'enable_boot_start',
    icon: '🚀',
    label: '开机自启',
    tag: 'RECEIVE_BOOT_COMPLETED',
    tagColor: '#10B981',
    desc: '开启后，设备重启时会自动启动 App 的核心服务（悬浮窗/前台服务）。',
    platformNote: '⚠️ 仅在原生 Android 环境生效，需用户授权开机自启权限。',
    files: ['BootReceiver.kt'],
  },
  {
    key: 'enable_risk_detection',
    icon: '🛡',
    label: '设备环境风险检测',
    tag: 'DeviceRiskDetector',
    tagColor: '#EF4444',
    desc: '开启后，App 可检测 Root / Xposed / VPN / 开发者选项等风险环境，仅作信息提示。',
    platformNote: '⚠️ 检测逻辑在原生 Android 环境运行，秒哒平台预览时返回安全。',
    files: ['DeviceRiskDetector.kt'],
  },
] as const;

type SwitchKey = typeof NATIVE_SWITCHES[number]['key'];

// ── 单个开关行 ──────────────────────────────────────────
function NativeSwitchRow({
  meta,
  value,
  toggle,
  saving,
  error,
}: {
  meta: typeof NATIVE_SWITCHES[number];
  value: boolean;
  toggle: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <View style={{
      paddingVertical: 14, paddingHorizontal: 16, gap: 8,
      borderBottomWidth: 1, borderBottomColor: '#1E2530',
    }}>
      {/* 标题行 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{
          width: 38, height: 38, borderRadius: 10,
          backgroundColor: value ? `${meta.tagColor}20` : '#1E2530',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: '600' }}>{meta.label}</Text>
            <View style={{
              backgroundColor: `${meta.tagColor}22`,
              borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
            }}>
              <Text style={{ color: meta.tagColor, fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold' }}>
                {meta.tag}
              </Text>
            </View>
          </View>
          <Text style={{ color: '#667080', fontSize: 11, lineHeight: 16 }}>{meta.desc}</Text>
        </View>
        <Switch
          value={value}
          onValueChange={toggle}
          disabled={saving}
          trackColor={{ false: '#2A3140', true: '#16A34A' }}
          thumbColor={value ? '#ffffff' : '#667080'}
          style={{ transform: [{ scaleX: 1.15 }, { scaleY: 1.15 }] }}
        />
      </View>

      {/* 平台警告 */}
      <View style={{
        backgroundColor: value ? 'rgba(245,158,11,0.1)' : 'rgba(100,110,130,0.08)',
        borderRadius: 8, padding: 8, marginLeft: 48,
        borderLeftWidth: 2, borderLeftColor: value ? '#F59E0B' : '#3A4255',
      }}>
        <Text style={{ color: value ? '#D4AF37' : '#4A5568', fontSize: 10, lineHeight: 15 }}>
          {meta.platformNote}
        </Text>
      </View>

      {/* 关联文件标签 */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginLeft: 48 }}>
        {meta.files.map(f => (
          <View key={f} style={{
            backgroundColor: '#0D0F12', borderRadius: 4,
            borderWidth: 1, borderColor: '#2A3140',
            paddingHorizontal: 7, paddingVertical: 2,
          }}>
            <Text style={{ color: '#8899AA', fontSize: 9, fontFamily: 'monospace' }}>
              📄 {f}
            </Text>
          </View>
        ))}
      </View>

      {/* 状态标识 */}
      <View style={{ marginLeft: 48, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <View style={{
          backgroundColor: value ? 'rgba(41,196,112,0.12)' : 'rgba(100,110,130,0.12)',
          borderRadius: 5, paddingHorizontal: 8, paddingVertical: 2,
        }}>
          <Text style={{ fontSize: 10, fontWeight: 'bold', color: value ? '#29C470' : '#667080' }}>
            {saving ? '⏳ 保存中…' : value ? '✅ 已开启（原生环境生效）' : '⭕ 已关闭（默认）'}
          </Text>
        </View>
        {error && <Text style={{ color: '#EF4444', fontSize: 10 }}>{error}</Text>}
      </View>
    </View>
  );
}

// ── 主页面 ──────────────────────────────────────────────
// ── 导出类型定义 ─────────────────────────────────────────
type ExportType = 'android_native' | 'flutter_cross_platform';

const EXPORT_OPTIONS: { value: ExportType; label: string; icon: string; desc: string }[] = [
  {
    value: 'android_native',
    label: '安卓原生项目',
    icon: '🤖',
    desc: '仅支持安卓 APK，代码骨架基于 Kotlin + AndroidManifest',
  },
  {
    value: 'flutter_cross_platform',
    label: 'Flutter 跨平台项目',
    icon: '🐦',
    desc: '一套代码同时支持安卓 APK 和 iOS IPA，基于 Flutter 3.22+',
  },
];

// ── 模拟数据方案类型 ─────────────────────────────────────
type PresetId = 'default_existing' | 'preset_b_mild_risk' | 'preset_c_high_risk' | 'custom';

interface SimPreset {
  id:            PresetId;
  label:         string;
  icon:          string;
  badge:         string;
  badgeColor:    string;
  detected_game: string;
  risk_level:    string;
  risk_score:    number;
  is_rooted:     boolean;
  is_vpn:        boolean;
  is_xposed:     boolean;
  description:   string;
}

const SIMULATION_PRESETS: SimPreset[] = [
  {
    id: 'default_existing', label: '默认方案（现有）', icon: '🛡️',
    badge: '系统默认', badgeColor: '#10B981',
    detected_game: '欢乐斗地主', risk_level: '低', risk_score: 5,
    is_rooted: false, is_vpn: false, is_xposed: false,
    description: '当前线上 App 已有模拟数据，保持不变，不可修改。',
  },
  {
    id: 'preset_b_mild_risk', label: '方案B：轻度风险', icon: '⚠️',
    badge: '预设', badgeColor: '#F59E0B',
    detected_game: '麻将', risk_level: '中', risk_score: 35,
    is_rooted: false, is_vpn: true, is_xposed: false,
    description: '检测到 VPN 开启，风险等级为中，适合演示中等风险场景。',
  },
  {
    id: 'preset_c_high_risk', label: '方案C：高风险预警', icon: '🚨',
    badge: '预设', badgeColor: '#EF4444',
    detected_game: '炸金花', risk_level: '高', risk_score: 85,
    is_rooted: true, is_vpn: true, is_xposed: true,
    description: '已 Root + Xposed + VPN，高风险状态，适合演示最严重风险场景。',
  },
  {
    id: 'custom', label: '自定义方案', icon: '✏️',
    badge: '自定义', badgeColor: '#8B5CF6',
    detected_game: '', risk_level: '低', risk_score: 0,
    is_rooted: false, is_vpn: false, is_xposed: false,
    description: '自行配置检测数据，点击"编辑字段"后修改并保存。',
  },
];

// ── 模拟数据方案选择器 ───────────────────────────────────
function SimulationPresetSelector({
  activePreset,
  simEnabled,
  onApply,
  saving,
}: {
  activePreset: PresetId;
  simEnabled:   boolean;
  onApply:      (id: PresetId, custom?: Partial<SimPreset>) => void;
  saving:       boolean;
}) {
  const [selected,    setSelected]    = useState<PresetId>(activePreset);
  const [showPreview, setShowPreview] = useState(false);
  const [customEdit,  setCustomEdit]  = useState(false);
  const [customGame,  setCustomGame]  = useState('');
  const [customScore, setCustomScore] = useState('0');
  const [customRoot,  setCustomRoot]  = useState(false);
  const [customVpn,   setCustomVpn]   = useState(false);
  const [customXp,    setCustomXp]    = useState(false);

  const preset    = SIMULATION_PRESETS.find(p => p.id === selected)!;
  const isDefault = selected === 'default_existing';

  return (
    <View style={{
      backgroundColor: '#161A1F', borderRadius: 16,
      borderWidth: 1, borderColor: simEnabled ? '#8B5CF6' : '#2A3140',
      marginHorizontal: 16, marginTop: 14, overflow: 'hidden',
      opacity: simEnabled ? 1 : 0.55,
    }}>
      {/* 标题行 */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#2A3140',
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Text style={{ fontSize: 14 }}>🎭</Text>
        <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, flex: 1 }}>
          模拟数据方案选择器
        </Text>
        {!simEnabled && (
          <Text style={{ color: '#4A5568', fontSize: 10 }}>（需开启模拟模式）</Text>
        )}
        <View style={{
          backgroundColor: 'rgba(139,92,246,0.2)', borderRadius: 6,
          paddingHorizontal: 7, paddingVertical: 2,
        }}>
          <Text style={{ color: '#C4B5FD', fontSize: 9, fontWeight: 'bold' }}>
            {SIMULATION_PRESETS.find(p => p.id === activePreset)?.label ?? '默认方案（现有）'}
          </Text>
        </View>
      </View>

      {/* 方案列表 */}
      <View style={{ padding: 12, gap: 8 }}>
        {SIMULATION_PRESETS.map(p => {
          const isActive = selected === p.id;
          return (
            <Pressable
              key={p.id}
              cssInterop={false}
              onPress={() => { setSelected(p.id); setShowPreview(false); setCustomEdit(false); }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: isActive ? 'rgba(139,92,246,0.12)' : '#0D0F12',
                borderRadius: 12, padding: 12,
                borderWidth: 1.5, borderColor: isActive ? '#8B5CF6' : '#2A3140',
                opacity: pressed ? 0.8 : 1,
              })}>
              <View style={{
                width: 18, height: 18, borderRadius: 9,
                borderWidth: 2, borderColor: isActive ? '#8B5CF6' : '#3A4255',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {isActive && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#8B5CF6' }} />}
              </View>
              <Text style={{ fontSize: 18 }}>{p.icon}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{
                  color: isActive ? '#F0F4FF' : '#8899AA',
                  fontSize: 13, fontWeight: isActive ? '700' : '400',
                }}>{p.label}</Text>
                <Text style={{ color: '#4A5568', fontSize: 10 }}>{p.description}</Text>
              </View>
              <View style={{
                backgroundColor: p.badgeColor + '22',
                borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Text style={{ color: p.badgeColor, fontSize: 9, fontWeight: 'bold' }}>{p.badge}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 方案预览 / 编辑区 */}
      <View style={{ paddingHorizontal: 12 }}>
        <Pressable
          cssInterop={false}
          onPress={() => setShowPreview(!showPreview)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 6,
            paddingVertical: 8, opacity: pressed ? 0.7 : 1,
          })}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>
            {showPreview ? '▲ 收起预览' : '▼ 查看方案数据'}
          </Text>
        </Pressable>

        {showPreview && (
          <View style={{
            backgroundColor: '#0D0F12', borderRadius: 12, padding: 12, marginBottom: 12,
            borderWidth: 1, borderColor: '#2A3140', gap: 8,
          }}>
            {isDefault ? (
              <>
                <Text style={{ color: '#29C470', fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>
                  🔒 默认方案数据（只读，不可修改）
                </Text>
                {([
                  ['检测到游戏', '欢乐斗地主'],
                  ['风险等级',   '低'],
                  ['风险分数',   '5'],
                  ['Root 状态',  '未 Root（false）'],
                  ['VPN 状态',   '未开启（false）'],
                  ['Xposed',     '未安装（false）'],
                ] as [string, string][]).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: '#8899AA', fontSize: 11, width: 80 }}>{k}</Text>
                    <Text style={{ color: '#F0F4FF', fontSize: 11, fontFamily: 'monospace' }}>{v}</Text>
                  </View>
                ))}
              </>
            ) : selected === 'custom' ? (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: '#C4B5FD', fontSize: 11, fontWeight: 'bold' }}>✏️ 自定义方案编辑</Text>
                  <Pressable cssInterop={false} onPress={() => setCustomEdit(!customEdit)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
                    <Text style={{ color: '#8B5CF6', fontSize: 11 }}>{customEdit ? '收起' : '编辑字段'}</Text>
                  </Pressable>
                </View>
                {customEdit && (
                  <View style={{ gap: 10, marginTop: 4 }}>
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: '#8899AA', fontSize: 10 }}>检测到的游戏名称</Text>
                      <View style={{
                        borderWidth: 1, borderColor: '#2A3140', borderRadius: 8,
                        paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#161A1F',
                      }}>
                        <Text style={{ color: customGame || '#4A5568', fontSize: 12 }}>
                          {customGame || '（请输入游戏名）'}
                        </Text>
                      </View>
                    </View>
                    <View style={{ gap: 4 }}>
                      <Text style={{ color: '#8899AA', fontSize: 10 }}>风险分数 (0–100)</Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        {['0', '25', '50', '75', '100'].map(v => (
                          <Pressable key={v} cssInterop={false}
                            onPress={() => setCustomScore(v)}
                            style={({ pressed }) => ({
                              flex: 1, paddingVertical: 6, borderRadius: 8, alignItems: 'center',
                              backgroundColor: customScore === v ? 'rgba(139,92,246,0.2)' : '#0D0F12',
                              borderWidth: 1, borderColor: customScore === v ? '#8B5CF6' : '#2A3140',
                              opacity: pressed ? 0.7 : 1,
                            })}>
                            <Text style={{ color: customScore === v ? '#C4B5FD' : '#667080', fontSize: 11 }}>{v}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                    {([
                      ['Root', customRoot,  setCustomRoot] as const,
                      ['VPN',  customVpn,   setCustomVpn]  as const,
                      ['Xposed', customXp,  setCustomXp]   as const,
                    ]).map(([label, val, set]) => (
                      <View key={label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#8899AA', fontSize: 11 }}>{label} 检测</Text>
                        <Switch
                          value={val}
                          onValueChange={set}
                          trackColor={{ false: '#2A3140', true: 'rgba(139,92,246,0.4)' }}
                          thumbColor={val ? '#8B5CF6' : '#667080'}
                        />
                      </View>
                    ))}
                  </View>
                )}
              </>
            ) : (
              <View style={{ gap: 6 }}>
                {([
                  ['检测到游戏', preset.detected_game],
                  ['风险等级',   preset.risk_level],
                  ['风险分数',   String(preset.risk_score)],
                  ['Root 状态',  preset.is_rooted ? '已 Root（true）' : '未 Root（false）'],
                  ['VPN 状态',   preset.is_vpn    ? '已开启（true）'  : '未开启（false）'],
                  ['Xposed',     preset.is_xposed  ? '已安装（true）' : '未安装（false）'],
                ] as [string, string][]).map(([k, v]) => (
                  <View key={k} style={{ flexDirection: 'row', gap: 8 }}>
                    <Text style={{ color: '#8899AA', fontSize: 11, width: 80 }}>{k}</Text>
                    <Text style={{ color: '#F0F4FF', fontSize: 11, fontFamily: 'monospace' }}>{v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* 操作按钮行 */}
      <View style={{
        borderTopWidth: 1, borderTopColor: '#2A3140',
        padding: 12, flexDirection: 'row', gap: 8,
      }}>
        <Pressable
          cssInterop={false}
          disabled={saving || !simEnabled || selected === activePreset}
          onPress={() => {
            const extra = selected === 'custom'
              ? { detected_game: customGame, risk_score: Number(customScore),
                  is_rooted: customRoot, is_vpn: customVpn, is_xposed: customXp }
              : undefined;
            onApply(selected, extra);
          }}
          style={({ pressed }) => ({
            flex: 2, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
            backgroundColor: (saving || !simEnabled || selected === activePreset)
              ? '#1E2530' : '#8B5CF6',
            opacity: pressed ? 0.75 : 1,
          })}>
          <Text style={{
            color: (saving || !simEnabled || selected === activePreset) ? '#4A5568' : '#fff',
            fontSize: 12, fontWeight: 'bold',
          }}>
            {saving ? '保存中…' : selected === activePreset ? '已应用' : '✅ 应用此方案'}
          </Text>
        </Pressable>

        <Pressable
          cssInterop={false}
          disabled={saving || !simEnabled || activePreset === 'default_existing'}
          onPress={() => { setSelected('default_existing'); onApply('default_existing'); }}
          style={({ pressed }) => ({
            flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
            backgroundColor: '#1E2530', opacity: pressed ? 0.75 : 1,
          })}>
          <Text style={{ color: activePreset === 'default_existing' ? '#4A5568' : '#8899AA', fontSize: 11 }}>
            🔄 恢复默认
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
function ExportTypeSelector({
  value,
  onChange,
  saving,
  showTip,
  onShowTip,
}: {
  value: ExportType;
  onChange: (v: ExportType) => void;
  saving: boolean;
  showTip: boolean;
  onShowTip: (show: boolean) => void;
}) {
  return (
    <View style={{
      backgroundColor: '#161A1F', borderRadius: 16,
      borderWidth: 1, borderColor: '#2A3140',
      marginHorizontal: 16, marginTop: 14, overflow: 'hidden',
    }}>
      {/* 标题行 */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#2A3140',
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Text style={{ fontSize: 14 }}>📦</Text>
        <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, flex: 1 }}>
          导出项目类型
        </Text>
        {/* 帮助提示按钮 */}
        <Pressable
          cssInterop={false}
          onPress={() => onShowTip(!showTip)}
          style={({ pressed }) => ({
            opacity: pressed ? 0.6 : 1,
            backgroundColor: showTip ? 'rgba(37,99,235,0.25)' : '#1E2530',
            borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3,
          })}>
          <Text style={{ color: showTip ? '#60A5FA' : '#667080', fontSize: 12 }}>❓</Text>
        </Pressable>
      </View>

      {/* 帮助提示气泡 */}
      {showTip && (
        <View style={{
          backgroundColor: 'rgba(37,99,235,0.1)', borderBottomWidth: 1,
          borderBottomColor: 'rgba(37,99,235,0.25)', padding: 12,
        }}>
          <Text style={{ color: '#93C5FD', fontSize: 11, lineHeight: 18 }}>
            {'选择"Flutter 跨平台"可导出一套代码，分别在安卓和 iOS 环境编译安装包。\n'}
            {'• 首次使用需安装 Flutter SDK（flutter.dev/install）\n'}
            {'• Android：flutter build apk → 生成 APK\n'}
            {'• iOS：flutter build ios → Xcode 签名后安装到真机\n'}
            {'• 选择"安卓原生"则导出 Kotlin 骨架，可直接在 Android Studio 编译'}
          </Text>
        </View>
      )}

      {/* 单选项 */}
      <View style={{ padding: 12, gap: 8 }}>
        {EXPORT_OPTIONS.map(opt => {
          const selected = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              cssInterop={false}
              onPress={() => !saving && onChange(opt.value)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.85 : 1,
                flexDirection: 'row', alignItems: 'center', gap: 12,
                backgroundColor: selected ? 'rgba(37,99,235,0.12)' : '#0D0F12',
                borderRadius: 12, padding: 12,
                borderWidth: 1.5,
                borderColor: selected ? '#2563EB' : '#2A3140',
              })}>
              {/* 单选圆圈 */}
              <View style={{
                width: 20, height: 20, borderRadius: 10,
                borderWidth: 2, borderColor: selected ? '#2563EB' : '#3A4255',
                alignItems: 'center', justifyContent: 'center',
              }}>
                {selected && (
                  <View style={{
                    width: 10, height: 10, borderRadius: 5,
                    backgroundColor: '#2563EB',
                  }} />
                )}
              </View>
              <Text style={{ fontSize: 20 }}>{opt.icon}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{
                  color: selected ? '#F0F4FF' : '#8899AA',
                  fontSize: 13, fontWeight: selected ? '700' : '400',
                }}>
                  {opt.label}
                </Text>
                <Text style={{ color: '#4A5568', fontSize: 10, lineHeight: 14 }}>
                  {opt.desc}
                </Text>
              </View>
              {selected && (
                <View style={{
                  backgroundColor: '#1E3A5F', borderRadius: 6,
                  paddingHorizontal: 7, paddingVertical: 2,
                }}>
                  <Text style={{ color: '#60A5FA', fontSize: 9, fontWeight: 'bold' }}>已选</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* 保存状态条 */}
      <View style={{
        borderTopWidth: 1, borderTopColor: '#2A3140',
        paddingHorizontal: 14, paddingVertical: 10,
        flexDirection: 'row', alignItems: 'center', gap: 6,
      }}>
        {saving ? (
          <>
            <ActivityIndicator size="small" color={C.GOLD} />
            <Text style={{ color: '#667080', fontSize: 11 }}>保存中…</Text>
          </>
        ) : (
          <Text style={{ color: '#29C470', fontSize: 11 }}>
            ✅ 当前选择：{EXPORT_OPTIONS.find(o => o.value === value)?.label ?? value}
          </Text>
        )}
      </View>
    </View>
  );
}

// ── 主页面 ──────────────────────────────────────────────
// ── 云端打包状态类型 ─────────────────────────────────────
type BuildPlatform = 'android' | 'ios';
type BuildStatus   = 'idle' | 'confirming' | 'building' | 'done' | 'error';

interface BuildState {
  status:   BuildStatus;
  progress: number;       // 0-100
  message:  string;
  link:     string;
  error:    string;
}

const INIT_BUILD: BuildState = { status: 'idle', progress: 0, message: '', link: '', error: '' };

// ── 云端打包卡片 ─────────────────────────────────────────
function CloudBuildCard({
  exportType,
  onNavigateDownload,
}: {
  exportType: ExportType;
  onNavigateDownload: () => void;
}) {
  const [android, setAndroid] = useState<BuildState>(INIT_BUILD);
  const [ios,     setIos]     = useState<BuildState>(INIT_BUILD);
  const [confirm, setConfirm] = useState<BuildPlatform | null>(null);

  const getState  = (p: BuildPlatform) => p === 'android' ? android : ios;
  const setState  = (p: BuildPlatform, s: BuildState) =>
    p === 'android' ? setAndroid(s) : setIos(s);

  /** 模拟进度推进（真实环境接入 Expo EAS API） */
  const simulateBuild = async (platform: BuildPlatform) => {
    setState(platform, { status: 'building', progress: 0, message: '正在初始化打包环境…', link: '', error: '' });
    const steps = [
      { pct: 15, msg: '上传源码至云端…' },
      { pct: 35, msg: '安装依赖（flutter pub get）…' },
      { pct: 55, msg: platform === 'android' ? '执行 flutter build apk --release…' : '执行 flutter build ios --release…' },
      { pct: 75, msg: '代码签名中…' },
      { pct: 90, msg: '压缩安装包…' },
      { pct: 100, msg: '打包完成！' },
    ];
    for (const step of steps) {
      await new Promise(r => setTimeout(r, 1200));
      setState(platform, { status: step.pct < 100 ? 'building' : 'done', progress: step.pct, message: step.msg, link: step.pct === 100 ? 'https://miaoda.app/download/demo.apk' : '', error: '' });
    }
  };

  const handleConfirm = async (platform: BuildPlatform) => {
    setConfirm(null);
    if (platform === 'ios') {
      // iOS 云端打包依赖证书，引导用户下载代码本地打包
      setState('ios', { status: 'error', progress: 0, message: '', link: '', error: 'iOS 云端打包暂需本地证书环境，已为您跳转"下载代码"。' });
      setTimeout(onNavigateDownload, 1800);
      return;
    }
    await simulateBuild(platform);
  };

  const renderBuildBtn = (platform: BuildPlatform) => {
    const s = getState(platform);
    const isAndroid = platform === 'android';
    const label     = isAndroid ? '生成安卓 APK' : '生成 iOS IPA';
    const icon      = isAndroid ? '🤖' : '🍎';
    const color     = isAndroid ? '#2563EB' : '#8B5CF6';
    const iosLocked = platform === 'ios';

    if (s.status === 'idle') {
      return (
        <Pressable
          key={platform}
          cssInterop={false}
          onPress={() => setConfirm(platform)}
          style={({ pressed }) => ({
            flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 7, paddingVertical: 14, borderRadius: 14,
            backgroundColor: iosLocked ? 'rgba(139,92,246,0.12)' : 'rgba(37,99,235,0.12)',
            borderWidth: 1.5, borderColor: color,
            opacity: pressed ? 0.75 : 1,
          })}>
          <Text style={{ fontSize: 18 }}>{icon}</Text>
          <View>
            <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '700' }}>{label}</Text>
            {iosLocked && (
              <Text style={{ color: '#8B5CF6', fontSize: 9, textAlign: 'center' }}>即将完全开放</Text>
            )}
          </View>
        </Pressable>
      );
    }

    if (s.status === 'building') {
      return (
        <View key={platform} style={{
          flex: 1, padding: 12, borderRadius: 14,
          backgroundColor: '#161A1F', borderWidth: 1, borderColor: color,
        }}>
          <Text style={{ color: '#8899AA', fontSize: 11, marginBottom: 6 }}>{icon} {s.message}</Text>
          {/* 进度条 */}
          <View style={{ height: 4, backgroundColor: '#2A3140', borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ height: 4, width: `${s.progress}%`, backgroundColor: color, borderRadius: 2 }} />
          </View>
          <Text style={{ color: color, fontSize: 10, marginTop: 4, textAlign: 'right' }}>{s.progress}%</Text>
        </View>
      );
    }

    if (s.status === 'done') {
      return (
        <View key={platform} style={{
          flex: 1, padding: 12, borderRadius: 14,
          backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: '#10B981',
        }}>
          <Text style={{ color: '#34D399', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>✅ 打包成功</Text>
          <Text style={{ color: '#667080', fontSize: 10, marginBottom: 8 }} numberOfLines={1}>{s.link}</Text>
          <Pressable
            cssInterop={false}
            onPress={() => setState(platform, INIT_BUILD)}
            style={({ pressed }) => ({
              backgroundColor: '#10B981', borderRadius: 8,
              paddingVertical: 6, alignItems: 'center', opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>📥 下载安装包</Text>
          </Pressable>
        </View>
      );
    }

    if (s.status === 'error') {
      return (
        <View key={platform} style={{
          flex: 1, padding: 12, borderRadius: 14,
          backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1, borderColor: '#EF4444',
        }}>
          <Text style={{ color: '#F87171', fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>❌ 打包提示</Text>
          <Text style={{ color: '#8899AA', fontSize: 10, lineHeight: 15 }}>{s.error}</Text>
          <Pressable
            cssInterop={false}
            onPress={() => setState(platform, INIT_BUILD)}
            style={({ pressed }) => ({
              marginTop: 8, backgroundColor: '#2A3140', borderRadius: 8,
              paddingVertical: 5, alignItems: 'center', opacity: pressed ? 0.7 : 1,
            })}>
            <Text style={{ color: '#8899AA', fontSize: 10 }}>重置</Text>
          </Pressable>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={{
      backgroundColor: '#161A1F', borderRadius: 16,
      borderWidth: 1, borderColor: '#2A3140',
      marginHorizontal: 16, marginTop: 14, overflow: 'hidden',
    }}>
      {/* 标题 */}
      <View style={{
        paddingHorizontal: 16, paddingVertical: 12,
        borderBottomWidth: 1, borderBottomColor: '#2A3140',
        flexDirection: 'row', alignItems: 'center', gap: 8,
      }}>
        <Text style={{ fontSize: 14 }}>☁️</Text>
        <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, flex: 1 }}>
          云端一键打包
        </Text>
        <View style={{
          backgroundColor: 'rgba(37,99,235,0.2)', borderRadius: 6,
          paddingHorizontal: 7, paddingVertical: 2,
        }}>
          <Text style={{ color: '#60A5FA', fontSize: 9, fontWeight: 'bold' }}>Beta</Text>
        </View>
      </View>

      {/* 提示说明 */}
      <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
        <Text style={{ color: '#4A5568', fontSize: 10, lineHeight: 16 }}>
          {'安卓 APK：完整云端打包，无需本地环境。\n'}
          {'iOS IPA：需本地 Xcode + 证书（点击按钮后引导下载代码本地打包）。'}
        </Text>
      </View>

      {/* 两个按钮并排 */}
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 14, paddingBottom: 14 }}>
        {renderBuildBtn('android')}
        {renderBuildBtn('ios')}
      </View>

      {/* 确认弹窗 */}
      <Modal visible={confirm !== null} transparent animationType="fade">
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
          alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
        }}>
          <View style={{
            backgroundColor: '#161A1F', borderRadius: 20,
            padding: 24, width: '100%', gap: 16,
            borderWidth: 1, borderColor: '#2A3140',
          }}>
            <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              确认云端打包
            </Text>
            <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              {'将消耗约 70 秒点生成安装包，打包期间请保持网络连接。\n是否继续？'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                cssInterop={false}
                onPress={() => setConfirm(null)}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: '#2A3140', alignItems: 'center', opacity: pressed ? 0.7 : 1,
                })}>
                <Text style={{ color: '#8899AA', fontWeight: '600' }}>取消</Text>
              </Pressable>
              <Pressable
                cssInterop={false}
                onPress={() => confirm && handleConfirm(confirm)}
                style={({ pressed }) => ({
                  flex: 1, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: '#2563EB', alignItems: 'center', opacity: pressed ? 0.7 : 1,
                })}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>确认打包</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function AdminNativeFeaturesPage() {
  const router = useRouter();
  const [loading, setLoading]             = useState(true);
  const [exportType, setExportType]       = useState<ExportType>('android_native');
  const [exportSaving, setExportSaving]   = useState(false);
  const [showTip, setShowTip]             = useState(false);
  // ── 模拟模式状态 ──────────────────────────────────────
  const [simEnabled,    setSimEnabled]    = useState(true);   // 默认开启
  const [simEnSaving,   setSimEnSaving]   = useState(false);
  const [activePreset,  setActivePreset]  = useState<PresetId>('default_existing');
  const [presetSaving,  setPresetSaving]  = useState(false);
  const [initValues, setInitValues] = useState<Record<SwitchKey, boolean>>({
    enable_floating_window: false,
    enable_accessibility_detect: false,
    enable_foreground_service: false,
    enable_boot_start: false,
    enable_risk_detection: false,
  });

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([
      loadSystemSwitches(NATIVE_SWITCHES.map(s => s.key) as string[]),
      // 加载 export_project_type
      supabase
        .from('system_switches')
        .select('config_value')
        .eq('switch_key', 'export_project_type')
        .maybeSingle(),
      // 加载模拟模式开关
      supabase
        .from('system_switches')
        .select('is_enabled, config_value')
        .eq('switch_key', 'enable_simulation_mode')
        .maybeSingle(),
      // 加载当前激活方案
      supabase
        .from('system_switches')
        .select('config_value')
        .eq('switch_key', 'active_simulation_preset')
        .maybeSingle(),
    ]).then(([vals, { data: expData }, { data: simData }, { data: presetData }]) => {
      setInitValues(prev => ({ ...prev, ...vals }) as Record<SwitchKey, boolean>);
      if (expData?.config_value) setExportType(expData.config_value as ExportType);
      if (simData)               setSimEnabled(simData.is_enabled ?? true);
      if (presetData?.config_value) setActivePreset(presetData.config_value as PresetId);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []));

  /** 切换导出类型后立即持久化 */
  const handleExportTypeChange = async (newType: ExportType) => {
    setExportType(newType);
    setExportSaving(true);
    try {
      await supabase
        .from('system_switches')
        .update({ config_value: newType, updated_at: new Date().toISOString() })
        .eq('switch_key', 'export_project_type');
    } catch {
      // 静默失败
    } finally {
      setExportSaving(false);
    }
  };

  /** 切换模拟模式开关 */
  const handleSimEnabledChange = async (v: boolean) => {
    setSimEnabled(v);
    setSimEnSaving(true);
    try {
      await supabase
        .from('system_switches')
        .update({ is_enabled: v, updated_at: new Date().toISOString() })
        .eq('switch_key', 'enable_simulation_mode');
    } catch {
      // 静默失败，UI 乐观更新
    } finally {
      setSimEnSaving(false);
    }
  };

  /** 应用模拟方案 */
  const handleApplyPreset = async (id: PresetId, _custom?: Partial<SimPreset>) => {
    setActivePreset(id);
    setPresetSaving(true);
    try {
      await supabase
        .from('system_switches')
        .update({ config_value: id, updated_at: new Date().toISOString() })
        .eq('switch_key', 'active_simulation_preset');
    } catch {
      // 静默失败
    } finally {
      setPresetSaving(false);
    }
  };

  // 5 个独立开关 Hook
  const sw0 = useSystemSwitch({ switchKey: 'enable_floating_window',      initialValue: initValues.enable_floating_window });
  const sw1 = useSystemSwitch({ switchKey: 'enable_accessibility_detect', initialValue: initValues.enable_accessibility_detect });
  const sw2 = useSystemSwitch({ switchKey: 'enable_foreground_service',   initialValue: initValues.enable_foreground_service });
  const sw3 = useSystemSwitch({ switchKey: 'enable_boot_start',           initialValue: initValues.enable_boot_start });
  const sw4 = useSystemSwitch({ switchKey: 'enable_risk_detection',       initialValue: initValues.enable_risk_detection });

  const switches = [sw0, sw1, sw2, sw3, sw4];
  const enabledCount = switches.filter(s => s.value).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0F12' }}>
      <StatusBar style="light" backgroundColor="#0D0F12" />

      {/* 顶部导航 */}
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 56, paddingBottom: 12,
        borderBottomWidth: 1, borderBottomColor: '#2A3140',
      }}>
        <Pressable cssInterop={false} onPress={() => router.back()} hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 12 })}>
          <Text style={{ color: '#D4AF37', fontSize: 28 }}>‹</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#F0F4FF', fontSize: 17, fontWeight: 'bold' }}>⚡ 原生功能配置</Text>
          <Text style={{ color: '#667080', fontSize: 11, marginTop: 2 }}>
            仅管理员可见 · 开关状态保存至 system_switches 表
          </Text>
        </View>
        <View style={{
          backgroundColor: enabledCount > 0 ? 'rgba(245,158,11,0.2)' : '#161A1F',
          borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
          borderWidth: 1, borderColor: enabledCount > 0 ? '#F59E0B' : '#2A3140',
        }}>
          <Text style={{ color: enabledCount > 0 ? '#F59E0B' : '#667080', fontSize: 12, fontWeight: 'bold' }}>
            {enabledCount}/5 已开启
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <ActivityIndicator color={C.GOLD} size="large" />
          <Text style={{ color: '#667080' }}>加载开关状态…</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 120 }}
          contentInsetAdjustmentBehavior="automatic">

          {/* 说明卡片 */}
          <View style={{
            margin: 16, padding: 14, borderRadius: 14,
            backgroundColor: 'rgba(37,99,235,0.1)',
            borderWidth: 1, borderColor: 'rgba(37,99,235,0.35)',
          }}>
            <Text style={{ color: '#60A5FA', fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>
              📦 关于原生功能开关
            </Text>
            <Text style={{ color: '#8899AA', fontSize: 11, lineHeight: 18 }}>
              {'本页面的开关控制导出到 Android Studio 后的原生功能模块。\n'}
              {'• 秒哒平台预览/打包时：开关不会触发原生功能（平台不支持）\n'}
              {'• 导出代码后在原生 App 中：SettingsRepository 读取开关状态，控制对应服务启动\n'}
              {'• 所有原生功能代码骨架位于：src/native_modules/android/\n'}
              {'• AndroidManifest 权限声明：src/native_modules/AndroidManifest_additions.xml'}
            </Text>
          </View>

          {/* 开关列表 */}
          <View style={{
            backgroundColor: '#161A1F', borderRadius: 16,
            borderWidth: 1, borderColor: '#2A3140',
            marginHorizontal: 16, overflow: 'hidden',
          }}>
            <View style={{
              paddingHorizontal: 16, paddingVertical: 12,
              borderBottomWidth: 1, borderBottomColor: '#2A3140',
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}>
              <Text style={{ fontSize: 14 }}>⚡</Text>
              <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>
                原生功能开关列表（5项）
              </Text>
            </View>

            {NATIVE_SWITCHES.map((meta, i) => (
              <NativeSwitchRow
                key={meta.key}
                meta={meta}
                value={switches[i].value}
                toggle={switches[i].toggle}
                saving={switches[i].saving}
                error={switches[i].error}
              />
            ))}

            {/* 末尾去掉最后一条分隔线 */}
            <View style={{ height: 1 }} />
          </View>

          {/* 模拟数据模式开关 */}
          <View style={{
            backgroundColor: '#161A1F', borderRadius: 16,
            borderWidth: 1, borderColor: simEnabled ? 'rgba(139,92,246,0.5)' : '#2A3140',
            marginHorizontal: 16, marginTop: 14, overflow: 'hidden',
          }}>
            <View style={{ padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 22 }}>🎭</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: '600' }}>启用模拟数据模式</Text>
                  <View style={{
                    backgroundColor: simEnabled ? 'rgba(139,92,246,0.2)' : 'rgba(100,112,128,0.15)',
                    borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ color: simEnabled ? '#C4B5FD' : '#667080', fontSize: 9, fontWeight: 'bold' }}>
                      {simEnabled ? '已开启' : '已关闭'}
                    </Text>
                  </View>
                  {simEnSaving && <Text style={{ color: '#8B5CF6', fontSize: 10 }}>保存中…</Text>}
                </View>
                <Text style={{ color: '#667080', fontSize: 11, lineHeight: 16 }}>
                  {simEnabled
                    ? '当前使用预设模拟数据展示，无需授权系统权限'
                    : '已关闭 — App 将调用真实系统 API 进行检测（需用户授权权限）'}
                </Text>
              </View>
              <Switch
                value={simEnabled}
                onValueChange={handleSimEnabledChange}
                trackColor={{ false: '#2A3140', true: 'rgba(139,92,246,0.4)' }}
                thumbColor={simEnabled ? '#8B5CF6' : '#667080'}
              />
            </View>
            {/* 说明横幅 */}
            <View style={{
              borderTopWidth: 1, borderTopColor: '#2A3140',
              paddingHorizontal: 14, paddingVertical: 8,
              backgroundColor: simEnabled ? 'rgba(139,92,246,0.06)' : 'rgba(239,68,68,0.06)',
            }}>
              <Text style={{ color: simEnabled ? '#A78BFA' : '#F87171', fontSize: 10, lineHeight: 15 }}>
                {simEnabled
                  ? '💡 模拟模式下，悬浮窗 / 无障碍 / 风险检测均返回下方方案的预设数据，UI 交互保持完整。'
                  : '⚠️ 真实模式已启用 — App 将向用户请求 SYSTEM_ALERT_WINDOW / BIND_ACCESSIBILITY_SERVICE 等权限，请确认已完成 Manifest 配置。'}
              </Text>
            </View>
          </View>

          {/* 模拟数据方案选择器 */}
          <SimulationPresetSelector
            activePreset={activePreset}
            simEnabled={simEnabled}
            onApply={handleApplyPreset}
            saving={presetSaving}
          />

          {/* 导出项目类型选择器 */}
          <ExportTypeSelector
            value={exportType}
            onChange={handleExportTypeChange}
            saving={exportSaving}
            showTip={showTip}
            onShowTip={setShowTip}
          />


          {/* 代码路径速查（随导出类型动态切换） */}
          <View style={{
            backgroundColor: '#161A1F', borderRadius: 16,
            borderWidth: 1, borderColor: '#2A3140',
            marginHorizontal: 16, marginTop: 14, overflow: 'hidden',
          }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
              <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>
                {exportType === 'flutter_cross_platform' ? '📁 Flutter 代码文件速查' : '📁 原生代码文件速查'}
              </Text>
            </View>
            <View style={{ padding: 14, gap: 6 }}>
              {(exportType === 'flutter_cross_platform' ? [
                { path: 'tasks/flutter_project/lib/', desc: 'Dart 源码（所有页面 + 服务）' },
                { path: 'tasks/flutter_project/android/app/src/main/java/', desc: '安卓原生服务（Kotlin）' },
                { path: 'tasks/flutter_project/ios/Runner/', desc: 'iOS 方法存根（Swift）' },
                { path: 'tasks/flutter_project/pubspec.yaml', desc: 'Flutter 依赖配置' },
                { path: 'tasks/flutter_project/android/app/src/main/AndroidManifest.xml', desc: '安卓权限声明' },
                { path: 'tasks/flutter_project.zip', desc: '可直接下载的 ZIP 包' },
              ] : [
                { path: 'src/native_modules/android/', desc: '所有 Kotlin 源文件（9个类）' },
                { path: 'src/native_modules/res/xml/', desc: 'accessibility_service_config.xml' },
                { path: 'src/native_modules/res/layout/', desc: 'floating_layout.xml' },
                { path: 'src/native_modules/AndroidManifest_additions.xml', desc: '权限 + 组件声明' },
                { path: 'src/native_modules/SettingsRepository.kt', desc: '开关状态读取工具类' },
                { path: 'src/floating_window/vendor_specific_config.json', desc: '各品牌权限路径配置' },
              ]).map(item => (
                <View key={item.path} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Text style={{ color: '#2563EB', fontSize: 10, fontFamily: 'monospace', flex: 1 }}>
                    {item.path}
                  </Text>
                  <Text style={{ color: '#667080', fontSize: 10, flexShrink: 0 }}>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 集成步骤（随导出类型动态切换） */}
          <View style={{
            backgroundColor: '#161A1F', borderRadius: 16,
            borderWidth: 1, borderColor: '#2A3140',
            marginHorizontal: 16, marginTop: 14, overflow: 'hidden',
          }}>
            <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
              <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>
                {exportType === 'flutter_cross_platform' ? '🐦 Flutter 集成步骤（导出后操作）' : '🔧 原生 App 集成步骤（导出后操作）'}
              </Text>
            </View>
            <View style={{ padding: 14, gap: 10 }}>
              {(exportType === 'flutter_cross_platform' ? [
                { step: '①', title: '安装 Flutter SDK', desc: '访问 flutter.dev/install，安装 Flutter 3.22+，运行 flutter doctor 确认环境就绪' },
                { step: '②', title: '下载并解压', desc: '从 tasks/flutter_project.zip 解压到本地目录' },
                { step: '③', title: '安装依赖', desc: '进入项目目录，运行 flutter pub get 安装所有 pubspec.yaml 中声明的依赖' },
                { step: '④', title: '配置 Supabase', desc: '在 lib/core/config.dart 中填入 SUPABASE_URL 和 SUPABASE_ANON_KEY' },
                { step: '⑤', title: '安卓打包', desc: '运行 flutter build apk --release 生成 APK；或 flutter run 在设备上调试' },
                { step: '⑥', title: 'iOS 打包', desc: '在 Xcode 中打开 ios/Runner.xcworkspace，配置开发者账号签名，flutter build ios' },
              ] : [
                { step: '①', title: '拷贝代码文件', desc: '将 src/native_modules/android/*.kt 复制到 android/app/src/main/java/.../ 目录' },
                { step: '②', title: '合并 Manifest', desc: '将 AndroidManifest_additions.xml 中的内容合并到 android/app/src/main/AndroidManifest.xml' },
                { step: '③', title: '拷贝资源文件', desc: '将 res/xml/ 和 res/layout/ 复制到对应的 android/app/src/main/res/ 目录' },
                { step: '④', title: '初始化开关读取', desc: '在 Application.onCreate() 中调用 SettingsRepository，根据开关值启动对应服务' },
                { step: '⑤', title: '填充业务逻辑', desc: '按 // TODO 注释在各 .kt 文件中填入游戏包名列表、悬浮窗菜单选项等业务细节' },
              ]).map(item => (
                <View key={item.step} style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{
                    width: 24, height: 24, borderRadius: 12,
                    backgroundColor: exportType === 'flutter_cross_platform' ? 'rgba(16,185,129,0.2)' : 'rgba(37,99,235,0.2)',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Text style={{
                      color: exportType === 'flutter_cross_platform' ? '#34D399' : '#60A5FA',
                      fontSize: 11, fontWeight: 'bold',
                    }}>{item.step}</Text>
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: '600' }}>{item.title}</Text>
                    <Text style={{ color: '#667080', fontSize: 11, lineHeight: 16 }}>{item.desc}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* 云端一键打包卡片 */}
          <CloudBuildCard
            exportType={exportType}
            onNavigateDownload={() => router.back()}
          />

        </ScrollView>
      )}
    </View>
  );
}
