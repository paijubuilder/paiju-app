/**
 * 微信快捷登录弹窗 — 付费绑定会员权益时触发
 * 绿色微信风格，支持微信一键登录和手机号登录两种方式
 */
import { useRef, useEffect, useState } from 'react';
import { Animated, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { C } from '@/lib/colors';
import { bindWechat, isWechatBound } from '@/lib/appStore';

interface WechatLoginModalProps {
  visible: boolean;
  onSuccess: () => void;   // 登录/绑定成功后继续支付
  onSkip: () => void;      // 稍后再说，关闭弹窗
}

export default function WechatLoginModal({ visible, onSuccess, onSkip }: WechatLoginModalProps) {
  const [mode, setMode] = useState<'main' | 'phone'>('main');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  const slideAnim = useRef(new Animated.Value(200)).current;

  useEffect(() => {
    if (visible) {
      setMode('main');
      setErrorMsg('');
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 65, friction: 9 }).start();
    } else {
      slideAnim.setValue(200);
    }
  }, [visible, slideAnim]);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // 如果已绑定微信，直接回调成功
  if (isWechatBound()) {
    return null;
  }

  const handleWechatLogin = () => {
    // 模拟微信授权：实际接入微信SDK
    const nickname = '牌友_' + Math.floor(Math.random() * 9000 + 1000);
    bindWechat(nickname);
    onSuccess();
  };

  const handleSendCode = () => {
    if (phone.length < 11) { setErrorMsg('请输入正确的手机号'); return; }
    setErrorMsg('');
    setCodeSent(true);
    setCountdown(60);
  };

  const handlePhoneLogin = () => {
    if (!codeSent) { setErrorMsg('请先发送验证码'); return; }
    if (code.length < 4) { setErrorMsg('请输入验证码'); return; }
    // 模拟验证成功
    bindWechat('手机用户_' + phone.slice(-4));
    onSuccess();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}
        onPress={onSkip}
      >
        <Pressable onPress={() => {}}>
          <Animated.View style={{
            transform: [{ translateY: slideAnim }],
            backgroundColor: C.PANEL,
            borderTopLeftRadius: 24, borderTopRightRadius: 24,
            padding: 28, paddingBottom: 44, gap: 20,
          }}>
            {/* 拖动条 */}
            <View style={{ width: 40, height: 4, backgroundColor: C.BORDER, borderRadius: 2, alignSelf: 'center' }} />

            {mode === 'main' ? (
              <>
                {/* 标题 */}
                <View style={{ alignItems: 'center', gap: 10 }}>
                  <View style={{
                    width: 56, height: 56, borderRadius: 16,
                    backgroundColor: '#1AAD19', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ fontSize: 28 }}>💬</Text>
                  </View>
                  <Text style={{ color: C.WHITE, fontSize: 18, fontWeight: 'bold' }}>🔒 绑定会员权益</Text>
                </View>

                {/* 说明文字 */}
                <View style={{
                  backgroundColor: C.PANEL2, borderRadius: 12,
                  padding: 14, borderWidth: 1, borderColor: C.BORDER,
                }}>
                  <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 21, textAlign: 'center' }}>
                    开通会员后，您的权益将与微信账号绑定。{'\n'}
                    换手机也能恢复会员，不怕丢失。
                  </Text>
                </View>

                {/* 微信一键登录按钮 */}
                <Pressable cssInterop={false}
                  onPress={handleWechatLogin}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
                    backgroundColor: pressed ? '#17961A' : '#1AAD19',
                    borderRadius: 14, paddingVertical: 16,
                    boxShadow: [{ offsetX: 0, offsetY: 2, blurRadius: 12, color: 'rgba(26,173,25,0.35)' }],
                  })}
                >
                  <Text style={{ fontSize: 20 }}>💬</Text>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>微信一键登录</Text>
                </Pressable>

                {/* 分隔线 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.BORDER2 }} />
                  <Text style={{ color: C.GRAY2, fontSize: 11 }}>或使用手机号登录</Text>
                  <View style={{ flex: 1, height: 1, backgroundColor: C.BORDER2 }} />
                </View>

                {/* 手机号登录入口（次要） */}
                <Pressable cssInterop={false}
                  onPress={() => setMode('phone')}
                  style={({ pressed }) => ({
                    borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                    borderWidth: 1, borderColor: C.BORDER,
                    backgroundColor: pressed ? C.PANEL2 : 'transparent',
                  })}
                >
                  <Text style={{ color: C.GRAY, fontSize: 14 }}>📱 手机号登录</Text>
                </Pressable>

                {/* 稍后再说 */}
                <Pressable onPress={onSkip} style={{ alignItems: 'center' }}>
                  <Text style={{ color: C.GRAY2, fontSize: 12 }}>稍后再说</Text>
                </Pressable>
              </>
            ) : (
              <>
                {/* 手机号登录模式 */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable onPress={() => setMode('main')}>
                    <Text style={{ color: C.BLUE, fontSize: 18 }}>←</Text>
                  </Pressable>
                  <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>手机号验证</Text>
                </View>

                <View style={{ gap: 12 }}>
                  {/* 手机号输入 */}
                  <View style={{
                    flexDirection: 'row', alignItems: 'center',
                    backgroundColor: C.PANEL2, borderRadius: 12,
                    borderWidth: 1, borderColor: C.BORDER, overflow: 'hidden',
                  }}>
                    <TextInput
                      value={phone}
                      onChangeText={setPhone}
                      placeholder="请输入手机号"
                      placeholderTextColor={C.GRAY2}
                      keyboardType="phone-pad"
                      maxLength={11}
                      style={{ flex: 1, color: C.WHITE, fontSize: 15, paddingHorizontal: 16, paddingVertical: 14 }}
                    />
                    <Pressable
                      onPress={handleSendCode}
                      disabled={countdown > 0}
                      style={{ paddingHorizontal: 14, paddingVertical: 14 }}
                    >
                      <Text style={{ color: countdown > 0 ? C.GRAY2 : C.BLUE, fontSize: 13, fontWeight: 'bold' }}>
                        {countdown > 0 ? `${countdown}s` : '发送验证码'}
                      </Text>
                    </Pressable>
                  </View>

                  {/* 验证码输入 */}
                  <TextInput
                    value={code}
                    onChangeText={setCode}
                    placeholder="请输入验证码"
                    placeholderTextColor={C.GRAY2}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{
                      backgroundColor: C.PANEL2, borderRadius: 12,
                      borderWidth: 1, borderColor: C.BORDER,
                      color: C.WHITE, fontSize: 15,
                      paddingHorizontal: 16, paddingVertical: 14,
                    }}
                  />

                  {errorMsg ? (
                    <Text style={{ color: C.RED, fontSize: 12 }}>{errorMsg}</Text>
                  ) : null}
                </View>

                <Pressable cssInterop={false}
                  onPress={handlePhoneLogin}
                  style={({ pressed }) => ({
                    backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                    borderRadius: 14, paddingVertical: 15, alignItems: 'center',
                  })}
                >
                  <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>确认登录并绑定</Text>
                </Pressable>
              </>
            )}
          </Animated.View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
