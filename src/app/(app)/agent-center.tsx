/**
 * 代理中心页 — 科技蓝主题
 * 等级展示 · 加价滑动条 · 实时售价预览 · 分级AI助手悬浮球
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import Slider from '@react-native-community/slider';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  AI_VIOLATION_WORDS,
  addAgentChatLog,
  calcAgentPrice, calcCostPrice, getAgentAiEnabled, getAgentMarkup,
  getAgentRank, getConfig, getMarkupLimitForRank, setAgentMarkup,
  getAgentEarnings, getAgentCustomers, getAgentLeaderboard,
  getLoginState,
  type AgentRank,
} from '@/lib/appStore';
import PosterGenerator from '@/components/PosterGenerator';

// ── 等级配置 ──────────────────────────────────────────────
const RANK_CONFIG: Record<AgentRank, { icon: string; color: string; label: string }> = {
  '初级代理': { icon: '🥉', color: '#CD7F32', label: '青铜代理' },
  '中级代理': { icon: '🥈', color: '#C0C0C0', label: '白银代理' },
  '高级代理': { icon: '🥇', color: C.GOLD,    label: '黄金代理' },
};

// AI 悬浮球颜色（蓝 / 银 / 金）
const AI_BALL_COLOR: Record<AgentRank, string> = {
  '初级代理': C.BLUE,
  '中级代理': '#A8B4C0',
  '高级代理': C.GOLD,
};
// AI 助手名称
const AI_TITLE: Record<AgentRank, string> = {
  '初级代理': '🤖 AI 基础助手',
  '中级代理': '🤖 AI 智能管家',
  '高级代理': '🤖 AI 首席助手',
};

// 各等级 AI 功能列表
const AI_FEATURES: Record<AgentRank, string[]> = {
  '初级代理': [
    '📊 查询自己的销售数据',
    '✍️ 生成发朋友圈的推广文案',
    '💬 回答客户常见问题',
  ],
  '中级代理': [
    '📊 查询自己的销售数据',
    '✍️ 生成发朋友圈的推广文案',
    '💬 回答客户常见问题',
    '🎯 分析自己的客户画像',
    '💡 个性化营销建议',
    '💰 预测本月收入',
    '⏰ 提醒哪些客户快到期',
  ],
  '高级代理': [
    '📊 查询自己的销售数据',
    '✍️ 生成发朋友圈的推广文案',
    '💬 回答客户常见问题',
    '🎯 分析自己的客户画像',
    '💡 个性化营销建议',
    '💰 预测本月收入',
    '⏰ 提醒哪些客户快到期',
    '👥 查看下级代理数据',
    '🤖 AI自动回复客户（睡觉也能帮你卖卡！）',
    '📈 团队经营分析',
    '🏆 高级营销策略建议',
  ],
};

// ── AI 回复生成 ──────────────────────────────────────────
interface ChatMsg { id: string; role: 'user' | 'bot'; text: string; thinking?: boolean; streaming?: boolean; }
let msgSeq = 0;

// ── 三点跳动思考动画 ──────────────────────────────────────
function AgentThinkingDots({ color }: { color: string }) {
  const d0 = useRef(new Animated.Value(0.3)).current;
  const d1 = useRef(new Animated.Value(0.3)).current;
  const d2 = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anims = [d0, d1, d2].map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 300, useNativeDriver: true }),
          Animated.delay((2 - i) * 180),
        ]),
      ),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, [d0, d1, d2]);
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ color, fontSize: 10 }}>🤔</Text>
      {[d0, d1, d2].map((dot, i) => (
        <Animated.View key={i} style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: color, opacity: dot }} />
      ))}
      <Text style={{ color, fontSize: 11, marginLeft: 2 }}>AI正在思考中...</Text>
    </View>
  );
}

// ── 气泡淡入动画包装 ─────────────────────────────────────
function AgentAnimBubble({ role, children }: { role: 'user' | 'bot'; children: React.ReactNode }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(role === 'bot' ? 10 : 0)).current;
  const translateX = useRef(new Animated.Value(role === 'user' ? 18 : 0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 240, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 240, useNativeDriver: true }),
      Animated.timing(translateX, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [opacity, translateY, translateX]);
  return (
    <Animated.View style={{ opacity, transform: [{ translateY }, { translateX }] }}>
      {children}
    </Animated.View>
  );
}

// ── 闪烁光标 ────────────────────────────────────────────
function AgentBlinkCursor({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return <Animated.Text style={{ opacity, color, fontSize: 14 }}>▌</Animated.Text>;
}

// ── AI 对话弹窗 ───────────────────────────────────────────
function AgentAiChatModal({
  visible, onClose, rank,
}: { visible: boolean; onClose: () => void; rank: AgentRank }) {
  const [msgs, setMsgs]       = useState<ChatMsg[]>([]);
  const [input, setInput]     = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const ballColor = AI_BALL_COLOR[rank];

  const scrollBottom = () =>
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 60);

  const send = () => {
    const txt = input.trim();
    if (!txt || sending) return;
    setInput('');
    setSending(true);

    const uid = `m${msgSeq++}`;
    const tid = `m${msgSeq++}`;

    addAgentChatLog('self', '本人', rank, 'user', txt);

    // Step 1: 用户消息 + 思考气泡
    setMsgs(p => [...p,
      { id: uid, role: 'user', text: txt },
      { id: tid, role: 'bot', text: '', thinking: true },
    ]);
    scrollBottom();

    // 模拟思考延迟 600-1200ms
    const thinkMs = 600 + Math.random() * 600;
    setTimeout(() => {
      const botText = buildAgentAiReply(txt, rank);
      addAgentChatLog('self', '本人', rank, 'bot', botText);

      // Step 2: 切换为打字机输出
      setMsgs(p => p.map(m => m.id === tid ? { ...m, thinking: false, text: '', streaming: true } : m));
      scrollBottom();

      // 逐字输出（25ms/字）
      let charIdx = 0;
      const timer = setInterval(() => {
        charIdx++;
        const snap = botText.slice(0, charIdx);
        setMsgs(p => p.map(m => m.id === tid ? { ...m, text: snap } : m));
        if (charIdx % 5 === 0) scrollBottom();
        if (charIdx >= botText.length) {
          clearInterval(timer);
          setMsgs(p => p.map(m => m.id === tid ? { ...m, streaming: false } : m));
          setSending(false);
          scrollBottom();
        }
      }, 25);
    }, thinkMs);
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.PANEL, borderTopLeftRadius: 20, borderTopRightRadius: 20, height: '72%' }}>
          {/* 弹窗标题 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER, gap: 10 }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${ballColor}25`, borderWidth: 1.5, borderColor: ballColor, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 18 }}>🤖</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>{AI_TITLE[rank]}</Text>
                {/* 绿色在线指示灯 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#22C55E' }} />
                  <Text style={{ color: '#22C55E', fontSize: 10 }}>在线</Text>
                </View>
              </View>
              <Text style={{ color: C.GRAY, fontSize: 10 }}>不可修改价格 / 不可封禁用户 / 不可调整权限</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ color: C.GRAY, fontSize: 20 }}>✕</Text></Pressable>
          </View>

          {/* 消息列表 */}
          <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ padding: 14, gap: 10 }}>
            {msgs.length === 0 && (
              <View style={{ alignItems: 'center', paddingTop: 30, gap: 10 }}>
                <Text style={{ fontSize: 40 }}>🤖</Text>
                <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold' }}>{AI_TITLE[rank]}</Text>
                <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                  发送"帮助"查看全部功能{'\n'}或直接提问，我来解答
                </Text>
              </View>
            )}
            {msgs.map(m => (
              <AgentAnimBubble key={m.id} role={m.role}>
                <View style={{ alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <View style={{
                    maxWidth: '82%', borderRadius: 12, padding: 10,
                    backgroundColor: m.role === 'user' ? `${ballColor}25` : C.PANEL2,
                    borderWidth: 1,
                    borderColor: m.role === 'user' ? `${ballColor}60` : C.BORDER,
                  }}>
                    {m.thinking ? (
                      <AgentThinkingDots color={ballColor} />
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                        <Text style={{ color: C.WHITE, fontSize: 13, lineHeight: 20 }}>{m.text}</Text>
                        {m.streaming && <AgentBlinkCursor color={ballColor} />}
                      </View>
                    )}
                  </View>
                </View>
              </AgentAnimBubble>
            ))}
          </ScrollView>

          {/* 输入框 */}
          <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: C.BORDER }}>
            <TextInput
              value={input}
              onChangeText={setInput}
              placeholder="向AI提问..."
              placeholderTextColor={C.GRAY2}
              style={{ flex: 1, backgroundColor: C.BG, borderWidth: 1, borderColor: C.BORDER, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: C.WHITE, fontSize: 13 }}
              returnKeyType="send"
              onSubmitEditing={send}
              editable={!sending}
            />
            <Pressable cssInterop={false}
              onPress={send}
              disabled={sending}
              style={({ pressed }) => ({ backgroundColor: sending ? C.GRAY2 : (pressed ? '#1A5FCC' : ballColor), borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' })}
            >
              <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{sending ? '…' : '发送'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function buildAgentAiReply(input: string, rank: AgentRank): string {
  const t = input.trim();
  // 通用 — 违禁词检测回复（bot层面不生产违规内容）
  if (AI_VIOLATION_WORDS.some(w => t.includes(w))) {
    return '⚠️ 您的消息包含违规词汇，已被系统拦截并上报总台。请勿使用"包赢"、"透视"、"100%"等违规表述，AI将暂停服务24小时。';
  }
  // 销售数据
  if (t.includes('销售') || t.includes('数据') || t.includes('业绩')) {
    const n = Math.floor(Math.random() * 20) + 3;
    const amt = (n * parseFloat('39.9') * 0.8).toFixed(0);
    return `📊 本月销售数据（模拟）：\n· 已售卡数：${n} 张\n· 预计收益：¥${amt}\n· 最热套餐：30天月卡\n\n继续努力！`;
  }
  // 推广文案
  if (t.includes('文案') || t.includes('朋友圈') || t.includes('推广')) {
    return `✍️ 推广文案（朋友圈版）：\n\n"打牌前先扫一遍，多开/辅助工具一秒现形，8项指标实时显示，安全了再开局，赢得踏实！现在有限时优惠，感兴趣的私聊我～"\n\n⚠️ 请确认当地合规后再发布，不得使用"包赢"等违规表述。`;
  }
  // 客户常见问题
  if (t.includes('常见') || t.includes('客户问') || t.includes('FAQ') || t.includes('问题')) {
    return `💬 客户常见问题参考：\n\nQ: 这个工具能保证赢吗？\nA: 本工具仅检测牌局环境安全，不影响对局结果，结果仅供参考。\n\nQ: 支持什么游戏？\nA: 支持主流牌类游戏环境检测。\n\nQ: 安全吗？\nA: 纯检测工具，不修改任何游戏数据。`;
  }
  // 中级+ 功能
  if (rank === '中级代理' || rank === '高级代理') {
    if (t.includes('画像') || t.includes('客户分析')) {
      return `🎯 您的客户画像分析（模拟）：\n· 主力用户：25-35岁男性，占比约68%\n· 复购率：约42%\n· 主要来源：微信好友介绍\n· 高活跃时段：晚上20:00-23:00\n\n建议：晚间发朋友圈效果最佳。`;
    }
    if (t.includes('营销') || t.includes('建议')) {
      return `💡 个性化营销建议：\n1. 晚8点发朋友圈，触达率高30%\n2. 复购客户发私信提醒续费，成功率约55%\n3. 周末推30天月卡，转化最高\n4. 用"安全护航"代替"防作弊"表述，合规且更有吸引力`;
    }
    if (t.includes('收入') || t.includes('预测')) {
      const base = Math.floor(Math.random() * 800) + 400;
      return `💰 本月收入预测（模拟）：\n· 预计销售额：¥${base}\n· 预计纯利润：¥${Math.floor(base * 0.4)}\n· 较上月趋势：↑ ${Math.floor(Math.random() * 20) + 5}%\n\n如增加朋友圈推送频率，预计可提升15%。`;
    }
    if (t.includes('到期') || t.includes('续费') || t.includes('提醒')) {
      return `⏰ 近期到期客户提醒（模拟）：\n· 张先生：3天后到期，30天月卡\n· 李女士：5天后到期，30天月卡\n· 王先生：7天后到期，年卡\n\n建议：提前2-3天主动联系，续费成功率约70%。`;
    }
  }
  // 高级 专属功能
  if (rank === '高级代理') {
    if (t.includes('下级') || t.includes('团队') || t.includes('下线')) {
      return `👥 下级代理数据（模拟）：\n· 团队规模：3人\n  - 初级代理 ×2\n  - 中级代理 ×1\n· 本月团队总销售额：¥2,340\n· 表现最佳：中级代理"小李"\n\n建议：激励初级代理升级，团队收益提升明显。`;
    }
    if (t.includes('自动回复') || t.includes('睡觉') || t.includes('挂载')) {
      return `🤖 AI自动回复功能：\n\n此功能已为您的客服入口挂载智能回复模板。当客户询问价格、功能、使用方式时，AI将自动响应。\n\n已配置自动回复场景：\n· 价格咨询 → 自动报价\n· 功能咨询 → 自动介绍\n· 购买意向 → 自动引导付款\n\n⚠️ AI不会承诺"包赢"等违规内容。`;
    }
    if (t.includes('策略') || t.includes('高级营销')) {
      return `🏆 高级营销策略建议：\n\n1. 建立私域圈子（50人群），定期分享护航数据\n2. 以"安全验证截图"为内容素材，真实感强\n3. 开展老带新活动，激励复购客户推荐\n4. 节假日前3天推套餐，决策欲望最强\n5. 高级代理独家：提供"团购价"，吸引3人以上组团`;
    }
  }
  // 帮助
  if (t.includes('帮助') || t.includes('功能') || t.includes('你能做什么')) {
    const features = AI_FEATURES[rank];
    return `${AI_TITLE[rank]} 支持以下功能：\n\n${features.map(f => f).join('\n')}\n\n⚠️ AI不可修改价格、封禁用户或调整权限。`;
  }
  return `您好！我是${AI_TITLE[rank]}。\n\n您可以问我：\n· "查询本月销售数据"\n· "帮我写推广文案"\n· "客户常见问题有哪些"\n${rank !== '初级代理' ? '· "分析我的客户画像"\n· "预测本月收入"\n' : ''}${rank === '高级代理' ? '· "查看下级代理数据"\n' : ''}\n发送"帮助"查看全部功能。`;
}

// ── 主页面 ────────────────────────────────────────────────
export default function AgentCenterScreen() {
  const router = useRouter();
  const [markup, setMarkupState] = useState(getAgentMarkup);
  const [rank, setRankState]     = useState(getAgentRank);
  const [aiEnabled, setAiEnabled] = useState(getAgentAiEnabled);
  const [showAiChat, setShowAiChat] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const [showCustomers, setShowCustomers] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const cfg = getConfig();

  useFocusEffect(useCallback(() => {
    setMarkupState(getAgentMarkup());
    setRankState(getAgentRank());
    setAiEnabled(getAgentAiEnabled());
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]));

  const info      = RANK_CONFIG[rank];
  const ballColor = AI_BALL_COLOR[rank];
  const PLANS = [
    { label: '3天体验卡', cost: cfg.cost3Day },
    { label: '30天月卡',  cost: cfg.cost30Day },
    { label: '半年卡',    cost: cfg.cost180Day },
    { label: '年卡',      cost: cfg.cost365Day },
  ];

  const handleMarkup = (val: number) => {
    const v = Math.round(val);
    setAgentMarkup(v);
    setMarkupState(v);
  };

  // ── 收益数据（模拟） ──
  const earnings = getAgentEarnings();
  const customers = getAgentCustomers();
  const leaderboard = getAgentLeaderboard();

  // ── 晋级进度 ──
  const UPGRADE_TARGET: Record<AgentRank, number | null> = {
    '初级代理': 2000,
    '中级代理': 10000,
    '高级代理': null,
  };
  const currentSales = earnings.total;
  const upgradeTarget = UPGRADE_TARGET[rank];
  const upgradeProgress = upgradeTarget ? Math.min(currentSales / upgradeTarget, 1) : 1;

  // ── 代理专属推广链接（订单自动归因） ──
  const agentState = getLoginState();
  const agentUid = agentState.agentPhone
    ? `${agentState.agentPhone.slice(-6)}${rank.slice(0,1)}`
    : `ag${rank.slice(0,1)}demo`;
  const APP_BASE_URL = 'https://app.pjhhjh.com';
  const agentExclusiveLink = `${APP_BASE_URL}?ref=${agentUid}`;

  // 代理专属二维码：使用 qrserver.com 动态生成含邀请码的二维码
  const agentQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&format=png&data=${encodeURIComponent(agentExclusiveLink)}`;

  // ── 3条预置推广文案（含代理专属链接） ──
  const PRESET_PROMO_TEXTS = [
    `😨 最近打牌老输？不是你手气背，可能是别人开了挂！我用牌局环境守护，每次打牌前扫一下，能查出来谁开了多开/透视。🎁 新用户免费试用10分钟，扫码就能用！${agentExclusiveLink}`,
    `打了这么多年牌，有没有遇到过"怎么打怎么输"？不是你技术不行，是有人用了辅助工具。牌局环境守护，专扫作弊软件，免费10分钟，先试试再说👇\n${agentExclusiveLink}`,
    `💰 既能保护自己、又能赚零花钱的工具！开通代理后推荐给牌友，他们付费你赚钱。反正免费试用，不吃亏！扫码了解👇\n${agentExclusiveLink}`,
  ];
  const [copiedPromoIdx, setCopiedPromoIdx] = useState(-1);

  // 判断当前代理是否上榜
  const myRankIdx = leaderboard.findIndex(e => e.isSelf);

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 80 }} contentInsetAdjustmentBehavior="automatic">
        {/* 标题栏 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 52 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>代理中心</Text>
            <Text style={{ color: C.GRAY, fontSize: 10 }}>AGENT CENTER</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(app)/agent-upgrade')}
            style={{ backgroundColor: C.BLUE_BG, borderRadius: 8, borderWidth: 1, borderColor: `${C.BLUE}50`, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold' }}>升级</Text>
          </Pressable>
        </View>

        {/* ── 实时收益卡片（v19新增） ── */}
        <View style={{ marginHorizontal: 20, marginBottom: 14, backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 18 }}>
          <Text style={{ color: C.GRAY, fontSize: 11, marginBottom: 12 }}>实时收益</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[
              { label: '今日收益', val: `¥${earnings.today}` },
              { label: '本月收益', val: `¥${earnings.month}` },
              { label: '累计收益', val: `¥${earnings.total}` },
            ].map(item => (
              <View key={item.label} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
                <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] }}>{item.val}</Text>
                <Text style={{ color: C.GRAY, fontSize: 10 }}>{item.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 等级卡 + 晋级进度条 */}
        <View style={{ marginHorizontal: 20, backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 20, gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{
              width: 60, height: 60, borderRadius: 30,
              backgroundColor: `${info.color}15`,
              borderWidth: 2, borderColor: `${info.color}60`,
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Text style={{ fontSize: 28 }}>{info.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.WHITE, fontSize: 18, fontWeight: 'bold' }}>{rank}</Text>
              <Text style={{ color: info.color, fontSize: 12 }}>{info.label}</Text>
            </View>
            <View style={{ backgroundColor: `${info.color}20`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: `${info.color}50` }}>
              <Text style={{ color: info.color, fontSize: 11, fontWeight: 'bold' }}>加价上限 {getMarkupLimitForRank(rank)}%</Text>
            </View>
          </View>

          {/* 晋级进度条（v19新增） */}
          {upgradeTarget ? (
            <View style={{ gap: 6 }}>
              <View style={{ height: 6, backgroundColor: C.BORDER, borderRadius: 3, overflow: 'hidden' }}>
                <View style={{ width: `${upgradeProgress * 100}%`, height: '100%', backgroundColor: info.color, borderRadius: 3 }} />
              </View>
              {upgradeProgress >= 1 ? (
                <Pressable onPress={() => router.push('/(app)/agent-upgrade')} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: C.GOLD, fontSize: 12, fontWeight: 'bold' }}>🎉 已满足升级条件！</Text>
                  <Text style={{ color: C.BLUE, fontSize: 12 }}>立即升级 →</Text>
                </Pressable>
              ) : (
                <Text style={{ color: C.GRAY, fontSize: 11 }}>
                  距离{rank === '初级代理' ? '中级' : '高级'}代理还差 ¥{(upgradeTarget - currentSales).toFixed(0)} 销售额
                </Text>
              )}
            </View>
          ) : (
            <Text style={{ color: C.GOLD, fontSize: 12, fontWeight: 'bold' }}>🏆 已达最高等级</Text>
          )}

          {/* AI 状态标签 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <View style={{ backgroundColor: aiEnabled ? `${ballColor}18` : C.PANEL2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: aiEnabled ? `${ballColor}50` : C.BORDER }}>
              <Text style={{ color: aiEnabled ? ballColor : C.GRAY, fontSize: 11, fontWeight: 'bold' }}>
                {aiEnabled ? `${AI_TITLE[rank]} 已开启` : '🤖 AI助手 已关闭（请联系总台）'}
              </Text>
            </View>
          </View>
        </View>

        {/* 功能按钮行（推广素材库 + 我的客户）（v19新增） */}
        <View style={{ marginHorizontal: 20, marginTop: 14, flexDirection: 'row', gap: 12 }}>
          <Pressable cssInterop={false}
            onPress={() => setShowPoster(true)}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: pressed ? C.PANEL2 : C.PANEL,
              borderRadius: 14, borderWidth: 1, borderColor: `${C.BLUE}50`,
              padding: 14, alignItems: 'center', gap: 6,
            })}
          >
            <Text style={{ fontSize: 22 }}>🎨</Text>
            <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold' }}>智能推广</Text>
            <Text style={{ color: C.GRAY, fontSize: 10 }}>海报+文案一键生成</Text>
          </Pressable>
          <Pressable cssInterop={false}
            onPress={() => setShowCustomers(true)}
            style={({ pressed }) => ({
              flex: 1, backgroundColor: pressed ? C.PANEL2 : C.PANEL,
              borderRadius: 14, borderWidth: 1, borderColor: `${C.GREEN}50`,
              padding: 14, alignItems: 'center', gap: 6,
            })}
          >
            <Text style={{ fontSize: 22 }}>👥</Text>
            <Text style={{ color: C.GREEN, fontSize: 12, fontWeight: 'bold' }}>我的客户</Text>
            <Text style={{ color: C.GRAY, fontSize: 10 }}>{customers.length} 位客户</Text>
          </Pressable>
        </View>

        {/* 📋 预置推广文案快捷复制 */}
        <View style={{ marginHorizontal: 20, marginTop: 12, backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1, borderColor: C.BORDER, padding: 16, gap: 10 }}>
          <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold' }}>📋 推广素材库 · 一键复制</Text>
          <Text style={{ color: C.GRAY, fontSize: 10 }}>已自动嵌入您的专属推广链接（订单自动归因）</Text>
          {PRESET_PROMO_TEXTS.map((txt, idx) => (
            <View key={idx} style={{ backgroundColor: C.BG, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER2, padding: 12, gap: 8 }}>
              <Text style={{ color: C.GRAY, fontSize: 11, lineHeight: 17 }} numberOfLines={3}>{txt}</Text>
              <Pressable cssInterop={false}
                onPress={async () => {
                  await Clipboard.setStringAsync(txt);
                  setCopiedPromoIdx(idx);
                  setTimeout(() => setCopiedPromoIdx(-1), 2000);
                }}
                style={({ pressed }) => ({
                  alignSelf: 'flex-end',
                  backgroundColor: copiedPromoIdx === idx ? C.GREEN : (pressed ? C.PANEL2 : C.BLUE_BG),
                  borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6,
                  borderWidth: 1, borderColor: copiedPromoIdx === idx ? C.GREEN : `${C.BLUE}60`,
                })}
              >
                <Text style={{ color: copiedPromoIdx === idx ? '#fff' : C.BLUE, fontSize: 12 }}>
                  {copiedPromoIdx === idx ? '✅ 已复制' : '📋 一键复制'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* 加价滑块 */}
        <View style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1, borderColor: C.BORDER, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>当前加价比例</Text>
            <View style={{ backgroundColor: C.BLUE_BG, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4, borderWidth: 1, borderColor: `${C.BLUE}50` }}>
              <Text style={{ color: C.BLUE, fontSize: 16, fontWeight: 'bold' }}>{markup}%</Text>
            </View>
          </View>
          <Slider
            minimumValue={1}
            maximumValue={getMarkupLimitForRank(rank)}
            step={1}
            value={markup}
            onValueChange={handleMarkup}
            minimumTrackTintColor={C.BLUE}
            maximumTrackTintColor={C.BORDER}
            thumbTintColor={C.BLUE}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={{ color: C.GRAY, fontSize: 10 }}>最低 1%</Text>
            <Text style={{ color: C.GRAY, fontSize: 10 }}>上限 {getMarkupLimitForRank(rank)}%</Text>
          </View>
        </View>

        {/* 售价预览 + 分享链接说明 */}
        <View style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1, borderColor: C.BORDER, padding: 16, gap: 10 }}>
          <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold', marginBottom: 4 }}>我的售价</Text>
          {PLANS.map(p => (
            <View key={p.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.BORDER2 }}>
              <Text style={{ color: C.GRAY, fontSize: 13, flex: 1 }}>{p.label}</Text>
              <Text style={{ color: C.GRAY2, fontSize: 12 }}>拿货 ¥{calcCostPrice(p.cost)}</Text>
              <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold', marginLeft: 16 }}>→ ¥{calcAgentPrice(p.cost)}</Text>
            </View>
          ))}
          {/* 代理分享链接归因说明 */}
          <View style={{ backgroundColor: `${C.BLUE}10`, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: `${C.BLUE}30`, marginTop: 4 }}>
            <Text style={{ color: C.BLUE, fontSize: 11, lineHeight: 18 }}>
              🔗 分享链接已绑定您的代理身份，客户购买自动计入您的收益，无需保持在线
            </Text>
          </View>
        </View>

        {/* 代理须知 */}
        <View style={{ marginHorizontal: 20, marginTop: 14, backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER, padding: 14, gap: 6 }}>
          <Text style={{ color: C.GRAY, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>代理须知</Text>
          {[
            '代理仅可在规定上限内加价，不得低价倾销',
            '收益仅限自身加价差价，严禁发展多层级下线',
            '严禁宣传为外挂、作弊等工具',
          ].map(t => (
            <Text key={t} style={{ color: C.GRAY2, fontSize: 11, lineHeight: 17 }}>· {t}</Text>
          ))}
        </View>

        {/* ── 本月销售排行榜（v19新增） ── */}
        <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1, borderColor: `${C.GOLD}40`, padding: 16, gap: 12 }}>
          <Text style={{ color: C.GOLD, fontSize: 14, fontWeight: 'bold' }}>🏆 本月销售排行榜</Text>
          {leaderboard.slice(0, 3).map((entry, i) => (
            <View
              key={entry.phoneMasked}
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 10,
                backgroundColor: i === 0 ? `${C.GOLD}15` : (entry.isSelf ? `${C.BLUE}15` : 'transparent'),
                borderRadius: 10, padding: 10,
                borderWidth: i === 0 ? 1 : 0, borderColor: `${C.GOLD}50`,
              }}
            >
              <Text style={{ color: i === 0 ? C.GOLD : C.GRAY, fontSize: 16, width: 24, textAlign: 'center' }}>
                {i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉'}
              </Text>
              <Text style={{ color: i === 0 ? C.GOLD : C.WHITE, fontSize: 13, flex: 1, fontWeight: i === 0 ? 'bold' : 'normal' }}>
                {entry.phoneMasked}{entry.isSelf ? ' （我）' : ''}
              </Text>
              <Text style={{ color: i === 0 ? C.GOLD : C.GRAY, fontSize: 13, fontWeight: 'bold' }}>¥{entry.sales}</Text>
            </View>
          ))}
          {myRankIdx >= 3 && (
            <Text style={{ color: C.BLUE, fontSize: 11, textAlign: 'center' }}>
              您当前排名第 {myRankIdx + 1} 名，继续加油！
            </Text>
          )}
        </View>

        {/* 升级诱导 */}
        {rank === '初级代理' && (
          <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: 'rgba(192,192,192,0.08)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(192,192,192,0.3)', padding: 16, gap: 10 }}>
            <Text style={{ color: '#C0C0C0', fontSize: 13, fontWeight: 'bold' }}>📈 提升收益小贴士</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>
              升级中级代理后，可额外解锁：{'\n'}
              🎯 客户画像分析 · 💡 个性化营销建议{'\n'}
              💰 预测本月收入 · ⏰ 到期客户提醒{'\n'}
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>加价上限从 {cfg.markupLimitBasic}% → <Text style={{ color: '#C0C0C0', fontWeight: 'bold' }}>{cfg.markupLimitMid}%</Text></Text>
            <Pressable cssInterop={false}
              onPress={() => router.push('/(app)/agent-upgrade')}
              style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(192,192,192,0.2)' : 'rgba(192,192,192,0.12)', borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(192,192,192,0.4)' })}
            >
              <Text style={{ color: '#C0C0C0', fontSize: 13, fontWeight: 'bold' }}>了解中级代理 →</Text>
            </Pressable>
          </View>
        )}
        {rank === '中级代理' && (
          <View style={{ marginHorizontal: 20, marginTop: 16, backgroundColor: 'rgba(255,200,50,0.08)', borderRadius: 14, borderWidth: 2, borderColor: 'rgba(255,200,50,0.4)', padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: C.GOLD, fontSize: 13, fontWeight: 'bold' }}>🔓 解锁躺赚模式</Text>
              <View style={{ backgroundColor: 'rgba(255,200,50,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: C.GOLD, fontSize: 10, fontWeight: 'bold' }}>已有 62 位代理升级</Text>
              </View>
            </View>
            <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>
              🤖 <Text style={{ color: C.WHITE, fontWeight: 'bold' }}>AI自动回复客户 → 睡觉也能帮你卖卡！</Text>{'\n'}
              👥 查看下级代理数据 · 📈 团队经营分析{'\n'}
              🏆 高级营销策略建议
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>加价上限从 {cfg.markupLimitMid}% → <Text style={{ color: C.GOLD, fontWeight: 'bold' }}>{cfg.markupLimitHigh}%</Text></Text>
            <Pressable cssInterop={false}
              onPress={() => router.push('/(app)/agent-upgrade')}
              style={({ pressed }) => ({ backgroundColor: pressed ? 'rgba(255,200,50,0.25)' : 'rgba(255,200,50,0.15)', borderRadius: 10, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,200,50,0.5)' })}
            >
              <Text style={{ color: C.GOLD, fontSize: 14, fontWeight: 'bold' }}>立即升级到高级 👑</Text>
            </Pressable>
          </View>
        )}

        <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center', marginHorizontal: 20, marginTop: 16 }}>
          ☁️ 数据已云端同步，换手机登录即可恢复
        </Text>
      </ScrollView>

      {/* AI 悬浮球 */}
      {aiEnabled && (
        <Animated.View style={{ position: 'absolute', bottom: 36, right: 20, transform: [{ scale: pulseAnim }] }}>
          <Pressable
            onPress={() => setShowAiChat(true)}
            style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: ballColor,
              alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 4px 16px ${ballColor}80`,
            }}
          >
            <Text style={{ fontSize: 26 }}>🤖</Text>
          </Pressable>
        </Animated.View>
      )}

      <AgentAiChatModal visible={showAiChat} onClose={() => setShowAiChat(false)} rank={rank} />

      {/* 代理专属 智能推广海报与文案生成器 */}
      <PosterGenerator
        visible={showPoster}
        onClose={() => setShowPoster(false)}
        config={cfg}
        mode="agent"
        agentLink={agentExclusiveLink}
        agentNickname={agentState.agentPhone ? `代理${agentState.agentPhone.slice(-4)}` : '代理'}
        qrImageUrl={agentQrUrl}
      />

      {/* 我的客户弹窗 */}
      <Modal visible={showCustomers} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.PANEL, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
              <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', flex: 1 }}>👥 我的客户</Text>
              <Pressable onPress={() => setShowCustomers(false)} hitSlop={12}>
                <Text style={{ color: C.GRAY, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
              {customers.map((c, _i) => {
                const expSoon = c.expireTime - Date.now() < 3 * 24 * 3600 * 1000;
                return (
                  <View
                    key={c.id}
                    style={{
                      backgroundColor: expSoon ? `${C.STREAK}10` : C.PANEL2,
                      borderRadius: 12, borderWidth: 1,
                      borderColor: expSoon ? `${C.STREAK}50` : C.BORDER,
                      padding: 12,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: expSoon ? 4 : 0 }}>
                      {expSoon && (
                        <View style={{ backgroundColor: `${C.STREAK}20`, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                          <Text style={{ color: C.STREAK, fontSize: 10, fontWeight: 'bold' }}>即将到期</Text>
                        </View>
                      )}
                      <Text style={{ color: expSoon ? C.STREAK : C.WHITE, fontSize: 13, flex: 1 }}>{c.phoneMasked}</Text>
                      <Text style={{ color: C.GRAY, fontSize: 11 }}>{c.plan}</Text>
                    </View>
                    <Text style={{ color: C.GRAY2, fontSize: 11 }}>
                      到期：{new Date(c.expireTime).toLocaleDateString('zh-CN')}
                    </Text>
                  </View>
                );
              })}
              {customers.length === 0 && (
                <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', marginTop: 20 }}>暂无客户</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
