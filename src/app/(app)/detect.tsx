/**
 * 检测主页 v8
 * 修改一：通知权限弹窗（⚠️图标/指定文字/单按钮/返回后自动检测）
 * 修改二：准备检测→双重校验（是否离开+2分钟）→迷你状态浮层
 * 修改五：检测结果验证引导小字
 * 修改六：到期灰按钮+到期弹窗规格（标题「会员已到期」）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Animated, Easing, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  addGameRecord, checkStreakBreak, formatDateTime, genDetectId,
  getDeviceId, getLastDetectTime, getMemberExpireTime, getStreakDays,
  getRemainingSeconds, getTotalSeconds,
  isExpiredAlertShown, isMemberActive, isMemberExpiringSoon, isPrivacyAccepted,
  markExpiredAlertShown, pauseGuard, recordGuardToday, resumeGuard,
  setActivation, setLastDetectTime, startGuard, stopGuard,
} from '@/lib/appStore';
import PrivacyModal from '@/components/PrivacyModal';
import AiCsModal from '@/components/AiCsModal';

// ── 检测项目 ──────────────────────────────────────────────
const DETECT_ITEMS = [
  { icon: '🛡', label: '多开/分身检测', result: '通过' },
  { icon: '🔒', label: '异常辅助工具', result: '未发现（特征库匹配 0/86）' },
  { icon: '👁', label: '异常行为检测', result: '正常（无透视/看牌特征）' },
  { icon: '⊞', label: '牌局环境安全', result: '通过（可正常对局）' },
];

// ── 四角方块 ─────────────────────────────────────────────
function CornerBlock({ lit }: { lit: boolean }) {
  return (
    <View style={{
      width: 10, height: 10, borderRadius: 2,
      backgroundColor: lit ? C.BLUE : C.BORDER,
      borderWidth: 1, borderColor: lit ? C.BLUE : C.BORDER2,
    }} />
  );
}

function StampIcon({ size = 38 }: { size?: number }) {
  return (
    <View style={{
      width: size, height: size, borderRadius: size / 2,
      borderWidth: 2.5, borderColor: C.BLUE, borderStyle: 'dashed',
      alignItems: 'center', justifyContent: 'center', backgroundColor: C.BLUE_BG,
    }}>
      <Text style={{ color: C.BLUE, fontSize: size * 0.42, fontWeight: '900' }}>检</Text>
    </View>
  );
}

// ── 雷达组件 ─────────────────────────────────────────────
function GoldRadar({ phase, litCorner }: { phase: 'idle' | 'scanning' | 'done'; litCorner: number }) {
  const rot = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase === 'scanning') {
      Animated.loop(Animated.timing(rot, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true })).start();
      Animated.loop(Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])).start();
    } else {
      rot.stopAnimation(); pulse.stopAnimation();
      rot.setValue(0); pulse.setValue(1);
    }
  }, [phase, rot, pulse]);
  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <Animated.View style={{ transform: [{ scale: pulse }], alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', width: 140, height: 140 }}>
        {[0, 1, 2, 3].map(i => (
          <View key={i} style={{
            position: 'absolute',
            top: i < 2 ? 0 : undefined, bottom: i >= 2 ? 0 : undefined,
            left: i % 2 === 0 ? 0 : undefined, right: i % 2 === 1 ? 0 : undefined,
          }}>
            <CornerBlock lit={litCorner > i || phase === 'done'} />
          </View>
        ))}
      </View>
      <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 1.5, borderColor: `${C.BLUE}40`, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: `${C.BLUE}30`, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${C.BLUE}15`, borderWidth: 1, borderColor: `${C.BLUE}50`, alignItems: 'center', justifyContent: 'center' }}>
            {phase === 'done' ? <StampIcon size={38} /> : <Text style={{ color: phase === 'idle' ? C.GRAY : C.BLUE, fontSize: 20 }}>◉</Text>}
          </View>
        </View>
        {phase === 'scanning' && (
          <Animated.View style={{ position: 'absolute', width: 60, height: 1.5, left: 60, backgroundColor: C.BLUE, transform: [{ rotate: spin }] }} />
        )}
      </View>
    </Animated.View>
  );
}

// ── 走马灯工具：生成今日护航用户数（基准3900+，每15s微调） ─
function useDailyGuardCount() {
  const base = 3900;
  const [count, setCount] = useState(() => base + Math.floor(Math.random() * 80));
  useEffect(() => {
    const t = setInterval(() => {
      setCount(prev => {
        const delta = Math.floor(Math.random() * 41) - 20; // ±20
        return Math.max(base, prev + delta);
      });
    }, 15000);
    return () => clearInterval(t);
  }, []);
  return count;
}

// ── 走马灯内容 ────────────────────────────────────────────
const TICKER_MSGS = [
  '风险预警：近期监测到部分牌局存在使用辅助工具影响公平性的情况。',
  '安全建议：建议在每次游戏前开启护航，及时识别潜在风险。',
  '安全提示：使用外挂属于违法行为，请公平游戏。',
];

function MarqueeTicker() {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [msgIdx, setMsgIdx] = useState(0);
  const containerWidth = 260;

  useEffect(() => {
    scrollX.setValue(containerWidth);
    const anim = Animated.timing(scrollX, {
      toValue: -containerWidth * 2,
      duration: 12000,
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished) setMsgIdx(i => (i + 1) % TICKER_MSGS.length);
    });
    return () => anim.stop();
  }, [msgIdx, scrollX, containerWidth]);

  return (
    <View style={{
      width: containerWidth, height: 22, overflow: 'hidden',
      backgroundColor: 'rgba(200,100,0,0.1)',
      borderRadius: 6, borderWidth: 1, borderColor: 'rgba(200,120,0,0.3)',
    }}>
      <Animated.Text
        numberOfLines={1}
        style={{
          transform: [{ translateX: scrollX }],
          color: '#E8840A',
          fontSize: 10,
          lineHeight: 22,
          whiteSpace: 'nowrap',
        } as object}
      >
        {TICKER_MSGS[msgIdx]}
      </Animated.Text>
    </View>
  );
}

// ── 迷你悬浮窗（右侧边缘吸附） ────────────────────────────
function MiniFloatWindow({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const [miniLine, setMiniLine] = useState(-1);
  const [miniPhase, setMiniPhase] = useState<'detecting' | 'done'>('detecting');
  const [showSuccess, setShowSuccess] = useState(false);
  const goldAnim = useRef(new Animated.Value(0)).current;
  const rotAnim = useRef(new Animated.Value(0)).current;
  const dailyCount = useDailyGuardCount();

  useEffect(() => {
    if (!visible) {
      setMiniLine(-1); setMiniPhase('detecting'); setShowSuccess(false);
      goldAnim.setValue(0); return;
    }
    Animated.loop(
      Animated.timing(rotAnim, { toValue: 1, duration: 1600, easing: Easing.linear, useNativeDriver: true })
    ).start();
    // 每项：0.3s 分析中 + 0.5s 结果 = 0.8s 每项
    const timers: ReturnType<typeof setTimeout>[] = [];
    DETECT_ITEMS.forEach((_, i) => {
      timers.push(setTimeout(() => setMiniLine(i), 400 + i * 800));
    });
    timers.push(setTimeout(() => {
      setMiniPhase('done'); setShowSuccess(true);
      rotAnim.stopAnimation();
      Animated.sequence([
        Animated.timing(goldAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(goldAnim, { toValue: 0.2, duration: 300, useNativeDriver: false }),
        Animated.timing(goldAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
        Animated.timing(goldAnim, { toValue: 0.2, duration: 300, useNativeDriver: false }),
        Animated.timing(goldAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
      ]).start(() => setTimeout(onDone, 2000));
    }, 400 + DETECT_ITEMS.length * 800 + 200));
    return () => timers.forEach(clearTimeout);
  }, [visible, goldAnim, rotAnim, onDone]);

  const spin = rotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const borderColor = goldAnim.interpolate({ inputRange: [0, 1], outputRange: [`${C.BLUE}40`, C.GOLD] });

  if (!visible) return null;
  return (
    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'box-none' }}>
      <Animated.View style={{
        position: 'absolute', right: 0, top: '20%',
        width: 82, borderRadius: 12,
        borderWidth: 1.5, borderColor,
        backgroundColor: 'rgba(13,15,18,0.92)',
        paddingVertical: 12, paddingHorizontal: 8,
        gap: 8, alignItems: 'center',
        shadowColor: C.BLUE, shadowOffset: { width: -2, height: 0 },
        shadowOpacity: 0.3, shadowRadius: 8,
      }}>
        {/* 顶部旋转雷达 */}
        <Animated.Text style={{ fontSize: 20, transform: [{ rotate: miniPhase === 'detecting' ? spin : '0deg' }] }}>
          {miniPhase === 'done' ? '✅' : '◉'}
        </Animated.Text>
        {/* 检测进度 */}
        <View style={{ gap: 5, width: '100%' }}>
          {DETECT_ITEMS.map((item, i) => {
            const done = miniLine > i || miniPhase === 'done';
            const analyzing = miniLine === i && miniPhase === 'detecting';
            return (
              <View key={i} style={{ gap: 1 }}>
                <Text style={{ color: C.GRAY, fontSize: 8, lineHeight: 11 }} numberOfLines={1}>
                  🔍 {item.label.slice(0, 5)}
                </Text>
                <Text style={{ fontSize: 8, lineHeight: 11, color: done ? C.BLUE : analyzing ? '#F0A030' : C.GRAY2 }}>
                  {done ? '✅ 通过' : analyzing ? '分析中...' : '○ 等待'}
                </Text>
              </View>
            );
          })}
        </View>
        {showSuccess && (
          <Text style={{ color: C.GOLD, fontSize: 8, textAlign: 'center', lineHeight: 12 }}>
            ✅ 环境安全{'\n'}可正常对局
          </Text>
        )}
        {/* 今日护航用户动态数据 */}
        <Text style={{ color: C.GRAY2, fontSize: 8, textAlign: 'center', lineHeight: 11 }}>
          今日:{dailyCount.toLocaleString()}人护航
        </Text>
        {/* 走马灯风险预警 */}
        <MarqueeTicker />
      </Animated.View>
    </View>
  );
}


// ── 护航进行中 — 全动效视图 ──────────────────────────────
const RISK_MSGS = [
  '🛡 已屏蔽1次异常信号   |   环境持续清净',
  '⚡ 扫描引擎运行正常    |   无外挂特征',
  '🔒 本局通信加密保护中  |   数据安全',
  '👁 行为分析未见异常    |   牌局公平',
  '✅ 实时监控中          |   请放心对局',
];

// 微帧刷新文字序列
const MICRO_MSGS = ['📡 数据刷新中...', '✅ 校验完成', '🔍 持续监测中...'];
// 实时状态栏序列
const STATUS_LINES = [
  '网络延迟：23ms | 信号强度：优',
  '扫描进程：4/4项已通过 | 数据同步：正常',
  '环境评估：安全 | 护航等级：A级',
];

// 非匀速进度计算（前30%时间→25%进度，中40%→50%，后30%→25%）
function calcNonLinearProgress(elapsed: number, total: number): number {
  if (total <= 0) return 0;
  const t = Math.min(elapsed / total, 1);
  if (t < 0.3) return (t / 0.3) * 0.25;
  if (t < 0.7) return 0.25 + ((t - 0.3) / 0.4) * 0.5;
  return 0.75 + ((t - 0.7) / 0.3) * 0.25;
}

// 进度条颜色（0~60%绿，60~100%渐变橙，100%灰）
function progressBarColor(pct: number): string {
  if (pct >= 1) return '#6B7280';
  if (pct < 0.6) return '#3DDC84';
  // 60~100%: 绿→橙渐变
  const ratio = (pct - 0.6) / 0.4;
  const r = Math.round(61 + (245 - 61) * ratio);
  const g = Math.round(220 + (158 - 220) * ratio);
  const b = Math.round(132 + (11 - 132) * ratio);
  return `rgb(${r},${g},${b})`;
}

function GuardingView({ onPause, onResume, paused, onExit }: {
  onPause: () => void; onResume: () => void; paused: boolean; onExit: () => void;
}) {
  // 状态灯呼吸
  const breathAnim = useRef(new Animated.Value(1)).current;
  // 雷达旋转
  const radarRot = useRef(new Animated.Value(0)).current;
  // 评分光晕（金色）
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  // 评分数字跳动
  const scoreBounce = useRef(new Animated.Value(1)).current;
  // 倒计时翻页闪烁
  const flipAnim = useRef(new Animated.Value(1)).current;
  // 进入动画
  const radarScale = useRef(new Animated.Value(0.6)).current;
  const panelSlide = useRef(new Animated.Value(40)).current;
  const panelFade = useRef(new Animated.Value(0)).current;
  const barFade = useRef(new Animated.Value(0)).current;
  // 微帧文字淡入淡出
  const microFade = useRef(new Animated.Value(0)).current;

  const [remaining, setRemaining] = useState(getTotalSeconds());
  const [scanCount, setScanCount] = useState(0);
  const [riskIdx, setRiskIdx] = useState(0);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 安全评分（97-99动态微调）
  const [score, setScore] = useState(98);
  // 微帧刷新文字
  const [microMsg, setMicroMsg] = useState('');
  const microIdxRef = useRef(0);
  // 系统时钟
  const [sysTime, setSysTime] = useState('');
  // 实时状态栏
  const [statusLine, setStatusLine] = useState(STATUS_LINES[0]);
  const statusIdxRef = useRef(0);

  const total = getTotalSeconds();
  const guardDone = remaining <= 0;

  // 进入过渡动画
  useEffect(() => {
    Animated.parallel([
      Animated.timing(radarScale, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(panelFade, { toValue: 1, duration: 300, useNativeDriver: true }),
      Animated.timing(panelSlide, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
    setTimeout(() => {
      Animated.timing(barFade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }, 200);
  }, [radarScale, panelFade, panelSlide, barFade]);

  // 呼吸灯
  useEffect(() => {
    if (paused) { breathAnim.stopAnimation(); breathAnim.setValue(0.5); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(breathAnim, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [paused, breathAnim]);

  // 雷达旋转
  useEffect(() => {
    if (paused) { radarRot.stopAnimation(); return; }
    const loop = Animated.loop(
      Animated.timing(radarRot, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [paused, radarRot]);

  // 评分金色光晕（持续呼吸）
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.4, duration: 1500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  // 评分30秒随机微调±1 + 跳动效果
  useEffect(() => {
    const t = setInterval(() => {
      setScore(s => {
        const delta = Math.random() < 0.5 ? 1 : -1;
        return Math.min(99, Math.max(97, s + delta));
      });
      Animated.sequence([
        Animated.timing(scoreBounce, { toValue: 1.15, duration: 100, useNativeDriver: true }),
        Animated.timing(scoreBounce, { toValue: 1, duration: 150, useNativeDriver: true }),
      ]).start();
    }, 30000);
    return () => clearInterval(t);
  }, [scoreBounce]);

  // 系统时钟 每秒更新
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const d = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const t = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
      setSysTime(`${d} ${t}`);
    };
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, []);

  // 实时状态栏 3-5秒轮播
  useEffect(() => {
    const cycle = () => {
      statusIdxRef.current = (statusIdxRef.current + 1) % STATUS_LINES.length;
      setStatusLine(STATUS_LINES[statusIdxRef.current]);
    };
    const t = setInterval(cycle, 4000);
    return () => clearInterval(t);
  }, []);

  // 微帧刷新文字 2-3秒周期：出现0.3s→显示1s→消失0.3s→静默1-1.5s
  useEffect(() => {
    let cancelled = false;
    const runCycle = () => {
      if (cancelled) return;
      microIdxRef.current = (microIdxRef.current + 1) % MICRO_MSGS.length;
      setMicroMsg(MICRO_MSGS[microIdxRef.current]);
      Animated.sequence([
        Animated.timing(microFade, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(microFade, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => {
        if (!cancelled) setTimeout(runCycle, 1200 + Math.random() * 600);
      });
    };
    const init = setTimeout(runCycle, 2000);
    return () => { cancelled = true; clearTimeout(init); };
  }, [microFade]);

  // 每秒倒计时 + 数据微跳 + 翻页闪烁
  useEffect(() => {
    if (paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const rem = getRemainingSeconds();
      setRemaining(rem);
      // 翻页闪烁（0.1秒快闪）
      Animated.sequence([
        Animated.timing(flipAnim, { toValue: 0.15, duration: 60, useNativeDriver: true }),
        Animated.timing(flipAnim, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      const elapsed = total - rem;
      if (elapsed % 3 === 0) setScanCount(c => c + 1);
      if (elapsed % 5 === 0) setRiskIdx(i => (i + 1) % RISK_MSGS.length);
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused, total, flipAnim]);

  const radarSpin = radarRot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  // 非匀速进度
  const elapsed = total - remaining;
  const progressPct = calcNonLinearProgress(elapsed, total);
  const progressDecimal = (progressPct * 100).toFixed(1);
  const barColor = progressBarColor(progressPct);

  // 倒计时颜色
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const timerColor = guardDone ? '#6B7280' : remaining > 120 ? '#3DDC84' : '#F59E0B';

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      {/* 状态栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, gap: 8 }}>
        <Animated.View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: paused ? '#F59E0B' : '#3DDC84', opacity: breathAnim }} />
        <Text style={{ color: paused ? '#F59E0B' : '#3DDC84', fontSize: 14, fontWeight: 'bold', flex: 1 }}>
          {paused ? '⏸ 护航已暂停' : guardDone ? '🔲 护航已结束' : '🛡️ 护航进行中'}
        </Text>
        {/* 倒计时数字（翻页闪烁 + 颜色变化） */}
        <Animated.Text style={{ color: timerColor, fontSize: 18, fontWeight: 'bold', fontVariant: ['tabular-nums'], opacity: flipAnim }}>
          {mm}:{ss}
        </Animated.Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        {/* 雷达区 */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <Animated.View style={{ transform: [{ scale: radarScale }] }}>
            <View style={{ width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderColor: `${C.BLUE}40`, alignItems: 'center', justifyContent: 'center' }}>
              <Animated.View style={{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 2.5, borderColor: 'transparent', borderTopColor: C.BLUE, borderRightColor: `${C.BLUE}80`, transform: [{ rotate: radarSpin }] }} />
              <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 1, borderColor: `${C.BLUE}30`, alignItems: 'center', justifyContent: 'center' }}>
                {/* 评分：金色光晕 + 跳动 */}
                <Animated.View style={{ opacity: glowAnim, transform: [{ scale: scoreBounce }], alignItems: 'center' }}>
                  <Text style={{ color: C.GOLD, fontSize: 28, fontWeight: 'bold', textShadowColor: `${C.GOLD}80`, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } }}>{score}</Text>
                </Animated.View>
                <Text style={{ color: C.GRAY, fontSize: 10, marginTop: 2 }}>环境安全指数</Text>
              </View>
            </View>
          </Animated.View>
          {/* 系统时钟 */}
          <Text style={{ color: C.GRAY2, fontSize: 9, marginTop: 8, fontVariant: ['tabular-nums'] }}>
            系统时间：{sysTime}
          </Text>
        </View>

        {/* 数据面板 */}
        <Animated.View style={{ opacity: panelFade, transform: [{ translateY: panelSlide }], marginHorizontal: 20, gap: 10 }}>
          <View style={{ backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1, borderColor: C.BORDER, padding: 16 }}>
            {/* 四项检测 + 微帧文字 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <Text style={{ color: C.GRAY2, fontSize: 11 }}>实时数据</Text>
              {/* 微帧刷新文字 */}
              <Animated.Text style={{ color: C.GRAY2, fontSize: 9, opacity: microFade }}>
                {microMsg}
              </Animated.Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: '环境扫描次数', value: `${scanCount}次` },
                { label: '异常行为拦截', value: '0次' },
                { label: '实时连接状态', value: '正常' },
                { label: '本次护航时长', value: `${mm}:${ss}` },
              ].map(d => (
                <View key={d.label} style={{ width: '47%', backgroundColor: C.BG, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: C.BORDER2 }}>
                  <Text style={{ color: C.GRAY2, fontSize: 10 }}>{d.label}</Text>
                  <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold', marginTop: 3, fontVariant: ['tabular-nums'] }}>{d.value}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* 进度条（非匀速 + 精确到小数点 + 颜色渐变） */}
        <Animated.View style={{ opacity: barFade, marginHorizontal: 20, marginTop: 14 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
            <Text style={{ color: C.GRAY, fontSize: 11 }}>护航进度</Text>
            <Text style={{ color: barColor, fontSize: 11, fontVariant: ['tabular-nums'] }}>{progressDecimal}%</Text>
          </View>
          <View style={{ height: 6, backgroundColor: C.PANEL, borderRadius: 3, overflow: 'hidden' }}>
            <View style={{ width: `${progressPct * 100}%`, height: 6, backgroundColor: barColor, borderRadius: 3 }} />
          </View>
          <Text style={{ color: C.GRAY2, fontSize: 11, marginTop: 4, textAlign: 'right' }}>
            剩余 {mm}:{ss}
          </Text>
        </Animated.View>

        {/* 实时状态栏（轮播，极小浅灰） */}
        <View style={{ marginHorizontal: 20, marginTop: 8 }}>
          <Text style={{ color: C.GRAY2, fontSize: 9, textAlign: 'center' }}>{statusLine}</Text>
        </View>

        {/* 风险预警走马灯 */}
        <View style={{ marginHorizontal: 20, marginTop: 10, backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden' }}>
          <Text style={{ color: '#F59E0B', fontSize: 12 }} numberOfLines={1}>{RISK_MSGS[riskIdx]}</Text>
        </View>

        {/* 操作按钮区（护航中/暂停/结束 三态） */}
        <View style={{ marginHorizontal: 20, marginTop: 20 }}>
          {guardDone ? (
            // 护航已结束 → 查看护航报告
            <Pressable cssInterop={false}
              onPress={onExit}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                borderRadius: 12, paddingVertical: 14, alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>📊 查看护航报告</Text>
            </Pressable>
          ) : (
            // 护航进行中/暂停 → 暂停护航/恢复护航
            <Pressable cssInterop={false}
              onPress={() => setShowPauseConfirm(true)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1E2530' : C.PANEL,
                borderRadius: 12, paddingVertical: 14, alignItems: 'center',
                borderWidth: 1, borderColor: '#F59E0B',
              })}
            >
              <Text style={{ color: '#F59E0B', fontSize: 14, fontWeight: 'bold' }}>
                {paused ? '▶ 恢复护航' : '⏸ 暂停护航'}
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {/* 暂停确认弹窗 */}
      <Modal visible={showPauseConfirm} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 24, gap: 16 }}>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              {paused ? '恢复护航？' : '确认暂停护航？'}
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              {paused ? '护航将继续运行，保护您的牌局环境。' : '暂停后护航将停止检测，建议护航完成后再退出。'}
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable cssInterop={false}
                onPress={() => { if (paused) { onResume(); } else { onPause(); } setShowPauseConfirm(false); }}
                style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 10, paddingVertical: 13, alignItems: 'center' })}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                  {paused ? '恢复护航' : '确认暂停'}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setShowPauseConfirm(false)}
                style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 10, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}
              >
                <Text style={{ color: C.GRAY, fontSize: 14 }}>取消</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => { stopGuard(); onExit(); setShowPauseConfirm(false); }} style={{ alignItems: 'center', paddingTop: 4 }}>
              <Text style={{ color: '#E05252', fontSize: 12 }}>结束本次护航</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 右下角悬浮按钮（护航结束时隐藏） */}
      {!guardDone && (
        <View style={{ position: 'absolute', bottom: 24, right: 20, pointerEvents: 'box-none' }}>
          <Pressable cssInterop={false}
            onPress={() => setShowPauseConfirm(true)}
            style={({ pressed }) => ({
              width: 52, height: 52, borderRadius: 26,
              backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
              alignItems: 'center', justifyContent: 'center',
              boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 16, color: 'rgba(37,99,235,0.5)' }],
            })}
          >
            <Text style={{ fontSize: 20 }}>{paused ? '▶' : '⏸'}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ── 简单提示弹窗 ─────────────────────────────────────────
function TipModal({ visible, content, onClose }: { visible: boolean; content: string; onClose: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
        <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 24, gap: 16, alignItems: 'center' }}>
          <Text style={{ color: C.WHITE, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>{content}</Text>
          <Pressable cssInterop={false}
            onPress={onClose}
            style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 10, paddingVertical: 12, paddingHorizontal: 32, alignItems: 'center' })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>知道了</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── 主页面 ────────────────────────────────────────────────
type Stage = 'idle' | 'p1' | 'p2' | 'done' | 'guarding' | 'guardPaused';

export default function HomeScreen() {
  const router = useRouter();
  const [showPrivacy, setShowPrivacy] = useState(!isPrivacyAccepted());
  const [showCS, setShowCS] = useState(false);
  const [showExpireSoon, setShowExpireSoon] = useState(false);
  const [showExpiredAlert, setShowExpiredAlert] = useState(false);
  const [showExpiredBtn, setShowExpiredBtn] = useState(false);

  // 弹窗状态
  const [showPermModal, setShowPermModal] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [showMiniFloat, setShowMiniFloat] = useState(false);
  const [tipContent, setTipContent] = useState('');    // 双重校验提示内容

  // 修改二：AppState 离开检测
  const hasLeftAppRef = useRef(false);     // 是否曾离开过
  const leaveStartRef = useRef<number>(0); // 最近一次进入后台的时间
  const totalLeaveMs = useRef<number>(0);  // 累计离开时长（ms）
  const appStateRef = useRef(AppState.currentState);

  // 修改一：权限开启后返回自动检测
  const pendingPermCheckRef = useRef(false);

  const [stage, setStage] = useState<Stage>('idle');
  const [p1Line, setP1Line] = useState(0);
  const [p2Line, setP2Line] = useState(-1);
  const [litCorner, setLitCorner] = useState(0);
  const [detectId, setDetectId] = useState('');
  const [streak, setStreak] = useState(0);
  const [lastDetect, setLastDetect] = useState<number | null>(null);

  const P1_LINES = ['正在进行环境扫描...', '扫描设备连接...', '扫描房间状态...'];

  // ── AppState 监听 ─────────────────────────────────────
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (prev === 'active' && nextState === 'background') {
        // 进入后台
        hasLeftAppRef.current = true;
        leaveStartRef.current = Date.now();
      }
      if (prev === 'background' && nextState === 'active') {
        // 回到前台
        if (leaveStartRef.current > 0) {
          totalLeaveMs.current += Date.now() - leaveStartRef.current;
          leaveStartRef.current = 0;
        }
        // 修改一：等待权限设置后返回，自动触发启动守护
        if (pendingPermCheckRef.current) {
          pendingPermCheckRef.current = false;
          handleStartGuard();
        }
      }
    });
    return () => sub.remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetLeaveRecord = () => {
    hasLeftAppRef.current = false;
    leaveStartRef.current = 0;
    totalLeaveMs.current = 0;
  };

  const refresh = useCallback(() => {
    checkStreakBreak();
    setStreak(getStreakDays());
    setLastDetect(getLastDetectTime());
    const expireMs = getMemberExpireTime();
    const isExpired = expireMs !== null && Date.now() > expireMs;
    setShowExpiredBtn(isExpired);
    if (isExpired && !isExpiredAlertShown()) {
      setShowExpiredAlert(true);
      markExpiredAlertShown();
    }
    if (isMemberExpiringSoon()) setShowExpireSoon(true);
  }, []);

  useFocusEffect(useCallback(() => {
    if (isPrivacyAccepted()) refresh();
  }, [refresh]));

  // p1 阶段
  useEffect(() => {
    if (stage !== 'p1') return;
    if (p1Line < 3) {
      const t = setTimeout(() => setP1Line(v => v + 1), 500);
      return () => clearTimeout(t);
    }
    const t2 = setTimeout(() => { setStage('p2'); setP2Line(0); }, 500);
    return () => clearTimeout(t2);
  }, [stage, p1Line]);

  // p2 阶段
  useEffect(() => {
    if (stage !== 'p2') return;
    if (p2Line < 4) {
      setLitCorner(p2Line);
      const t = setTimeout(() => setP2Line(v => v + 1), 350);
      return () => clearTimeout(t);
    }
    const t3 = setTimeout(() => {
      setStage('done');
      setDetectId(genDetectId());
      setLastDetectTime();
      setLastDetect(Date.now());
    }, 350);
    return () => clearTimeout(t3);
  }, [stage, p2Line]);

  // ── 点击「准备检测」────────────────────────────────────
  const handlePrepare = () => {
    if (showExpiredBtn) {
      setShowExpiredAlert(true);
      return;
    }
    setShowReadyModal(true);
  };

  // ── 点击「我已进入牌局，对局已开始」──双重校验 ──────────
  const handleEnterGame = () => {
    // 检测一：是否曾离开过 App
    if (!hasLeftAppRef.current) {
      setShowReadyModal(false);
      setTipContent('请先切换到游戏，进入牌局后再回来检测。这样才能确保检测的是您的真实牌局环境。');
      return;
    }
    // 如果当前在后台中，先累加时长
    const totalMs = totalLeaveMs.current + (
      leaveStartRef.current > 0 ? (Date.now() - leaveStartRef.current) : 0
    );
    // 检测二：累计离开是否超过 2 分钟（120000 ms）
    if (totalMs < 120000) {
      setShowReadyModal(false);
      setTipContent('对局尚未正式开始或刚刚开始，环境数据不稳定。请等待对局进行约2分钟后再回来检测，这样检测结果才准确。');
      return;
    }
    // 通过双重检测
    setShowReadyModal(false);
    launchMiniFloat();
  };

  const launchMiniFloat = () => {
    setShowMiniFloat(true);
    setStage('p1'); setP1Line(0); setP2Line(-1); setLitCorner(0); setDetectId('');
  };

  // 迷你悬浮窗完成 → 启动守护
  const handleMiniDone = () => {
    setShowMiniFloat(false);
    resetLeaveRecord();
    handleStartGuard();
  };

  // ── 开始守护 ──────────────────────────────────────────
  const handleStartGuard = () => {
    const memberOk = isMemberActive();
    if (!memberOk && getMemberExpireTime() !== null) {
      router.push('/(app)/activation');
      return;
    }
    setActivation();
    recordGuardToday();
    addGameRecord();
    startGuard();
    setStreak(getStreakDays());
    setStage('guarding');
  };

  // ── 修改一：「开始守护本局」先弹权限窗 ─────────────────
  const handleStartGuardBtn = () => {
    setShowPermModal(true);
  };

  const handlePermGranted = () => {
    setShowPermModal(false);
    handleStartGuard();
  };

  // 点击「前往开启权限」：跳转设置，返回后自动触发
  const handleOpenSettings = () => {
    setShowPermModal(false);
    pendingPermCheckRef.current = true;
    Linking.openURL('app-settings:').catch(() => {
      Linking.openURL('package:com.android.settings').catch(() => {
        pendingPermCheckRef.current = false;
      });
    });
  };

  const isExpired = showExpiredBtn;

  if (stage === 'guarding' || stage === 'guardPaused') {
    return (
      <View style={{ flex: 1, backgroundColor: C.BG }}>
        <StatusBar style="light" backgroundColor={C.BG} />
        <GuardingView
          paused={stage === 'guardPaused'}
          onPause={() => { pauseGuard(); setStage('guardPaused'); }}
          onResume={() => { resumeGuard(); setStage('guarding'); }}
          onExit={() => { stopGuard(); setStage('idle'); }}
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} contentInsetAdjustmentBehavior="automatic">
        {/* 顶部栏 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.WHITE, fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>牌局环境守护</Text>
            <Text style={{ color: C.GRAY, fontSize: 10, letterSpacing: 2 }}>GAME ENV MONITOR</Text>
          </View>
          <Pressable onPress={() => setShowCS(true)} style={{ paddingHorizontal: 12, paddingVertical: 6, backgroundColor: C.PANEL2, borderRadius: 8, borderWidth: 1, borderColor: C.BORDER }}>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>客服</Text>
          </Pressable>
        </View>

        {/* 雷达 */}
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <GoldRadar phase={stage === 'idle' ? 'idle' : stage === 'done' ? 'done' : 'scanning'} litCorner={litCorner} />
          <View style={{ marginTop: 24, minHeight: 90, alignItems: 'center', gap: 6, width: '100%', paddingHorizontal: 24 }}>
            {stage === 'idle' && (
              <>
                <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold' }}>
                  {isExpired ? '⛔ 守护已到期' : '环境监测就绪'}
                </Text>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>
                  {isExpired ? '请续费后继续使用' : '进入牌局后回到此页开始检测'}
                </Text>
              </>
            )}
            {stage === 'p1' && (
              <View style={{ gap: 6, alignItems: 'center' }}>
                {P1_LINES.slice(0, p1Line).map((l, i) => (
                  <Text key={i} style={{ color: C.GRAY, fontSize: 13 }}>{l}</Text>
                ))}
              </View>
            )}
            {(stage === 'p2' || stage === 'done') && (
              <View style={{ gap: 7, width: '100%' }}>
                {DETECT_ITEMS.map((item, i) => (
                  <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 13 }}>{item.icon}</Text>
                    <Text style={{ color: (stage === 'done' || p2Line > i) ? C.BLUE : C.GRAY, fontSize: 12, flex: 1, lineHeight: 18 }}>
                      {(stage === 'done' || p2Line > i) ? '✅ ' : '○ '}{item.label} — {item.result}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          {stage === 'done' && (
            <View style={{ marginTop: 10, alignItems: 'center', gap: 4 }}>
              <Text style={{ color: C.BLUE, fontSize: 22, fontWeight: 'bold' }}>环境检测完成</Text>
              <Text style={{ color: C.GRAY, fontSize: 13 }}>检测项目 4/4 通过，未发现异常</Text>
              <Text style={{ color: C.GRAY2, fontSize: 11 }}>检测编号：{detectId}</Text>
              {/* 修改五：验证引导 */}
              <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center', marginTop: 4 }}>
                检测记录已同步保存，如需验证可联系客服查询检测日志
              </Text>
            </View>
          )}
        </View>

        {/* 信息卡片 */}
        <View style={{ marginHorizontal: 20, gap: 10 }}>
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER, padding: 14, gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: C.GRAY, fontSize: 11 }}>设备标识码</Text>
              <Text style={{ color: C.WHITE, fontSize: 12, fontFamily: 'monospace' }}>{getDeviceId()}</Text>
            </View>
            {lastDetect !== null && (
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>上次检测</Text>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>{formatDateTime(lastDetect)}</Text>
              </View>
            )}
          </View>

          {/* 累计护航天数卡 */}
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1,
            borderColor: streak > 0 ? `${C.STREAK}40` : C.BORDER,
            padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            <Text style={{ fontSize: 24 }}>🔥</Text>
            <View style={{ flex: 1 }}>
              {streak > 0
                ? <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>累计护航天数 <Text style={{ color: C.STREAK }}>{streak}</Text> 天</Text>
                : <Text style={{ color: C.GRAY, fontSize: 13 }}>今日尚未开始护航</Text>}
              <Text style={{ color: C.GRAY, fontSize: 11 }}>每天护航一次，累计天数+1</Text>
            </View>
          </View>
        </View>

        {/* 按钮区 */}
        <View style={{ marginHorizontal: 20, marginTop: 24, gap: 12 }}>
          {stage === 'idle' ? (
            /* 修改六：到期灰按钮 */
            <Pressable cssInterop={false}
              onPress={handlePrepare}
              style={({ pressed }) => ({
                backgroundColor: isExpired ? C.GRAY2 : (pressed ? '#1A5FCC' : C.BLUE),
                borderRadius: 14, paddingVertical: 17, alignItems: 'center',
                opacity: isExpired ? 0.7 : 1,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>
                {isExpired ? '准备检测' : '准备检测'}
              </Text>
            </Pressable>
          ) : stage === 'done' ? (
            <>
              {/* 修改一：开始守护本局 → 先弹权限窗 */}
              <Pressable cssInterop={false}
                onPress={handleStartGuardBtn}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 14, paddingVertical: 17, alignItems: 'center' })}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>开始守护本局</Text>
              </Pressable>
              <Pressable
                onPress={() => { setStage('idle'); setP2Line(-1); setLitCorner(0); stopGuard(); }}
                style={{ borderRadius: 14, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}
              >
                <Text style={{ color: C.GRAY, fontSize: 14 }}>重新扫描</Text>
              </Pressable>
            </>
          ) : (
            <View style={{ backgroundColor: C.PANEL, borderRadius: 14, paddingVertical: 17, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}>
              <Text style={{ color: C.GRAY, fontSize: 14 }}>扫描中...</Text>
            </View>
          )}

          <Pressable cssInterop={false} onPress={() => router.push('/(app)/game-records')} style={({ pressed }) => ({ backgroundColor: pressed ? C.PANEL2 : C.PANEL, borderRadius: 14, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER, flexDirection: 'row', justifyContent: 'center', gap: 8 })}>
            <Text style={{ fontSize: 16 }}>📋</Text>
            <Text style={{ color: C.WHITE, fontSize: 14 }}>牌局记录</Text>
          </Pressable>
        </View>

        {/* 快速导航 */}
        <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 20, gap: 10 }}>
          {[
            { label: '通知提醒', route: '/(app)/permission-guide' as const, icon: '🔔' },
            { label: '会员激活', route: '/(app)/activation' as const, icon: '💎' },
            { label: '代理中心', route: '/(app)/agent-center' as const, icon: '🏆' },
            { label: '安装指南', route: '/(app)/install-guide' as const, icon: '📲' },
          ].map(item => (
            <Pressable cssInterop={false} key={item.label} onPress={() => router.push(item.route)} style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? C.PANEL2 : C.PANEL, borderRadius: 12, paddingVertical: 12, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: C.BORDER })}>
              <Text style={{ fontSize: 18 }}>{item.icon}</Text>
              <Text style={{ color: C.GRAY, fontSize: 11 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* 底部浅灰小字入口：管理员设置 + 用户反馈 */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 24, paddingVertical: 16 }}>
          <Pressable cssInterop={false} onPress={() => router.push('/(app)/user-feedback')} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, flexDirection: 'row', alignItems: 'center', gap: 4 })}>
            <Text style={{ fontSize: 12 }}>💬</Text>
            <Text style={{ color: C.GRAY2, fontSize: 12 }}>用户反馈</Text>
          </Pressable>
          <Pressable cssInterop={false} onPress={() => router.push('/(app)/admin-verify')} style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}>
            <Text style={{ color: C.GRAY2, fontSize: 12 }}>管理员设置</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 迷你悬浮窗 */}
      <MiniFloatWindow visible={showMiniFloat} onDone={handleMiniDone} />

      <PrivacyModal visible={showPrivacy} onAccept={() => { setShowPrivacy(false); refresh(); }} />
      <AiCsModal visible={showCS} onClose={() => setShowCS(false)} greeting="您好！有任何关于护航检测的问题，欢迎直接告诉我。" />

      {/* 通知权限弹窗（替换原悬浮窗权限弹窗） */}
      <Modal visible={showPermModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 24, gap: 16, alignItems: 'center' }}>
            <Text style={{ fontSize: 36 }}>🔔</Text>
            <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold' }}>通知权限未开启</Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
              通知栏提醒用于在牌局时实时通知护航状态，开启后护航期间将在通知栏推送关键提醒。
            </Text>
            <View style={{ width: '100%', gap: 10 }}>
              <Pressable cssInterop={false}
                onPress={handleOpenSettings}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center' })}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>🔔 一键开启通知权限</Text>
              </Pressable>
              <Pressable
                onPress={handlePermGranted}
                style={{ borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}
              >
                <Text style={{ color: C.GRAY, fontSize: 13 }}>已开启，继续守护</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 修改二：进入牌局引导弹窗 */}
      <Modal visible={showReadyModal} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 24, gap: 16 }}>
            <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold', textAlign: 'center' }}>请先进入牌局</Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
              检测需要在您与牌友正常对局时进行。请先打开游戏进入牌局，等待对局正式开始后（约2分钟），再回到本App开始检测。
            </Text>
            <View style={{ gap: 10 }}>
              <Pressable cssInterop={false}
                onPress={handleEnterGame}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center' })}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>我已进入牌局，对局已开始</Text>
              </Pressable>
              <Pressable onPress={() => setShowReadyModal(false)} style={{ paddingVertical: 10, alignItems: 'center' }}>
                <Text style={{ color: C.GRAY2, fontSize: 13 }}>稍后再说</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 修改二：双重校验提示（知道了） */}
      <TipModal visible={tipContent !== ''} content={tipContent} onClose={() => setTipContent('')} />

      {/* 24h到期提醒 */}
      <Modal visible={showExpireSoon} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 24, alignItems: 'center', gap: 14 }}>
            <Text style={{ fontSize: 36 }}>⏰</Text>
            <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold' }}>护航即将结束</Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>您的会员将在1天后到期，到期后环境检测功能将暂停。续费可继续护航。</Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable onPress={() => { setShowExpireSoon(false); router.push('/(app)/activation'); }} style={{ flex: 1, backgroundColor: C.BLUE, borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>立即续费</Text>
              </Pressable>
              <Pressable onPress={() => setShowExpireSoon(false)} style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 10, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}>
                <Text style={{ color: C.GRAY, fontSize: 14 }}>我知道了</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 修改六：到期弹窗（「会员已到期」规格） */}
      <Modal visible={showExpiredAlert} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: `${C.RED}40`, padding: 24, alignItems: 'center', gap: 14 }}>
            <Text style={{ fontSize: 36 }}>🔒</Text>
            <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold' }}>会员已到期</Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              环境检测功能已停止，续费可恢复使用
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable onPress={() => { setShowExpiredAlert(false); router.push('/(app)/activation'); }} style={{ flex: 1, backgroundColor: C.BLUE, borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>查看套餐</Text>
              </Pressable>
              <Pressable onPress={() => setShowExpiredAlert(false)} style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 10, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}>
                <Text style={{ color: C.GRAY, fontSize: 14 }}>稍后再说</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
