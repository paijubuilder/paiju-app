/**
 * 我的Tab — 个人中心 v21
 * 含：代理入口/安装指南/反馈/版本号连点激活管理员/夜间模式/音效
 * 版本号连点3次 → 管理员账密登录（隐藏入口，页面不显示按钮）
 * 版本号连点5次 → 激活码流程 → 创作者后台（隐藏入口）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import AiCsModal from '@/components/AiCsModal';
import {
  getNightModeOption, setNightModeOption, getSoundEffectOption, setSoundEffectOption,
  isMemberActive, getMemberExpireTime, formatDateTime, getStreakDays,
  isAgentLoggedIn, isAdminLoggedIn, verifyAdminActivationCode,
  isDeviceActivated, markDeviceActivated, markAdminEntryRevealed,
  getConfig, getPendingUserOrders, isAdminSessionValidated,
  type NightModeOption,
} from '@/lib/appStore';

const VERSION = '3.19.0';

// ── JSBridge 类型声明（WebView 混合App注入） ────────────────
declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (msg: string) => void };
    onRiskDataUpdated?: (data: RiskData) => void;
  }
}

interface RiskData {
  risk_level: string;
  risk_score: number;
  risk_label: string;
  risk_color: string;
  detected_game?: { name: string; confidence: number };
  network?: { latency_ms: number; connection_type: string };
}

/** 发送 JSBridge 消息给原生 */
function postBridgeMessage(action: string, payload?: Record<string, unknown>) {
  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ action, ...payload }));
  }
}

/**
 * 原生功能控制面板
 * 仅在 WebView 环境中渲染（window.ReactNativeWebView 存在时）
 * 悬浮窗控制 / 手动检测 / 风险数据实时展示
 */
function NativeBridgeCard() {
  const [inWebView, setInWebView] = useState(false);
  const [floatActive, setFloatActive] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [riskData, setRiskData] = useState<RiskData | null>(null);

  useEffect(() => {
    // 仅在浏览器 Web 环境且被 WebView 注入时显示
    if (typeof window !== 'undefined' && window.ReactNativeWebView) {
      setInWebView(true);
      // 注册原生风险数据回调
      window.onRiskDataUpdated = (data: RiskData) => {
        setRiskData(data);
        setScanning(false);
      };
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.onRiskDataUpdated = undefined;
      }
    };
  }, []);

  if (!inWebView) return null;

  const handleStartFloat = () => {
    setFloatActive(true);
    postBridgeMessage('startFloatingWindow');
  };

  const handleStopFloat = () => {
    setFloatActive(false);
    postBridgeMessage('stopFloatingWindow');
  };

  const handleGetRisk = () => {
    setScanning(true);
    postBridgeMessage('getRiskData');
    // 5s 超时保护
    setTimeout(() => setScanning(false), 5000);
  };

  const riskColor = riskData?.risk_color ?? C.GRAY;
  const riskLabel = riskData?.risk_label ?? '暂无数据';
  const riskScore = riskData?.risk_score ?? '--';

  return (
    <>
      <SectionTitle title="原生功能控制" />
      {/* 悬浮窗控制 */}
      <MenuCard>
        <View style={{ paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <Text style={{ fontSize: 16 }}>🪟</Text>
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold', flex: 1 }}>悬浮窗</Text>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
              backgroundColor: floatActive ? '#22c55e20' : `${C.BORDER}60`,
            }}>
              <Text style={{ color: floatActive ? '#22c55e' : C.GRAY, fontSize: 11 }}>
                {floatActive ? '运行中' : '未启动'}
              </Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable cssInterop={false}
              onPress={handleStartFloat}
              style={({ pressed }) => ({
                flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center',
                backgroundColor: floatActive
                  ? (pressed ? '#1a3a1a' : '#1e3a1e')
                  : (pressed ? '#1A5FCC' : C.BLUE),
                borderWidth: 1,
                borderColor: floatActive ? '#22c55e40' : C.BLUE,
                opacity: floatActive ? 0.5 : 1,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>🟢 开启悬浮窗</Text>
            </Pressable>
            <Pressable cssInterop={false}
              onPress={handleStopFloat}
              style={({ pressed }) => ({
                flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: 'center',
                backgroundColor: !floatActive
                  ? (pressed ? '#2a1a1a' : '#2e1e1e')
                  : (pressed ? '#cc1a1a' : '#c0392b'),
                borderWidth: 1,
                borderColor: !floatActive ? '#ef444430' : '#c0392b',
                opacity: !floatActive ? 0.5 : 1,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>🔴 关闭悬浮窗</Text>
            </Pressable>
          </View>
        </View>
      </MenuCard>

      {/* 风险检测 + 实时数据 */}
      <MenuCard>
        <View style={{ padding: 16, gap: 12 }}>
          {/* 手动触发检测按钮 */}
          <Pressable cssInterop={false}
            onPress={handleGetRisk}
            style={({ pressed }) => ({
              borderRadius: 10, paddingVertical: 12, alignItems: 'center',
              backgroundColor: pressed ? '#1a3358' : '#162840',
              borderWidth: 1, borderColor: `${C.BLUE}60`,
            })}
          >
            <Text style={{ color: C.BLUE, fontSize: 13, fontWeight: 'bold' }}>
              {scanning ? '⏳ 检测中...' : '🔍 立即检测设备风险'}
            </Text>
          </Pressable>

          {/* 风险数据展示卡片 */}
          <View style={{
            backgroundColor: `${riskColor}12`,
            borderRadius: 12, borderWidth: 1,
            borderColor: `${riskColor}40`,
            padding: 14, gap: 8,
          }}>
            {/* 标题行 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>风险状态</Text>
              <View style={{ flex: 1, height: 1, backgroundColor: C.BORDER2 }} />
              <Text style={{ color: riskColor, fontSize: 12, fontWeight: 'bold' }}>{riskLabel}</Text>
            </View>
            {/* 分数 */}
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
              <Text style={{ color: riskColor, fontSize: 28, fontWeight: 'bold' }}>
                {riskScore}
              </Text>
              {typeof riskScore === 'number' && (
                <Text style={{ color: C.GRAY, fontSize: 12 }}>/ 100分</Text>
              )}
            </View>
            {/* 检测到的游戏 */}
            {riskData?.detected_game && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>检测到游戏：</Text>
                <Text style={{ color: C.WHITE, fontSize: 12, fontWeight: 'bold' }}>
                  {riskData.detected_game.name}
                </Text>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>
                  ({riskData.detected_game.confidence}% 置信度)
                </Text>
              </View>
            )}
            {/* 网络状态 */}
            {riskData?.network && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>网络延迟：</Text>
                <Text style={{ color: C.WHITE, fontSize: 12, fontWeight: 'bold' }}>
                  {riskData.network.latency_ms}ms
                </Text>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>· {riskData.network.connection_type}</Text>
              </View>
            )}
            {!riskData && (
              <Text style={{ color: C.GRAY2, fontSize: 12 }}>
                点击「立即检测」获取实时数据，或等待原生端推送
              </Text>
            )}
          </View>
        </View>
      </MenuCard>
    </>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold', letterSpacing: 1, marginBottom: 8, marginTop: 4 }}>
      {title}
    </Text>
  );
}

function MenuItem({
  emoji, label, value, onPress, rightElement,
}: {
  emoji: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
}) {
  return (
    <Pressable cssInterop={false}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: 13, paddingHorizontal: 16,
        backgroundColor: pressed ? C.PANEL2 : C.PANEL,
        gap: 12,
      })}
    >
      <Text style={{ fontSize: 17 }}>{emoji}</Text>
      <Text style={{ color: C.WHITE, fontSize: 14, flex: 1 }}>{label}</Text>
      {value ? <Text style={{ color: C.GRAY, fontSize: 12 }}>{value}</Text> : null}
      {rightElement ?? (onPress ? <Text style={{ color: C.GRAY, fontSize: 16 }}>›</Text> : null)}
    </Pressable>
  );
}

function MenuCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{
      backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1,
      borderColor: C.BORDER, overflow: 'hidden', marginBottom: 16,
    }}>
      {children}
    </View>
  );
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: C.BORDER2, marginLeft: 48 }} />;
}

const NIGHT_OPTIONS: { key: NightModeOption; label: string }[] = [
  { key: 'auto', label: '自动（20:00-06:00）' },
  { key: 'on', label: '始终开启' },
  { key: 'off', label: '始终关闭' },
];

export default function ProfileTab() {
  const router = useRouter();
  const [nightMode, setNightMode] = useState(getNightModeOption());
  const [soundOn, setSoundOn] = useState(getSoundEffectOption() === 'on');
  const [showNightPicker, setShowNightPicker] = useState(false);

  // 激活码弹窗（5次超管入口专用）
  const [showActivation, setShowActivation] = useState(false);
  const [activationInput, setActivationInput] = useState('');
  const [activationError, setActivationError] = useState('');
  const versionTapCount = useRef(0);
  const versionTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 管理后台入口「已发现」状态 — 已移除可见按钮，仅保留版本号隐藏入口，无需此状态

  const memberActive = isMemberActive();
  const expireTime = getMemberExpireTime();
  const streak = getStreakDays();
  const agentIn = isAgentLoggedIn();
  const adminIn = isAdminLoggedIn();
  const [pendingOrders, setPendingOrders] = useState(getPendingUserOrders);

  // ── 客服入口状态 ──────────────────────────────────────
  const [csMode, setCsMode] = useState<'ai' | 'link' | 'qrcode' | 'off'>('ai');
  const [csUrl, setCsUrl] = useState('');
  const [csQrUrl, setCsQrUrl] = useState('');
  const [showQrModal, setShowQrModal] = useState(false);
  const [showAiCs, setShowAiCs] = useState(false);
  const [csJumping, setCsJumping] = useState(false);
  const [csGreeting, setCsGreeting] = useState('');

  useFocusEffect(useCallback(() => {
    setNightMode(getNightModeOption());
    setSoundOn(getSoundEffectOption() === 'on');
    // 同步客服配置
    const cfg = getConfig();
    setCsMode(cfg.csMode);
    setCsUrl(cfg.csUrl);
    setCsQrUrl(cfg.csQrUrl);
    setCsGreeting(cfg.csGreeting);
    // 刷新待处理订单
    setPendingOrders(getPendingUserOrders());
  }, []));

  const toggleSound = (val: boolean) => {
    setSoundOn(val);
    setSoundEffectOption(val ? 'on' : 'off');
  };

  const handleNightChange = (key: NightModeOption) => {
    setNightMode(key);
    setNightModeOption(key);
    setShowNightPicker(false);
  };

  const nightLabel = NIGHT_OPTIONS.find(o => o.key === nightMode)?.label ?? '自动';

  // 版本号连点逻辑（无可见入口，全部通过点击触发）：
  //   3次（间隔≤500ms）→ 管理员账密登录页（admin-rbac-login）
  //   5次（间隔≤500ms 快速连点）→ 激活码流程 → 创作者后台
  const handleVersionTap = () => {
    versionTapCount.current += 1;
    if (versionTapTimer.current) clearTimeout(versionTapTimer.current);
    // 500ms 内连点3次 → 管理员入口（直接跳转，不再 reveal 按钮）
    const timer3 = setTimeout(() => {
      if (versionTapCount.current === 3) {
        versionTapCount.current = 0;
        markAdminEntryRevealed(); // 保存管理员入口已发现状态
        router.push('/(app)/admin-rbac-login' as never);
      }
    }, 500);
    versionTapTimer.current = timer3;
    // 2000ms 内连点5次 → 超管隐藏入口（激活码流程）
    if (versionTapCount.current >= 5) {
      versionTapCount.current = 0;
      if (versionTapTimer.current) clearTimeout(versionTapTimer.current);
      if (adminIn) return;
      if (isAdminSessionValidated()) {
        router.push('/(app)/admin-portal' as never);
        return;
      }
      if (isDeviceActivated()) {
        // 设备已激活但 session 已过期，重新进创作者登录页
        router.push('/(app)/creator-login' as never);
        return;
      }
      setActivationInput('');
      setActivationError('');
      setShowActivation(true);
    }
  };

  const handleActivationConfirm = () => {
    if (verifyAdminActivationCode(activationInput.trim())) {
      // 激活码正确 → 标记本设备已激活，进入创作者账密登录页
      markDeviceActivated();
      setShowActivation(false);
      router.push('/(app)/creator-login' as never);
    } else {
      setActivationError('激活码错误，请重新输入');
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} contentInsetAdjustmentBehavior="automatic">

        {/* 顶部用户卡片 */}
        <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 20 }}>
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1,
            borderColor: memberActive ? 'rgba(212,175,55,0.5)' : C.BORDER,
            padding: 20, flexDirection: 'row', alignItems: 'center', gap: 16,
          }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: C.BLUE_BG, borderWidth: 2, borderColor: C.BLUE,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 26 }}>{memberActive ? '💎' : '🛡️'}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>
                {memberActive ? '会员用户' : '体验用户'}
              </Text>
              {memberActive && expireTime ? (
                <Text style={{ color: C.GOLD, fontSize: 11 }}>
                  会员到期：{formatDateTime(expireTime)}
                </Text>
              ) : (
                <Text style={{ color: C.GRAY, fontSize: 11 }}>开通会员享全程护航</Text>
              )}
              {streak > 0 && (
                <Text style={{ color: C.STREAK, fontSize: 11 }}>🔥 已连续护航 {streak} 天</Text>
              )}
            </View>
            {!memberActive && (
              <Pressable cssInterop={false}
                onPress={() => router.push('/(app)/activation')}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#B8961E' : C.GOLD,
                  borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7,
                })}
              >
                <Text style={{ color: '#1A1514', fontSize: 12, fontWeight: 'bold' }}>开通</Text>
              </Pressable>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* 待处理订单 */}
          {pendingOrders.length > 0 && (
            <>
              <SectionTitle title="待处理订单" />
              <MenuCard>
                {pendingOrders.map((order, idx) => (
                  <View key={order.id}>
                    {idx > 0 && <View style={{ height: 1, backgroundColor: C.BORDER2, marginLeft: 16 }} />}
                    <View style={{ paddingVertical: 12, paddingHorizontal: 16, gap: 4 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 14 }}>
                          {order.status === '异常-价格不符' ? '⚠️' : '⏳'}
                        </Text>
                        <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold', flex: 1 }}>
                          {order.status === '异常-价格不符' ? '付款异常·需处理' : '付款核实中'}
                        </Text>
                        <View style={{
                          backgroundColor:
                            order.status === '异常-价格不符' ? 'rgba(239,68,68,0.15)' :
                            order.aiStatus === 'confirmed' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                          borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
                        }}>
                          <Text style={{
                            color:
                              order.status === '异常-价格不符' ? '#F87171' :
                              order.aiStatus === 'confirmed' ? '#4ADE80' : '#FDE047',
                            fontSize: 10,
                          }}>
                            {order.status === '异常-价格不符' ? '价格不符' :
                              order.aiStatus === 'confirmed' ? 'AI已确认' :
                              order.aiStatus === 'abnormal' ? 'AI判定异常' : 'AI审核中'}
                          </Text>
                        </View>
                      </View>
                      <Text style={{ color: C.GRAY, fontSize: 12 }}>
                        金额 ¥{order.payAmount || order.planPrice}  ·  {order.planLabel}
                      </Text>
                      {order.aiNote ? (
                        <Text style={{ color: order.status === '异常-价格不符' ? '#F87171' : C.GRAY, fontSize: 11, lineHeight: 17 }}>
                          {order.aiNote}
                        </Text>
                      ) : null}
                      <Text style={{ color: C.GRAY2, fontSize: 11 }}>
                        提交时间 {formatDateTime(order.createdAt)}
                      </Text>
                      {/* 极隐触发：仅"异常-价格不符"订单显示客服入口 */}
                      {order.status === '异常-价格不符' && csMode === 'ai' && (
                        <Pressable cssInterop={false}
                          onPress={() => {
                            const autoMsg = `订单编号[${order.id}]，AI判定付款异常，请上传付款凭证以便客服核实`;
                            setCsGreeting(autoMsg);
                            setShowAiCs(true);
                          }}
                          style={({ pressed }) => ({
                            marginTop: 8, backgroundColor: pressed ? '#991B1B' : '#DC262620',
                            borderRadius: 9, borderWidth: 1, borderColor: '#EF4444',
                            paddingVertical: 9, alignItems: 'center',
                          })}
                        >
                          <Text style={{ color: '#F87171', fontSize: 12, fontWeight: 'bold' }}>
                            📞 联系客服处理
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                ))}
              </MenuCard>
            </>
          )}

          {/* WebView 混合App原生功能控制（仅 WebView 环境可见） */}
          <NativeBridgeCard />

          {/* 我的功能 */}
          <SectionTitle title="我的功能" />
          <MenuCard>
            {/* 代理入口：始终显示，未开通→介绍页，已开通→中心 */}
            <MenuItem emoji="🏆" label={agentIn ? '代理中心' : '加入代理计划'} onPress={() => router.push(agentIn ? '/(app)/agent-center' : '/(app)/agent-intro' as never)} />
            <Divider />
            {/* 管理员后台入口：登录后显示 */}
            {adminIn && (
              <>
                <MenuItem emoji="⚙️" label="管理员后台" onPress={() => router.push('/(app)/admin-portal' as never)} />
                <Divider />
              </>
            )}
            <MenuItem emoji="💎" label="会员开通" onPress={() => router.push('/(app)/activation')} />
            <Divider />
            <MenuItem emoji="🛡️" label="护航工具箱" onPress={() => router.push('/(app)/toolbox' as never)} />
          </MenuCard>

          {/* 服务支持 */}
          <SectionTitle title="服务与支持" />
          <MenuCard>
            <MenuItem emoji="📖" label="安装指南" onPress={() => router.push('/(app)/install-guide')} />
            {/* 官方客服入口（仅在后台开启时显示） */}
            {csMode !== 'off' && (csMode === 'ai' || csMode === 'qrcode' || (csMode === 'link' && csUrl !== '')) && (
              <>
                <Divider />
                <Pressable
                  onPress={async () => {
                    if (csMode === 'ai') {
                      setShowAiCs(true);
                    } else if (csMode === 'link') {
                      setCsJumping(true);
                      setTimeout(() => setCsJumping(false), 2000);
                      await Linking.openURL(csUrl).catch(() => setCsJumping(false));
                    } else {
                      setShowQrModal(true);
                    }
                  }}
                  style={{ paddingVertical: 13, paddingHorizontal: 16 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ fontSize: 17 }}>💬</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.WHITE, fontSize: 14 }}>官方客服</Text>
                      <Text style={{ color: C.GRAY, fontSize: 11, marginTop: 1 }}>
                        {csJumping ? '正在跳转至官方客服...' : '工作时间：9:00-21:00'}
                      </Text>
                    </View>
                    <Text style={{ color: C.GRAY, fontSize: 16 }}>›</Text>
                  </View>
                </Pressable>
              </>
            )}
            <Divider />
            <MenuItem emoji="💬" label="用户反馈" onPress={() => router.push('/(app)/user-feedback')} />
          </MenuCard>

          {/* 偏好设置 */}
          <SectionTitle title="偏好设置" />
          <MenuCard>
            {/* 夜间模式 */}
            <Pressable
              onPress={() => setShowNightPicker(v => !v)}
              style={{ paddingVertical: 13, paddingHorizontal: 16 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ fontSize: 17 }}>🌙</Text>
                <Text style={{ color: C.WHITE, fontSize: 14, flex: 1 }}>夜间模式</Text>
                <Text style={{ color: C.GRAY, fontSize: 12, marginRight: 4 }}>{nightLabel}</Text>
                <Text style={{ color: C.GRAY, fontSize: 16 }}>›</Text>
              </View>
              {showNightPicker && (
                <View style={{ marginTop: 10, backgroundColor: C.BG, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.BORDER }}>
                  {NIGHT_OPTIONS.map(o => (
                    <Pressable cssInterop={false}
                      key={o.key}
                      onPress={() => handleNightChange(o.key)}
                      style={({ pressed }) => ({
                        paddingVertical: 11, paddingHorizontal: 14,
                        backgroundColor: pressed ? C.PANEL2 : 'transparent',
                        flexDirection: 'row', alignItems: 'center', gap: 10,
                      })}
                    >
                      <View style={{
                        width: 16, height: 16, borderRadius: 8,
                        borderWidth: 2, borderColor: nightMode === o.key ? C.GOLD : C.GRAY,
                        backgroundColor: nightMode === o.key ? C.GOLD : 'transparent',
                      }} />
                      <Text style={{ color: nightMode === o.key ? C.GOLD : C.GRAY, fontSize: 13 }}>{o.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </Pressable>
            <Divider />
            {/* 操作音效 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, gap: 12 }}>
              <Text style={{ fontSize: 17 }}>🔔</Text>
              <Text style={{ color: C.WHITE, fontSize: 14, flex: 1 }}>操作音效</Text>
              <Switch
                value={soundOn}
                onValueChange={toggleSound}
                trackColor={{ false: C.BORDER, true: `${C.GOLD}80` }}
                thumbColor={soundOn ? C.GOLD : C.GRAY2}
              />
            </View>
          </MenuCard>

          {/* 版本号 — 连点5次触发激活码 */}
          <Pressable onPress={handleVersionTap} style={{ alignItems: 'center', gap: 4, marginTop: 4, paddingVertical: 12 }}>
            <Text style={{ color: C.GRAY2, fontSize: 11 }}>版本号 v{VERSION}</Text>
            <Text style={{ color: C.GRAY2, fontSize: 10 }}>牌局环境守护 · 守护每一局</Text>
          </Pressable>

          {/* 代理云端同步提示 */}
          {agentIn && (
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <Text style={{ color: C.GRAY2, fontSize: 10 }}>☁️ 数据已云端同步，换手机登录即可恢复</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* 激活码弹窗 */}
      <Modal visible={showActivation} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          onPress={() => setShowActivation(false)}
        >
          <Pressable onPress={() => {}}>
            <View style={{
              backgroundColor: C.PANEL, borderRadius: 18, borderWidth: 1.5,
              borderColor: C.BORDER, padding: 24, gap: 16, width: 300,
            }}>
              <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
                🔐 请输入激活码
              </Text>
              <TextInput
                value={activationInput}
                onChangeText={v => { setActivationInput(v); setActivationError(''); }}
                placeholder="请输入激活码"
                placeholderTextColor={C.GRAY2}
                secureTextEntry
                style={{
                  backgroundColor: C.PANEL2, borderRadius: 10, borderWidth: 1,
                  borderColor: activationError ? C.RED : C.BORDER,
                  color: C.WHITE, fontSize: 15,
                  paddingHorizontal: 14, paddingVertical: 12,
                }}
              />
              {activationError ? (
                <Text style={{ color: C.RED, fontSize: 12, textAlign: 'center' }}>{activationError}</Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setShowActivation(false)}
                  style={{ flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}
                >
                  <Text style={{ color: C.GRAY, fontSize: 14 }}>取消</Text>
                </Pressable>
                <Pressable cssInterop={false}
                  onPress={handleActivationConfirm}
                  style={({ pressed }) => ({
                    flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
                    backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                  })}
                >
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* AI智能客服弹窗 */}
      <AiCsModal visible={showAiCs} onClose={() => setShowAiCs(false)} greeting={csGreeting} />

      {/* 官方客服二维码弹窗 */}
      <Modal visible={showQrModal} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={() => setShowQrModal(false)}
        >
          <Pressable onPress={e => e.stopPropagation()}>
            <View style={{
              backgroundColor: C.PANEL,
              borderTopLeftRadius: 24, borderTopRightRadius: 24,
              paddingBottom: 40, paddingTop: 20, paddingHorizontal: 24,
              alignItems: 'center',
            }}>
              {/* 抓手条 */}
              <View style={{ width: 40, height: 4, backgroundColor: C.BORDER, borderRadius: 2, marginBottom: 20 }} />
              <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', marginBottom: 4 }}>官方客服</Text>
              <Text style={{ color: C.GRAY, fontSize: 12, marginBottom: 20 }}>工作时间：9:00-21:00</Text>

              {csQrUrl !== '' ? (
                <Image
                  source={{ uri: csQrUrl }}
                  style={{ width: 200, height: 200, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER }}
                  resizeMode="contain"
                />
              ) : (
                <View style={{
                  width: 200, height: 200, borderRadius: 12,
                  borderWidth: 1, borderColor: C.BORDER,
                  backgroundColor: C.BG, alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ color: C.GRAY, fontSize: 13 }}>二维码加载中…</Text>
                </View>
              )}

              <Text style={{ color: C.GRAY, fontSize: 13, marginTop: 16 }}>📱 扫码添加官方客服</Text>

              <Pressable cssInterop={false}
                onPress={() => setShowQrModal(false)}
                style={({ pressed }) => ({
                  marginTop: 20, backgroundColor: pressed ? C.PANEL2 : C.BG,
                  borderRadius: 10, paddingVertical: 11, paddingHorizontal: 40,
                  borderWidth: 1, borderColor: C.BORDER,
                })}
              >
                <Text style={{ color: C.GRAY, fontSize: 14 }}>关闭</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

