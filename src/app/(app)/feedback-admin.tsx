/**
 * 管理员反馈分析页 — 反馈列表 + 详情回复 + 词云 + 周报
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  FeedbackItem,
  FeedbackStatus,
  FeedbackType,
  formatDateTime,
  getFeedbackList,
  updateFeedbackReply,
  updateFeedbackStatus,
} from '@/lib/appStore';

// ─── 类型色系 ──────────────────────────────────────────
const TYPE_COLOR: Record<FeedbackType, string> = {
  '功能建议': '#3B82F6',
  'Bug反馈':  '#EF4444',
  '使用问题': '#F59E0B',
  '代理相关': '#8B5CF6',
  '其他':     '#6B7280',
};
const STATUS_COLOR: Record<FeedbackStatus, string> = {
  '待处理': '#EF4444',
  '处理中': '#F59E0B',
  '已采纳': '#10B981',
  '已回复': '#3B82F6',
};

// ─── 词云关键词（基于模拟数据统计）─────────────────────
const WORD_CLOUD = [
  { word: '通知提醒', count: 12, size: 22 },
  { word: '检测', count: 18, size: 26 },
  { word: '激活', count: 9, size: 18 },
  { word: '付款', count: 8, size: 17 },
  { word: '代理收益', count: 7, size: 16 },
  { word: '报告', count: 11, size: 20 },
  { word: '响应慢', count: 6, size: 15 },
  { word: '功能建议', count: 14, size: 24 },
  { word: '会员', count: 10, size: 19 },
  { word: '截图', count: 5, size: 14 },
  { word: '稳定性', count: 7, size: 16 },
  { word: '界面', count: 6, size: 15 },
  { word: '客服', count: 4, size: 13 },
  { word: '升级', count: 8, size: 17 },
];

// 周报模拟数据
const WEEKLY_REPORT = {
  period: '2026-04-28 ~ 2026-05-04',
  total: 23,
  dist: { '功能建议': 8, 'Bug反馈': 5, '使用问题': 6, '代理相关': 3, '其他': 1 },
  top5: [
    '通知提醒偶尔延迟，未及时收到护航完成通知（5条）',
    '付款后激活状态未刷新（4条）',
    '检测报告内容希望更详细（4条）',
    '代理收益计算不透明（3条）',
    '开通会员后找不到续费入口（2条）',
  ],
  suggestions: [
    '优先优化通知推送时效，减少用户错过关键护航节点的情况',
    '在付费完成后增加明显的激活成功提示，减少困惑',
    '检测报告页增加已扫描项目数量展示，提升透明度',
  ],
  aiSummary: '本周反馈以「功能建议」为主（占35%），说明产品基础稳定，用户关注点已转向体验提升。反馈集中在通知提醒时效，属于高优先级优化项。整体用户满意度较上周有所提升。',
};

type Tab = 'list' | 'wordcloud' | 'weekly';

// 筛选选项常量（提取为模块级，避免 JSX 内 as const 导致 Metro 打包错误）
const FEEDBACK_TYPE_FILTERS = ['全部', '功能建议', 'Bug反馈', '使用问题', '代理相关', '其他'] as const;
const FEEDBACK_STATUS_FILTERS = ['全部', '待处理', '处理中', '已采纳', '已回复'] as const;
type FeedbackTypeFilter = typeof FEEDBACK_TYPE_FILTERS[number];
type FeedbackStatusFilter = typeof FEEDBACK_STATUS_FILTERS[number];

export default function FeedbackAdminScreen() {
  const router = useRouter();
  const [tab, setTab]               = useState<Tab>('list');
  const [feedbacks, setFeedbacks]   = useState<FeedbackItem[]>(getFeedbackList());
  const [filterType, setFilterType] = useState<FeedbackType | '全部'>('全部');
  const [filterStatus, setFilterStatus] = useState<FeedbackStatus | '全部'>('全部');
  const [searchText, setSearchText] = useState('');
  const [selected, setSelected]     = useState<FeedbackItem | null>(null);
  const [replyText, setReplyText]   = useState('');
  const [showDetail, setShowDetail] = useState(false);

  // 刷新列表
  const refresh = () => setFeedbacks(getFeedbackList());

  // 过滤
  const displayed = feedbacks.filter(f => {
    if (filterType !== '全部' && f.type !== filterType) return false;
    if (filterStatus !== '全部' && f.status !== filterStatus) return false;
    if (searchText && !f.content.includes(searchText) && !f.type.includes(searchText)) return false;
    return true;
  });

  const openDetail = (item: FeedbackItem) => {
    setSelected(item);
    setReplyText(item.reply || `您好，感谢您的${item.type}！我们已收到您的反馈，将尽快跟进处理，如有需要会联系您。`);
    setShowDetail(true);
  };

  const sendReply = () => {
    if (!selected || !replyText.trim()) return;
    updateFeedbackReply(selected.id, replyText.trim());
    refresh();
    setShowDetail(false);
  };

  const changeStatus = (id: string, status: FeedbackStatus) => {
    updateFeedbackStatus(id, status);
    refresh();
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : null);
  };

  // ─── Tab: 反馈列表 ──────────────────────────────────
  const ListTab = () => (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      {/* 搜索框 */}
      <TextInput
        value={searchText}
        onChangeText={setSearchText}
        placeholder="搜索关键词..."
        placeholderTextColor={C.GRAY2}
        style={{ backgroundColor: C.PANEL, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, color: C.WHITE, fontSize: 14, borderWidth: 1, borderColor: C.BORDER }}
      />

      {/* 类型筛选 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FEEDBACK_TYPE_FILTERS.map(t => (
          <Pressable
            key={t}
            onPress={() => setFilterType(t)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
              backgroundColor: filterType === t ? C.GOLD : C.PANEL,
              borderWidth: 1, borderColor: filterType === t ? C.GOLD : C.BORDER }}
          >
            <Text style={{ color: filterType === t ? '#000' : C.GRAY, fontSize: 12 }}>{t}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* 状态筛选 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FEEDBACK_STATUS_FILTERS.map(s => (
          <Pressable
            key={s}
            onPress={() => setFilterStatus(s)}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16,
              backgroundColor: filterStatus === s ? C.BLUE : C.PANEL,
              borderWidth: 1, borderColor: filterStatus === s ? C.BLUE : C.BORDER }}
          >
            <Text style={{ color: filterStatus === s ? '#fff' : C.GRAY, fontSize: 12 }}>{s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={{ color: C.GRAY, fontSize: 12 }}>共 {displayed.length} 条反馈</Text>

      {displayed.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 36 }}>📭</Text>
          <Text style={{ color: C.GRAY, fontSize: 14, marginTop: 12 }}>暂无符合条件的反馈</Text>
        </View>
      )}

      {displayed.map(item => (
        <Pressable cssInterop={false}
          key={item.id}
          onPress={() => openDetail(item)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? C.PANEL2 : C.PANEL,
            borderRadius: 14, padding: 14, gap: 8,
            borderWidth: 1.5,
            borderColor: item.aiPriority === 'high' ? '#EF444440' : C.BORDER,
          })}
        >
          {/* 高优先级标注 */}
          {item.aiPriority === 'high' && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <View style={{ backgroundColor: '#EF4444', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>🔴 高优先级</Text>
              </View>
            </View>
          )}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ backgroundColor: TYPE_COLOR[item.type] + '30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: TYPE_COLOR[item.type], fontSize: 11, fontWeight: 'bold' }}>{item.type}</Text>
            </View>
            <View style={{ backgroundColor: STATUS_COLOR[item.status] + '25', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: STATUS_COLOR[item.status], fontSize: 11 }}>{item.status}</Text>
            </View>
          </View>
          <Text style={{ color: C.WHITE, fontSize: 13, lineHeight: 20 }} numberOfLines={2}>{item.content}</Text>
          <Text style={{ color: C.GRAY2, fontSize: 11 }}>{formatDateTime(item.time)}{item.contact ? `  ·  ${item.contact}` : ''}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );

  // ─── Tab: 词云 ──────────────────────────────────────
  const WordCloudTab = () => (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
      <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.BORDER, gap: 8 }}>
        <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>用户反馈热点词云</Text>
        <Text style={{ color: C.GRAY2, fontSize: 12 }}>基于全部反馈内容 AI 自动识别高频关键词</Text>
      </View>
      <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 20, borderWidth: 1, borderColor: C.BORDER }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
          {WORD_CLOUD.map((w, i) => {
            const colors = ['#D4AF37', '#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];
            const color = colors[i % colors.length];
            return (
              <Text key={w.word} style={{ color, fontSize: w.size, fontWeight: 'bold', opacity: 0.7 + w.count / 100 }}>
                {w.word}
              </Text>
            );
          })}
        </View>
      </View>
      {/* 频次排行 */}
      <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.BORDER, gap: 10 }}>
        <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>关键词频次排行 Top 8</Text>
        {[...WORD_CLOUD].sort((a, b) => b.count - a.count).slice(0, 8).map((w, i) => (
          <View key={w.word} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ color: i < 3 ? C.GOLD : C.GRAY2, fontSize: 13, width: 20, fontWeight: 'bold' }}>{i + 1}</Text>
            <Text style={{ color: C.WHITE, fontSize: 13, width: 70 }}>{w.word}</Text>
            <View style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 4, height: 6 }}>
              <View style={{ width: `${(w.count / 18) * 100}%`, backgroundColor: C.GOLD, borderRadius: 4, height: 6 }} />
            </View>
            <Text style={{ color: C.GRAY, fontSize: 12, width: 30, textAlign: 'right' }}>{w.count}次</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  // ─── Tab: 周报 ──────────────────────────────────────
  const WeeklyTab = () => (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
      <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: `${C.GOLD}50`, gap: 6 }}>
        <Text style={{ color: C.GOLD, fontSize: 15, fontWeight: 'bold' }}>📊 用户反馈周报</Text>
        <Text style={{ color: C.GRAY2, fontSize: 12 }}>统计周期：{WEEKLY_REPORT.period}</Text>
        <Text style={{ color: C.WHITE, fontSize: 13, marginTop: 4 }}>本周共收到反馈 <Text style={{ color: C.GOLD, fontWeight: 'bold', fontSize: 18 }}>{WEEKLY_REPORT.total}</Text> 条</Text>
      </View>

      {/* 类型分布 */}
      <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.BORDER, gap: 10 }}>
        <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>各类型占比</Text>
        {(Object.entries(WEEKLY_REPORT.dist) as [FeedbackType, number][]).map(([type, count]) => (
          <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_COLOR[type] }} />
            <Text style={{ color: C.WHITE, fontSize: 13, width: 70 }}>{type}</Text>
            <View style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 4, height: 6 }}>
              <View style={{ width: `${(count / WEEKLY_REPORT.total) * 100}%`, backgroundColor: TYPE_COLOR[type], borderRadius: 4, height: 6 }} />
            </View>
            <Text style={{ color: C.GRAY, fontSize: 12, width: 40, textAlign: 'right' }}>{count}条</Text>
          </View>
        ))}
      </View>

      {/* 高频问题 Top 5 */}
      <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.BORDER, gap: 10 }}>
        <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>高频问题 Top 5</Text>
        {WEEKLY_REPORT.top5.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
            <Text style={{ color: i < 3 ? '#EF4444' : C.GRAY, fontWeight: 'bold', fontSize: 14 }}>#{i + 1}</Text>
            <Text style={{ color: C.GRAY, fontSize: 13, flex: 1, lineHeight: 20 }}>{item}</Text>
          </View>
        ))}
      </View>

      {/* AI 优化建议 */}
      <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: `${C.BLUE}50`, gap: 10 }}>
        <Text style={{ color: C.BLUE, fontSize: 14, fontWeight: 'bold' }}>🤖 AI 优化建议</Text>
        {WEEKLY_REPORT.suggestions.map((s, i) => (
          <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
            <Text style={{ color: C.GOLD, fontSize: 13 }}>{i + 1}.</Text>
            <Text style={{ color: C.GRAY, fontSize: 13, flex: 1, lineHeight: 20 }}>{s}</Text>
          </View>
        ))}
      </View>

      {/* AI 总结 */}
      <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.BORDER }}>
        <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold', marginBottom: 8 }}>AI 综合总结</Text>
        <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 21 }}>{WEEKLY_REPORT.aiSummary}</Text>
      </View>
    </ScrollView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 顶栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Text style={{ color: C.GRAY, fontSize: 22 }}>←</Text>
        </Pressable>
        <Text style={{ color: C.WHITE, fontSize: 18, fontWeight: 'bold', flex: 1 }}>用户反馈分析</Text>
      </View>

      {/* Tab 切换 */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        {([['list', '📋 反馈列表'], ['wordcloud', '☁️ 词云'], ['weekly', '📊 周报']] as [Tab, string][]).map(([t, label]) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
              backgroundColor: tab === t ? C.GOLD : C.PANEL,
              borderWidth: 1, borderColor: tab === t ? C.GOLD : C.BORDER }}
          >
            <Text style={{ color: tab === t ? '#000' : C.GRAY, fontSize: 12, fontWeight: tab === t ? 'bold' : 'normal' }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'list'      && <ListTab />}
      {tab === 'wordcloud' && <WordCloudTab />}
      {tab === 'weekly'    && <WeeklyTab />}

      {/* 详情弹窗 */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '90%' }}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
              {selected && (
                <>
                  {/* 标题 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>反馈详情</Text>
                    <Pressable onPress={() => setShowDetail(false)} hitSlop={12}>
                      <Text style={{ color: C.GRAY, fontSize: 22 }}>✕</Text>
                    </Pressable>
                  </View>

                  {/* 基础信息 */}
                  <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 8, borderWidth: 1, borderColor: C.BORDER }}>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ backgroundColor: TYPE_COLOR[selected.type] + '30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: TYPE_COLOR[selected.type], fontSize: 12, fontWeight: 'bold' }}>{selected.type}</Text>
                      </View>
                      {selected.aiPriority === 'high' && (
                        <View style={{ backgroundColor: '#EF444430', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                          <Text style={{ color: '#EF4444', fontSize: 12 }}>🔴 高优先级</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: C.WHITE, fontSize: 14, lineHeight: 22 }}>{selected.content}</Text>
                    {selected.contact !== '' && (
                      <Text style={{ color: C.GRAY, fontSize: 12 }}>联系方式：{selected.contact}</Text>
                    )}
                    <Text style={{ color: C.GRAY2, fontSize: 11 }}>{formatDateTime(selected.time)}</Text>
                  </View>

                  {/* 状态更新 */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold' }}>更新处理状态</Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {(['待处理', '处理中', '已采纳', '已回复'] as FeedbackStatus[]).map(s => (
                        <Pressable
                          key={s}
                          onPress={() => changeStatus(selected.id, s)}
                          style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                            backgroundColor: selected.status === s ? STATUS_COLOR[s] : C.PANEL,
                            borderWidth: 1, borderColor: selected.status === s ? STATUS_COLOR[s] : C.BORDER }}
                        >
                          <Text style={{ color: selected.status === s ? '#fff' : C.GRAY, fontSize: 12 }}>{s}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  {/* 回复区 */}
                  <View style={{ gap: 8 }}>
                    <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold' }}>AI 生成回复模板（可修改）</Text>
                    <TextInput
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                      textAlignVertical="top"
                      style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 12, color: C.WHITE, fontSize: 13, minHeight: 100, lineHeight: 20, borderWidth: 1, borderColor: C.BORDER }}
                    />
                  </View>

                  <Pressable cssInterop={false}
                    onPress={sendReply}
                    style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center' })}
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>发送回复</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
