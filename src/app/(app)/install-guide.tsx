/**
 * 安装引导页 v22
 * - 安卓设备：立即跳转 APK 主推下载页
 * - 苹果设备：动态 Safari 一键添加到主屏幕引导页
 * 禁止出现任何第三方游戏品牌名称
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';

const isIOS = process.env.EXPO_OS === 'ios';
const APP_URL = 'https://app-bjaapbe7wkqp.appmiaoda.com';

// ─── Safari 动态演示动画 ──────────────────────────────────
// 4步循环：分享点击 → 菜单弹出 → 添加到主屏幕点击 → 桌面图标成功
function SafariDemo() {
  const step = useRef(new Animated.Value(0)).current; // 0~3 步骤索引
  const fingerY = useRef(new Animated.Value(0)).current;
  const menuSlide = useRef(new Animated.Value(120)).current;
  const menuOpacity = useRef(new Animated.Value(0)).current;
  const confirmSlide = useRef(new Animated.Value(80)).current;
  const confirmOpacity = useRef(new Animated.Value(0)).current;
  const iconScale = useRef(new Animated.Value(0.4)).current;
  const iconOpacity = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const highlightOpacity = useRef(new Animated.Value(0)).current;
  const addBtnPulse = useRef(new Animated.Value(1)).current;
  const [demoStep, setDemoStep] = useState(0); // 0 share / 1 menu / 2 confirm / 3 done

  const resetAll = useCallback(() => {
    step.setValue(0);
    fingerY.setValue(0);
    menuSlide.setValue(120);
    menuOpacity.setValue(0);
    confirmSlide.setValue(80);
    confirmOpacity.setValue(0);
    iconScale.setValue(0.4);
    iconOpacity.setValue(0);
    bubbleOpacity.setValue(0);
    highlightOpacity.setValue(0);
    addBtnPulse.setValue(1);
  }, [step, fingerY, menuSlide, menuOpacity, confirmSlide, confirmOpacity, iconScale, iconOpacity, bubbleOpacity, highlightOpacity, addBtnPulse]);

  useEffect(() => {
    const runAnimation = () => {
      resetAll();
      setDemoStep(0);

      // Step 0→1: 手指下移点击分享按钮，高亮出现
      const phase0 = Animated.sequence([
        Animated.delay(400),
        Animated.parallel([
          Animated.timing(fingerY, { toValue: 18, duration: 500, useNativeDriver: true }),
          Animated.timing(highlightOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(300),
      ]);

      // Step 1→2: 菜单弹出
      const phase1 = Animated.parallel([
        Animated.timing(menuSlide, { toValue: 0, duration: 450, easing: Easing.out(Easing.back(1.1)), useNativeDriver: true }),
        Animated.timing(menuOpacity, { toValue: 1, duration: 350, useNativeDriver: true }),
      ]);

      // Step 2→3: 确认页出现 + 添加按钮脉冲
      const phase2 = Animated.sequence([
        Animated.delay(700),
        Animated.parallel([
          Animated.timing(confirmSlide, { toValue: 0, duration: 400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(confirmOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]),
        Animated.delay(500),
        Animated.loop(
          Animated.sequence([
            Animated.timing(addBtnPulse, { toValue: 1.12, duration: 380, useNativeDriver: true }),
            Animated.timing(addBtnPulse, { toValue: 1, duration: 380, useNativeDriver: true }),
          ]),
          { iterations: 2 }
        ),
        Animated.delay(200),
      ]);

      // Step 3: 桌面图标 + 气泡
      const phase3 = Animated.sequence([
        Animated.parallel([
          Animated.spring(iconScale, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
          Animated.timing(iconOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
        ]),
        Animated.timing(bubbleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(1200),
        Animated.parallel([
          Animated.timing(iconOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
          Animated.timing(bubbleOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(menuOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(confirmOpacity, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      ]);

      // 链式执行，逐步切换 demoStep 状态
      phase0.start(({ finished }) => {
        if (!finished) return;
        setDemoStep(1);
        phase1.start(({ finished: f1 }) => {
          if (!f1) return;
          phase2.start(({ finished: f2 }) => {
            if (!f2) return;
            setDemoStep(2);
            setTimeout(() => {
              setDemoStep(3);
              phase3.start(({ finished: f3 }) => {
                if (f3) setTimeout(runAnimation, 200);
              });
            }, 100);
          });
        });
      });
    };

    runAnimation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const BOX = { width: 280, height: 200 };

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold' }}>💡 操作演示</Text>
        <View style={{ backgroundColor: 'rgba(43,123,255,0.15)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
          <Text style={{ color: C.BLUE, fontSize: 10 }}>自动循环</Text>
        </View>
      </View>

      {/* 演示容器 */}
      <View style={{
        ...BOX, borderRadius: 18,
        backgroundColor: '#1A1E2A', overflow: 'hidden',
        borderWidth: 1.5, borderColor: 'rgba(43,123,255,0.3)',
        boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 24, color: 'rgba(43,123,255,0.15)' }],
      }}>

        {/* 步骤 0~2：Safari 浏览器界面 */}
        {demoStep < 3 && (
          <View style={{ flex: 1 }}>
            {/* Safari 顶栏 */}
            <View style={{ backgroundColor: '#23272F', paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ flex: 1, backgroundColor: '#2D3240', borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 }}>
                <Text style={{ color: '#8899BB', fontSize: 10 }}>app-bjaapbe7wkqp.appmiaoda.com</Text>
              </View>
            </View>

            {/* 网页内容区 */}
            <View style={{ flex: 1, backgroundColor: '#181C24', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Text style={{ fontSize: 28 }}>🛡️</Text>
              <Text style={{ color: '#C8D4E8', fontSize: 12, fontWeight: 'bold' }}>牌局环境守护</Text>
              <Text style={{ color: '#667080', fontSize: 10 }}>点击分享，添加到主屏幕</Text>
            </View>

            {/* Safari 底栏 */}
            <View style={{ backgroundColor: '#23272F', paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' }}>
              <Text style={{ color: '#445', fontSize: 16 }}>←</Text>
              <Text style={{ color: '#445', fontSize: 16 }}>→</Text>
              {/* 分享按钮 + 手指 */}
              <View style={{ alignItems: 'center', position: 'relative' }}>
                <Animated.View style={{ opacity: highlightOpacity, position: 'absolute', top: -4, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(43,123,255,0.25)', borderWidth: 1.5, borderColor: C.BLUE }} />
                <Text style={{ color: demoStep === 0 ? C.BLUE : '#8899BB', fontSize: 20 }}>⬆️</Text>
                {/* 手指动画 */}
                {demoStep === 0 && (
                  <Animated.Text style={{ position: 'absolute', bottom: -22, fontSize: 18, transform: [{ translateY: fingerY }] }}>
                    👆
                  </Animated.Text>
                )}
              </View>
              <Text style={{ color: '#445', fontSize: 16 }}>📚</Text>
              <Text style={{ color: '#445', fontSize: 16 }}>⬜</Text>
            </View>
          </View>
        )}

        {/* 步骤 3：桌面图标成功 */}
        {demoStep === 3 && (
          <View style={{ flex: 1, backgroundColor: '#0A1628', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <Text style={{ color: '#667080', fontSize: 10 }}>— 手机桌面 —</Text>
            <Animated.View style={{ alignItems: 'center', gap: 6, opacity: iconOpacity, transform: [{ scale: iconScale }] }}>
              <View style={{
                width: 56, height: 56, borderRadius: 14, backgroundColor: '#1A3A6A',
                alignItems: 'center', justifyContent: 'center',
                borderWidth: 2, borderColor: C.BLUE,
                boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 20, color: 'rgba(43,123,255,0.6)' }],
              }}>
                <Text style={{ fontSize: 28 }}>🛡️</Text>
              </View>
              <Text style={{ color: '#C8D4E8', fontSize: 9, fontWeight: 'bold' }}>牌局守护</Text>
            </Animated.View>
            <Animated.View style={{ opacity: bubbleOpacity, backgroundColor: '#29C470', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 6 }}>
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>🎉 添加成功！</Text>
            </Animated.View>
          </View>
        )}

        {/* 菜单叠加层 (步骤 1~2) */}
        {demoStep >= 1 && demoStep < 3 && (
          <Animated.View style={{
            position: 'absolute', bottom: 44, left: 0, right: 0,
            backgroundColor: '#23272F', borderTopLeftRadius: 14, borderTopRightRadius: 14,
            borderTopWidth: 1, borderColor: '#333A4A', paddingVertical: 10,
            opacity: menuOpacity, transform: [{ translateY: menuSlide }],
          }}>
            <Text style={{ color: '#8899BB', fontSize: 10, textAlign: 'center', marginBottom: 6 }}>分享选项</Text>
            {[
              { icon: '📋', label: '拷贝' },
              { icon: '➕', label: '添加到主屏幕', highlight: demoStep === 1 },
              { icon: '📤', label: '发送到设备' },
            ].map(item => (
              <View key={item.label} style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                paddingVertical: 7, paddingHorizontal: 16,
                backgroundColor: item.highlight ? 'rgba(43,123,255,0.2)' : 'transparent',
              }}>
                <Text style={{ fontSize: 14 }}>{item.icon}</Text>
                <Text style={{ color: item.highlight ? C.BLUE : '#C8D4E8', fontSize: 12, fontWeight: item.highlight ? 'bold' : 'normal' }}>{item.label}</Text>
                {item.highlight && <Text style={{ color: C.BLUE, fontSize: 10, marginLeft: 'auto' }}>← 点这里</Text>}
              </View>
            ))}
          </Animated.View>
        )}

        {/* 确认添加叠加层 (步骤 2) */}
        {demoStep === 2 && (
          <Animated.View style={{
            position: 'absolute', inset: 0, backgroundColor: '#181C24',
            opacity: confirmOpacity, transform: [{ translateY: confirmSlide }],
          }}>
            <View style={{ backgroundColor: '#23272F', paddingVertical: 8, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#8899BB', fontSize: 12 }}>取消</Text>
              <Text style={{ color: '#C8D4E8', fontSize: 13, fontWeight: 'bold' }}>添加到主屏幕</Text>
              <Animated.Text style={{ color: C.BLUE, fontSize: 13, fontWeight: 'bold', transform: [{ scale: addBtnPulse }] }}>添加</Animated.Text>
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <View style={{ width: 52, height: 52, borderRadius: 13, backgroundColor: '#1A3A6A', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 26 }}>🛡️</Text>
              </View>
              <Text style={{ color: '#8899BB', fontSize: 10 }}>牌局环境守护</Text>
              <Text style={{ color: '#445566', fontSize: 9 }}>app-bjaapbe7wkqp.appmiaoda.com</Text>
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ─── 步骤卡片 ─────────────────────────────────────────────
function IosStepCard({ step, active, icon, title, desc }: {
  step: number; active: boolean; icon: string; title: string; desc: string;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const fade = useRef(new Animated.Value(active ? 1 : 0.4)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: active ? 1 : 0.4, duration: 400, useNativeDriver: true }).start();
    if (active) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.22, duration: 650, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [active, fade, pulse]);

  return (
    <Animated.View style={{
      opacity: fade,
      backgroundColor: active ? 'rgba(43,123,255,0.10)' : C.PANEL,
      borderRadius: 14, borderWidth: 1.5,
      borderColor: active ? C.BLUE : C.BORDER,
      padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    }}>
      <Animated.View style={{ transform: [{ scale: active ? pulse : 1 }] }}>
        <View style={{
          width: 40, height: 40, borderRadius: 20,
          backgroundColor: active ? C.BLUE : C.PANEL2,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: active ? '#fff' : C.GRAY, fontSize: 18, fontWeight: 'bold' }}>
            {'❶❷❸'[step - 1]}
          </Text>
        </View>
      </Animated.View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 26 }}>{icon}</Text>
        <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold' }}>{title}</Text>
        <Text style={{ color: C.GRAY, fontSize: 11, lineHeight: 17 }}>{desc}</Text>
      </View>
    </Animated.View>
  );
}

// ─── iOS 引导主页面 ───────────────────────────────────────
function IosGuideScreen() {
  const [activeStep, setActiveStep] = useState(1);
  const [showCopied, setShowCopied] = useState(false);

  // 步骤自动轮播（与动画演示同步，约3秒一轮）
  useEffect(() => {
    const t = setInterval(() => setActiveStep(s => s < 3 ? s + 1 : 1), 3000);
    return () => clearInterval(t);
  }, []);

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(APP_URL);
    } catch {
      // 降级：Web Clipboard API
      try { await navigator.clipboard.writeText(APP_URL); } catch { /* ignore */ }
    }
    setShowCopied(true);
  };

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: 48 }}
      contentInsetAdjustmentBehavior="automatic"
      showsVerticalScrollIndicator={false}
    >
      {/* ── 顶部提醒横幅 ─── */}
      <View style={{
        marginHorizontal: 16, marginTop: 14,
        borderRadius: 16, overflow: 'hidden',
        borderWidth: 1, borderColor: 'rgba(43,123,255,0.35)',
      }}>
        <View style={{ backgroundColor: 'rgba(20,60,140,0.55)', padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <Text style={{ fontSize: 22 }}>🍎</Text>
          <Text style={{ flex: 1, color: '#A8C8FF', fontSize: 13, lineHeight: 20 }}>
            苹果版本正在开发中，您可以先使用网页版，{'\n'}
            <Text style={{ fontWeight: 'bold', color: '#C8DFFF' }}>流畅度和功能一样好！</Text>
          </Text>
        </View>
      </View>

      {/* ── 核心卖点 ─── */}
      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 18, gap: 10 }}>
        {[
          { icon: '🛡️', label: '实时护航守护' },
          { icon: '⚡', label: '极速环境检测' },
          { icon: '🔒', label: '自动登录记忆' },
        ].map(item => (
          <View key={item.label} style={{
            flex: 1, backgroundColor: 'rgba(43,123,255,0.10)',
            borderRadius: 12, borderWidth: 1, borderColor: 'rgba(43,123,255,0.3)',
            paddingVertical: 12, alignItems: 'center', gap: 4,
          }}>
            <Text style={{ fontSize: 20 }}>{item.icon}</Text>
            <Text style={{ color: C.BLUE, fontSize: 10, fontWeight: 'bold', textAlign: 'center' }}>{item.label}</Text>
          </View>
        ))}
      </View>

      {/* ── Safari 动态演示 ─── */}
      <View style={{ marginHorizontal: 20, marginTop: 22 }}>
        <SafariDemo />
      </View>

      {/* ── 三步操作卡片 ─── */}
      <View style={{ marginHorizontal: 20, marginTop: 20, gap: 10 }}>
        <IosStepCard step={1} active={activeStep === 1}
          icon="📤" title="点击底部「分享」按钮"
          desc="在 Safari 浏览器中打开页面，点击底部中央的分享（⬆️）按钮。" />
        <IosStepCard step={2} active={activeStep === 2}
          icon="➕" title="找到「添加到主屏幕」"
          desc="在弹出的分享菜单中下滑，找到「添加到主屏幕」并点击。" />
        <IosStepCard step={3} active={activeStep === 3}
          icon="✅" title="点击右上角「添加」"
          desc="确认名称后点击右上角「添加」，桌面即出现 App 图标，点击即用。" />

        {/* 步骤进度点 */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 2 }}>
          {[1, 2, 3].map(i => (
            <Pressable key={i} onPress={() => setActiveStep(i)}>
              <View style={{
                width: activeStep === i ? 20 : 8, height: 8, borderRadius: 4,
                backgroundColor: activeStep === i ? C.BLUE : C.BORDER,
                ...(activeStep === i ? { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 6, color: C.BLUE }] } : {}),
              }} />
            </Pressable>
          ))}
        </View>
      </View>

      {/* ── 一键复制链接（核心CTA）─── */}
      <View style={{ marginHorizontal: 20, marginTop: 24 }}>
        <Pressable cssInterop={false}
          onPress={handleCopy}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
            borderRadius: 16, height: 56,
            alignItems: 'center', justifyContent: 'center',
            boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 18, color: 'rgba(43,123,255,0.45)' }],
          })}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
            📋 一键复制链接，到Safari中打开
          </Text>
        </Pressable>
        <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
          复制后，在 Safari 地址栏粘贴打开，再按上方演示添加到桌面
        </Text>
      </View>

      {/* ── 底部兜底说明 ─── */}
      <View style={{ marginHorizontal: 24, marginTop: 22, gap: 6 }}>
        <Text style={{ color: '#667080', fontSize: 11, textAlign: 'center', lineHeight: 17 }}>
          ⚠️ 部分功能（如通知栏提醒）暂不支持苹果网页版，将尽快适配。
        </Text>
        <Text style={{ color: '#667080', fontSize: 11, textAlign: 'center', lineHeight: 17 }}>
          💡 添加后桌面图标即点即用，和原生App体验相同
        </Text>
      </View>

      {/* ── 复制成功弹窗 ─── */}
      <Modal visible={showCopied} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          onPress={() => setShowCopied(false)}
        >
          <View style={{ backgroundColor: '#1A1E2A', borderRadius: 20, borderWidth: 1.5, borderColor: C.BLUE, padding: 24, gap: 14, width: '100%' }}>
            <Text style={{ fontSize: 36, textAlign: 'center' }}>✅</Text>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>链接已复制！</Text>
            <Text style={{ color: '#B0C0D8', fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
              请打开{' '}
              <Text style={{ color: C.BLUE, fontWeight: 'bold' }}>Safari浏览器</Text>
              {'\n'}将链接粘贴到地址栏。{'\n\n'}然后按上方演示操作，3秒即可完成。
            </Text>
            <Pressable cssInterop={false}
              onPress={() => setShowCopied(false)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                borderRadius: 12, paddingVertical: 13, alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>知道了，去Safari</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

// ─── 主页面入口 ───────────────────────────────────────────
export default function InstallGuideScreen() {
  const router = useRouter();

  // 安卓设备：立即跳转 APK 主推下载页
  useFocusEffect(useCallback(() => {
    if (!isIOS) {
      router.replace('/(app)/apk-install' as never);
    }
  }, [router]));

  // 安卓设备渲染空白（跳转中）
  if (!isIOS) {
    return (
      <View style={{ flex: 1, backgroundColor: C.BG }}>
        <StatusBar style="light" backgroundColor={C.BG} />
      </View>
    );
  }

  // 苹果设备：展示动态 Safari 引导页
  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 顶部导航栏 */}
      <View style={{ paddingTop: 52, paddingHorizontal: 20, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
        </Pressable>
        <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold' }}>📱 添加到主屏幕</Text>
      </View>

      <IosGuideScreen />
    </View>
  );
}

