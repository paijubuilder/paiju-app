/**
 * 管理后台 — Tab2 经营管理
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { C } from '@/lib/colors';
import { supabase } from '@/client/supabase';
import { getConfig, saveConfig as _saveConfig } from '@/lib/appStore';
import type { AdminConfig } from '@/lib/appStore';
import PosterGenerator from '@/components/PosterGenerator';
import { PricePlanSelector } from '@/components/admin/AdminPricePlanTab';

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

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={{ color: '#8899AA', fontSize: 11 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8 }}>
        <Text style={{ color: '#8899AA', fontSize: 14, paddingLeft: 10 }}>¥</Text>
        <TextInput value={value} onChangeText={onChange} keyboardType="numeric" placeholderTextColor="#4A5568" style={{ flex: 1, color: '#F0F4FF', fontSize: 14, padding: 10 }} />
      </View>
    </View>
  );
}

// ─── Tab2: 经营 ────────────────────────────────────────────
// ─── RowItem（内部用） ────────────────────────────────────
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

export function BusinessTab({ config, onSave }: { config: AdminConfig; onSave: (p: Partial<AdminConfig>) => void }) {
  const [localCfg, setLocalCfg] = useState(config);
  const [sheet, setSheet] = useState<string | null>(null);
  // 链接保存提示
  const [memberLinkSaved, setMemberLinkSaved] = useState(false);
  const [agentLinkSaved, setAgentLinkSaved] = useState(false);
  const [showPoster, setShowPoster] = useState(false);
  const router = useRouter();

  // 从 DB 加载最新二维码 URL（保证管理端显示与服务器一致）
  useEffect(() => {
    supabase.from('qrcode_configs').select('config_key,image_url').then(({ data }) => {
      if (!data) return;
      const updates: Partial<AdminConfig> = {};
      for (const row of data) {
        if (row.config_key === 'member_qr' && row.image_url) updates.memberPayQrUrl = row.image_url;
        if (row.config_key === 'member_alipay_qr' && row.image_url) updates.memberAlipayQrUrl = row.image_url;
        if (row.config_key === 'agent_qr' && row.image_url) updates.agentPayQrUrl = row.image_url;
      }
      if (Object.keys(updates).length > 0) setLocalCfg(c => ({ ...c, ...updates }));
    });
  }, []);

  const upd = (k: keyof AdminConfig, v: unknown) => {
    const next = { ...localCfg, [k]: v };
    setLocalCfg(next as AdminConfig);
    onSave({ [k]: v });
  };

  const PAY_MODES = [
    { key: 'off',          label: '暂未开通',      icon: '🚫' },
    { key: 'wechat_link',  label: '微信支付链接',  icon: '💬' },
    { key: 'alipay_link',  label: '支付宝支付链接', icon: '🔵' },
    { key: 'qrcode',       label: '收款二维码',    icon: '📷' },
  ] as const;

  // 单选收款方式卡片（2列）
  const PayModeGrid = ({
    mode, onSelect,
  }: {
    mode: typeof PAY_MODES[number]['key'];
    onSelect: (k: typeof PAY_MODES[number]['key']) => void;
  }) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {PAY_MODES.map(m => {
        const selected = mode === m.key;
        return (
          <Pressable cssInterop={false} key={m.key} onPress={() => onSelect(m.key)}
            style={({ pressed }) => ({
              width: '47%', borderRadius: 10,
              backgroundColor: selected ? 'rgba(212,175,55,0.08)' : pressed ? '#1E2530' : '#0D0F12',
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? '#D4AF37' : '#2A3140',
              padding: 12, alignItems: 'center', gap: 4,
              position: 'relative',
            })}>
            <Text style={{ fontSize: 22 }}>{m.icon}</Text>
            <Text style={{ color: selected ? '#D4AF37' : '#8899AA', fontSize: 11, textAlign: 'center', fontWeight: selected ? 'bold' : 'normal' }}>
              {m.label}
            </Text>
            {selected && (
              <View style={{
                position: 'absolute', top: 5, right: 7,
                width: 18, height: 18, borderRadius: 9,
                backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ color: '#0D0F12', fontSize: 11, fontWeight: 'bold' }}>✓</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );

  // ── Canvas 隐私保护处理（Web Only）──────────────────────
  // 对二维码图片的四周边缘叠加半透明遮罩，保留中央二维码区域清晰
  const processQrForPrivacy = (localUri: string): Promise<string> =>
    new Promise((resolve, reject) => {
      if (typeof document === 'undefined') { resolve(localUri); return; }
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const W = img.naturalWidth;
        const H = img.naturalHeight;
        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(localUri); return; }

        // 1. 绘制原图
        ctx.drawImage(img, 0, 0, W, H);

        // 2. 叠加隐私保护遮罩（四周边缘区域）
        // 二维码通常占图片中央约 60%~70%，对四周剩余区域遮罩
        const maskColor = 'rgba(10, 12, 20, 0.82)';
        const cx = W * 0.15;   // 左边界（左15%遮住）
        const cy = H * 0.15;   // 上边界（上15%遮住）
        const cw = W * 0.70;   // 中央保留宽度（70%）
        const ch = H * 0.70;   // 中央保留高度（70%）

        ctx.fillStyle = maskColor;
        // 上条
        ctx.fillRect(0, 0, W, cy);
        // 下条
        ctx.fillRect(0, cy + ch, W, H - cy - ch);
        // 左条（中间段）
        ctx.fillRect(0, cy, cx, ch);
        // 右条（中间段）
        ctx.fillRect(cx + cw, cy, W - cx - cw, ch);

        // 3. 中央二维码区域加轻微边框提示
        ctx.strokeStyle = 'rgba(212,175,55,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, cy, cw, ch);

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = localUri;
    });

  // ── 二维码上传区域（选图→预览对比→选择→上传）──────────────
  const QrArea = ({
    configKey, qrUrl, onUploaded, onDelete,
  }: {
    configKey: 'member_qr' | 'member_alipay_qr' | 'agent_qr';
    qrUrl: string;
    onUploaded: (url: string) => void;
    onDelete: () => void;
  }) => {
    // 上传流程状态机：idle → choosing → uploading → idle
    const [phase, setPhase] = useState<'idle' | 'choosing' | 'uploading'>('idle');
    const [originalUri, setOriginalUri] = useState('');
    const [processedUri, setProcessedUri] = useState('');
    const [processing, setProcessing] = useState(false);
    const [uploadErr, setUploadErr] = useState('');
    const isWeb = typeof document !== 'undefined';

    // 重置到选图前状态
    const resetChoice = () => {
      setPhase('idle');
      setOriginalUri('');
      setProcessedUri('');
      setUploadErr('');
    };

    // 选图并生成预览
    const handlePick = async () => {
      setUploadErr('');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== 'granted') { setUploadErr('需要相册权限才能上传二维码'); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.92,
      });
      if (result.canceled) return;
      const localUri = result.assets[0].uri;
      setOriginalUri(localUri);
      setPhase('choosing');

      // Web 平台：异步生成隐私保护版
      if (isWeb) {
        setProcessing(true);
        try {
          const processed = await processQrForPrivacy(localUri);
          setProcessedUri(processed);
        } catch {
          setProcessedUri('');
        } finally {
          setProcessing(false);
        }
      }
    };

    // 执行上传（接受原图 URI 或处理后的 dataURL）
    const doUpload = async (uri: string) => {
      setUploadErr('');
      setPhase('uploading');
      try {
        let buf: ArrayBuffer;
        let mime: string;
        let ext: string;

        if (uri.startsWith('data:')) {
          // 处理后图片（dataURL → ArrayBuffer）
          const [header, b64] = uri.split(',');
          mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
          ext = mime === 'image/png' ? 'png' : 'jpg';
          const bstr = atob(b64);
          const u8 = new Uint8Array(bstr.length);
          for (let i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
          buf = u8.buffer;
        } else {
          // 原图（本地 URI → ArrayBuffer）
          const { fetch: expoFetch } = await import('expo/fetch');
          const resp = await expoFetch(uri);
          buf = await resp.arrayBuffer();
          ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
          mime = ext === 'png' ? 'image/png' : 'image/jpeg';
        }

        const path = `${configKey}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('qrcodes')
          .upload(path, buf, { contentType: mime, upsert: true });
        if (upErr) { setUploadErr('上传失败：' + upErr.message); setPhase('choosing'); return; }

        const { data: urlData } = supabase.storage.from('qrcodes').getPublicUrl(path);
        const publicUrl = urlData.publicUrl;

        const { error: dbErr } = await supabase
          .from('qrcode_configs')
          .upsert({ config_key: configKey, image_url: publicUrl, updated_at: new Date().toISOString() },
                   { onConflict: 'config_key' });
        if (dbErr) { setUploadErr('同步数据库失败：' + dbErr.message); setPhase('choosing'); return; }

        onUploaded(publicUrl);
        resetChoice();
      } catch (e: unknown) {
        setUploadErr('上传出错：' + (e instanceof Error ? e.message : '未知错误'));
        setPhase('choosing');
      }
    };

    const handleDelete = async () => {
      setUploadErr('');
      await supabase.from('qrcode_configs')
        .upsert({ config_key: configKey, image_url: '', updated_at: new Date().toISOString() },
                 { onConflict: 'config_key' });
      onDelete();
    };

    // ── 选择阶段 UI（双版本对比） ─────────────────────────
    if (phase === 'choosing' || phase === 'uploading') {
      const busy = phase === 'uploading';
      return (
        <View style={{ gap: 10, marginTop: 4 }}>
          {/* 对比预览标题 */}
          <View style={{ backgroundColor: 'rgba(212,175,55,0.08)', borderRadius: 8, borderWidth: 1, borderColor: 'rgba(212,175,55,0.25)', padding: 10 }}>
            <Text style={{ color: '#D4AF37', fontSize: 11, textAlign: 'center', lineHeight: 16 }}>
              请选择保存版本。隐私保护版将对二维码四周区域遮罩，保留扫码功能不受影响。
            </Text>
          </View>

          {/* 双列预览 */}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {/* 原图预览 */}
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: '#8899AA', fontSize: 11, textAlign: 'center', fontWeight: 'bold' }}>原图</Text>
              <View style={{ aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#2A3140' }}>
                <Image source={{ uri: originalUri }} style={{ flex: 1 }} contentFit="contain" />
              </View>
              <Pressable cssInterop={false}
                onPress={() => doUpload(originalUri)}
                disabled={busy}
                style={({ pressed }) => ({
                  borderRadius: 8, paddingVertical: 9, alignItems: 'center',
                  backgroundColor: busy ? '#2A3140' : pressed ? '#1A5FCC' : '#2563EB',
                })}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                  {busy ? '上传中…' : '使用原图'}
                </Text>
              </Pressable>
            </View>

            {/* 处理后预览 */}
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <Text style={{ color: '#8899AA', fontSize: 11, textAlign: 'center', fontWeight: 'bold' }}>隐私保护版</Text>
                {!isWeb && <Text style={{ color: '#667080', fontSize: 9 }}>（仅 Web 支持）</Text>}
              </View>
              <View style={{ aspectRatio: 1, borderRadius: 8, overflow: 'hidden', backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' }}>
                {processing ? (
                  <View style={{ gap: 6, alignItems: 'center' }}>
                    <ActivityIndicator color="#D4AF37" />
                    <Text style={{ color: '#667080', fontSize: 10 }}>处理中…</Text>
                  </View>
                ) : processedUri ? (
                  <Image source={{ uri: processedUri }} style={{ width: '100%', height: '100%' }} contentFit="contain" />
                ) : (
                  <Text style={{ color: '#3A4550', fontSize: 11, textAlign: 'center', paddingHorizontal: 8 }}>
                    {isWeb ? '处理失败\n请使用原图' : '当前环境\n不支持处理'}
                  </Text>
                )}
              </View>
              <Pressable cssInterop={false}
                onPress={() => processedUri ? doUpload(processedUri) : undefined}
                disabled={busy || !processedUri || processing}
                style={({ pressed }) => ({
                  borderRadius: 8, paddingVertical: 9, alignItems: 'center',
                  backgroundColor: (!processedUri || processing || busy)
                    ? '#1E2530'
                    : pressed ? '#1a5040' : '#0d3d2e',
                  borderWidth: 1,
                  borderColor: (!processedUri || processing || busy) ? '#2A3140' : '#22c55e',
                })}>
                <Text style={{
                  color: (!processedUri || processing || busy) ? '#3A4550' : '#22c55e',
                  fontSize: 11, fontWeight: 'bold',
                }}>
                  {busy ? '上传中…' : '使用处理后图片'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 取消 */}
          {!busy && (
            <Pressable onPress={resetChoice} style={{ alignItems: 'center', paddingVertical: 6 }}>
              <Text style={{ color: '#667080', fontSize: 11 }}>✕ 取消，重新选图</Text>
            </Pressable>
          )}
          {uploadErr ? <Text style={{ color: '#EF4444', fontSize: 10, textAlign: 'center' }}>{uploadErr}</Text> : null}
        </View>
      );
    }

    // ── 已上传 / 初始待上传 UI ─────────────────────────────
    return (
      <View style={{ alignItems: 'center', gap: 8, marginTop: 4 }}>
        {qrUrl ? (
          <>
            <View style={{ width: '100%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden', backgroundColor: '#0D0F12' }}>
              <Image source={{ uri: qrUrl }} style={{ flex: 1 }} contentFit="contain" />
            </View>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <Pressable cssInterop={false} onPress={handlePick}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
                  borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
                })}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>更换</Text>
              </Pressable>
              <Pressable cssInterop={false} onPress={handleDelete}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#CC2020' : '#EF4444',
                  borderRadius: 8, paddingVertical: 7, paddingHorizontal: 10,
                })}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>删除</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Pressable cssInterop={false} onPress={handlePick}
            style={({ pressed }) => ({
              width: '100%', aspectRatio: 1, borderRadius: 10,
              borderWidth: 2, borderStyle: 'dashed',
              borderColor: pressed ? '#D4AF37' : '#3A4550',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              backgroundColor: pressed ? 'rgba(212,175,55,0.05)' : 'transparent',
            })}>
            <Text style={{ color: '#3A4550', fontSize: 28 }}>＋</Text>
            <Text style={{ color: '#667080', fontSize: 11, textAlign: 'center' }}>点击上传</Text>
          </Pressable>
        )}
        {uploadErr ? <Text style={{ color: '#EF4444', fontSize: 10, textAlign: 'center' }}>{uploadErr}</Text> : null}
      </View>
    );
  };

  // 链接输入框 + 保存按钮
  const LinkInput = ({
    value, onChange, saved, onSave, placeholder,
  }: {
    value: string; onChange: (v: string) => void;
    saved: boolean; onSave: () => void; placeholder: string;
  }) => (
    <View style={{ gap: 6, marginTop: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TextInput
          value={value} onChangeText={onChange}
          placeholder={placeholder} placeholderTextColor="#4A5568"
          style={{ flex: 1, backgroundColor: '#0D0F12', borderWidth: 1, borderColor: '#2A3140', borderRadius: 8, padding: 10, color: '#F0F4FF', fontSize: 13 }}
        />
        <Pressable cssInterop={false} onPress={onSave}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#1A5FCC' : '#2563EB',
            borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14,
          })}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>保存链接</Text>
        </Pressable>
      </View>
      {saved && <Text style={{ color: '#29C470', fontSize: 12 }}>✅ 链接已保存</Text>}
    </View>
  );

  const handleSaveMemberLink = () => {
    upd('memberPayLink', localCfg.memberPayLink);
    setMemberLinkSaved(true);
    setTimeout(() => setMemberLinkSaved(false), 2000);
  };
  const handleSaveAgentLink = () => {
    upd('agentPayLink', localCfg.agentPayLink);
    setAgentLinkSaved(true);
    setTimeout(() => setAgentLinkSaved(false), 2000);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 120 }}>
      {/* 会员价格 */}
      <Card title="会员价格">
        {/* 价格方案选择器 */}
        <PricePlanSelector
          onApplied={() => {
            // 重新从 appStore 读取最新配置，刷新输入框
            const latest = getConfig();
            setLocalCfg(prev => ({ ...prev, ...latest }));
          }}
        />
        {/* 分隔线 */}
        <View style={{ height: 1, backgroundColor: '#2A3140', marginVertical: 4 }} />
        <Text style={{ color: '#8899AA', fontSize: 11, marginBottom: 4 }}>手动调整套餐名称与价格（修改后立即更新前端开通页）</Text>
        {([
          { label: '3天体验卡', priceKey: 'cost3Day' as keyof AdminConfig, titleKey: 'planTitle3Day' as keyof AdminConfig },
          { label: '30天月卡',  priceKey: 'cost30Day' as keyof AdminConfig, titleKey: 'planTitle30Day' as keyof AdminConfig },
          { label: '半年卡',    priceKey: 'cost180Day' as keyof AdminConfig, titleKey: 'planTitle180Day' as keyof AdminConfig },
          { label: '年卡',      priceKey: 'cost365Day' as keyof AdminConfig, titleKey: 'planTitle365Day' as keyof AdminConfig },
        ]).map(item => (
          <View key={item.priceKey} style={{ backgroundColor: '#0D1117', borderRadius: 10, padding: 10, gap: 6 }}>
            {/* 套餐名称输入框 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={{ color: '#8899AA', fontSize: 11, width: 52 }}>套餐名称</Text>
              <TextInput
                value={localCfg[item.titleKey] as string}
                onChangeText={v => upd(item.titleKey, v)}
                placeholder={item.label}
                placeholderTextColor="#445060"
                style={{ flex: 1, backgroundColor: '#161A1F', color: '#F0F4FF', fontSize: 13, borderRadius: 7, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: '#2A3140' }}
              />
            </View>
            {/* 价格行 */}
            <Pressable onPress={() => setSheet(`price_${item.priceKey}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 36 }}>
                <Text style={{ color: '#8899AA', fontSize: 11, width: 52 }}>价格</Text>
                <Text style={{ color: '#F0F4FF', fontSize: 14, flex: 1 }}>¥{localCfg[item.priceKey] as string}</Text>
                <Text style={{ color: '#8899AA', fontSize: 14 }}>点击修改 ›</Text>
              </View>
            </Pressable>
          </View>
        ))}
      </Card>

      {/* 代理费用 */}
      <Card title="代理费用">
        {[
          { label: '开通初级代理入会费', key: 'agentSignupFee' as keyof AdminConfig },
          { label: '初级升中级费用', key: 'costAgentMidUp' as keyof AdminConfig },
          { label: '中级升高级费用', key: 'costAgentHighUp' as keyof AdminConfig },
        ].map(item => (
          <Pressable key={item.key} onPress={() => setSheet(`price_${item.key}`)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 48 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 14, flex: 1 }}>{item.label}</Text>
              <Text style={{ color: '#8899AA', fontSize: 13 }}>¥{localCfg[item.key] as string}</Text>
              <Text style={{ color: '#8899AA', fontSize: 16, marginLeft: 6 }}>›</Text>
            </View>
          </Pressable>
        ))}
        {/* 拿货成本（只读展示，由方案应用自动计算） */}
        <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, borderTopWidth: 1, borderTopColor: '#2A3140', paddingTop: 10 }}>
          <Text style={{ color: '#8899AA', fontSize: 13, flex: 1 }}>初级拿货成本（年卡×折扣，自动）</Text>
          <Text style={{ color: '#667080', fontSize: 13 }}>¥{localCfg.costAgentBasic}</Text>
        </View>
      </Card>

      {/* 支付配置 — 拆分为两张独立卡片 */}

      {/* 💳 会员收款设置 */}
      <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
          <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>💳 会员收款设置</Text>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <PayModeGrid
            mode={localCfg.memberPayMode}
            onSelect={k => upd('memberPayMode', k)}
          />
          {(localCfg.memberPayMode === 'wechat_link' || localCfg.memberPayMode === 'alipay_link') && (
            <LinkInput
              value={localCfg.memberPayLink}
              onChange={v => setLocalCfg(c => ({ ...c, memberPayLink: v }))}
              saved={memberLinkSaved}
              onSave={handleSaveMemberLink}
              placeholder={localCfg.memberPayMode === 'wechat_link' ? '请输入微信支付链接' : '请输入支付宝支付链接'}
            />
          )}
          {localCfg.memberPayMode === 'qrcode' && (
            <View style={{ gap: 10 }}>
              <Text style={{ color: '#8899AA', fontSize: 11 }}>两个收款码独立上传，未上传的将在用户端自动隐藏</Text>
              {/* 双码并排 */}
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {/* 微信收款码 */}
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>💬</Text>
                    <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: 'bold' }}>微信收款码</Text>
                  </View>
                  <QrArea
                    configKey="member_qr"
                    qrUrl={localCfg.memberPayQrUrl}
                    onUploaded={(url) => {
                      const next = { ...localCfg, memberPayQrUrl: url };
                      setLocalCfg(next);
                      onSave({ memberPayQrUrl: url });
                    }}
                    onDelete={() => upd('memberPayQrUrl', '')}
                  />
                </View>
                {/* 分割线 */}
                <View style={{ width: 1, backgroundColor: '#2A3140', marginVertical: 4 }} />
                {/* 支付宝收款码 */}
                <View style={{ flex: 1, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 14 }}>🔵</Text>
                    <Text style={{ color: '#F0F4FF', fontSize: 12, fontWeight: 'bold' }}>支付宝收款码</Text>
                  </View>
                  <QrArea
                    configKey="member_alipay_qr"
                    qrUrl={localCfg.memberAlipayQrUrl}
                    onUploaded={(url) => {
                      const next = { ...localCfg, memberAlipayQrUrl: url };
                      setLocalCfg(next);
                      onSave({ memberAlipayQrUrl: url });
                    }}
                    onDelete={() => upd('memberAlipayQrUrl', '')}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </View>

      {/* 🤝 代理收款设置 */}
      <View style={{ backgroundColor: '#161A1F', borderRadius: 16, borderWidth: 1, borderColor: '#2A3140', overflow: 'hidden' }}>
        <View style={{ paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
          <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>🤝 代理收款设置</Text>
        </View>
        <View style={{ padding: 16, gap: 12 }}>
          <PayModeGrid
            mode={localCfg.agentPayMode}
            onSelect={k => upd('agentPayMode', k)}
          />
          {(localCfg.agentPayMode === 'wechat_link' || localCfg.agentPayMode === 'alipay_link') && (
            <LinkInput
              value={localCfg.agentPayLink}
              onChange={v => setLocalCfg(c => ({ ...c, agentPayLink: v }))}
              saved={agentLinkSaved}
              onSave={handleSaveAgentLink}
              placeholder={localCfg.agentPayMode === 'wechat_link' ? '请输入微信支付链接' : '请输入支付宝支付链接'}
            />
          )}
          {localCfg.agentPayMode === 'qrcode' && (
            <QrArea
              configKey="agent_qr"
              qrUrl={localCfg.agentPayQrUrl}
              onUploaded={(url) => {
                const next = { ...localCfg, agentPayQrUrl: url };
                setLocalCfg(next);
                onSave({ agentPayQrUrl: url });
              }}
              onDelete={() => upd('agentPayQrUrl', '')}
            />
          )}
        </View>
      </View>

      {/* ⚠️ 正式商用提醒 */}
      <View style={{ backgroundColor: 'rgba(245,158,11,0.08)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)', padding: 14, gap: 6 }}>
        <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: 'bold' }}>⚠️ 正式商用提醒</Text>
        <Text style={{ color: '#8899AA', fontSize: 11, lineHeight: 18 }}>
          {"收款二维码和支付链接仅适用于临时测试或个人收款场景。\n正式商用收款需注册微信商户号，开通Native支付，然后在秒哒后台「插件 > 微信支付 > 配置」填入商户资料以启用原生支付体验。"}
        </Text>
      </View>

      {/* 营销工具 */}
      <Card title="📣 营销推广">
        <RowItem label="📢 消息推送" onPress={() => router.push('/(app)/push-center')} />
        <RowItem label="🎨 推广海报与文案生成器" onPress={() => setShowPoster(true)} />
        <RowItem label="🔧 首页提示语管理" onPress={() => router.push('/(app)/home-title-editor' as never)} />
        <RowItem label="🔥 AI引流文案" onPress={() => router.push('/(app)/ai-traffic-collab')} />
      </Card>

      {/* 价格修改弹窗 */}
      {sheet?.startsWith('price_') && (() => {
        const key = sheet.replace('price_', '') as keyof AdminConfig;
        const labelMap: Partial<Record<keyof AdminConfig, string>> = {
          cost3Day: '3天体验卡价格', cost30Day: '30天月卡价格',
          cost180Day: '半年卡价格', cost365Day: '年卡价格',
          agentSignupFee: '开通初级代理入会费', costAgentMidUp: '初级升中级费',
          costAgentHighUp: '中级升高级费',
        };
        return (
          <BottomSheet visible title={labelMap[key] ?? '修改价格'} onClose={() => setSheet(null)}>
            <MoneyInput label="新价格" value={localCfg[key] as string} onChange={v => upd(key, v)} />
          </BottomSheet>
        );
      })()}

      {/* 智能推广海报与文案生成器 */}
      <PosterGenerator
        visible={showPoster}
        onClose={() => setShowPoster(false)}
        config={localCfg}
        mode="admin"
        qrImageUrl={localCfg.memberPayQrUrl}
      />


    </ScrollView>
  );
}
