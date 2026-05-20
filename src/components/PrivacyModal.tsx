/**
 * 首次隐私授权弹窗 + 隐私政策 / 用户协议子弹窗
 * v2: localStorage本地缓存，同意后不再弹出；底部APK引导
 */
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { C } from '@/lib/colors';
import { acceptPrivacy } from '@/lib/appStore';

// 本地缓存 key
const PRIVACY_CACHE_KEY = 'pjhh_privacy_accepted_v1';

// 检查本地缓存是否已同意
export function isPrivacyCachedAccepted(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PRIVACY_CACHE_KEY) === '1';
  } catch {
    return false;
  }
}

// 写入本地缓存
function cachePrivacyAccepted() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PRIVACY_CACHE_KEY, '1');
  } catch {
    // ignore
  }
}

// ─── 协议内容 ────────────────────────────────────────────
export const PRIVACY_TEXT = `牌局环境守护 · 隐私政策

一、信息收集
我们仅收集您的设备标识码，用于绑定试用时间和会员权益，防止信息丢失。我们申请通知权限，用于在护航时实时推送护航状态提醒。

二、信息使用
上述信息仅用于本应用功能实现，不会向任何第三方提供、出售或分享。

三、信息存储
您的设备标识码和会员信息存储在云端服务器，采用加密传输保护。

四、第三方服务声明
如您使用微信登录或微信支付功能，相关微信SDK可能会收集必要的设备信息以完成服务。我们仅与依法合规的第三方服务商合作，并会以合理方式告知您相关信息收集情况。上述第三方服务的隐私保护规则，请参阅其各自发布的隐私政策。

五、您的权利
您可以在设备设置中随时撤回已授予的权限，但可能导致部分功能无法正常使用。

六、政策更新
本隐私政策可能适时修订，修订后的版本将在本页面公示。

如您同意以上条款，请勾选同意并继续使用。`;

const USER_AGREEMENT_TEXT = `牌局环境守护 · 用户协议

一、产品说明
本产品是一款手机环境健康度检测工具，通过通用技术扫描手机基础环境状态。检测功能为模拟展示，检测结果仅供娱乐和辅助参考。本产品非第三方测评机构，检测结果为通用环境扫描，不针对任何特定商品或服务进行评测。本产品非任何特定游戏的外挂、作弊工具或官方插件，不读取、不修改任何第三方游戏数据。

二、功能说明
新用户享有免费试用时长，试用到期后需开通会员继续使用。会员时长以购买时选择的套餐为准，到期后功能自动锁定。

三、免责声明
本产品检测结果仅供辅助参考，用户应结合实际情况自行判断。用户不得将本产品用于任何违法违规用途。

四、退款政策
激活定义：支付成功后会员权益即开通；首次点击「开始守护本局」且护航成功启动，视为已激活使用。退款界限：已开通未激活可联系客服申请退款；已激活视为数字化商品已交付使用，不支持退款；会员有效期届满后无论是否激活均不予退还。本产品属于在线交付的数字化虚拟商品，一经开通即刻生效并与设备绑定，无法逆向回兑为现金。

五、其他
使用本产品即视为同意本协议全部条款。本协议的解释与适用，以中华人民共和国法律法规为准。`;

// ─── 协议内容子弹窗 ──────────────────────────────────────
function DocModal({
  visible,
  title,
  content,
  onClose,
}: {
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: C.PANEL, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '82%' }}>
          {/* 标题行 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
            <Text style={{ flex: 1, color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ color: C.GRAY, fontSize: 22, lineHeight: 24 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <Text style={{ color: C.GRAY, fontSize: 13, lineHeight: 22 }}>{content}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── 主弹窗 ───────────────────────────────────────────────
interface Props {
  visible: boolean;
  onAccept: () => void;
}

export default function PrivacyModal({ visible, onAccept }: Props) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);

  const handleAccept = () => {
    if (!checked) return;
    acceptPrivacy();
    cachePrivacyAccepted();
    onAccept();
  };

  return (
    <>
      <Modal visible={visible} animationType="fade" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <View style={{
            width: '100%', backgroundColor: C.PANEL,
            borderRadius: 20, borderWidth: 1, borderColor: C.BORDER,
            overflow: 'hidden',
          }}>
            {/* 顶部蓝色装饰条 */}
            <View style={{ height: 4, backgroundColor: C.BLUE }} />

            <ScrollView contentContainerStyle={{ padding: 24, gap: 20 }}>
              {/* 图标 + 标题 */}
              <View style={{ alignItems: 'center', gap: 8 }}>
                <View style={{
                  width: 64, height: 64, borderRadius: 16,
                  backgroundColor: C.BLUE_BG, borderWidth: 1.5, borderColor: `${C.BLUE}60`,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Text style={{ fontSize: 32 }}>🛡️</Text>
                </View>
                <Text style={{ color: C.WHITE, fontSize: 20, fontWeight: 'bold' }}>牌局环境守护</Text>
                <Text style={{ color: C.GRAY, fontSize: 13 }}>手机环境健康度检测工具</Text>
              </View>

              {/* 权限说明卡片 */}
              <View style={{ backgroundColor: C.BG, borderRadius: 12, borderWidth: 1, borderColor: C.BORDER, padding: 14, gap: 8 }}>
                <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>为保障功能正常使用，本应用需要获取以下权限：</Text>
                <View style={{ gap: 6 }}>
                  {[
                    { icon: '📱', text: '设备标识码 — 用于绑定试用时间和会员权益' },
                    { icon: '🔔', text: '通知权限 — 用于在护航时实时推送护航状态提醒' },
                  ].map(item => (
                    <View key={item.text} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
                      <Text style={{ fontSize: 13 }}>{item.icon}</Text>
                      <Text style={{ color: C.WHITE, fontSize: 12, lineHeight: 18, flex: 1 }}>· {item.text}</Text>
                    </View>
                  ))}
                </View>
                <View style={{ borderTopWidth: 1, borderTopColor: C.BORDER2, paddingTop: 8 }}>
                  <Text style={{ color: C.GRAY, fontSize: 11, lineHeight: 17 }}>
                    我们承诺：上述信息仅用于本应用功能实现，不会向第三方提供或用于其他用途。
                  </Text>
                </View>
              </View>

              {/* 协议复选框区域 */}
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                <Pressable
                  onPress={() => setChecked(v => !v)}
                  style={{
                    width: 20, height: 20, borderRadius: 5,
                    borderWidth: 1.5, borderColor: checked ? C.BLUE : C.GRAY2,
                    backgroundColor: checked ? C.BLUE : 'transparent',
                    alignItems: 'center', justifyContent: 'center',
                    marginTop: 1,
                  }}
                >
                  {checked && <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>✓</Text>}
                </Pressable>
                <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                  <Text style={{ color: C.GRAY, fontSize: 12 }}>我已阅读并同意 </Text>
                  <Pressable onPress={() => setShowPrivacy(true)}>
                    <Text style={{ color: C.BLUE, fontSize: 12 }}>《隐私政策》</Text>
                  </Pressable>
                  <Text style={{ color: C.GRAY, fontSize: 12 }}>和 </Text>
                  <Pressable onPress={() => setShowAgreement(true)}>
                    <Text style={{ color: C.BLUE, fontSize: 12 }}>《用户协议》</Text>
                  </Pressable>
                </View>
              </View>

              {/* 同意按钮 */}
              <Pressable
                onPress={handleAccept}
                disabled={!checked}
                style={{
                  backgroundColor: checked ? C.BLUE : C.GRAY2,
                  borderRadius: 12, paddingVertical: 15, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>
                  同意并进入
                </Text>
              </Pressable>

              <Text style={{ color: C.GRAY2, fontSize: 10, textAlign: 'center' }}>
                如不同意，可通过手机返回键退出
              </Text>

              {/* APK引导 */}
              <Pressable
                onPress={() => { onAccept(); router.push('/(app)/install-guide'); }}
                style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.BORDER2, marginTop: 4,
                }}
              >
                <Text style={{ color: C.BLUE, fontSize: 12 }}>
                  💡 安装APK版本可获完整体验（通知栏护航提醒+自动登录），点击下载
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <DocModal visible={showPrivacy} title="隐私政策" content={PRIVACY_TEXT} onClose={() => setShowPrivacy(false)} />
      <DocModal visible={showAgreement} title="用户协议" content={USER_AGREEMENT_TEXT} onClose={() => setShowAgreement(false)} />
    </>
  );
}
