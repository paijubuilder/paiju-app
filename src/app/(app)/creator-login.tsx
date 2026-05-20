/**
 * 创作者登录页
 * - 激活码验证通过后跳转至此
 * - 固定账号：13699509969 / to1997320ng
 * - 输入框初始为空，禁用浏览器自动填充
 * - 登录成功后进入创作者（超管）后台
 */
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  isAdminSessionValidated,
  persistAdminVerified,
} from '@/lib/appStore';

// 创作者固定账号（仅在此模块中校验，不写入任何持久化存储）
const CREATOR_ACCOUNT = '13699509969';
const CREATOR_PASSWORD = 'to1997320ng';

export default function CreatorLoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInput>(null);

  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 若本设备已有验证 session，直接进入后台
  const handleMount = () => {
    if (isAdminSessionValidated()) {
      router.replace('/(app)/admin-portal' as never);
    }
  };

  const handleLogin = async () => {
    setErrorMsg('');
    if (!account.trim()) { setErrorMsg('请输入账号'); return; }
    if (!password.trim()) { setErrorMsg('请输入密码'); return; }

    setLoading(true);
    // 短暂延迟模拟验证，防止暴力枚举过快
    await new Promise(r => setTimeout(r, 320));

    if (
      account.trim() === CREATOR_ACCOUNT &&
      password === CREATOR_PASSWORD
    ) {
      persistAdminVerified();
      router.replace('/(app)/admin-portal' as never);
    } else {
      setErrorMsg('账号或密码不正确，请重试');
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }} onLayout={handleMount}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 顶部品牌标识 */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 20,
              backgroundColor: 'rgba(212,175,55,0.1)',
              borderWidth: 1.5, borderColor: C.GOLD,
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <Text style={{ fontSize: 34 }}>✍️</Text>
            </View>
            <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold', letterSpacing: 1 }}>
              创作者后台
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 13, marginTop: 6 }}>
              请输入创作者账号登录
            </Text>
          </View>

          {/* 登录表单 */}
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 18, borderWidth: 1,
            borderColor: C.BORDER, padding: 24, gap: 16,
          }}>
            {/* 账号输入框 */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }}>
                账号（手机号）
              </Text>
              <TextInput
                value={account}
                onChangeText={v => { setAccount(v); setErrorMsg(''); }}
                placeholder="请输入账号"
                placeholderTextColor={C.GRAY2}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                keyboardType="phone-pad"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                style={{
                  backgroundColor: C.PANEL2, borderRadius: 10, borderWidth: 1,
                  borderColor: errorMsg ? C.RED : C.BORDER,
                  color: C.WHITE, fontSize: 15,
                  paddingHorizontal: 14, paddingVertical: 12,
                }}
              />
            </View>

            {/* 密码输入框 */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }}>
                密码
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  ref={passwordRef}
                  value={password}
                  onChangeText={v => { setPassword(v); setErrorMsg(''); }}
                  placeholder="请输入密码"
                  placeholderTextColor={C.GRAY2}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  importantForAutofill="no"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  style={{
                    backgroundColor: C.PANEL2, borderRadius: 10, borderWidth: 1,
                    borderColor: errorMsg ? C.RED : C.BORDER,
                    color: C.WHITE, fontSize: 15,
                    paddingHorizontal: 14, paddingVertical: 12, paddingRight: 46,
                  }}
                />
                <Pressable
                  onPress={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}
                >
                  <Text style={{ color: C.GRAY, fontSize: 16 }}>{showPw ? '🙈' : '👁'}</Text>
                </Pressable>
              </View>
            </View>

            {/* 错误提示 */}
            {errorMsg !== '' && (
              <View style={{
                backgroundColor: 'rgba(224,82,82,0.10)', borderRadius: 8,
                borderWidth: 1, borderColor: `${C.RED}40`, padding: 10,
              }}>
                <Text style={{ color: C.RED, fontSize: 13, textAlign: 'center' }}>{errorMsg}</Text>
              </View>
            )}

            {/* 登录按钮 */}
            <Pressable
              cssInterop={false}
              onPress={handleLogin}
              disabled={loading}
              style={({ pressed }) => ({
                backgroundColor: loading
                  ? 'rgba(212,175,55,0.3)'
                  : pressed ? 'rgba(212,175,55,0.75)' : C.GOLD,
                borderRadius: 12, paddingVertical: 14,
                alignItems: 'center', marginTop: 4,
              })}
            >
              {loading
                ? <ActivityIndicator color="#0D0F12" />
                : <Text style={{ color: '#0D0F12', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 }}>
                    登 录
                  </Text>
              }
            </Pressable>
          </View>

          {/* 返回按钮 */}
          <Pressable
            onPress={() => router.back()}
            style={{ alignItems: 'center', marginTop: 24, paddingVertical: 8 }}
          >
            <Text style={{ color: C.GRAY, fontSize: 13 }}>← 返回</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
