/**
 * 微信内置浏览器动态图文安装引导组件
 * 仅在微信内置浏览器中触发，引导用户在外部浏览器打开后安装 PWA/APK
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, Text, View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

// ── 微信环境检测（仅Web平台） ─────────────────────────────
function isWechatBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return /MicroMessenger/i.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.navigator as { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  );
}

const APP_URL = 'https://app-bjaapbe7wkqp.appmiaoda.com';
const C = {
  BG: '#0D0F12',
  PANEL: '#161A1F',
  PANEL2: '#1E2530',
  BLUE: '#2563EB',
  BLUE_BG: 'rgba(37,99,235,0.12)',
  GOLD: '#D4AF37',
  WHITE: '#F0F4FF',
  GRAY: '#8899AA',
  GRAY2: '#4A5568',
  BORDER: '#2A3140',
  GREEN: '#3DDC84',
  ORANGE: '#F59E0B',
};

// ── 步骤配置 ──────────────────────────────────────────────
const STEPS = [
  {
    num: '❶',
    title: '点击右上角 ··· 菜单',
    desc: '找到右上角三个点的更多菜单',
    animEmoji: '···',
    animBg: 'rgba(37,99,235,0.15)',
    dotColor: C.BLUE,
    hint: '点击微信顶部右上角的"..."图标',
  },
  {
    num: '❷',
    title: '选择「在浏览器中打开」',
    desc: '在弹出菜单中选择用浏览器打开',
    animEmoji: '🌐',
    animBg: 'rgba(61,220,132,0.12)',
    dotColor: C.GREEN,
    hint: '选择"在浏览器中打开"选项',
  },
  {
    num: '❸',
    title: '浏览器弹出安装提示，点击添加',
    desc: '浏览器底部会弹出"添加到桌面"提示',
    animEmoji: '📲',
    animBg: 'rgba(212,175,55,0.12)',
    dotColor: C.GOLD,
    hint: '点击浏览器底部的"添加到主屏幕"',
  },
];

// ── 单步骤卡片 ────────────────────────────────────────────
function StepCard({
  step, active, index: _index,
}: { step: typeof STEPS[0]; active: boolean; index: number }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(active ? 1 : 0.35)).current;
  const mockAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: active ? 1 : 0.35, duration: 300, useNativeDriver: true }).start();
    if (active) {
      const pulse = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      pulse.start();
      // 模拟动效
      const mock = Animated.loop(Animated.sequence([
        Animated.timing(mockAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(mockAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ]));
      mock.start();
      return () => { pulse.stop(); mock.stop(); };
    }
  }, [active, fadeAnim, pulseAnim, mockAnim]);

  return (
    <Animated.View style={{
      opacity: fadeAnim,
      backgroundColor: active ? step.animBg : 'transparent',
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: active ? step.dotColor : C.BORDER,
      padding: 14,
      gap: 10,
    }}>
      {/* 数字 + 标题 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Animated.Text style={{
          fontSize: 28,
          transform: [{ scale: active ? pulseAnim : new Animated.Value(1) }],
        }}>
          {step.num}
        </Animated.Text>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>{step.title}</Text>
          <Text style={{ color: C.GRAY, fontSize: 11, marginTop: 2 }}>{step.desc}</Text>
        </View>
      </View>

      {/* 动图模拟区域 */}
      {active && (
        <Animated.View style={{
          backgroundColor: `${step.dotColor}18`,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: `${step.dotColor}40`,
          padding: 16,
          alignItems: 'center',
          opacity: mockAnim,
        }}>
          <Text style={{ fontSize: 36 }}>{step.animEmoji}</Text>
          <Text style={{ color: step.dotColor, fontSize: 11, marginTop: 6, textAlign: 'center' }}>{step.hint}</Text>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ── 主组件 ────────────────────────────────────────────────
export default function WechatInstallGuide() {
  const [visible, setVisible] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [copied, setCopied] = useState(false);

  // 标题滑入动画
  const titleSlide = useRef(new Animated.Value(30)).current;
  const titleFade = useRef(new Animated.Value(0)).current;
  // 标签弹出动画（3个）
  const tagAnims = useRef([0, 1, 2].map(() => ({
    slide: new Animated.Value(-20),
    fade: new Animated.Value(0),
  }))).current;
  // 呼吸灯按钮
  const btnPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isWechatBrowser() || isStandalone()) return;
    // 延2秒弹出
    const t = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!visible) return;

    // 标题滑入
    Animated.parallel([
      Animated.timing(titleSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
      Animated.timing(titleFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    // 标签依次弹出
    tagAnims.forEach((anim, i) => {
      setTimeout(() => {
        Animated.parallel([
          Animated.timing(anim.slide, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.timing(anim.fade, { toValue: 1, duration: 300, useNativeDriver: true }),
        ]).start();
      }, 400 + i * 200);
    });

    // 按钮呼吸灯
    const btnLoop = Animated.loop(Animated.sequence([
      Animated.timing(btnPulse, { toValue: 1.04, duration: 1200, useNativeDriver: true }),
      Animated.timing(btnPulse, { toValue: 0.97, duration: 1200, useNativeDriver: true }),
    ]));
    btnLoop.start();

    // 步骤自动循环
    const stepTimers: ReturnType<typeof setTimeout>[] = [];
    const scheduleSteps = (startStep: number) => {
      stepTimers.forEach(clearTimeout);
      let cur = startStep;
      const advance = () => {
        cur = (cur + 1) % STEPS.length;
        setActiveStep(cur);
        stepTimers.push(setTimeout(advance, 1400));
      };
      stepTimers.push(setTimeout(advance, 1400));
    };
    scheduleSteps(0);

    return () => {
      btnLoop.stop();
      stepTimers.forEach(clearTimeout);
    };
  }, [visible, titleSlide, titleFade, tagAnims, btnPulse]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(APP_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const TAGS = ['✅ 实时护航守护', '✅ 极速环境检测', '✅ 一键安装'];

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{
        flex: 1, backgroundColor: 'rgba(0,0,0,0.88)',
        justifyContent: 'flex-end',
      }}>
        <View style={{
          backgroundColor: C.PANEL, borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderWidth: 1, borderColor: C.BORDER,
          maxHeight: '90%',
        }}>
          {/* 把手 */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: C.GRAY2 }} />
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 标题滑入 */}
            <Animated.View style={{
              transform: [{ translateY: titleSlide }],
              opacity: titleFade,
              alignItems: 'center', gap: 6,
            }}>
              <Text style={{ color: C.WHITE, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
                📱 一键安装到桌面
              </Text>
              <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center' }}>
                请在外部浏览器中打开，安装更流畅
              </Text>
            </Animated.View>

            {/* 核心优势标签 */}
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              {TAGS.map((tag, i) => (
                <Animated.View key={tag} style={{
                  transform: [{ translateX: tagAnims[i].slide }],
                  opacity: tagAnims[i].fade,
                  backgroundColor: C.BLUE_BG,
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
                  borderWidth: 1, borderColor: `${C.BLUE}40`,
                }}>
                  <Text style={{ color: C.WHITE, fontSize: 11, fontWeight: '600' }}>{tag}</Text>
                </Animated.View>
              ))}
            </View>

            {/* 步骤卡片 */}
            <View style={{ gap: 10 }}>
              {STEPS.map((step, i) => (
                <Pressable key={i} onPress={() => setActiveStep(i)}>
                  <StepCard step={step} active={activeStep === i} index={i} />
                </Pressable>
              ))}
            </View>

            {/* 步骤进度点 */}
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', alignItems: 'center' }}>
              {STEPS.map((step, i) => (
                <Pressable key={i} onPress={() => setActiveStep(i)}>
                  <View style={{
                    width: activeStep === i ? 20 : 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: activeStep === i ? step.dotColor : C.GRAY2,
                  }} />
                </Pressable>
              ))}
            </View>

            {/* 复制链接按钮 */}
            <Animated.View style={{ transform: [{ scale: btnPulse }] }}>
              <Pressable cssInterop={false}
                onPress={handleCopy}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                  borderRadius: 14, paddingVertical: 16, alignItems: 'center',
                  shadowColor: C.BLUE, shadowOpacity: 0.4, shadowRadius: 8,
                })}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                  {copied ? '✅ 链接已复制！请在浏览器粘贴访问' : '📋 复制链接，手动打开浏览器粘贴访问'}
                </Text>
              </Pressable>
            </Animated.View>

            <Text style={{ color: C.GRAY, fontSize: 11, textAlign: 'center' }}>
              推荐使用 Chrome 或手机自带浏览器
            </Text>

            {/* 关闭 */}
            <Pressable onPress={() => setVisible(false)} style={{ alignItems: 'center', paddingBottom: 8 }}>
              <Text style={{ color: C.GRAY2, fontSize: 13 }}>暂不安装</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
