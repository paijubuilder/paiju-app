/**
 * 护航Tab主页 v22
 * 优化一&二：新手引导横幅（呼吸动画）+ 信任标签 + 会员按钮提示文案
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, AppState, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Linking } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  checkStreakBreak, getIsFirstLaunch, getStreakDays, isMemberActive,
  isPrivacyAccepted, markFirstLaunchDone, getShouldShowUpdateBanner,
  markUpdateBannerShown, startGuard, recordGuardToday,
  isTutorialStepDone, getConfig, isAgentLoggedIn,
  getCurrentGuardId, renewGuardId, getGuardPhase,
  isFreeBannerDismissed, dismissFreeBanner,
  getHomeVariant,
} from '@/lib/appStore';
import { startGuardNotifications, stopGuardNotifications, recordGuardInteract } from '@/lib/guardNotifications';
import type { GuardNotif } from '@/lib/guardNotifications';
import PrivacyModal, { isPrivacyCachedAccepted } from '@/components/PrivacyModal';
import TutorialOverlay from '@/components/TutorialOverlay';
import WechatInstallGuide from '@/components/WechatInstallGuide';
import GuardNotifBanner from '@/components/GuardNotifBanner';

// ── 免费10分钟引导横幅（A/B测试方案展示，呼吸脉冲动画，点击护航后永久消失） ─
function FreeBanner({ onDismiss, onImpression }: { onDismiss: () => void; onImpression: () => void }) {
  const pulseAnim = useRef(new Animated.Value(0.6)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const impressed = useRef(false);

  // 获取当次会话的A/B方案
  const variant = getHomeVariant();

  useEffect(() => {
    // 记录一次展示
    if (!impressed.current) {
      impressed.current = true;
      onImpression();
    }
    // 呼吸光晕 loop
    const breath = Animated.loop(Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 0.55, duration: 1000, useNativeDriver: true }),
    ]));
    // 轻微脉冲缩放 loop
    const scale = Animated.loop(Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.015, duration: 900, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
    ]));
    breath.start();
    scale.start();
    return () => { breath.stop(); scale.stop(); };
  }, [pulseAnim, scaleAnim, onImpression]);

  return (
    <Animated.View style={{
      transform: [{ scale: scaleAnim }],
      marginHorizontal: 0, marginBottom: 10,
      borderRadius: 14, overflow: 'hidden',
    }}>
      {/* 呼吸背景光晕层 */}
      <Animated.View style={{
        position: 'absolute', inset: 0, borderRadius: 14,
        backgroundColor: '#D4AF3722', opacity: pulseAnim,
      }} />
      <View style={{
        borderRadius: 14, borderWidth: 1.5, borderColor: '#D4AF3780',
        paddingVertical: 11, paddingHorizontal: 16,
        gap: 3,
        backgroundColor: 'rgba(212,175,55,0.07)',
      }}>
        {/* 左侧呼吸灯点 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Animated.View style={{
            width: 8, height: 8, borderRadius: 4,
            backgroundColor: '#D4AF37', opacity: pulseAnim, flexShrink: 0,
          }} />
          <Text style={{ flex: 1, color: '#D4AF37', fontSize: 13, fontWeight: 'bold', lineHeight: 18 }}>
            {variant.title}
          </Text>
        </View>
        {variant.subtitle ? (
          <Text style={{ color: '#B8960A', fontSize: 11, lineHeight: 16, paddingLeft: 16 }}>
            {variant.subtitle}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  );
}

// ── 启动光圈扩散动画（约1.5秒，蓝→金） ───────────────────
function LaunchRingOverlay({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;
  const opacity1 = useRef(new Animated.Value(0.8)).current;
  const opacity2 = useRef(new Animated.Value(0.6)).current;
  const opacity3 = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    if (!visible) return;
    const animate = (scale: Animated.Value, opacity: Animated.Value, delay: number) =>
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0, duration: 1000, useNativeDriver: true }),
        ]),
      ]);
    Animated.parallel([
      animate(ring1, opacity1, 0),
      animate(ring2, opacity2, 200),
      animate(ring3, opacity3, 400),
    ]).start(() => setTimeout(onDone, 100));
  }, [visible, ring1, ring2, ring3, opacity1, opacity2, opacity3, onDone]);

  if (!visible) return null;
  const ringStyle = (scale: Animated.Value, opacity: Animated.Value) => ({
    position: 'absolute' as const,
    width: 300, height: 300, borderRadius: 150, borderWidth: 2,
    borderColor: C.GOLD, transform: [{ scale }], opacity,
  });
  return (
    <View style={{ position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', zIndex: 200, pointerEvents: 'none' }}>
      <Animated.View style={ringStyle(ring1, opacity1)} />
      <Animated.View style={ringStyle(ring2, opacity2)} />
      <Animated.View style={ringStyle(ring3, opacity3)} />
      <View style={{ alignItems: 'center', gap: 10 }}>
        <Text style={{ fontSize: 44 }}>🛡️</Text>
        <Text style={{ color: C.GOLD, fontSize: 14, fontWeight: 'bold' }}>护航系统启动中...</Text>
      </View>
    </View>
  );
}

// ── 动态遮罩新手引导 ─────────────────────────────────────
const GUIDE_STEPS = [
  { icon: '🃏', title: '第一步：进入牌局', desc: '先打开您喜欢的对局游戏，进入房间准备开局。', arrowDir: 'none' as const },
  { icon: '🛡️', title: '💬 点击「开始护航」', desc: '回到本App，点击下方高亮的【开始护航】按钮，系统立刻启动全程守护。', arrowDir: 'down' as const },
  { icon: '📊', title: '第三步：查看报告', desc: '护航完成后，可在记录页查看护航报告；也可开通会员享受持续守护。', arrowDir: 'none' as const },
];
function FirstLaunchGuide({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    markFirstLaunchDone();
    Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const cur = GUIDE_STEPS[step];
  const next = () => {
    if (step < GUIDE_STEPS.length - 1) {
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]).start();
      setStep(s => s + 1);
    } else {
      Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => onDone());
    }
  };

  return (
    <Modal visible transparent animationType="none">
      <Animated.View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', opacity: fadeAnim, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ backgroundColor: C.PANEL, borderRadius: 20, borderWidth: 1.5, borderColor: C.BLUE, padding: 28, width: '100%', gap: 18, alignItems: 'center' }}>
          <Text style={{ fontSize: 52 }}>{cur.icon}</Text>
          <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold', textAlign: 'center' }}>{cur.title}</Text>
          <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 22 }}>{cur.desc}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {GUIDE_STEPS.map((_, i) => <View key={i} style={{ width: i === step ? 20 : 8, height: 8, borderRadius: 4, backgroundColor: i === step ? C.BLUE : C.BORDER }} />)}
          </View>
          <Pressable cssInterop={false} onPress={next} style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 14, paddingVertical: 13, alignItems: 'center', width: '100%' })}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>{step < GUIDE_STEPS.length - 1 ? '下一步 →' : '开始使用'}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ── 高亮「开始护航」按钮（新手教程第2步） ────────────────
function HighlightGuardBtn({ onPress }: { onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.06, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View style={{ transform: [{ scale: pulse }], width: '100%', marginVertical: 10 }}>
      <Pressable onPress={onPress} style={{ backgroundColor: C.BLUE, borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 2, borderColor: C.GOLD, boxShadow: `0 0 20px ${C.GOLD}60` }}>
        <Text style={{ fontSize: 36 }}>🛡️</Text>
        <Text style={{ color: C.GOLD, fontSize: 17, fontWeight: 'bold', marginTop: 6 }}>🛡️ 免费护航10分钟</Text>
        <Text style={{ color: '#cce', fontSize: 11, marginTop: 4 }}>扫描牌局隐患，别再输得不明不白</Text>
      </Pressable>
    </Animated.View>
  );
}

// ── 首次通知权限引导弹窗 ─────────────────────────────────
function NotifPermGuide({ visible, onEnable, onSkip }: {
  visible: boolean; onEnable: () => void; onSkip: () => void;
}) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ backgroundColor: '#151820', borderRadius: 20, borderWidth: 1.5, borderColor: C.BLUE, padding: 28, gap: 16, alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: 44 }}>🔔</Text>
          <Text style={{ color: '#F0F4FF', fontSize: 17, fontWeight: 'bold', textAlign: 'center' }}>开启通知权限</Text>
          <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
            开启通知后，护航状态将通过通知栏实时提醒您。{'\n'}即使切换到其他应用，也能随时了解护航进度。
          </Text>
          <Pressable cssInterop={false}
            onPress={onEnable}
            style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%' })}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>🔔 去开启</Text>
          </Pressable>
          <Pressable onPress={onSkip}>
            <Text style={{ color: '#556677', fontSize: 13 }}>稍后再说</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// 记录是否已引导过通知权限（内存级，每次启动只引导一次）
let _notifPermAsked = false;

function getAllCards() {
  const cfg = getConfig();
  const daily30 = (parseFloat(cfg.cost30Day) / 30).toFixed(1);
  return [
    { id: 'guard',   emoji: '🛡️', title: '🛡️ 免费护航10分钟',  desc: '扫描牌局隐患，别再输得不明不白',    color: '#2B7BFF', bg: 'rgba(43,123,255,0.12)', border: 'rgba(43,123,255,0.5)' },
    { id: 'records', emoji: '📋', title: '我的记录',  desc: '查看历次护航记录',      color: '#29C470', bg: 'rgba(41,196,112,0.10)', border: 'rgba(41,196,112,0.4)' },
    { id: 'member',  emoji: '💎', title: '开通会员',  desc: `🏆 80%牌友的选择 · 每天¥${daily30}`,    color: '#D4AF37', bg: 'rgba(212,175,55,0.10)', border: 'rgba(212,175,55,0.4)' },
    { id: 'agent',   emoji: '🏆', title: '代理中心',  desc: '推广返佣，合作共赢',    color: '#E05236', bg: 'rgba(224,82,54,0.10)',  border: 'rgba(224,82,54,0.4)'  },
    { id: 'cs',      emoji: '💬', title: '咨询客服',  desc: '有问题随时联系我们',    color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)', border: 'rgba(139,92,246,0.4)' },
  ] as const;
}

// ── 护航准备弹窗（步骤 + 离开检测 + 功能开关联动） ────────
function GuardFlowModal({ visible, onClose, onGuardStarted }: {
  visible: boolean; onClose: () => void; onGuardStarted: () => void;
}) {
  const [step, setStep] = useState(1);
  const [showNotLeftTip, setShowNotLeftTip] = useState(false);
  const [notifGranted, setNotifGranted] = useState<boolean | null>(null);
  const leftAppRef = useRef(false);

  // 从配置读取功能开关（每次弹窗打开时同步）
  const featureNotification = getConfig().featureNotification;
  // 总步骤数固定为 2（通知权限 + 进入牌局）
  const totalSteps = 2;
  const STEP_ENTER = 2;

  useEffect(() => {
    if (!visible) { setStep(1); leftAppRef.current = false; setNotifGranted(null); return; }
    // 通知开关关闭 → 不检测权限
    if (featureNotification) {
      try {
        if (typeof Notification !== 'undefined') {
          setNotifGranted(Notification.permission === 'granted');
        } else {
          setNotifGranted(false);
        }
      } catch { setNotifGranted(false); }
    }
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background' || next === 'inactive') {
        leaveTimer = setTimeout(() => { leftAppRef.current = true; }, 3000);
      } else if (next === 'active') {
        if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
      }
    });
    return () => { sub.remove(); if (leaveTimer) clearTimeout(leaveTimer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const openNotifSettings = () => {
    const u = 'android.settings.APP_NOTIFICATION_SETTINGS';
    Linking.canOpenURL(u).then(ok => ok ? Linking.openURL(u) : Linking.openSettings()).catch(() => Linking.openSettings());
    setTimeout(() => setNotifGranted(true), 3000);
  };
  const handleConfirm = () => {
    if (!leftAppRef.current) { setShowNotLeftTip(true); return; }
    onGuardStarted();
  };

  // 通知权限状态行：仅当通知开关开启时显示
  const NotifRow = () => {
    if (!featureNotification) return null;
    return (
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 10,
        backgroundColor: notifGranted ? 'rgba(41,196,112,0.08)' : 'rgba(255,100,80,0.08)',
        borderRadius: 10, borderWidth: 1,
        borderColor: notifGranted ? '#29C47050' : '#FF644F50',
        paddingVertical: 10, paddingHorizontal: 12,
      }}>
        <Text style={{ fontSize: 16 }}>{notifGranted ? '✅' : '⚠️'}</Text>
        <Text style={{ flex: 1, color: notifGranted ? '#29C470' : '#FF8870', fontSize: 12, lineHeight: 18 }}>
          {notifGranted ? '通知权限已开启，护航期间可收到实时提醒' : '通知权限未开启，护航期间将无法收到实时提醒'}
        </Text>
        {!notifGranted && (
          <Pressable cssInterop={false} onPress={openNotifSettings}
            style={({ pressed }) => ({ backgroundColor: pressed ? '#CC3020' : '#FF4433', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 })}>
            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>一键开启</Text>
          </Pressable>
        )}
      </View>
    );
  };

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#151820', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderRightWidth: 1.5, borderColor: C.BLUE, padding: 28, gap: 16 }}>
          {/* 进度点 — 随 totalSteps 动态调整 */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {Array.from({ length: totalSteps }, (_, i) => i + 1).map(s => (
              <View key={s} style={{ height: 6, borderRadius: 3, width: step === s ? 32 : 12, backgroundColor: step >= s ? C.BLUE : '#2A3040' }} />
            ))}
          </View>

          {/* 第一步：通知栏提醒权限 */}
          {step === 1 && <>
            <Text style={{ color: '#F0F4FF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>第一步：开启通知权限</Text>
            <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              护航状态将通过通知栏实时推送给您，护航期间不会错过任何关键提醒。
            </Text>
            <NotifRow />
            <Pressable onPress={() => setStep(STEP_ENTER)} style={{ alignItems: 'center' }}>
              <Text style={{ color: '#8899AA', fontSize: 13 }}>已开启，下一步 →</Text>
            </Pressable>
          </>}

          {/* 进入牌局步骤（最后一步） */}
          {step === STEP_ENTER && <>
            <Text style={{ color: '#F0F4FF', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>📱 请先进入牌局</Text>
            <View style={{ backgroundColor: '#1E2530', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#2A3550' }}>
              <Text style={{ color: '#C8D4E0', fontSize: 13, lineHeight: 22 }}>
                {'请切换到游戏，进入牌局并确认对局已开始后，再回到本App点击确认。\n\n'}
                <Text style={{ color: '#FFAA33' }}>⚠️ 请务必在牌局开始后再确认</Text>
                {'，以确保检测的是真实对局环境。'}
              </Text>
            </View>
            <Pressable cssInterop={false} onPress={handleConfirm} style={({ pressed }) => ({ backgroundColor: pressed ? '#B8960A' : C.GOLD, borderRadius: 14, paddingVertical: 16, alignItems: 'center' })}>
              <Text style={{ color: '#0D0F12', fontSize: 15, fontWeight: 'bold' }}>✅ 我已开局，开始护航</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ alignItems: 'center' }}>
              <Text style={{ color: '#8899AA', fontSize: 13 }}>稍后再说</Text>
            </Pressable>
          </>}

          {showNotLeftTip && (
            <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.9)', borderTopLeftRadius: 24, borderTopRightRadius: 24, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
              <Text style={{ fontSize: 40 }}>⚠️</Text>
              <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>请先切换到游戏</Text>
              <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>请先切换到游戏，进入牌局后再回来确认。这样才能确保检测的是您的真实牌局环境。</Text>
              <Pressable cssInterop={false} onPress={() => setShowNotLeftTip(false)} style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 36 })}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>知道了</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ── 护航就绪确认弹窗 ─────────────────────────────────────
function GuardConfirmModal({ visible, onGoGame }: { visible: boolean; onGoGame: () => void }) {
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.82)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{ backgroundColor: '#151820', borderRadius: 20, borderWidth: 1.5, borderColor: '#29C470', padding: 28, gap: 16, alignItems: 'center', width: '100%' }}>
          <Text style={{ fontSize: 44 }}>✅</Text>
          <Text style={{ color: '#F0F4FF', fontSize: 17, fontWeight: 'bold', textAlign: 'center' }}>确认已开局，护航系统启动中...</Text>
          <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
            {'⏳ 护航将在后台运行，您可切换到游戏正常对局。\n护航时长10分钟，完成后会通知您。'}
          </Text>
          <Pressable cssInterop={false} onPress={onGoGame} style={({ pressed }) => ({ backgroundColor: pressed ? '#1F8A50' : '#29C470', borderRadius: 14, paddingVertical: 14, alignItems: 'center', width: '100%' })}>
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>切换到游戏</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── 主页面 ───────────────────────────────────────────────
export default function HomeTab() {
  const router = useRouter();
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showGuardFlow, setShowGuardFlow] = useState(false);
  const [showGuardConfirm, setShowGuardConfirm] = useState(false);
  const [showFirstGuide, setShowFirstGuide] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [versionUpdateUrl, setVersionUpdateUrl] = useState('');
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showTutorialStep1, setShowTutorialStep1] = useState(false);
  const [showRingAnim, setShowRingAnim] = useState(false);
  const streak = useRef(0);

  // 免费横幅：读 localStorage，未消失则展示
  const [showFreeBanner, setShowFreeBanner] = useState(() => !isFreeBannerDismissed());

  const [memberActive, setMemberActive] = useState(isMemberActive());
  const [agentActive, setAgentActive] = useState(isAgentLoggedIn());
  const [currentNotif, setCurrentNotif] = useState<GuardNotif | null>(null);
  const [showNotifPermGuide, setShowNotifPermGuide] = useState(false);

  useFocusEffect(useCallback(() => {
    checkStreakBreak();
    streak.current = getStreakDays();
    setMemberActive(isMemberActive());
    setAgentActive(isAgentLoggedIn());
    // 用户回到主页 → 记录交互，重置无响应静默计时器
    recordGuardInteract();

    if (!isPrivacyAccepted() && !isPrivacyCachedAccepted()) {
      setShowPrivacy(true);
      return;
    }
    if (getIsFirstLaunch()) { setShowFirstGuide(true); }

    // ── 修改六：App内护航结果保留 ────────────────────────
    // 用户回到主页时，如护航仍在进行或已完成，自动恢复到对应页面
    // 确保即使通知未送达，用户也不会丢失护航状态
    const phase = getGuardPhase();
    if (phase === 'detecting' || phase === 'guarding' || phase === 'waiting') {
      // 护航进行中 → 跳回护航检测页
      router.replace('/(app)/detect' as never);
      return;
    }
    if (phase === 'expired') {
      // 护航已结束 → 跳到诱导页（不重复引导）
      router.replace('/(app)/activation' as never);
      return;
    }

    const cfg = getConfig();
    // 自动更新开关关闭时，不弹出新版本提示
    if (cfg.featureAutoUpdate) {
      if (cfg.latestApkUrl?.trim()) {
        if (getShouldShowUpdateBanner()) {
          setVersionUpdateUrl(cfg.latestApkUrl.trim());
          setShowVersionModal(true);
          markUpdateBannerShown();
        }
      } else if (getShouldShowUpdateBanner()) {
        setShowUpdateBanner(true);
        markUpdateBannerShown();
        setTimeout(() => setShowUpdateBanner(false), 2500);
      }
    }
    if (!isTutorialStepDone('step1')) {
      setTimeout(() => setShowTutorialStep1(true), 1200);
    }
  }, [router]));

  // 修改五：未付费用户仅显示3个卡片；付费用户显示全部（代理需已登录）
  const visibleCards = memberActive
    ? getAllCards().filter(c => c.id !== 'cs' && (c.id !== 'agent' || agentActive))
    : getAllCards().filter(c => c.id === 'guard' || c.id === 'member' || c.id === 'cs');

  const handleCardPress = (id: string) => {
    if (id === 'guard')   { setShowGuardFlow(true); return; }
    if (id === 'records') { router.push('/(app)/game-records'); return; }
    if (id === 'member')  { router.push('/(app)/activation'); return; }
    if (id === 'agent')   { router.push(agentActive ? '/(app)/agent-center' : '/(app)/agent-intro' as never); return; }
    if (id === 'cs')      { router.push('/(app)/user-feedback'); return; }
  };

  const handleGuardStarted = () => {
    recordGuardToday();
    startGuard();
    renewGuardId();
    setShowGuardFlow(false);
    setShowGuardConfirm(true);
    // 点击开始护航 → 横幅永久消失
    if (showFreeBanner) { dismissFreeBanner(); setShowFreeBanner(false); }
    // 通知开关开启时才启动差异化通知策略
    if (getConfig().featureNotification) {
      const isMember = isMemberActive();
      startGuardNotifications((notif) => {
        setCurrentNotif(notif);
      }, isMember);
    }
  };

  const handleGoGame = () => {
    setShowGuardConfirm(false);
    setShowRingAnim(true);
    // 通知开关开启时才弹出权限引导
    if (!_notifPermAsked && getConfig().featureNotification) {
      _notifPermAsked = true;
      setTimeout(() => setShowNotifPermGuide(true), 800);
    }
  };

  // 离开主页时停止通知节奏
  useEffect(() => {
    return () => { stopGuardNotifications(); };
  }, []);

  const guardId = getCurrentGuardId();

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 更新提示Banner */}
      {showUpdateBanner && (
        <View style={{ position: 'absolute', top: 52, left: 20, right: 20, zIndex: 100, backgroundColor: C.PANEL, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 10, alignItems: 'center' }}>
          <Text style={{ color: C.GRAY, fontSize: 11 }}>✅ 已更新到最新版本</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 20 }} contentInsetAdjustmentBehavior="automatic">
        {/* 顶部：App名称 + 连续护航天数（仅付费用户显示天数） */}
        <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold' }}>🛡️ 牌局环境守护</Text>
              <Text style={{ color: C.GRAY, fontSize: 11, marginTop: 2 }}>GAME GUARD PRO</Text>
            </View>
            {memberActive && (
              <View style={{ backgroundColor: `${C.STREAK}18`, borderRadius: 12, borderWidth: 1, borderColor: `${C.STREAK}50`, paddingHorizontal: 14, paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: C.STREAK, fontSize: 20, fontWeight: 'bold' }}>{streak.current > 0 ? streak.current : '—'}</Text>
                <Text style={{ color: C.STREAK, fontSize: 9, fontWeight: 'bold' }}>连续护航天</Text>
              </View>
            )}
          </View>

          {/* 会员状态 */}
          <View style={{ marginTop: 14, backgroundColor: memberActive ? 'rgba(41,196,112,0.10)' : C.PANEL2, borderRadius: 10, borderWidth: 1, borderColor: memberActive ? 'rgba(41,196,112,0.4)' : C.BORDER, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 14 }}>{memberActive ? '✅' : '🔒'}</Text>
            <Text style={{ color: memberActive ? '#29C470' : C.GRAY, fontSize: 12 }}>
              {memberActive ? '会员护航中 · 全程守护' : '体验版 · 开通会员享持续护航'}
            </Text>
          </View>
        </View>

        {/* 意图卡片 2×2（新手引导时高亮护航按钮） */}
        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          {showTutorialStep1 ? (
            <HighlightGuardBtn onPress={() => {
              setShowTutorialStep1(false);
              dismissFreeBanner(); setShowFreeBanner(false);
              
              setShowGuardFlow(true);
            }} />
          ) : (
            <>
              {/* 免费横幅 — 仅未消失时显示，渲染在卡片网格正上方 */}
              {showFreeBanner && <FreeBanner
                onDismiss={() => { dismissFreeBanner(); setShowFreeBanner(false); }}
                onImpression={() => {}}
              />}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                {visibleCards.map(card => (
                  <Pressable cssInterop={false}
                    key={card.id}
                    onPress={() => handleCardPress(card.id)}
                    style={({ pressed }) => ({
                      width: visibleCards.length % 2 === 1 && visibleCards[visibleCards.length - 1].id === card.id ? '100%' : '47.5%',
                      backgroundColor: pressed ? C.PANEL2 : card.bg,
                      borderRadius: 18, borderWidth: 1.5, borderColor: card.border,
                      padding: 20, gap: 10, alignItems: 'center',
                      opacity: pressed ? 0.85 : 1,
                      boxShadow: `0 2px 8px ${card.color}20`,
                    })}
                  >
                    <Text style={{ fontSize: 36 }}>{card.emoji}</Text>
                    <Text style={{ color: card.color, fontSize: 15, fontWeight: 'bold', textAlign: 'center' }}>{card.title}</Text>
                    <Text style={{ color: C.GRAY, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>{card.desc}</Text>
                    {/* 开通会员按钮下方附加提示文案 */}
                    {card.id === 'member' && (
                      <Text style={{ color: C.GRAY2, fontSize: 9, textAlign: 'center', lineHeight: 13 }}>首次使用可免费护航10分钟</Text>
                    )}
                  </Pressable>
                ))}
              </View>
            </>
          )}
        </View>

        {/* 底部页脚 */}
        <View style={{ marginTop: 32, marginHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.BORDER2, flexDirection: 'row', justifyContent: 'center', gap: 4, alignItems: 'center' }}>
          <Pressable onPress={() => router.push('/(app)/install-guide')}>
            <Text style={{ color: '#555', fontSize: 11 }}>安装指南</Text>
          </Pressable>
          <Text style={{ color: '#333', fontSize: 11 }}> · </Text>
          <Pressable onPress={() => router.push('/(app)/user-feedback')}>
            <Text style={{ color: '#555', fontSize: 11 }}>用户反馈</Text>
          </Pressable>
        </View>
        {/* 版本号：自动更新关闭时常驻显示 */}
        <View style={{ alignItems: 'center', marginTop: 6, marginBottom: 4 }}>
          {!getConfig().featureAutoUpdate && (
            <Text style={{ color: C.GRAY2, fontSize: 10 }}>当前版本 v1.0</Text>
          )}
        </View>
        <View style={{ alignItems: 'center', marginTop: 2 }}>
          <Text style={{ color: C.GRAY2, fontSize: 10 }}>护航任务编号：{guardId}</Text>
        </View>
        {/* 信任标签 */}
        <View style={{ alignItems: 'center', marginTop: 4, marginBottom: 8 }}>
          <Text style={{ color: C.GRAY2, fontSize: 9 }}>✅ 10分钟免费护航 | ✅ 无需任何支付信息</Text>
        </View>
      </ScrollView>

      {/* 主动引导式护航流程弹窗 */}
      <GuardFlowModal
        visible={showGuardFlow}
        onClose={() => setShowGuardFlow(false)}
        onGuardStarted={handleGuardStarted}
      />

      {/* 护航就绪确认弹窗 */}
      <GuardConfirmModal visible={showGuardConfirm} onGoGame={handleGoGame} />

      {/* 首次引导弹窗 */}
      {showFirstGuide && <FirstLaunchGuide onDone={() => setShowFirstGuide(false)} />}

      {/* 微信内安装引导 */}
      <WechatInstallGuide />

      {/* 版本更新弹窗 */}
      <Modal visible={showVersionModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <View style={{ backgroundColor: C.PANEL, borderRadius: 20, borderWidth: 1, borderColor: C.BORDER, padding: 24, width: '100%', gap: 16 }}>
            <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold', textAlign: 'center' }}>🆕 发现新版本</Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>管理员发布了新版本，建议更新以获得最佳体验</Text>
            <View style={{ gap: 10 }}>
              <Pressable cssInterop={false}
                onPress={() => { setShowVersionModal(false); if (versionUpdateUrl) { Linking.openURL(versionUpdateUrl).catch(() => router.push('/(app)/install-guide')); } else { router.push('/(app)/install-guide'); } }}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 13, alignItems: 'center' })}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>立即更新</Text>
              </Pressable>
              <Pressable onPress={() => setShowVersionModal(false)} style={{ paddingVertical: 11, alignItems: 'center' }}>
                <Text style={{ color: C.GRAY, fontSize: 13 }}>稍后再说</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <PrivacyModal visible={showPrivacy} onAccept={() => setShowPrivacy(false)} />

      {/* 教程第一步引导覆盖 */}
      <TutorialOverlay config={{
        step: 'step1', visible: showTutorialStep1,
        title: '点击这里，开始护航',
        body: '💬 点击这里，开启您的第一次护航。护航系统将自动检测牌局环境，全程守护您的安全。',
        actionLabel: '下一步',
        onAction: () => setShowTutorialStep1(false),
      }} />

      {/* 启动光圈动画 */}
      <LaunchRingOverlay
        visible={showRingAnim}
        onDone={() => { setShowRingAnim(false); router.push('/(app)/permission-guide' as never); }}
      />

      {/* 护航通知横幅（通知节奏） */}
      <GuardNotifBanner
        notif={currentNotif}
        onDismiss={() => setCurrentNotif(null)}
        onPress={(notif) => {
          // 用户点击通知 → 记录交互，按通知目标路由跳转
          recordGuardInteract();
          setCurrentNotif(null);
          if (notif.clickable && notif.targetRoute) {
            router.push(notif.targetRoute as never);
          }
        }}
      />

      {/* 首次通知权限引导（修改六） */}
      <NotifPermGuide
        visible={showNotifPermGuide}
        onEnable={() => { setShowNotifPermGuide(false); Linking.openSettings(); }}
        onSkip={() => setShowNotifPermGuide(false)}
      />
    </View>
  );
}
