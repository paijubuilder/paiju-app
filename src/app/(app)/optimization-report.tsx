/**
 * 优化报告页 — 15天小优化 / 30天大优化
 * 通过路由参数 type=15|30 区分
 * v2: 接入文心AI大模型，按真实反馈数据生成优化建议
 */
import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { fetch } from 'expo/fetch';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  OptimizationReport,
  OptimizationSuggestion,
  OptimizationStatus,
  adoptSuggestion,
  clearReportFlag,
  formatDateTime,
  generate15DayReport,
  generate30DayReport,
  getFeedbackList,
  getLatestReport,
} from '@/lib/appStore';
import type { FeedbackType } from '@/lib/appStore';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/** 调用文心AI Edge Function，收集完整SSE流后返回纯文本 */
async function callWenxinAI(prompt: string): Promise<string> {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/wenxin-text-generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`AI接口错误: ${response.status}`);

  // 手动解析SSE流，累积所有delta.content
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
        fullText += chunk.choices?.[0]?.delta?.content ?? '';
      } catch { /* 跳过无法解析的帧 */ }
    }
  }
  return fullText;
}

/** 从AI返回文本中提取JSON数组（兼容```json...```包裹的情况） */
function extractJsonArray(text: string): unknown[] | null {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}


const TYPE_COLOR: Record<FeedbackType, string> = {
  '功能建议': '#3B82F6',
  'Bug反馈':  '#EF4444',
  '使用问题': '#F59E0B',
  '代理相关': '#8B5CF6',
  '其他':     '#6B7280',
};

export default function OptimizationReportScreen() {
  const router = useRouter();
  const { type } = useLocalSearchParams<{ type: '15' | '30' }>();
  const reportType = type === '30' ? '30天大优化' : '15天小优化';

  const [report, setReport]           = useState<OptimizationReport | null>(() => getLatestReport(reportType) ?? null);
  const [_adoptedId, setAdoptedId]     = useState<string | null>(null);
  const [instruction, setInstruction]  = useState('');
  const [showInstr, setShowInstr]      = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError]          = useState('');
  const abortRef = useRef(false);

  // 标记已读
  clearReportFlag(type === '30' ? '30' : '15');

  /** 生成报告：先用本地函数得到真实统计数据，再用AI替换优化建议 */
  const handleGenerate = async () => {
    setIsGenerating(true);
    setAiError('');
    abortRef.current = false;

    // Step 1：本地生成报告（包含真实反馈统计）
    const baseReport = type === '30' ? generate30DayReport() : generate15DayReport();
    setReport(baseReport); // 先展示统计部分

    // Step 2：构建AI提示词（包含真实反馈摘要）
    const feedbacks = getFeedbackList();
    const dist = baseReport.typeDistribution;
    const topProblems = baseReport.topProblems.join('、');
    const is30 = type === '30';
    const suggestionCount = is30 ? 4 : 3;

    const prompt = `你是一款移动App（牌局环境检测工具，帮助用户检测棋牌游戏环境安全）的产品优化顾问。

当前${is30 ? '30天' : '15天'}用户反馈数据摘要：
- 总反馈量：${feedbacks.length} 条
- 功能建议：${dist['功能建议']} 条
- Bug反馈：${dist['Bug反馈']} 条
- 使用问题：${dist['使用问题']} 条
- 代理相关：${dist['代理相关']} 条
- 高频问题：${topProblems}
${is30 ? `- 30天趋势：${baseReport.trendSummary ?? ''}
- 转化漏斗：${baseReport.conversionFunnelNote ?? ''}` : ''}

请根据以上数据，生成 ${suggestionCount} 条具体的产品优化建议，以JSON数组格式返回（不要添加任何其他文字）：
[
  {
    "title": "建议标题（10字以内）",
    "detail": "详细说明（50-100字，结合数据说明问题和解决思路）",
    "expectedEffect": "预期效果（20字以内，量化描述）",
    "miaoInstruction": "给秒哒AI的修改指令（具体到文件名和修改内容，50-100字）"
  }
]`;

    try {
      const aiText = await callWenxinAI(prompt);
      if (abortRef.current) return;

      const parsed = extractJsonArray(aiText);
      if (parsed && parsed.length > 0) {
        // 将AI结果映射为 OptimizationSuggestion 格式
        const aiSuggestions: OptimizationSuggestion[] = (parsed as Array<Record<string, string>>).map((item, i) => ({
          id: `ai-${Date.now()}-${i}`,
          title: item.title ?? '优化建议',
          detail: item.detail ?? '',
          expectedEffect: item.expectedEffect ?? '',
          miaoInstruction: item.miaoInstruction ?? '',
          status: '待执行' as OptimizationStatus,
          priority: i + 1,
        }));
        // 用AI建议替换本地mock建议
        setReport(prev => prev ? { ...prev, suggestions: aiSuggestions } : prev);
      }
    } catch (e) {
      if (!abortRef.current) {
        setAiError('AI生成失败，已展示本地建议，稍后可重新生成');
      }
    } finally {
      if (!abortRef.current) setIsGenerating(false);
    }
  };

  const handleAdopt = (reportId: string, sg: OptimizationSuggestion) => {
    const instr = adoptSuggestion(reportId, sg.id);
    setAdoptedId(sg.id);
    setInstruction(instr);
    setShowInstr(true);
    const fresh = getLatestReport(reportType);
    setReport(fresh ?? null);
  };

  const is30 = type === '30';
  const accentColor = is30 ? '#8B5CF6' : '#3B82F6';
  const icon = is30 ? '🔮' : '🔵';

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 顶栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Text style={{ color: C.GRAY, fontSize: 22 }}>←</Text>
        </Pressable>
        <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold', flex: 1 }}>
          {icon} {reportType}报告
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* 无报告时 */}
        {!report && (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 16 }}>
            <Text style={{ fontSize: 48 }}>{icon}</Text>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>
              暂无{reportType}报告
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              {is30 ? '每30天自动生成一次大优化报告' : '每15天自动生成一次小优化报告'}{'\n'}
              您也可以手动立即生成
            </Text>
            <Pressable cssInterop={false}
              onPress={handleGenerate}
              disabled={isGenerating}
              style={({ pressed }) => ({ backgroundColor: isGenerating ? C.GRAY2 : (pressed ? '#6D28D9' : accentColor), borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14, flexDirection: 'row', gap: 8, alignItems: 'center' })}
            >
              {isGenerating && <ActivityIndicator size="small" color="#fff" />}
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>
                {isGenerating ? 'AI分析中...' : '立即生成报告'}
              </Text>
            </Pressable>
          </View>
        )}

        {report && (
          <>
            {/* 报告概览 */}
            <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 16, borderWidth: 1.5, borderColor: accentColor + '60', gap: 10 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: accentColor, fontSize: 15, fontWeight: 'bold' }}>{icon} {report.type}报告</Text>
                <Text style={{ color: C.GRAY2, fontSize: 11 }}>{formatDateTime(report.generatedAt)}</Text>
              </View>
              <Text style={{ color: C.WHITE, fontSize: 13 }}>
                统计期间共收到反馈 <Text style={{ color: C.GOLD, fontSize: 20, fontWeight: 'bold' }}>{report.totalFeedbacks}</Text> 条
              </Text>

              {/* 类型分布 */}
              <View style={{ gap: 6 }}>
                {(Object.entries(report.typeDistribution) as [FeedbackType, number][])
                  .filter(([, count]) => count > 0)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <View key={type} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: TYPE_COLOR[type] }} />
                      <Text style={{ color: C.GRAY, fontSize: 12, width: 60 }}>{type}</Text>
                      <View style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 4, height: 5 }}>
                        <View style={{ width: `${(count / report.totalFeedbacks) * 100}%`, backgroundColor: TYPE_COLOR[type], borderRadius: 4, height: 5 }} />
                      </View>
                      <Text style={{ color: C.GRAY2, fontSize: 11, width: 24, textAlign: 'right' }}>{count}</Text>
                    </View>
                  ))}
              </View>
            </View>

            {/* 30天大报告专属：趋势 & 漏斗 */}
            {is30 && report.trendSummary && (
              <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.BORDER, gap: 8 }}>
                <Text style={{ color: '#8B5CF6', fontSize: 13, fontWeight: 'bold' }}>📈 30天趋势对比</Text>
                <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 20 }}>{report.trendSummary}</Text>
              </View>
            )}
            {is30 && report.conversionFunnelNote && (
              <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.BORDER, gap: 8 }}>
                <Text style={{ color: '#8B5CF6', fontSize: 13, fontWeight: 'bold' }}>🔀 会员转化漏斗分析</Text>
                <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 20 }}>{report.conversionFunnelNote}</Text>
              </View>
            )}

            {/* 高频问题 */}
            <View style={{ backgroundColor: C.PANEL, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.BORDER, gap: 10 }}>
              <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>
                {is30 ? '用户最关注痛点 Top 5' : '高频问题 Top 3'}
              </Text>
              {report.topProblems.map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Text style={{ color: i < 2 ? '#EF4444' : C.GOLD, fontWeight: 'bold', fontSize: 14 }}>#{i + 1}</Text>
                  <Text style={{ color: C.GRAY, fontSize: 13, flex: 1, lineHeight: 20 }}>{p}</Text>
                </View>
              ))}
            </View>

            {/* 优化建议列表 */}
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>
              {is30 ? '深度优化建议（按转化影响排序）' : '具体优化建议'}
            </Text>

            {report.suggestions.map((sg, i) => (
              <View key={sg.id} style={{
                backgroundColor: C.PANEL, borderRadius: 16, padding: 16,
                borderWidth: 1.5,
                borderColor: sg.status === '已采纳' ? '#10B981' : (accentColor + '50'),
                gap: 10,
              }}>
                {/* 标题行 */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ backgroundColor: accentColor, borderRadius: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>{i + 1}</Text>
                      </View>
                      <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold', flex: 1 }}>{sg.title}</Text>
                    </View>
                  </View>
                  <View style={{ backgroundColor: sg.status === '已采纳' ? '#10B98130' : C.PANEL2, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: sg.status === '已采纳' ? '#10B981' : C.GRAY, fontSize: 11 }}>{sg.status}</Text>
                  </View>
                </View>

                {/* 详情 */}
                <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 21 }}>{sg.detail}</Text>

                {/* 预期效果 */}
                <View style={{ backgroundColor: `${accentColor}15`, borderRadius: 8, padding: 10, flexDirection: 'row', gap: 6, alignItems: 'flex-start' }}>
                  <Text style={{ color: accentColor, fontSize: 12 }}>💡</Text>
                  <Text style={{ color: accentColor, fontSize: 12, flex: 1, lineHeight: 18 }}>
                    预期效果：{sg.expectedEffect}
                  </Text>
                </View>

                {/* 采纳按钮 */}
                {sg.status !== '已采纳' && (
                  <Pressable cssInterop={false}
                    onPress={() => handleAdopt(report.id, sg)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? '#0D9E6E' : '#10B981',
                      borderRadius: 10, paddingVertical: 10, alignItems: 'center',
                    })}
                  >
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>✅ 采纳此建议，生成秒哒指令</Text>
                  </Pressable>
                )}
                {sg.status === '已采纳' && (
                  <Pressable
                    onPress={() => { setInstruction(sg.miaoInstruction); setShowInstr(true); }}
                    style={{ borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#10B981' }}
                  >
                    <Text style={{ color: '#10B981', fontSize: 13 }}>📋 查看秒哒指令文本</Text>
                  </Pressable>
                )}
              </View>
            ))}

            {/* AI生成状态条 */}
            {isGenerating && (
              <View style={{ backgroundColor: `${accentColor}20`, borderRadius: 12, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', borderWidth: 1, borderColor: accentColor + '40' }}>
                <ActivityIndicator size="small" color={accentColor} />
                <Text style={{ color: accentColor, fontSize: 13, flex: 1 }}>AI正在基于真实反馈数据生成优化建议...</Text>
              </View>
            )}

            {/* AI错误提示 */}
            {!!aiError && !isGenerating && (
              <View style={{ backgroundColor: '#EF444415', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#EF444440' }}>
                <Text style={{ color: '#EF4444', fontSize: 12 }}>⚠️ {aiError}</Text>
              </View>
            )}

            {/* 重新生成 */}
            <Pressable
              onPress={handleGenerate}
              disabled={isGenerating}
              style={{ borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: isGenerating ? C.BORDER2 : C.BORDER, marginTop: 4, flexDirection: 'row', justifyContent: 'center', gap: 8 }}
            >
              {isGenerating && <ActivityIndicator size="small" color={C.GRAY} />}
              <Text style={{ color: isGenerating ? C.GRAY2 : C.GRAY, fontSize: 13 }}>
                {isGenerating ? 'AI生成中...' : '🔄 重新生成报告（AI）'}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* 秒哒指令弹窗 */}
      <Modal visible={showInstr} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 20, padding: 24, gap: 16, borderWidth: 1.5, borderColor: '#10B981' }}>
            <Text style={{ color: '#10B981', fontSize: 16, fontWeight: 'bold' }}>📋 秒哒修改指令</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>将以下指令复制后，发送给秒哒AI执行：</Text>
            <View style={{ backgroundColor: C.BG, borderRadius: 12, padding: 14 }}>
              <Text selectable style={{ color: C.WHITE, fontSize: 13, lineHeight: 22 }}>{instruction}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setShowInstr(false)}
                style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 10, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: C.BORDER }}
              >
                <Text style={{ color: C.GRAY, fontSize: 14 }}>关闭</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
