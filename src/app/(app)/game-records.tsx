/**
 * 牌局记录本 v8
 * 修改四：点击展开详情（分隔线/表格/检测编号/四项/评分/时长/备注）
 */
import { useCallback, useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  formatDateTime, getGameRecords, isMemberActive, getMemberExpireTime,
  updateGameRecordResult,
} from '@/lib/appStore';
import type { GameRecord } from '@/lib/appStore';

const RESULT_OPTIONS: Array<GameRecord['result']> = ['赢', '输', '平'];
const RESULT_COLOR: Record<string, string> = { 赢: '#29C470', 输: C.RED, 平: C.GRAY };

// ── 分隔线 ────────────────────────────────────────────────
function Divider() {
  return (
    <View style={{ height: 1, backgroundColor: C.BORDER, marginVertical: 8 }}>
      {/* 模拟"━━━━"视觉效果 */}
    </View>
  );
}

// ── 表格行 ────────────────────────────────────────────────
function TableRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
      <Text style={{ color: C.GRAY, fontSize: 12, flex: 1 }}>{label}</Text>
      <Text style={{ color: valueColor ?? C.BLUE, fontSize: 12, fontWeight: 'bold', textAlign: 'right' }}>
        {value}
      </Text>
    </View>
  );
}

// ── 展开详情区 ────────────────────────────────────────────
function RecordDetail({ record }: { record: GameRecord }) {
  const detectItems = record.detectItems ?? [
    { icon: '🛡', label: '多开/分身检测', result: '通过' },
    { icon: '🔒', label: '异常辅助工具', result: '未发现' },
    { icon: '👁', label: '异常行为检测', result: '正常' },
    { icon: '⊞', label: '牌局环境安全', result: '通过' },
  ];
  const durationSec = record.guardDuration ?? 0;
  const durationStr = durationSec > 0
    ? `${Math.floor(durationSec / 60)}分钟`
    : '—';
  const resultStr = record.result ?? '未备注';
  const resultColor = record.result ? (RESULT_COLOR[record.result] ?? C.WHITE) : C.GRAY2;

  return (
    <View style={{ marginTop: 12 }}>
      <Divider />

      {/* 检测编号 & 时间 */}
      <View style={{ gap: 3, marginBottom: 4 }}>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Text style={{ color: C.GRAY2, fontSize: 11 }}>检测编号：</Text>
          <Text style={{ color: C.WHITE, fontSize: 11, fontFamily: 'monospace', flex: 1 }}>
            {record.detectId || '—'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Text style={{ color: C.GRAY2, fontSize: 11 }}>检测时间：</Text>
          <Text style={{ color: C.WHITE, fontSize: 11 }}>{formatDateTime(record.timestamp)}</Text>
        </View>
      </View>

      <Divider />

      {/* 检测项目表格 */}
      <View style={{ gap: 0 }}>
        {/* 表头 */}
        <View style={{ flexDirection: 'row', paddingVertical: 3 }}>
          <Text style={{ color: C.GRAY2, fontSize: 11, flex: 1 }}>检测项</Text>
          <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'right' }}>结果</Text>
        </View>
        {detectItems.map((item, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4, borderTopWidth: i === 0 ? 0 : 1, borderTopColor: `${C.BORDER}80` }}>
            <Text style={{ fontSize: 12, marginRight: 5 }}>{item.icon}</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, flex: 1 }}>{item.label}</Text>
            <View style={{ backgroundColor: `${C.BLUE}15`, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ color: C.BLUE, fontSize: 11, fontWeight: 'bold' }}>✅ {item.result}</Text>
            </View>
          </View>
        ))}
      </View>

      <Divider />

      {/* 底部统计 */}
      <View style={{ gap: 2 }}>
        <TableRow label="环境评分" value={`${record.score}分`} valueColor={C.BLUE} />
        <TableRow label="守护时长" value={durationStr} valueColor={C.WHITE} />
        <TableRow label="用户备注" value={resultStr} valueColor={resultColor} />
      </View>

      {/* 修改五：验证引导小字 */}
      <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center', marginTop: 8 }}>
        检测记录已同步保存，如需验证可联系客服查询检测日志
      </Text>
    </View>
  );
}

// ── 主页面 ────────────────────────────────────────────────
export default function GameRecordsScreen() {
  const router = useRouter();
  const [records, setRecords] = useState<GameRecord[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const memberLocked = getMemberExpireTime() !== null && !isMemberActive();

  useFocusEffect(useCallback(() => {
    setRecords(getGameRecords());
  }, []));

  const handleResult = (id: string, result: GameRecord['result']) => {
    updateGameRecordResult(id, result);
    setRecords(getGameRecords());
    setEditing(null);
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev === id ? null : id);
  };

  const annotated = records.filter(r => r.result !== null).length;

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 标题栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, paddingTop: 52 }}>
        <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
          <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>牌局守护记录</Text>
          <Text style={{ color: C.GRAY, fontSize: 10 }}>GAME RECORDS</Text>
        </View>
      </View>

      {/* 统计行 */}
      {records.length > 0 && (
        <View style={{ marginHorizontal: 20, marginBottom: 14, backgroundColor: C.PANEL, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 12, flexDirection: 'row', gap: 20 }}>
          <Text style={{ color: C.GRAY, fontSize: 12 }}>
            已守护 <Text style={{ color: C.WHITE, fontWeight: 'bold' }}>{records.length}</Text> 局
          </Text>
          <Text style={{ color: C.GRAY, fontSize: 12 }}>
            已备注 <Text style={{ color: C.WHITE, fontWeight: 'bold' }}>{annotated}</Text> 局
          </Text>
          <View style={{ flex: 1 }} />
          <Text style={{ color: C.GRAY2, fontSize: 11 }}>点击展开详情</Text>
        </View>
      )}

      {records.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 14 }}>
          <Text style={{ fontSize: 52 }}>📋</Text>
          <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>还没有牌局记录</Text>
          <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            点击「准备检测」开始记录您的每一场守护
          </Text>
          <Pressable cssInterop={false}
            onPress={() => router.replace('/(app)/(tabs)/home')}
            style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 8 })}
          >
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>前往开始守护</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 80, gap: 10 }}
          contentInsetAdjustmentBehavior="automatic"
          renderItem={({ item, index }) => {
            const isExpanded = expanded === item.id;
            return (
              <Pressable cssInterop={false}
                onPress={() => toggleExpand(item.id)}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? C.PANEL2 : (isExpanded ? C.PANEL2 : C.PANEL),
                  borderRadius: 12, borderWidth: 1,
                  borderColor: isExpanded ? `${C.BLUE}50` : C.BORDER,
                  padding: 14,
                })}
              >
                {/* 头部行 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  {/* 序号 */}
                  <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.BLUE_BG, borderWidth: 1, borderColor: `${C.BLUE}40`, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold' }}>{records.length - index}</Text>
                  </View>
                  {/* 时间/评分 */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold' }}>{formatDateTime(item.timestamp)}</Text>
                    <Text style={{ color: C.GRAY, fontSize: 11 }}>
                      已守护 · 评分 {item.score}分 · {item.passCount}/{item.totalCount} 通过
                    </Text>
                  </View>
                  {/* 结果标签 + 备注按钮 */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    {item.result ? (
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); setEditing(item.id); }}
                        style={{
                          backgroundColor: `${RESULT_COLOR[item.result]}20`,
                          borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5,
                          borderWidth: 1, borderColor: `${RESULT_COLOR[item.result]}60`,
                        }}
                      >
                        <Text style={{ color: RESULT_COLOR[item.result], fontSize: 14, fontWeight: 'bold' }}>{item.result}</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        onPress={(e) => { e.stopPropagation?.(); setEditing(item.id); }}
                        style={{ backgroundColor: C.PANEL2, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: C.BORDER }}
                      >
                        <Text style={{ color: C.GRAY2, fontSize: 11 }}>备注</Text>
                      </Pressable>
                    )}
                    <Text style={{ color: C.GRAY2, fontSize: 12 }}>{isExpanded ? '▲' : '▼'}</Text>
                  </View>
                </View>

                {/* 展开详情 */}
                {isExpanded && <RecordDetail record={item} />}
              </Pressable>
            );
          }}
        />
      )}

      {/* 结果选择弹窗 */}
      <Modal visible={editing !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setEditing(null)}
        >
          <View style={{ backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1, borderColor: C.BORDER, padding: 24, width: 260, gap: 16 }}>
            <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold', textAlign: 'center' }}>备注牌局结果</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {RESULT_OPTIONS.map(opt => (
                <Pressable cssInterop={false}
                  key={opt}
                  onPress={() => editing && handleResult(editing, opt)}
                  style={({ pressed }) => ({
                    flex: 1, paddingVertical: 14, borderRadius: 10, alignItems: 'center',
                    backgroundColor: pressed ? `${RESULT_COLOR[opt!] ?? C.BLUE}30` : `${RESULT_COLOR[opt!] ?? C.BLUE}15`,
                    borderWidth: 1.5, borderColor: `${RESULT_COLOR[opt!] ?? C.BLUE}70`,
                  })}
                >
                  <Text style={{ color: RESULT_COLOR[opt!] ?? C.BLUE, fontSize: 16, fontWeight: 'bold' }}>{opt}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => editing && handleResult(editing, null)}
              style={{ paddingVertical: 10, alignItems: 'center' }}
            >
              <Text style={{ color: C.GRAY2, fontSize: 12 }}>清除备注</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 会员到期提示条 */}
      {memberLocked && (
        <View style={{ position: 'absolute', bottom: 30, left: 20, right: 20 }}>
          <View style={{ backgroundColor: C.PANEL2, borderRadius: 12, borderWidth: 1, borderColor: `${C.RED}40`, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 18 }}>🔒</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, flex: 1 }}>会员已到期，记录已停止新增</Text>
            <Pressable onPress={() => router.push('/(app)/activation')} style={{ backgroundColor: C.BLUE, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>续费</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}
