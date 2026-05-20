/**
 * 护航通知横幅组件 v2
 * 从顶部滑入，自动消失
 * 可点击跳转目标路由（由父组件通过 onPress 回调控制）
 */
import { useEffect, useRef } from 'react';
import { Animated, Pressable, Text, View } from 'react-native';
import { C } from '@/lib/colors';
import type { GuardNotif } from '@/lib/guardNotifications';

interface Props {
  notif: GuardNotif | null;
  onDismiss: () => void;
  /** 点击通知时的回调（父组件负责路由跳转） */
  onPress?: (notif: GuardNotif) => void;
}

export default function GuardNotifBanner({ notif, onDismiss, onPress }: Props) {
  const slideY = useRef(new Animated.Value(-80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!notif) return;
    slideY.setValue(-80);
    opacity.setValue(0);
    // 滑入
    Animated.parallel([
      Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();

    // 可点击停留6秒；不可点击3.5秒自动消失
    const delay = notif.clickable ? 6000 : 3500;
    const t = setTimeout(() => dismiss(), delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notif]);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: -80, duration: 300, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => onDismiss());
  };

  const handlePress = () => {
    if (notif?.clickable && onPress) {
      onPress(notif);
    }
  };

  if (!notif) return null;

  return (
    <Animated.View style={{
      position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
      transform: [{ translateY: slideY }], opacity,
    }}>
      <Pressable onPress={handlePress} style={{ cursor: notif.clickable ? 'pointer' : 'default' } as object}>
        <View style={{
          marginHorizontal: 12, marginTop: 48,
          backgroundColor: '#1A2035', borderRadius: 14,
          borderWidth: 1, borderColor: notif.clickable ? C.GOLD : C.BLUE,
          paddingVertical: 12, paddingHorizontal: 16,
          flexDirection: 'row', alignItems: 'center', gap: 10,
          boxShadow: [{ offsetX: 0, offsetY: 4, blurRadius: 20, color: 'rgba(0,0,0,0.5)' }],
        }}>
          <Text style={{ fontSize: 20 }}>{notif.icon}</Text>
          <Text style={{ color: '#E8EFF8', fontSize: 12, flex: 1, lineHeight: 18 }}>
            {notif.message}
          </Text>
          {notif.clickable && (
            <View style={{ backgroundColor: C.GOLD, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#1A1200', fontSize: 10, fontWeight: 'bold' }}>查看</Text>
            </View>
          )}
          {!notif.clickable && (
            <Pressable onPress={dismiss} hitSlop={8}>
              <Text style={{ color: '#556', fontSize: 16 }}>×</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

