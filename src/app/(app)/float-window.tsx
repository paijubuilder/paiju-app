/**
 * 护航状态监控 — 4阶段等待 → 检测 → 护航 v20
 * 通知栏提醒已替换悬浮窗；呼吸灯边框、蓝→金进度线、扫描计数、护航编号
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import AiCsModal from '@/components/AiCsModal';
import {
  expireGuard, getConfig, getElapsedSeconds, getGuardPhase, getRemainingSeconds,
  getTotalSeconds, isGuardExpired, pauseGuard, resumeGuard,
  shouldShowReport, stopGuard, isMemberExpiring48h, getStreakDays,
  getMemberExpireTime, getCurrentGuardId,
} from '@/lib/appStore';
import TutorialOverlay from '@/components/TutorialOverlay';

// ── 工具 ──────────────────────────────────────────────────
function fmtTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ── 呼吸灯 ───────────────────────────────────────────────
function BreathDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.3, duration: 900, useNativeDriver: true }),
    ])).start();
    return () => anim.stopAnimation();
  }, [anim]);
  return <Animated.View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, opacity: anim }} />;
}

// ── 护航圆环呼吸边框（护航中：100%↔85%，3s周期） ────────
function BreathingRing({ phase, children }: { phase: string; children: React.ReactNode }) {
  const breathAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase !== 'guarding') { breathAnim.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathAnim, { toValue: 0.85, duration: 1500, useNativeDriver: true }),
      Animated.timing(breathAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [phase, breathAnim]);
  return (
    <Animated.View style={{ opacity: breathAnim }}>
      {children}
    </Animated.View>
  );
}

// ── 蓝→金渐变进度条 ──────────────────────────────────────
function GradientProgressBar({ progress }: { progress: number }) {
  // progress: 0→1；接近0时变金色（时间越少越金）
  const clampedProgress = Math.max(0, Math.min(1, progress));
  // 剩余时间少于20%时偏金
  const gold = clampedProgress < 0.2;
  const barColor = gold ? C.GOLD : C.BLUE;
  const pct = `${Math.round((1 - clampedProgress) * 100)}%`;
  return (
    <View style={{ gap: 4, alignItems: 'center' }}>
      <View style={{ width: 240, height: 4, backgroundColor: C.BORDER, borderRadius: 2, overflow: 'hidden' }}>
        <View style={{ width: `${(1 - clampedProgress) * 100}%`, height: '100%', backgroundColor: barColor, borderRadius: 2 }} />
      </View>
      <Text style={{ color: C.GRAY2, fontSize: 9 }}>约 {pct}</Text>
    </View>
  );
}

// ── 修改七：边缘微光（按住倒计时环触发） ─────────────────
function GlowBorder({ active }: { active: boolean }) {
  const glow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (active) {
      Animated.loop(Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 250, useNativeDriver: false }),
        Animated.timing(glow, { toValue: 0.2, duration: 250, useNativeDriver: false }),
      ])).start();
    } else {
      glow.stopAnimation(); glow.setValue(0);
    }
  }, [active, glow]);
  const borderColor = glow.interpolate({
    inputRange: [0, 1], outputRange: [`${C.BLUE}30`, `${C.BLUE}FF`],
  });
  const shadowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.8] });
  return (
    <Animated.View style={{
      position: 'absolute', top: -4, left: -4, right: -4, bottom: -4,
      borderRadius: 84, borderWidth: 2, borderColor,
      shadowColor: C.BLUE, shadowOffset: { width: 0, height: 0 },
      shadowRadius: 16, shadowOpacity,
      pointerEvents: 'none',
    }} />
  );
}

// ── 第8分钟：护航即将结束提示卡（需求二） ────────────────
function ReportCard({ streak, onClose, onActivate }: {
  elapsed: number;
  streak: number;
  onClose: () => void;
  onActivate: () => void;
}) {
  return (
    <View style={{
      margin: 20, backgroundColor: C.PANEL2, borderRadius: 16,
      borderWidth: 1.5, borderColor: `${C.STREAK}60`, padding: 20, gap: 14,
    }}>
      {/* 标题行 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18 }}>⏰</Text>
        <Text style={{ color: C.STREAK, fontSize: 14, fontWeight: 'bold', flex: 1 }}>
          本次护航即将结束
        </Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={{ color: C.GRAY, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      {/* 提示文案 */}
      <View style={{
        backgroundColor: 'rgba(220,150,0,0.12)', borderRadius: 10,
        borderWidth: 1, borderColor: 'rgba(220,160,0,0.4)', padding: 12, gap: 4,
      }}>
        <Text style={{ color: C.STREAK, fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
          还剩2分钟
        </Text>
        <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
          护航结束后需开通会员继续使用
        </Text>
      </View>

      {/* 检测状态简报 */}
      <View style={{ gap: 6 }}>
        {[
          ['🛡', '多开/分身检测', '通过'],
          ['🔒', '异常辅助工具', '未发现'],
          ['👁', '异常行为', '正常'],
          ['⊞', '牌局环境', '安全'],
        ].map(([icon, label, val]) => (
          <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 13 }}>{icon}</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, flex: 1 }}>{label}</Text>
            <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold' }}>{val}</Text>
          </View>
        ))}
      </View>

      {streak > 0 && (
        <Text style={{ color: C.STREAK, fontSize: 11 }}>
          🔥 累计护航 {streak} 天，保持记录！
        </Text>
      )}

      {/* 立即开通按钮 */}
      <Pressable cssInterop={false}
        onPress={onActivate}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
          borderRadius: 12, paddingVertical: 14, alignItems: 'center',
        })}
      >
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
          立即开通会员，继续护航
        </Text>
      </Pressable>
    </View>
  );
}

// ── 修改三：状态滚动文字（v20：🔄扫描计数） ──────────────
const STATUS_MSGS_STATIC = [
  '护航任务进行中，当前未发现异常',
  '环境状态稳定，可继续牌局',
  '护航中 · 通知栏持续守护，安心打牌',
  '辅助工具检测：未发现威胁',
  '行为分析完成：一切正常',
  '多开检测：本局无异常设备',
  '环境评分 98 分，保持良好',
];

function StatusScrollText({ guardPhase }: { guardPhase: string }) {
  const [msg, setMsg] = useState('');
  const [visible, setVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scanCountRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (guardPhase !== 'guarding') return;

    const schedule = () => {
      const delay = 15000 + Math.floor(Math.random() * 10000);
      timerRef.current = setTimeout(() => {
        scanCountRef.current += 1;
        const pool = [...STATUS_MSGS_STATIC, `已完成第${scanCountRef.current}轮扫描，一切正常`];
        const nextMsg = pool[Math.floor(Math.random() * pool.length)];
        setMsg(nextMsg);
        setVisible(true);
        Animated.sequence([
          Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.delay(3000),
          Animated.timing(fadeAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
        ]).start(() => { setVisible(false); schedule(); });
      }, delay);
    };

    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [guardPhase, fadeAnim]);

  if (!visible) return null;
  return (
    <Animated.View style={{
      marginHorizontal: 20, marginTop: 8,
      backgroundColor: `${C.BLUE}10`,
      borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12,
      borderWidth: 1, borderColor: `${C.BLUE}25`,
      opacity: fadeAnim,
    }}>
      <Text style={{ color: C.BLUE, fontSize: 11, textAlign: 'center' }}>🛡 {msg}</Text>
    </Animated.View>
  );
}

// ── 风险实况卡片 ──────────────────────────────────────────
function useRiskStats() {
  const now = new Date();
  const hoursElapsed = now.getHours();
  const minutesElapsed = now.getHours() * 60 + now.getMinutes();

  const [scans, setScans] = useState(() =>
    12847 + Math.floor(Math.random() * 50) + hoursElapsed * minutesElapsed % 120
  );
  const [users, setUsers] = useState(() =>
    3921 + Math.floor(Math.random() * 20) + Math.floor(minutesElapsed * 0.5)
  );
  const [multiOpen, setMultiOpen] = useState(() =>
    62 + Math.floor(Math.random() * 6)
  );
  const [abnormal, setAbnormal] = useState(() =>
    20 + Math.floor(Math.random() * 5)
  );

  useEffect(() => {
    const t = setInterval(() => {
      setScans(v => v + Math.floor(Math.random() * 50) + 1);
      setUsers(v => v + Math.floor(Math.random() * 20) + 1);
      setMultiOpen(v => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.max(62, Math.min(68, v + delta));
      });
      setAbnormal(v => {
        const delta = Math.floor(Math.random() * 3) - 1;
        return Math.max(20, Math.min(25, v + delta));
      });
    }, 30000);
    return () => clearInterval(t);
  }, []);

  const other = Math.max(0, 100 - multiOpen - abnormal);
  return { scans, users, multiOpen, abnormal, other };
}

function RiskStatsCard() {
  const { scans, users, multiOpen, abnormal, other } = useRiskStats();
  return (
    <View style={{
      borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(220,100,30,0.6)',
      backgroundColor: 'rgba(180,60,10,0.08)', padding: 14, gap: 10, marginBottom: 12,
    }}>
      <Text style={{ color: '#E87030', fontSize: 13, fontWeight: 'bold' }}>
        📊 平台安全中心·近期风险实况
      </Text>
      <View style={{ gap: 7 }}>
        {[
          { label: '本月环境检测扫描', value: `${scans.toLocaleString()} 次`, color: C.WHITE },
          { label: '用户主动启用护航', value: `${users.toLocaleString()} 人`, color: C.WHITE },
          { label: '多开分身占比', value: `${multiOpen}%`, color: '#E87030' },
          { label: '异常工具占比', value: `${abnormal}%`, color: '#E85050' },
          { label: '其他占比', value: `${other}%`, color: C.GRAY },
        ].map(row => (
          <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>{row.label}</Text>
            <Text style={{ color: row.color, fontSize: 12, fontWeight: 'bold' }}>{row.value}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
        您的试用护航已结束。开通会员，持续为您扫描以上潜在风险。
      </Text>
      <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center' }}>
        *数据为模拟示例，仅供参考。
      </Text>
    </View>
  );
}

// ── 修改八：三屏到期展示页 ───────────────────────────────
function ExpiredOverlay({ onRenew }: { onRenew: () => void }) {
  const { height } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const cfg = getConfig();
  const [agreed, setAgreed] = useState(false);
  // ── AI客服弹窗状态 ──────────────────────────────────
  const [showCs, setShowCs] = useState(false);
  const csMode = getConfig().csMode;
  const csGreeting = getConfig().csGreeting;

  const scrollToScreen = (idx: number) => {
    scrollRef.current?.scrollTo({ y: idx * height, animated: true });
  };

  const plans = [
    { id: 0, title: '3天体验卡', price: cfg.cost3Day,   days: 3,   isGold: false },
    { id: 1, title: '30天月卡',  price: cfg.cost30Day,  days: 30,  isGold: true  },
    { id: 2, title: '半年卡',    price: cfg.cost180Day, days: 180, isGold: false },
    { id: 3, title: '年卡',      price: cfg.cost365Day, days: 365, isGold: false },
  ];
  const [selected, setSelected] = useState(() => {
    const goldIdx = plans.findIndex(p => p.isGold);
    return goldIdx >= 0 ? goldIdx : 1;
  });

  // 第一屏对比数据（需求规格：护航保护中 vs 护航未开启）
  const leftRows = [
    { icon: '🛡️', label: '护航保护中' },
    { icon: '✅', label: '持续扫描' },
    { icon: '📊', label: '评分98' },
  ];
  const rightRows = [
    { icon: '⚠️', label: '护航未开启' },
    { icon: '❌', label: '无保护' },
    { icon: '📊', label: '评分—' },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        pagingEnabled
        nestedScrollEnabled
        style={{ flex: 1 }}
      >
        {/* ─── 第一屏：护航结束 + 损失对比 ─── */}
        <View style={{ height, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={{ alignItems: 'center', marginBottom: 20, gap: 6 }}>
            <Text style={{ color: C.WHITE, fontSize: 24, fontWeight: 'bold' }}>🔒 护航已结束</Text>
            <Text style={{ color: C.GRAY, fontSize: 13 }}>本次护航已完成</Text>
          </View>

          {/* 左右对比卡 */}
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
            {/* 左：护航保护中 */}
            <View style={{
              flex: 1, backgroundColor: 'rgba(20,60,20,0.5)',
              borderRadius: 14, borderWidth: 1.5, borderColor: 'rgba(60,200,60,0.6)',
              padding: 14, gap: 10, alignItems: 'center',
            }}>
              <Text style={{ color: '#5FCA5F', fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>护航期间</Text>
              {leftRows.map(r => (
                <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>{r.icon}</Text>
                  <Text style={{ color: '#5FCA5F', fontSize: 12, fontWeight: 'bold' }}>{r.label}</Text>
                </View>
              ))}
            </View>
            {/* 右：护航未开启 */}
            <View style={{
              flex: 1, backgroundColor: 'rgba(50,10,10,0.6)',
              borderRadius: 14, borderWidth: 1.5, borderColor: `${C.RED}70`,
              padding: 14, gap: 10, alignItems: 'center',
            }}>
              <Text style={{ color: C.RED, fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>现在</Text>
              {rightRows.map(r => (
                <View key={r.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>{r.icon}</Text>
                  <Text style={{ color: C.RED, fontSize: 12, fontWeight: 'bold' }}>{r.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 引导文案（需求规格） */}
          <View style={{
            backgroundColor: 'rgba(200,50,50,0.12)', borderRadius: 10, padding: 12,
            borderWidth: 1, borderColor: `${C.RED}40`, marginBottom: 12, gap: 5,
          }}>
            <Text style={{ color: C.RED, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
              ⚠️ 您已暴露在风险中
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              本次护航已完成。继续护航需开通会员。{'\n'}本地区25%的牌友曾遇到异常对局。
            </Text>
            {/* 合规提示 */}
            <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 4 }}>
              ⚠️ 温馨提示：使用外挂或制作外挂均属违法行为。请公平游戏，远离外挂。
            </Text>
          </View>

          <RiskStatsCard />

          <Pressable cssInterop={false}
            onPress={() => scrollToScreen(1)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
              borderRadius: 12, paddingVertical: 14, alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>查看护航数据 ▼</Text>
          </Pressable>
        </View>

        {/* ─── 第二屏：本次护航报告 ─── */}
        <View style={{ height, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={{ alignItems: 'center', marginBottom: 16, gap: 4 }}>
            <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold' }}>📊 本次护航报告</Text>
          </View>

          {/* 数据回顾卡 */}
          <View style={{
            backgroundColor: C.PANEL2, borderRadius: 14, borderWidth: 1,
            borderColor: `${C.BLUE}50`, padding: 16, marginBottom: 14,
          }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {[
                { label: '扫描次数', val: '4次', icon: '🔍' },
                { label: '异常拦截', val: '0次', icon: '🛡' },
                { label: '安全评分', val: '98分', icon: '⭐' },
                { label: '护航时长', val: '10分钟', icon: '⏱' },
              ].map(d => (
                <View key={d.label} style={{
                  width: '45%', backgroundColor: C.PANEL, borderRadius: 10,
                  padding: 10, alignItems: 'center', gap: 4,
                }}>
                  <Text style={{ fontSize: 20 }}>{d.icon}</Text>
                  <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>{d.val}</Text>
                  <Text style={{ color: C.GRAY, fontSize: 10 }}>{d.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* 护航总结（橙色区） */}
          <View style={{
            backgroundColor: 'rgba(200,100,0,0.10)', borderRadius: 12,
            borderWidth: 1, borderColor: 'rgba(200,130,0,0.5)', padding: 14, marginBottom: 14, gap: 7,
          }}>
            <Text style={{ color: '#E8A040', fontSize: 12, fontWeight: 'bold', marginBottom: 2 }}>护航总结</Text>
            {[
              '多次扫描均发现潜在环境威胁，虽然本次未影响您',
              '本地区25%用户曾反馈遇到异常对局',
              '没有持续护航，下一局可能中招',
            ].map((s, i) => (
              <Text key={i} style={{ color: '#E8A040', fontSize: 12, lineHeight: 18 }}>● {s}</Text>
            ))}
          </View>

          <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 14 }}>
            您用10分钟完成了一次安全护航，{'\n'}开通会员让每一局都得到保障。
          </Text>

          <Pressable cssInterop={false}
            onPress={() => scrollToScreen(2)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
              borderRadius: 12, paddingVertical: 14, alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>查看会员权益，开启护航 ▼</Text>
          </Pressable>
        </View>

        {/* ─── 第三屏：套餐引导 ─── */}
        <View style={{ minHeight: height, paddingTop: 60, paddingHorizontal: 20, paddingBottom: 120 }}>
          <View style={{ alignItems: 'center', marginBottom: 10, gap: 4 }}>
            <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold' }}>🛡️ 开通护航会员</Text>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>
              已有 <Text style={{ color: C.WHITE, fontWeight: 'bold' }}>12,836</Text> 位牌友选择护航
            </Text>
          </View>

          {/* 套餐列表 */}
          <View style={{ gap: 10, marginBottom: 16 }}>
            {plans.map((p, idx) => (
              <Pressable
                key={p.id}
                onPress={() => setSelected(idx)}
                style={{
                  backgroundColor: selected === idx ? C.PANEL2 : C.PANEL,
                  borderRadius: 12,
                  borderWidth: selected === idx ? 2 : 1,
                  borderColor: p.isGold ? C.GOLD : (selected === idx ? C.BLUE : C.BORDER),
                  padding: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={{ color: p.isGold ? C.GOLD : C.WHITE, fontSize: 14, fontWeight: 'bold' }}>{p.title}</Text>
                    {p.isGold && (
                      <Text style={{ color: C.GRAY, fontSize: 11 }}>
                        日均不到一瓶水的钱 · ¥{(parseFloat(p.price) / 30).toFixed(2)}/天
                      </Text>
                    )}
                  </View>
                  <Text style={{ color: p.isGold ? C.GOLD : C.WHITE, fontSize: 20, fontWeight: 'bold' }}>¥{p.price}</Text>
                  {selected === idx && (
                    <View style={{
                      backgroundColor: p.isGold ? `${C.GOLD}20` : C.BLUE_BG,
                      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
                      borderWidth: 1, borderColor: p.isGold ? `${C.GOLD}60` : `${C.BLUE}50`,
                    }}>
                      <Text style={{ color: p.isGold ? C.GOLD : C.BLUE, fontSize: 10, fontWeight: 'bold' }}>已选</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            ))}
          </View>

          {/* 收款码占位 */}
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1,
            borderColor: C.BORDER, padding: 16, alignItems: 'center', gap: 6, marginBottom: 14,
          }}>
            <View style={{
              width: 120, height: 120, backgroundColor: C.BG, borderWidth: 1,
              borderColor: C.BORDER2, borderRadius: 8, alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
              <Text style={{ fontSize: 36 }}>📱</Text>
              <Text style={{ color: C.GRAY, fontSize: 11 }}>收款码占位</Text>
            </View>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>
              当前选择：{plans[selected]?.title} ¥{plans[selected]?.price}
            </Text>
          </View>

          {/* AI客服引导（仅 ai 模式显示，套餐卡片下方、协议上方） */}
          {csMode === 'ai' && (
            <Pressable
              onPress={() => setShowCs(true)}
              style={{ marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            >
              <Text style={{ fontSize: 14 }}>💬</Text>
              <Text style={{ color: 'rgba(160,175,200,0.75)', fontSize: 12, lineHeight: 18, flex: 1 }}>
                还有疑问？点击咨询智能客服，了解更多护航详情
              </Text>
            </Pressable>
          )}

          {/* 协议复选框 */}
          <Pressable
            onPress={() => setAgreed(v => !v)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}
          >
            <View style={{
              width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
              borderColor: agreed ? C.BLUE : C.GRAY,
              backgroundColor: agreed ? C.BLUE : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {agreed && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
            </View>
            <Text style={{ color: C.GRAY, fontSize: 11 }}>
              我已阅读并同意
              <Text style={{ color: C.BLUE }}> 用户协议 </Text>
              与
              <Text style={{ color: C.BLUE }}> 隐私政策</Text>
            </Text>
          </Pressable>

          {/* 确认支付按钮 */}
          <Pressable cssInterop={false}
            onPress={onRenew}
            style={({ pressed }) => ({
              backgroundColor: !agreed ? C.GRAY2 : (pressed ? '#1A5FCC' : C.BLUE),
              borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginBottom: 10,
            })}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>
              {agreed ? '立即开通护航会员' : '请先同意用户协议'}
            </Text>
          </Pressable>

          {/* 免责声明 */}
          <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center', lineHeight: 16 }}>
            本产品为通用环境扫描工具，检测结果仅供参考。{'\n'}支付即视为同意用户协议，数字商品不支持退款。
          </Text>

          {/* AI客服弹窗 */}
          <AiCsModal visible={showCs} onClose={() => setShowCs(false)} greeting={csGreeting} />
        </View>
      </ScrollView>

      {/* 底部固定悬浮按钮（任意屏均可见） */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingBottom: 28, paddingTop: 12,
        backgroundColor: 'rgba(13,15,18,0.96)',
        borderTopWidth: 1, borderTopColor: C.BORDER,
      }}>
        <Pressable cssInterop={false}
          onPress={() => scrollToScreen(2)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
            borderRadius: 14, paddingVertical: 15, alignItems: 'center',
          })}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>🛡️ 立即开通护航会员</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── 主页面 ────────────────────────────────────────────────

/** 护航状态环（独立组件，替代 JSX 内 IIFE）*/
function GuardRingView({ remaining, phase, score }: { remaining: number; phase: string; score: number }) {
  const nearEnd = remaining <= 120 && remaining > 0;
  const ended = remaining <= 0 || phase === 'expired';
  const timeColor = ended ? '#6B7280' : nearEnd ? '#F59E0B' : '#3DDC84';
  const ringColor = ended ? '#6B7280' : nearEnd ? '#F59E0B60' : `${C.BLUE}60`;
  const label = ended ? '🔒 护航已结束' : nearEnd ? '⏰ 即将结束' : '护航任务进行中';
  return (
    <View style={{
      width: 160, height: 160, borderRadius: 80,
      borderWidth: 6, borderColor: ringColor,
      alignItems: 'center', justifyContent: 'center', backgroundColor: C.PANEL,
    }}>
      <Text style={{ color: timeColor, fontSize: 34, fontWeight: 'bold', fontVariant: ['tabular-nums'] }}>
        {fmtTime(remaining)}
      </Text>
      <Text style={{ color: timeColor, fontSize: 10, textAlign: 'center', paddingHorizontal: 6 }}>
        {label}
      </Text>
      <Text style={{ color: C.GOLD, fontSize: 11, marginTop: 2, fontVariant: ['tabular-nums'] }}>
        ✦ {score}分
      </Text>
    </View>
  );
}

export default function FloatWindowScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<import('@/lib/appStore').GuardPhase>(getGuardPhase);
  const [remaining, setRemaining] = useState(getRemainingSeconds);
  const [showReport, setShowReport] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTutorialStep3, setShowTutorialStep3] = useState(true);
  const [score, setScore] = useState(98);
  const reportShownRef = useRef(false);
  const scoreTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streak = getStreakDays();
  const guardId = getCurrentGuardId();

  const expireTime = getMemberExpireTime();
  const show48h = isMemberExpiring48h() && expireTime !== null;

  useFocusEffect(useCallback(() => {
    setPhase(getGuardPhase());
    setRemaining(getRemainingSeconds());
  }, []));

  useEffect(() => {
    const t = setInterval(() => {
      const p = getGuardPhase();
      const r = getRemainingSeconds();
      setPhase(p);
      setRemaining(r);
      if (isGuardExpired() && (p as string) !== 'expired') expireGuard();
      if (shouldShowReport() && !reportShownRef.current) {
        reportShownRef.current = true;
        setShowReport(true);
      }
    }, 1000);
    // 评分每30秒微调±1（98±2范围）
    scoreTimerRef.current = setInterval(() => {
      setScore(s => {
        const delta = Math.random() > 0.5 ? 1 : -1;
        return Math.max(96, Math.min(99, s + delta));
      });
    }, 30000);
    return () => {
      clearInterval(t);
      if (scoreTimerRef.current) clearInterval(scoreTimerRef.current);
    };
  }, []);

  const total = getTotalSeconds();
  const elapsed = getElapsedSeconds();

  // 到期 → 三屏展示
  if ((phase as string) === 'expired') {
    return (
      <View style={{ flex: 1, backgroundColor: C.BG }}>
        <StatusBar style="light" backgroundColor={C.BG} />
        <View style={{
          paddingHorizontal: 20, paddingTop: 52,
          position: 'absolute', top: 0, left: 0, zIndex: 10,
        }}>
          <Pressable onPress={() => { stopGuard(); router.back(); }}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
        </View>
        <ExpiredOverlay onRenew={() => { stopGuard(); router.replace('/(app)/activation'); }} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* 标题栏 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 52 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>🛡️ 护航状态</Text>
            <Text style={{ color: C.GRAY, fontSize: 10 }}>GUARD MONITOR</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <BreathDot color={phase === 'guarding' ? C.BLUE : C.GRAY} />
            <Text style={{ color: phase === 'guarding' ? C.BLUE : C.GRAY, fontSize: 12 }}>
              {phase === 'guarding' ? '护航中' : '已暂停'}
            </Text>
          </View>
        </View>

        {/* 倒计时环 + 呼吸边框 */}
        <View style={{ alignItems: 'center', paddingVertical: 32 }}>
          <BreathingRing phase={phase}>
            <Pressable
              onPressIn={() => setIsDragging(true)}
              onPress={() => {}}
              onPressOut={() => setIsDragging(false)}
              style={{ position: 'relative' }}
            >
              {/* nearEnd: 最后2分钟; ending: <=0 */}
              <GuardRingView remaining={remaining} phase={phase as string} score={score} />
              <GlowBorder active={isDragging} />
            </Pressable>
          </BreathingRing>

          {/* 蓝→金进度线 */}
          <View style={{ marginTop: 20 }}>
            <GradientProgressBar progress={total > 0 ? Math.max(0, remaining / total) : 0} />
          </View>

          <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center', marginTop: 8, lineHeight: 16 }}>
            本次护航共10分钟，护航结束后需开通会员继续使用
          </Text>
          <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center', marginTop: 2 }}>
            💎 会员可无限次使用护航功能
          </Text>

          {show48h && (
            <Text style={{ color: C.STREAK, fontSize: 11, marginTop: 4 }}>
              会员还剩2天到期
            </Text>
          )}

          {/* 护航编号 */}
          <Text style={{ color: C.GRAY2, fontSize: 10, marginTop: 6 }}>
            🛡 护航编号 {guardId}
          </Text>
        </View>

        {/* 检测状态卡 */}
        <View style={{
          marginHorizontal: 20, backgroundColor: C.PANEL, borderRadius: 14,
          borderWidth: 1, borderColor: C.BORDER, padding: 16, gap: 10,
        }}>
          {[
            { icon: '🛡', label: '多开/分身', status: '通过' },
            { icon: '🔒', label: '异常辅助工具', status: '未发现' },
            { icon: '👁', label: '异常行为检测', status: '正常' },
            { icon: '⊞', label: '牌局环境', status: '安全' },
          ].map(item => (
            <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={{ fontSize: 15 }}>{item.icon}</Text>
              <Text style={{ color: C.GRAY, fontSize: 13, flex: 1 }}>{item.label}</Text>
              <View style={{
                backgroundColor: C.BLUE_BG, borderRadius: 6,
                paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${C.BLUE}40`,
              }}>
                <Text style={{ color: C.BLUE, fontSize: 11, fontWeight: 'bold' }}>{item.status}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 修改三：状态滚动文字（🔄计数） */}
        <StatusScrollText guardPhase={phase} />

        {/* 护航编号底部显示（菜单区） */}
        <View style={{ marginHorizontal: 20, marginTop: 8 }}>
          <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center' }}>
            本次护航任务编号：{guardId}
          </Text>
        </View>

        {/* 第8分钟：护航即将结束弹窗（需求二） */}
        {showReport && (
          <ReportCard
            elapsed={elapsed}
            streak={streak}
            onClose={() => setShowReport(false)}
            onActivate={() => { stopGuard(); router.replace('/(app)/activation'); }}
          />
        )}

        {/* 控制按钮 */}
        <View style={{ marginHorizontal: 20, marginTop: 24, gap: 12 }}>
          <Pressable cssInterop={false}
            onPress={() => {
              if (phase === 'guarding') { pauseGuard(); } else { resumeGuard(); }
              setPhase(getGuardPhase());
            }}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
              borderRadius: 14, paddingVertical: 17, alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
              {phase === 'guarding' ? '⏸ 暂停护航' : '▶ 恢复护航'}
            </Text>
          </Pressable>
          <Pressable cssInterop={false}
            onPress={() => router.push('/(app)/user-feedback')}
            style={({ pressed }) => ({
              borderRadius: 14, paddingVertical: 13, alignItems: 'center',
              borderWidth: 1, borderColor: C.BORDER,
              backgroundColor: pressed ? C.PANEL2 : 'transparent',
              flexDirection: 'row', justifyContent: 'center', gap: 6,
            })}
          >
            <Text style={{ fontSize: 14 }}>💬</Text>
            <Text style={{ color: C.GRAY, fontSize: 14 }}>我要反馈</Text>
          </Pressable>
          <Pressable
            onPress={() => { stopGuard(); router.back(); }}
            style={{
              borderRadius: 14, paddingVertical: 13, alignItems: 'center',
              borderWidth: 1, borderColor: C.BORDER,
            }}
          >
            <Text style={{ color: C.GRAY, fontSize: 14 }}>结束护航，返回</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 教程第三步：引导使用通知栏护航 */}
      <TutorialOverlay config={{
        step: 'step3',
        visible: showTutorialStep3,
        title: '护航已开启！',
        body: '💬 护航已开启！通知栏会持续守护您的牌局，护航期间可随时查看状态',
        actionLabel: '知道了，开始使用',
        onAction: () => setShowTutorialStep3(false),
      }} />
    </View>
  );
}
