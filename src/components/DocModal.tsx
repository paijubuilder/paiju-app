/**
 * 通用协议内容底部弹窗
 */
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { C } from '@/lib/colors';

interface Props {
  visible: boolean;
  title: string;
  content: string;
  onClose: () => void;
}

export default function DocModal({ visible, title, content, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{
          backgroundColor: C.PANEL,
          borderTopLeftRadius: 20, borderTopRightRadius: 20,
          maxHeight: '82%',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
            <Text style={{ flex: 1, color: C.WHITE, fontSize: 16, fontWeight: 'bold' }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={16}>
              <Text style={{ color: C.GRAY, fontSize: 24, lineHeight: 26 }}>✕</Text>
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
