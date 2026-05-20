/**
 * 管理后台 — Tab5 付款核实
 */
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import {
  getAdminPendingOrders, activateOrderById, activateOrdersBatch,
  rejectOrderById, markOrderPriceAbnormal, refundOrderById,
  getTodayResolvedCount, getTodayTotalIncome, formatDateTime,
} from '@/lib/appStore';
import type { PayOrder } from '@/lib/appStore';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
        <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>{title}</Text>
      </View>
      <View style={{ padding: 16, gap: 12 }}>{children}</View>
    </View>
  );
}

function BottomSheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderTopColor: '#2A3140', maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
            <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            {children}
            <Pressable cssInterop={false} onPress={onClose}
              style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : '#2563EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 })}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认关闭</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Tab5: 付款核实 ────────────────────────────────────────
type VerifySubTab = 'all' | 'confirmed' | 'abnormal';

export function PayVerifyTab({ onCountChange }: { onCountChange: (n: number) => void }) {
  const [orders, setOrders] = useState<PayOrder[]>([]);
  const [subTab, setSubTab] = useState<VerifySubTab>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // 单订单操作
  const [activeOrder, setActiveOrder] = useState<PayOrder | null>(null);
  // 确认开通弹窗
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  // 批量确认弹窗
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);
  const [batchChecked, setBatchChecked] = useState(false);
  // 驳回弹窗
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // 工具箱弹窗：价格异常标记
  const [showMarkAbnormal, setShowMarkAbnormal] = useState(false);
  const [abnormalNote, setAbnormalNote] = useState('');
  // 工具箱弹窗：退款
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundNote, setRefundNote] = useState('');

  const reload = useCallback(() => {
    const pending = getAdminPendingOrders();
    setOrders(pending);
    onCountChange(pending.length);
    setSelected(new Set());
  }, [onCountChange]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const todayResolved = getTodayResolvedCount();
  const todayIncome = getTodayTotalIncome();
  const pendingCount = orders.length;

  // 根据子标签过滤
  const filtered = orders.filter(o => {
    if (subTab === 'confirmed') return o.aiStatus === 'confirmed';
    if (subTab === 'abnormal') return o.aiStatus === 'abnormal' || o.aiStatus === 'fraud' || o.status === '高危欺诈';
    return true;
  });

  // 开通后到期时间
  const calcExpireDate = (order: PayOrder): string => {
    if (order.planDays <= 0) return '代理权限（无期限）';
    const expire = new Date(Date.now() + order.planDays * 86400 * 1000);
    return `${expire.getFullYear()}年${expire.getMonth()+1}月${expire.getDate()}日`;
  };

  // AI差异详情
  const calcDiffNote = (order: PayOrder): string | null => {
    const plan = parseFloat(order.planPrice);
    const paid = parseFloat(order.payAmount);
    if (!order.payAmount || isNaN(plan) || isNaN(paid)) return null;
    const diff = Math.abs(plan - paid);
    if (diff <= 0.01) return null;
    return `套餐应付¥${order.planPrice}，用户实付¥${order.payAmount}，差额¥${diff.toFixed(2)}`;
  };

  // 勾选逻辑
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(o => o.id)));
  };

  // 单条开通
  const handleActivate = () => {
    if (!activeOrder || !confirmChecked) return;
    activateOrderById(activeOrder.id);
    setShowConfirmModal(false); setConfirmChecked(false); setActiveOrder(null);
    reload();
  };

  // 批量开通（仅AI已确认）
  const handleBatchActivate = () => {
    if (!batchChecked) return;
    const ids = Array.from(selected).filter(id => {
      const o = orders.find(x => x.id === id);
      return o?.aiStatus === 'confirmed';
    });
    activateOrdersBatch(ids);
    setShowBatchConfirm(false); setBatchChecked(false);
    reload();
  };

  // 单条驳回
  const handleReject = () => {
    if (!activeOrder) return;
    rejectOrderById(activeOrder.id, rejectReason.trim() || '管理员驳回');
    setShowRejectModal(false); setRejectReason(''); setActiveOrder(null);
    reload();
  };

  // 标记价格不符
  const handleMarkAbnormal = () => {
    if (!activeOrder) return;
    const diffNote = calcDiffNote(activeOrder);
    const fullNote = [abnormalNote.trim(), diffNote].filter(Boolean).join(' · ');
    markOrderPriceAbnormal(activeOrder.id, fullNote || '价格不符，需处理');
    setShowMarkAbnormal(false); setAbnormalNote(''); setActiveOrder(null);
    reload();
  };

  // 退款
  const handleRefund = () => {
    if (!activeOrder || !refundAmount.trim()) return;
    refundOrderById(activeOrder.id, '', refundAmount.trim(), refundNote.trim());
    setShowRefundModal(false); setRefundAmount(''); setRefundNote(''); setActiveOrder(null);
    reload();
  };

  // CSV导出
  const handleExport = () => {
    const header = '订单编号,套餐,付款金额,标准价格,AI状态,差异说明,提交时间,状态';
    const rows = orders.map(o => {
      const diff = calcDiffNote(o) ?? '';
      return `${o.id},${o.planLabel},${o.payAmount},${o.planPrice},${o.aiStatus},"${diff}",${formatDateTime(o.createdAt)},${o.status}`;
    }).join('\n');
    Clipboard.setStringAsync(`${header}\n${rows}`);
  };

  const SUB_TABS: { key: VerifySubTab; label: string }[] = [
    { key: 'all', label: `全部 (${orders.length})` },
    { key: 'confirmed', label: `AI已确认 (${orders.filter(o => o.aiStatus === 'confirmed').length})` },
    { key: 'abnormal', label: `AI异常 (${orders.filter(o => o.aiStatus === 'abnormal' || o.aiStatus === 'fraud').length})` },
  ];

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: selected.size > 0 ? 160 : 120 }}>
        {/* 顶部统计 */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: '#161A1F', borderRadius: 14, borderWidth: 1, borderColor: pendingCount > 0 ? '#EF4444' : '#2A3140', padding: 12, alignItems: 'center', gap: 3 }}>
            <Text style={{ color: '#8899AA', fontSize: 10 }}>待核实</Text>
            <Text style={{ color: pendingCount > 0 ? '#EF4444' : '#F0F4FF', fontSize: 20, fontWeight: 'bold' }}>{pendingCount}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#161A1F', borderRadius: 14, borderWidth: 1, borderColor: '#2A3140', padding: 12, alignItems: 'center', gap: 3 }}>
            <Text style={{ color: '#8899AA', fontSize: 10 }}>今日已核实</Text>
            <Text style={{ color: '#F0F4FF', fontSize: 20, fontWeight: 'bold' }}>{todayResolved}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#161A1F', borderRadius: 14, borderWidth: 1, borderColor: '#2A3140', padding: 12, alignItems: 'center', gap: 3 }}>
            <Text style={{ color: '#8899AA', fontSize: 10 }}>今日收款</Text>
            <Text style={{ color: '#D4AF37', fontSize: 16, fontWeight: 'bold' }}>¥{todayIncome.toFixed(0)}</Text>
          </View>
        </View>

        {/* 三标签页 */}
        <View style={{ flexDirection: 'row', backgroundColor: '#161A1F', borderRadius: 10, borderWidth: 1, borderColor: '#2A3140', padding: 3, gap: 2 }}>
          {SUB_TABS.map(t => (
            <Pressable key={t.key} onPress={() => { setSubTab(t.key); setSelected(new Set()); }}
              style={{
                flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center',
                backgroundColor: subTab === t.key ? '#2563EB' : 'transparent',
              }}>
              <Text style={{ color: subTab === t.key ? '#fff' : '#8899AA', fontSize: 11, fontWeight: subTab === t.key ? 'bold' : 'normal' }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* 全选行（有数据时显示） */}
        {filtered.length > 0 && (
          <Pressable onPress={toggleSelectAll}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
            <View style={{
              width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
              borderColor: selected.size === filtered.length ? '#2563EB' : '#4A5568',
              backgroundColor: selected.size === filtered.length ? '#2563EB' : 'transparent',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {selected.size === filtered.length && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
            </View>
            <Text style={{ color: '#8899AA', fontSize: 12 }}>
              {selected.size === filtered.length ? '取消全选' : '全选'}（已选 {selected.size} / {filtered.length}）
            </Text>
          </Pressable>
        )}

        {/* 订单列表 */}
        {filtered.length === 0 ? (
          <View style={{ backgroundColor: '#161A1F', borderRadius: 14, borderWidth: 1, borderColor: '#2A3140', padding: 32, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 36 }}>✅</Text>
            <Text style={{ color: '#8899AA', fontSize: 13 }}>此分类暂无订单</Text>
          </View>
        ) : (
          filtered.map(order => {
            const isSelected = selected.has(order.id);
            const isFraud = order.status === '高危欺诈' || order.aiStatus === 'fraud';
            const diffNote = calcDiffNote(order);
            return (
              <Pressable key={order.id} onPress={() => toggleSelect(order.id)}>
                <View style={{
                  backgroundColor: '#161A1F', borderRadius: 14, borderWidth: isSelected ? 2 : 1,
                  borderColor: isFraud ? '#EF4444' :
                    isSelected ? '#2563EB' :
                    order.aiStatus === 'confirmed' ? 'rgba(34,197,94,0.4)' :
                    order.aiStatus === 'abnormal' ? 'rgba(239,68,68,0.3)' : '#2A3140',
                  padding: 13, gap: 10,
                }}>
                  {/* 高危欺诈横幅 */}
                  {isFraud && (
                    <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 6, padding: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: '#F87171', fontSize: 11, fontWeight: 'bold' }}>🚨 高危欺诈预警 · 已置顶</Text>
                    </View>
                  )}
                  {/* 头部：勾选 + 订单号 + AI标签 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{
                      width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
                      borderColor: isSelected ? '#2563EB' : '#4A5568',
                      backgroundColor: isSelected ? '#2563EB' : 'transparent',
                      alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {isSelected && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                    </View>
                    <Text style={{ color: '#8899AA', fontSize: 10, flex: 1 }} selectable>{order.id}</Text>
                    {order.aiStatus === 'confirmed' ? (
                      <View style={{ backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#4ADE80', fontSize: 10, fontWeight: 'bold' }}>🤖 AI已确认</Text>
                      </View>
                    ) : isFraud ? (
                      <View style={{ backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#F87171', fontSize: 10, fontWeight: 'bold' }}>🤖 高危欺诈</Text>
                      </View>
                    ) : order.aiStatus === 'abnormal' ? (
                      <View style={{ backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#F87171', fontSize: 10, fontWeight: 'bold' }}>🤖 AI判定异常</Text>
                      </View>
                    ) : (
                      <View style={{ backgroundColor: 'rgba(234,179,8,0.12)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#FDE047', fontSize: 10 }}>🤖 AI审核中</Text>
                      </View>
                    )}
                  </View>

                  {/* 订单信息 */}
                  <View style={{ gap: 4 }}>
                    {/* 代理订单标识 */}
                    {order.planType === 'agent' && (
                      <View style={{ backgroundColor: 'rgba(212,175,55,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(212,175,55,0.4)' }}>
                        <Text style={{ color: '#D4AF37', fontSize: 10, fontWeight: 'bold' }}>🏆 代理开通订单 · {order.agentLevel}</Text>
                      </View>
                    )}
                    {[
                      { label: '提交时间', value: formatDateTime(order.createdAt) },
                      { label: '购买套餐', value: order.planLabel },
                      { label: '用户填写金额', value: `¥${order.payAmount || '未填写'}`, accent: true },
                      { label: '付款时间', value: order.payTime || '未填写' },
                      { label: '订单标准价格', value: `¥${order.planPrice}` },
                    ].map(row => (
                      <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#8899AA', fontSize: 12 }}>{row.label}</Text>
                        <Text style={{ color: row.accent ? '#D4AF37' : '#F0F4FF', fontSize: 12, fontWeight: row.accent ? 'bold' : 'normal' }}>{row.value}</Text>
                      </View>
                    ))}
                    {order.payNickOrNo ? (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#8899AA', fontSize: 12 }}>昵称/单号</Text>
                        <Text style={{ color: '#F0F4FF', fontSize: 12 }} selectable>{order.payNickOrNo}</Text>
                      </View>
                    ) : null}
                    {/* 差异详情自动标注 */}
                    {diffNote && (
                      <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 7, padding: 7, marginTop: 2 }}>
                        <Text style={{ color: '#F87171', fontSize: 11 }}>📊 差异：{diffNote}</Text>
                      </View>
                    )}
                    {/* AI备注 */}
                    {order.aiNote ? (
                      <View style={{ backgroundColor: isFraud ? 'rgba(239,68,68,0.1)' : order.aiStatus === 'abnormal' ? 'rgba(239,68,68,0.06)' : 'rgba(34,197,94,0.06)', borderRadius: 7, padding: 7, marginTop: 2 }}>
                        <Text style={{ color: isFraud || order.aiStatus === 'abnormal' ? '#F87171' : '#4ADE80', fontSize: 11 }}>
                          🤖 {order.aiNote}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* 操作按钮（单条） */}
                  {order.status !== '已完成' && order.status !== '已退款' && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {/* 确认开通 */}
                      <Pressable cssInterop={false}
                        onPress={() => { setActiveOrder(order); setConfirmChecked(false); setShowConfirmModal(true); }}
                        style={({ pressed }) => ({ flex: 1, minWidth: '45%', backgroundColor: pressed ? '#1A5FCC' : '#2563EB', borderRadius: 9, paddingVertical: 9, alignItems: 'center' })}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>✅ 确认开通</Text>
                      </Pressable>
                      {/* 驳回 */}
                      <Pressable cssInterop={false}
                        onPress={() => { setActiveOrder(order); setRejectReason(''); setShowRejectModal(true); }}
                        style={({ pressed }) => ({ flex: 1, minWidth: '45%', backgroundColor: pressed ? '#991B1B' : '#DC2626', borderRadius: 9, paddingVertical: 9, alignItems: 'center' })}
                      >
                        <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>❌ 驳回</Text>
                      </Pressable>
                      {/* 标记价格不符 */}
                      <Pressable cssInterop={false}
                        onPress={() => { setActiveOrder(order); setAbnormalNote(calcDiffNote(order) ?? ''); setShowMarkAbnormal(true); }}
                        style={({ pressed }) => ({ flex: 1, minWidth: '45%', backgroundColor: pressed ? '#78350F' : '#92400E', borderRadius: 9, paddingVertical: 9, alignItems: 'center' })}
                      >
                        <Text style={{ color: '#FCD34D', fontSize: 12, fontWeight: 'bold' }}>⚠️ 价格不符</Text>
                      </Pressable>
                      {/* 退款 */}
                      <Pressable cssInterop={false}
                        onPress={() => { setActiveOrder(order); setRefundAmount(order.payAmount); setRefundNote(''); setShowRefundModal(true); }}
                        style={({ pressed }) => ({ flex: 1, minWidth: '45%', backgroundColor: pressed ? '#1E2530' : '#0D0F12', borderRadius: 9, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#2A3140' })}
                      >
                        <Text style={{ color: '#8899AA', fontSize: 12 }}>💸 退款</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        {/* 导出对账表 */}
        <Pressable cssInterop={false}
          onPress={handleExport}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#1E2530' : '#0D0F12',
            borderRadius: 12, borderWidth: 1, borderColor: '#2A3140',
            paddingVertical: 13, alignItems: 'center',
          })}
        >
          <Text style={{ color: '#8899AA', fontSize: 13 }}>📊 导出对账表（复制CSV）</Text>
        </Pressable>
      </ScrollView>

      {/* 底部批量操作栏 */}
      {selected.size > 0 && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: '#161A1F', borderTopWidth: 1, borderTopColor: '#2A3140',
          padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingBottom: 30,
        }}>
          <Text style={{ color: '#F0F4FF', fontSize: 13, flex: 1 }}>已选 {selected.size} 笔</Text>
          <Pressable cssInterop={false}
            onPress={() => { setBatchChecked(false); setShowBatchConfirm(true); }}
            style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : '#2563EB', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 })}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>批量开通</Text>
          </Pressable>
          <Pressable onPress={() => setSelected(new Set())} style={{ padding: 8 }}>
            <Text style={{ color: '#8899AA', fontSize: 13 }}>取消</Text>
          </Pressable>
        </View>
      )}

      {/* ── 单条确认开通弹窗 ── */}
      <Modal visible={showConfirmModal && activeOrder !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#2A3140', paddingBottom: 36 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
              <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>⚠️ 确认开通</Text>
              <Pressable onPress={() => setShowConfirmModal(false)} hitSlop={12}><Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text></Pressable>
            </View>
            {activeOrder && (
              <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
                {[
                  { label: '订单编号', value: activeOrder.id },
                  { label: '设备ID', value: activeOrder.deviceId },
                  { label: '购买套餐', value: activeOrder.planLabel },
                  ...(activeOrder.planType === 'agent' ? [{ label: '代理等级', value: `🏆 ${activeOrder.agentLevel}（开通后自动赋权）` }] : []),
                  { label: '用户填写金额', value: `¥${activeOrder.payAmount || '未填写'}` },
                  { label: '付款时间', value: activeOrder.payTime || '未填写' },
                  { label: '订单标准价格', value: `¥${activeOrder.planPrice}` },
                  { label: '开通后到期时间', value: calcExpireDate(activeOrder) },
                ].map(item => (
                  <View key={item.label} style={{ flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#1E2530', paddingVertical: 8 }}>
                    <Text style={{ color: '#8899AA', fontSize: 12 }}>{item.label}</Text>
                    <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: 'bold', maxWidth: '60%', textAlign: 'right' }} selectable>{item.value}</Text>
                  </View>
                ))}
                {calcDiffNote(activeOrder) && (
                  <View style={{ backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: 8, padding: 10 }}>
                    <Text style={{ color: '#F87171', fontSize: 12 }}>📊 {calcDiffNote(activeOrder)}</Text>
                  </View>
                )}
                <Pressable onPress={() => setConfirmChecked(v => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 4 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: confirmChecked ? '#2563EB' : '#4A5568', backgroundColor: confirmChecked ? '#2563EB' : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 }}>
                    {confirmChecked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                  </View>
                  <Text style={{ color: '#8899AA', fontSize: 12, flex: 1, lineHeight: 20 }}>我已核对微信/支付宝收款记录，确认该用户已真实付款，且金额与订单一致</Text>
                </Pressable>
                <Pressable cssInterop={false} onPress={handleActivate} disabled={!confirmChecked}
                  style={({ pressed }) => ({ backgroundColor: confirmChecked ? (pressed ? '#1A5FCC' : '#2563EB') : '#2A3140', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 })}>
                  <Text style={{ color: confirmChecked ? '#fff' : '#667080', fontSize: 14, fontWeight: 'bold' }}>确认开通</Text>
                </Pressable>
                <Pressable onPress={() => setShowConfirmModal(false)} style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#8899AA', fontSize: 13 }}>取消</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── 批量确认开通弹窗 ── */}
      <Modal visible={showBatchConfirm} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#2A3140', paddingBottom: 36 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
              <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>批量开通确认</Text>
              <Pressable onPress={() => setShowBatchConfirm(false)} hitSlop={12}><Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text></Pressable>
            </View>
            <View style={{ padding: 20, gap: 14 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 13 }}>
                将开通已选 {selected.size} 笔订单中，AI状态为「已确认」的订单。其余状态订单将跳过。
              </Text>
              <Pressable onPress={() => setBatchChecked(v => !v)} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: batchChecked ? '#2563EB' : '#4A5568', backgroundColor: batchChecked ? '#2563EB' : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 }}>
                  {batchChecked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                </View>
                <Text style={{ color: '#8899AA', fontSize: 12, flex: 1, lineHeight: 20 }}>我已核对以上所有收款记录，确认均已真实付款</Text>
              </Pressable>
              <Pressable cssInterop={false} onPress={handleBatchActivate} disabled={!batchChecked}
                style={({ pressed }) => ({ backgroundColor: batchChecked ? (pressed ? '#1A5FCC' : '#2563EB') : '#2A3140', borderRadius: 12, paddingVertical: 14, alignItems: 'center' })}>
                <Text style={{ color: batchChecked ? '#fff' : '#667080', fontSize: 14, fontWeight: 'bold' }}>确认批量开通</Text>
              </Pressable>
              <Pressable onPress={() => setShowBatchConfirm(false)} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: '#8899AA', fontSize: 13 }}>取消</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 驳回弹窗 ── */}
      <Modal visible={showRejectModal && activeOrder !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#2A3140', paddingBottom: 36 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
              <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>❌ 驳回订单</Text>
              <Pressable onPress={() => setShowRejectModal(false)} hitSlop={12}><Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text></Pressable>
            </View>
            <View style={{ padding: 20, gap: 14 }}>
              <TextInput value={rejectReason} onChangeText={setRejectReason}
                placeholder="请填写驳回原因（如：金额不符、截图不清晰等）" placeholderTextColor="#4A5568"
                multiline style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 10, padding: 12, color: '#F0F4FF', fontSize: 13, minHeight: 80 }} />
              <Pressable cssInterop={false} onPress={handleReject} style={({ pressed }) => ({ backgroundColor: pressed ? '#991B1B' : '#DC2626', borderRadius: 12, paddingVertical: 14, alignItems: 'center' })}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认驳回</Text>
              </Pressable>
              <Pressable onPress={() => setShowRejectModal(false)} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: '#8899AA', fontSize: 13 }}>取消</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 标记价格不符弹窗 ── */}
      <Modal visible={showMarkAbnormal && activeOrder !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#2A3140', paddingBottom: 36 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
              <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>⚠️ 标记价格不符</Text>
              <Pressable onPress={() => setShowMarkAbnormal(false)} hitSlop={12}><Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text></Pressable>
            </View>
            <View style={{ padding: 20, gap: 12 }}>
              <Text style={{ color: '#8899AA', fontSize: 12, lineHeight: 18 }}>
                标记后，该订单将通知用户通过客服通道处理差额/退款，且【联系客服处理】入口将在用户端显示。
              </Text>
              <TextInput value={abnormalNote} onChangeText={setAbnormalNote}
                placeholder="差异说明（自动填入，可修改）" placeholderTextColor="#4A5568"
                multiline style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 10, padding: 12, color: '#F0F4FF', fontSize: 13, minHeight: 70 }} />
              <Pressable cssInterop={false} onPress={handleMarkAbnormal} style={({ pressed }) => ({ backgroundColor: pressed ? '#78350F' : '#92400E', borderRadius: 12, paddingVertical: 14, alignItems: 'center' })}>
                <Text style={{ color: '#FCD34D', fontSize: 14, fontWeight: 'bold' }}>确认标记</Text>
              </Pressable>
              <Pressable onPress={() => setShowMarkAbnormal(false)} style={{ paddingVertical: 8, alignItems: 'center' }}>
                <Text style={{ color: '#8899AA', fontSize: 13 }}>取消</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── 退款弹窗 ── */}
      <Modal visible={showRefundModal && activeOrder !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#2A3140', paddingBottom: 36 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
              <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>💸 处理退款</Text>
              <Pressable onPress={() => setShowRefundModal(false)} hitSlop={12}><Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text></Pressable>
            </View>
            <KeyboardAvoidingView behavior="padding">
              <View style={{ padding: 20, gap: 12 }}>
                <Text style={{ color: '#8899AA', fontSize: 12 }}>退款金额（必填，请核算实际应退金额）</Text>
                <TextInput value={refundAmount} onChangeText={setRefundAmount}
                  placeholder="实际退款金额" placeholderTextColor="#4A5568" keyboardType="decimal-pad"
                  style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 10, padding: 12, color: '#F0F4FF', fontSize: 14 }} />
                <Text style={{ color: '#8899AA', fontSize: 12 }}>退款备注（如退款方式、微信转账等）</Text>
                <TextInput value={refundNote} onChangeText={setRefundNote}
                  placeholder="例：通过微信转账退款" placeholderTextColor="#4A5568" multiline
                  style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 10, padding: 12, color: '#F0F4FF', fontSize: 13, minHeight: 60 }} />
                <Text style={{ color: '#667080', fontSize: 11 }}>提交后订单状态将更新为"已退款"，并记入操作日志。</Text>
                <Pressable cssInterop={false} onPress={handleRefund} disabled={!refundAmount.trim()}
                  style={({ pressed }) => ({ backgroundColor: refundAmount.trim() ? (pressed ? '#1E2530' : '#2A3140') : '#161A1F', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: refundAmount.trim() ? '#4ADE80' : '#2A3140' })}>
                  <Text style={{ color: refundAmount.trim() ? '#4ADE80' : '#4A5568', fontSize: 14, fontWeight: 'bold' }}>确认退款</Text>
                </Pressable>
                <Pressable onPress={() => setShowRefundModal(false)} style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ color: '#8899AA', fontSize: 13 }}>取消</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
