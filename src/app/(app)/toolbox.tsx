/**
 * 护航工具箱页面 v3
 * 悬浮窗功能保持"开发中"；新增"🔔 通知栏提醒"功能项，状态为"✅ 已开启"
 * 与管理员后台功能开关实时联动
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { getConfig } from '@/lib/appStore';

// 状态标签定义
const TAG_AVAILABLE = { label: '✅ 可用', color: '#29C470', bg: 'rgba(41,196,112,0.12)' };
const TAG_ENABLED   = { label: '✅ 已开启', color: '#29C470', bg: 'rgba(41,196,112,0.12)' };
const TAG_DEV = { label: '🚧 开发中', color: '#E07B36', bg: 'rgba(224,123,54,0.15)' };
const TAG_COMING = { label: '🔜 即将上线', color: C.BLUE, bg: 'rgba(43,123,255,0.12)' };

export default function ToolboxScreen() {
  const router = useRouter();
  const [showTip, setShowTip] = useState(false);
  const [flags, setFlags] = useState(() => {
    const cfg = getConfig();
    return {
      floatWindow: cfg.featureFloatWindow,
      pip: cfg.featurePip,
      autoUpdate: cfg.featureAutoUpdate,
      notification: cfg.featureNotification,
    };
  });

  // 每次进入页面重新读取开关状态（管理员改完后立即生效）
  useFocusEffect(useCallback(() => {
    const cfg = getConfig();
    setFlags({
      floatWindow: cfg.featureFloatWindow,
      pip: cfg.featurePip,
      autoUpdate: cfg.featureAutoUpdate,
      notification: cfg.featureNotification,
    });
  }, []));

  const features = [
    {
      emoji: '🍎',
      name: '苹果iOS版本',
      desc: '即将上架App Store，苹果用户可第一时间体验',
      tag: TAG_COMING,
    },
    {
      emoji: '🔔',
      name: '通知栏提醒',
      desc: '护航期间关键时间节点（如即将到期、检测完成）通过通知栏推送，和看短信一样方便',
      tag: flags.notification ? TAG_ENABLED : TAG_DEV,
    },
    {
      emoji: '🖥️',
      name: '游戏内悬浮窗',
      desc: '护航状态实时显示在游戏页面上方，无需切回App（功能开发中）',
      tag: TAG_DEV,
    },
    {
      emoji: '📹',
      name: '画中画护航',
      desc: '以小窗口形式悬浮在游戏角落，不遮挡操作',
      tag: flags.pip ? TAG_AVAILABLE : TAG_DEV,
    },
    {
      emoji: '📊',
      name: '对局详细报告',
      desc: '每局结束后自动生成完整护航分析报告',
      tag: TAG_COMING,
    },
    {
      emoji: '🔄',
      name: '自动更新',
      desc: '发现新版本后自动提示下载安装，保持最新防护',
      tag: flags.autoUpdate ? TAG_AVAILABLE : TAG_DEV,
    },
    {
      emoji: '🤖',
      name: 'AI牌局分析',
      desc: 'AI分析你的牌局数据，帮你总结规律',
      tag: TAG_DEV,
    },
  ];

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
          护航工具箱
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 16 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* 顶部引导文案 */}
        <View style={{
          backgroundColor: 'rgba(212,175,55,0.10)', borderRadius: 14,
          borderWidth: 1, borderColor: 'rgba(212,175,55,0.35)',
          padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10,
        }}>
          <Text style={{ fontSize: 20 }}>💎</Text>
          <Text style={{ color: C.GOLD, fontSize: 13, flex: 1, lineHeight: 20 }}>
            以下功能正在紧急开发中，开通会员可在上线后第一时间体验！
          </Text>
        </View>

        {/* 功能列表 */}
        {features.map(f => (
          <Pressable cssInterop={false}
            key={f.name}
            onPress={() => setShowTip(true)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? C.PANEL2 : C.PANEL,
              borderRadius: 14, borderWidth: 1, borderColor: C.BORDER,
              padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
            })}
          >
            <Text style={{ fontSize: 30 }}>{f.emoji}</Text>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>{f.name}</Text>
              <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>{f.desc}</Text>
            </View>
            <View style={{
              backgroundColor: f.tag.bg, borderRadius: 8,
              paddingHorizontal: 8, paddingVertical: 4,
            }}>
              <Text style={{ color: f.tag.color, fontSize: 11, fontWeight: 'bold' }}>
                {f.tag.label}
              </Text>
            </View>
          </Pressable>
        ))}

        {/* 底部会员引导 */}
        <View style={{
          marginTop: 8, backgroundColor: C.PANEL, borderRadius: 14,
          borderWidth: 1, borderColor: C.BORDER, padding: 18, gap: 12, alignItems: 'center',
        }}>
          <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold', textAlign: 'center' }}>
            💎 开通会员，所有功能上线后优先体验！
          </Text>
          <Pressable cssInterop={false}
            onPress={() => router.push('/(app)/activation' as never)}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#B8960A' : C.GOLD,
              borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32,
            })}
          >
            <Text style={{ color: '#0D0F12', fontSize: 14, fontWeight: 'bold' }}>
              立即开通会员
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* 开发中 / 已可用 提示弹窗 */}
      <Modal visible={showTip} transparent animationType="fade">
        <View style={{
          flex: 1, backgroundColor: 'rgba(0,0,0,0.7)',
          alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 20,
            borderWidth: 1.5, borderColor: C.GOLD,
            padding: 28, alignItems: 'center', gap: 16, width: '100%',
          }}>
            <Text style={{ fontSize: 44 }}>🚧</Text>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              功能开发中
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 22 }}>
              该功能正在紧急开发中{'\n'}开通会员可在上线后第一时间体验！
            </Text>
            <Pressable cssInterop={false}
              onPress={() => setShowTip(false)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                borderRadius: 12, paddingVertical: 12, paddingHorizontal: 40,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>知道了</Text>
            </Pressable>
            <Pressable onPress={() => { setShowTip(false); router.push('/(app)/activation' as never); }}>
              <Text style={{ color: C.GOLD, fontSize: 13 }}>💎 开通会员，优先体验</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
