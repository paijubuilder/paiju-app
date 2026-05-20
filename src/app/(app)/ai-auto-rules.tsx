/**
 * AI 自主经营规则页面 v2
 * - AI自主经营开关（持久化到 system_switches）
 * - 三个版本策略：保守/平衡/激进
 * - AI思考入口：调用文心大模型生成经营优化建议
 * - 动态优化日志（24h自动分析记录）
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { fetch } from 'expo/fetch';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { getConfig } from '@/lib/appStore';
import { getSwitch, updateSwitch } from '@/lib/switchStore';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

function _sb() { return createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }

// ── 三个版本定义 ──────────────────────────────────────────
interface RuleVersion {
  id: 'conservative' | 'balanced' | 'aggressive';
  name: string;
  icon: string;
  color: string;
  adjustRange: string;
  desc: string;
  triggerCondition: string;
  expectedROI: string;
  risk: string;
}
const RULE_VERSIONS: RuleVersion[] = [
  {
    id: 'conservative',
    name: '版本一·保守型',
    icon: '🛡️',
    color: '#16A34A',
    adjustRange: '±5%',
    desc: '价格微调幅度小，仅在转化率低于阈值时触发，稳健运营首选',
    triggerCondition: '转化率连续3天低于2%，自动将30天月卡降价5%',
    expectedROI: '+8%～15%',
    risk: '低',
  },
  {
    id: 'balanced',
    name: '版本二·平衡型',
    icon: '⚖️',
    color: '#2563EB',
    adjustRange: '±10%',
    desc: '综合转化率与ARPU数据，参考代理活跃度动态调整，最常用策略',
    triggerCondition: '7天ARPU下降>10%或代理流失>20%时触发价格/促销优化',
    expectedROI: '+15%～30%',
    risk: '中',
  },
  {
    id: 'aggressive',
    name: '版本三·激进型',
    icon: '🚀',
    color: '#F59E0B',
    adjustRange: '±20%',
    desc: '追求短期收入最大化，节假日/热点期间大幅促销，适合冲量',
    triggerCondition: '节假日前3天自动启用限时优惠，提升20%折扣力度',
    expectedROI: '+30%～50%',
    risk: '高',
  },
];

// ── AI建议日志 ────────────────────────────────────────────
interface AiSuggestionLog {
  id: string;
  generatedAt: string;
  versionRecommended: string;
  summary: string;
  adopted: boolean;
  fullText: string;
}

// ── 文心AI调用（SSE流）────────────────────────────────────
async function callWenxinAI(prompt: string, onChunk: (text: string) => void): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/wenxin-text-generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }], enable_thinking: true }),
  });
  if (!response.ok) throw new Error(`AI接口错误: ${response.status}`);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder('utf-8');
  let fullText = '';
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
      try {
        const chunk = JSON.parse(raw);
        const delta = chunk.choices?.[0]?.delta?.content ?? '';
        if (delta) { fullText += delta; onChunk(fullText); }
      } catch { /* 跳过无法解析的帧 */ }
    }
  }
  return fullText;
}

// ── 操作日志条目 ──────────────────────────────────────────
interface RuleLog {
  id: string;
  action: string;
  detail: string;
  time: string;
}
let logSeq = 1;
function genLog(action: string, detail: string): RuleLog {
  return { id: `log${logSeq++}`, action, detail, time: new Date().toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) };
}

// ── 主页面 ────────────────────────────────────────────────
export default function AiAutoRulesScreen() {
  const router = useRouter();
  const cfg = getConfig();

  // 开关状态（从 system_switches 持久化）
  const [autoEnabled, setAutoEnabled] = useState(false);
  const [aiOptEnabled, setAiOptEnabled] = useState(false);
  const [switchLoading, setSwitchLoading] = useState(true);

  // 当前选中版本
  const [activeVersion, setActiveVersion] = useState<RuleVersion['id']>('balanced');
  // AI建议
  const [aiThinking, setAiThinking] = useState(false);
  const [aiStreamText, setAiStreamText] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestionLog[]>([]);
  const [showSuggestion, setShowSuggestion] = useState<AiSuggestionLog | null>(null);
  // 操作日志
  const [logs, setLogs] = useState<RuleLog[]>([
    genLog('系统初始化', '已加载版本二·平衡型为默认策略'),
  ]);
  // 采纳建议确认弹窗
  const [confirmAdopt, setConfirmAdopt] = useState(false);
  const pendingAdoptRef = useRef<AiSuggestionLog | null>(null);

  // 加载持久化开关状态
  useFocusEffect(useCallback(() => {
    setSwitchLoading(true);
    Promise.all([
      getSwitch('ai_autonomous_mode'),
      getSwitch('ai_optimize_enabled'),
    ]).then(([auto, opt]) => {
      setAutoEnabled(auto);
      setAiOptEnabled(opt);
      setSwitchLoading(false);
    }).catch(() => setSwitchLoading(false));
  }, []));

  // 切换"AI自主经营模式"开关
  const toggleAutoMode = async (val: boolean) => {
    setAutoEnabled(val);
    await updateSwitch('ai_autonomous_mode', val);
    setLogs(p => [genLog('开关变更', `AI自主经营模式 → ${val ? '开启' : '关闭'}`), ...p]);
  };

  // 切换"AI自主优化规则"开关
  const toggleAiOpt = async (val: boolean) => {
    setAiOptEnabled(val);
    await updateSwitch('ai_optimize_enabled', val);
    setLogs(p => [genLog('开关变更', `AI自主优化规则 → ${val ? '开启' : '关闭'}`), ...p]);
    if (val) runAiAnalysis();
  };

  // 切换当前策略版本
  const switchVersion = (id: RuleVersion['id']) => {
    setActiveVersion(id);
    const v = RULE_VERSIONS.find(r => r.id === id)!;
    setLogs(p => [genLog('切换版本', `已切换至 ${v.name}，调整幅度 ${v.adjustRange}`), ...p]);
    // 持久化到 app_dynamic_config
    _sb().from('app_dynamic_config').upsert(
      { config_key: 'ai_rule_version', config_value: id, updated_at: new Date().toISOString() },
      { onConflict: 'config_key' }
    ).then(() => {}).then(undefined, () => {});
  };

  // AI思考分析
  const runAiAnalysis = async () => {
    if (aiThinking) return;
    setAiThinking(true);
    setAiStreamText('');
    const v = RULE_VERSIONS.find(r => r.id === activeVersion)!;
    const prompt = `你是一位棋牌游戏检测应用的经营分析师。
当前应用数据：
- 会员套餐价格：3天¥${cfg.cost3Day} / 30天¥${cfg.cost30Day} / 半年¥${cfg.cost180Day} / 年¥${cfg.cost365Day}
- 当前策略版本：${v.name}（调整幅度${v.adjustRange}）
- 代理折扣：初级${cfg.discountBasic}%、中级${cfg.discountMid}%、高级${cfg.discountHigh}%
- 客服模式：${cfg.csMode}

请根据以上数据进行经营分析，输出以下内容（500字以内）：
1. 当前价格体系评估（1-2句）
2. 推荐切换到哪个策略版本（保守/平衡/激进），理由
3. 建议调整的套餐价格（给出具体数字）
4. 是否建议开启/调整促销活动
5. 一句话总结（核心行动建议）

输出格式：直接给出分析文字，无需标题，语言简洁专业。`;
    try {
      const fullText = await callWenxinAI(prompt, (t) => setAiStreamText(t));
      const log: AiSuggestionLog = {
        id: `ai_${Date.now()}`,
        generatedAt: new Date().toLocaleString('zh-CN'),
        versionRecommended: v.name,
        summary: fullText.slice(0, 60) + (fullText.length > 60 ? '…' : ''),
        adopted: false,
        fullText,
      };
      setAiSuggestions(p => [log, ...p].slice(0, 10));
      setShowSuggestion(log);
      setLogs(p => [genLog('AI分析', `已生成新建议，推荐策略：${v.name}`), ...p]);
    } catch (e) {
      setAiStreamText(`分析失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setAiThinking(false);
    }
  };

  // 采纳AI建议
  const adoptSuggestion = (log: AiSuggestionLog) => {
    setAiSuggestions(p => p.map(s => s.id === log.id ? { ...s, adopted: true } : s));
    setShowSuggestion(null);
    setLogs(p => [genLog('采纳建议', `已采纳AI建议 #${log.id.slice(-6)}`), ...p]);
    setConfirmAdopt(false);
  };

  const activeV = RULE_VERSIONS.find(r => r.id === activeVersion)!;

  return (
    <View style={{ flex: 1, backgroundColor: '#0D0F12' }}>
      <StatusBar style="light" backgroundColor="#0D0F12" />
      {/* 顶部导航 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingBottom: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#1E2530' }}>
        <Pressable cssInterop={false} onPress={() => router.back()} hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, marginRight: 12 })}>
          <Text style={{ color: '#2563EB', fontSize: 16 }}>← 返回</Text>
        </Pressable>
        <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold', flex: 1 }}>AI自主经营规则</Text>
        <Text style={{ color: '#667080', fontSize: 11 }}>本页操作自动持久化</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
        {/* 一句话说明 */}
        <View style={{ backgroundColor: '#111827', borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: '#2563EB' }}>
          <Text style={{ color: '#8AACDD', fontSize: 13 }}>🤖 本页面控制AI自动调价策略。开启后AI按所选版本规则自动调整价格/促销，无需人工干预。</Text>
        </View>

        {/* 主控开关 */}
        <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', padding: 16, gap: 14 }}>
          <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>核心开关</Text>
          {switchLoading ? (
            <ActivityIndicator color={C.BLUE} />
          ) : (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: '600' }}>AI自主经营模式</Text>
                  <Text style={{ color: '#667080', fontSize: 12 }}>开启后AI按版本规则自动干预价格和促销</Text>
                </View>
                <Switch value={autoEnabled} onValueChange={toggleAutoMode}
                  thumbColor={autoEnabled ? C.BLUE : '#4A5568'}
                  trackColor={{ false: '#2A3140', true: `${C.BLUE}50` }} />
              </View>
              <View style={{ height: 1, backgroundColor: '#2A3140' }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: '600' }}>AI自主优化规则</Text>
                  <Text style={{ color: '#667080', fontSize: 12 }}>开启后立即运行AI分析，并每24小时自动更新建议</Text>
                </View>
                <Switch value={aiOptEnabled} onValueChange={toggleAiOpt}
                  thumbColor={aiOptEnabled ? '#F59E0B' : '#4A5568'}
                  trackColor={{ false: '#2A3140', true: '#F59E0B50' }} />
              </View>
            </>
          )}
        </View>

        {/* 三个版本选择 */}
        <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', padding: 16, gap: 12 }}>
          <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>策略版本选择</Text>
          {RULE_VERSIONS.map(v => {
            const selected = v.id === activeVersion;
            return (
              <Pressable cssInterop={false} key={v.id}
                onPress={() => switchVersion(v.id)}
                style={({ pressed }) => ({
                  borderRadius: 14, borderWidth: 1.5,
                  borderColor: selected ? v.color : '#2A3140',
                  backgroundColor: selected ? `${v.color}18` : '#0D0F12',
                  padding: 14, opacity: pressed ? 0.8 : 1,
                })}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <Text style={{ fontSize: 20 }}>{v.icon}</Text>
                  <Text style={{ color: selected ? v.color : '#F0F4FF', fontSize: 14, fontWeight: 'bold', flex: 1 }}>{v.name}</Text>
                  <View style={{ backgroundColor: selected ? v.color : '#2A3140', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{v.adjustRange}</Text>
                  </View>
                  {selected && <Text style={{ color: v.color, fontSize: 12 }}>✓ 当前</Text>}
                </View>
                <Text style={{ color: '#8899AA', fontSize: 12, marginBottom: 4 }}>{v.desc}</Text>
                <Text style={{ color: '#667080', fontSize: 11 }}>触发条件：{v.triggerCondition}</Text>
                <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
                  <Text style={{ color: '#4ADE80', fontSize: 11 }}>预期收益 {v.expectedROI}</Text>
                  <Text style={{ color: v.risk === '低' ? '#4ADE80' : v.risk === '中' ? '#F59E0B' : '#EF4444', fontSize: 11 }}>风险等级：{v.risk}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* AI思考入口 */}
        <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', padding: 16, gap: 12 }}>
          <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>AI思考 · 立即分析</Text>
          <Text style={{ color: '#8AACDD', fontSize: 12 }}>基于当前价格体系和策略版本，文心大模型生成经营优化建议（含具体价格调整方案）</Text>
          <Pressable cssInterop={false} onPress={runAiAnalysis} disabled={aiThinking}
            style={({ pressed }) => ({
              borderRadius: 12, backgroundColor: aiThinking ? '#1E2530' : '#7C3AED',
              paddingVertical: 13, alignItems: 'center', opacity: pressed ? 0.8 : 1,
            })}>
            {aiThinking
              ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}><ActivityIndicator color="#fff" size="small" /><Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>AI思考中…</Text></View>
              : <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>🧠 立即AI分析</Text>}
          </Pressable>
          {/* 流式输出预览 */}
          {aiStreamText !== '' && (
            <View style={{ backgroundColor: '#0D0F12', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2A3140' }}>
              <Text style={{ color: '#667080', fontSize: 10, marginBottom: 6 }}>AI实时输出：</Text>
              <Text style={{ color: '#C8D8F0', fontSize: 12, lineHeight: 20 }}>{aiStreamText}</Text>
            </View>
          )}
          {/* 历史建议列表 */}
          {aiSuggestions.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold' }}>历史AI建议（最近10条）</Text>
              {aiSuggestions.map(s => (
                <Pressable cssInterop={false} key={s.id} onPress={() => setShowSuggestion(s)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: '#0D0F12', borderRadius: 10, padding: 12,
                    borderWidth: 1, borderColor: s.adopted ? '#16A34A' : '#2A3140',
                    opacity: pressed ? 0.8 : 1,
                  })}>
                  <Text style={{ fontSize: 16 }}>{s.adopted ? '✅' : '💡'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: '600' }}>{s.generatedAt}</Text>
                    <Text style={{ color: '#667080', fontSize: 11 }} numberOfLines={1}>{s.summary}</Text>
                  </View>
                  <Text style={{ color: s.adopted ? '#16A34A' : '#2563EB', fontSize: 11 }}>{s.adopted ? '已采纳' : '查看 >'}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* 操作日志 */}
        <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', padding: 16, gap: 10 }}>
          <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>操作日志</Text>
          {logs.slice(0, 8).map(l => (
            <View key={l.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
              <Text style={{ color: '#667080', fontSize: 11, minWidth: 56 }}>{l.time}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#8AACDD', fontSize: 11, fontWeight: '600' }}>{l.action}</Text>
                <Text style={{ color: '#667080', fontSize: 11 }}>{l.detail}</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* AI建议详情弹窗 */}
      <Modal visible={showSuggestion !== null} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
              <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>🧠 AI经营建议</Text>
              <Pressable onPress={() => setShowSuggestion(null)} hitSlop={12}>
                <Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>
            {showSuggestion && (
              <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
                <Text style={{ color: '#667080', fontSize: 11 }}>生成时间：{showSuggestion.generatedAt} · {showSuggestion.versionRecommended}</Text>
                <Text style={{ color: '#C8D8F0', fontSize: 13, lineHeight: 22 }}>{showSuggestion.fullText}</Text>
                {!showSuggestion.adopted && (
                  <>
                    <Pressable cssInterop={false}
                      onPress={() => { pendingAdoptRef.current = showSuggestion; setConfirmAdopt(true); }}
                      style={({ pressed }) => ({ backgroundColor: pressed ? '#15803D' : '#16A34A', borderRadius: 12, paddingVertical: 13, alignItems: 'center' })}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>✅ 一键采纳此建议</Text>
                    </Pressable>
                    <Pressable cssInterop={false} onPress={() => setShowSuggestion(null)}
                      style={({ pressed }) => ({ backgroundColor: pressed ? '#1A2535' : '#1E2530', borderRadius: 12, paddingVertical: 12, alignItems: 'center' })}>
                      <Text style={{ color: '#8899AA', fontSize: 14 }}>暂不采纳</Text>
                    </Pressable>
                  </>
                )}
                {showSuggestion.adopted && (
                  <View style={{ backgroundColor: '#16A34A20', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                    <Text style={{ color: '#4ADE80', fontSize: 13, fontWeight: 'bold' }}>✅ 已采纳此建议</Text>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 二次确认弹窗 */}
      <Modal visible={confirmAdopt} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: '#161A1F', borderRadius: 18, padding: 24, gap: 16, borderWidth: 1, borderColor: '#2A3140' }}>
            <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold' }}>确认采纳AI建议？</Text>
            <Text style={{ color: '#8899AA', fontSize: 13 }}>采纳后系统将按AI建议调整策略版本，历史记录将同步更新。</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable cssInterop={false} onPress={() => setConfirmAdopt(false)}
                style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? '#1A2535' : '#1E2530', borderRadius: 12, paddingVertical: 12, alignItems: 'center' })}>
                <Text style={{ color: '#8899AA', fontSize: 14 }}>取消</Text>
              </Pressable>
              <Pressable cssInterop={false}
                onPress={() => { if (pendingAdoptRef.current) adoptSuggestion(pendingAdoptRef.current); }}
                style={({ pressed }) => ({ flex: 1, backgroundColor: pressed ? '#15803D' : '#16A34A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' })}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认采纳</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

