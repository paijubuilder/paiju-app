/**
 * 代理开通/升级页 v21 — 三级选择 + 付款区域 + 确认弹窗 + 订单流程
 * 三列互斥选择（金色高亮）→ 付款区域展开（含二维码）→ 付款确认弹窗 → 提交订单
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { supabase } from '@/client/supabase';
import { getAgentRank, isAgentActivated, getConfig, createOrder, updateOrderPayInfo } from '@/lib/appStore';
import DocModal from '@/components/DocModal';
import AiCsModal from '@/components/AiCsModal';
import TutorialOverlay from '@/components/TutorialOverlay';
import type { AgentRank } from '@/lib/appStore';

const AGENT_AGREEMENT = `牌局环境守护 · 代理合作协议

第一条、代理资格与退款政策：乙方自愿申请成为代理，开通即同意本协议。代理分初/中/高三级，可付费升级。代理权限属于在线交付的数字化虚拟服务，支付成功后即开通；首次在代理中心查看拿货价格或进行加价操作时视为已激活使用。激活后不支持退款；未激活前可联系客服处理。

第二条、代理权益：按等级专属代理价拿货，可在平台设定上限内自主加价销售，差价归代理。

第三条、价格规则：成本价平台统一设定并公示，代理仅可在规定上限内加价，不得低价倾销。

第四条、代理禁止行为：
1. 严禁发展多层级下线及设置拉人头提成或下级充值上级抽佣模式，收益仅限自身加价差价。
2. 严禁宣传为外挂、作弊、透视、看牌等工具。
3. 严禁以平台名义从事无关经营。
4. 严禁恶意诋毁平台或代理。

第五条、违规处理：违反禁止行为将立即暂停或永久取消代理资格，已付费不退。违规导致的纠纷或法律后果由代理自行承担。

第六条、免责声明：本产品为通用环境扫描工具，结果仅供参考。代理不得夸大检测效果。因代理虚假宣传导致的纠纷与平台无关。

第七条、协议变更：平台修改协议将公示并通知，代理不同意可停止并注销资格。

第八条、争议解决：本协议适用中国法律，协商不成由平台运营方所在地法院管辖。`;

// ── 三级代理配置 ──────────────────────────────────────────
type ColDef = {
  rank: AgentRank;
  medal: string;
  priceKey: 'costAgentBasic' | 'costAgentMidUp' | 'costAgentHighUp';
  costDesc: string;
  aiLevel: string;
  aiFeatures: string[];
  isGold: boolean;
  badge?: string;
  selectLabel: string;
};

const COLS: ColDef[] = [
  {
    rank: '初级代理', medal: '🥉', priceKey: 'costAgentBasic',
    costDesc: '专属代理价拿货',
    aiLevel: 'AI基础助手',
    aiFeatures: ['查询销售数据', '生成推广文案', '自动回答客户问题'],
    isGold: false,
    selectLabel: '选择初级',
  },
  {
    rank: '中级代理', medal: '🥈', priceKey: 'costAgentMidUp',
    costDesc: '更低的拿货成本',
    aiLevel: 'AI智能管家',
    aiFeatures: ['客户画像分析', '个性化营销', '预测收入趋势'],
    isGold: false,
    selectLabel: '选择中级',
  },
  {
    rank: '高级代理', medal: '🥇', priceKey: 'costAgentHighUp',
    costDesc: '超低拿货成本',
    aiLevel: 'AI首席助手',
    aiFeatures: ['AI自动回复', '睡觉也能卖卡', '查看下级数据'],
    isGold: true,
    badge: '👑最受欢迎',
    selectLabel: '选择高级',
  },
];

// ── 主页面 ────────────────────────────────────────────────
export default function AgentUpgradeScreen() {
  const router = useRouter();
  const cfg = getConfig();
  const currentRank = getAgentRank();

  // 三级互斥选择
  const [selectedRank, setSelectedRank] = useState<AgentRank | null>(null);

  // 协议/客服弹窗
  const [checked, setChecked] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showCS, setShowCS] = useState(false);
  const [showTutorialStep6, setShowTutorialStep6] = useState(true);

  // 付款区域展开动画
  const payAreaHeight = useRef(new Animated.Value(0)).current;
  const payAreaOpacity = useRef(new Animated.Value(0)).current;
  const [payAreaVisible, setPayAreaVisible] = useState(false);

  // 付款确认弹窗状态
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payTime, setPayTime] = useState('');
  const [payNick, setPayNick] = useState('');
  const [payScreenshotUri, setPayScreenshotUri] = useState('');
  const [pendingOrderId, setPendingOrderId] = useState('');

  // 提交成功弹窗
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  // 代理收款二维码（从 Supabase 读取）
  const [agentQrUrl, setAgentQrUrl] = useState('');
  useEffect(() => {
    supabase.from('qrcode_configs')
      .select('image_url')
      .eq('config_key', 'agent_qr')
      .maybeSingle()
      .then(({ data }) => { if (data?.image_url) setAgentQrUrl(data.image_url); });
  }, []);

  const PRICES: Record<ColDef['priceKey'], string> = {
    costAgentBasic:  cfg.costAgentBasic,
    costAgentMidUp:  cfg.costAgentMidUp,
    costAgentHighUp: cfg.costAgentHighUp,
  };

  // 已拥有等级判断
  // 数据来源说明：
  // - isAgentActivated()=false（默认）→ 未开通，所有按钮显示【选择XX】可点击
  // - isAgentActivated()=true（管理员确认后）→ 按等级层级判断已开通项
  const isOwned = (rank: AgentRank) => {
    if (!isAgentActivated()) return false; // 未经管理员确认，一律未开通
    return (
      (rank === '初级代理') ||
      (rank === '中级代理' && (currentRank === '中级代理' || currentRank === '高级代理')) ||
      (rank === '高级代理' && currentRank === '高级代理')
    );
  };

  // 选中等级 → 展开付款区域
  const handleSelectRank = (rank: AgentRank) => {
    if (isOwned(rank)) return;
    setSelectedRank(rank);
    if (!payAreaVisible) {
      setPayAreaVisible(true);
      Animated.parallel([
        Animated.timing(payAreaHeight, { toValue: 1, duration: 320, useNativeDriver: false }),
        Animated.timing(payAreaOpacity, { toValue: 1, duration: 320, useNativeDriver: false }),
      ]).start();
    }
  };

  // 点击"我已完成付款，下一步" → 创建订单 → 弹付款确认弹窗
  const handleNextStep = () => {
    if (!selectedRank || !checked) return;
    const col = COLS.find(c => c.rank === selectedRank)!;
    const price = PRICES[col.priceKey];
    const order = createOrder({
      planType: 'agent',
      planLabel: selectedRank,
      planDays: 0,
      planPrice: price,
      agentLevel: selectedRank,
    });
    setPendingOrderId(order.id);
    setPayAmount('');
    setPayTime('');
    setPayNick('');
    setPayScreenshotUri('');
    setShowPayDialog(true);
  };

  // 上传截图
  const handlePickScreenshot = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPayScreenshotUri(result.assets[0].uri);
    }
  };

  // 确认提交付款信息
  const handleConfirmSubmit = () => {
    if (!payAmount.trim() || !payTime.trim()) return;
    updateOrderPayInfo(pendingOrderId, payAmount.trim(), payTime.trim(), payNick.trim(), payScreenshotUri);
    setShowPayDialog(false);
    setShowSuccessDialog(true);
  };

  const canSubmit = payAmount.trim().length > 0 && payTime.trim().length > 0;

  const selectedCol = COLS.find(c => c.rank === selectedRank);
  const selectedPrice = selectedCol ? PRICES[selectedCol.priceKey] : '';

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} contentInsetAdjustmentBehavior="automatic">

        {/* 标题栏 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 52 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>🏆 成为代理，赚取收益</Text>
            <Text style={{ color: C.GRAY, fontSize: 10 }}>AGENT PROGRAM · 当前：{currentRank}</Text>
          </View>
        </View>

        {/* ── 三级代理选择区（三列紧凑，一屏可见） ── */}
        <View style={{ marginHorizontal: 10, flexDirection: 'row', gap: 6 }}>
          {COLS.map((col) => {
            const owned = isOwned(col.rank);
            const selected = selectedRank === col.rank;
            const borderColor = col.isGold ? C.GOLD : col.rank === '中级代理' ? '#A8B4C0' : C.BLUE;
            const activeBorder = selected ? C.GOLD : (col.isGold ? C.GOLD : C.BORDER);
            const activeBg = selected
              ? `${C.GOLD}12`
              : col.isGold ? `${C.GOLD}06` : C.PANEL;

            return (
              <View
                key={col.rank}
                style={{
                  flex: 1,
                  backgroundColor: activeBg,
                  borderRadius: 14,
                  borderWidth: selected ? 2 : col.isGold ? 2 : 1,
                  borderColor: activeBorder,
                  padding: 10, gap: 7,
                  position: 'relative',
                }}
              >
                {/* 徽章 */}
                {col.badge && (
                  <View style={{
                    position: 'absolute', top: -1, right: -1,
                    backgroundColor: C.GOLD, borderRadius: 6,
                    paddingHorizontal: 5, paddingVertical: 2,
                  }}>
                    <Text style={{ color: '#1A1200', fontSize: 8, fontWeight: 'bold' }}>{col.badge}</Text>
                  </View>
                )}

                {/* 等级图标+名称 */}
                <View style={{ alignItems: 'center', gap: 3, paddingTop: col.badge ? 10 : 0 }}>
                  <Text style={{ fontSize: 22 }}>{col.medal}</Text>
                  <Text style={{
                    color: selected ? C.GOLD : (col.isGold ? C.GOLD : C.WHITE),
                    fontSize: 11, fontWeight: 'bold', textAlign: 'center',
                  }}>
                    {col.rank}
                  </Text>
                </View>

                {/* 价格 */}
                <View style={{ alignItems: 'center' }}>
                  <Text style={{
                    color: selected ? C.GOLD : (col.isGold ? C.GOLD : C.WHITE),
                    fontSize: 19, fontWeight: 'bold',
                  }}>
                    ¥{PRICES[col.priceKey]}
                  </Text>
                </View>

                {/* 描述 */}
                <DescRow color={borderColor} text={col.costDesc} />
                <DescRow color={borderColor} text={col.aiLevel} />

                {/* AI 功能简列 */}
                <View style={{
                  backgroundColor: `${borderColor}10`, borderRadius: 7,
                  padding: 6, gap: 2, borderWidth: 1, borderColor: `${borderColor}25`,
                }}>
                  {col.aiFeatures.map(f => (
                    <Text key={f} style={{ color: C.GRAY, fontSize: 9, lineHeight: 13 }}>· {f}</Text>
                  ))}
                </View>

                {/* 选择按钮 */}
                <Pressable cssInterop={false}
                  onPress={() => handleSelectRank(col.rank)}
                  disabled={owned}
                  style={({ pressed }) => ({
                    borderRadius: 8, paddingVertical: 9, alignItems: 'center',
                    backgroundColor: owned
                      ? C.PANEL2
                      : selected
                        ? C.GOLD
                        : pressed ? `${borderColor}80` : 'transparent',
                    borderWidth: owned ? 1 : 1.5,
                    borderColor: owned ? C.BORDER : selected ? C.GOLD : borderColor,
                  })}
                >
                  <Text style={{
                    color: owned
                      ? C.GRAY2
                      : selected
                        ? '#1A1200'
                        : borderColor,
                    fontSize: 11, fontWeight: 'bold',
                  }}>
                    {owned ? '已开通' : `【${col.selectLabel}】`}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>

        {/* ── 付款区域（选中等级后展开） ── */}
        {payAreaVisible && (
          <Animated.View style={{ opacity: payAreaOpacity, marginHorizontal: 14, marginTop: 16, gap: 12 }}>

            {/* 已选提示 */}
            <View style={{ backgroundColor: `${C.GOLD}15`, borderRadius: 10, borderWidth: 1, borderColor: `${C.GOLD}40`, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: C.GOLD, fontSize: 14, fontWeight: 'bold' }}>
                您已选择：{selectedRank}（¥{selectedPrice}）
              </Text>
            </View>

            {/* 收款二维码 */}
            <View style={{ backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1, borderColor: C.BORDER, padding: 18, alignItems: 'center', gap: 10 }}>
              {agentQrUrl ? (
                <View style={{ width: 150, height: 150, borderRadius: 10, overflow: 'hidden', backgroundColor: '#fff' }}>
                  <Image source={{ uri: agentQrUrl }} style={{ flex: 1 }} contentFit="contain" />
                </View>
              ) : (
                <View style={{ width: 150, height: 150, backgroundColor: C.BG, borderWidth: 1, borderColor: C.BORDER2, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 36 }}>📱</Text>
                  <Text style={{ color: C.GRAY, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>收款码暂未配置{'\n'}请联系客服</Text>
                </View>
              )}
              <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center' }}>
                📱 请使用微信或支付宝扫码支付
              </Text>
            </View>

            {/* 协议勾选 */}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Pressable
                onPress={() => setChecked(v => !v)}
                style={{
                  width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                  borderColor: checked ? C.BLUE : C.GRAY2,
                  backgroundColor: checked ? C.BLUE : 'transparent',
                  alignItems: 'center', justifyContent: 'center', marginTop: 2,
                }}
              >
                {checked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
              </Pressable>
              <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>我已阅读并同意 </Text>
                <Pressable onPress={() => setShowAgreement(true)}>
                  <Text style={{ color: C.BLUE, fontSize: 12 }}>《代理合作协议》</Text>
                </Pressable>
              </View>
            </View>

            {/* 下一步按钮 */}
            <Pressable cssInterop={false}
              onPress={handleNextStep}
              disabled={!checked || !selectedRank}
              style={({ pressed }) => ({
                backgroundColor: (!checked || !selectedRank)
                  ? C.PANEL2
                  : pressed ? '#B8960A' : C.GOLD,
                borderRadius: 14, paddingVertical: 15, alignItems: 'center',
                borderWidth: (!checked || !selectedRank) ? 1 : 0,
                borderColor: C.BORDER,
              })}
            >
              <Text style={{
                color: (!checked || !selectedRank) ? C.GRAY2 : '#1A1200',
                fontSize: 15, fontWeight: 'bold',
              }}>
                我已完成付款，下一步
              </Text>
            </Pressable>

            {(!checked) && (
              <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center', marginTop: -4 }}>
                请先勾选代理合作协议
              </Text>
            )}

            <Pressable onPress={() => setShowCS(true)}>
              <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center' }}>如需帮助，请联系客服</Text>
            </Pressable>
          </Animated.View>
        )}

        <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center', marginHorizontal: 16, marginTop: 16, lineHeight: 16 }}>
          开通代理后，可在代理中心查看完整拿货价格表和代理规则{'\n'}代理仅可在规定范围内自主加价，不得低于成本价销售
        </Text>
      </ScrollView>

      {/* ── 付款确认弹窗 ── */}
      <Modal visible={showPayDialog} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onPress={() => {}}
        >
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 20, borderWidth: 1.5,
            borderColor: C.BORDER, padding: 22, width: '100%', maxWidth: 380, gap: 14,
          }}>
            {/* 标题 */}
            <Text style={{ color: C.GOLD, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              ⚠️ 请确认您已真实完成付款
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              请确保您已扫码付款成功，并记下付款时间和金额。
            </Text>

            {/* 付款金额（必填） */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>付款金额（必填）</Text>
              <TextInput
                value={payAmount}
                onChangeText={setPayAmount}
                placeholder={`请输入金额，如 ${selectedPrice}`}
                placeholderTextColor={C.GRAY2}
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: C.PANEL2, borderRadius: 10, borderWidth: 1,
                  borderColor: C.BORDER, color: C.WHITE, fontSize: 14,
                  paddingHorizontal: 12, paddingVertical: 10,
                }}
              />
            </View>

            {/* 付款时间（必填） */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>付款时间（必填）</Text>
              <TextInput
                value={payTime}
                onChangeText={setPayTime}
                placeholder="如：2025-05-12 14:30"
                placeholderTextColor={C.GRAY2}
                style={{
                  backgroundColor: C.PANEL2, borderRadius: 10, borderWidth: 1,
                  borderColor: C.BORDER, color: C.WHITE, fontSize: 14,
                  paddingHorizontal: 12, paddingVertical: 10,
                }}
              />
            </View>

            {/* 微信昵称或交易单号（选填） */}
            <View style={{ gap: 4 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>微信昵称或交易单号（选填）</Text>
              <TextInput
                value={payNick}
                onChangeText={setPayNick}
                placeholder="填写有助于管理员快速核实"
                placeholderTextColor={C.GRAY2}
                style={{
                  backgroundColor: C.PANEL2, borderRadius: 10, borderWidth: 1,
                  borderColor: C.BORDER, color: C.WHITE, fontSize: 14,
                  paddingHorizontal: 12, paddingVertical: 10,
                }}
              />
            </View>

            {/* 付款截图（选填） */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>📷 上传付款截图（选填）</Text>
              <Pressable cssInterop={false}
                onPress={handlePickScreenshot}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? C.PANEL2 : C.BG,
                  borderRadius: 10, borderWidth: 1.5, borderStyle: 'dashed',
                  borderColor: payScreenshotUri ? C.GREEN : C.BORDER,
                  padding: 12, alignItems: 'center', gap: 4, minHeight: 60,
                  justifyContent: 'center',
                })}
              >
                {payScreenshotUri ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 18 }}>✅</Text>
                    <Text style={{ color: C.GREEN, fontSize: 12 }}>截图已选择</Text>
                    <Text style={{ color: C.GRAY2, fontSize: 10 }}>（点击重新选择）</Text>
                  </View>
                ) : (
                  <>
                    <Text style={{ fontSize: 24 }}>📸</Text>
                    <Text style={{ color: C.GRAY, fontSize: 12 }}>点击选择截图</Text>
                  </>
                )}
              </Pressable>
            </View>

            {/* 底部按钮 */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => setShowPayDialog(false)}
                style={{ flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}
              >
                <Text style={{ color: C.GRAY, fontSize: 14 }}>取消</Text>
              </Pressable>
              <Pressable cssInterop={false}
                onPress={handleConfirmSubmit}
                disabled={!canSubmit}
                style={({ pressed }) => ({
                  flex: 2, borderRadius: 10, paddingVertical: 12, alignItems: 'center',
                  backgroundColor: canSubmit ? (pressed ? '#B8960A' : C.GOLD) : C.PANEL2,
                  borderWidth: canSubmit ? 0 : 1, borderColor: C.BORDER,
                })}
              >
                <Text style={{
                  color: canSubmit ? '#1A1200' : C.GRAY2,
                  fontSize: 14, fontWeight: 'bold',
                }}>
                  确认提交
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ── 提交成功弹窗 ── */}
      <Modal visible={showSuccessDialog} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 28 }}
          onPress={() => {}}
        >
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 20, borderWidth: 1.5,
            borderColor: `${C.GREEN}60`, padding: 26, width: '100%', maxWidth: 340, gap: 14, alignItems: 'center',
          }}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              付款信息已提交
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              您的付款信息已提交，管理员将尽快核实。{'\n'}核实通过后代理资格自动开通。
            </Text>
            <Pressable cssInterop={false}
              onPress={() => { setShowSuccessDialog(false); router.back(); }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                borderRadius: 12, paddingVertical: 13, paddingHorizontal: 40, width: '100%', alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>好的，返回</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 教程第六步：引导开通代理 */}
      <TutorialOverlay config={{
        step: 'step6',
        visible: showTutorialStep6,
        title: '开通高级代理，轻松赚收益',
        body: '💬 推荐开通高级代理，AI自动回复帮你24小时卖卡，睡觉也能赚差价收益',
        actionLabel: '立即开通代理',
        cancelLabel: '稍后再说',
        onAction: () => setShowTutorialStep6(false),
        onCancel: () => setShowTutorialStep6(false),
      }} />

      <DocModal visible={showAgreement} title="代理合作协议" content={AGENT_AGREEMENT} onClose={() => setShowAgreement(false)} />
      <AiCsModal visible={showCS} onClose={() => setShowCS(false)} greeting="您好！如需代理开通帮助，欢迎直接告诉我，我会协助您处理。" />
    </View>
  );
}

function DescRow({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: C.GRAY, fontSize: 9, flex: 1, lineHeight: 13 }}>{text}</Text>
    </View>
  );
}
