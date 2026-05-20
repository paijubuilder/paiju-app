/**
 * 代理介绍页 v1
 * 标题：🏆 加入代理，赚取收益
 * 三大卖点卡片 + 底部按钮进入代理升级页
 */
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';

const BENEFITS = [
  {
    emoji: '💰',
    title: '自主定价，赚取差价',
    desc: '以专属代理价拿货，在平台规定上限内自由加价，差价收益全归您。',
    color: C.GOLD,
    bg: 'rgba(212,175,55,0.10)',
    border: 'rgba(212,175,55,0.4)',
  },
  {
    emoji: '🤖',
    title: 'AI智能助手，销售更轻松',
    desc: '高级代理专享AI自动回复客户，自动生成推广文案，睡觉也能卖卡。',
    color: C.BLUE,
    bg: 'rgba(43,123,255,0.10)',
    border: 'rgba(43,123,255,0.4)',
  },
  {
    emoji: '📊',
    title: '三级晋升，成本越低',
    desc: '从初级到高级，拿货成本递减，加价空间递增，收益持续放大。',
    color: '#29C470',
    bg: 'rgba(41,196,112,0.10)',
    border: 'rgba(41,196,112,0.4)',
  },
];

export default function AgentIntroScreen() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 顶部导航 */}
      <View style={{
        paddingTop: 52, paddingBottom: 14, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', gap: 12,
        borderBottomWidth: 1, borderBottomColor: C.BORDER,
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
        </Pressable>
        <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', flex: 1 }}>
          代理计划
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: 48, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* 大标题 */}
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text style={{ fontSize: 52 }}>🏆</Text>
          <Text style={{ color: C.WHITE, fontSize: 24, fontWeight: 'bold', textAlign: 'center' }}>
            加入代理，赚取收益
          </Text>
          <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
            无需技术背景，只需推广链接{'\n'}轻松赚取每笔差价收益
          </Text>
        </View>

        {/* 三大卖点卡片 */}
        {BENEFITS.map(b => (
          <View
            key={b.title}
            style={{
              backgroundColor: b.bg, borderRadius: 16,
              borderWidth: 1.5, borderColor: b.border,
              padding: 20, flexDirection: 'row', gap: 16, alignItems: 'flex-start',
            }}
          >
            <Text style={{ fontSize: 36 }}>{b.emoji}</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: b.color, fontSize: 15, fontWeight: 'bold' }}>{b.title}</Text>
              <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>{b.desc}</Text>
            </View>
          </View>
        ))}

        {/* 简单数据展示 */}
        <View style={{
          backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1,
          borderColor: C.BORDER, padding: 18, gap: 12,
        }}>
          <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold', marginBottom: 4 }}>
            代理收益参考
          </Text>
          {[
            { rank: '🥉 初级代理', cost: '专属代理价拿货', markup: '平台规定上限内加价' },
            { rank: '🥈 中级代理', cost: '更低的拿货成本', markup: '更高加价空间' },
            { rank: '🥇 高级代理', cost: '超低拿货成本', markup: '最高加价自由 + AI助手' },
          ].map(row => (
            <View key={row.rank} style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: C.PANEL2, borderRadius: 10, padding: 12, gap: 8,
            }}>
              <Text style={{ color: C.WHITE, fontSize: 12, width: 80 }}>{row.rank}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>{row.cost}</Text>
                <Text style={{ color: C.GOLD, fontSize: 11 }}>{row.markup}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* 底部进入按钮 */}
        <Pressable cssInterop={false}
          onPress={() => router.push('/(app)/agent-upgrade' as never)}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#B8960A' : C.GOLD,
            borderRadius: 16, paddingVertical: 16, alignItems: 'center',
            marginTop: 8,
            boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 16, color: 'rgba(212,175,55,0.4)' }],
          })}
        >
          <Text style={{ color: '#0D0F12', fontSize: 16, fontWeight: 'bold' }}>
            🏆 了解代理方案，立即开通
          </Text>
        </Pressable>

        <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center' }}>
          代理收益来源于合法的价格差，无拉人头返佣
        </Text>
      </ScrollView>
    </View>
  );
}
