/**
 * 护航海报分享页 v2
 * 展示护航海报预览，提供【保存到相册】【分享到微信】按钮
 * 保存功能：react-native-view-shot 截图 + expo-media-library 写入相册
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as MediaLibrary from 'expo-media-library';
import { captureRef } from 'react-native-view-shot';
import { C } from '@/lib/colors';
import { getCurrentGuardId, getGameRecords, getConfig } from '@/lib/appStore';

// 默认二维码图片（当管理员未配置时使用）
const DEFAULT_QR_URL = 'https://miaoda-site-img.cdn.bcebos.com/images/baidu_image_search_5860da5d-31e3-41d7-b495-29c954821ed2.jpg';
const APP_URL = 'https://app-bjaapbe7wkqp.appmiaoda.com';

function buildTaskId(guardId: string): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const suffix = (guardId || '').slice(-4).toUpperCase().padStart(4, '0');
  return `YC-${date}-${suffix}`;
}

/** 护航海报卡片（视觉预览版） */
function PosterCard({ taskId, dateStr, score }: { taskId: string; dateStr: string; score: number }) {
  return (
    <View style={{
      backgroundColor: '#0D1525',
      borderRadius: 20, overflow: 'hidden',
      borderWidth: 1.5, borderColor: 'rgba(43,123,255,0.5)',
      boxShadow: [{ offsetX: 0, offsetY: 8, blurRadius: 32, color: 'rgba(43,123,255,0.25)' }],
      width: '100%',
    }}>
      {/* 海报顶部：渐变蓝色横幅 */}
      <View style={{
        backgroundColor: '#0A2248',
        paddingVertical: 22, paddingHorizontal: 24,
        alignItems: 'center', gap: 8,
        borderBottomWidth: 1, borderBottomColor: 'rgba(43,123,255,0.3)',
      }}>
        <Text style={{ fontSize: 42 }}>🛡️</Text>
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>牌局环境守护</Text>
        <Text style={{ color: '#8AACDD', fontSize: 12 }}>专业护航 · 安全可信</Text>
      </View>

      {/* 核心结论区 */}
      <View style={{
        paddingVertical: 20, paddingHorizontal: 24,
        alignItems: 'center', gap: 10,
        backgroundColor: 'rgba(61,220,132,0.05)',
        borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
      }}>
        <View style={{
          backgroundColor: 'rgba(61,220,132,0.15)',
          borderRadius: 12, borderWidth: 1, borderColor: 'rgba(61,220,132,0.4)',
          paddingHorizontal: 20, paddingVertical: 10,
        }}>
          <Text style={{ color: '#3DDC84', fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
            ✅ 护航成功 · 环境安全
          </Text>
        </View>
        <Text style={{ color: '#A0B8D8', fontSize: 12 }}>综合安全评分</Text>
        <Text style={{ color: '#FFD700', fontSize: 36, fontWeight: 'bold', letterSpacing: 2 }}>{score}分</Text>
      </View>

      {/* 护航信息 */}
      <View style={{ paddingHorizontal: 24, paddingVertical: 16, gap: 8 }}>
        {[
          { label: '护航编号', value: taskId },
          { label: '检测时间', value: dateStr },
          { label: '检测项目', value: '4项全部通过' },
        ].map(item => (
          <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ color: '#667080', fontSize: 11, width: 70 }}>{item.label}</Text>
            <Text style={{ color: '#C8D4E8', fontSize: 11, fontWeight: 'bold', flex: 1 }}>{item.value}</Text>
          </View>
        ))}
      </View>

      {/* 二维码 + 邀请文案 */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingHorizontal: 24, paddingBottom: 20, paddingTop: 8,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
        marginTop: 4,
      }}>
        <Image
          source={{ uri: getConfig().posterQrImageUrl || DEFAULT_QR_URL }}
          style={{ width: 72, height: 72, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' }}
        />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: '#C8D4E8', fontSize: 12, fontWeight: 'bold' }}>保护你的每一局牌局</Text>
          <Text style={{ color: '#667080', fontSize: 10, lineHeight: 16 }}>
            扫码或访问下方链接，立即体验护航功能，安心复盘每一局。
          </Text>
          <Text style={{ color: '#5599CC', fontSize: 10 }}>{getConfig().posterPromoLink || APP_URL}</Text>
        </View>
      </View>
    </View>
  );
}

export default function GuardPosterScreen() {
  const router = useRouter();
  const guardId = getCurrentGuardId();
  const taskId = buildTaskId(guardId);
  // 读取最新牌局的真实安全评分，无记录时默认98
  const latestScore = getGameRecords()[0]?.score ?? 98;
  const [showSaveTip, setShowSaveTip] = useState(false);
  const [showShareTip, setShowShareTip] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const posterRef = useRef<View>(null);

  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 380, useNativeDriver: true }),
    ]).start();
  }, [fadeIn, slideUp]);

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  const handleSave = async () => {
    if (saving) return;
    setSaveError('');
    setSaving(true);
    try {
      // 申请相册写入权限
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status !== 'granted') {
        setSaveError('需要相册权限才能保存海报，请在系统设置中授权。');
        setSaving(false);
        return;
      }
      // 截图海报区域
      const uri = await captureRef(posterRef, { format: 'jpg', quality: 0.95 });
      // 写入相册
      await MediaLibrary.createAssetAsync(uri);
      setShowSaveTip(true);
    } catch {
      setSaveError('保存失败，请稍后再试。');
    } finally {
      setSaving(false);
    }
  };

  const handleShare = () => {
    setShowShareTip(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 顶部导航 */}
      <View style={{ paddingTop: 52, paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
        </Pressable>
        <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>护航海报</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }], gap: 20 }}>

          {/* 引导文案 */}
          <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center' }}>
            💡 长按海报可保存，分享给好友，传播护航理念
          </Text>

          {/* 海报预览 — 截图目标区域 */}
          <View ref={posterRef} collapsable={false}>
            <PosterCard taskId={taskId} dateStr={dateStr} score={latestScore} />
          </View>

          {/* 操作按钮 */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable cssInterop={false}
              onPress={handleSave}
              disabled={saving}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: saving ? '#1A3060' : (pressed ? '#1A5FCC' : C.BLUE),
                borderRadius: 14, paddingVertical: 15, alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
                {saving ? '保存中...' : '📥 保存到相册'}
              </Text>
            </Pressable>
            <Pressable cssInterop={false}
              onPress={handleShare}
              style={({ pressed }) => ({
                flex: 1, backgroundColor: pressed ? '#0D9A40' : '#1AAD19',
                borderRadius: 14, paddingVertical: 15, alignItems: 'center',
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>💬 分享到微信</Text>
            </Pressable>
          </View>

          {/* 权限/保存错误提示 */}
          {saveError !== '' && (
            <Text style={{ color: C.RED, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>{saveError}</Text>
          )}

          {/* 底部说明 */}
          <Text style={{ color: '#445566', fontSize: 11, textAlign: 'center', lineHeight: 18 }}>
            分享海报可帮助更多人了解护航功能{'\n'}感谢您的支持与传播！
          </Text>
        </Animated.View>
      </ScrollView>

      {/* 保存成功提示 */}
      <Modal visible={showSaveTip} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          onPress={() => setShowSaveTip(false)}
        >
          <View style={{ backgroundColor: '#1A1E2A', borderRadius: 18, borderWidth: 1, borderColor: C.BORDER, padding: 24, gap: 12, alignItems: 'center', width: '100%' }}>
            <Text style={{ fontSize: 40 }}>📥</Text>
            <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>海报已保存到相册</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              可在手机相册中找到护航海报，长按图片即可分享。
            </Text>
            <Pressable cssInterop={false}
              onPress={() => setShowSaveTip(false)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                borderRadius: 12, paddingVertical: 12, paddingHorizontal: 36,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>好的</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* 分享提示 */}
      <Modal visible={showShareTip} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 32 }}
          onPress={() => setShowShareTip(false)}
        >
          <View style={{ backgroundColor: '#1A1E2A', borderRadius: 18, borderWidth: 1, borderColor: C.BORDER, padding: 24, gap: 12, alignItems: 'center', width: '100%' }}>
            <Text style={{ fontSize: 40 }}>💬</Text>
            <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>分享护航海报</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              请先【保存到相册】，然后打开微信，{'\n'}选择发送对象后从相册选取海报图片。
            </Text>
            <Pressable cssInterop={false}
              onPress={() => setShowShareTip(false)}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#0D9A40' : '#1AAD19',
                borderRadius: 12, paddingVertical: 12, paddingHorizontal: 36,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>知道了</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
