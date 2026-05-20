/**
 * BrandSplash — 全屏品牌加载页
 * 展示 1.6 秒后通过动画过渡消失，让主页从下方滑入。
 * 若用户打开客服窗口，计时暂停；关闭客服后立即完成过渡。
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import AiCsModal from '@/components/AiCsModal';
import { getConfig } from '@/lib/appStore';

interface Props {
  onDone: () => void;
}

export default function BrandSplash({ onDone }: Props) {
  const breatheAnim = useRef(new Animated.Value(1)).current;
  const overlayOpacity = useRef(new Animated.Value(1)).current;
  const overlayScale = useRef(new Animated.Value(1)).current;
  const breatheLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 是否已触发过渡（防止重复执行）
  const doneCalledRef = useRef(false);
  // 客服弹窗打开时暂停自动跳转
  const [showCs, setShowCs] = useState(false);
  const chatOpenedRef = useRef(false);

  // 读取客服配置
  const cfg = getConfig();
  const showCsBtn = cfg.csMode === 'ai';
  const greeting = cfg.csGreeting;

  const triggerExit = () => {
    if (doneCalledRef.current) return;
    doneCalledRef.current = true;
    Animated.parallel([
      Animated.timing(overlayOpacity, {
        toValue: 0,
        duration: 380,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(overlayScale, {
        toValue: 0.92,
        duration: 380,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      breatheLoopRef.current?.stop();
      onDone();
    });
  };

  useEffect(() => {
    // 呼吸灯循环
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, {
          toValue: 1.08, duration: 900,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(breatheAnim, {
          toValue: 1, duration: 900,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ]),
    );
    breatheLoopRef.current = loop;
    loop.start();

    // 1.6 秒后自动过渡（若客服已打开则不触发）
    timerRef.current = setTimeout(() => {
      if (!chatOpenedRef.current) triggerExit();
    }, 1600);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      loop.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenCs = () => {
    chatOpenedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowCs(true);
  };

  const handleCloseCs = () => {
    setShowCs(false);
    // 关闭客服后立即过渡到主页
    triggerExit();
  };

  return (
    <Animated.View
      style={{
        position: 'absolute', inset: 0, zIndex: 9999,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#0D1929',
        opacity: overlayOpacity,
        transform: [{ scale: overlayScale }],
      }}
      pointerEvents={doneCalledRef.current ? 'none' : 'auto'}
    >
      {/* 渐变遮罩层 */}
      <View
        style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg,#0D1929 0%,#141820 100%)',
        } as never}
      />

      {/* 盾牌图标 - 呼吸灯 */}
      <Animated.View style={{ transform: [{ scale: breatheAnim }], marginBottom: 24 }}>
        <Image
          source={{ uri: '/assets/icon.png' }}
          style={{ width: 96, height: 96, borderRadius: 22 }}
          contentFit="contain"
        />
      </Animated.View>

      {/* App 名称 */}
      <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 'bold', letterSpacing: 2, marginBottom: 8 }}>
        牌局环境守护
      </Text>

      {/* 副标题 */}
      <Text style={{ color: 'rgba(180,195,220,0.8)', fontSize: 13, letterSpacing: 1, marginBottom: 40 }}>
        手机环境健康度检测工具
      </Text>

      {/* 客服按钮（仅 AI 模式时显示） */}
      {showCsBtn && (
        <Pressable cssInterop={false}
          onPress={handleOpenCs}
          style={({ pressed }) => ({
            borderWidth: 1,
            borderColor: pressed ? 'rgba(80,140,255,0.9)' : 'rgba(60,110,220,0.55)',
            backgroundColor: pressed ? 'rgba(40,80,200,0.25)' : 'rgba(20,50,150,0.18)',
            borderRadius: 22, paddingVertical: 9, paddingHorizontal: 28,
          })}
        >
          <Text style={{ color: 'rgba(140,180,255,0.9)', fontSize: 13 }}>💬 咨询客服</Text>
        </Pressable>
      )}

      {/* 底部极小文字 */}
      <Text style={{
        position: 'absolute', bottom: 48,
        color: 'rgba(120,140,170,0.5)', fontSize: 11, letterSpacing: 1.5,
      }}>
        安全护航 · 安心每一局
      </Text>

      {/* AI 客服弹窗 */}
      <AiCsModal visible={showCs} onClose={handleCloseCs} greeting={greeting} />
    </Animated.View>
  );
}
