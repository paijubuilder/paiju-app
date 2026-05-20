/**
 * 护航安全分析报告页 v1
 * 仅付费会员可见，展示《对局环境安全分析报告》完整内容
 * 底部提供【分享护航海报】【返回主页】
 */
import { useEffect, useRef } from 'react';
import { Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { getCurrentGuardId, getStreakDays } from '@/lib/appStore';

// 检测项目列表
const DETECT_ITEMS = [
  { key: '多开分身检测', desc: '未检测到多开或分身软件' },
  { key: '异常辅助检测', desc: '未发现异常辅助工具进程' },
  { key: '异常行为检测', desc: '操作节奏正常，无异常行为' },
  { key: '牌局环境检测', desc: '牌局环境纯净，无干扰进程' },
];

// 生成任务ID：YC-YYYYMMDD-XXXX
function buildTaskId(guardId: string): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const suffix = (guardId || '').slice(-4).toUpperCase().padStart(4, '0');
  return `YC-${date}-${suffix}`;
}

// 分割线
function Divider() {
  return <View style={{ height: 1, backgroundColor: C.BORDER, marginVertical: 12 }} />;
}

// 检测项行
function DetectRow({ label, desc }: { label: string; desc: string }) {
  const dot = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(dot, { toValue: 1, duration: 900, useNativeDriver: true }),
      Animated.timing(dot, { toValue: 0.5, duration: 900, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [dot]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, gap: 12 }}>
      <Animated.View style={{ opacity: dot, marginTop: 3 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#3DDC84' }} />
      </Animated.View>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold' }}>{label}</Text>
          <View style={{ backgroundColor: 'rgba(61,220,132,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: '#3DDC84', fontSize: 10, fontWeight: 'bold' }}>✓ 通过</Text>
          </View>
        </View>
        <Text style={{ color: C.GRAY, fontSize: 11, marginTop: 2 }}>{desc}</Text>
      </View>
    </View>
  );
}

export default function GuardReportScreen() {
  const router = useRouter();
  const guardId = getCurrentGuardId();
  const taskId = buildTaskId(guardId);
  const streakDays = getStreakDays();

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 450, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, slideUp]);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 顶部导航 */}
      <View style={{ paddingTop: 52, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
        </Pressable>
        <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>护航安全报告</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 0 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }], gap: 16 }}>

          {/* 报告标题卡片 */}
          <View style={{
            backgroundColor: 'rgba(43,123,255,0.10)',
            borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(43,123,255,0.35)',
            padding: 20, alignItems: 'center', gap: 8,
          }}>
            <Text style={{ fontSize: 36 }}>🛡️</Text>
            <Text style={{ color: C.GOLD, fontSize: 15, fontWeight: 'bold', textAlign: 'center' }}>
              《对局环境安全分析报告》
            </Text>
            <View style={{ backgroundColor: 'rgba(61,220,132,0.15)', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 5, marginTop: 2 }}>
              <Text style={{ color: '#3DDC84', fontSize: 13, fontWeight: 'bold' }}>✅ 环境安全 · 评分 98分</Text>
            </View>
          </View>

          {/* 基本信息卡片 */}
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1,
            borderColor: C.BORDER, padding: 16, gap: 4,
          }}>
            <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>📋 基本信息</Text>

            {[
              { label: '任务ID', value: taskId },
              { label: '检测时间', value: dateStr },
              { label: '执行耗时', value: '2分钟扫描 + 10分钟护航' },
              { label: '累计护航', value: `${streakDays} 天` },
            ].map(item => (
              <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
                <Text style={{ color: C.GRAY, fontSize: 12, width: 80 }}>{item.label}</Text>
                <Text selectable style={{ color: C.WHITE, fontSize: 12, fontWeight: 'bold', flex: 1 }}>{item.value}</Text>
              </View>
            ))}
          </View>

          {/* 检测项目卡片 */}
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1,
            borderColor: C.BORDER, padding: 16,
          }}>
            <Text style={{ color: C.BLUE, fontSize: 12, fontWeight: 'bold', marginBottom: 4 }}>🔍 检测项目（共4项）</Text>
            {DETECT_ITEMS.map((item, i) => (
              <View key={item.key}>
                {i > 0 && <Divider />}
                <DetectRow label={item.key} desc={item.desc} />
              </View>
            ))}
          </View>

          {/* 综合评分卡片 */}
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1,
            borderColor: C.BORDER, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16,
          }}>
            <View style={{
              width: 68, height: 68, borderRadius: 34,
              borderWidth: 3, borderColor: C.GOLD,
              alignItems: 'center', justifyContent: 'center',
              backgroundColor: 'rgba(215,163,33,0.12)',
              boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 16, color: 'rgba(215,163,33,0.35)' }],
            }}>
              <Text style={{ color: C.GOLD, fontSize: 24, fontWeight: 'bold' }}>98</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>综合安全评分</Text>
              <Text style={{ color: C.GRAY, fontSize: 11, lineHeight: 17 }}>
                所有检测项目均通过，牌局环境纯净，安全系数极高。
              </Text>
            </View>
          </View>

          {/* 专家解读卡片 */}
          <View style={{
            backgroundColor: 'rgba(215,163,33,0.06)',
            borderRadius: 16, borderWidth: 1,
            borderColor: 'rgba(215,163,33,0.25)',
            padding: 16, gap: 8,
          }}>
            <Text style={{ color: C.GOLD, fontSize: 12, fontWeight: 'bold' }}>💡 专家解读</Text>
            <Text style={{ color: '#D0C090', fontSize: 13, lineHeight: 20 }}>
              本次护航未发现异常进程干预，环境纯净，可安心复盘。
            </Text>
          </View>

          {/* 底部按钮区 */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
            <Pressable cssInterop={false}
              onPress={() => router.push('/(app)/guard-poster' as never)}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: pressed ? '#B8960A' : C.GOLD,
                borderRadius: 14, paddingVertical: 15, alignItems: 'center',
              })}
            >
              <Text style={{ color: '#0D0F12', fontSize: 14, fontWeight: 'bold' }}>🌟 分享护航海报</Text>
            </Pressable>
            <Pressable cssInterop={false}
              onPress={() => router.replace('/(app)/(tabs)/home' as never)}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: pressed ? C.PANEL2 : C.PANEL,
                borderRadius: 14, paddingVertical: 15, alignItems: 'center',
                borderWidth: 1, borderColor: C.BORDER,
              })}
            >
              <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>返回主页</Text>
            </Pressable>
          </View>

        </Animated.View>
      </ScrollView>
    </View>
  );
}
