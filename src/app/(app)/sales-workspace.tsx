/**
 * 销售工作台 — 销售专员专属页面
 * 包含：工作台首页 · 客户管理 · 折扣申请 · 推广链接
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  Text, TextInput, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  fetchCustomers, createCustomer,
  fetchDiscountRequests, submitDiscountRequest, reviewDiscountRequest,
  fetchOrders, createOrder,
  writeLog,
  CUSTOMER_STATUS_LABELS, DISCOUNT_STATUS_LABELS,
  fmtDate, formatRelativeTime,
  type SalesCustomer, type DiscountRequest, type SalesOrder,
} from '@/lib/rbac';
import { isAdminSessionValidated } from '@/lib/appStore';

// ── 常量 ─────────────────────────────────────────────────
const SUBTABS = [
  { key: 'dashboard', label: '工作台',   icon: '📊' },
  { key: 'customers', label: '客户管理', icon: '👥' },
  { key: 'discount',  label: '折扣申请', icon: '🎟️' },
  { key: 'promo',     label: '推广链接', icon: '🔗' },
] as const;
type SubTab = typeof SUBTABS[number]['key'];

const BG   = '#0D0F12';
const CARD = '#161A1F';
const BD   = '#2A3140';
const T1   = '#F0F4FF';
const T2   = '#8899AA';
const T3   = '#667080';

// ── 公共小组件 ───────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BD, marginBottom: 12, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BD }}>
        <Text style={{ color: T2, fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>{title}</Text>
      </View>
      <View style={{ padding: 14, gap: 10 }}>{children}</View>
    </View>
  );
}

function StatBox({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
      borderColor: BD, padding: 14, alignItems: 'center', gap: 4 }}>
      <Text style={{ color: color ?? '#2563EB', fontSize: 24, fontWeight: 'bold' }}>{value}</Text>
      <Text style={{ color: T3, fontSize: 11 }}>{label}</Text>
    </View>
  );
}

function Btn({
  label, onPress, color = '#2563EB', outline, small,
}: {
  label: string; onPress: () => void; color?: string; outline?: boolean; small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: outline ? 'transparent' : color,
        borderWidth: outline ? 1 : 0, borderColor: outline ? color : undefined,
        borderRadius: 10, paddingVertical: small ? 6 : 10,
        paddingHorizontal: small ? 12 : 18, alignItems: 'center' }}>
      <Text style={{ color: outline ? color : '#fff', fontSize: small ? 12 : 13, fontWeight: 'bold' }}>{label}</Text>
    </Pressable>
  );
}

function StatusBadge({ status }: { status: string }) {
  const st = DISCOUNT_STATUS_LABELS[status] ?? { label: status, color: T2 };
  return (
    <View style={{ backgroundColor: `${st.color}22`, borderRadius: 10,
      paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color: st.color, fontSize: 10, fontWeight: 'bold' }}>{st.label}</Text>
    </View>
  );
}

function ModalSheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: CARD, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          borderTopWidth: 1, borderTopColor: BD, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18,
            borderBottomWidth: 1, borderBottomColor: BD }}>
            <Text style={{ color: T1, fontSize: 15, fontWeight: 'bold', flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ color: T2, fontSize: 20 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function FormField({ label, value, onChangeText, placeholder, keyboardType }: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: 'default' | 'numeric' | 'phone-pad';
}) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: T2, fontSize: 12 }}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={T3}
        keyboardType={keyboardType ?? 'default'}
        style={{ backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 10,
          padding: 12, color: T1, fontSize: 13 }}
      />
    </View>
  );
}

// ── Tab1：工作台仪表盘 ────────────────────────────────────

function DashboardTab() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [discounts, setDiscounts] = useState<DiscountRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchOrders(),
      fetchCustomers(),
      fetchDiscountRequests(),
    ]).then(([o, c, d]) => {
      setOrders(o);
      setCustomers(c);
      setDiscounts(d);
    }).finally(() => setLoading(false));
  }, []));

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2563EB" />
    </View>
  );

  const todayOrders = orders.filter(o => {
    const today = new Date().toDateString();
    return new Date(o.created_at).toDateString() === today;
  });
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.final_amount, 0);
  const pendingDiscount = discounts.filter(d => d.status === 'pending').length;
  const activeCustomers = customers.filter(c => c.status !== 'churned').length;

  // 业绩趋势（近7天）
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toDateString();
    const dayOrders = orders.filter(o => new Date(o.created_at).toDateString() === dateStr);
    const revenue = dayOrders.reduce((sum, o) => sum + o.final_amount, 0);
    return { date: d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }), revenue, count: dayOrders.length };
  });
  const maxRevenue = Math.max(...last7.map(d => d.revenue), 1);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {/* 快速统计 */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatBox value={`¥${todayRevenue.toFixed(0)}`} label="今日成交" color="#10B981" />
        <StatBox value={String(pendingDiscount)} label="待审批折扣" color="#F59E0B" />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <StatBox value={String(activeCustomers)} label="有效客户" color="#2563EB" />
        <StatBox value={String(orders.length)} label="累计订单" color="#8B5CF6" />
      </View>

      {/* 业绩趋势（近7天柱状图） */}
      <Card title="📈 近7天业绩趋势">
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 80, gap: 6 }}>
          {last7.map((d, i) => (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 3 }}>
              <View style={{
                width: '80%',
                height: Math.max(4, (d.revenue / maxRevenue) * 60),
                backgroundColor: d.count > 0 ? '#2563EB' : '#2A3140',
                borderRadius: 3,
              }} />
              <Text style={{ color: T3, fontSize: 9 }}>{d.date}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: BD, paddingTop: 8 }}>
          <Text style={{ color: T3, fontSize: 11 }}>本周累计：¥{last7.reduce((s, d) => s + d.revenue, 0).toFixed(0)}</Text>
          <Text style={{ color: T3, fontSize: 11 }}>成交 {last7.reduce((s, d) => s + d.count, 0)} 单</Text>
        </View>
      </Card>

      {/* 待处理事项 */}
      <Card title="🔔 待处理事项">
        {pendingDiscount > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: '#F59E0B11', borderRadius: 10, padding: 10 }}>
            <Text style={{ fontSize: 16 }}>🎟️</Text>
            <Text style={{ color: '#F59E0B', flex: 1, fontSize: 13 }}>
              有 {pendingDiscount} 条折扣申请等待运营总监审批
            </Text>
          </View>
        ) : (
          <Text style={{ color: T3, fontSize: 13 }}>暂无待处理事项 🎉</Text>
        )}
      </Card>

      {/* 最近订单 */}
      <Card title="📦 最近订单">
        {orders.slice(0, 5).map(o => (
          <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center',
            paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BD, gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: T1, fontSize: 13, fontWeight: 'bold' }}>{o.customer_name}</Text>
              <Text style={{ color: T3, fontSize: 11 }}>{o.plan_name}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#10B981', fontSize: 13, fontWeight: 'bold' }}>¥{o.final_amount.toFixed(0)}</Text>
              <Text style={{ color: T3, fontSize: 10 }}>{formatRelativeTime(o.created_at)}</Text>
            </View>
          </View>
        ))}
        {orders.length === 0 && <Text style={{ color: T3 }}>暂无订单记录</Text>}
      </Card>
    </ScrollView>
  );
}

// ── Tab2：客户管理 ────────────────────────────────────────

const STATUS_OPTS = ['lead', 'negotiating', 'closed', 'churned'] as const;
const STATUS_COLORS: Record<string, string> = {
  lead: '#64748B', negotiating: '#F59E0B', closed: '#10B981', churned: '#EF4444',
};

function CustomersTab() {
  const [customers, setCustomers] = useState<SalesCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<SalesCustomer | null>(null);
  const [newFollowUp, setNewFollowUp] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', wechat: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchCustomers();
    setCustomers(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleCreate = async () => {
    if (!form.name) return;
    setSaving(true);
    try {
      await createCustomer(form);
      await writeLog({ admin_name: '销售专员', action: '新增客户', target_type: 'customer', target_name: form.name });
      setShowCreate(false);
      setForm({ name: '', phone: '', wechat: '', notes: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2563EB" />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Btn label="＋ 新增客户" onPress={() => setShowCreate(true)} small />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
        {customers.map(c => (
          <Pressable key={c.id} onPress={() => setSelectedCustomer(c)}
            style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
              borderColor: BD, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18,
                backgroundColor: `${STATUS_COLORS[c.status]}22`,
                alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: STATUS_COLORS[c.status], fontSize: 16, fontWeight: 'bold' }}>
                  {c.name.charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: T1, fontWeight: 'bold', fontSize: 14 }}>{c.name}</Text>
                  <View style={{ backgroundColor: `${STATUS_COLORS[c.status]}22`, borderRadius: 10,
                    paddingHorizontal: 7, paddingVertical: 2 }}>
                    <Text style={{ color: STATUS_COLORS[c.status], fontSize: 10, fontWeight: 'bold' }}>
                      {CUSTOMER_STATUS_LABELS[c.status] ?? c.status}
                    </Text>
                  </View>
                </View>
                <Text style={{ color: T3, fontSize: 11 }}>
                  {[c.phone, c.wechat].filter(Boolean).join(' · ') || '暂无联系方式'}
                </Text>
              </View>
              <Text style={{ color: T3, fontSize: 10 }}>{formatRelativeTime(c.updated_at)}</Text>
            </View>
            {(c.follow_ups as Array<{content: string; date: string; admin_name: string}>).length > 0 && (
              <View style={{ backgroundColor: '#1E2530', borderRadius: 8, padding: 8 }}>
                <Text style={{ color: T2, fontSize: 11 }} numberOfLines={2}>
                  💬 {(c.follow_ups as Array<{content: string; date: string; admin_name: string}>)[(c.follow_ups as Array<{content: string; date: string; admin_name: string}>).length - 1].content}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
        {customers.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>👥</Text>
            <Text style={{ color: T2, fontSize: 15 }}>暂无客户记录</Text>
            <Text style={{ color: T3, fontSize: 12, marginTop: 6 }}>点击"新增客户"开始管理</Text>
          </View>
        )}
      </ScrollView>

      {/* 新增客户 */}
      <ModalSheet visible={showCreate} title="新增客户" onClose={() => setShowCreate(false)}>
        <FormField label="客户姓名 *" value={form.name} onChangeText={v => setForm(f => ({ ...f, name: v }))} placeholder="请输入姓名" />
        <FormField label="手机号" value={form.phone} onChangeText={v => setForm(f => ({ ...f, phone: v }))} placeholder="手机号" keyboardType="phone-pad" />
        <FormField label="微信号" value={form.wechat} onChangeText={v => setForm(f => ({ ...f, wechat: v }))} placeholder="微信号" />
        <FormField label="备注" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="备注信息" />
        <Btn label={saving ? '创建中…' : '确认创建'} onPress={handleCreate} />
      </ModalSheet>

      {/* 客户详情（含跟进记录） */}
      {selectedCustomer && (
        <ModalSheet
          visible
          title={`客户详情 · ${selectedCustomer.name}`}
          onClose={() => { setSelectedCustomer(null); setNewFollowUp(''); }}>
          {/* 基本信息 */}
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: T3, fontSize: 12, width: 60 }}>手机</Text>
              <Text style={{ color: T1, fontSize: 12 }}>{selectedCustomer.phone || '—'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: T3, fontSize: 12, width: 60 }}>微信</Text>
              <Text style={{ color: T1, fontSize: 12 }}>{selectedCustomer.wechat || '—'}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: T3, fontSize: 12, width: 60 }}>状态</Text>
              <Text style={{ color: STATUS_COLORS[selectedCustomer.status], fontSize: 12, fontWeight: 'bold' }}>
                {CUSTOMER_STATUS_LABELS[selectedCustomer.status]}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: T3, fontSize: 12, width: 60 }}>来源</Text>
              <Text style={{ color: T1, fontSize: 12 }}>{selectedCustomer.source}</Text>
            </View>
          </View>

          {/* 跟进记录 */}
          <Text style={{ color: T1, fontWeight: 'bold', fontSize: 13, marginTop: 8 }}>
            跟进记录（{(selectedCustomer.follow_ups as Array<{content: string; date: string; admin_name: string}>).length} 条）
          </Text>
          {(selectedCustomer.follow_ups as Array<{content: string; date: string; admin_name: string}>).map((fu, i) => (
            <View key={i} style={{ backgroundColor: BG, borderRadius: 10, padding: 10, gap: 4 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: T2, fontSize: 11, fontWeight: 'bold' }}>{fu.admin_name}</Text>
                <Text style={{ color: T3, fontSize: 10 }}>{fu.date}</Text>
              </View>
              <Text style={{ color: T1, fontSize: 12 }}>{fu.content}</Text>
            </View>
          ))}
          {(selectedCustomer.follow_ups as Array<{content: string; date: string; admin_name: string}>).length === 0 && (
            <Text style={{ color: T3, fontSize: 12 }}>暂无跟进记录</Text>
          )}

          {/* 添加跟进 */}
          <Text style={{ color: T1, fontWeight: 'bold', fontSize: 13, marginTop: 4 }}>添加跟进记录</Text>
          <TextInput
            value={newFollowUp}
            onChangeText={setNewFollowUp}
            placeholder="记录本次跟进内容…"
            placeholderTextColor={T3}
            multiline
            style={{ backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 10,
              padding: 12, color: T1, fontSize: 13, minHeight: 80, textAlignVertical: 'top' }}
          />
          <Btn
            label="添加跟进"
            onPress={async () => {
              if (!newFollowUp.trim()) return;
              const fu = { date: new Date().toLocaleDateString('zh-CN'), content: newFollowUp.trim(), admin_name: '销售专员' };
              const updated = [...(selectedCustomer.follow_ups as Array<{content: string; date: string; admin_name: string}>), fu];
              await (await import('@/lib/rbac')).rbacClient
                .from('sales_customers')
                .update({ follow_ups: updated, updated_at: new Date().toISOString() })
                .eq('id', selectedCustomer.id);
              setSelectedCustomer(null);
              setNewFollowUp('');
              load();
            }}
            color="#10B981"
          />
        </ModalSheet>
      )}
    </View>
  );
}

// ── Tab3：折扣申请 ────────────────────────────────────────

const PLAN_OPTS = ['月卡 ¥98', '季卡 ¥268', '年卡 ¥888', '终身卡 ¥1588'];
const PLAN_AMOUNTS: Record<string, number> = {
  '月卡 ¥98': 98, '季卡 ¥268': 268, '年卡 ¥888': 888, '终身卡 ¥1588': 1588,
};

function DiscountTab() {
  const [requests, setRequests] = useState<DiscountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApply, setShowApply] = useState(false);
  const [showReview, setShowReview] = useState<DiscountRequest | null>(null);
  const [saving, setSaving] = useState(false);
  const [reviewNote, setReviewNote] = useState('');
  const [form, setForm] = useState({
    customer_name: '', plan_name: PLAN_OPTS[0], discount_rate: '0.9', reason: '',
  });

  // TODO: 实际应根据当前登录账号决定是审批方还是申请方
  // 此处为演示，超级管理员/运营总监可审批
  const IS_REVIEWER = true; // 演示：显示审批操作

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchDiscountRequests();
    setRequests(data);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleApply = async () => {
    const originalAmount = PLAN_AMOUNTS[form.plan_name] ?? 0;
    const discountRate = parseFloat(form.discount_rate);
    const finalAmount = +(originalAmount * discountRate).toFixed(2);
    if (!form.customer_name || !form.reason) return;
    setSaving(true);
    try {
      await submitDiscountRequest({
        applicant_name: '销售专员',
        customer_name: form.customer_name,
        plan_name: form.plan_name,
        original_amount: originalAmount,
        discount_rate: discountRate,
        final_amount: finalAmount,
        reason: form.reason,
      });
      await writeLog({
        admin_name: '销售专员',
        action: '提交折扣申请',
        target_type: 'discount_request',
        target_name: form.customer_name,
        detail: { plan: form.plan_name, discount: form.discount_rate },
      });
      setShowApply(false);
      setForm({ customer_name: '', plan_name: PLAN_OPTS[0], discount_rate: '0.9', reason: '' });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleReview = async (approved: boolean) => {
    if (!showReview) return;
    setSaving(true);
    try {
      await reviewDiscountRequest(
        showReview.id,
        approved ? 'approved' : 'rejected',
        '运营总监',
        reviewNote
      );
      await writeLog({
        admin_name: '运营总监',
        action: approved ? '批准折扣申请' : '拒绝折扣申请',
        target_type: 'discount_request',
        target_id: showReview.id,
        target_name: showReview.customer_name,
        detail: { review_note: reviewNote },
      });
      setShowReview(null);
      setReviewNote('');
      load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2563EB" />
    </View>
  );

  const pending = requests.filter(r => r.status === 'pending');
  const others  = requests.filter(r => r.status !== 'pending');

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Btn label="＋ 申请折扣" onPress={() => setShowApply(true)} small />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}>
        {pending.length > 0 && (
          <>
            <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: 'bold' }}>
              待审批（{pending.length}）
            </Text>
            {pending.map(r => (
              <DiscountCard key={r.id} req={r} isReviewer={IS_REVIEWER} onReview={() => { setShowReview(r); setReviewNote(''); }} />
            ))}
          </>
        )}
        {others.length > 0 && (
          <>
            <Text style={{ color: T3, fontSize: 12, fontWeight: 'bold', marginTop: 8 }}>历史申请</Text>
            {others.map(r => (
              <DiscountCard key={r.id} req={r} isReviewer={false} onReview={() => { }} />
            ))}
          </>
        )}
        {requests.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <Text style={{ fontSize: 40, marginBottom: 12 }}>🎟️</Text>
            <Text style={{ color: T2, fontSize: 15 }}>暂无折扣申请</Text>
          </View>
        )}
      </ScrollView>

      {/* 申请折扣弹窗 */}
      <ModalSheet visible={showApply} title="申请折扣" onClose={() => setShowApply(false)}>
        <View style={{ backgroundColor: '#F59E0B11', borderRadius: 10, padding: 10 }}>
          <Text style={{ color: '#F59E0B', fontSize: 12, lineHeight: 18 }}>
            ⚠️ 销售专员自主折扣上限 5%（最低折扣率 0.95）。超过上限需运营总监审批。
            审批通过后自动生成优惠券代码。
          </Text>
        </View>
        <FormField label="客户姓名 *" value={form.customer_name}
          onChangeText={v => setForm(f => ({ ...f, customer_name: v }))} placeholder="客户姓名" />
        <View style={{ gap: 4 }}>
          <Text style={{ color: T2, fontSize: 12 }}>价格方案</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PLAN_OPTS.map(p => (
              <Pressable key={p} onPress={() => setForm(f => ({ ...f, plan_name: p }))}
                style={{ borderRadius: 10, borderWidth: 1,
                  borderColor: form.plan_name === p ? '#2563EB' : BD,
                  backgroundColor: form.plan_name === p ? '#2563EB22' : 'transparent',
                  paddingVertical: 8, paddingHorizontal: 14 }}>
                <Text style={{ color: form.plan_name === p ? '#2563EB' : T2, fontSize: 12, fontWeight: 'bold' }}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        <FormField label="折扣比例（如 0.95 = 95折）" value={form.discount_rate}
          onChangeText={v => setForm(f => ({ ...f, discount_rate: v }))}
          keyboardType="numeric" placeholder="0.85 ~ 0.99" />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between',
          backgroundColor: BG, borderRadius: 10, padding: 12 }}>
          <Text style={{ color: T3, fontSize: 12 }}>
            原价：¥{PLAN_AMOUNTS[form.plan_name]?.toFixed(0) ?? 0}
          </Text>
          <Text style={{ color: '#10B981', fontSize: 13, fontWeight: 'bold' }}>
            折后：¥{((PLAN_AMOUNTS[form.plan_name] ?? 0) * (parseFloat(form.discount_rate) || 1)).toFixed(0)}
          </Text>
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: T2, fontSize: 12 }}>申请原因 *</Text>
          <TextInput
            value={form.reason}
            onChangeText={v => setForm(f => ({ ...f, reason: v }))}
            placeholder="请说明申请折扣的理由…"
            placeholderTextColor={T3}
            multiline
            style={{ backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 10,
              padding: 12, color: T1, fontSize: 13, minHeight: 70, textAlignVertical: 'top' }}
          />
        </View>
        <Btn label={saving ? '提交中…' : '提交审批'} onPress={handleApply} />
      </ModalSheet>

      {/* 审批弹窗（运营总监） */}
      {showReview && (
        <ModalSheet
          visible
          title="折扣申请审批"
          onClose={() => { setShowReview(null); setReviewNote(''); }}>
          <View style={{ gap: 6 }}>
            {[
              ['申请人', showReview.applicant_name],
              ['客户', showReview.customer_name],
              ['方案', showReview.plan_name],
              ['原价', `¥${showReview.original_amount}`],
              ['折扣', `${(showReview.discount_rate * 100).toFixed(0)}%`],
              ['折后价', `¥${showReview.final_amount}`],
              ['申请时间', fmtDate(showReview.created_at)],
            ].map(([k, v]) => (
              <View key={k} style={{ flexDirection: 'row', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: BD }}>
                <Text style={{ color: T3, fontSize: 12, width: 70 }}>{k}</Text>
                <Text style={{ color: T1, fontSize: 12, flex: 1 }}>{v}</Text>
              </View>
            ))}
          </View>
          <View style={{ backgroundColor: '#1E2530', borderRadius: 10, padding: 10 }}>
            <Text style={{ color: T2, fontSize: 11, marginBottom: 4 }}>申请原因</Text>
            <Text style={{ color: T1, fontSize: 13 }}>{showReview.reason}</Text>
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ color: T2, fontSize: 12 }}>审批意见（可选）</Text>
            <TextInput
              value={reviewNote}
              onChangeText={setReviewNote}
              placeholder="填写审批意见…"
              placeholderTextColor={T3}
              multiline
              style={{ backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 10,
                padding: 12, color: T1, fontSize: 13, minHeight: 60, textAlignVertical: 'top' }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Btn label={saving ? '…' : '拒绝'} onPress={() => handleReview(false)} color="#EF4444" />
            </View>
            <View style={{ flex: 2 }}>
              <Btn label={saving ? '…' : '批准'} onPress={() => handleReview(true)} color="#10B981" />
            </View>
          </View>
          {showReview.status === 'approved' && showReview.coupon_code && (
            <View style={{ backgroundColor: '#10B98122', borderRadius: 10, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: T2, fontSize: 11 }}>优惠券代码</Text>
              <Text style={{ color: '#10B981', fontSize: 16, fontWeight: 'bold', marginTop: 4 }}>
                {showReview.coupon_code}
              </Text>
            </View>
          )}
        </ModalSheet>
      )}
    </View>
  );
}

function DiscountCard({ req, isReviewer, onReview }: {
  req: DiscountRequest; isReviewer: boolean; onReview: () => void;
}) {
  const discount = req.discount_rate;
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BD, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Text style={{ color: T1, fontWeight: 'bold', fontSize: 14 }}>{req.customer_name}</Text>
            <StatusBadge status={req.status} />
          </View>
          <Text style={{ color: T3, fontSize: 11 }}>
            {req.plan_name} · {req.applicant_name} · {fmtDate(req.created_at)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: T3, fontSize: 11, textDecorationLine: 'line-through' }}>¥{req.original_amount}</Text>
          <Text style={{ color: '#10B981', fontSize: 14, fontWeight: 'bold' }}>¥{req.final_amount}</Text>
          <Text style={{ color: '#F59E0B', fontSize: 10 }}>{(discount * 100).toFixed(0)}折</Text>
        </View>
      </View>
      <Text style={{ color: T2, fontSize: 12, backgroundColor: BG, borderRadius: 8, padding: 8 }} numberOfLines={2}>
        原因：{req.reason}
      </Text>
      {req.status === 'pending' && isReviewer && (
        <Btn label="立即审批" onPress={onReview} small color="#F59E0B" />
      )}
      {req.status === 'approved' && req.coupon_code && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8,
          backgroundColor: '#10B98111', borderRadius: 10, padding: 10 }}>
          <Text style={{ color: T3, fontSize: 11 }}>优惠券：</Text>
          <Text style={{ color: '#10B981', fontSize: 13, fontWeight: 'bold' }}>{req.coupon_code}</Text>
        </View>
      )}
      {req.review_note && (
        <Text style={{ color: T3, fontSize: 11, fontStyle: 'italic' }}>
          审批意见：{req.review_note}
        </Text>
      )}
    </View>
  );
}

// ── Tab4：推广链接 ────────────────────────────────────────

function PromoTab() {
  const APP_URL = 'https://app-bjaapbe7wkqp.appmiaoda.com';
  const [promoCode] = useState(() => `SALE${Math.random().toString(36).substring(2, 7).toUpperCase()}`);
  const promoLink = `${APP_URL}?ref=${promoCode}`;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Card title="🔗 我的推广链接">
        <View style={{ backgroundColor: BG, borderRadius: 12, padding: 14, gap: 6 }}>
          <Text style={{ color: T3, fontSize: 11 }}>推广码</Text>
          <Text style={{ color: '#F59E0B', fontSize: 22, fontWeight: 'bold', letterSpacing: 2 }}>
            {promoCode}
          </Text>
        </View>
        <View style={{ backgroundColor: BG, borderRadius: 12, padding: 14, gap: 4 }}>
          <Text style={{ color: T3, fontSize: 11 }}>推广链接</Text>
          <Text style={{ color: '#2563EB', fontSize: 12 }} selectable>{promoLink}</Text>
        </View>
        <Btn label="复制推广链接" onPress={() => {}} color="#2563EB" />
      </Card>

      <Card title="📊 推广数据">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatBox value="0" label="点击次数" color="#2563EB" />
          <StatBox value="0" label="注册用户" color="#10B981" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatBox value="0" label="绑定客户" color="#8B5CF6" />
          <StatBox value="¥0" label="推荐佣金" color="#F59E0B" />
        </View>
        <Text style={{ color: T3, fontSize: 11, textAlign: 'center' }}>
          客户通过推广链接注册后自动绑定归属到您名下，佣金按成交订单10%计算
        </Text>
      </Card>

      <Card title="💡 使用说明">
        {[
          '将推广链接或二维码分享给潜在客户',
          '客户点击链接注册，自动绑定到您名下',
          '客户完成付款后，订单计入您的业绩',
          '佣金按10%比例每月结算',
          '推广数据实时更新，可在工作台查看',
        ].map((tip, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 4 }}>
            <Text style={{ color: '#2563EB', fontSize: 13, fontWeight: 'bold', width: 20 }}>{i + 1}.</Text>
            <Text style={{ color: T2, fontSize: 13, flex: 1 }}>{tip}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

// ── 主页面 ────────────────────────────────────────────────

export default function SalesWorkspaceScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SubTab>('dashboard');

  useFocusEffect(useCallback(() => {
    if (!isAdminSessionValidated()) {
      router.replace('/(app)/admin-verify' as never);
    }
  }, [router]));

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      {/* 顶部标题栏 */}
      <View style={{ paddingTop: 52, paddingBottom: 10, paddingHorizontal: 20,
        backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: '#1E2530' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: T1, fontSize: 16, fontWeight: 'bold' }}>销售工作台</Text>
            <Text style={{ color: T3, fontSize: 11, marginTop: 2 }}>
              💼 客户管理 · 折扣申请 · 业绩追踪
            </Text>
          </View>
          <View style={{ backgroundColor: '#EF444422', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: 'bold' }}>销售专员</Text>
          </View>
        </View>
      </View>

      {/* 子Tab栏 */}
      <View style={{ flexDirection: 'row', backgroundColor: BG,
        borderBottomWidth: 1, borderBottomColor: '#1E2530' }}>
        {SUBTABS.map(tab => (
          <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? '#EF4444' : 'transparent' }}>
            <Text style={{ fontSize: 16 }}>{tab.icon}</Text>
            <Text style={{ fontSize: 10, color: activeTab === tab.key ? '#EF4444' : T3,
              fontWeight: activeTab === tab.key ? 'bold' : 'normal' }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 内容区 */}
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'customers' && <CustomersTab />}
        {activeTab === 'discount'  && <DiscountTab />}
        {activeTab === 'promo'     && <PromoTab />}
      </View>
    </View>
  );
}
