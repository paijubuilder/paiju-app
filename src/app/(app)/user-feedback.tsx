/**
 * 用户反馈页 — 类型选择 + 内容输入 + 截图上传 + 提交
 * 对所有用户开放，无需会员
 */
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { C } from '@/lib/colors';
import { addFeedback } from '@/lib/appStore';
import type { FeedbackType } from '@/lib/appStore';

const FEEDBACK_TYPES: FeedbackType[] = ['功能建议', 'Bug反馈', '使用问题', '代理相关', '其他'];

const TYPE_COLORS: Record<FeedbackType, string> = {
  '功能建议': '#3B82F6',
  'Bug反馈':  '#EF4444',
  '使用问题': '#F59E0B',
  '代理相关': '#8B5CF6',
  '其他':     '#6B7280',
};

export default function UserFeedbackScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<FeedbackType | null>(null);
  const [content, setContent]           = useState('');
  const [contact, setContact]           = useState('');
  const [imageUri, setImageUri]         = useState<string | null>(null);
  const [submitting, setSubmitting]     = useState(false);
  const [showSuccess, setShowSuccess]   = useState(false);
  const [errors, setErrors]             = useState<{ type?: string; content?: string }>({});

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const handleSubmit = () => {
    const newErrors: typeof errors = {};
    if (!selectedType) newErrors.type = '请选择反馈类型';
    if (!content.trim()) newErrors.content = '请填写反馈内容';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    // 模拟提交延迟
    setTimeout(() => {
      addFeedback({
        type: selectedType!,
        content: content.trim(),
        contact: contact.trim(),
        imageUri,
      });
      setSubmitting(false);
      setShowSuccess(true);
    }, 600);
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    router.back();
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />

      {/* 顶栏 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 12 }}>
          <Text style={{ color: C.GRAY, fontSize: 22 }}>←</Text>
        </Pressable>
        <Text style={{ color: C.WHITE, fontSize: 18, fontWeight: 'bold', flex: 1 }}>用户反馈</Text>
        <Text style={{ fontSize: 20 }}>💬</Text>
      </View>

      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} keyboardShouldPersistTaps="handled">

          {/* 反馈类型 */}
          <View style={{ gap: 10 }}>
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>反馈类型 <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FEEDBACK_TYPES.map(t => {
                const active = selectedType === t;
                const color  = TYPE_COLORS[t];
                return (
                  <Pressable cssInterop={false}
                    key={t}
                    onPress={() => { setSelectedType(t); setErrors(e => ({ ...e, type: undefined })); }}
                    style={({ pressed }) => ({
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                      backgroundColor: active ? color : C.PANEL,
                      borderWidth: 1.5, borderColor: active ? color : C.BORDER,
                      opacity: pressed ? 0.8 : 1,
                    })}
                  >
                    <Text style={{ color: active ? '#fff' : C.GRAY, fontSize: 13, fontWeight: active ? 'bold' : 'normal' }}>{t}</Text>
                  </Pressable>
                );
              })}
            </View>
            {errors.type && <Text style={{ color: '#EF4444', fontSize: 12 }}>{errors.type}</Text>}
          </View>

          {/* 反馈内容 */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>详细描述 <Text style={{ color: '#EF4444' }}>*</Text></Text>
            <TextInput
              value={content}
              onChangeText={v => { setContent(v); setErrors(e => ({ ...e, content: undefined })); }}
              placeholder="请详细描述您的建议或问题，帮助我们做得更好..."
              placeholderTextColor={C.GRAY2}
              multiline
              textAlignVertical="top"
              style={{
                backgroundColor: C.PANEL, borderWidth: 1,
                borderColor: errors.content ? '#EF4444' : C.BORDER,
                borderRadius: 12, padding: 14, color: C.WHITE,
                fontSize: 14, minHeight: 120, lineHeight: 22,
              }}
            />
            {errors.content && <Text style={{ color: '#EF4444', fontSize: 12 }}>{errors.content}</Text>}
            <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'right' }}>{content.length} 字</Text>
          </View>

          {/* 联系方式（选填） */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>联系方式 <Text style={{ color: C.GRAY2, fontWeight: 'normal', fontSize: 12 }}>（选填）</Text></Text>
            <TextInput
              value={contact}
              onChangeText={setContact}
              placeholder="微信号或手机号（选填，方便我们回复您）"
              placeholderTextColor={C.GRAY2}
              style={{ backgroundColor: C.PANEL, borderWidth: 1, borderColor: C.BORDER, borderRadius: 12, padding: 14, color: C.WHITE, fontSize: 14 }}
            />
          </View>

          {/* 上传截图（选填） */}
          <View style={{ gap: 8 }}>
            <Text style={{ color: C.WHITE, fontSize: 14, fontWeight: 'bold' }}>上传截图 <Text style={{ color: C.GRAY2, fontWeight: 'normal', fontSize: 12 }}>（选填）</Text></Text>
            {imageUri ? (
              <View style={{ gap: 8 }}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: 180, borderRadius: 12 }}
                  contentFit="cover"
                />
                <Pressable onPress={() => setImageUri(null)} style={{ alignSelf: 'flex-start' }}>
                  <Text style={{ color: '#EF4444', fontSize: 12 }}>✕ 移除截图</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable cssInterop={false}
                onPress={pickImage}
                style={({ pressed }) => ({
                  backgroundColor: pressed ? C.PANEL2 : C.PANEL,
                  borderWidth: 1.5, borderColor: C.BORDER, borderStyle: 'dashed',
                  borderRadius: 12, paddingVertical: 24, alignItems: 'center', gap: 6,
                })}
              >
                <Text style={{ fontSize: 28 }}>📷</Text>
                <Text style={{ color: C.GRAY, fontSize: 13 }}>上传截图（选填）</Text>
              </Pressable>
            )}
          </View>

          {/* 提交按钮 */}
          <Pressable cssInterop={false}
            onPress={handleSubmit}
            disabled={submitting}
            style={({ pressed }) => ({
              backgroundColor: submitting ? C.GRAY2 : (pressed ? '#1A5FCC' : C.BLUE),
              borderRadius: 14, paddingVertical: 17, alignItems: 'center', marginTop: 4,
            })}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', letterSpacing: 1 }}>
              {submitting ? '提交中...' : '提交反馈'}
            </Text>
          </Pressable>

          <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center', paddingBottom: 20 }}>
            反馈功能对所有用户免费开放，感谢您帮助我们持续改进
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 提交成功弹窗 */}
      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 28 }}>
          <View style={{ width: '100%', backgroundColor: C.PANEL, borderRadius: 20, padding: 28, alignItems: 'center', gap: 16, borderWidth: 1, borderColor: C.BORDER }}>
            <Text style={{ fontSize: 48 }}>✅</Text>
            <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold', textAlign: 'center' }}>感谢您的反馈！</Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              我们会认真分析每一条建议，持续优化App体验。
            </Text>
            <Pressable cssInterop={false}
              onPress={handleSuccessClose}
              style={({ pressed }) => ({ width: '100%', backgroundColor: pressed ? '#1A5FCC' : C.BLUE, borderRadius: 12, paddingVertical: 14, alignItems: 'center' })}
            >
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: 'bold' }}>好的，返回</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
