/**
 * 代理AI监控页（总台）
 * · 代理AI权限开关（每人独立）
 * · 违规自动熔断记录
 * · 对话记录搜索
 */
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  getAgentAiList, getAgentChatLogs, getViolationLogs,
  setAgentAiItemEnabled,
  type AgentAiItem, type AgentRank,
} from '@/lib/appStore';

// 等级徽章颜色
const RANK_COLOR: Record<AgentRank, string> = {
  '初级代理': '#CD7F32',
  '中级代理': '#A8B4C0',
  '高级代理': '#F0C040',
};
// AI球色
const AI_COLOR: Record<AgentRank, string> = {
  '初级代理': C.BLUE,
  '中级代理': '#A8B4C0',
  '高级代理': '#F0C040',
};

// 选项卡
type Tab = 'agents' | 'violations' | 'chats';

export default function AgentAiMonitorScreen() {
  const router = useRouter();
  const [tab, setTab]         = useState<Tab>('agents');
  const [agents, setAgents]   = useState<AgentAiItem[]>(getAgentAiList);
  const [chatSearch, setChatSearch] = useState('');

  const violations = getViolationLogs();
  const allChats   = getAgentChatLogs();

  const filteredChats = chatSearch.trim()
    ? allChats.filter(c =>
        c.agentName.includes(chatSearch) ||
        c.agentRank.includes(chatSearch) ||
        c.text.includes(chatSearch)
      )
    : allChats;

  const toggleAgent = (id: string, val: boolean) => {
    setAgentAiItemEnabled(id, val);
    setAgents(getAgentAiList());
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return `${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  };

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'agents',     label: '权限管理',  count: agents.length },
    { key: 'violations', label: '违规熔断',  count: violations.length },
    { key: 'chats',      label: '对话记录',  count: allChats.length },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 标题栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 52 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>代理AI监控</Text>
          <Text style={{ color: C.GRAY, fontSize: 10 }}>AGENT AI MONITOR</Text>
        </View>
        <Text style={{ fontSize: 22 }}>👁</Text>
      </View>

      {/* 选项卡 */}
      <View style={{ flexDirection: 'row', marginHorizontal: 20, marginBottom: 14, backgroundColor: C.PANEL, borderRadius: 12, padding: 4, gap: 4 }}>
        {TABS.map(t => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center', backgroundColor: tab === t.key ? C.BLUE : 'transparent' }}
          >
            <Text style={{ color: tab === t.key ? '#fff' : C.GRAY, fontSize: 12, fontWeight: tab === t.key ? 'bold' : 'normal' }}>
              {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 0, gap: 12 }}>

        {/* ── 权限管理 ──────────────────────────────── */}
        {tab === 'agents' && agents.map(agent => {
          const rankColor = RANK_COLOR[agent.rank];
          const aiColor   = AI_COLOR[agent.rank];
          return (
            <View key={agent.id} style={{
              backgroundColor: C.PANEL, borderRadius: 14, borderWidth: 1,
              borderColor: agent.suspended ? 'rgba(200,100,74,0.4)' : (agent.aiEnabled ? `${aiColor}30` : C.BORDER),
              padding: 14, gap: 8,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {/* 等级标签 */}
                <View style={{ backgroundColor: `${rankColor}15`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: `${rankColor}40` }}>
                  <Text style={{ color: rankColor, fontSize: 11, fontWeight: 'bold' }}>{agent.rank}</Text>
                </View>
                <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold', flex: 1 }}>{agent.name}</Text>

                {/* 熔断标记 */}
                {agent.suspended && (
                  <View style={{ backgroundColor: 'rgba(200,100,74,0.15)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(200,100,74,0.4)' }}>
                    <Text style={{ color: '#c8644a', fontSize: 10, fontWeight: 'bold' }}>🔴 熔断中</Text>
                  </View>
                )}

                {/* AI 开关 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: agent.aiEnabled && !agent.suspended ? aiColor : C.GRAY2 }} />
                  <Switch
                    value={agent.aiEnabled && !agent.suspended}
                    onValueChange={v => toggleAgent(agent.id, v)}
                    trackColor={{ false: C.BORDER, true: `${aiColor}80` }}
                    thumbColor={agent.aiEnabled && !agent.suspended ? aiColor : C.GRAY2}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: agent.aiEnabled && !agent.suspended ? aiColor : C.GRAY, fontSize: 12 }}>
                  {agent.aiEnabled && !agent.suspended ? `AI已开启` : agent.suspended ? '违规自动熔断中' : 'AI已关闭'}
                </Text>
                {agent.suspended && agent.suspendUntil && (
                  <Text style={{ color: C.GRAY2, fontSize: 11 }}>
                    恢复时间：{formatTime(agent.suspendUntil)}
                  </Text>
                )}
              </View>
            </View>
          );
        })}

        {/* ── 违规熔断记录 ──────────────────────────── */}
        {tab === 'violations' && (
          <>
            {violations.length === 0 && (
              <Text style={{ color: C.GRAY2, fontSize: 12, textAlign: 'center', paddingVertical: 30 }}>暂无违规记录</Text>
            )}
            {violations.map(v => (
              <View key={v.id} style={{ backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(200,100,74,0.4)', padding: 14, gap: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: '#c8644a', fontSize: 13, fontWeight: 'bold' }}>🚨 {v.agentName}</Text>
                  <View style={{ flex: 1 }} />
                  <Text style={{ color: C.GRAY, fontSize: 11 }}>{formatTime(v.time)}</Text>
                </View>
                <View style={{ backgroundColor: 'rgba(200,100,74,0.1)', borderRadius: 8, padding: 8 }}>
                  <Text style={{ color: C.GRAY, fontSize: 11 }}>触发违规词：<Text style={{ color: '#c8644a', fontWeight: 'bold' }}>"{v.word}"</Text></Text>
                  <Text style={{ color: C.WHITE, fontSize: 12, marginTop: 4, lineHeight: 18 }}>违规内容：{v.content}</Text>
                </View>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>⚡ 已自动熔断 24 小时，AI功能暂停</Text>
              </View>
            ))}
            <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center', lineHeight: 18 }}>
              违规词触发列表：包赢 / 透视 / 100% / 必赢 / 看牌 / 外挂 / 作弊 / 无敌
            </Text>
          </>
        )}

        {/* ── 对话记录搜索 ──────────────────────────── */}
        {tab === 'chats' && (
          <>
            <TextInput
              value={chatSearch}
              onChangeText={setChatSearch}
              placeholder="搜索代理姓名 / 等级 / 关键词..."
              placeholderTextColor={C.GRAY2}
              style={{ backgroundColor: C.PANEL, borderWidth: 1, borderColor: C.BORDER, borderRadius: 10, padding: 11, color: C.WHITE, fontSize: 13 }}
            />
            {filteredChats.length === 0 && (
              <Text style={{ color: C.GRAY2, fontSize: 12, textAlign: 'center', paddingVertical: 20 }}>
                {chatSearch ? '未找到匹配记录' : '暂无对话记录（代理使用AI助手后将在此显示）'}
              </Text>
            )}
            {filteredChats.map(c => (
              <View key={c.id} style={{
                backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1,
                borderColor: c.hasViolation ? 'rgba(200,100,74,0.4)' : C.BORDER,
                padding: 12, gap: 6,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ backgroundColor: `${RANK_COLOR[c.agentRank]}15`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                    <Text style={{ color: RANK_COLOR[c.agentRank], fontSize: 10 }}>{c.agentRank}</Text>
                  </View>
                  <Text style={{ color: C.WHITE, fontSize: 12, fontWeight: 'bold' }}>{c.agentName}</Text>
                  <View style={{ backgroundColor: c.role === 'user' ? `${C.BLUE}20` : C.PANEL2, borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: c.role === 'user' ? C.BLUE : C.GRAY, fontSize: 10 }}>{c.role === 'user' ? '代理发' : 'AI回复'}</Text>
                  </View>
                  {c.hasViolation && (
                    <View style={{ backgroundColor: 'rgba(200,100,74,0.15)', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ color: '#c8644a', fontSize: 10, fontWeight: 'bold' }}>⚠️ 违规</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }} />
                  <Text style={{ color: C.GRAY, fontSize: 10 }}>{formatTime(c.time)}</Text>
                </View>
                <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>{c.text}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
