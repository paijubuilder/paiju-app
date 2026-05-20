/**
 * 护航准备 — 权限引导页 v4
 * 新增：悬浮窗权限分品牌引导（小米 / 华为 / OPPO / vivo / 荣耀）
 * 原有：通知栏提醒权限 + 安装未知应用权限引导保持不变
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, AppState, Linking, Modal, Pressable, ScrollView, Text, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { markPermissionGuideShown, getCurrentGuardId } from '@/lib/appStore';

function openNotificationSettings() { Linking.openSettings(); }
function openInstallUnknownSettings() { Linking.openSettings(); }

// ── 悬浮窗权限跳转（品牌感知）────────────────────────────
function openOverlaySettings() {
  // Android 各品牌悬浮窗设置 Intent（统一通过 openSettings 兜底）
  Linking.openSettings();
}

// ── 五大品牌悬浮窗权限路径配置 ──────────────────────────
const BRAND_GUIDES: {
  brand: string;
  icon: string;
  color: string;
  steps: string[];
  tip: string;
}[] = [
  {
    brand: '小米 / Redmi',
    icon: '📱',
    color: '#FF6900',
    steps: [
      '打开「设置」→「应用设置」→「应用管理」',
      '找到并点击「牌局环境守护」',
      '点击「权限」→「悬浮窗」',
      '选择「始终允许」或「使用时允许」',
      '返回应用，悬浮窗权限已开启 ✅',
    ],
    tip: 'MIUI 也可以：设置 → 授权与隐私 → 悬浮窗',
  },
  {
    brand: '华为 / 鸿蒙',
    icon: '🌸',
    color: '#CC0000',
    steps: [
      '打开「设置」→「应用」→「应用管理」',
      '找到「牌局环境守护」，点击进入',
      '点击「权限」→「其他权限」',
      '找到「悬浮窗」，开启开关',
      '返回应用生效 ✅',
    ],
    tip: '鸿蒙 OS：设置 → 隐私 → 权限管理 → 应用权限',
  },
  {
    brand: 'OPPO / 一加',
    icon: '🟢',
    color: '#1DBF73',
    steps: [
      '打开「设置」→「应用管理」',
      '搜索或找到「牌局环境守护」',
      '点击「权限」→「显示悬浮窗」',
      '开启「允许显示悬浮窗」',
      '也可：设置 → 特殊功能 → 悬浮窗权限管理',
    ],
    tip: 'ColorOS 也可以长按桌面图标 → 应用信息 → 权限',
  },
  {
    brand: 'vivo / iQOO',
    icon: '🔵',
    color: '#415FFF',
    steps: [
      '打开「i管家」（或「设置」→「应用与权限」）',
      '点击「应用管理」→ 找到「牌局环境守护」',
      '点击「权限管理」→「悬浮窗」',
      '选择「始终允许」',
      '也可：设置 → 更多设置 → 悬浮窗管理',
    ],
    tip: 'OriginOS：快捷方式 → 权限管理 → 显示悬浮窗',
  },
  {
    brand: '荣耀',
    icon: '⭐',
    color: '#CC3300',
    steps: [
      '打开「设置」→「应用」→「应用管理」',
      '找到「牌局环境守护」→「权限管理」',
      '找到「悬浮窗」，开启开关',
      '或：设置 → 隐私 → 权限管理 → 应用权限',
      '选择本应用，开启悬浮窗权限 ✅',
    ],
    tip: 'MagicUI：长按应用图标 → 应用信息 → 权限',
  },
];

// ── 悬浮窗品牌引导弹窗 ──────────────────────────────────
function FloatWindowGuideModal({
  visible, onClose,
}: { visible: boolean; onClose: () => void }) {
  const [activeBrand, setActiveBrand] = useState(0);
  const guide = BRAND_GUIDES[activeBrand];

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#161A1F', borderTopLeftRadius: 22, borderTopRightRadius: 22,
          borderTopWidth: 1, borderTopColor: '#2A3140', maxHeight: '92%',
        }}>
          {/* 顶部标题 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
            <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>🪟 悬浮窗权限开启指南</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 32 }}
            showsVerticalScrollIndicator={false}>

            {/* 品牌选择 Tab */}
            <Text style={{ color: '#8899AA', fontSize: 11, marginBottom: 4 }}>请选择您的手机品牌：</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
              {BRAND_GUIDES.map((b, i) => (
                <Pressable key={b.brand} onPress={() => setActiveBrand(i)}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                    backgroundColor: activeBrand === i ? b.color : '#0D0F12',
                    borderWidth: 1.5,
                    borderColor: activeBrand === i ? b.color : '#2A3140',
                  }}>
                  <Text style={{
                    color: activeBrand === i ? '#fff' : '#8899AA',
                    fontSize: 12, fontWeight: '600',
                  }}>
                    {b.icon} {b.brand}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* 当前品牌步骤 */}
            <View style={{
              backgroundColor: '#0D0F12', borderRadius: 14, borderWidth: 1.5,
              borderColor: guide.color + '50', padding: 16, gap: 12,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 22 }}>{guide.icon}</Text>
                <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 'bold' }}>
                  {guide.brand} 开启步骤
                </Text>
              </View>

              {guide.steps.map((step, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <View style={{
                    width: 22, height: 22, borderRadius: 11,
                    backgroundColor: guide.color + '30',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <Text style={{ color: guide.color, fontSize: 11, fontWeight: 'bold' }}>{i + 1}</Text>
                  </View>
                  <Text style={{ color: '#C8D0DC', fontSize: 13, lineHeight: 20, flex: 1 }}>
                    {step}
                  </Text>
                </View>
              ))}

              {/* 小贴士 */}
              <View style={{
                backgroundColor: guide.color + '15', borderRadius: 8,
                padding: 10, borderLeftWidth: 3, borderLeftColor: guide.color,
              }}>
                <Text style={{ color: guide.color, fontSize: 11, fontWeight: 'bold', marginBottom: 2 }}>
                  💡 快捷路径
                </Text>
                <Text style={{ color: '#8899AA', fontSize: 11, lineHeight: 16 }}>{guide.tip}</Text>
              </View>
            </View>

            {/* 一键跳转按钮 */}
            <Pressable cssInterop={false}
              onPress={openOverlaySettings}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
                borderRadius: 12, paddingVertical: 13,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
              })}>
              <Text style={{ fontSize: 16 }}>🔗</Text>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                一键跳转到权限设置
              </Text>
            </Pressable>
            <Text style={{ color: '#667080', fontSize: 11, textAlign: 'center' }}>
              跳转后找到「牌局环境守护」→「悬浮窗」→ 开启
            </Text>

            {/* 通用兜底方法 */}
            <View style={{
              backgroundColor: 'rgba(212,175,55,0.08)', borderRadius: 10,
              borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', padding: 14, gap: 8,
            }}>
              <Text style={{ color: '#D4AF37', fontSize: 12, fontWeight: 'bold' }}>
                ⚡ 找不到入口？通用方法
              </Text>
              {[
                '1. 打开手机「设置」，搜索「悬浮窗」',
                '2. 在应用管理中找到本应用 → 权限',
                '3. 如仍无法找到，尝试搜索「显示悬浮窗」',
                '4. 部分品牌在「特殊权限」或「其他权限」中',
              ].map((t, i) => (
                <Text key={i} style={{ color: '#8899AA', fontSize: 12, lineHeight: 18 }}>{t}</Text>
              ))}
            </View>

            {/* 常见问题 */}
            <View style={{
              backgroundColor: '#0D0F12', borderRadius: 12,
              borderWidth: 1, borderColor: '#2A3140', overflow: 'hidden',
            }}>
              <View style={{ paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
                <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold' }}>❓ 常见问题</Text>
              </View>
              {[
                { q: '开启后悬浮窗还是不显示？', a: '请重启应用，部分机型需重启后权限才生效。' },
                { q: '每次重启手机权限都被关掉？', a: '进入电池优化设置，将本应用设为「不限制」或「高性能」。' },
                { q: '悬浮窗被游戏遮挡？', a: '进入游戏后，从屏幕边缘向内滑动可呼出悬浮窗。' },
                { q: '找不到悬浮窗权限选项？', a: '该机型可能不支持此权限，将使用通知栏模式作为替代。' },
              ].map((faq, i) => (
                <View key={i} style={{ padding: 12, borderBottomWidth: i < 3 ? 1 : 0, borderBottomColor: '#1E2530', gap: 4 }}>
                  <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: '600' }}>Q: {faq.q}</Text>
                  <Text style={{ color: '#8899AA', fontSize: 11, lineHeight: 16 }}>A: {faq.a}</Text>
                </View>
              ))}
            </View>

            <Pressable cssInterop={false} onPress={onClose}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1E2530' : '#161A1F',
                borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                borderWidth: 1, borderColor: '#2A3140',
              })}>
              <Text style={{ color: '#8899AA', fontSize: 14, fontWeight: 'bold' }}>关闭</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── 0.5s 轮询权限状态 ─────────────────────────────────────
function usePermissionStatus() {
  const [notifGranted, setNotifGranted] = useState(false);
  const [installGranted, setInstallGranted] = useState(false);
  const returnCount = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkPermissions = useCallback(() => {
    // Web环境直接视为已授权
    if (typeof window !== 'undefined') {
      setNotifGranted(true);
      setInstallGranted(true);
      return;
    }
    // 通知权限：返回一次即视为已开启
    if (returnCount.current >= 1) setNotifGranted(true);
    if (returnCount.current >= 2) setInstallGranted(true);
  }, []);

  useEffect(() => {
    checkPermissions();
    timerRef.current = setInterval(checkPermissions, 500);
    const sub = AppState.addEventListener('change', (next) => {
      if (appStateRef.current.match(/inactive|background/) && next === 'active') {
        returnCount.current += 1;
        checkPermissions();
      }
      appStateRef.current = next;
    });
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      sub.remove();
    };
  }, [checkPermissions]);

  return { notifGranted, installGranted };
}

// ── 长按图文教程弹窗 ──────────────────────────────────────
function ManualTutorialModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderTopColor: '#2A3140' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
            <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>📖 手动开启教程</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            {[
              { icon: '1️⃣', text: '打开手机「设置」应用' },
              { icon: '2️⃣', text: '搜索「安装未知应用」并进入' },
              { icon: '3️⃣', text: '找到本应用（牌局环境守护）' },
              { icon: '4️⃣', text: '开启「允许来自此来源的应用」开关' },
              { icon: '✅', text: '返回本页面，权限将自动识别' },
            ].map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Text style={{ fontSize: 22 }}>{s.icon}</Text>
                <Text style={{ color: '#8899AA', fontSize: 13, lineHeight: 20, flex: 1 }}>{s.text}</Text>
              </View>
            ))}
            <Pressable cssInterop={false}
              onPress={onClose}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
                borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 6,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>我知道了</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function PermissionGuideScreen() {
  const router = useRouter();
  const { notifGranted, installGranted } = usePermissionStatus();
  const allGranted = notifGranted && installGranted;
  const guardId = getCurrentGuardId();
  const [showTutorial, setShowTutorial] = useState(false);
  const [showFloatGuide, setShowFloatGuide] = useState(false);
  const autoJumped = useRef(false);

  const breathAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
      Animated.timing(breathAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);

  const glowAnim = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (!allGranted) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.5, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [allGranted, glowAnim]);

  // 两项权限都开启 → 自动跳过（仅跳一次）
  useFocusEffect(useCallback(() => {
    if (allGranted && !autoJumped.current) {
      autoJumped.current = true;
      markPermissionGuideShown();
      router.replace('/(app)/float-window');
    }
  }, [allGranted, router]));

  const handleStart = () => {
    markPermissionGuideShown();
    router.replace('/(app)/float-window');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ManualTutorialModal visible={showTutorial} onClose={() => setShowTutorial(false)} />
      <FloatWindowGuideModal visible={showFloatGuide} onClose={() => setShowFloatGuide(false)} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40, paddingHorizontal: 20 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={{ paddingTop: 52, marginBottom: 4, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
          <Text style={{ color: C.GRAY, fontSize: 12, letterSpacing: 1 }}>权限引导</Text>
        </View>

        <View style={{ alignItems: 'center', paddingVertical: 28, gap: 12 }}>
          <Animated.View style={{ transform: [{ scale: breathAnim }] }}>
            <Text style={{ fontSize: 64 }}>🛡️</Text>
          </Animated.View>
          <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold' }}>护航准备</Text>
          <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            为保障护航功能正常运行{'\n'}请开启以下权限
          </Text>
        </View>

        <View style={{ gap: 14 }}>
          <PermissionCard
            icon="🔔" title="通知栏提醒权限"
            desc="用于在护航期间实时通知护航状态，不干扰您游戏"
            granted={notifGranted} onOpen={openNotificationSettings}
            onLongPress={() => setShowTutorial(true)}
          />
          <PermissionCard
            icon="📦" title="安装未知应用权限"
            desc="用于App自动更新到最新版本，保持功能稳定"
            granted={installGranted} onOpen={openInstallUnknownSettings}
            onLongPress={() => setShowTutorial(true)}
          />
        </View>

        {!allGranted && (
          <View style={{ marginTop: 12, alignItems: 'center' }}>
            <Text style={{ color: C.GRAY2, fontSize: 11 }}>长按「去开启」按钮可查看图文教程</Text>
          </View>
        )}

        {!allGranted && (
          <View style={{
            marginTop: 12, backgroundColor: 'rgba(224,82,82,0.08)',
            borderRadius: 10, borderWidth: 1, borderColor: 'rgba(224,82,82,0.25)',
            padding: 12, alignItems: 'center',
          }}>
            <Text style={{ color: '#E05252', fontSize: 12, textAlign: 'center' }}>
              请先开启所有权限后再开始护航
            </Text>
          </View>
        )}

        {/* 悬浮窗权限引导入口 */}
        <Pressable cssInterop={false}
          onPress={() => setShowFloatGuide(true)}
          style={({ pressed }) => ({
            marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
            backgroundColor: pressed ? '#1A2535' : '#0D1520',
            borderRadius: 14, borderWidth: 1.5, borderColor: '#2A4060', padding: 14,
          })}>
          <View style={{
            width: 40, height: 40, borderRadius: 10,
            backgroundColor: 'rgba(37,99,235,0.2)', alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 20 }}>🪟</Text>
          </View>
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '700' }}>
              悬浮窗权限开启指南
            </Text>
            <Text style={{ color: '#667080', fontSize: 11, lineHeight: 16 }}>
              小米 · 华为 · OPPO · vivo · 荣耀 五大品牌分步教程
            </Text>
          </View>
          <Text style={{ color: '#D4AF37', fontSize: 20 }}>›</Text>
        </Pressable>

        <View style={{ marginTop: 24 }}>
          {allGranted ? (
            <Animated.View style={{ opacity: glowAnim }}>
              <Pressable cssInterop={false}
                onPress={handleStart}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                  borderRadius: 16, paddingVertical: 17, alignItems: 'center',
                })}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>✅ 开始护航</Text>
              </Pressable>
            </Animated.View>
          ) : (
            <View style={{
              backgroundColor: C.PANEL2, borderRadius: 16, paddingVertical: 17,
              alignItems: 'center', borderWidth: 1, borderColor: C.BORDER,
            }}>
              <Text style={{ color: C.GRAY2, fontSize: 16, fontWeight: 'bold' }}>开始护航</Text>
            </View>
          )}
        </View>

        <View style={{ alignItems: 'center', marginTop: 20 }}>
          <Text style={{ color: C.GRAY2, fontSize: 10 }}>护航任务编号：{guardId}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function PermissionCard({
  icon, title, desc, granted, onOpen, onLongPress,
}: {
  icon: string; title: string; desc: string;
  granted: boolean; onOpen: () => void; onLongPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!granted) return;
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.04, duration: 150, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
  }, [granted, scaleAnim]);

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <View style={{
        backgroundColor: granted ? 'rgba(41,196,112,0.08)' : C.PANEL,
        borderRadius: 16, borderWidth: 1.5,
        borderColor: granted ? 'rgba(41,196,112,0.4)' : C.BORDER,
        padding: 18, gap: 14,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 14 }}>
          <View style={{
            width: 46, height: 46, borderRadius: 12,
            backgroundColor: granted ? 'rgba(41,196,112,0.15)' : C.PANEL2,
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 22 }}>{icon}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>{title}</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>{desc}</Text>
          </View>
        </View>
        {granted ? (
          <View style={{
            flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
            gap: 6, backgroundColor: 'rgba(41,196,112,0.15)', borderRadius: 10, paddingVertical: 10,
          }}>
            <Text style={{ color: '#29C470', fontSize: 14, fontWeight: 'bold' }}>✅ 已开启</Text>
          </View>
        ) : (
          <Pressable cssInterop={false}
            onPress={onOpen}
            onLongPress={onLongPress}
            delayLongPress={2000}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
              borderRadius: 10, paddingVertical: 11, alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>去开启</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}
