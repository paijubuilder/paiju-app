/**
 * AI 经验中心（十三）
 * 决策复盘 / 经验库 / 问题日志 / 经验优先回答
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';

// ── 类型定义 ──────────────────────────────────────────────
interface Decision { id: string; strategy: string; result: string; date: string; }
interface Experience { id: string; title: string; summary: string; verified: boolean; }
interface IssueLog { id: string; desc: string; solved: boolean; date: string; }

// ── 初始模拟数据 ──────────────────────────────────────────
const INIT_DECISIONS: Decision[] = [
  { id: 'd1', strategy: '端午节推出限时折扣活动，30天月卡减5元', result: '当日激活量提升32%，效果显著', date: '2026-04-15' },
  { id: 'd2', strategy: '将默认护航时长从8分钟调整为10分钟', result: '用户留存率提升12%，转化率略有下降', date: '2026-04-22' },
  { id: 'd3', strategy: '降低3天体验卡价格至¥7.9做引流测试', result: '新用户转化率提升12%，但ARPU下降5%', date: '2026-05-01' },
];

const INIT_EXPERIENCES: Experience[] = [
  { id: 'e1', title: '节日营销时机', summary: '节假日前3天推送折扣效果最佳，转化率平均提升25%以上', verified: true },
  { id: 'e2', title: '护航时长与转化', summary: '护航时长10-12分钟时，转化至付费会员的比例最高', verified: true },
  { id: 'e3', title: '代理激励策略', summary: '月底最后5天对代理进行额外激励，可提升当月代理销量约15%', verified: false },
];

const INIT_ISSUES: IssueLog[] = [
  { id: 'i1', desc: '部分Android机型通知权限弹窗无法自动跳转系统设置', solved: false, date: '2026-04-30' },
  { id: 'i2', desc: '代理升级页面在低版本Android上显示异常', solved: true, date: '2026-04-18' },
];

// ── Tab组件 ───────────────────────────────────────────────
function TabBar({ active, onChange }: { active: number; onChange: (i: number) => void }) {
  const tabs = ['决策复盘', '经验库', '问题日志'];
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.PANEL, borderRadius: 10, padding: 4, margin: 20, marginBottom: 0 }}>
      {tabs.map((t, i) => (
        <Pressable
          key={t}
          onPress={() => onChange(i)}
          style={{
            flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center',
            backgroundColor: active === i ? C.BLUE : 'transparent',
          }}
        >
          <Text style={{ color: active === i ? '#fff' : C.GRAY, fontSize: 12, fontWeight: 'bold' }}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── 主页面 ────────────────────────────────────────────────
export default function AiExperienceCenterScreen() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [decisions, setDecisions] = useState<Decision[]>(INIT_DECISIONS);
  const [experiences, setExperiences] = useState<Experience[]>(INIT_EXPERIENCES);
  const [issues, setIssues] = useState<IssueLog[]>(INIT_ISSUES);

  // 详情弹窗
  const [detailItem, setDetailItem] = useState<Decision | null>(null);

  // AI 经验优先回答
  const [aiQ, setAiQ] = useState('');
  const [aiA, setAiA] = useState('');

  const askAi = () => {
    if (!aiQ.trim()) return;
    // 查询经验库中是否有匹配经验
    const matched = experiences.filter(e =>
      e.verified && aiQ.split('').some(ch => e.summary.includes(ch) || e.title.includes(ch))
    );
    if (matched.length > 0) {
      setAiA(`📚 根据经验库中已验证的策略：\n\n${matched.map(e => `「${e.title}」\n${e.summary}`).join('\n\n')}\n\n建议优先参考以上经验，再结合当前数据做决策。`);
    } else {
      setAiA(`当前经验库暂无与"${aiQ}"直接相关的已验证经验。建议先执行一次策略测试，将结果记录到复盘区，AI将在下次查询时优先引用。`);
    }
    setAiQ('');
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
          <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>AI 经验中心</Text>
          <Text style={{ color: C.GRAY, fontSize: 10 }}>AI EXPERIENCE CENTER</Text>
        </View>
        <Text style={{ fontSize: 22 }}>🧠</Text>
      </View>

      {/* AI 经验优先回答输入框 */}
      <View style={{ marginHorizontal: 20, marginBottom: 12, backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1, borderColor: `${C.BLUE}40`, padding: 14, gap: 10 }}>
        <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold' }}>💬 向 AI 提问（优先查询经验库）</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            value={aiQ}
            onChangeText={setAiQ}
            placeholder="例：如何提升节日转化率？"
            placeholderTextColor={C.GRAY2}
            style={{ flex: 1, backgroundColor: C.BG, borderRadius: 8, padding: 10, color: C.WHITE, fontSize: 12, borderWidth: 1, borderColor: C.BORDER }}
            returnKeyType="send"
            onSubmitEditing={askAi}
          />
          <Pressable cssInterop={false} onPress={askAi} style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' })}>
            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>问</Text>
          </Pressable>
        </View>
        {aiA !== '' && (
          <View style={{ backgroundColor: C.PANEL2, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.BORDER }}>
            <Text style={{ color: C.WHITE, fontSize: 12, lineHeight: 20 }}>{aiA}</Text>
            <Pressable onPress={() => setAiA('')} style={{ alignSelf: 'flex-end', marginTop: 6 }}>
              <Text style={{ color: C.GRAY2, fontSize: 11 }}>关闭</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Tab */}
      <TabBar active={tab} onChange={setTab} />

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 16, gap: 12 }}>

        {/* ── 决策复盘区 ──────────────────────────────── */}
        {tab === 0 && (
          <>
            {decisions.map(d => (
              <View key={d.id} style={{ backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER, padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ color: C.WHITE, fontSize: 13, flex: 1, fontWeight: 'bold', lineHeight: 20 }}>{d.strategy}</Text>
                  <Text style={{ color: C.GRAY, fontSize: 11, marginLeft: 8 }}>{d.date}</Text>
                </View>
                <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>📊 {d.result}</Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                  <Pressable onPress={() => setDetailItem(d)} style={{ backgroundColor: C.PANEL2, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: C.BORDER }}>
                    <Text style={{ color: C.WHITE, fontSize: 11 }}>查看详情</Text>
                  </Pressable>
                  <Pressable onPress={() => setDecisions(prev => prev.filter(x => x.id !== d.id))} style={{ backgroundColor: 'rgba(200,100,74,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(200,100,74,0.4)' }}>
                    <Text style={{ color: '#c8644a', fontSize: 11 }}>删除</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {decisions.length === 0 && <Text style={{ color: C.GRAY2, fontSize: 13, textAlign: 'center', marginTop: 40 }}>暂无决策复盘记录</Text>}
          </>
        )}

        {/* ── 经验库 ──────────────────────────────────── */}
        {tab === 1 && (
          <>
            {experiences.map(e => (
              <View key={e.id} style={{ backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1, borderColor: e.verified ? `${C.BLUE}50` : C.BORDER, padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: e.verified ? `${C.BLUE}20` : C.PANEL2, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: e.verified ? `${C.BLUE}50` : C.BORDER }}>
                    <Text style={{ color: e.verified ? C.BLUE : C.GRAY, fontSize: 10, fontWeight: 'bold' }}>
                      {e.verified ? '✅ 已验证' : '⏳ 待验证'}
                    </Text>
                  </View>
                  <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold', flex: 1 }}>{e.title}</Text>
                </View>
                <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>{e.summary}</Text>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                  {!e.verified && (
                    <Pressable onPress={() => setExperiences(prev => prev.map(x => x.id === e.id ? { ...x, verified: true } : x))} style={{ backgroundColor: `${C.BLUE}20`, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: `${C.BLUE}50` }}>
                      <Text style={{ color: C.BLUE, fontSize: 11 }}>标记已验证</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => setExperiences(prev => prev.filter(x => x.id !== e.id))} style={{ backgroundColor: 'rgba(200,100,74,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(200,100,74,0.4)' }}>
                    <Text style={{ color: '#c8644a', fontSize: 11 }}>删除</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {experiences.length === 0 && <Text style={{ color: C.GRAY2, fontSize: 13, textAlign: 'center', marginTop: 40 }}>经验库暂无记录</Text>}
          </>
        )}

        {/* ── 问题日志 ────────────────────────────────── */}
        {tab === 2 && (
          <>
            {issues.map(i => (
              <View key={i.id} style={{ backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1, borderColor: i.solved ? 'rgba(46,204,128,0.3)' : 'rgba(200,100,74,0.3)', padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 16 }}>{i.solved ? '✅' : '🔴'}</Text>
                  <Text style={{ color: C.WHITE, fontSize: 13, flex: 1, lineHeight: 20 }}>{i.desc}</Text>
                  <Text style={{ color: C.GRAY, fontSize: 11 }}>{i.date}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                  {!i.solved && (
                    <Pressable onPress={() => setIssues(prev => prev.map(x => x.id === i.id ? { ...x, solved: true } : x))} style={{ backgroundColor: 'rgba(46,204,128,0.12)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(46,204,128,0.4)' }}>
                      <Text style={{ color: '#2ECC80', fontSize: 11 }}>标记已解决</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => setIssues(prev => prev.filter(x => x.id !== i.id))} style={{ backgroundColor: 'rgba(200,100,74,0.15)', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(200,100,74,0.4)' }}>
                    <Text style={{ color: '#c8644a', fontSize: 11 }}>删除</Text>
                  </Pressable>
                </View>
              </View>
            ))}
            {issues.length === 0 && <Text style={{ color: C.GRAY2, fontSize: 13, textAlign: 'center', marginTop: 40 }}>问题日志暂无记录</Text>}
          </>
        )}

      </ScrollView>

      {/* 决策详情弹窗 */}
      <Modal visible={detailItem !== null} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          {detailItem && (
            <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 22, gap: 14 }}>
              <Text style={{ color: C.BLUE, fontSize: 13, fontWeight: 'bold' }}>📋 决策详情</Text>
              <View style={{ gap: 8 }}>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>执行时间：{detailItem.date}</Text>
                <Text style={{ color: C.WHITE, fontSize: 13, lineHeight: 20 }}>策略：{detailItem.strategy}</Text>
                <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 20 }}>结果：{detailItem.result}</Text>
              </View>
              <Pressable cssInterop={false} onPress={() => setDetailItem(null)} style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 12, alignItems: 'center' })}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>关闭</Text>
              </Pressable>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}
