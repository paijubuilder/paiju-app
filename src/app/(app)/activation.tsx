/**
 * 会员付费激活页 v21 — 新4套餐 + A/B定价实验
 * 3天体验卡 / 30天月卡（金色高亮）/ 半年卡 / 年卡
 * 2×2网格：左上=3天，右上=30天，左下=半年，右下=年卡
 * A/B实验期间按实验组价格展示；非实验期使用全局价格
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, BackHandler, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { supabase } from '@/client/supabase';
import {
  getConfig, setMemberExpire, isMemberActive, getCurrentGuardId, isWechatBound,
  createOrder, updateOrderPayInfo, formatDateTime,
  getGlobalPlans,
} from '@/lib/appStore';
import type { PayOrder, ExpPlanDef } from '@/lib/appStore';
import DocModal from '@/components/DocModal';
import AiCsModal from '@/components/AiCsModal';
import WechatLoginModal from '@/components/WechatLoginModal';
import TutorialOverlay from '@/components/TutorialOverlay';

const MEMBER_AGREEMENT = `牌局环境守护 · 会员服务协议

一、产品说明
本产品是一款手机环境健康度检测工具，通过通用技术扫描手机基础环境状态。检测功能为模拟展示，检测结果仅供娱乐和辅助参考。本产品非第三方测评机构，检测结果为通用环境扫描，不针对任何特定商品或服务进行评测。本产品非任何特定游戏的外挂、作弊工具或官方插件，不读取、不修改任何第三方游戏数据。

二、会员权益
1. 开通会员后，可在有效期内使用本产品的全部功能。
2. 会员时长以购买时选择的套餐为准，到期后功能自动锁定。

三、退款政策
1. 激活定义：用户完成支付后，会员权益即已开通；当用户在会员有效期内首次点击【开始守护本局】并成功启动护航功能时，视为会员权益已激活使用。
2. 退款界限：
   （1）会员权益已开通但未激活的，用户可联系客服申请退款，经后台核实无任何使用记录后，由客服人工处理。
   （2）会员权益已激活的，视为数字化商品已交付使用，根据相关法律规定，在线下载或已使用的数字化商品不适用七日无理由退货，不支持退款。
   （3）会员有效期届满后，无论是否激活，已支付的费用均不予退还。
3. 本产品属于在线交付的数字化虚拟商品，会员权益一经开通即刻生效并与设备绑定，无法逆向回兑为现金。如有订单争议，请联系客服处理。

四、免责声明
1. 本产品检测结果仅供辅助参考，用户应结合实际情况自行判断。
2. 用户应自行判断游戏对局的真实情况，本产品不对用户的游戏结果负责。
3. 用户不得将本产品用于任何违法违规用途。

五、其他
1. 开通会员即视为同意本协议全部条款。
2. 本协议的解释与适用，以中华人民共和国法律法规为准。如本协议部分条款与现行法律相抵触，不影响其他条款的效力。`;

// ── 部署动画弹窗 ─────────────────────────────────────────
function PayDeployModal({ visible, onDone }: { visible: boolean; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const dotAnim = useRef(new Animated.Value(0)).current;

  const STEPS = [
    '正在同步设备指纹信息...',
    '正在下发精准检测能力...',
    '正在关联合规网络白名单...',
  ];

  useEffect(() => {
    if (!visible) { setStep(0); return; }
    // 依次显示每项，每700ms一项
    let idx = 0;
    const interval = setInterval(() => {
      idx += 1;
      setStep(idx);
      if (idx >= STEPS.length) {
        clearInterval(interval);
        setTimeout(onDone, 600);
      }
    }, 700);
    // 雷达旋转
    Animated.loop(Animated.timing(dotAnim, { toValue: 1, duration: 1200, useNativeDriver: true })).start();
    return () => clearInterval(interval);
  }, [visible, dotAnim, onDone, STEPS.length]);

  const rotate = dotAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <Text style={{ fontSize: 64 }}>📡</Text>
        </Animated.View>
        <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>正在为您部署护航环境...</Text>
        <View style={{ gap: 14, minWidth: 260 }}>
          {STEPS.map((s, i) => (
            <View key={s} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, opacity: step > i ? 1 : 0.25 }}>
              <Text style={{ color: step > i ? C.GREEN : C.GRAY2, fontSize: 16 }}>{step > i ? '✅' : '⏳'}</Text>
              <Text style={{ color: step > i ? C.WHITE : C.GRAY2, fontSize: 13 }}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

// ── 护航就绪结果页 ────────────────────────────────────────
function GuardReadyResult({ plan, onStart }: { plan: { title: string; days: number; price: string }; onStart: () => void }) {
  const router = useRouter();
  const glowAnim = useRef(new Animated.Value(0.4)).current;
  const scaleAnim = useRef(new Animated.Value(0.6)).current;
  const guardId = getCurrentGuardId();

  useEffect(() => {
    // 护盾从灰暗变亮动画
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 50, friction: 7 }),
      Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
    ]).start(() => {
      Animated.loop(Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.7, duration: 1500, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])).start();
    });
  }, [glowAnim, scaleAnim]);

  const now = new Date();
  const expire = new Date(now.getTime() + plan.days * 86400 * 1000);
  const expireStr = `${expire.getFullYear()}-${String(expire.getMonth()+1).padStart(2,'0')}-${String(expire.getDate()).padStart(2,'0')}`;
  const orderId = 'ORD' + Date.now().toString().slice(-8);

  return (
    <View style={{ flex: 1, backgroundColor: C.BG, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 24 }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      {/* 护盾动画 */}
      <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: glowAnim }}>
        <View style={{
          width: 100, height: 100, borderRadius: 50,
          backgroundColor: `${C.GOLD}18`, borderWidth: 3, borderColor: C.GOLD,
          alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 32px ${C.GOLD}80`,
        }}>
          <Text style={{ fontSize: 48 }}>🛡️</Text>
        </View>
      </Animated.View>
      {/* 主文案 */}
      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={{ color: C.GOLD, fontSize: 20, fontWeight: 'bold' }}>护航已就绪</Text>
        <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center' }}>开始守护您的牌局吧！</Text>
      </View>
      {/* 详情卡片 */}
      <View style={{
        backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1,
        borderColor: `${C.GOLD}40`, padding: 20, width: '100%', gap: 12,
      }}>
        <DetailRow label="会员类型" value={plan.title} />
        <DetailRow label="护航到期" value={expireStr} highlight />
        <DetailRow label="护航编号" value={guardId} />
        <DetailRow label="订单编号" value={orderId} />
      </View>
      {/* 开始护航按钮 */}
      <Pressable cssInterop={false}
        onPress={() => { onStart(); router.replace('/(app)/(tabs)/home'); }}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#B8961E' : C.GOLD,
          borderRadius: 16, paddingVertical: 16, paddingHorizontal: 48,
          boxShadow: `0 0 20px ${C.GOLD}60`,
        })}
      >
        <Text style={{ color: '#1A1200', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>🛡️ 开始护航</Text>
      </Pressable>
    </View>
  );
}

function DetailRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Text style={{ color: C.GRAY, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: highlight ? C.GOLD : C.WHITE, fontSize: 12, fontWeight: highlight ? 'bold' : 'normal' }}>{value}</Text>
    </View>
  );
}

// ── 付款信息确认弹窗 ─────────────────────────────────────────
function PayConfirmModal({
  visible, order, onSubmit, onClose,
}: {
  visible: boolean;
  order: PayOrder | null;
  onSubmit: (payAmount: string, payNickOrNo: string) => void;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState('');
  const [nickOrNo, setNickOrNo] = useState('');
  const canSubmit = amount.trim().length > 0;

  // 重置输入框
  useEffect(() => {
    if (visible) { setAmount(''); setNickOrNo(''); }
  }, [visible]);

  if (!order) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: '#161A1F', borderTopLeftRadius: 24, borderTopRightRadius: 24,
          borderTopWidth: 1, borderTopColor: '#2A3140', paddingBottom: 36,
        }}>
          {/* 标题栏 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
            <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>⚠️ 请确认您已真实完成付款</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            {/* 温馨提示 */}
            <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', padding: 12 }}>
              <Text style={{ color: '#F87171', fontSize: 12, lineHeight: 20 }}>
                请确保您已扫码付款成功。恶意点击将导致您的账号被限制使用。
              </Text>
            </View>

            {/* 订单信息 */}
            <View style={{ backgroundColor: '#0D0F12', borderRadius: 10, borderWidth: 1, borderColor: '#2A3140', padding: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#8899AA', fontSize: 12 }}>购买套餐</Text>
                <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: 'bold' }}>{order.planLabel}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#8899AA', fontSize: 12 }}>订单编号</Text>
                <Text style={{ color: '#8899AA', fontSize: 11 }} selectable>{order.id}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: '#8899AA', fontSize: 12 }}>应付金额</Text>
                <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: 'bold' }}>¥{order.planPrice}</Text>
              </View>
            </View>

            {/* 付款金额（必填） */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 'bold' }}>
                付款金额 <Text style={{ color: '#EF4444' }}>*</Text>（必填）
              </Text>
              <TextInput
                value={amount}
                onChangeText={setAmount}
                placeholder="请输入您实际支付的金额"
                placeholderTextColor="#4A5568"
                keyboardType="decimal-pad"
                style={{
                  backgroundColor: '#0D0F12', borderWidth: 1,
                  borderColor: amount ? '#2563EB' : '#2A3140',
                  borderRadius: 10, padding: 12, color: '#F0F4FF', fontSize: 14,
                }}
              />
              <Text style={{ color: '#667080', fontSize: 11 }}>请输入您实际支付的金额，AI将自动核对</Text>
            </View>

            {/* 昵称/单号（选填） */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 'bold' }}>微信昵称或交易单号（选填）</Text>
              <TextInput
                value={nickOrNo}
                onChangeText={setNickOrNo}
                placeholder="填写任意一项，可加快核对"
                placeholderTextColor="#4A5568"
                style={{
                  backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140',
                  borderRadius: 10, padding: 12, color: '#F0F4FF', fontSize: 14,
                }}
              />
              <Text style={{ color: '#667080', fontSize: 11 }}>填写任意一项，可加快AI核对速度</Text>
            </View>

            {/* AI识别提示 */}
            <View style={{
              backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: 10,
              borderWidth: 1, borderColor: 'rgba(37,99,235,0.25)', padding: 12,
              flexDirection: 'row', alignItems: 'center', gap: 8,
            }}>
              <Text style={{ fontSize: 18 }}>🤖</Text>
              <Text style={{ color: '#93C5FD', fontSize: 11, flex: 1, lineHeight: 18 }}>
                AI将自动识别您填写的昵称或单号，无需区分格式
              </Text>
            </View>

            {/* 确认提交按钮 */}
            <Pressable cssInterop={false}
              onPress={() => { if (canSubmit) onSubmit(amount.trim(), nickOrNo.trim()); }}
              disabled={!canSubmit}
              style={({ pressed }) => ({
                backgroundColor: canSubmit ? (pressed ? '#1A5FCC' : '#2563EB') : '#2A3140',
                borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4,
              })}
            >
              <Text style={{ color: canSubmit ? '#fff' : '#667080', fontSize: 14, fontWeight: 'bold' }}>
                ✅ 确认提交
              </Text>
            </Pressable>

            {/* 取消 */}
            <Pressable onPress={onClose} style={{ paddingVertical: 8, alignItems: 'center' }}>
              <Text style={{ color: '#8899AA', fontSize: 13 }}>取消</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── 提交成功提示 ─────────────────────────────────────────────
function SubmitSuccessModal({ visible, order, onClose }: { visible: boolean; order: PayOrder | null; onClose: () => void }) {
  if (!order) return null;
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        <View style={{
          backgroundColor: '#161A1F', borderRadius: 20, borderWidth: 1,
          borderColor: '#2A3140', padding: 24, width: '100%', gap: 16, alignItems: 'center',
        }}>
          <Text style={{ fontSize: 48 }}>⏳</Text>
          <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold' }}>付款信息已提交</Text>
          <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            AI正在核实您的付款信息，管理员确认后将立即为您开通{order.planLabel}
          </Text>
          <View style={{ backgroundColor: '#0D0F12', borderRadius: 10, borderWidth: 1, borderColor: '#2A3140', padding: 12, width: '100%', gap: 4 }}>
            <Text style={{ color: '#8899AA', fontSize: 11 }}>订单编号：<Text style={{ color: '#F0F4FF' }} selectable>{order.id}</Text></Text>
            <Text style={{ color: '#8899AA', fontSize: 11 }}>提交时间：<Text style={{ color: '#F0F4FF' }}>{formatDateTime(order.createdAt)}</Text></Text>
          </View>
          <Pressable cssInterop={false}
            onPress={onClose}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
              borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32,
            })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>我知道了</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// ── 二维码全屏放大弹窗 ───────────────────────────────────
function QrFullModal({
  visible, qrUrl, qrLabel, planTitle, planPrice, onClose,
}: {
  visible: boolean; qrUrl: string; qrLabel: string; planTitle: string; planPrice: string; onClose: () => void;
}) {
  const [saveMsg, setSaveMsg] = useState('');
  const scaleAnim = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }).start();
    } else {
      scaleAnim.setValue(0.7);
    }
  }, [visible, scaleAnim]);

  const handleLongPress = async () => {
    if (!qrUrl) return;
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status !== 'granted') { setSaveMsg('请在设置中开启相册权限'); setTimeout(() => setSaveMsg(''), 2500); return; }
      const filename = `qr_${Date.now()}.jpg`;
      const localUri = (FileSystem.documentDirectory ?? '') + filename;
      await FileSystem.downloadAsync(qrUrl, localUri);
      await MediaLibrary.createAssetAsync(localUri);
      setSaveMsg('✅ 二维码已保存到相册');
    } catch {
      setSaveMsg('保存失败，请重试');
    }
    setTimeout(() => setSaveMsg(''), 2500);
  };

  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}
        onPress={onClose}
      >
        <Animated.View
          style={{ transform: [{ scale: scaleAnim }], alignItems: 'center', gap: 16 }}
        >
          {/* 关闭按钮 */}
          <Pressable
            onPress={onClose}
            style={{ position: 'absolute', top: -12, right: -12, zIndex: 10, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <Text style={{ color: '#fff', fontSize: 16 }}>✕</Text>
          </Pressable>

          {/* 卡片容器 */}
          <Pressable
            onPress={e => e.stopPropagation()}
            onLongPress={handleLongPress}
            style={{
              backgroundColor: '#fff', borderRadius: 20, padding: 20, alignItems: 'center', gap: 12,
              boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 32, color: 'rgba(0,0,0,0.5)' }],
            }}
          >
            <Text style={{ color: '#111', fontSize: 14, fontWeight: 'bold' }}>{qrLabel}</Text>
            <View style={{ width: 240, height: 240, borderRadius: 12, overflow: 'hidden', backgroundColor: '#f5f5f5' }}>
              <Image source={{ uri: qrUrl }} style={{ flex: 1 }} contentFit="contain" />
            </View>
            <Text style={{ color: '#E05236', fontSize: 18, fontWeight: 'bold' }}>¥{planPrice}</Text>
            <Text style={{ color: '#555', fontSize: 13 }}>{planTitle}</Text>
            <Text style={{ color: '#aaa', fontSize: 10 }}>🔒 扫码仅用于支付，不会泄露您的个人信息</Text>
            <Text style={{ color: '#bbb', fontSize: 10 }}>长按可保存图片到相册</Text>
          </Pressable>

          {saveMsg ? (
            <View style={{ backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
              <Text style={{ color: '#fff', fontSize: 13 }}>{saveMsg}</Text>
            </View>
          ) : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ── 主页面 ────────────────────────────────────────────────
export default function ActivationScreen() {
  const router = useRouter();
  const cfg = getConfig();

  // 使用全局价格配置（已移除 A/B 实验分流）
  const _globalPlans = getGlobalPlans();
  const _defaultIdx = Math.max(0, _globalPlans.findIndex(p => p.isMost));

  const [selected, setSelected] = useState(_defaultIdx); // isMost套餐为默认选中
  const [checked, setChecked] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showCS, setShowCS] = useState(false);
  const [showRetain, setShowRetain] = useState(false);
  const [showWechat, setShowWechat] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [payDone, setPayDone] = useState(false);
  const [showTutorialStep5, setShowTutorialStep5] = useState(false); // 仅在用户尝试退出时触发
  // 付款确认弹窗
  const [pendingOrder, setPendingOrder] = useState<PayOrder | null>(null);
  const [showPayConfirm, setShowPayConfirm] = useState(false);
  const [showSubmitSuccess, setShowSubmitSuccess] = useState(false);
  const memberAlready = isMemberActive();

  // 从 Supabase 实时读取收款二维码（微信 + 支付宝）
  const [memberQrUrl, setMemberQrUrl] = useState('');
  const [alipayQrUrl, setAlipayQrUrl] = useState('');
  const [showQrFull, setShowQrFull] = useState(false);
  // 当前选中的支付方式（'wechat' | 'alipay'），用于全屏放大时定位
  const [qrFullTarget, setQrFullTarget] = useState<'wechat' | 'alipay'>('wechat');
  useEffect(() => {
    supabase.from('qrcode_configs')
      .select('config_key,image_url')
      .in('config_key', ['member_qr', 'member_alipay_qr'])
      .then(({ data }) => {
        if (!data) return;
        for (const row of data) {
          if (row.config_key === 'member_qr' && row.image_url) setMemberQrUrl(row.image_url);
          if (row.config_key === 'member_alipay_qr' && row.image_url) setAlipayQrUrl(row.image_url);
        }
      });
  }, []);

  useFocusEffect(useCallback(() => {
    const onBack = () => {
      if (!payDone && !memberAlready) {
        setShowRetain(true);
        setShowTutorialStep5(true); // 安卓返回键同步触发引导提示
        return true;
      }
      return false;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
    return () => sub.remove();
  }, [payDone, memberAlready]));

  const handleNavBack = () => {
    if (!payDone && !memberAlready) {
      setShowRetain(true);
      setShowTutorialStep5(true); // 点击左上角退出时触发引导提示
    } else {
      // 使用 replace 跳首页，防止 member tab Redirect 循环推回本页
      router.replace('/(app)/(tabs)/home');
    }
  };

  // 使用全局价格配置
  const PLANS: PlanDef[] = _globalPlans.map((p, idx) => ({
    id: idx,
    title: p.title,
    days: p.days,
    price: p.price,
    label: p.label,
    subTexts: p.subTexts,
    isMost: p.isMost,
  }));
  const plan = PLANS[selected] ?? PLANS[0];

  const handleConfirmPay = () => {
    if (!checked) return;
    // 创建订单（状态=待付款）
    const order = createOrder({
      planType: 'member',
      planLabel: plan.title,
      planDays: plan.days,
      planPrice: plan.price,
    });
    setPendingOrder(order);
    // 弹出付款信息确认弹窗
    setShowPayConfirm(true);
  };

  const handlePayInfoSubmit = (payAmount: string, payNickOrNo: string) => {
    if (!pendingOrder) return;
    // 更新订单状态为 AI审核中
    updateOrderPayInfo(pendingOrder.id, payAmount, '', payNickOrNo, '');
    setShowPayConfirm(false);
    // 同时触发 AI 审核（通过 Edge Function 异步调用）
    triggerAiReview(pendingOrder.id, pendingOrder.planPrice, payAmount, payNickOrNo);
    setShowSubmitSuccess(true);
  };

  const triggerAiReview = (orderId: string, planPrice: string, payAmount: string, payNickOrNo: string) => {
    // 异步调用 AI 审核 Edge Function，不阻塞 UI
    import('@/client/supabase').then(({ supabase }) => {
      supabase.functions.invoke('ai-order-review', {
        body: { orderId, planPrice, payAmount, payNickOrNo },
        method: 'POST',
      }).catch(() => { /* 静默失败，等管理员人工核实 */ });
    });
  };

  const triggerDeploy = () => {
    setShowDeploy(true);
  };

  const handleDeployDone = () => {
    setShowDeploy(false);
    setMemberExpire(plan.days);
    setPayDone(true);
  };

  if (payDone) {
    return <GuardReadyResult plan={plan} onStart={() => {}} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }} contentInsetAdjustmentBehavior="automatic">
        {/* 标题栏 */}
        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 52 }}>
          <Pressable onPress={handleNavBack} style={{ marginRight: 12 }}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>🛡️ 继续守护，让每一局都公平</Text>
            <Text style={{ color: C.GRAY, fontSize: 10 }}>已有 <Text style={{ color: C.WHITE }}>12,836</Text> 位牌友选择守护</Text>
          </View>
        </View>

        {/* 会员专属功能预告 */}
        <View style={{ marginHorizontal: 14, marginBottom: 4 }}>
          <Text style={{ color: '#888', fontSize: 11, textAlign: 'center', lineHeight: 18 }}>
            💎 会员专属功能（通知栏护航提醒、实时预警）即将上线，敬请期待！
          </Text>
        </View>

        {/* 2×2 套餐网格：左上=3天体验卡 右上=30天月卡 左下=半年卡 右下=年卡 */}
        <View style={{ paddingHorizontal: 14, gap: 10 }}>
          {/* 第一行：3天体验卡 + 30天月卡 */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PlanCard plan={PLANS[0]} selected={selected === 0} onSelect={() => setSelected(0)} />
            <PlanCard plan={PLANS[1] ?? PLANS[0]} selected={selected === 1} onSelect={() => setSelected(1)} />
          </View>
          {/* 第二行：半年卡 + 年卡（仅当有4个套餐时显示） */}
          {PLANS.length >= 4 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PlanCard plan={PLANS[2]} selected={selected === 2} onSelect={() => setSelected(2)} />
              <PlanCard plan={PLANS[3]} selected={selected === 3} onSelect={() => setSelected(3)} />
            </View>
          )}
          {/* 仅3个套餐（示例B/C实验）时第二行居中展示 */}
          {PLANS.length === 3 && (
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <PlanCard plan={PLANS[2]} selected={selected === 2} onSelect={() => setSelected(2)} />
              <View style={{ flex: 1 }} />
            </View>
          )}
        </View>

        {/* 护航摘要一行展示 */}
        <View style={{ marginHorizontal: 14, marginTop: 10 }}>
          <GuardSummaryCard />
        </View>

        {/* 底部支付区 */}
        <View style={{ marginHorizontal: 14, marginTop: 14, gap: 12 }}>
          {/* 微信登录按钮（突出） */}
          <Pressable cssInterop={false}
            onPress={() => setShowWechat(true)}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
              backgroundColor: pressed ? '#17961A' : '#1AAD19',
              borderRadius: 12, paddingVertical: 13,
            })}
          >
            <Text style={{ fontSize: 18 }}>💬</Text>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>微信一键登录绑定权益</Text>
          </Pressable>

          {/* 收款码 — 双码并排 + 扫码提示 */}
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER,
            padding: 16, gap: 12,
            boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 16, color: 'rgba(0,0,0,0.3)' }],
          }}>
            {/* 提示文案 */}
            <View style={{ backgroundColor: `${C.GOLD}12`, borderRadius: 10, borderWidth: 1, borderColor: `${C.GOLD}30`, padding: 10 }}>
              <Text style={{ color: C.GOLD, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                请使用微信或支付宝扫描下方二维码完成支付{'\n'}付款完成后点击「我已付款」按钮
              </Text>
            </View>

            {/* 金额 */}
            <Text style={{ color: C.GOLD, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>
              ¥{plan.price}
              <Text style={{ color: C.GRAY, fontSize: 12, fontWeight: 'normal' }}>  · {plan.title}</Text>
            </Text>

            {/* 双码区 */}
            {(memberQrUrl || alipayQrUrl) ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* 微信收款码 */}
                {memberQrUrl ? (
                  <Pressable cssInterop={false}
                    onPress={() => { setQrFullTarget('wechat'); setShowQrFull(true); }}
                    onLongPress={async () => {
                      try {
                        const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
                        if (status !== 'granted') return;
                        const localUri = (FileSystem.documentDirectory ?? '') + `qr_wx_${Date.now()}.jpg`;
                        await FileSystem.downloadAsync(memberQrUrl, localUri);
                        await MediaLibrary.createAssetAsync(localUri);
                      } catch { /* 静默 */ }
                    }}
                    style={({ pressed }) => ({
                      flex: 1, borderRadius: 12, overflow: 'hidden', opacity: pressed ? 0.85 : 1,
                      backgroundColor: '#fff', aspectRatio: 1,
                      boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 8, color: 'rgba(0,0,0,0.15)' }],
                    })}
                  >
                    <Image source={{ uri: memberQrUrl }} style={{ flex: 1 }} contentFit="contain" />
                    {/* 微信标签 */}
                    <View style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      backgroundColor: 'rgba(26,173,25,0.88)', paddingVertical: 5,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>
                      <Text style={{ fontSize: 11 }}>💬</Text>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>微信扫码支付</Text>
                    </View>
                  </Pressable>
                ) : null}

                {/* 支付宝收款码 */}
                {alipayQrUrl ? (
                  <Pressable cssInterop={false}
                    onPress={() => { setQrFullTarget('alipay'); setShowQrFull(true); }}
                    onLongPress={async () => {
                      try {
                        const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
                        if (status !== 'granted') return;
                        const localUri = (FileSystem.documentDirectory ?? '') + `qr_ali_${Date.now()}.jpg`;
                        await FileSystem.downloadAsync(alipayQrUrl, localUri);
                        await MediaLibrary.createAssetAsync(localUri);
                      } catch { /* 静默 */ }
                    }}
                    style={({ pressed }) => ({
                      flex: 1, borderRadius: 12, overflow: 'hidden', opacity: pressed ? 0.85 : 1,
                      backgroundColor: '#fff', aspectRatio: 1,
                      boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 8, color: 'rgba(0,0,0,0.15)' }],
                    })}
                  >
                    <Image source={{ uri: alipayQrUrl }} style={{ flex: 1 }} contentFit="contain" />
                    {/* 支付宝标签 */}
                    <View style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      backgroundColor: 'rgba(22,119,255,0.88)', paddingVertical: 5,
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
                    }}>
                      <Text style={{ fontSize: 11 }}>🔵</Text>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>支付宝扫码支付</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              /* 未配置任何二维码 */
              <View style={{ height: 130, backgroundColor: C.BG, borderWidth: 1, borderColor: C.BORDER2, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Text style={{ fontSize: 28 }}>📱</Text>
                <Text style={{ color: C.GRAY, fontSize: 10, textAlign: 'center', lineHeight: 14 }}>收款码暂未配置{'\n'}请联系客服</Text>
              </View>
            )}

            <Text style={{ color: C.GRAY2, fontSize: 9, textAlign: 'center' }}>
              🔒 点击二维码可放大 · 长按可保存到相册
            </Text>
          </View>

          {/* 协议 */}
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
            <Pressable
              onPress={() => setChecked(v => !v)}
              style={{
                width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
                borderColor: checked ? C.BLUE : C.GRAY2,
                backgroundColor: checked ? C.BLUE : 'transparent',
                alignItems: 'center', justifyContent: 'center', marginTop: 1,
              }}
            >
              {checked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
            </Pressable>
            <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap' }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>我已阅读并同意 </Text>
              <Pressable onPress={() => setShowAgreement(true)}>
                <Text style={{ color: C.BLUE, fontSize: 12 }}>《会员服务协议》</Text>
              </Pressable>
            </View>
          </View>

          {/* 我已付款 — 主行动按钮 */}
          <Pressable cssInterop={false}
            onPress={handleConfirmPay}
            disabled={!checked}
            style={({ pressed }) => ({
              backgroundColor: checked ? (pressed ? '#1A5FCC' : C.BLUE) : C.GRAY2,
              borderRadius: 14, paddingVertical: 16, alignItems: 'center', gap: 2,
            })}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold', letterSpacing: 1 }}>
              ✅ 我已完成付款，立即开通
            </Text>
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>¥{plan.price} · {plan.title} · 点此提交核验</Text>
          </Pressable>

          {/* 免责声明 */}
          <Text style={{ color: C.GRAY2, fontSize: 10, lineHeight: 16, textAlign: 'center' }}>
            🛡️ 本检测为通用手机环境扫描，非游戏专属工具，结果辅助参考，帮助减少外界干扰。
          </Text>
          <Pressable onPress={() => setShowCS(true)}>
            <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center' }}>如需订单帮助，请联系客服</Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 教程第五步：引导开通会员 */}
      <TutorialOverlay config={{
        step: 'step5',
        visible: showTutorialStep5,
        title: '80%牌友都选月卡',
        body: '💬 80%的牌友都选择了月卡，每天不到一瓶水的钱，就能持续守护牌局安全',
        actionLabel: '立即开通会员',
        cancelLabel: '残忍离开',
        onAction: () => { setSelected(1); setShowTutorialStep5(false); },
        onCancel: () => setShowTutorialStep5(false),
      }} />

      <WechatLoginModal
        visible={showWechat}
        onSuccess={() => { setShowWechat(false); triggerDeploy(); }}
        onSkip={() => setShowWechat(false)}
      />
      <PayDeployModal visible={showDeploy} onDone={handleDeployDone} />
      <DocModal visible={showAgreement} title="会员服务协议" content={MEMBER_AGREEMENT} onClose={() => setShowAgreement(false)} />
      <AiCsModal visible={showCS} onClose={() => setShowCS(false)} greeting="您好！如需订单帮助或退款咨询，请直接告诉我，我会尽快协助您处理。" />

      {/* 付款信息确认弹窗 */}
      <PayConfirmModal
        visible={showPayConfirm}
        order={pendingOrder}
        onSubmit={handlePayInfoSubmit}
        onClose={() => { setShowPayConfirm(false); setPendingOrder(null); }}
      />

      {/* 提交成功弹窗 */}
      <SubmitSuccessModal
        visible={showSubmitSuccess}
        order={pendingOrder}
        onClose={() => { setShowSubmitSuccess(false); router.replace('/(app)/(tabs)/profile'); }}
      />

      {/* 挽留弹窗 */}
      <Modal visible={showRetain} transparent animationType="slide">
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' }}>
          <View style={{ backgroundColor: C.PANEL, borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderColor: C.BORDER, padding: 28, gap: 16 }}>
            <Text style={{ color: C.WHITE, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>⏰ 等等！</Text>
            <Text style={{ color: C.GRAY, fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
              您确定要离开吗？{'\n'}您的牌局环境将失去保护
            </Text>
            <View style={{ backgroundColor: `${C.GOLD}15`, borderRadius: 12, borderWidth: 1, borderColor: `${C.GOLD}50`, padding: 14, alignItems: 'center', gap: 4 }}>
              <Text style={{ color: C.GOLD, fontSize: 13, fontWeight: 'bold' }}>🎁 限时优惠</Text>
              <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                {get30DayPromoText(PLANS)}
              </Text>
            </View>
            <Pressable cssInterop={false}
              onPress={() => { setShowRetain(false); const idx30 = PLANS.findIndex(p => p.days === 30); setSelected(idx30 >= 0 ? idx30 : 1); }}
              style={({ pressed }) => ({ backgroundColor: pressed ? '#B8961E' : C.GOLD, borderRadius: 14, paddingVertical: 15, alignItems: 'center' })}
            >
              <Text style={{ color: '#1A1514', fontSize: 15, fontWeight: 'bold' }}>
                {get30DayBtnText(PLANS)}
              </Text>
            </Pressable>
            <Pressable onPress={() => {
              setShowRetain(false);
              // 使用 replace 跳转首页，避免 member tab Redirect 循环推回本页
              router.replace('/(app)/(tabs)/home');
            }} style={{ paddingVertical: 10, alignItems: 'center' }}>
              <Text style={{ color: C.GRAY2, fontSize: 13 }}>残忍离开</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* 二维码全屏放大弹窗 */}
      <QrFullModal
        visible={showQrFull}
        qrUrl={qrFullTarget === 'wechat' ? memberQrUrl : alipayQrUrl}
        qrLabel={qrFullTarget === 'wechat' ? '💬 微信扫码支付' : '🔵 支付宝扫码支付'}
        planTitle={plan.title}
        planPrice={plan.price}
        onClose={() => setShowQrFull(false)}
      />
    </View>
  );
}

// ── 护航摘要（一行紧凑展示） ─────────────────────────────
function GuardSummaryCard() {
  return (
    <View style={{
      backgroundColor: C.PANEL, borderRadius: 10, borderWidth: 1,
      borderColor: `${C.GOLD}40`, paddingVertical: 10, paddingHorizontal: 14,
      flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap',
    }}>
      <Text style={{ color: C.GOLD, fontSize: 11, fontWeight: 'bold' }}>📊 本次护航：</Text>
      <Text style={{ color: C.GRAY, fontSize: 11 }}>4项扫描</Text>
      <Text style={{ color: C.BORDER, fontSize: 11 }}>|</Text>
      <Text style={{ color: C.GRAY, fontSize: 11 }}>0次拦截</Text>
      <Text style={{ color: C.BORDER, fontSize: 11 }}>|</Text>
      <Text style={{ color: '#29C470', fontSize: 11, fontWeight: 'bold' }}>98分</Text>
    </View>
  );
}

// ── 辅助函数（替代 JSX 内 IIFE，避免 Hermes 打包错误）──────────
type PlanDef = {
  id: number; title: string; days: number; price: string;
  label: string; subTexts: string[]; isMost: boolean;
};

/** 获取月卡推荐文案 */
function get30DayPromoText(plans: PlanDef[]): string {
  const p30 = plans.find(p => p.days === 30) ?? plans[1] ?? plans[0];
  if (!p30) return '';
  const rawPrice = parseFloat(p30.price.replace('¥', ''));
  const daily = p30.days > 0 && rawPrice > 0
    ? (Math.round((rawPrice / p30.days) * 100) / 100).toFixed(2)
    : '0.00';
  return `大部分牌友选择${p30.title}，日均¥${daily}，性价比最高。`;
}

/** 获取月卡开通按钮文字 */
function get30DayBtnText(plans: PlanDef[]): string {
  const p30 = plans.find(p => p.days === 30) ?? plans[1] ?? plans[0];
  if (!p30) return '立即开通';
  const price = p30.price.startsWith('¥') ? p30.price : `¥${p30.price}`;
  return `立即开通 · ${p30.title} ${price}`;
}

/** 计算退化日均价文字（subTexts 为空时兜底） */
function getDailyPriceText(price: string, days: number): string | null {
  const numeric = parseFloat(price.replace('¥', ''));
  if (!numeric || !days) return null;
  const daily = Math.round((numeric / days) * 100) / 100;
  return `≈¥${daily.toFixed(2)}/天`;
}

// ── 统一2×2套餐卡片组件 ──────────────────────────────────

function PlanCard({ plan, selected, onSelect }: { plan: PlanDef; selected: boolean; onSelect: () => void }) {
  const isGold = plan.isMost;
  return (
    <Pressable cssInterop={false}
      onPress={onSelect}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: isGold
          ? (selected ? `${C.GOLD}20` : `${C.GOLD}0A`)
          : (selected ? C.PANEL2 : C.PANEL),
        borderRadius: 14,
        borderWidth: isGold ? (selected ? 2.5 : 2) : (selected ? 2 : 1.5),
        borderColor: isGold ? C.GOLD : (selected ? C.BLUE : C.BORDER),
        padding: 12, gap: 3, alignItems: 'center',
        position: 'relative',
        opacity: pressed ? 0.85 : 1,
        boxShadow: isGold ? `0 3px 12px ${C.GOLD}40` : undefined,
      })}
    >
      {/* 标签角标 */}
      {plan.label ? (
        <View style={{
          position: 'absolute', top: -11, left: 0, right: 0, alignItems: 'center',
        }}>
          <View style={{
            backgroundColor: isGold ? C.GOLD : (selected ? C.BLUE : C.BORDER),
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2,
            borderWidth: 1.5, borderColor: C.BG,
          }}>
            <Text style={{ color: isGold ? '#1A1200' : '#fff', fontSize: 9, fontWeight: 'bold' }}>
              {plan.label}
            </Text>
          </View>
        </View>
      ) : null}

      <Text style={{
        color: isGold ? C.GOLD : C.GRAY,
        fontSize: 11, fontWeight: 'bold',
        marginTop: plan.label ? 8 : 0,
      }}>
        {plan.title}
      </Text>
      <Text style={{ color: isGold ? C.GOLD : C.WHITE, fontSize: 22, fontWeight: 'bold' }}>
        {plan.price.startsWith('¥') ? plan.price : `¥${plan.price}`}
      </Text>

      {/* 日均价 + 诱导文案（统一由 subTexts 提供，避免重复/NaN） */}
      {plan.subTexts.length > 0 ? (
        <View style={{ gap: 1, alignItems: 'center' }}>
          {plan.subTexts.map((t, i) => (
            <Text key={i} style={{ color: isGold ? '#B07B00' : C.GRAY2, fontSize: 9, textAlign: 'center' }}>
              {t}
            </Text>
          ))}
        </View>
      ) : getDailyPriceText(plan.price, plan.days) !== null ? (
        <Text style={{ color: isGold ? '#B8960A' : C.GRAY, fontSize: 10 }}>
          {getDailyPriceText(plan.price, plan.days)}
        </Text>
      ) : null}

      <Pressable cssInterop={false}
        onPress={onSelect}
        style={({ pressed }) => ({
          backgroundColor: isGold
            ? (pressed ? '#B8961E' : C.GOLD)
            : (pressed ? '#1A5FCC' : C.BLUE),
          borderRadius: 8, paddingVertical: 6, paddingHorizontal: 14, marginTop: 4,
        })}
      >
        <Text style={{ color: isGold ? '#1A1200' : '#fff', fontSize: 11, fontWeight: 'bold' }}>
          选这个
        </Text>
      </Pressable>
    </Pressable>
  );
}
