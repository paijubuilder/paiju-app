/**
 * 管理员首次安全设置页
 * - 首次使用默认账号/密码登录后强制跳转，不可跳过
 * - 可同时修改账号（绑定手机号）+ 密码，也可只完成其中一项
 * - 至少完成一项才能点击【确认设置】
 * - 设置完成 → 提示 → 自动退出 → 返回登录页用新凭据重新登录
 */
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { adminFirstSetup, adminLogout, clearAdminVerified } from '@/lib/appStore';

const OTP_SECONDS = 60;

export default function AdminFirstSetupScreen() {
  const router = useRouter();

  // ── 绑定手机号区块 ──────────────────────────────────
  const [phone, setPhone]           = useState('');
  const [otp, setOtp]               = useState('');
  const [otpSent, setOtpSent]       = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const otpRef  = useRef('');
  const timer   = useRef<ReturnType<typeof setInterval> | null>(null);
  const [phoneErr, setPhoneErr]     = useState('');

  // ── 修改密码区块 ────────────────────────────────────
  const [newPass, setNewPass]         = useState('');
  const [newPassConfirm, setNewPassConfirm] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [passErr, setPassErr]         = useState('');

  // ── 全局提示 ────────────────────────────────────────
  const [globalErr, setGlobalErr]   = useState('');
  const [done, setDone]             = useState(false);

  // ── 是否至少完成一项（控制按钮可用性） ───────────────
  const phoneReady = phoneVerified && phone.trim().length === 11;
  const passReady  = newPass.trim().length >= 6 && newPass === newPassConfirm;
  const canSubmit  = phoneReady || passReady;

  // ── 发送 OTP ─────────────────────────────────────────
  const sendOtp = () => {
    setPhoneErr('');
    const p = phone.trim();
    if (!/^1[3-9]\d{9}$/.test(p)) { setPhoneErr('请输入有效的11位手机号'); return; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    otpRef.current = code;
    console.info('[DEV] 首次设置验证码：', code);
    setOtpSent(true);
    setOtpCountdown(OTP_SECONDS);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setOtpCountdown(c => {
        if (c <= 1) { if (timer.current) clearInterval(timer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  // ── 验证 OTP ─────────────────────────────────────────
  const verifyOtp = () => {
    setPhoneErr('');
    if (!otp.trim()) { setPhoneErr('请输入验证码'); return; }
    if (otp.trim() !== otpRef.current) { setPhoneErr('验证码不正确，请重试'); return; }
    setPhoneVerified(true);
    setPhoneErr('');
  };

  // ── 密码实时校验 ──────────────────────────────────────
  const handlePassChange = (v: string) => {
    setNewPass(v);
    setPassErr('');
    setGlobalErr('');
  };
  const handlePassConfirmChange = (v: string) => {
    setNewPassConfirm(v);
    if (v && newPass && v !== newPass) setPassErr('两次密码不一致');
    else setPassErr('');
    setGlobalErr('');
  };

  // ── 提交 ─────────────────────────────────────────────
  const handleSubmit = () => {
    setGlobalErr('');

    // 密码分支校验
    if (newPass && newPass.length < 6) { setPassErr('新密码至少6位'); return; }
    if (newPass && newPass !== newPassConfirm) { setPassErr('两次密码不一致'); return; }

    if (!canSubmit) {
      setGlobalErr('请至少完成手机号绑定或密码修改其中一项');
      return;
    }

    // 持久化：只传非空项
    adminFirstSetup(phoneReady ? phone.trim() : '', passReady ? newPass : '');
    adminLogout();
    clearAdminVerified();
    setDone(true);

    // 1.8 秒后跳回登录页
    setTimeout(() => {
      router.replace('/(app)/admin-login' as never);
    }, 1800);
  };

  // ── 完成状态 ─────────────────────────────────────────
  if (done) {
    return (
      <View style={{ flex: 1, backgroundColor: C.BG, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 20 }}>
        <StatusBar style="light" backgroundColor={C.BG} />
        <Text style={{ fontSize: 56 }}>✅</Text>
        <Text style={{ color: '#4ADE80', fontSize: 18, fontWeight: 'bold', textAlign: 'center' }}>安全设置完成</Text>
        <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
          请使用新的{phoneReady ? '手机号' : '账号 admin'}{passReady ? '和新密码' : '（原密码不变）'}重新登录
        </Text>
        <Text style={{ color: C.GRAY2, fontSize: 12 }}>正在返回登录页…</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 64, gap: 28 }}>

          {/* 标题 */}
          <View style={{ alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 44 }}>🔐</Text>
            <Text style={{ color: C.WHITE, fontSize: 22, fontWeight: 'bold' }}>首次安全设置</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              请完成以下至少一项安全设置后进入后台
            </Text>
          </View>

          {/* 提示横幅 */}
          <View style={{ backgroundColor: 'rgba(234,179,8,0.1)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(234,179,8,0.35)', padding: 14, gap: 4 }}>
            <Text style={{ color: '#FDE047', fontSize: 13, fontWeight: 'bold' }}>⚠️ 首次登录安全提醒</Text>
            <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>
              检测到您正在使用初始账号登录。为保障后台安全，请完成账号绑定或密码修改（两项均可，至少一项）。
            </Text>
          </View>

          {/* ── 第一块：修改账号（绑定手机号） ── */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 18, borderWidth: 1, borderColor: C.BORDER, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>📱</Text>
              <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>修改账号（绑定手机号）</Text>
              {phoneReady && (
                <View style={{ marginLeft: 'auto', backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' }}>
                  <Text style={{ color: '#4ADE80', fontSize: 11, fontWeight: 'bold' }}>✓ 已验证</Text>
                </View>
              )}
            </View>

            {/* 当前账号（只读） */}
            <View style={{ gap: 5 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>当前账号</Text>
              <View style={{ backgroundColor: '#1A1F26', borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 12 }}>
                <Text style={{ color: C.GRAY, fontSize: 14 }}>admin</Text>
              </View>
            </View>

            {/* 新手机号 */}
            <View style={{ gap: 5 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>新手机号</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  value={phone}
                  onChangeText={v => { setPhone(v); setPhoneErr(''); setPhoneVerified(false); setOtpSent(false); setOtp(''); }}
                  placeholder="请输入你要绑定的手机号"
                  placeholderTextColor={C.GRAY2}
                  keyboardType="phone-pad"
                  maxLength={11}
                  editable={!phoneVerified}
                  style={{ flex: 1, backgroundColor: phoneVerified ? '#1A1F26' : C.PANEL, color: phoneVerified ? C.GRAY : C.WHITE, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 12, fontSize: 14 }}
                />
                <Pressable cssInterop={false}
                  onPress={sendOtp}
                  disabled={otpCountdown > 0 || phoneVerified}
                  style={({ pressed }) => ({
                    backgroundColor: (otpCountdown > 0 || phoneVerified) ? C.PANEL : (pressed ? '#1A5FCC' : C.BLUE),
                    borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center',
                    borderWidth: 1, borderColor: (otpCountdown > 0 || phoneVerified) ? C.BORDER : C.BLUE,
                  })}
                >
                  <Text style={{ color: (otpCountdown > 0 || phoneVerified) ? C.GRAY : '#fff', fontSize: 12, fontWeight: 'bold' }}>
                    {otpCountdown > 0 ? `${otpCountdown}s` : '获取验证码'}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* 验证码 */}
            {otpSent && !phoneVerified && (
              <View style={{ gap: 5 }}>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>短信验证码</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput
                    value={otp}
                    onChangeText={v => { setOtp(v); setPhoneErr(''); }}
                    placeholder="请输入短信验证码"
                    placeholderTextColor={C.GRAY2}
                    keyboardType="number-pad"
                    maxLength={6}
                    style={{ flex: 1, backgroundColor: C.PANEL, color: C.WHITE, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 12, fontSize: 14 }}
                  />
                  <Pressable cssInterop={false}
                    onPress={verifyOtp}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                      borderRadius: 10, paddingHorizontal: 18, justifyContent: 'center',
                    })}
                  >
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>验证</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {phoneErr ? <Text style={{ color: C.RED, fontSize: 12 }}>{phoneErr}</Text> : null}

            {phoneReady && (
              <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>
                绑定成功后，可使用手机号 <Text style={{ color: '#4ADE80' }}>{phone}</Text> 登录后台
              </Text>
            )}
          </View>

          {/* ── 第二块：修改密码 ── */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 18, borderWidth: 1, borderColor: C.BORDER, padding: 20, gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>🔑</Text>
              <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>修改密码</Text>
              {passReady && (
                <View style={{ marginLeft: 'auto', backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: 'rgba(34,197,94,0.4)' }}>
                  <Text style={{ color: '#4ADE80', fontSize: 11, fontWeight: 'bold' }}>✓ 已填写</Text>
                </View>
              )}
            </View>

            {/* 旧密码（自动填入，只读） */}
            <View style={{ gap: 5 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>旧密码（初始密码）</Text>
              <TextInput
                value="admin123"
                editable={false}
                secureTextEntry
                style={{ backgroundColor: '#1A1F26', color: C.GRAY, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 12, fontSize: 14 }}
              />
            </View>

            {/* 新密码 */}
            <View style={{ gap: 5 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>新密码（不少于6位）</Text>
              <View style={{ position: 'relative' }}>
                <TextInput
                  value={newPass}
                  onChangeText={handlePassChange}
                  placeholder="请设置新密码（不少于6位）"
                  placeholderTextColor={C.GRAY2}
                  secureTextEntry={!showNewPass}
                  style={{ backgroundColor: C.PANEL, color: C.WHITE, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 12, fontSize: 14, paddingRight: 44 }}
                />
                <Pressable onPress={() => setShowNewPass(v => !v)} style={{ position: 'absolute', right: 12, top: 0, bottom: 0, justifyContent: 'center' }}>
                  <Text style={{ color: C.GRAY, fontSize: 16 }}>{showNewPass ? '🙈' : '👁'}</Text>
                </Pressable>
              </View>
            </View>

            {/* 确认新密码 */}
            <View style={{ gap: 5 }}>
              <Text style={{ color: C.GRAY, fontSize: 12 }}>确认新密码</Text>
              <TextInput
                value={newPassConfirm}
                onChangeText={handlePassConfirmChange}
                placeholder="请再次输入新密码"
                placeholderTextColor={C.GRAY2}
                secureTextEntry
                style={{ backgroundColor: C.PANEL, color: C.WHITE, borderRadius: 10, borderWidth: 1, borderColor: C.BORDER, padding: 12, fontSize: 14 }}
              />
            </View>

            {passErr ? <Text style={{ color: C.RED, fontSize: 12 }}>{passErr}</Text> : null}

            {passReady && (
              <Text style={{ color: C.GRAY, fontSize: 12 }}>密码修改后初始密码 admin123 自动失效</Text>
            )}
          </View>

          {/* 全局错误 */}
          {globalErr ? (
            <View style={{ backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(239,68,68,0.4)', padding: 12 }}>
              <Text style={{ color: C.RED, fontSize: 13, textAlign: 'center' }}>{globalErr}</Text>
            </View>
          ) : null}

          {/* 已完成项摘要 */}
          {(phoneReady || passReady) && (
            <View style={{ backgroundColor: 'rgba(34,197,94,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(34,197,94,0.25)', padding: 14, gap: 6 }}>
              <Text style={{ color: '#4ADE80', fontSize: 13, fontWeight: 'bold' }}>已完成设置：</Text>
              {phoneReady  && <Text style={{ color: C.GRAY, fontSize: 12 }}>✓ 绑定手机号 {phone}</Text>}
              {passReady   && <Text style={{ color: C.GRAY, fontSize: 12 }}>✓ 修改密码</Text>}
              {!phoneReady && <Text style={{ color: C.GRAY2, fontSize: 12 }}>— 账号 admin 保持不变</Text>}
              {!passReady  && <Text style={{ color: C.GRAY2, fontSize: 12 }}>— 密码 admin123 保持不变</Text>}
            </View>
          )}

          {/* 确认按钮 */}
          <Pressable cssInterop={false}
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => ({
              backgroundColor: !canSubmit ? '#2A2F38' : (pressed ? '#B8961E' : C.GOLD),
              borderRadius: 16, paddingVertical: 17, alignItems: 'center',
              borderWidth: 1,
              borderColor: !canSubmit ? C.BORDER : C.GOLD,
            })}
          >
            <Text style={{ color: !canSubmit ? C.GRAY : '#1A1514', fontSize: 15, fontWeight: 'bold' }}>
              {canSubmit ? '确认设置' : '请至少完成一项设置'}
            </Text>
          </Pressable>

          <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
            设置完成后将自动退出，使用新凭据重新登录
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
