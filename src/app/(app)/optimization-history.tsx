/**
 * 优化历史记录页 — 展示所有已执行/未执行的优化建议
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  OptimizationReport,
  OptimizationSuggestion,
  formatDateTime,
  getAllReports,
} from '@/lib/appStore';

type FilterType = '全部' | '15天小优化' | '30天大优化';
type FilterStatus = '全部' | '已采纳' | '待执行' | '已忽略';

export default function OptimizationHistoryScreen() {
  const router = useRouter();
  const [reports]             = useState<OptimizationReport[]>(getAllReports());
  const [filterType, setFilterType]     = useState<FilterType>('全部');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('全部');
  const [selected, setSelected]         = useState<{ report: OptimizationReport; sg: OptimizationSuggestion } | null>(null);

  // 展开所有建议条目
  const allItems = reports.flatMap(r =>
    r.suggestions.map(sg => ({ report: r, sg }))
  ).filter(({ report, sg }) => {
    if (filterType !== '全部' && report.type !== filterType) return false;
    if (filterStatus !== '全部' && sg.status !== filterStatus) return false;
    return true;
  });

  const statusColor: Record<string, string> = {
    '已采纳': '#10B981',
    '待执行': '#F59E0B',
    '已忽略': '#6B7280',
  };
  const typeColor: Record<string, string> = {
    '15天小优化': '#3B82F6',
    '30天大优化': '#8B5CF6',
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 顶栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Text style={{ color: C.GRAY, fontSize: 22 }}>←</Text>
        </Pressable>
        <Text style={{ color: C.WHITE, fontSize: 18, fontWeight: 'bold', flex: 1 }}>优化历史</Text>
        <Text style={{ color: C.GRAY, fontSize: 13 }}>{allItems.length} 条</Text>
      </View>

      {/* 筛选栏 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(['全部', '15天小优化', '30天大优化'] as FilterType[]).map(t => (
            <Pressable
              key={t}
              onPress={() => setFilterType(t)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
                backgroundColor: filterType === t ? (typeColor[t] ?? C.GOLD) : C.PANEL,
                borderWidth: 1, borderColor: filterType === t ? (typeColor[t] ?? C.GOLD) : C.BORDER }}
            >
              <Text style={{ color: filterType === t ? '#fff' : C.GRAY, fontSize: 12 }}>{t}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(['全部', '已采纳', '待执行', '已忽略'] as FilterStatus[]).map(s => (
            <Pressable
              key={s}
              onPress={() => setFilterStatus(s)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16,
                backgroundColor: filterStatus === s ? (statusColor[s] ?? C.GOLD) : C.PANEL,
                borderWidth: 1, borderColor: filterStatus === s ? (statusColor[s] ?? C.GOLD) : C.BORDER }}
            >
              <Text style={{ color: filterStatus === s ? '#fff' : C.GRAY, fontSize: 12 }}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {allItems.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 60, gap: 16 }}>
            <Text style={{ fontSize: 40 }}>📂</Text>
            <Text style={{ color: C.GRAY, fontSize: 14 }}>暂无优化历史记录</Text>
          </View>
        )}

        {allItems.map(({ report, sg }) => (
          <Pressable cssInterop={false}
            key={`${report.id}-${sg.id}`}
            onPress={() => setSelected({ report, sg })}
            style={({ pressed }) => ({
              backgroundColor: pressed ? C.PANEL2 : C.PANEL,
              borderRadius: 14, padding: 14, gap: 10,
              borderWidth: 1.5,
              borderColor: sg.status === '已采纳' ? '#10B98140' : C.BORDER,
            })}
          >
            {/* 标签行 */}
            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <View style={{ backgroundColor: typeColor[report.type] + '30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: typeColor[report.type], fontSize: 11, fontWeight: 'bold' }}>{report.type}</Text>
              </View>
              <View style={{ backgroundColor: statusColor[sg.status] + '25', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: statusColor[sg.status], fontSize: 11 }}>{sg.status}</Text>
              </View>
            </View>

            {/* 标题 */}
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>{sg.title}</Text>

            {/* 摘要 */}
            <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }} numberOfLines={2}>{sg.detail}</Text>

            {/* 时间 */}
            <Text style={{ color: C.GRAY2, fontSize: 11 }}>报告日期：{formatDateTime(report.generatedAt)}</Text>

            {/* 效果追踪（已采纳时显示） */}
            {sg.status === '已采纳' && (
              <View style={{ backgroundColor: '#10B98115', borderRadius: 8, padding: 8 }}>
                <Text style={{ color: '#10B981', fontSize: 11, lineHeight: 17 }}>
                  ✅ 已采纳 · 预期效果：{sg.expectedEffect}
                </Text>
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>

      {/* 详情弹窗 */}
      <Modal visible={!!selected} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: C.BG, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '85%' }}>
            {selected && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>建议详情</Text>
                  <Pressable onPress={() => setSelected(null)} hitSlop={12}>
                    <Text style={{ color: C.GRAY, fontSize: 22 }}>✕</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ backgroundColor: typeColor[selected.report.type] + '30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: typeColor[selected.report.type], fontSize: 12 }}>{selected.report.type}</Text>
                  </View>
                  <View style={{ backgroundColor: statusColor[selected.sg.status] + '30', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: statusColor[selected.sg.status], fontSize: 12 }}>{selected.sg.status}</Text>
                  </View>
                </View>

                <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>{selected.sg.title}</Text>
                <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 21 }}>{selected.sg.detail}</Text>

                <View style={{ backgroundColor: C.PANEL, borderRadius: 10, padding: 12, gap: 4 }}>
                  <Text style={{ color: C.GOLD, fontSize: 12, fontWeight: 'bold' }}>💡 预期效果</Text>
                  <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 19 }}>{selected.sg.expectedEffect}</Text>
                </View>

                {selected.sg.status === '已采纳' && (
                  <View style={{ backgroundColor: '#10B98115', borderRadius: 10, padding: 12, gap: 4 }}>
                    <Text style={{ color: '#10B981', fontSize: 12, fontWeight: 'bold' }}>📋 秒哒修改指令</Text>
                    <Text selectable style={{ color: C.WHITE, fontSize: 12, lineHeight: 19 }}>{selected.sg.miaoInstruction}</Text>
                  </View>
                )}

                <Text style={{ color: C.GRAY2, fontSize: 11 }}>报告生成时间：{formatDateTime(selected.report.generatedAt)}</Text>

                <Pressable
                  onPress={() => setSelected(null)}
                  style={{ borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: C.PANEL, borderWidth: 1, borderColor: C.BORDER, marginTop: 4 }}
                >
                  <Text style={{ color: C.GRAY, fontSize: 14 }}>关闭</Text>
                </Pressable>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}
