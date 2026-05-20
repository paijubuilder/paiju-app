/**
 * 管理后台 — Tab4 系统设置
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, ActivityIndicator, KeyboardAvoidingView, Modal, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { Camera, CameraView } from 'expo-camera';
import { useFocusEffect, useRouter } from 'expo-router';
import { C } from '@/lib/colors';
import { runSelfCheck, exportSelfCheckAsJSON, type SelfCheckReport } from '@/lib/selfCheck';
import {
  adminChangePassword, adminBindPhone, adminSetFaceEnrolled,
  clearAdminVerified, getLoginState, getConfig, saveConfig,
  getOpLogs, rollbackOpLog, loadConfigFromDB,
  logSwitchChange, loadSwitchLogs, runSwitchHealthCheck, batchSyncSwitchesToDB,
} from '@/lib/appStore';
import type { AdminConfig } from '@/lib/appStore';
import { usePersistSwitch } from '@/lib/usePersistSwitch';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
        <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>{title}</Text>
      </View>
      <View style={{ padding: 16, gap: 12 }}>{children}</View>
    </View>
  );
}

function BottomSheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#161A1F', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderTopWidth: 1, borderTopColor: '#2A3140', maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
            <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold', flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ color: '#8899AA', fontSize: 20 }}>✕</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
            {children}
            <Pressable cssInterop={false} onPress={onClose}
              style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : '#2563EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 4 })}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认关闭</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function RowItem({ label, value, onPress, danger }: {
  label: string; value?: string; onPress?: () => void; danger?: boolean;
}) {
  return (
    <Pressable cssInterop={false} onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', minHeight: 48, opacity: pressed ? 0.7 : 1 })}>
      <Text style={{ color: danger ? '#EF4444' : '#F0F4FF', fontSize: 14, flex: 1 }}>{label}</Text>
      {value !== undefined && <Text style={{ color: '#8899AA', fontSize: 12, marginRight: 6 }}>{value}</Text>}
      {onPress && <Text style={{ color: '#8899AA', fontSize: 16 }}>›</Text>}
    </Pressable>
  );
}

// ─── Tab4: 设置 ────────────────────────────────────────────
const SEC_OTP_SECONDS = 60;

// 模块级类型声明（避免函数体内 type 导致 Babel/Hermes 打包错误）
type SwitchLog = Awaited<ReturnType<typeof loadSwitchLogs>>[number];
type HealthResult = Awaited<ReturnType<typeof runSwitchHealthCheck>>;

// 客服模式选项（提取为常量，避免 JSX 内 as const 导致 Metro 打包错误）
const CS_MODE_OPTIONS: { k: 'ai' | 'link' | 'qrcode' | 'off'; label: string }[] = [
  { k: 'ai',     label: 'AI客服' },
  { k: 'link',   label: '链接跳转' },
  { k: 'qrcode', label: '二维码' },
  { k: 'off',    label: '关闭' },
];

export function SettingsTab({ config, onSave, onLogout, onShowPrivacyDoc }: {
  config: AdminConfig;
  onSave: (p: Partial<AdminConfig>) => void;
  onLogout: () => void;
  onShowPrivacyDoc: () => void;
}) {
  const router = useRouter();
  const [sheet, setSheet] = useState<string | null>(null);
  const [localCfg, setLocalCfg] = useState(config);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // ── 修改密码 ──
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwErr, setPwErr] = useState('');

  // ── 绑定手机 ──
  const loginState = getLoginState();
  const [boundPhone, setBoundPhone] = useState(loginState.adminBoundPhone || '');
  const [bindPhone, setBindPhone] = useState('');
  const [bindCode, setBindCode] = useState('');
  const [bindSent, setBindSent] = useState(false);
  const [bindCountdown, setBindCountdown] = useState(0);
  const [bindErr, setBindErr] = useState('');
  const bindOtpRef = useRef('');
  const bindTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── 人脸录入 ──
  const [faceEnrolled, setFaceEnrolled] = useState(loginState.adminFaceEnrolled);
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceCamPerm, setFaceCamPerm] = useState(false);
  const [faceMsg, setFaceMsg] = useState('');
  const faceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 挂载时从 Supabase 读取持久化开关状态（修复刷新后状态重置问题）──
  useFocusEffect(useCallback(() => {
    loadConfigFromDB().then(() => {
      setLocalCfg(getConfig());
    }).catch(() => { /* 网络失败时使用内存配置 */ });
  }, []));

  // ── 持久化开关（带重试 + 回滚 + 日志）──
  const swFloat = usePersistSwitch({
    switchKey: 'featureFloatWindow', switchLabel: '通知栏提醒开关', module: '系统设置',
    initialValue: localCfg.featureFloatWindow,
    onCommit: (v) => { upd('featureFloatWindow', v); },
  });
  const swNotif = usePersistSwitch({
    switchKey: 'featureNotification', switchLabel: '通知栏推送开关', module: '系统设置',
    initialValue: localCfg.featureNotification,
    onCommit: (v) => { upd('featureNotification', v); },
  });
  const swPip = usePersistSwitch({
    switchKey: 'featurePip', switchLabel: '画中画功能', module: '系统设置',
    initialValue: localCfg.featurePip,
    onCommit: (v) => { upd('featurePip', v); },
  });
  const swAuto = usePersistSwitch({
    switchKey: 'featureAutoUpdate', switchLabel: '自动更新开关', module: '系统设置',
    initialValue: localCfg.featureAutoUpdate,
    onCommit: (v) => { upd('featureAutoUpdate', v); },
  });

  // ── 开关操作日志 / 健康检测 / 批量同步 ──
  const [switchLogs, setSwitchLogs] = useState<SwitchLog[]>([]);
  const [switchLogsLoading, setSwitchLogsLoading] = useState(false);
  const [healthReport, setHealthReport] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);
  // ── 发布前完整自检 ──────────────────────────────────────
  const [fullCheckReport, setFullCheckReport] = useState<SelfCheckReport | null>(null);
  const [fullCheckLoading, setFullCheckLoading] = useState(false);

  const upd = (k: keyof AdminConfig, v: unknown) => {
    const next = { ...localCfg, [k]: v };
    setLocalCfg(next as AdminConfig);
    onSave({ [k]: v });
  };

  /** 修改密码 → 强制退出 */
  const doChangePw = () => {
    setPwErr('');
    if (oldPw !== localCfg.adminPassword) { setPwErr('旧密码错误'); return; }
    if (newPw.length < 6) { setPwErr('新密码至少6位'); return; }
    if (newPw !== confirmPw) { setPwErr('两次输入不一致'); return; }
    adminChangePassword(getLoginState().adminPhone || '', newPw);
    onSave({ adminPassword: newPw });
    setOldPw(''); setNewPw(''); setConfirmPw(''); setPwErr('');
    setSheet(null);
    // 强制退出，需用新密码重新登录
    onLogout();
  };

  /** 发送绑定手机验证码 */
  const sendBindSms = () => {
    setBindErr('');
    if (!bindPhone || bindPhone.length < 11) { setBindErr('请输入有效手机号'); return; }
    const code = String(Math.floor(100000 + Math.random() * 900000));
    bindOtpRef.current = code;
    console.info('[DEV] 绑定手机验证码：', code);
    setBindSent(true);
    setBindCountdown(SEC_OTP_SECONDS);
    if (bindTimer.current) clearInterval(bindTimer.current);
    bindTimer.current = setInterval(() => {
      setBindCountdown(c => {
        if (c <= 1) { if (bindTimer.current) clearInterval(bindTimer.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  /** 确认绑定手机 */
  const doBindPhone = () => {
    setBindErr('');
    if (!bindCode.trim()) { setBindErr('请输入验证码'); return; }
    if (bindCode.trim() !== bindOtpRef.current) { setBindErr('验证码不正确'); return; }
    adminBindPhone(bindPhone);
    setBoundPhone(bindPhone);
    setBindPhone(''); setBindCode(''); setBindSent(false);
    setSheet(null);
  };

  /** 开始人脸录入 */
  const startFaceEnroll = async () => {
    setFaceMsg('');
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') { setFaceMsg('需要摄像头权限才能录入人脸'); return; }
    setFaceCamPerm(true);
    setFaceScanning(true);
    if (faceTimer.current) clearTimeout(faceTimer.current);
    faceTimer.current = setTimeout(() => {
      setFaceScanning(false);
      setFaceCamPerm(false);
      adminSetFaceEnrolled(true);
      setFaceEnrolled(true);
      setFaceMsg('✅ 人脸录入成功！下次可使用刷脸登录');
    }, 3000);
  };

  const maskedPhone = (p: string) => p.length >= 7 ? `${p.slice(0, 3)}****${p.slice(-4)}` : p;

  const opLogs = getOpLogs().slice(0, 20);

  // 功能开关配置列表
  const FEATURE_SWITCHES: {
    key: keyof AdminConfig;
    label: string;
    desc: string;
    sw: { value: boolean; toggle: () => void; saving: boolean; error: string | null };
  }[] = [
    { key: 'featureFloatWindow',  label: '悬浮窗功能开关', sw: swFloat,
      desc: '开启后应用在用户设备显示可移动悬浮窗，提供快捷功能入口（需用户授权悬浮窗权限）' },
    { key: 'featureNotification', label: '通知栏推送',     sw: swNotif,
      desc: '控制护航通知推送及权限请求（关闭后12分钟内不再请求）' },
    { key: 'featurePip',          label: '画中画功能',     sw: swPip,
      desc: '控制护航工具箱中画中画护航入口的显示状态' },
    { key: 'featureAutoUpdate',   label: '自动更新',       sw: swAuto,
      desc: '控制"发现新版本"更新弹窗及护航工具箱中自动更新入口' },
  ];

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
      {/* 🔧 功能可用性控制 */}
      <View style={{
        backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140',
        overflow: 'hidden',
      }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
          <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>🔧 功能可用性控制</Text>
        </View>
        <View style={{ padding: 16, gap: 0 }}>
          {FEATURE_SWITCHES.map((item, idx) => (
            <View key={item.key}>
              {idx > 0 && <View style={{ height: 1, backgroundColor: '#1E2530', marginVertical: 4 }} />}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: '500' }}>{item.label}</Text>
                  <Text style={{ color: '#667080', fontSize: 11, lineHeight: 16 }}>{item.desc}</Text>
                  <View style={{
                    alignSelf: 'flex-start',
                    backgroundColor: item.sw.value ? 'rgba(41,196,112,0.12)' : 'rgba(100,110,130,0.12)',
                    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2,
                  }}>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: item.sw.value ? '#29C470' : '#667080' }}>
                      {item.sw.saving ? '⏳ 保存中…' : item.sw.value ? '✅ 已开启' : '⭕ 已关闭'}
                    </Text>
                  </View>
                  {item.sw.error && (
                    <Text style={{ color: '#EF4444', fontSize: 10, marginTop: 2 }}>{item.sw.error}</Text>
                  )}
                </View>
                <Switch
                  value={item.sw.value}
                  onValueChange={item.sw.toggle}
                  disabled={item.sw.saving}
                  trackColor={{ false: '#2A3140', true: '#16A34A' }}
                  thumbColor={item.sw.value ? '#ffffff' : '#667080'}
                  style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
                />
              </View>
            </View>
          ))}

          {/* 开关工具栏 */}
          <View style={{ height: 1, backgroundColor: '#1E2530', marginVertical: 8 }} />
          {/* 悬浮窗详细配置入口 */}
          <Pressable cssInterop={false}
            onPress={() => router.push('/(app)/admin-float-window')}
            style={({ pressed }) => ({
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: pressed ? '#1A2535' : '#0D1520',
              borderRadius: 10, borderWidth: 1, borderColor: '#2A4060',
              padding: 12,
            })}>
            <Text style={{ fontSize: 20 }}>🪟</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '600' }}>悬浮窗详细配置</Text>
              <Text style={{ color: '#667080', fontSize: 11 }}>样式 · 位置 · 尺寸 · 权限引导 · 6项参数管理</Text>
            </View>
            <Text style={{ color: '#D4AF37', fontSize: 18 }}>›</Text>
          </Pressable>
          <View style={{ height: 1, backgroundColor: '#1E2530', marginVertical: 4 }} />
          <View style={{ gap: 8 }}>
            {/* 健康检测 */}
            <Pressable
              cssInterop={false}
              onPress={async () => {
                setHealthLoading(true);
                setHealthReport(null);
                const r = await runSwitchHealthCheck();
                setHealthReport(r);
                setHealthLoading(false);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: '#0D1117', borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: '#2A3140', opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontSize: 16 }}>🔍</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '600' }}>开关健康检测</Text>
                <Text style={{ color: '#667080', fontSize: 11 }}>模拟开启→保存→读取，验证所有开关持久化是否正常</Text>
              </View>
              {healthLoading && <ActivityIndicator size="small" color="#2563EB" />}
            </Pressable>

            {/* 健康报告内联展示 */}
            {healthReport && !healthLoading && (
              <View style={{
                backgroundColor: healthReport.allPassed ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                borderRadius: 10, padding: 12, borderWidth: 1,
                borderColor: healthReport.allPassed ? '#22C55E' : '#EF4444',
              }}>
                <Text style={{
                  color: healthReport.allPassed ? '#22C55E' : '#F59E0B',
                  fontSize: 12, fontWeight: 'bold', marginBottom: 8,
                }}>
                  {healthReport.allPassed ? '✅ 全部通过' : `⚠️ 通过 ${healthReport.items.filter(i => i.passed).length}/${healthReport.items.length} 项`}
                </Text>
                {healthReport.items.map(item => (
                  <View key={item.key} style={{ flexDirection: 'row', gap: 6, paddingVertical: 3 }}>
                    <Text style={{ fontSize: 12 }}>{item.passed ? '✅' : '❌'}</Text>
                    <Text style={{ color: item.passed ? '#8899AA' : '#EF4444', fontSize: 11, flex: 1 }}>
                      {item.label}
                      {!item.passed && `（内存:${String(item.memValue)} / DB:${String(item.dbValue)}）`}
                    </Text>
                  </View>
                ))}
                <Text style={{ color: '#445060', fontSize: 10, marginTop: 6 }}>
                  检测时间：{new Date(healthReport.generatedAt).toLocaleString('zh-CN')}
                </Text>
              </View>
            )}

            {/* 批量同步 */}
            <Pressable
              cssInterop={false}
              onPress={async () => {
                const r = await batchSyncSwitchesToDB();
                setSyncResult(r);
                setTimeout(() => setSyncResult(null), 3000);
              }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: '#0D1117', borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: '#2A3140', opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontSize: 16 }}>🔄</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '600' }}>批量同步开关到数据库</Text>
                <Text style={{ color: '#667080', fontSize: 11 }}>将当前所有开关状态强制写入数据库</Text>
              </View>
            </Pressable>
            {syncResult && (
              <Text style={{
                color: syncResult.ok ? '#22C55E' : '#EF4444',
                fontSize: 12, textAlign: 'center', paddingVertical: 4,
              }}>{syncResult.ok ? '✅ ' : '❌ '}{syncResult.msg}</Text>
            )}

            {/* 开关操作日志 */}
            <Pressable
              cssInterop={false}
              onPress={async () => {
                setSwitchLogsLoading(true);
                const logs = await loadSwitchLogs(50);
                setSwitchLogs(logs);
                setSwitchLogsLoading(false);
                setSheet('switch_logs');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: '#0D1117', borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: '#2A3140', opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ fontSize: 16 }}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '600' }}>开关操作日志</Text>
                <Text style={{ color: '#667080', fontSize: 11 }}>查看最近50条开关变更记录（操作人/时间/变更详情）</Text>
              </View>
              {switchLogsLoading && <ActivityIndicator size="small" color="#2563EB" />}
            </Pressable>

            {/* 发布前完整自检（指令6） */}
            <Pressable
              cssInterop={false}
              onPress={async () => {
                setFullCheckLoading(true);
                setFullCheckReport(null);
                const r = await runSelfCheck();
                setFullCheckReport(r);
                setFullCheckLoading(false);
                setSheet('full_check');
              }}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: pressed ? '#1A2535' : '#0D1117', borderRadius: 10, padding: 12,
                borderWidth: 1, borderColor: '#D4AF37', opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontSize: 16 }}>🚀</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#D4AF37', fontSize: 13, fontWeight: '700' }}>发布前完整自检（9项）</Text>
                <Text style={{ color: '#667080', fontSize: 11 }}>价格/代理/知识库/支付/开关/方案切换全量验证，通过才允许发布</Text>
              </View>
              {fullCheckLoading && <ActivityIndicator size="small" color="#D4AF37" />}
            </Pressable>
          </View>
        </View>
      </View>

      {/* AI管理 */}
      <Card title="AI管理">
        <RowItem label="🤖 AI控制中心" onPress={() => router.push('/(app)/ai-experience-center')} />
        <RowItem label="📋 AI建议队列" onPress={() => router.push('/(app)/agent-ai-monitor')} />
        <RowItem label="🔧 AI自动经营规则" onPress={() => router.push('/(app)/ai-auto-rules')} />
        <RowItem label="📣 代理流量协同" onPress={() => router.push('/(app)/ai-traffic-collab')} />
        <RowItem label="📊 优化报告（15天）" onPress={() => router.push({ pathname: '/(app)/optimization-report', params: { type: '15' } } as never)} />
        <RowItem label="📊 优化报告（30天）" onPress={() => router.push({ pathname: '/(app)/optimization-report', params: { type: '30' } } as never)} />
        <RowItem label="📜 优化历史记录" onPress={() => router.push('/(app)/optimization-history')} />
        <RowItem label="📝 操作日志" onPress={() => setSheet('op_logs')} />
      </Card>

      {/* 客服与链接 */}
      <Card title="客服与链接">
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>客服展示形态</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {CS_MODE_OPTIONS.map(({ k, label }) => (
              <Pressable cssInterop={false} key={k} onPress={() => upd('csMode', k)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                  backgroundColor: localCfg.csMode === k ? '#2563EB' : pressed ? '#1E2530' : '#0D0F12',
                  borderWidth: 1, borderColor: localCfg.csMode === k ? '#2563EB' : '#2A3140',
                })}>
                <Text style={{ color: localCfg.csMode === k ? '#fff' : '#8899AA', fontSize: 12 }}>{label}</Text>
              </Pressable>
            ))}
          </View>
          {localCfg.csMode === 'ai' && (
            <TextInput
              value={localCfg.csGreeting} onChangeText={v => upd('csGreeting', v)}
              placeholder="AI客服开场白" placeholderTextColor="#4A5568" multiline
              style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 13, marginTop: 6 }}
            />
          )}
          {localCfg.csMode === 'link' && (
            <TextInput
              value={localCfg.csUrl} onChangeText={v => upd('csUrl', v)}
              placeholder="请输入客服链接" placeholderTextColor="#4A5568"
              style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 13, marginTop: 6 }}
            />
          )}
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>最新版本APK下载链接（空=无新版本）</Text>
          <TextInput
            value={localCfg.latestApkUrl} onChangeText={v => upd('latestApkUrl', v)}
            placeholder="留空表示已是最新版本" placeholderTextColor="#4A5568"
            style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 13 }}
          />
        </View>
        <RowItem label="企业微信链接" value={localCfg.csUrl ? '已配置' : '未配置'} onPress={() => setSheet('qywx')} />
      </Card>

      {/* 💳 支付配置快捷入口（详细配置在"经营"Tab，此处仅展示当前状态） */}
      <Card title="💳 支付配置">
        <View style={{ gap: 8 }}>
          {/* 当前状态概览 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 20 }}>
              {(!localCfg.memberPayMode || localCfg.memberPayMode === 'off') ? '🔴' : (localCfg.memberPayLink || localCfg.memberPayQrUrl) ? '🟢' : '🟡'}
            </Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '600' }}>
                会员收款：{!localCfg.memberPayMode || localCfg.memberPayMode === 'off' ? '已关闭' : localCfg.memberPayMode}
              </Text>
              <Text style={{ color: '#667080', fontSize: 11 }}>
                {(localCfg.memberPayLink || localCfg.memberPayQrUrl) ? '✓ 收款配置已设置' : '⚠ 收款二维码/链接未配置'}
              </Text>
            </View>
          </View>
          <View style={{ height: 1, backgroundColor: '#2A3140' }} />
          <Text style={{ color: '#667080', fontSize: 11 }}>
            💡 完整的收款配置（含二维码上传）请前往【经营】Tab → 支付配置
          </Text>
        </View>
      </Card>

      {/* 🎨 智能推广配置（含海报二维码/链接可配置）*/}
      <Card title="🎨 智能推广配置">
        {/* 海报推广链接与二维码 */}
        <View style={{ backgroundColor: '#16A34A15', borderRadius: 10, borderWidth: 1, borderColor: '#16A34A30', padding: 12, gap: 10 }}>
          <Text style={{ color: '#4ADE80', fontSize: 11, fontWeight: 'bold' }}>📌 海报推广链接与二维码（可灵活配置）</Text>
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#8899AA', fontSize: 11 }}>推广链接（生成海报时自动填入）</Text>
            <TextInput
              value={localCfg.posterPromoLink ?? ''}
              onChangeText={v => upd('posterPromoLink', v)}
              placeholder="https://你的域名/invite?code=xxx"
              placeholderTextColor="#4A5568"
              style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 12 }}
            />
          </View>
          <View style={{ gap: 4 }}>
            <Text style={{ color: '#8899AA', fontSize: 11 }}>推广二维码图片URL（上传图片后填入URL）</Text>
            <TextInput
              value={localCfg.posterQrImageUrl ?? ''}
              onChangeText={v => upd('posterQrImageUrl', v)}
              placeholder="https://cdn.example.com/my_promo_qr.png"
              placeholderTextColor="#4A5568"
              style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 12 }}
            />
          </View>
          {(localCfg.posterPromoLink || localCfg.posterQrImageUrl) && (
            <Text style={{ color: '#4ADE80', fontSize: 11 }}>✓ 已配置自定义推广二维码/链接，生成海报时将优先使用</Text>
          )}
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>危机警示型主标题（用 | 分隔多个备选，每日自动轮换）</Text>
          <TextInput
            value={localCfg.posterTitle0}
            onChangeText={v => upd('posterTitle0', v)}
            placeholder="你打的牌局，真的公平吗？|你的牌局可能正被监视"
            placeholderTextColor="#4A5568"
            multiline
            style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 12, minHeight: 52 }}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>利益驱动型主标题</Text>
          <TextInput
            value={localCfg.posterTitle1}
            onChangeText={v => upd('posterTitle1', v)}
            placeholder="🎁 新用户专享：免费护航10分钟"
            placeholderTextColor="#4A5568"
            style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 12 }}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>权威背书型主标题（{'{N}'} 替换为动态数字）</Text>
          <TextInput
            value={localCfg.posterTitle2}
            onChangeText={v => upd('posterTitle2', v)}
            placeholder="{N}位牌友的共同选择"
            placeholderTextColor="#4A5568"
            style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 12 }}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>动态用户数基数（海报将在此基础上每日 ±50 微调）</Text>
          <TextInput
            value={String(localCfg.dynamicBaseCount)}
            onChangeText={v => upd('dynamicBaseCount', parseInt(v.replace(/\D/g, ''), 10) || 12847)}
            keyboardType="numeric"
            placeholder="12847"
            placeholderTextColor="#4A5568"
            style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 13 }}
          />
        </View>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>限时优惠文案（如"加赠5天"、"限时9折"；留空则不显示）</Text>
          <TextInput
            value={localCfg.bonusText}
            onChangeText={v => upd('bonusText', v)}
            placeholder="加赠5天"
            placeholderTextColor="#4A5568"
            style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 13 }}
          />
        </View>
        <View style={{ backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(37,99,235,0.2)', padding: 10, gap: 4 }}>
          <Text style={{ color: '#60A5FA', fontSize: 11, fontWeight: 'bold' }}>📋 推广文案模板配置</Text>
          <Text style={{ color: '#8899AA', fontSize: 10, lineHeight: 16 }}>{'文案中 {LINK} 将自动替换为推广链接，代理侧替换为代理专属链接'}</Text>
        </View>
        {([
          { key: 'promoTemplate0' as keyof AdminConfig, label: '恐惧唤醒型（牌友群/朋友圈）' },
          { key: 'promoTemplate1' as keyof AdminConfig, label: '利益诱惑型（微信群/QQ群）' },
          { key: 'promoTemplate2' as keyof AdminConfig, label: '用户见证型（朋友圈）' },
          { key: 'promoTemplate3' as keyof AdminConfig, label: '专家科普型（公众号/知乎）' },
        ]).map(({ key, label }) => (
          <View key={key} style={{ gap: 4 }}>
            <Text style={{ color: '#8899AA', fontSize: 11 }}>{label}</Text>
            <TextInput
              value={localCfg[key] as string}
              onChangeText={v => upd(key, v)}
              multiline
              placeholderTextColor="#4A5568"
              style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 12, minHeight: 72 }}
            />
          </View>
        ))}
      </Card>

      {/* 系统 */}
      <Card title="系统">
        <RowItem label="🔑 修改管理员密码" onPress={() => setSheet('change_pw')} />
        <RowItem label="📋 隐私政策" onPress={() => onShowPrivacyDoc()} />
        <View style={{ height: 1, backgroundColor: '#2A3140' }} />
        <RowItem label="退出登录" danger onPress={() => setShowLogoutConfirm(true)} />
      </Card>

      {/* ── 系统设置：扩展入口 ── */}
      <Card title="🛡️ 权限与角色管理">
        <Pressable onPress={() => router.push('/(app)/admin-permission' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F59E0B22',
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>👑</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 'bold' }}>RBAC权限管理</Text>
            <Text style={{ color: '#667080', fontSize: 11, marginTop: 2 }}>
              角色管理 · 管理员管理 · 分级授权 · 操作日志
            </Text>
          </View>
          <View style={{ backgroundColor: '#F59E0B22', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#F59E0B', fontSize: 10, fontWeight: 'bold' }}>超级管理员</Text>
          </View>
          <Text style={{ color: '#8899AA', fontSize: 18 }}>›</Text>
        </Pressable>
        <View style={{ height: 1, backgroundColor: '#2A3140' }} />
        <Pressable onPress={() => router.push('/(app)/sales-workspace' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 14 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EF444422',
            alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 20 }}>💼</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#F0F4FF', fontSize: 14, fontWeight: 'bold' }}>销售工作台</Text>
            <Text style={{ color: '#667080', fontSize: 11, marginTop: 2 }}>
              客户管理 · 折扣申请 · 推广链接 · 业绩追踪
            </Text>
          </View>
          <View style={{ backgroundColor: '#EF444422', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: 'bold' }}>销售专员</Text>
          </View>
          <Text style={{ color: '#8899AA', fontSize: 18 }}>›</Text>
        </Pressable>
      </Card>

      {/* 🔒 安全设置 */}
      <Card title="🔒 安全设置">
        <RowItem
          label="修改密码"
          value="修改后自动退出"
          onPress={() => { setOldPw(''); setNewPw(''); setConfirmPw(''); setPwErr(''); setSheet('sec_change_pw'); }}
        />
        <View style={{ height: 1, backgroundColor: '#2A3140' }} />
        <RowItem
          label="绑定/更换手机号"
          value={boundPhone ? maskedPhone(boundPhone) : '未绑定'}
          onPress={() => { setBindPhone(''); setBindCode(''); setBindSent(false); setBindErr(''); setSheet('sec_bind_phone'); }}
        />
        <View style={{ height: 1, backgroundColor: '#2A3140' }} />
        <RowItem
          label="录入/更换人脸"
          value={faceEnrolled ? '✅ 已录入' : '❌ 未录入'}
          onPress={() => { setFaceMsg(''); setSheet('sec_face'); }}
        />
      </Card>

      {/* 修改密码弹窗（系统卡旧入口，保留兼容） */}
      <BottomSheet visible={sheet === 'change_pw'} title="修改管理员密码" onClose={() => { setSheet(null); setPwErr(''); }}>
        <KeyboardAvoidingView>
          <View style={{ gap: 10 }}>
            {[
              { label: '当前密码', val: oldPw, set: setOldPw },
              { label: '新密码（至少6位）', val: newPw, set: setNewPw },
              { label: '确认新密码', val: confirmPw, set: setConfirmPw },
            ].map(f => (
              <View key={f.label} style={{ gap: 4 }}>
                <Text style={{ color: '#8899AA', fontSize: 11 }}>{f.label}</Text>
                <TextInput
                  value={f.val} onChangeText={f.set} secureTextEntry
                  placeholder="••••••" placeholderTextColor="#4A5568"
                  style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 14 }}
                />
              </View>
            ))}
            {pwErr !== '' && <Text style={{ color: '#EF4444', fontSize: 12 }}>{pwErr}</Text>}
            <Pressable cssInterop={false} onPress={doChangePw}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
                borderRadius: 12, paddingVertical: 13, alignItems: 'center',
              })}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>保存新密码</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* 安全设置：修改密码（改后强制退出） */}
      <BottomSheet visible={sheet === 'sec_change_pw'} title="🔑 修改密码" onClose={() => { setSheet(null); setPwErr(''); }}>
        <KeyboardAvoidingView>
          <View style={{ gap: 10 }}>
            <View style={{ backgroundColor: 'rgba(234,179,8,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(234,179,8,0.3)', padding: 10 }}>
              <Text style={{ color: '#FDE047', fontSize: 12, lineHeight: 18 }}>⚠️ 修改密码后将自动退出登录，请用新密码重新登录</Text>
            </View>
            {[
              { label: '旧密码', val: oldPw, set: setOldPw },
              { label: '新密码（至少6位）', val: newPw, set: setNewPw },
              { label: '确认新密码', val: confirmPw, set: setConfirmPw },
            ].map(f => (
              <View key={f.label} style={{ gap: 4 }}>
                <Text style={{ color: '#8899AA', fontSize: 11 }}>{f.label}</Text>
                <TextInput
                  value={f.val} onChangeText={t => { f.set(t); setPwErr(''); }} secureTextEntry
                  placeholder="••••••" placeholderTextColor="#4A5568"
                  style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 14 }}
                />
              </View>
            ))}
            {pwErr !== '' && <Text style={{ color: '#EF4444', fontSize: 12 }}>{pwErr}</Text>}
            <Pressable cssInterop={false} onPress={doChangePw}
              style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : '#2563EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center' })}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认修改并退出</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* 安全设置：绑定/更换手机号 */}
      <BottomSheet visible={sheet === 'sec_bind_phone'} title="📱 绑定/更换手机号" onClose={() => { setSheet(null); setBindErr(''); }}>
        <KeyboardAvoidingView>
          <View style={{ gap: 12 }}>
            {boundPhone ? (
              <View style={{ backgroundColor: 'rgba(37,99,235,0.1)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(37,99,235,0.3)', padding: 10 }}>
                <Text style={{ color: '#93C5FD', fontSize: 12 }}>当前绑定：{maskedPhone(boundPhone)}</Text>
              </View>
            ) : (
              <View style={{ backgroundColor: 'rgba(148,163,184,0.08)', borderRadius: 10, borderWidth: 1, borderColor: '#2A3140', padding: 10 }}>
                <Text style={{ color: '#8899AA', fontSize: 12 }}>当前未绑定手机号</Text>
              </View>
            )}
            <View style={{ gap: 4 }}>
              <Text style={{ color: '#8899AA', fontSize: 11 }}>新手机号</Text>
              <TextInput
                value={bindPhone} onChangeText={t => { setBindPhone(t); setBindErr(''); }}
                placeholder="请输入手机号" placeholderTextColor="#4A5568"
                keyboardType="phone-pad"
                style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 14 }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput
                value={bindCode} onChangeText={t => { setBindCode(t); setBindErr(''); }}
                placeholder="6位验证码" placeholderTextColor="#4A5568"
                keyboardType="number-pad" maxLength={6}
                style={{ flex: 1, backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 16, letterSpacing: 6, textAlign: 'center' }}
              />
              <Pressable cssInterop={false}
                onPress={sendBindSms}
                disabled={bindCountdown > 0}
                style={({ pressed }) => ({
                  backgroundColor: bindCountdown > 0 ? '#1A2030' : pressed ? '#1A5FCC' : '#2563EB',
                  borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center', minWidth: 90,
                })}>
                <Text style={{ color: bindCountdown > 0 ? '#4A5568' : '#fff', fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
                  {bindCountdown > 0 ? `${bindCountdown}s` : '获取验证码'}
                </Text>
              </Pressable>
            </View>
            {bindErr ? <Text style={{ color: '#EF4444', fontSize: 12 }}>{bindErr}</Text> : null}
            <Pressable cssInterop={false} onPress={doBindPhone}
              style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : '#2563EB', borderRadius: 12, paddingVertical: 13, alignItems: 'center' })}>
              <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认绑定</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </BottomSheet>

      {/* 安全设置：录入/更换人脸 */}
      <BottomSheet visible={sheet === 'sec_face' && !faceScanning} title="👤 录入/更换人脸" onClose={() => { setSheet(null); setFaceMsg(''); }}>
        <View style={{ gap: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 52 }}>{faceEnrolled ? '✅' : '❌'}</Text>
          <Text style={{ color: faceEnrolled ? '#4ADE80' : '#F87171', fontSize: 14, fontWeight: 'bold' }}>
            {faceEnrolled ? '人脸已录入' : '尚未录入人脸'}
          </Text>
          <Text style={{ color: '#8899AA', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
            录入人脸后，可在登录验证时使用刷脸方式{'\n'}快速进入管理后台
          </Text>
          {faceMsg ? <Text style={{ color: faceEnrolled ? '#4ADE80' : '#EF4444', fontSize: 12, textAlign: 'center' }}>{faceMsg}</Text> : null}
          <Pressable cssInterop={false}
            onPress={startFaceEnroll}
            style={({ pressed }) => ({ backgroundColor: pressed ? '#1A5FCC' : '#2563EB', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 40, alignItems: 'center' })}>
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>
              {faceEnrolled ? '重新录入人脸' : '开始录入人脸'}
            </Text>
          </Pressable>
        </View>
      </BottomSheet>

      {/* 人脸扫描弹层 */}
      <Modal visible={faceScanning} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
          <View style={{ width: 220, height: 220, borderRadius: 110, overflow: 'hidden', borderWidth: 3, borderColor: '#2563EB' }}>
            {faceCamPerm && <CameraView style={{ flex: 1 }} facing="front" />}
          </View>
          <Text style={{ color: '#F0F4FF', fontSize: 15, fontWeight: 'bold' }}>🔄 人脸录入中，请正视摄像头</Text>
          <Pressable onPress={() => { setFaceScanning(false); if (faceTimer.current) clearTimeout(faceTimer.current); }}>
            <Text style={{ color: '#8899AA', fontSize: 13 }}>取消</Text>
          </Pressable>
        </View>
      </Modal>

      {/* 企业微信链接弹窗 */}
      <BottomSheet visible={sheet === 'qywx'} title="企业微信链接" onClose={() => setSheet(null)}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#8899AA', fontSize: 11 }}>企业微信客服链接</Text>
          <TextInput
            value={localCfg.csUrl} onChangeText={v => upd('csUrl', v)}
            placeholder="请输入企业微信链接" placeholderTextColor="#4A5568"
            style={{ backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 14 }}
          />
        </View>
      </BottomSheet>

      {/* 操作日志弹窗 */}
      <BottomSheet visible={sheet === 'op_logs'} title="📝 操作日志" onClose={() => setSheet(null)}>
        {opLogs.length === 0 ? (
          <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center' }}>暂无操作日志</Text>
        ) : (
          opLogs.map(log => (
            <View key={log.id} style={{ gap: 4, borderBottomWidth: 1, borderBottomColor: '#2A3140', paddingBottom: 10 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 13 }}>{log.desc}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#8899AA', fontSize: 11, flex: 1 }}>
                  {new Date(log.time).toLocaleString('zh-CN')}
                </Text>
                {log.snapshot && (
                  <Pressable cssInterop={false} onPress={() => rollbackOpLog(log.id)}
                    style={({ pressed }) => ({
                      backgroundColor: pressed ? '#1E2530' : '#0D0F12',
                      borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                      borderWidth: 1, borderColor: '#F59E0B',
                    })}>
                    <Text style={{ color: '#F59E0B', fontSize: 11 }}>回滚</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </BottomSheet>

      {/* 开关操作日志 Sheet */}
      <BottomSheet visible={sheet === 'switch_logs'} title="📋 开关操作日志" onClose={() => setSheet(null)}>
        {switchLogsLoading && (
          <View style={{ alignItems: 'center', padding: 24 }}>
            <ActivityIndicator color="#2563EB" />
            <Text style={{ color: '#667080', marginTop: 8, fontSize: 12 }}>加载中…</Text>
          </View>
        )}
        {!switchLogsLoading && switchLogs.length === 0 && (
          <Text style={{ color: '#667080', textAlign: 'center', padding: 24, fontSize: 13 }}>暂无操作记录</Text>
        )}
        {!switchLogsLoading && switchLogs.filter(l => l.switch_key !== 'system').map(log => (
          <View key={log.id} style={{ borderBottomWidth: 1, borderBottomColor: '#1E2530', paddingVertical: 10, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '600', flex: 1 }}>{log.switch_label || log.switch_key}</Text>
              <View style={{
                backgroundColor: log.new_value === 'true' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2,
              }}>
                <Text style={{ color: log.new_value === 'true' ? '#22C55E' : '#EF4444', fontSize: 10, fontWeight: 'bold' }}>
                  {log.new_value === 'true' ? '开启' : log.new_value === 'false' ? '关闭' : log.new_value?.replace(/"/g, '')}
                </Text>
              </View>
            </View>
            <Text style={{ color: '#445060', fontSize: 10 }}>
              {log.module && `[${log.module}] `}操作人：{log.operator}
            </Text>
            <Text style={{ color: '#445060', fontSize: 10 }}>
              {new Date(log.created_at).toLocaleString('zh-CN')} · 旧值：{log.old_value?.replace(/"/g, '') ?? '—'}
            </Text>
          </View>
        ))}
      </BottomSheet>

      {/* 发布前完整自检报告（指令6） */}
      <BottomSheet visible={sheet === 'full_check'} title="🚀 发布前完整自检报告" onClose={() => setSheet(null)}>
        {fullCheckLoading && (
          <View style={{ alignItems: 'center', padding: 24 }}>
            <ActivityIndicator color="#D4AF37" />
            <Text style={{ color: '#667080', marginTop: 8, fontSize: 12 }}>正在运行自检（共9项）…</Text>
          </View>
        )}
        {!fullCheckLoading && fullCheckReport && (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* 总体结论 */}
            <View style={{
              backgroundColor: fullCheckReport.allPassed ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
              borderRadius: 10, padding: 14, marginBottom: 12,
              borderWidth: 1, borderColor: fullCheckReport.allPassed ? '#22C55E' : '#EF4444',
            }}>
              <Text style={{
                color: fullCheckReport.allPassed ? '#22C55E' : '#F59E0B',
                fontSize: 15, fontWeight: 'bold', textAlign: 'center',
              }}>
                {fullCheckReport.allPassed
                  ? `✅ 全部通过（${fullCheckReport.passCount}/${fullCheckReport.total}），可安全发布`
                  : `❌ ${fullCheckReport.passCount}/${fullCheckReport.total} 项通过，发布前请修复红色项`}
              </Text>
              {fullCheckReport.suggestion && (
                <Text style={{ color: '#F59E0B', fontSize: 11, textAlign: 'center', marginTop: 6 }}>
                  {fullCheckReport.suggestion}
                </Text>
              )}
            </View>

            {/* 逐项列表 */}
            {fullCheckReport.items.map(item => (
              <View key={item.id} style={{
                backgroundColor: '#0D1117', borderRadius: 8, padding: 12, marginBottom: 8,
                borderLeftWidth: 3, borderLeftColor: item.passed ? '#22C55E' : '#EF4444',
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <Text style={{ fontSize: 14 }}>{item.passed ? '✅' : '❌'}</Text>
                  <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: '600', flex: 1 }}>{item.name}</Text>
                </View>
                <Text style={{ color: item.passed ? '#667080' : '#F59E0B', fontSize: 11, lineHeight: 16 }}>
                  {item.detail}
                </Text>
              </View>
            ))}

            {/* 元信息 + 导出提示 */}
            <Text style={{ color: '#445060', fontSize: 10, textAlign: 'center', marginTop: 4, marginBottom: 16 }}>
              自检时间：{new Date(fullCheckReport.generatedAt).toLocaleString('zh-CN')}
            </Text>
          </ScrollView>
        )}
      </BottomSheet>

      {/* 退出确认弹窗 */}
      <Modal visible={showLogoutConfirm} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: '100%', backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', padding: 24, gap: 16, alignItems: 'center' }}>
            <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold' }}>确认退出管理后台？</Text>
            <Text style={{ color: '#8899AA', fontSize: 13, textAlign: 'center' }}>退出后需重新输入密码才能进入</Text>
            <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
              <Pressable onPress={onLogout}
                style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 10, paddingVertical: 13, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>确认退出</Text>
              </Pressable>
              <Pressable onPress={() => setShowLogoutConfirm(false)}
                style={{ flex: 1, backgroundColor: '#0D0F12', borderRadius: 10, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: '#2A3140' }}>
                <Text style={{ color: '#8899AA', fontSize: 14 }}>取消</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
