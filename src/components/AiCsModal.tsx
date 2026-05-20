/**
 * AiCsModal — AI智能客服对话弹窗（完整重写）
 * 支持：思考中动画 → 打字机逐字输出 → 闪烁光标 → 气泡淡入动效
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { fetch } from 'expo/fetch';
import { C } from '@/lib/colors';

// 使用环境变量，避免硬编码后端地址（打包后可配置）
const QIANFAN_URL =
  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/qianfan-agent`;

const THINK_MIN_MS  = 800;   // 思考动画最少可见时长
const TYPE_SPEED_MS = 20;    // 打字机速度 ms/字
const TIMEOUT_MS    = 15000; // 请求超时

// ─────────────────────────────────────────────────────────
// 消息结构
// ─────────────────────────────────────────────────────────
type MsgState = 'done' | 'thinking' | 'typing';

interface Msg {
  id: string;
  role: 'user' | 'bot';
  text: string;       // 当前显示文本（打字机逐步填充）
  state: MsgState;
}

// ─────────────────────────────────────────────────────────
// 三点跳动 — 思考中动画
// ─────────────────────────────────────────────────────────
function ThinkingDots({ color }: { color: string }) {
  const a0 = useRef(new Animated.Value(0.25)).current;
  const a1 = useRef(new Animated.Value(0.25)).current;
  const a2 = useRef(new Animated.Value(0.25)).current;

  useEffect(() => {
    const pulse = (v: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(v, { toValue: 1,    duration: 350, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 350, useNativeDriver: true }),
          Animated.delay(Math.max(0, 700 - delay)),
        ]),
      );

    const animations = [pulse(a0, 0), pulse(a1, 233), pulse(a2, 466)];
    animations.forEach(anim => anim.start());
    return () => animations.forEach(anim => anim.stop());
  }, [a0, a1, a2]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 2 }}>
      <Text style={{ fontSize: 11, color }}>🤔</Text>
      <Text style={{ fontSize: 10, color, marginRight: 6 }}>AI正在思考中</Text>
      {[a0, a1, a2].map((a, i) => (
        <Animated.View
          key={i}
          style={{
            width: 6, height: 6, borderRadius: 3,
            backgroundColor: color,
            opacity: a,
          }}
        />
      ))}
    </View>
  );
}

// ─────────────────────────────────────────────────────────
// 闪烁光标
// ─────────────────────────────────────────────────────────
function Cursor({ color }: { color: string }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);

  return <Animated.Text style={{ opacity, color, fontSize: 15, lineHeight: 21 }}>▌</Animated.Text>;
}

// ─────────────────────────────────────────────────────────
// 单条气泡（自带入场动画，key 不变时不重复动画）
// ─────────────────────────────────────────────────────────
const BubbleItem = React.memo(function BubbleItem({
  msg,
  accentColor,
  isAdmin,
}: {
  msg: Msg;
  accentColor: string;
  isAdmin: boolean;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const transY  = useRef(new Animated.Value(msg.role === 'bot' ? 12 : 0)).current;
  const transX  = useRef(new Animated.Value(msg.role === 'user' ? 16 : 0)).current;

  // 组件首次挂载时做入场动画
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(transY,  { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(transX,  { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isUser = msg.role === 'user';
  const bubbleBg    = isUser ? `${accentColor}1E` : C.PANEL2;
  const bubbleBorder = isUser ? `${accentColor}55` : C.BORDER;

  return (
    <Animated.View
      style={{
        opacity,
        transform: [{ translateY: transY }, { translateX: transX }],
        alignItems: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      {!isUser && (
        <Text style={{ color: C.GRAY, fontSize: 10, marginBottom: 3 }}>
          {isAdmin ? '🤖 运营助手' : '🤖 AI客服'}
        </Text>
      )}
      <View
        style={{
          maxWidth: '86%',
          padding: 11,
          borderRadius: 14,
          backgroundColor: bubbleBg,
          borderWidth: 1,
          borderColor: bubbleBorder,
        }}
      >
        {msg.state === 'thinking' ? (
          <ThinkingDots color={accentColor} />
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Text style={{ color: C.WHITE, fontSize: 13, lineHeight: 21, flexShrink: 1 }}>
              {msg.text}
            </Text>
            {msg.state === 'typing' && <Cursor color={accentColor} />}
          </View>
        )}
      </View>
    </Animated.View>
  );
});

// ─────────────────────────────────────────────────────────
// 主组件
// ─────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  onClose: () => void;
  greeting: string;
  mode?: 'admin' | 'customer';
}

export default function AiCsModal({ visible, onClose, greeting, mode = 'customer' }: Props) {
  const isAdmin     = mode === 'admin';
  const accentColor = isAdmin ? '#F59E0B' : C.BLUE;
  const badgeBg     = isAdmin ? '#F59E0B22' : `${C.BLUE}22`;
  const badgeBorder = isAdmin ? '#F59E0B55' : `${C.BLUE}55`;
  const badgeText   = isAdmin ? '#F59E0B' : C.BLUE;

  const welcome = (): Msg => ({
    id: 'welcome',
    role: 'bot',
    text: greeting,
    state: 'done',
  });

  const [msgs, setMsgs]       = useState<Msg[]>([welcome()]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [convId, setConvId]   = useState('');

  const listRef      = useRef<FlatList<Msg>>(null);
  const abortRef     = useRef<AbortController | null>(null);
  const fullRef      = useRef('');          // SSE 累积全文
  const shownRef     = useRef(0);           // 已显示字数
  const sseEndRef    = useRef(false);       // SSE 是否结束
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeMsgId  = useRef('');

  // 弹窗每次打开重置
  useEffect(() => {
    if (visible) {
      setMsgs([welcome()]);
      setInput('');
      setLoading(false);
      setConvId('');
      clearTimer();
    } else {
      abortRef.current?.abort();
      clearTimer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, greeting]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const scrollDown = () =>
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

  // 打字机：每 TYPE_SPEED_MS 显示一个字符，直到追上全文
  const startTypewriter = (msgId: string) => {
    clearTimer();
    shownRef.current = 0;

    timerRef.current = setInterval(() => {
      const full    = fullRef.current;
      const shown   = shownRef.current;

      if (shown < full.length) {
        // 还有字符可以显示
        shownRef.current = shown + 1;
        const slice = full.slice(0, shownRef.current);
        setMsgs(prev =>
          prev.map(m => m.id === msgId ? { ...m, text: slice, state: 'typing' } : m),
        );
        if (shownRef.current % 8 === 0) scrollDown();
      } else if (sseEndRef.current) {
        // SSE 已结束且文字全部显示完毕
        clearTimer();
        const finalText = full || '抱歉，未能获取到回答，请重新提问。';
        setMsgs(prev =>
          prev.map(m => m.id === msgId ? { ...m, text: finalText, state: 'done' } : m),
        );
        setLoading(false);
        scrollDown();
      }
      // SSE 还未结束时等待更多内容
    }, TYPE_SPEED_MS);
  };

  const send = async () => {
    const txt = input.trim();
    if (!txt || loading) return;

    setInput('');
    setLoading(true);

    // 重置累积区
    fullRef.current   = '';
    shownRef.current  = 0;
    sseEndRef.current = false;

    const uid = `u_${Date.now()}`;
    const bid = `b_${Date.now() + 1}`;
    activeMsgId.current = bid;

    // 追加用户消息 + 思考中气泡
    setMsgs(prev => [
      ...prev,
      { id: uid, role: 'user',  text: txt, state: 'done'     },
      { id: bid, role: 'bot',   text: '',  state: 'thinking'  },
    ]);
    scrollDown();

    abortRef.current = new AbortController();

    // 15 秒超时保护
    const outerTimer = setTimeout(() => {
      clearTimer();
      setMsgs(prev =>
        prev.map(m =>
          m.id === bid
            ? { ...m, state: 'done', text: '内容正在赶来，请稍等…⏳' }
            : m,
        ),
      );
      setLoading(false);
    }, TIMEOUT_MS);

    const sendAt = Date.now();

    try {
      const res = await fetch(QIANFAN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: txt, conversation_id: convId, mode }),
        signal: abortRef.current.signal,
      });

      clearTimeout(outerTimer);

      if (!res.ok || !res.body) {
        setMsgs(prev =>
          prev.map(m =>
            m.id === bid
              ? { ...m, state: 'done', text: '暂时无法连接AI助手，请稍后再试。' }
              : m,
          ),
        );
        setLoading(false);
        return;
      }

      // 思考动画至少可见 THINK_MIN_MS
      const elapsed = Date.now() - sendAt;
      if (elapsed < THINK_MIN_MS) {
        await new Promise<void>(r => setTimeout(r, THINK_MIN_MS - elapsed));
      }

      // 切换为打字机状态，启动打字机计时器
      setMsgs(prev =>
        prev.map(m => m.id === bid ? { ...m, state: 'typing', text: '' } : m),
      );
      startTypewriter(bid);

      // 后台读取 SSE 流，内容写入 fullRef（打字机会自动追上）
      const reader = res.body.getReader();
      const dec    = new TextDecoder();
      let buf      = '';
      let cid      = convId;

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';

        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const raw = t.slice(5).trim();
          if (!raw || raw === '[DONE]') continue;
          try {
            const p = JSON.parse(raw) as {
              answer?: string;
              result?: string;
              conversation_id?: string;
              error?: string;
            };
            if (!p.error) fullRef.current += p.answer ?? p.result ?? '';
            if (p.conversation_id) cid = p.conversation_id;
          } catch { /* 忽略 */ }
        }
      }

      setConvId(cid);
      sseEndRef.current = true; // 标记 SSE 结束，打字机追上后自动收尾

    } catch (err: unknown) {
      clearTimeout(outerTimer);
      clearTimer();
      if ((err as Error)?.name !== 'AbortError') {
        setMsgs(prev =>
          prev.map(m =>
            m.id === bid
              ? { ...m, state: 'done', text: '网络异常，请检查连接后重试。' }
              : m,
          ),
        );
        setLoading(false);
      }
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
        <KeyboardAvoidingView behavior="padding" style={{ maxHeight: '80%' }}>
          <View
            style={{
              backgroundColor: C.PANEL,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              flex: 1,
              overflow: 'hidden',
            }}
          >
            {/* ── 标题栏 ── */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 16,
                borderBottomWidth: 1,
                borderBottomColor: C.BORDER,
                gap: 10,
              }}
            >
              <View
                style={{
                  backgroundColor: badgeBg,
                  borderWidth: 1,
                  borderColor: badgeBorder,
                  borderRadius: 8,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: badgeText, fontSize: 11, fontWeight: 'bold' }}>AI 助手</Text>
              </View>

              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                  <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>
                    💬 智能客服（AI）
                  </Text>
                  {/* 绿色在线灯 */}
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />
                  <Text style={{ color: '#22C55E', fontSize: 10 }}>在线</Text>
                </View>
                <Text style={{ color: C.GRAY, fontSize: 10, marginTop: 1 }}>
                  {isAdmin
                    ? '管理员专属 · 牌局守护首席运营官'
                    : '由AI驱动，非真人客服 · 工作时间9:00-21:00'}
                </Text>
              </View>

              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={{ color: C.GRAY, fontSize: 20 }}>✕</Text>
              </Pressable>
            </View>

            {/* ── 消息列表 ── */}
            <FlatList
              ref={listRef}
              data={msgs}
              keyExtractor={m => m.id}
              contentContainerStyle={{ padding: 14, paddingBottom: 8 }}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              renderItem={({ item }) => (
                <BubbleItem msg={item} accentColor={accentColor} isAdmin={isAdmin} />
              )}
            />

            {/* ── 输入区 ── */}
            <View
              style={{
                flexDirection: 'row',
                padding: 12,
                gap: 10,
                borderTopWidth: 1,
                borderTopColor: C.BORDER,
              }}
            >
              <TextInput
                value={input}
                onChangeText={setInput}
                placeholder="请输入您的问题…"
                placeholderTextColor={C.GRAY2}
                style={{
                  flex: 1,
                  backgroundColor: C.BG,
                  borderRadius: 10,
                  padding: 10,
                  color: C.WHITE,
                  fontSize: 13,
                  borderWidth: 1,
                  borderColor: C.BORDER,
                }}
                returnKeyType="send"
                onSubmitEditing={send}
                editable={!loading}
              />
              <Pressable cssInterop={false}
                onPress={send}
                disabled={loading}
                style={({ pressed }) => ({
                  backgroundColor: loading
                    ? C.GRAY2
                    : pressed
                    ? `${accentColor}BB`
                    : accentColor,
                  borderRadius: 10,
                  paddingHorizontal: 16,
                  justifyContent: 'center',
                })}
              >
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                  {loading ? '…' : '发送'}
                </Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
