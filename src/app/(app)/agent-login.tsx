/**
 * 代理登录页 v19
 * 手机号 + 密码登录，未开通代理引导申请
 */
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { agentLogin, isAgentLoggedIn } from '@/lib/appStore';

export default function AgentLoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  // 已登录直接跳转（useEffect 内执行，避免 render 阶段 side-effect）
  useEffect(() => {
    if (isAgentLoggedIn()) {
      router.replace('/(app)/agent-center');
    }
  }, [router]);

  const handleLogin = () => {
    setError('');
    if (!phone.trim() || phone.length < 11) {
      setError('请输入有效手机号');
      return;
    }
    if (!password.trim() || password.length < 6) {
      setError('密码至少6位');
      return;
    }
    const ok = agentLogin(phone.trim(), password);
    if (!ok) {
      setError('手机号或密码不正确，如未开通代理请联系上级代理');
      return;
    }
    router.replace('/(app)/agent-center');
  };

  const agentLevelColors: Record<string, string> = {
    '初级': C.BLUE,
    '中级': '#A0A0A0',
    '高级': C.GOLD,
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }} contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled">
        <View style={{ paddingHorizontal: 28, gap: 24 }}>
          {/* 标题 */}
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 44 }}>🏆</Text>
            <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold' }}>代理登录</Text>
            <Text style={{ color: C.GRAY, fontSize: 12 }}>AGENT CENTER LOGIN</Text>
          </View>

          {/* 代理等级说明 */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {['初级', '中级', '高级'].map(lvl => (
              <View key={lvl} style={{
                flex: 1, backgroundColor: `${agentLevelColors[lvl]}15`,
                borderRadius: 10, borderWidth: 1, borderColor: `${agentLevelColors[lvl]}50`,
                padding: 10, alignItems: 'center', gap: 4,
              }}>
                <Text style={{ color: agentLevelColors[lvl], fontSize: 18 }}>
                  {lvl === '初级' ? '🔵' : lvl === '中级' ? '⚪' : '🟡'}
                </Text>
                <Text style={{ color: agentLevelColors[lvl], fontSize: 12, fontWeight: 'bold' }}>{lvl}代理</Text>
              </View>
            ))}
          </View>

          <View style={{ gap: 14 }}>
            {/* 手机号 */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>绑定手机号</Text>
              <TextInput
                value={phone}
                onChangeText={t => { setPhone(t); setError(''); }}
                placeholder="请输入代理手机号"
                placeholderTextColor={C.GRAY2}
                keyboardType="phone-pad"
                autoComplete="off"
                importantForAutofill="no"
                style={{
                  backgroundColor: C.PANEL, color: C.WHITE, borderRadius: 12,
                  borderWidth: 1, borderColor: C.BORDER, padding: 14, fontSize: 14,
                }}
              />
            </View>

            {/* 密码 */}
            <View style={{ gap: 6 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>密码</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={password}
                  onChangeText={t => { setPassword(t); setError(''); }}
                  placeholder="请输入密码"
                  placeholderTextColor={C.GRAY2}
                  secureTextEntry={!showPass}
                  autoComplete="new-password"
                  importantForAutofill="no"
                  style={{
                    backgroundColor: C.PANEL, color: C.WHITE, borderRadius: 12,
                    borderWidth: 1, borderColor: C.BORDER, padding: 14, fontSize: 14,
                    paddingRight: 44,
                  }}
                />
                <Pressable
                  onPress={() => setShowPass(v => !v)}
                  style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
                >
                  <Text style={{ color: C.GRAY, fontSize: 16 }}>{showPass ? '🙈' : '👁'}</Text>
                </Pressable>
              </View>
            </View>

            {error ? <Text style={{ color: C.RED, fontSize: 12 }}>{error}</Text> : null}

            <Pressable cssInterop={false}
              onPress={handleLogin}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4,
              })}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>登录代理中心</Text>
            </Pressable>

            {/* 未开通代理提示 */}
            <View style={{
              backgroundColor: C.PANEL2, borderRadius: 12, borderWidth: 1,
              borderColor: C.BORDER, padding: 14, gap: 6, alignItems: 'center',
            }}>
              <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
                还未开通代理？联系上级代理开通后即可使用手机号+密码登录{'\n'}
                换手机时直接用原手机号登录即可恢复记录
              </Text>
              <Pressable onPress={() => router.push('/(app)/agent-upgrade')}>
                <Text style={{ color: C.BLUE, fontSize: 12 }}>了解代理开通流程 →</Text>
              </Pressable>
            </View>

            <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center' }}>
              ☁️ 代理数据云端同步，换手机登录即可恢复
            </Text>
          </View>

          <Pressable onPress={() => router.back()} style={{ alignItems: 'center' }}>
            <Text style={{ color: C.GRAY2, fontSize: 12 }}>← 返回</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
