/**
 * 管理员登录页 v5
 * - 默认账号 admin / 初始密码 admin123
 * - 首次使用默认账号密码登录后强制跳转"首次安全设置"页
 * - 登录成功后持久化验证状态并进入后台
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  adminLogin, isAdminLoggedIn,
  adminLogout, isDefaultAdminPassword,
  persistAdminVerified,
} from '@/lib/appStore';

export default function AdminLoginScreen() {
  const router = useRouter();

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // 登录表单
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // 已登录直接跳转（hooks 之后执行，避免违反 Rules of Hooks）
  useEffect(() => {
    if (isAdminLoggedIn()) {
      router.replace('/(app)/admin-portal' as never);
    }
  }, [router]);

  const handleLogin = () => {
    setError('');
    setSuccessMsg('');
    const user = username.trim() || 'admin';
    if (!password.trim()) { setError('请输入密码'); return; }

    const ok = adminLogin(user, password);
    if (!ok) { setError('账号或密码不正确，请重试'); return; }

    // 首次使用默认密码登录 → 强制安全设置（不持久化验证）
    if (isDefaultAdminPassword()) {
      adminLogout(); // 清除临时登录态，安全设置完成后再登录
      router.replace('/(app)/admin-first-setup' as never);
      return;
    }

    // 正常登录 → 持久化验证状态进入后台
    persistAdminVerified();
    router.replace('/(app)/admin-portal' as never);
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 28, gap: 24 }}>
          {/* 标题 */}
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 44 }}>🔐</Text>
            <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold' }}>管理员登录</Text>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>ADMIN LOGIN</Text>
          </View>

          {/* 成功提示 */}
          {successMsg ? (
            <View style={{ backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)', padding: 14 }}>
              <Text style={{ color: '#4ADE80', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>{successMsg}</Text>
            </View>
          ) : null}

          {/* 登录表单 */}
          <View style={{ gap: 14 }}>
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>账号</Text>
              <TextInput
                value={username}
                onChangeText={t => { setUsername(t); setError(''); setSuccessMsg(''); }}
                placeholder="admin 或已绑定手机号"
                placeholderTextColor={C.GRAY2}
                autoCapitalize="none"
                autoComplete="off"
                importantForAutofill="no"
                style={{ backgroundColor: C.PANEL, color: C.WHITE, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER, padding: 14, fontSize: 14 }}
              />
            </View>
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>密码</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={password}
                  onChangeText={t => { setPassword(t); setError(''); setSuccessMsg(''); }}
                  placeholder="请输入管理员密码"
                  placeholderTextColor={C.GRAY2}
                  secureTextEntry={!showPass}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  autoComplete="new-password"
                  importantForAutofill="no"
                  style={{ backgroundColor: C.PANEL, color: C.WHITE, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER, padding: 14, fontSize: 14, paddingRight: 44 }}
                />
                <Pressable onPress={() => setShowPass(v => !v)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <Text style={{ color: C.GRAY, fontSize: 16 }}>{showPass ? '🙈' : '👁'}</Text>
                </Pressable>
              </View>
            </View>
            {error ? <Text style={{ color: C.RED, fontSize: 12 }}>{error}</Text> : null}
            <Pressable cssInterop={false}
              onPress={handleLogin}
              style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 })}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>登录</Text>
            </Pressable>
            <Pressable onPress={() => {}} style={{ alignItems: 'center' }}>
              <Text style={{ color: C.GRAY2, fontSize: 12 }}>忘记密码？请联系系统管理员</Text>
            </Pressable>
          </View>

          <Pressable onPress={() => router.back()} style={{ alignItems: 'center', marginTop: 8 }}>
            <Text style={{ color: C.GRAY2, fontSize: 12 }}>← 返回</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

