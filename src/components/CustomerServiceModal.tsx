/**
 * 客服对话框 — 含自动退款判定逻辑
 */
import { useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { C } from '@/lib/colors';
import {
  formatDateTime,
  getActivationTime,
  getMemberExpireTime,
  isActivated,
  isMemberActive,
} from '@/lib/appStore';

interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
}

// 欢迎语
const WELCOME: Message = {
  id: 'w0',
  role: 'bot',
  text: '您好！我是牌局环境守护的智能客服助理。\n\n如需退款，请直接输入"退款"，系统将自动查询您的订单状态。\n如有其他问题，欢迎咨询。',
};

function autoReply(input: string): string {
  const text = input.trim();
  if (text === '退款' || text.includes('退款')) {
    const activated = isActivated();
    const active = isMemberActive();
    const expireTime = getMemberExpireTime();
    const activationTime = getActivationTime();

    if (activated) {
      // 自动回复A
      const activateStr = activationTime ? formatDateTime(activationTime) : '未知';
      return `很抱歉，经系统核实，您的会员权益已于 ${activateStr} 首次激活使用。\n\n根据《会员服务协议》，已激活的数字化商品不支持退款。\n\n如有疑问，可进一步咨询人工客服。`;
    }
    if (!active && expireTime) {
      // 自动回复B
      const expireStr = formatDateTime(expireTime);
      return `很抱歉，经系统核实，您的会员权益已于 ${expireStr} 到期。\n\n根据《会员服务协议》，会员有效期届满后，无论是否激活，已支付的费用均不予退还。`;
    }
    // 未激活 + 未到期 → 受理退款
    return '退款申请已提交，客服将在24小时内处理。\n\n请保持手机畅通，我们将通过站内消息通知您处理结果。';
  }

  if (text.includes('激活') || text.includes('开通')) {
    return '开通会员后，您的权益即刻生效。首次点击"开始守护本局"即视为激活，激活后不支持退款。';
  }
  if (text.includes('到期') || text.includes('续费')) {
    return '会员到期后，您的守护功能将暂停。可在付费激活页面选择套餐续费，续费后连续守护记录继续累计。';
  }
  if (text.includes('代理')) {
    return '代理权益一经开通即可在代理中心查看拿货价格及加价操作。如有代理相关疑问，请联系平台运营客服。';
  }
  return '感谢您的留言！如需人工协助，请详述问题，客服将在工作时间（9:00-21:00）内回复。';
}

interface Props {
  visible: boolean;
  onClose: () => void;
}

export default function CustomerServiceModal({ visible, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    const userId = `u${Date.now()}`;
    const botId = `b${Date.now()}`;
    const reply = autoReply(text);
    setMessages(prev => [
      ...prev,
      { id: userId, role: 'user', text },
      { id: botId, role: 'bot', text: reply },
    ]);
    setInput('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior="padding" style={{ maxHeight: '78%' }}>
          <View style={{ backgroundColor: C.PANEL, borderTopLeftRadius: 20, borderTopRightRadius: 20, flex: 1 }}>
            {/* 标题栏 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>智能客服</Text>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>自动退款判定 · 人工工作时间 9:00-21:00</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ color: C.GRAY, fontSize: 22 }}>✕</Text>
              </Pressable>
            </View>

            {/* 消息列表 */}
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={m => m.id}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              renderItem={({ item }) => (
                <View style={{
                  alignItems: item.role === 'user' ? 'flex-end' : 'flex-start',
                }}>
                  <View style={{
                    maxWidth: '82%', padding: 12, borderRadius: 12,
                    backgroundColor: item.role === 'user' ? C.BLUE : C.PANEL2,
                    borderWidth: 1,
                    borderColor: item.role === 'user' ? `${C.BLUE}80` : C.BORDER,
                  }}>
                    <Text style={{ color: C.WHITE, fontSize: 13, lineHeight: 20 }}>{item.text}</Text>
                  </View>
                </View>
              )}
            />

            {/* 输入框 */}
            <View style={{ flexDirection: 'row', padding: 12, gap: 10, borderTopWidth: 1, borderTopColor: C.BORDER }}>
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder='输入消息，发送"退款"查询订单...'
                placeholderTextColor={C.GRAY}
                style={{ flex: 1, backgroundColor: C.BG, borderRadius: 10, padding: 10, color: C.WHITE, fontSize: 13, borderWidth: 1, borderColor: C.BORDER }}
                returnKeyType="send"
                onSubmitEditing={send}
              />
              <Pressable cssInterop={false}
                onPress={send}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
                  borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center',
                })}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>发送</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
