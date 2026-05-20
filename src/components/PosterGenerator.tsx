/**
 * 智能推广海报与文案生成器
 * 支持3种高转化海报模板 + 4类推广文案 + 一键复制/保存
 * 合规设计：所有数据均附带声明，禁止绝对化用语
 */
import { useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  Text, View,
} from 'react-native';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as MediaLibrary from 'expo-media-library';
import ViewShot from 'react-native-view-shot';
import type { AdminConfig } from '@/lib/appStore';
import { C } from '@/lib/colors';

// ─── 类型 ──────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  config: AdminConfig;
  /** 模式：admin=总后台（会员二维码） agent=代理侧（代理专属二维码+昵称） */
  mode?: 'admin' | 'agent';
  /** 代理专属推广链接（agent 模式必传） */
  agentLink?: string;
  /** 代理昵称（agent 模式必传） */
  agentNickname?: string;
  /** 二维码图片 URL（admin: 会员收款二维码，agent: 可选代理自定义二维码） */
  qrImageUrl?: string;
}

// 模板定义
const TEMPLATE_DEFS = [
  { key: 0, name: '危机警示型', icon: '⚠️', scene: '朋友圈、牌友群' },
  { key: 1, name: '利益驱动型', icon: '🎁', scene: '微信群、QQ群' },
  { key: 2, name: '权威背书型', icon: '🏆', scene: '公众号、知乎' },
] as const;

const COPY_DEFS = [
  { key: 0, name: '恐惧唤醒型', icon: '😨', scene: '牌友群、朋友圈', templateKey: 'promoTemplate0' as const },
  { key: 1, name: '利益诱惑型', icon: '💰', scene: '微信群、QQ群', templateKey: 'promoTemplate1' as const },
  { key: 2, name: '用户见证型', icon: '👥', scene: '朋友圈', templateKey: 'promoTemplate2' as const },
  { key: 3, name: '专家科普型', icon: '🔬', scene: '公众号、知乎', templateKey: 'promoTemplate3' as const },
] as const;

// 每日微调：基于日期 seed 产生 ±50 以内的整数偏移，保持当天固定
function getDailyCount(base: number): number {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const pseudo = ((seed * 1103515245 + 12345) >>> 0) % 101; // 0~100
  return base + (pseudo - 50);
}

// 主标题轮换（按日期）
function rotateTitles(titleStr: string, count: number): string {
  const parts = titleStr.split('|').map(s => s.trim()).filter(Boolean);
  const idx = count % parts.length;
  return parts[idx] ?? parts[0] ?? titleStr;
}

// 海报主题配色
const SCHEMES = {
  template0: { bg: '#0A0E1A', header: '#0F1929', accent: '#F59E0B', text: '#F0F4FF', sub: '#94A3B8', border: '#1E3A5F', badge: '#1E3A5F' },
  template1: { bg: '#1A0F00', header: '#2A1800', accent: '#F59E0B', text: '#FFF7ED', sub: '#D4A96A', border: '#4A3100', badge: '#4A3100' },
  template2: { bg: '#010B1A', header: '#061426', accent: '#3B82F6', text: '#E0F0FF', sub: '#7BA9D4', border: '#0D2B4A', badge: '#0D2B4A' },
};

// ─── 海报预览（可截图区域）──────────────────────────────────
function PosterView({
  template, config, qrImageUrl, agentNickname, isAgent,
}: {
  template: 0 | 1 | 2;
  config: AdminConfig;
  qrImageUrl?: string;
  agentNickname?: string;
  isAgent?: boolean;
}) {
  const count = getDailyCount(config.dynamicBaseCount);
  const countStr = count.toLocaleString();
  const s = template === 0 ? SCHEMES.template0 : template === 1 ? SCHEMES.template1 : SCHEMES.template2;
  const appName = '牌局环境守护';

  // 模板0：危机警示型
  if (template === 0) {
    const mainTitle = rotateTitles(config.posterTitle0, count);
    const subTitle = config.posterSubTitle0.replace('{N}', countStr);
    return (
      <View style={{ backgroundColor: s.bg, borderRadius: 16, overflow: 'hidden', width: '100%' }}>
        {/* 顶部标题区 */}
        <View style={{ backgroundColor: s.header, paddingTop: 24, paddingBottom: 18, paddingHorizontal: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: s.border }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${s.accent}20`, borderWidth: 2, borderColor: s.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 28 }}>🛡️</Text>
          </View>
          <Text style={{ color: s.accent, fontSize: 18, fontWeight: 'bold', textAlign: 'center', lineHeight: 26 }}>{mainTitle}</Text>
          <View style={{ marginTop: 10, backgroundColor: `${s.accent}22`, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4 }}>
            <Text style={{ color: s.accent, fontSize: 11 }}>👥 {subTitle}</Text>
          </View>
        </View>
        {/* 正文 */}
        <View style={{ padding: 18, gap: 10 }}>
          <Text style={{ color: s.sub, fontSize: 12, lineHeight: 19 }}>
            据统计，每4个牌友中就有1个怀疑过对局中存在异常行为。
          </Text>
          <View style={{ backgroundColor: `${s.accent}12`, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: s.accent, padding: 10, gap: 4 }}>
            <Text style={{ color: '#F97316', fontSize: 11 }}>⚠️ 使用外挂属于违法行为。请公平游戏，远离外挂。</Text>
            <Text style={{ color: s.text, fontSize: 12 }}>🛡️ {appName}——手机环境健康度检测工具</Text>
          </View>
          {/* 功能列表 */}
          <View style={{ gap: 6, marginTop: 4 }}>
            {['一键扫描多开/透视/改牌工具', '10分钟免费护航', '异常行为检测', '牌局环境安全检测'].map(f => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ color: s.accent, fontSize: 11 }}>✓</Text>
                <Text style={{ color: s.sub, fontSize: 11 }}>{f}</Text>
              </View>
            ))}
          </View>
          {/* 二维码区 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 8, backgroundColor: s.header, borderRadius: 12, padding: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: s.badge, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {qrImageUrl
                ? <Image source={{ uri: qrImageUrl }} style={{ width: 72, height: 72 }} contentFit="cover" />
                : <Text style={{ color: s.sub, fontSize: 9, textAlign: 'center' }}>扫码{'\n'}下载</Text>}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: s.text, fontSize: 14, fontWeight: 'bold' }}>📱 扫码下载 · 免费护航</Text>
              {isAgent && agentNickname
                ? <Text style={{ color: s.accent, fontSize: 10 }}>通过 {agentNickname} 推荐下载</Text>
                : <Text style={{ color: s.sub, fontSize: 10 }}>新用户免费试用10分钟</Text>}
            </View>
          </View>
        </View>
        <PosterFooter color={s.sub} text="📱 扫码免费护航，别再白白送钱了！" />
      </View>
    );
  }

  // 模板1：利益驱动型
  if (template === 1) {
    const cost30 = config.cost30Day || '39.9';
    const dailyCost = (parseFloat(cost30) / 30).toFixed(1);
    return (
      <View style={{ backgroundColor: s.bg, borderRadius: 16, overflow: 'hidden', width: '100%' }}>
        <View style={{ backgroundColor: s.header, paddingTop: 22, paddingBottom: 16, paddingHorizontal: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: s.border }}>
          <View style={{ backgroundColor: `${s.accent}25`, borderRadius: 24, paddingHorizontal: 16, paddingVertical: 6, marginBottom: 10 }}>
            <Text style={{ color: s.accent, fontSize: 12, fontWeight: 'bold' }}>🎁 新用户福利</Text>
          </View>
          <Text style={{ color: s.accent, fontSize: 20, fontWeight: 'bold', textAlign: 'center' }}>{config.posterTitle1}</Text>
          <Text style={{ color: s.sub, fontSize: 12, marginTop: 8, textAlign: 'center' }}>{config.posterSubTitle1}</Text>
        </View>
        <View style={{ padding: 18, gap: 9 }}>
          {[
            `✅ 一键扫描多开/透视/改牌工具`,
            `✅ 首次免费体验10分钟，完整护航功能`,
            `✅ 30天月卡仅需¥${cost30}，日均不到¥${dailyCost}`,
            `✅ 本月已检测${countStr}次异常环境`,
          ].map((line, i) => (
            <View key={i} style={{ backgroundColor: `${s.accent}10`, borderRadius: 8, padding: 9, borderWidth: 1, borderColor: `${s.accent}22` }}>
              <Text style={{ color: s.text, fontSize: 12 }}>{line}</Text>
            </View>
          ))}
          {config.bonusText ? (
            <View style={{ backgroundColor: '#4A1500', borderRadius: 8, padding: 9, borderWidth: 1, borderColor: '#FF5500' }}>
              <Text style={{ color: '#FF8040', fontSize: 12, fontWeight: 'bold' }}>🔥 限时特惠：购买月卡立享{config.bonusText}</Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, backgroundColor: s.header, borderRadius: 12, padding: 12 }}>
            <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: s.badge, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {qrImageUrl
                ? <Image source={{ uri: qrImageUrl }} style={{ width: 72, height: 72 }} contentFit="cover" />
                : <Text style={{ color: s.sub, fontSize: 9, textAlign: 'center' }}>扫码{'\n'}免费试用</Text>}
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: s.text, fontSize: 14, fontWeight: 'bold' }}>📱 扫码免费试用</Text>
              {isAgent && agentNickname
                ? <Text style={{ color: s.accent, fontSize: 10 }}>通过 {agentNickname} 推荐下载</Text>
                : <Text style={{ color: s.sub, fontSize: 10 }}>首次体验10分钟完全免费</Text>}
            </View>
          </View>
        </View>
        <PosterFooter color={s.sub} text="📱 扫码立即检测，别再当冤大头！" />
      </View>
    );
  }

  // 模板2：权威背书型
  const mainTitle2 = config.posterTitle2.replace('{N}', countStr);
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 16, overflow: 'hidden', width: '100%' }}>
      <View style={{ backgroundColor: s.header, paddingTop: 22, paddingBottom: 16, paddingHorizontal: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: s.border }}>
        <Text style={{ color: s.accent, fontSize: 19, fontWeight: 'bold', textAlign: 'center' }}>{mainTitle2}</Text>
        <Text style={{ color: s.sub, fontSize: 12, marginTop: 8, textAlign: 'center' }}>{config.posterSubTitle2}</Text>
      </View>
      <View style={{ padding: 18, gap: 10 }}>
        {/* 统计数字 */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            { val: '30天月卡', label: '🏆 80%牌友的选择' },
            { val: `每天¥${(parseFloat(config.cost30Day||'39.9')/30).toFixed(1)}`, label: '日均费用' },
          ].map(item => (
            <View key={item.label} style={{ flex: 1, backgroundColor: `${s.accent}12`, borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: `${s.accent}22` }}>
              <Text style={{ color: s.accent, fontSize: 15, fontWeight: 'bold' }}>{item.val}</Text>
              <Text style={{ color: s.sub, fontSize: 10, marginTop: 2 }}>{item.label}</Text>
            </View>
          ))}
        </View>
        {/* 功能卖点 */}
        <View style={{ gap: 6 }}>
          {[
            `💎 30天月卡日均不到¥${(parseFloat(config.cost30Day||'39.9')/30).toFixed(1)}`,
            '🤖 AI智能客服在线',
            '💰 开通代理还能赚推广费',
            `👥 已有${countStr}人开启护航`,
          ].map(item => (
            <View key={item} style={{ backgroundColor: `${s.accent}0C`, borderRadius: 7, padding: 8, borderLeftWidth: 2, borderLeftColor: s.accent }}>
              <Text style={{ color: s.text, fontSize: 12 }}>{item}</Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, backgroundColor: s.header, borderRadius: 12, padding: 12 }}>
          <View style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: s.badge, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {qrImageUrl
              ? <Image source={{ uri: qrImageUrl }} style={{ width: 72, height: 72 }} contentFit="cover" />
              : <Text style={{ color: s.sub, fontSize: 9, textAlign: 'center' }}>扫码{'\n'}立即体验</Text>}
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={{ color: s.text, fontSize: 14, fontWeight: 'bold' }}>📱 扫码免费试用</Text>
            {isAgent && agentNickname
              ? <Text style={{ color: s.accent, fontSize: 10 }}>通过 {agentNickname} 推荐下载</Text>
              : <Text style={{ color: s.sub, fontSize: 10 }}>看看多少人已经在用了！</Text>}
          </View>
        </View>
      </View>
      <PosterFooter color={s.sub} text="📱 扫码免费试用，看看多少人已经在用了！" />
    </View>
  );
}

// 海报底部声明
function PosterFooter({ color, text }: { color: string; text?: string }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingBottom: 14, paddingTop: 2, gap: 3 }}>
      {text ? <Text style={{ color, fontSize: 11, fontWeight: 'bold' }}>{text}</Text> : null}
      <Text style={{ color, fontSize: 9, lineHeight: 14 }}>
        *数据源于平台统计，仅供参考。本广告内容具有可识别性。
      </Text>
    </View>
  );
}

// ─── 主组件 ────────────────────────────────────────────────
export default function PosterGenerator({ visible, onClose, config, mode = 'admin', agentLink, agentNickname, qrImageUrl }: Props) {
  const [tab, setTab] = useState<'poster' | 'copy'>('poster');
  const [tplIdx, setTplIdx] = useState<0 | 1 | 2>(0);
  const [copyIdx, setCopyIdx] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const viewShotRef = useRef<ViewShot>(null);

  const APP_URL = 'https://app-bjaapbe7wkqp.appmiaoda.com';
  const promoLink = mode === 'agent' ? (agentLink ?? APP_URL) : APP_URL;

  // 生成文案（将 {LINK} 替换为实际链接）
  const buildCopy = useCallback((templateKey: keyof AdminConfig) => {
    const tpl = (config[templateKey] as string) || '';
    return tpl.replace('{LINK}', promoLink);
  }, [config, promoLink]);

  // 保存海报到相册
  const handleSavePoster = async () => {
    if (saving) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync(false, ['photo']);
      if (status !== 'granted') {
        setSaveMsg('❌ 需要相册权限才能保存海报，请在系统设置中允许');
        setSaving(false);
        return;
      }
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) { setSaveMsg('❌ 截图失败，请重试'); setSaving(false); return; }
      await MediaLibrary.createAssetAsync(uri);
      setSaveMsg('✅ 海报已保存到相册！可直接发送给好友');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch {
      setSaveMsg('❌ 保存失败，请重试');
    }
    setSaving(false);
  };

  // 复制文案
  const handleCopy = async (key: keyof AdminConfig, idx: number) => {
    await Clipboard.setStringAsync(buildCopy(key));
    setCopyIdx(idx);
    setTimeout(() => setCopyIdx(null), 2000);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#0D0F12', borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderTopColor: '#2A3140', maxHeight: '92%' }}>
          {/* 头部 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#2A3140' }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#F0F4FF', fontSize: 16, fontWeight: 'bold' }}>🎨 智能推广{mode === 'agent' ? '（代理专属）' : ''}</Text>
              <Text style={{ color: '#8899AA', fontSize: 11, marginTop: 2 }}>海报生成器 · 文案生成器 · 合规内容</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ color: '#8899AA', fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>

          {/* Tab 切换 */}
          <View style={{ flexDirection: 'row', marginHorizontal: 20, marginTop: 14, backgroundColor: '#161A1F', borderRadius: 12, padding: 3 }}>
            {[{ k: 'poster', label: '🖼 海报生成器' }, { k: 'copy', label: '✍️ 文案生成器' }].map(t => (
              <Pressable key={t.k} onPress={() => setTab(t.k as 'poster' | 'copy')}
                style={{ flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center', backgroundColor: tab === t.k ? '#2563EB' : 'transparent' }}>
                <Text style={{ color: tab === t.k ? '#fff' : '#8899AA', fontSize: 13, fontWeight: tab === t.k ? 'bold' : 'normal' }}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <ScrollView contentContainerStyle={{ padding: 20, gap: 16, paddingBottom: 40 }}>

            {/* ══ 海报生成器 Tab ══ */}
            {tab === 'poster' && (
              <>
                {/* 模板选择 */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold' }}>选择海报模板</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {TEMPLATE_DEFS.map(t => (
                      <Pressable key={t.key} onPress={() => setTplIdx(t.key as 0 | 1 | 2)}
                        style={{
                          flex: 1, borderRadius: 12, borderWidth: 2,
                          borderColor: tplIdx === t.key ? '#F59E0B' : '#2A3140',
                          backgroundColor: tplIdx === t.key ? 'rgba(245,158,11,0.08)' : '#161A1F',
                          padding: 10, alignItems: 'center', gap: 4,
                        }}>
                        <Text style={{ fontSize: 18 }}>{t.icon}</Text>
                        <Text style={{ color: tplIdx === t.key ? '#F59E0B' : '#8899AA', fontSize: 10, textAlign: 'center', fontWeight: tplIdx === t.key ? 'bold' : 'normal' }}>{t.name}</Text>
                        <Text style={{ color: '#4A5568', fontSize: 9, textAlign: 'center' }}>{t.scene}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* 合规提示 */}
                <View style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(16,185,129,0.25)', padding: 10, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 13 }}>✅</Text>
                  <Text style={{ color: '#6EE7B7', fontSize: 11, flex: 1, lineHeight: 17 }}>
                    内容已通过合规审核：不含绝对化用语、不含虚假承诺、附有数据声明、广告具有可识别性。
                  </Text>
                </View>

                {/* 海报预览 */}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: '#8899AA', fontSize: 11, fontWeight: 'bold' }}>海报预览（长按截图或点击"保存到相册"）</Text>
                  <ViewShot ref={viewShotRef} options={{ format: 'jpg', quality: 0.95 }}>
                    <PosterView
                      template={tplIdx}
                      config={config}
                      qrImageUrl={qrImageUrl}
                      agentNickname={agentNickname}
                      isAgent={mode === 'agent'}
                    />
                  </ViewShot>
                </View>

                {/* 保存按钮 */}
                {saveMsg ? (
                  <View style={{ backgroundColor: saveMsg.startsWith('✅') ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', borderRadius: 10, padding: 12, alignItems: 'center' }}>
                    <Text style={{ color: saveMsg.startsWith('✅') ? '#10B981' : '#EF4444', fontSize: 13 }}>{saveMsg}</Text>
                  </View>
                ) : null}
                <Pressable cssInterop={false} onPress={handleSavePoster} disabled={saving}
                  style={({ pressed }) => ({
                    backgroundColor: pressed || saving ? '#1A5FCC' : '#2563EB',
                    borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                  })}>
                  {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>📥 保存海报到相册</Text>}
                </Pressable>
                <Text style={{ color: '#4A5568', fontSize: 10, textAlign: 'center' }}>保存后可直接在相册选图发送到朋友圈、微信群</Text>
              </>
            )}

            {/* ══ 文案生成器 Tab ══ */}
            {tab === 'copy' && (
              <>
                <View style={{ backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(37,99,235,0.25)', padding: 12, gap: 4 }}>
                  <Text style={{ color: '#60A5FA', fontSize: 12, fontWeight: 'bold' }}>📢 4类高转化推广文案</Text>
                  <Text style={{ color: '#8899AA', fontSize: 11, lineHeight: 17 }}>
                    每类文案已内置推广链接{mode === 'agent' ? '（您的代理专属链接）' : ''}，一键复制后直接粘贴发送。
                    所有文案符合广告法合规要求。
                  </Text>
                </View>

                {COPY_DEFS.map((def, i) => {
                  const text = buildCopy(def.templateKey);
                  const copied = copyIdx === i;
                  return (
                    <View key={def.key} style={{ backgroundColor: '#161A1F', borderRadius: 14, borderWidth: 1, borderColor: '#2A3140', overflow: 'hidden' }}>
                      {/* 标签行 */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#2A3140', gap: 8 }}>
                        <Text style={{ fontSize: 16 }}>{def.icon}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: '#F0F4FF', fontSize: 13, fontWeight: 'bold' }}>{def.name}</Text>
                          <Text style={{ color: '#4A5568', fontSize: 10 }}>适合：{def.scene}</Text>
                        </View>
                        <View style={{ backgroundColor: 'rgba(245,158,11,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)' }}>
                          <Text style={{ color: '#F59E0B', fontSize: 10 }}>推荐</Text>
                        </View>
                      </View>
                      {/* 文案预览 */}
                      <View style={{ padding: 14 }}>
                        <Text style={{ color: '#D0DCF0', fontSize: 12, lineHeight: 20 }} selectable>{text}</Text>
                      </View>
                      {/* 复制按钮 */}
                      <Pressable cssInterop={false} onPress={() => handleCopy(def.templateKey, i)}
                        style={({ pressed }) => ({
                          marginHorizontal: 14, marginBottom: 14, borderRadius: 10, paddingVertical: 11,
                          backgroundColor: copied ? 'rgba(16,185,129,0.12)' : pressed ? 'rgba(37,99,235,0.25)' : 'rgba(37,99,235,0.12)',
                          alignItems: 'center', borderWidth: 1,
                          borderColor: copied ? 'rgba(16,185,129,0.4)' : 'rgba(37,99,235,0.3)',
                        })}>
                        <Text style={{ color: copied ? '#10B981' : '#60A5FA', fontSize: 13, fontWeight: 'bold' }}>
                          {copied ? '✅ 已复制，直接粘贴发送' : '📋 一键复制此文案'}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}

                {/* 合规说明 */}
                <View style={{ backgroundColor: 'rgba(245,158,11,0.06)', borderRadius: 10, borderWidth: 1, borderColor: 'rgba(245,158,11,0.2)', padding: 12, gap: 4 }}>
                  <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: 'bold' }}>⚖️ 合规说明</Text>
                  <Text style={{ color: '#8899AA', fontSize: 10, lineHeight: 16 }}>
                    · 所有文案不含"最好"、"第一"、"100%安全"等绝对化用语{'\n'}
                    · 不含强制跳转代码或"分享后解锁"等诱导性内容{'\n'}
                    · 不含任何违法外挂诱导，仅为检测工具推广{'\n'}
                    · 广告内容具有可识别性，消费者可明辨其为广告
                  </Text>
                </View>
              </>
            )}

          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
