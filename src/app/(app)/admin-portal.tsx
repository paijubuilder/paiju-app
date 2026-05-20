/**
 * 管理员后台 — 主入口（已拆分：业务Tab到 src/components/admin/）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, ScrollView, Switch, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import AiCsModal from '@/components/AiCsModal';
import DocModal from '@/components/DocModal';
import { PRIVACY_TEXT } from '@/components/PrivacyModal';
import {
  adminLogout, getAdminDashboardData, getConfig, getManualAgents,
  isAdminSessionValidated, saveConfig, loadConfigFromDB, setAdminSessionValidated,
  createManualAgent, deleteManualAgent, updateManualAgentStatus, updateManualAgentRank,
  getAdminPendingOrders,
  clearAdminVerified,
} from '@/lib/appStore';
import type { AdminConfig, ManualAgentRecord } from '@/lib/appStore';

// ── 重量级 Tab 组件（独立文件，减小本文件 bundle 体积）
import { BusinessTab } from '@/components/admin/AdminBusinessTab';
import { SettingsTab } from '@/components/admin/AdminSettingsTab';
import { PayVerifyTab } from '@/components/admin/AdminPayVerifyTab';

// ─── 常量 ───────────────────────────────────────────────────
const APP_URL = 'https://app-bjaapbe7wkqp.appmiaoda.com';
const _AI_APP_ID = '2e5bd2a9-fcd4-4065-9f44-5e8e4d0e9d72';

// ─── 顶部提示条 ─────────────────────────────────────────────
function SavedToast({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.delay(1600),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
    }
  }, [visible, opacity]);
  return (
    <Animated.View style={{ position: 'absolute', top: 56, left: 0, right: 0, alignItems: 'center', zIndex: 999, opacity }}>
      <View style={{ backgroundColor: '#16A34A', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 }}>
        <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>✅ 已保存</Text>
      </View>
    </Animated.View>
  );
}

// ─── 分组卡片 ──────────────────────────────────────────────
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

// ─── 行项 ──────────────────────────────────────────────────
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

// ─── Tab1: 仪表盘 ──────────────────────────────────────────
function DashboardTab({
  onShowAI, config: _config, pendingVerifyCount, onGoVerify, onNavigateToTab,
}: {
  onShowAI: () => void;
  config: AdminConfig;
  pendingVerifyCount: number;
  onGoVerify: () => void;
  onNavigateToTab: (tab: TabKey) => void;
}) {
  const router = useRouter();
  const dash = getAdminDashboardData();
  const DAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
  const allZero = dash.weekIncome.every(v => v === 0);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
      {/* 三栏统计 */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[
          { label: '今日收入', value: `¥${dash.todayIncome.toFixed(2)}` },
          { label: '本月收入', value: `¥${dash.monthIncome.toFixed(2)}` },
          { label: '在线用户', value: `${dash.onlineUsers}人` },
        ].map(item => (
          <View key={item.label} style={{
            flex: 1, backgroundColor: '#161A1F', borderRadius: 14,
            borderWidth: 1, borderColor: '#2A3140', padding: 14, alignItems: 'center', gap: 4,
          }}>
            <Text style={{ color: '#8899AA', fontSize: 10 }}>{item.label}</Text>
            <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold', fontVariant: ['tabular-nums'] }}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* 7天趋势 */}
      <Card title="近7天收入趋势">
        {allZero ? (
          <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>📊</Text>
            <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center' }}>
              暂无数据，开始经营后将自动更新
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {dash.weekIncome.map((v, i) => {
              const max = Math.max(...dash.weekIncome, 1);
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', gap: 2 }}>
                  <View style={{ width: '100%', height: Math.max((v / max) * 56, 4), backgroundColor: `${C.BLUE}90`, borderRadius: 3 }} />
                  <Text style={{ color: '#8899AA', fontSize: 8 }}>{DAYS[i]}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* 异常预警 */}
      <Card title="异常预警">
        {/* 常驻付款核实提醒（橙色，点击跳转） */}
        {pendingVerifyCount > 0 && (
          <>
            <Pressable cssInterop={false}
              onPress={onGoVerify}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8,
                backgroundColor: pressed ? 'rgba(251,146,60,0.08)' : 'transparent',
                borderRadius: 8, marginHorizontal: -4, paddingHorizontal: 4,
              })}
            >
              <Text style={{ fontSize: 18 }}>💳</Text>
              <Text style={{ color: '#FB923C', fontSize: 13, fontWeight: 'bold', flex: 1 }}>
                ⚠️ 您有 {pendingVerifyCount} 笔待核实付款，请至【付款核实】页处理
              </Text>
              <Text style={{ color: '#FB923C', fontSize: 15 }}>›</Text>
            </Pressable>
            <View style={{ height: 1, backgroundColor: '#1E2530', marginVertical: 4 }} />
          </>
        )}
        {dash.warnings.length === 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 }}>
            <Text style={{ fontSize: 18 }}>✅</Text>
            <Text style={{ color: '#8899AA', fontSize: 13 }}>暂无系统异常</Text>
          </View>
        ) : (
          dash.warnings.filter(w => w.count > 0).map(w => (
            <View key={w.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
              <Text style={{ fontSize: 18 }}>{w.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 'bold' }}>{w.label}</Text>
                <Text style={{ color: '#8899AA', fontSize: 11 }}>{w.desc}</Text>
              </View>
              <View style={{ backgroundColor: '#EF444420', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: 'bold' }}>{w.count}</Text>
              </View>
            </View>
          ))
        )}
      </Card>

      {/* 快捷入口 */}
      <Card title="快捷操作（常用3步内完成）">
        {/* 第一级：经营核心 */}
        <Text style={{ color: '#667080', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 }}>① 经营核心</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: '价格方案切换', icon: '💰', desc: '一键切换套餐价格', onPress: () => onNavigateToTab('business') },
            { label: '代理管理', icon: '👥', desc: '查看/审核代理资质', onPress: () => onNavigateToTab('agents') },
            { label: '付款核实', icon: '💳', desc: '处理待核实订单', onPress: () => onNavigateToTab('verify') },
            { label: '消息推送', icon: '📢', desc: '发送通知给用户', onPress: () => router.push('/(app)/push-center') },
          ].map(b => (
            <Pressable cssInterop={false} key={b.label} onPress={b.onPress}
              style={({ pressed }) => ({
                width: '47%', backgroundColor: pressed ? '#1E2530' : '#0D0F12',
                borderRadius: 12, borderWidth: 1, borderColor: '#2A3140',
                padding: 12, gap: 4,
              })}>
              <Text style={{ fontSize: 22 }}>{b.icon}</Text>
              <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: '600' }}>{b.label}</Text>
              <Text style={{ color: '#667080', fontSize: 10 }}>{b.desc}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 1, backgroundColor: '#2A3140' }} />
        {/* 第二级：AI配置 */}
        <Text style={{ color: '#667080', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 }}>② AI智能配置</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: 'AI自主经营', icon: '🤖', desc: '3版本策略 · 一键优化', onPress: () => router.push('/(app)/ai-auto-rules') },
            { label: 'AI引流文案', icon: '🔥', desc: '热点关键词 → 推广文案', onPress: () => router.push('/(app)/ai-traffic-collab') },
            { label: '优化报告', icon: '📊', desc: '15天/30天经营分析', onPress: () => router.push({ pathname: '/(app)/optimization-report', params: { type: '15' } } as never) },
            { label: 'AI客服中心', icon: '💬', desc: '配置AI对话话术', onPress: onShowAI },
          ].map(b => (
            <Pressable cssInterop={false} key={b.label} onPress={b.onPress}
              style={({ pressed }) => ({
                width: '47%', backgroundColor: pressed ? '#1A1535' : '#0D0F12',
                borderRadius: 12, borderWidth: 1, borderColor: '#2A3140',
                padding: 12, gap: 4,
              })}>
              <Text style={{ fontSize: 22 }}>{b.icon}</Text>
              <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: '600' }}>{b.label}</Text>
              <Text style={{ color: '#667080', fontSize: 10 }}>{b.desc}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ height: 1, backgroundColor: '#2A3140' }} />
        {/* 第三级：系统工具 */}
        <Text style={{ color: '#667080', fontSize: 10, fontWeight: 'bold', letterSpacing: 0.5 }}>③ 系统设置与工具</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[
            { label: '开关管理', icon: '⚙️', desc: '持久化控制功能开关', onPress: () => onNavigateToTab('settings') },
            { label: '悬浮窗管理', icon: '🪟', desc: '悬浮窗开关 · 样式 · 权限引导', onPress: () => router.push('/(app)/admin-float-window') },
            { label: '原生功能配置', icon: '⚡', desc: '悬浮窗/无障碍/保活/开机自启', onPress: () => router.push('/(app)/admin-native-features') },
            { label: '支付配置', icon: '🏦', desc: '收款方式 · 二维码', onPress: () => onNavigateToTab('settings') },
            { label: '海报生成器', icon: '🎨', desc: '推广链接 · 二维码可配', onPress: () => onNavigateToTab('business') },
            { label: '用户反馈', icon: '📝', desc: '查看用户意见', onPress: () => router.push('/(app)/feedback-admin') },
          ].map(b => (
            <Pressable cssInterop={false} key={b.label} onPress={b.onPress}
              style={({ pressed }) => ({
                width: '47%', backgroundColor: pressed ? '#1E2530' : '#0D0F12',
                borderRadius: 12, borderWidth: 1, borderColor: '#2A3140',
                padding: 12, gap: 4,
              })}>
              <Text style={{ fontSize: 22 }}>{b.icon}</Text>
              <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: '600' }}>{b.label}</Text>
              <Text style={{ color: '#667080', fontSize: 10 }}>{b.desc}</Text>
            </Pressable>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}


function AgentsTab({ config, onSave }: { config: AdminConfig; onSave: (p: Partial<AdminConfig>) => void }) {
  const [agents, setAgents] = useState<ManualAgentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPhone, setNewPhone] = useState('');
  const [newRank, setNewRank] = useState<'初级代理' | '中级代理' | '高级代理'>('初级代理');
  const [aiEnabled, setAiEnabled] = useState(false);
  const _ = config; void onSave; // silence unused warnings

  const refresh = useCallback(() => setAgents(getManualAgents()), []);
  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  const filtered = agents.filter(a => search === '' || a.phone.includes(search));

  const doCreate = () => {
    if (newPhone.length < 4) return;
    createManualAgent(newPhone, newRank, '');
    setShowCreate(false); setNewPhone(''); setNewRank('初级代理');
    refresh();
  };

  const RANKS = ['初级代理', '中级代理', '高级代理'] as const;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
        {/* 统计 */}
        <View style={{ backgroundColor: '#161A1F', borderRadius: 14, borderWidth: 1, borderColor: '#2A3140', padding: 16, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ color: '#F0F4FF', fontSize: 24, fontWeight: 'bold', flex: 1 }}>{agents.length}</Text>
          <Text style={{ color: '#8899AA', fontSize: 13 }}>代理总数</Text>
        </View>

        {/* 搜索 */}
        <View style={{ backgroundColor: '#161A1F', borderRadius: 12, borderWidth: 1, borderColor: '#2A3140', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 }}>
          <Text style={{ color: '#8899AA', fontSize: 14, marginRight: 8 }}>🔍</Text>
          <TextInput
            value={search} onChangeText={setSearch}
            placeholder="搜索手机号" placeholderTextColor="#4A5568"
            style={{ flex: 1, color: '#F0F4FF', fontSize: 14, paddingVertical: 12 }}
          />
        </View>

        {/* 代理列表 */}
        {filtered.length === 0 ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Text style={{ fontSize: 32, marginBottom: 8 }}>👥</Text>
            <Text style={{ color: '#8899AA', fontSize: 13 }}>暂无代理，点击下方按钮创建</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {filtered.map(a => (
              <View key={a.id} style={{ backgroundColor: '#161A1F', borderRadius: 14, borderWidth: 1, borderColor: '#2A3140', padding: 14, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 'bold', flex: 1 }}>{a.phone}</Text>
                  <View style={{ backgroundColor: `${C.BLUE}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: C.BLUE, fontSize: 11 }}>{a.rank}</Text>
                  </View>
                  <View style={{ backgroundColor: a.status === 'active' ? '#16A34A20' : '#EF444420', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: a.status === 'active' ? '#16A34A' : '#EF4444', fontSize: 11 }}>
                      {a.status === 'active' ? '正常' : '暂停'}
                    </Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {RANKS.map(r => (
                    <Pressable cssInterop={false} key={r} onPress={() => { updateManualAgentRank(a.id, r); refresh(); }}
                      style={({ pressed }) => ({
                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7,
                        backgroundColor: a.rank === r ? '#2563EB' : pressed ? '#1E2530' : '#0D0F12',
                        borderWidth: 1, borderColor: a.rank === r ? '#2563EB' : '#2A3140',
                      })}>
                      <Text style={{ color: a.rank === r ? '#fff' : '#8899AA', fontSize: 11 }}>{r}</Text>
                    </Pressable>
                  ))}
                  <Pressable cssInterop={false} onPress={() => { updateManualAgentStatus(a.id, a.status === 'active' ? 'paused' : 'active'); refresh(); }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7,
                      backgroundColor: pressed ? '#1E2530' : '#0D0F12', borderWidth: 1, borderColor: '#2A3140',
                    })}>
                    <Text style={{ color: '#F59E0B', fontSize: 11 }}>{a.status === 'active' ? '暂停' : '恢复'}</Text>
                  </Pressable>
                  <Pressable cssInterop={false} onPress={() => { deleteManualAgent(a.id); refresh(); }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7,
                      backgroundColor: pressed ? '#1E2530' : '#0D0F12', borderWidth: 1, borderColor: '#2A3140',
                    })}>
                    <Text style={{ color: '#EF4444', fontSize: 11 }}>删除</Text>
                  </Pressable>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: '#8899AA', fontSize: 12, flex: 1 }}>AI权限</Text>
                  <Switch value={aiEnabled} onValueChange={setAiEnabled} thumbColor={aiEnabled ? C.BLUE : '#4A5568'} trackColor={{ false: '#2A3140', true: `${C.BLUE}50` }} />
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 底部创建按钮 */}
      <View style={{ position: 'absolute', bottom: 100, left: 16, right: 16 }}>
        <Pressable cssInterop={false} onPress={() => setShowCreate(true)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
            borderRadius: 14, paddingVertical: 15, alignItems: 'center',
          })}>
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>＋ 手动创建代理</Text>
        </Pressable>
      </View>

      {/* 创建代理弹窗 */}
      <BottomSheet visible={showCreate} title="创建代理" onClose={() => setShowCreate(false)}>
        <View style={{ gap: 12 }}>
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#8899AA', fontSize: 11 }}>手机号</Text>
            <TextInput
              value={newPhone} onChangeText={setNewPhone}
              placeholder="请输入代理手机号" placeholderTextColor="#4A5568" keyboardType="phone-pad"
              style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 14 }}
            />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#8899AA', fontSize: 11 }}>代理等级</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {RANKS.map(r => (
                <Pressable cssInterop={false} key={r} onPress={() => setNewRank(r)}
                  style={({ pressed }) => ({
                    flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center',
                    backgroundColor: newRank === r ? '#2563EB' : pressed ? '#1E2530' : '#0D0F12',
                    borderWidth: 1, borderColor: newRank === r ? '#2563EB' : '#2A3140',
                  })}>
                  <Text style={{ color: newRank === r ? '#fff' : '#8899AA', fontSize: 12 }}>{r}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <Pressable cssInterop={false} onPress={doCreate}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
              borderRadius: 12, paddingVertical: 13, alignItems: 'center',
            })}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认创建</Text>
          </Pressable>
        </View>
      </BottomSheet>
    </View>
  );
}


// ─── AI悬浮球 ──────────────────────────────────────────────
function AiFloatBall({ onPress }: { onPress: () => void }) {
  const breathAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
      Animated.timing(breathAnim, { toValue: 0.92, duration: 1500, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathAnim]);
  return (
    <View style={{ position: 'absolute', bottom: 100, right: 20, zIndex: 100 }}>
      <Animated.View style={{ transform: [{ scale: breathAnim }] }}>
        <Pressable cssInterop={false} onPress={onPress}
          style={({ pressed }) => ({
            width: 54, height: 54, borderRadius: 27,
            backgroundColor: pressed ? '#B45309' : '#D97706',
            alignItems: 'center', justifyContent: 'center',
            boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 16, color: 'rgba(217,119,6,0.6)' }],
          })}>
          <Text style={{ fontSize: 24 }}>🤖</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}


// ─── Tab Bar ───────────────────────────────────────────────
const TABS = [
  { key: 'dashboard', label: '仪表盘', icon: '📊' },
  { key: 'business',  label: '经营',   icon: '💰' },
  { key: 'agents',    label: '代理',   icon: '👥' },
  { key: 'verify',    label: '付款核实', icon: '💳' },
  { key: 'settings',  label: '系统',   icon: '⚙️' },
] as const;
type TabKey = typeof TABS[number]['key'];

// ─── 主页面 ────────────────────────────────────────────────
export default function AdminPortalScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [config, setConfig] = useState<AdminConfig>(getConfig);
  const [showAI, setShowAI] = useState(false);
  const [showPrivacyDoc, setShowPrivacyDoc] = useState(false);
  const [savedVisible, setSavedVisible] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 待核实订单数（用于仪表盘横幅和角标）
  const [pendingVerifyCount, setPendingVerifyCount] = useState(() => getAdminPendingOrders().length);

  // 未验证 → 重定向到验证页；同时每次聚焦从 DB 拉取最新配置（开关持久化核心）
  useFocusEffect(useCallback(() => {
    if (!isAdminSessionValidated()) {
      router.replace('/(app)/admin-verify' as never);
      return;
    }
    // 每次聚焦刷新待核实数量
    setPendingVerifyCount(getAdminPendingOrders().length);
    // 从 Supabase 拉取最新持久化配置，确保所有开关、价格等状态正确
    loadConfigFromDB().then(() => {
      setConfig(getConfig());
    }).catch(() => { /* 网络失败时使用内存配置 */ });
  }, [router]));

  if (!isAdminSessionValidated()) return null;

  const handleSave = (partial: Partial<AdminConfig>) => {
    saveConfig(partial);
    setConfig(getConfig());
    setSavedVisible(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSavedVisible(false), 2200);
  };

  const handleLogout = () => {
    adminLogout();
    clearAdminVerified();
    setAdminSessionValidated(false);
    router.replace('/(app)/detect' as never);
  };

  const TITLES: Record<TabKey, string> = {
    dashboard: '管理员仪表盘',
    business: '经营管理',
    agents: '代理管理',
    verify: '付款核实',
    settings: '系统设置',
  };

  // 每个Tab的一句话操作说明
  const TAB_HINTS: Record<TabKey, string> = {
    dashboard: '查看今日数据，3步内完成任何操作 👇',
    business:  '价格方案切换、收款配置、推广海报生成',
    agents:    '审核代理资质、查看代理业绩、调整折扣比例',
    verify:    '核实用户付款截图，确认后手动开通会员',
    settings:  '功能开关管理、AI配置、支付配置、安全设置',
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0F12' }}>
      <StatusBar style="light" backgroundColor="#0D0F12" />
      <SavedToast visible={savedVisible} />

      {/* 顶部标题栏 */}
      <View style={{
        paddingTop: 52, paddingBottom: 10, paddingHorizontal: 20,
        backgroundColor: '#0D0F12', borderBottomWidth: 1, borderBottomColor: '#1E2530',
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: '#2563EB', fontSize: 22 }}>←</Text>
          </Pressable>
          <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold', flex: 1 }}>
            {TITLES[activeTab]}
          </Text>
        </View>
        <Text style={{ color: '#667080', fontSize: 11, paddingLeft: 34 }}>
          💡 {TAB_HINTS[activeTab]}
        </Text>
      </View>

      {/* 内容区 */}
      <View style={{ flex: 1 }}>
        {activeTab === 'dashboard' && (
          <DashboardTab
            onShowAI={() => setShowAI(true)}
            config={config}
            pendingVerifyCount={pendingVerifyCount}
            onGoVerify={() => setActiveTab('verify')}
            onNavigateToTab={setActiveTab}
          />
        )}
        {activeTab === 'business' && (
          <BusinessTab config={config} onSave={handleSave} />
        )}
        {activeTab === 'agents' && (
          <AgentsTab config={config} onSave={handleSave} />
        )}
        {activeTab === 'verify' && (
          <PayVerifyTab onCountChange={setPendingVerifyCount} />
        )}
        {activeTab === 'settings' && (
          <SettingsTab config={config} onSave={handleSave} onLogout={handleLogout} onShowPrivacyDoc={() => setShowPrivacyDoc(true)} />
        )}
      </View>

      {/* AI悬浮球（所有Tab都显示） */}
      <AiFloatBall onPress={() => setShowAI(true)} />

      {/* 底部Tab栏 */}
      <View style={{
        flexDirection: 'row', backgroundColor: '#0D0F12',
        borderTopWidth: 1, borderTopColor: '#1E2530',
        paddingBottom: 20, paddingTop: 8,
      }}>
        {TABS.map(tab => {
          const hasBadge = tab.key === 'verify' && pendingVerifyCount > 0;
          return (
            <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
              style={{ flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 }}>
              <View style={{ position: 'relative' }}>
                <Text style={{ fontSize: 22 }}>{tab.icon}</Text>
                {hasBadge && (
                  <View style={{
                    position: 'absolute', top: -4, right: -6,
                    backgroundColor: '#EF4444', borderRadius: 8,
                    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
                  }}>
                    <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>{pendingVerifyCount}</Text>
                  </View>
                )}
              </View>
              <Text style={{
                fontSize: 10, fontWeight: activeTab === tab.key ? 'bold' : 'normal',
                color: activeTab === tab.key ? '#2563EB' : '#8899AA',
              }}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* AI客服弹窗 */}
      <AiCsModal
        visible={showAI}
        onClose={() => setShowAI(false)}
        greeting="您好！我是牌局环境守护智能运营助手，请问有什么可以帮您？"
        mode="admin"
      />

      {/* 隐私政策弹窗 */}
      <DocModal
        visible={showPrivacyDoc}
        title="隐私政策"
        content={PRIVACY_TEXT}
        onClose={() => setShowPrivacyDoc(false)}
      />
    </View>
  );
}
