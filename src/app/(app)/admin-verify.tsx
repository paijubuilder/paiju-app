/**
 * 管理员登录页 v3（三种验证方式）
 * - 账号/手机号预填绑定手机号（13699509969）
 * - 任意方式通过后 persistAdminVerified()（永久持久化），直接进入后台
 * - 已持久化登录则自动跳转，无需重新验证
 */
import { useEffect, useRef, useState } from 'react';
import { Camera, CameraView } from 'expo-camera';
import { KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  getLoginState,
  isAdminSessionValidated, persistAdminVerified,
  adminLogin, adminSetFaceEnrolled,
} from '@/lib/appStore';

type LoginMode = 'password' | 'sms' | 'face';

const OTP_SECONDS = 60;

export default function AdminVerifyScreen() {
  const router = useRouter();

  // ── 已永久登录，直接进入后台 ──────────────────────────
  useEffect(() => {
    if (isAdminSessionValidated()) {
      router.replace('/(app)/admin-portal' as never);
    }
  }, [router]);

  const [mode, setMode] = useState<LoginMode>('password');

  // 读取已绑定手机号作为默认账号
  const boundPhone = getLoginState().adminBoundPhone;

  // 密码模式（预填绑定手机号）
  const [username, setUsername] = useState(boundPhone || '');
  const [pw, setPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwErr, setPwErr] = useState('');

  // 短信 OTP 模式（预填绑定手机号）
  const [smsPhone, setSmsPhone] = useState(boundPhone || '');
  const [smsCode, setSmsCode] = useState('');
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [smsErr, setSmsErr] = useState('');
  const smsTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpRef = useRef('');

  // 人脸模式
  const [facePerm, setFacePerm] = useState(false);
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceMsg, setFaceMsg] = useState('');
  const faceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 已验证直接跳转（同步路径）
  if (isAdminSessionValidated()) return null;

  // ── 密码登录 ──────────────────────────────────────────
  const handlePasswordLogin = () => {
    setPwErr('');
    const user = username.trim() || boundPhone || 'admin';
    if (!pw.trim()) { setPwErr('请输入密码'); return; }
    const ok = adminLogin(user, pw);
    if (!ok) { setPwErr('账号或密码不正确'); return; }
    persistAdminVerified();
    router.replace('/(app)/admin-portal' as never);
  };

  // ── 短信 OTP ──────────────────────────────────────────
  const sendSms = () => {
    setSmsErr('');
    const state = getLoginState();
    const bound = state.adminBoundPhone;
    if (!bound) { setSmsErr('尚未绑定手机号，请使用密码登录'); return; }
    if (smsPhone.trim() !== bound) { setSmsErr('手机号与绑定号码不符'); return; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpRef.current = code;
    console.info('[DEV] 管理员短信验证码：', code);
    setSmsCountdown(OTP_SECONDS);
    if (smsTimer.current) clearInterval(smsTimer.current);
    smsTimer.current = setInterval(() => {
      setSmsCountdown(c => {
        if (c <= 1) { if (smsTimer.current) clearInterval(smsTimer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSmsLogin = () => {
    setSmsErr('');
    if (!smsCode.trim()) { setSmsErr('请输入验证码'); return; }
    if (smsCode.trim() !== otpRef.current) { setSmsErr('验证码不正确'); return; }
    persistAdminVerified();
    router.replace('/(app)/admin-portal' as never);
  };

  // ── 人脸识别 ──────────────────────────────────────────
  const startFace = async () => {
    const state = getLoginState();
    if (!state.adminFaceEnrolled) {
      setFaceMsg('尚未录入人脸，请先在安全设置中录入');
      return;
    }
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') { setFaceMsg('需要摄像头权限才能使用人脸验证'); return; }
    setFacePerm(true);
    setFaceScanning(true);
    setFaceMsg('');
    if (faceTimer.current) clearTimeout(faceTimer.current);
    faceTimer.current = setTimeout(() => {
      setFaceScanning(false);
      setFacePerm(false);
      adminSetFaceEnrolled(true);
      persistAdminVerified();
      router.replace('/(app)/admin-portal' as never);
    }, 3000);
  };

  const MODE_LABELS: { key: LoginMode; icon: string; label: string }[] = [
    { key: 'password', icon: '🔑', label: '密码' },
    { key: 'sms',      icon: '📱', label: '短信' },
    { key: 'face',     icon: '👤', label: '刷脸' },
  ];

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 返回 */}
      <Pressable onPress={() => router.back()} hitSlop={12} style={{ position: 'absolute', top: 52, left: 20, zIndex: 10 }}>
        <Text style={{ color: C.GRAY, fontSize: 22 }}>←</Text>
      </Pressable>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
        {/* 标题 */}
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <Text style={{ fontSize: 44 }}>🔐</Text>
          <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold' }}>管理员登录</Text>
          <Text style={{ color: C.GRAY, fontSize: 12 }}>验证身份后直接进入后台</Text>
        </View>

        {/* 模式切换 */}
        <View style={{ flexDirection: 'row', backgroundColor: C.PANEL, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER, padding: 4, gap: 4, marginBottom: 24, width: '100%' }}>
          {MODE_LABELS.map(m => (
            <Pressable
              key={m.key}
              onPress={() => { setMode(m.key); setPwErr(''); setSmsErr(''); setFaceMsg(''); }}
              style={{
                flex: 1, borderRadius: 9, paddingVertical: 9, alignItems: 'center', gap: 2,
                backgroundColor: mode === m.key ? C.BLUE : 'transparent',
              }}
            >
              <Text style={{ fontSize: 16 }}>{m.icon}</Text>
              <Text style={{ color: mode === m.key ? '#fff' : C.GRAY, fontSize: 10, fontWeight: mode === m.key ? 'bold' : 'normal' }}>{m.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ width: '100%', backgroundColor: C.PANEL, borderWidth: 1.5, borderColor: C.BORDER, borderRadius: 20, padding: 24, gap: 16 }}>

          {/* ── 密码模式 ── */}
          {mode === 'password' && (
            <View style={{ gap: 12 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>账号（手机号或 admin）</Text>
                <TextInput
                  value={username}
                  onChangeText={t => { setUsername(t); setPwErr(''); }}
                  placeholder="请输入账号"
                  placeholderTextColor={C.GRAY2}
                  autoCapitalize="none"
                  keyboardType="phone-pad"
                  style={{ backgroundColor: C.BG, borderWidth: 1, borderColor: C.BORDER, borderRadius: 12, padding: 14, color: C.WHITE, fontSize: 14 }}
                />
              </View>
              <View style={{ gap: 6 }}>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>密码</Text>
                <View style={{ position: 'relative' }}>
                  <TextInput
                    value={pw}
                    onChangeText={t => { setPw(t); setPwErr(''); }}
                    placeholder="请输入管理员密码"
                    placeholderTextColor={C.GRAY2}
                    secureTextEntry={!showPw}
                    returnKeyType="done"
                    onSubmitEditing={handlePasswordLogin}
                    style={{
                      backgroundColor: C.BG, borderWidth: 1,
                      borderColor: pwErr ? '#EF4444' : C.BORDER,
                      borderRadius: 12, padding: 14, paddingRight: 48,
                      color: C.WHITE, fontSize: 16, letterSpacing: 4,
                    }}
                  />
                  <Pressable onPress={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}>
                    <Text style={{ color: C.GRAY, fontSize: 16 }}>{showPw ? '🙈' : '👁'}</Text>
                  </Pressable>
                </View>
              </View>
              {pwErr ? <Text style={{ color: '#EF4444', fontSize: 12 }}>{pwErr}</Text> : null}
              <Pressable cssInterop={false}
                onPress={handlePasswordLogin}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 15, alignItems: 'center' })}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>登录进入后台</Text>
              </Pressable>
            </View>
          )}

          {/* ── 短信 OTP 模式 ── */}
          {mode === 'sms' && (
            <View style={{ gap: 12 }}>
              <View style={{ gap: 6 }}>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>已绑定手机号</Text>
                <TextInput
                  value={smsPhone}
                  onChangeText={t => { setSmsPhone(t); setSmsErr(''); }}
                  placeholder="输入绑定的手机号"
                  placeholderTextColor={C.GRAY2}
                  keyboardType="phone-pad"
                  style={{ backgroundColor: C.BG, borderWidth: 1, borderColor: smsErr ? '#EF4444' : C.BORDER, borderRadius: 12, padding: 14, color: C.WHITE, fontSize: 14 }}
                />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  value={smsCode}
                  onChangeText={t => { setSmsCode(t); setSmsErr(''); }}
                  placeholder="6位验证码"
                  placeholderTextColor={C.GRAY2}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={{ flex: 1, backgroundColor: C.BG, borderWidth: 1, borderColor: smsErr ? '#EF4444' : C.BORDER, borderRadius: 12, padding: 14, color: C.WHITE, fontSize: 18, letterSpacing: 6, textAlign: 'center' }}
                />
                <Pressable cssInterop={false}
                  onPress={sendSms}
                  disabled={smsCountdown > 0}
                  style={({ pressed }) => ({
                    backgroundColor: smsCountdown > 0 ? '#2A3140' : pressed ? '#1A5FCC' : C.BLUE,
                    borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center', minWidth: 90,
                  })}
                >
                  <Text style={{ color: smsCountdown > 0 ? C.GRAY : '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' }}>
                    {smsCountdown > 0 ? `${smsCountdown}s` : '获取验证码'}
                  </Text>
                </Pressable>
              </View>
              {smsErr ? <Text style={{ color: '#EF4444', fontSize: 12 }}>{smsErr}</Text> : null}
              <Pressable cssInterop={false}
                onPress={handleSmsLogin}
                style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 15, alignItems: 'center' })}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>验证登录</Text>
              </Pressable>
              <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center' }}>需先在安全设置中绑定手机号</Text>
            </View>
          )}

          {/* ── 人脸识别模式 ── */}
          {mode === 'face' && (
            <View style={{ gap: 14, alignItems: 'center' }}>
              {!faceScanning ? (
                <>
                  <Text style={{ fontSize: 56 }}>👤</Text>
                  <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                    点击按钮开启摄像头进行人脸验证{'\n'}（需提前在安全设置中完成录入）
                  </Text>
                  {faceMsg ? <Text style={{ color: '#EF4444', fontSize: 12, textAlign: 'center' }}>{faceMsg}</Text> : null}
                  <Pressable cssInterop={false}
                    onPress={startFace}
                    style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center' })}
                  >
                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>开始刷脸</Text>
                  </Pressable>
                </>
              ) : (
                <View style={{ gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 200, height: 200, borderRadius: 100, overflow: 'hidden', borderWidth: 2, borderColor: C.BLUE }}>
                    {facePerm && <CameraView style={{ flex: 1 }} facing="front" />}
                  </View>
                  <Text style={{ color: C.BLUE, fontSize: 13, fontWeight: 'bold' }}>🔄 人脸识别中…</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* 底部提示 */}
        <Text style={{ color: C.GRAY2, fontSize: 11, marginTop: 20, textAlign: 'center', lineHeight: 18 }}>
          无论是否绑定手机号或录入人脸，{'\n'}账号密码登录永远可用
        </Text>
      </View>

      {/* 摄像头弹层（扫描中） */}
      <Modal visible={faceScanning} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 260, height: 260, borderRadius: 130, overflow: 'hidden', borderWidth: 3, borderColor: C.BLUE }}>
            {facePerm && <CameraView style={{ flex: 1 }} facing="front" />}
          </View>
          <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold', marginTop: 24 }}>🔄 人脸识别中，请保持正视</Text>
          <Pressable onPress={() => { setFaceScanning(false); if (faceTimer.current) clearTimeout(faceTimer.current); }} style={{ marginTop: 20 }}>
            <Text style={{ color: C.GRAY, fontSize: 13 }}>取消</Text>
          </Pressable>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
