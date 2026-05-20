/**
 * APK主推安装引导页 v2
 * 触发场景：首次打开 / 任意平台引导安装
 * 包含：大号APK下载按钮 / 三步动态教程 / 一键权限开启 / 底部网页版入口
 * 苹果设备：顶部醒目提醒横幅 + APK按钮置灰
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { getConfig } from '@/lib/appStore';

const APP_URL = 'https://app-bjaapbe7wkqp.appmiaoda.com';

// 设备类型检测（使用 EXPO_OS，不用 Platform.OS）
const isIOS = process.env.EXPO_OS === 'ios';

// ── 脉冲动画下载按钮 ─────────────────────────────────────
function PulseDownloadBtn({ onPress }: { onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.parallel([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0.7, duration: 900, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, [pulse, glow]);

  return (
    <Animated.View style={{ transform: [{ scale: pulse }], opacity: glow }}>
      <Pressable cssInterop={false}
        onPress={onPress}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#B8960A' : C.GOLD,
          borderRadius: 18, paddingVertical: 18, paddingHorizontal: 32,
          alignItems: 'center', gap: 4,
          boxShadow: `0 4px 20px rgba(212,175,55,0.5)`,
        })}
      >
        <Text style={{ color: '#0D0F12', fontSize: 20, fontWeight: 'bold' }}>
          ⬇️ 下载APK安装包
        </Text>
        <Text style={{ color: '#0D0F12', fontSize: 11, opacity: 0.75 }}>
          安卓手机直接下载安装，完整体验所有功能
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ── 步骤卡片 ─────────────────────────────────────────────
function StepCard({
  step, icon, title, desc, extra, active,
}: {
  step: number;
  icon: string;
  title: string;
  desc: string;
  extra?: React.ReactNode;
  active: boolean;
}) {
  const fadeIn = useRef(new Animated.Value(active ? 1 : 0.42)).current;
  const numPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: active ? 1 : 0.42, duration: 400, useNativeDriver: true }).start();
    if (active) {
      const loop = Animated.loop(Animated.sequence([
        Animated.timing(numPulse, { toValue: 1.25, duration: 700, useNativeDriver: true }),
        Animated.timing(numPulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      loop.start();
      return () => loop.stop();
    }
  }, [active, fadeIn, numPulse]);

  return (
    <Animated.View
      style={{
        opacity: fadeIn,
        backgroundColor: active ? 'rgba(43,123,255,0.10)' : C.PANEL,
        borderRadius: 16, borderWidth: 1.5,
        borderColor: active ? C.BLUE : C.BORDER,
        padding: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 14,
      }}
    >
      {/* 大号步骤数字 */}
      <Animated.View style={{ transform: [{ scale: active ? numPulse : 1 }] }}>
        <View style={{
          width: 44, height: 44, borderRadius: 22,
          backgroundColor: active ? C.BLUE : C.PANEL2,
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Text style={{ color: active ? '#fff' : C.GRAY, fontSize: 20, fontWeight: 'bold' }}>
            {'❶❷❸'[step - 1]}
          </Text>
        </View>
      </Animated.View>

      <View style={{ flex: 1, gap: 6 }}>
        {/* 动图模拟图标 */}
        <Text style={{ fontSize: 32 }}>{icon}</Text>
        <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>{title}</Text>
        <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>{desc}</Text>
        {extra}
      </View>
    </Animated.View>
  );
}

// ── 主页面 ───────────────────────────────────────────────
export default function ApkInstallScreen() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(1);

  // 步骤自动轮播：每3秒前进一步循环
  useEffect(() => {
    const t = setInterval(() => {
      setActiveStep(s => s < 3 ? s + 1 : 1);
    }, 3000);
    return () => clearInterval(t);
  }, []);

  const handleDownload = () => {
    const cfg = getConfig();
    const url = cfg.latestApkUrl?.trim() || APP_URL;
    Linking.openURL(url).catch(() => {});
  };

  const openPermissionSettings = () => {
    const url = 'android.settings.MANAGE_UNKNOWN_APP_SOURCES';
    Linking.canOpenURL(`intent:#Intent;action=${url};end`).then(ok => {
      if (ok) {
        Linking.openURL(`intent:#Intent;action=${url};end`).catch(() => Linking.openSettings());
      } else {
        Linking.openSettings();
      }
    }).catch(() => Linking.openSettings());
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        contentInsetAdjustmentBehavior="automatic"
        showsVerticalScrollIndicator={false}
      >
        {/* ── 顶部返回 ─────────────────────────────────── */}
        <View style={{ paddingTop: 52, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
        </View>

        {/* ── 苹果设备提醒横幅 ─────────────────────────── */}
        {isIOS && (
          <View style={{
            marginHorizontal: 16, marginTop: 14,
            backgroundColor: '#FFF4D6',
            borderRadius: 14, borderWidth: 1.5, borderColor: '#F5C842',
            padding: 14, gap: 6,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={{ fontSize: 20 }}>⚠️</Text>
              <Text style={{ flex: 1, color: '#7A5200', fontSize: 13, fontWeight: 'bold', lineHeight: 20 }}>
                🍎 苹果版本正在紧急开发中，即将上架App Store，敬请期待！
              </Text>
            </View>
          </View>
        )}

        {/* ── 标题区 ───────────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, marginTop: 20, gap: 6, alignItems: 'center' }}>
          <Text style={{ color: C.WHITE, fontSize: 26, fontWeight: 'bold', textAlign: 'center' }}>
            📱 下载安装牌局环境守护
          </Text>
          <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center' }}>
            完整体验通知栏护航提醒功能
          </Text>
        </View>

        {/* ── 三大卖点 ─────────────────────────────────── */}
        <View style={{
          flexDirection: 'row', justifyContent: 'center', gap: 10,
          marginTop: 20, paddingHorizontal: 20,
        }}>
          {[
            { icon: '🛡️', label: '护航检测' },
            { icon: '⚡', label: '极速环境检测' },
            { icon: '🔒', label: '自动登录记忆' },
          ].map(item => (
            <View key={item.label} style={{
              flex: 1, backgroundColor: 'rgba(43,123,255,0.12)',
              borderRadius: 12, borderWidth: 1, borderColor: 'rgba(43,123,255,0.4)',
              paddingVertical: 12, alignItems: 'center', gap: 4,
            }}>
              <Text style={{ fontSize: 22 }}>{item.icon}</Text>
              <Text style={{ color: C.BLUE, fontSize: 11, fontWeight: 'bold', textAlign: 'center' }}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>

        {/* ── APK下载按钮 ──────────────────────────────── */}
        <View style={{ paddingHorizontal: 24, marginTop: 28, alignItems: 'center' }}>
          {isIOS ? (
            // 苹果设备：置灰按钮，防止误点
            <View style={{ width: '100%', gap: 10, alignItems: 'center' }}>
              <View style={{
                width: '100%', backgroundColor: '#2A2E38',
                borderRadius: 18, paddingVertical: 18, paddingHorizontal: 32,
                alignItems: 'center', gap: 4,
                borderWidth: 1, borderColor: '#3A3E48',
              }}>
                <Text style={{ color: '#666C80', fontSize: 18, fontWeight: 'bold' }}>
                  🍎 苹果版本即将上线
                </Text>
                <Text style={{ color: '#555A68', fontSize: 11 }}>
                  App Store 上架中，敬请期待
                </Text>
              </View>
            </View>
          ) : (
            // 安卓设备：正常脉冲下载按钮
            <PulseDownloadBtn onPress={handleDownload} />
          )}
        </View>

        {/* ── 三步动态教程 ─────────────────────────────── */}
        <View style={{ paddingHorizontal: 20, marginTop: 28, gap: 12 }}>
          <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold', marginBottom: 4 }}>
            📋 安装步骤
          </Text>

          <StepCard
            step={1} active={activeStep === 1}
            icon="📥" title="下载完成后，点击通知栏打开"
            desc="下载完成后，手机通知栏会出现下载完成的提示，点击即可打开安装包。"
          />
          <StepCard
            step={2} active={activeStep === 2}
            icon="⚙️" title="如提示「未知来源」无法安装"
            desc="系统可能需要您开启「安装未知应用」权限，点击下方按钮一键开启。"
            extra={
              <Pressable cssInterop={false}
                onPress={openPermissionSettings}
                style={({ pressed }) => ({
                  marginTop: 8, backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                  borderRadius: 10, paddingVertical: 10, alignItems: 'center',
                })}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                  🔑 一键开启安装权限
                </Text>
              </Pressable>
            }
          />
          <StepCard
            step={3} active={activeStep === 3}
            icon="✅" title="返回安装包，点击安装"
            desc="权限开启后返回安装包，点击安装即可。桌面出现图标代表安装成功！"
          />

          {/* 步骤进度圆点 */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 4 }}>
            {[1, 2, 3].map(i => (
              <Pressable key={i} onPress={() => setActiveStep(i)}>
                <View style={{
                  width: activeStep === i ? 20 : 8, height: 8, borderRadius: 4,
                  backgroundColor: activeStep === i ? C.BLUE : C.BORDER,
                  ...(activeStep === i ? { boxShadow: `0 0 6px ${C.BLUE}` } : {}),
                }} />
              </Pressable>
            ))}
          </View>
        </View>

        {/* ── 一键权限开启区 ──────────────────────────── */}
        <View style={{
          marginHorizontal: 20, marginTop: 24,
          backgroundColor: C.PANEL, borderRadius: 16, borderWidth: 1,
          borderColor: C.BORDER, padding: 16, gap: 12,
        }}>
          <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>
            🔧 一键开启所有必要权限
          </Text>

          {[
            { label: '通知权限', desc: '护航期间关键状态通知需要此权限', onPress: openPermissionSettings },
            { label: '安装未知应用权限', desc: '安装本APK时系统会提示开启', onPress: openPermissionSettings },
          ].map(item => (
            <View key={item.label} style={{
              flexDirection: 'row', alignItems: 'center',
              backgroundColor: C.PANEL2, borderRadius: 12, padding: 12, gap: 12,
            }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: C.WHITE, fontSize: 13, fontWeight: 'bold' }}>{item.label}</Text>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>{item.desc}</Text>
              </View>
              <Pressable cssInterop={false}
                onPress={item.onPress}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                  borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14,
                })}
              >
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>一键开启</Text>
              </Pressable>
            </View>
          ))}
        </View>

        {/* ── 底部次要入口 ─────────────────────────────── */}
        <View style={{ marginTop: 28, alignItems: 'center', gap: 8 }}>
          <Pressable onPress={() => router.push('/(app)/(tabs)/home' as never)}>
            <Text style={{ color: C.GRAY2, fontSize: 12 }}>
              或用浏览器打开网页版（功能受限）
            </Text>
          </Pressable>
          <Text style={{ color: C.GRAY2, fontSize: 10 }}>
            网页版不含完整通知推送功能，APK版体验更佳
          </Text>
          {/* 安卓/苹果用户分流提示 */}
          <View style={{
            marginTop: 8, paddingHorizontal: 20, paddingVertical: 10,
            backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10,
            borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
          }}>
            <Text style={{ color: '#667080', fontSize: 11, textAlign: 'center', lineHeight: 17 }}>
              💡 安卓用户可正常下载安装，苹果用户请耐心等待
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
