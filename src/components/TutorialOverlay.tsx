/**
 * TutorialOverlay — 六步可视化遮罩引导系统
 * 半透明黑色遮罩 + 金色光晕高亮 + 气泡提示
 * 每步仅首次触发，点击遮罩或跳过均永久不再显示
 */
import { useEffect, useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { C } from '@/lib/colors';
import { isTutorialStepDone, markTutorialStep, skipAllTutorial, type TutorialStepKey } from '@/lib/appStore';

export interface TutorialConfig {
  step: TutorialStepKey;
  title: string;
  body: string;
  /** 主动作按钮文字 */
  actionLabel: string;
  /** 第二按钮（可选，如"残忍离开" / "稍后再说"） */
  cancelLabel?: string;
  onAction: () => void;
  onCancel?: () => void;
  /** 触发此步骤（调用方控制是否 visible） */
  visible: boolean;
}

/**
 * 单步引导遮罩
 * 调用方只需传入 TutorialConfig；已完成/跳过的步骤自动不显示
 */
export default function TutorialOverlay({ config }: { config: TutorialConfig }) {
  const { step, title, body, actionLabel, cancelLabel, onAction, onCancel, visible } = config;

  // 已完成则不显示
  if (!visible || isTutorialStepDone(step)) return null;

  return (
    <TutorialModal
      step={step}
      title={title}
      body={body}
      actionLabel={actionLabel}
      cancelLabel={cancelLabel}
      onAction={() => { markTutorialStep(step); onAction(); }}
      onCancel={() => { skipAllTutorial(); onCancel?.(); }}
    />
  );
}

function TutorialModal({
  step, title, body, actionLabel, cancelLabel, onAction, onCancel,
}: {
  step: TutorialStepKey;
  title: string;
  body: string;
  actionLabel: string;
  cancelLabel?: string;
  onAction: () => void;
  onCancel: () => void;
}) {
  // 金色光晕脉冲
  const glowAnim = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(glowAnim, { toValue: 0.6, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [glowAnim]);

  // 气泡滑入动画
  const slideAnim = useRef(new Animated.Value(30)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, [slideAnim, fadeAnim]);

  // 步骤色
  const STEP_ICONS: Record<TutorialStepKey, string> = {
    step1: '🛡️', step2: '🪟', step3: '📡', step4: '📊', step5: '💎', step6: '🏆',
  };
  const icon = STEP_ICONS[step];

  return (
    <Modal visible transparent animationType="none">
      {/* 遮罩背景 — 点击跳过全套引导 */}
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.78)', alignItems: 'center', justifyContent: 'center' }}
        onPress={onCancel}
      >
        {/* 阻止气泡区域的点击冒泡到遮罩 */}
        <Pressable onPress={() => {}} style={{ width: '88%' }}>
          <Animated.View style={{
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          }}>
            {/* 金色光晕高亮框 */}
            <Animated.View style={{
              borderRadius: 22,
              padding: 2,
              opacity: glowAnim,
              borderWidth: 2,
              borderColor: C.GOLD,
              boxShadow: `0 0 24px ${C.GOLD}`,
            }}>
              {/* 气泡主体 */}
              <View style={{
                backgroundColor: C.PANEL, borderRadius: 20,
                padding: 24, gap: 18, alignItems: 'center',
              }}>
                {/* 步骤图标 + 标题 */}
                <View style={{ alignItems: 'center', gap: 8 }}>
                  <View style={{
                    width: 60, height: 60, borderRadius: 30,
                    backgroundColor: `${C.GOLD}18`, borderWidth: 2, borderColor: `${C.GOLD}60`,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 28 }}>{icon}</Text>
                  </View>
                  <Text style={{ color: C.GOLD, fontSize: 11, fontWeight: 'bold', letterSpacing: 1 }}>
                    引导提示
                  </Text>
                  <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold', textAlign: 'center' }}>
                    {title}
                  </Text>
                </View>

                {/* 正文 */}
                <View style={{
                  backgroundColor: C.PANEL2, borderRadius: 12,
                  padding: 14, width: '100%',
                  borderWidth: 1, borderColor: `${C.GOLD}30`,
                }}>
                  <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 21, textAlign: 'center' }}>
                    {body}
                  </Text>
                </View>

                {/* 按钮区 */}
                {cancelLabel ? (
                  // 双按钮布局（step5 / step6）
                  <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                    <Pressable cssInterop={false}
                      onPress={onCancel}
                      style={({ pressed }) => ({
                        flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                        borderWidth: 1, borderColor: C.BORDER,
                        backgroundColor: pressed ? C.PANEL2 : 'transparent',
                      })}
                    >
                      <Text style={{ color: C.GRAY, fontSize: 13, fontWeight: 'bold' }}>{cancelLabel}</Text>
                    </Pressable>
                    <Pressable cssInterop={false}
                      onPress={onAction}
                      style={({ pressed }) => ({
                        flex: 1.8, borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                        backgroundColor: pressed ? '#B8961E' : C.GOLD,
                        boxShadow: `0 0 12px ${C.GOLD}60`,
                      })}
                    >
                      <Text style={{ color: '#1A1200', fontSize: 13, fontWeight: 'bold' }}>{actionLabel}</Text>
                    </Pressable>
                  </View>
                ) : (
                  // 单按钮布局
                  <Pressable cssInterop={false}
                    onPress={onAction}
                    style={({ pressed }) => ({
                      width: '100%', borderRadius: 14, paddingVertical: 15, alignItems: 'center',
                      backgroundColor: pressed ? '#B8961E' : C.GOLD,
                      boxShadow: `0 0 14px ${C.GOLD}60`,
                    })}
                  >
                    <Text style={{ color: '#1A1200', fontSize: 14, fontWeight: 'bold' }}>{actionLabel}</Text>
                  </Pressable>
                )}

                {/* 跳过提示 */}
                <Pressable onPress={onCancel}>
                  <Text style={{ color: C.GRAY2, fontSize: 11 }}>点击遮罩区域可跳过所有引导</Text>
                </Pressable>
              </View>
            </Animated.View>
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
