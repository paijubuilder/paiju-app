/**
 * 消息推送中心 v20
 * 推送对象选择 · AI辅助生成内容 · 推送历史列表（含详情弹窗）
 */
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { addPushRecord, getPushHistory, getConfig, isAdminLoggedIn } from '@/lib/appStore';
import type { PushRecord } from '@/lib/appStore';

// 推送对象选项
const TARGET_OPTIONS = [
  { key: 'all',          label: '全部用户',      icon: '👥', desc: '向所有已安装用户推送' },
  { key: 'paid',         label: '付费用户',       icon: '💎', desc: '仅推送给会员用户' },
  { key: 'unpaid',       label: '未付费用户',     icon: '🔓', desc: '推动免费用户转化' },
  { key: 'inactive3d',   label: '3天未使用',      icon: '😴', desc: '唤醒沉睡用户' },
  { key: 'custom',       label: '自定义条件',     icon: '⚙️', desc: '自定义筛选条件' },
];

// AI模板推荐文案（动态读取套餐价格）
function getAiTemplates() {
  const cfg = getConfig();
  const daily = (parseFloat(cfg.cost30Day) / 30).toFixed(2);
  return [
    '🛡️ 您的牌局环境守护任务正在进行中，记得开启护航！',
    '⏰ 您的会员即将到期，续费即可继续享受全程护航服务',
    `🎉 限时活动：今日开通30天月卡¥${cfg.cost30Day}，每天仅¥${daily}，性价比最高`,
    '📊 护航报告已生成，点击查看本周牌局环境安全分析',
  ];
}

export default function PushCenterScreen() {
  const router = useRouter();

  const [tab, setTab] = useState<'send' | 'history'>('send');
  const [targetKey, setTargetKey] = useState('all');
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState(false);
  const [showAiTemplates, setShowAiTemplates] = useState(false);
  const [detailItem, setDetailItem] = useState<PushRecord | null>(null);

  // 未登录时重定向（必须在所有 hooks 之后）
  useEffect(() => {
    if (!isAdminLoggedIn()) {
      router.replace('/(app)/admin-login');
    }
  }, [router]);

  const history = getPushHistory();

  const targetLabel = TARGET_OPTIONS.find(t => t.key === targetKey)?.label ?? '全部用户';
  const mockCount: Record<string, number> = { all: 1284, paid: 436, unpaid: 848, inactive3d: 312, custom: 0 };
  const targetCount = mockCount[targetKey] ?? 0;

  const handleSend = () => {
    if (!content.trim()) return;
    setIsSending(true);
    setTimeout(() => {
      addPushRecord({
        target: targetLabel,
        content: content.trim(),
        deliveredCount: targetCount,
      });
      setIsSending(false);
      setSendSuccess(true);
      setContent('');
      setTimeout(() => setSendSuccess(false), 3000);
    }, 1200);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 标题栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 52 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>消息推送</Text>
          <Text style={{ color: C.GRAY, fontSize: 10 }}>PUSH CENTER</Text>
        </View>
      </View>

      {/* Tab 切换 */}
      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 16, backgroundColor: C.PANEL, borderRadius: 12, padding: 3 }}>
        {[{ key: 'send', label: '📢 发送推送' }, { key: 'history', label: '📋 推送历史' }].map(t => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key as 'send' | 'history')}
            style={{
              flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
              backgroundColor: tab === t.key ? C.BLUE : 'transparent',
            }}
          >
            <Text style={{ color: tab === t.key ? '#fff' : C.GRAY, fontSize: 13, fontWeight: tab === t.key ? 'bold' : 'normal' }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'send' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">

          {/* 推送对象 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 16, gap: 10 }}>
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>推送对象</Text>
            {TARGET_OPTIONS.map(opt => (
              <Pressable
                key={opt.key}
                onPress={() => setTargetKey(opt.key)}
                style={{
                  flexDirection: 'row', alignItems: 'center', gap: 10,
                  backgroundColor: targetKey === opt.key ? `${C.BLUE}15` : 'transparent',
                  borderRadius: 10, padding: 10,
                  borderWidth: 1, borderColor: targetKey === opt.key ? `${C.BLUE}50` : 'transparent',
                }}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  borderWidth: 2, borderColor: targetKey === opt.key ? C.BLUE : C.GRAY2,
                  backgroundColor: targetKey === opt.key ? C.BLUE : 'transparent',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {targetKey === opt.key && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                </View>
                <Text style={{ fontSize: 16 }}>{opt.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: C.WHITE, fontSize: 13 }}>{opt.label}</Text>
                  <Text style={{ color: C.GRAY, fontSize: 11 }}>{opt.desc}</Text>
                </View>
                {targetKey === opt.key && mockCount[opt.key] > 0 && (
                  <Text style={{ color: C.BLUE, fontSize: 11 }}>约{mockCount[opt.key]}人</Text>
                )}
              </Pressable>
            ))}
          </View>

          {/* 消息内容 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>消息内容</Text>
              <Pressable onPress={() => setShowAiTemplates(v => !v)}>
                <Text style={{ color: C.BLUE, fontSize: 12 }}>🤖 AI辅助生成</Text>
              </Pressable>
            </View>

            {/* AI模板 */}
            {showAiTemplates && (
              <View style={{ backgroundColor: C.BG, borderRadius: 12, borderWidth: 1, borderColor: `${C.BLUE}40`, padding: 12, gap: 8 }}>
                <Text style={{ color: C.GRAY, fontSize: 11, marginBottom: 2 }}>选择模板即可自动填充：</Text>
                {getAiTemplates().map((tpl, i) => (
                  <Pressable cssInterop={false}
                    key={i}
                    onPress={() => { setContent(tpl); setShowAiTemplates(false); }}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? `${C.BLUE}20` : `${C.BLUE}10`,
                      borderRadius: 8, padding: 10,
                      borderWidth: 1, borderColor: `${C.BLUE}30`,
                    })}
                  >
                    <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>{tpl}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <TextInput
              value={content}
              onChangeText={setContent}
              placeholder="输入推送内容，或使用AI模板辅助生成..."
              placeholderTextColor={C.GRAY2}
              multiline
              numberOfLines={4}
              style={{
                backgroundColor: C.BG, color: C.WHITE, borderRadius: 10,
                borderWidth: 1, borderColor: C.BORDER,
                padding: 12, fontSize: 13, lineHeight: 20,
                minHeight: 100, textAlignVertical: 'top',
              }}
            />
            <Text style={{ color: C.GRAY2, fontSize: 11 }}>
              已输入 {content.length} 字 · 建议不超过 100 字
            </Text>
          </View>

          {/* 预计送达 */}
          <View style={{ backgroundColor: `${C.BLUE}10`, borderRadius: 12, borderWidth: 1, borderColor: `${C.BLUE}30`, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 18 }}>📊</Text>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>
              预计送达：<Text style={{ color: C.WHITE, fontWeight: 'bold' }}>{targetCount}</Text> 位用户
            </Text>
          </View>

          {/* 成功提示 */}
          {sendSuccess && (
            <View style={{ backgroundColor: `${C.GREEN}15`, borderRadius: 12, borderWidth: 1, borderColor: `${C.GREEN}50`, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: C.GREEN, fontSize: 13, fontWeight: 'bold' }}>✅ 推送已发送，用户打开App时将收到通知</Text>
            </View>
          )}

          {/* 发送按钮 */}
          <Pressable cssInterop={false}
            onPress={handleSend}
            disabled={!content.trim() || isSending}
            style={({ pressed }) => ({
              backgroundColor: content.trim() ? (pressed ? '#1A5FCC' : C.BLUE) : C.GRAY2,
              borderRadius: 14, paddingVertical: 16, alignItems: 'center',
            })}
          >
            <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
              {isSending ? '发送中...' : `立即推送给 ${targetLabel}`}
            </Text>
          </Pressable>
        </ScrollView>
      ) : (
        // ── 推送历史 ──
        <FlatList
          data={history}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
          contentInsetAdjustmentBehavior="automatic"
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, gap: 10 }}>
              <Text style={{ fontSize: 40 }}>📭</Text>
              <Text style={{ color: C.GRAY, fontSize: 13 }}>暂无推送记录</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1, borderColor: C.BORDER, padding: 14, gap: 8 }}>
              {/* 时间和对象 */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={{ backgroundColor: C.BLUE_BG, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: C.BLUE, fontSize: 11 }}>{item.target}</Text>
                </View>
                <Text style={{ color: C.GRAY2, fontSize: 11 }}>
                  {new Date(item.time).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </Text>
                <Text style={{ color: C.GRAY, fontSize: 11, flex: 1, textAlign: 'right' }}>
                  已送达 {item.deliveredCount} 人
                </Text>
              </View>
              {/* 内容摘要 */}
              <Text style={{ color: C.WHITE, fontSize: 13, lineHeight: 20 }} numberOfLines={2}>
                {item.content}
              </Text>
              {/* 查看详情 */}
              <Pressable onPress={() => setDetailItem(item)}>
                <Text style={{ color: C.BLUE, fontSize: 11 }}>查看详情 →</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {/* ── 推送详情弹窗 ── */}
      <Modal visible={detailItem !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 28 }}
          onPress={() => setDetailItem(null)}
        >
          <Pressable style={{ width: '100%' }} onPress={e => e.stopPropagation()}>
            {detailItem && (
              <View style={{
                backgroundColor: C.PANEL, borderRadius: 18,
                borderWidth: 1, borderColor: C.BORDER,
                padding: 20, gap: 14,
              }}>
                {/* 标题 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>📢 推送详情</Text>
                  <Pressable onPress={() => setDetailItem(null)} hitSlop={12}>
                    <Text style={{ color: C.GRAY, fontSize: 20 }}>✕</Text>
                  </Pressable>
                </View>
                {/* 基本信息 */}
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <View style={{ backgroundColor: `${C.BLUE}20`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: C.BLUE, fontSize: 11 }}>{detailItem.target}</Text>
                    </View>
                    <Text style={{ color: C.GRAY2, fontSize: 11 }}>
                      {new Date(detailItem.time).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: C.GRAY, fontSize: 11 }}>预计送达：</Text>
                    <Text style={{ color: C.WHITE, fontSize: 12, fontWeight: 'bold' }}>{detailItem.deliveredCount} 位用户</Text>
                  </View>
                </View>
                {/* 推送内容 */}
                <View style={{ backgroundColor: C.BG, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 14 }}>
                  <Text style={{ color: C.GRAY, fontSize: 11, marginBottom: 6 }}>推送内容</Text>
                  <Text style={{ color: C.WHITE, fontSize: 13, lineHeight: 22 }}>{detailItem.content}</Text>
                </View>
                <Pressable cssInterop={false}
                  onPress={() => setDetailItem(null)}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
                  })}
                >
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>关闭</Text>
                </Pressable>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
