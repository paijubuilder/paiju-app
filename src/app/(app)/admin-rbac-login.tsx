/**
 * RBAC 管理员账密登录页
 * - 账号（用户名/手机/邮箱）+ 密码
 * - 连续错误5次 → 锁定15分钟
 * - 登录成功 → 跳转 admin-rbac-portal
 * - 保留原"点五下"超管入口不受影响
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
import { loginRbacAdmin } from '@/lib/rbac';

// ── 简单图形验证码（数字计算题） ──────────────────────────
function genCaptcha(): { question: string; answer: string } {
  const a = Math.floor(Math.random() * 9) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  return { question: `${a} + ${b} = ?`, answer: String(a + b) };
}

export default function AdminRbacLoginScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // 图形验证码
  const [captcha, setCaptcha] = useState(genCaptcha);
  const [captchaInput, setCaptchaInput] = useState('');
  const [captchaErr, setCaptchaErr] = useState(false);
  const captchaRef = useRef(0); // 累计错误次数，≥2 才强制显示验证码
  const [showCaptcha, setShowCaptcha] = useState(false);

  const refreshCaptcha = () => {
    setCaptcha(genCaptcha());
    setCaptchaInput('');
    setCaptchaErr(false);
  };

  const handleLogin = async () => {
    setErrorMsg('');
    if (!username.trim()) { setErrorMsg('请输入账号'); return; }
    if (!password.trim()) { setErrorMsg('请输入密码'); return; }
    // 验证码检查（错误≥2次后显示）
    if (showCaptcha) {
      if (captchaInput.trim() !== captcha.answer) {
        setCaptchaErr(true);
        refreshCaptcha();
        setErrorMsg('验证码错误，请重新输入');
        return;
      }
    }
    setLoading(true);
    try {
      const result = await loginRbacAdmin(username.trim(), password.trim());
      if ('error' in result) {
        captchaRef.current += 1;
        if (captchaRef.current >= 2) setShowCaptcha(true);
        refreshCaptcha();
        setErrorMsg(result.error);
      } else {
        // 登录成功
        captchaRef.current = 0;
        router.replace('/(app)/admin-rbac-portal' as never);
      }
    } catch (err) {
      setErrorMsg('网络异常，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 32, paddingBottom: 60 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* 顶部品牌标识 */}
          <View style={{ alignItems: 'center', marginBottom: 40 }}>
            <View style={{
              width: 72, height: 72, borderRadius: 20, backgroundColor: C.BLUE_BG,
              borderWidth: 1.5, borderColor: C.BLUE, alignItems: 'center', justifyContent: 'center',
              marginBottom: 16,
            }}>
              <Text style={{ fontSize: 34 }}>🛡️</Text>
            </View>
            <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold', letterSpacing: 1 }}>
              管理后台
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 13, marginTop: 6 }}>
              请使用管理员账号登录
            </Text>
          </View>

          {/* 登录表单 */}
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 18, borderWidth: 1,
            borderColor: C.BORDER, padding: 24, gap: 16,
          }}>
            {/* 账号 */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }}>
                账号（用户名 / 手机 / 邮箱）
              </Text>
              <TextInput
                value={username}
                onChangeText={v => { setUsername(v); setErrorMsg(''); }}
                placeholder="请输入账号"
                placeholderTextColor={C.GRAY2}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                importantForAutofill="no"
                style={{
                  backgroundColor: C.PANEL2, borderRadius: 10, borderWidth: 1,
                  borderColor: errorMsg ? C.RED : C.BORDER,
                  color: C.WHITE, fontSize: 15,
                  paddingHorizontal: 14, paddingVertical: 12,
                }}
              />
            </View>

            {/* 密码 */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }}>
                密码
              </Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={password}
                  onChangeText={v => { setPassword(v); setErrorMsg(''); }}
                  placeholder="请输入密码"
                  placeholderTextColor={C.GRAY2}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  autoComplete="new-password"
                  importantForAutofill="no"
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

            {/* 验证码（错误≥2次显示） */}
            {showCaptcha && (
              <View style={{ gap: 6 }}>
                <Text style={{ color: C.GRAY, fontSize: 12, fontWeight: 'bold', letterSpacing: 0.5 }}>
                  验证码
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Pressable
                    onPress={refreshCaptcha}
                    style={{
                      backgroundColor: C.BLUE_BG, borderRadius: 8, borderWidth: 1,
                      borderColor: C.BLUE, paddingHorizontal: 14, paddingVertical: 10, minWidth: 110,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: C.BLUE, fontSize: 15, fontWeight: 'bold' }}>
                      {captcha.question}
                    </Text>
                    <Text style={{ color: C.GRAY, fontSize: 9, marginTop: 2 }}>点击刷新</Text>
                  </Pressable>
                  <TextInput
                    value={captchaInput}
                    onChangeText={v => { setCaptchaInput(v); setCaptchaErr(false); }}
                    placeholder="请输入答案"
                    placeholderTextColor={C.GRAY2}
                    keyboardType="number-pad"
                    style={{
                      flex: 1, backgroundColor: C.PANEL2, borderRadius: 10, borderWidth: 1,
                      borderColor: captchaErr ? C.RED : C.BORDER,
                      color: C.WHITE, fontSize: 15,
                      paddingHorizontal: 14, paddingVertical: 12,
                    }}
                  />
                </View>
              </View>
            )}

            {/* 错误提示 */}
            {errorMsg !== '' && (
              <View style={{
                backgroundColor: 'rgba(224,82,82,0.12)', borderRadius: 8,
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
                backgroundColor: loading ? C.BLUE_DIM : pressed ? '#1A5FCC' : C.BLUE,
                borderRadius: 12, paddingVertical: 14,
                alignItems: 'center', marginTop: 4,
              })}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold', letterSpacing: 0.5 }}>登 录</Text>}
            </Pressable>
          </View>

          {/* 提示文字 */}
          <View style={{ alignItems: 'center', marginTop: 24, gap: 6 }}>
            <Text style={{ color: C.GRAY2, fontSize: 12 }}>
              账号由上级管理员在权限管理中创建
            </Text>
            <Text style={{ color: C.GRAY2, fontSize: 12 }}>
              如忘记密码请联系超级管理员重置
            </Text>
          </View>

          {/* 返回按钮 */}
          <Pressable
            onPress={() => router.back()}
            style={{ alignItems: 'center', marginTop: 20, paddingVertical: 8 }}
          >
            <Text style={{ color: C.GRAY, fontSize: 13 }}>← 返回</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
