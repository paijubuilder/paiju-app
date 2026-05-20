/**
 * 记录Tab — 嵌入牌局记录本
 */
import { useCallback } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View, Text, Pressable, FlatList } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { getGameRecords, formatDateTime } from '@/lib/appStore';
import { useState } from 'react';

export default function RecordsTab() {
  const router = useRouter();
  const [records, setRecords] = useState(getGameRecords());

  useFocusEffect(useCallback(() => {
    setRecords(getGameRecords());
  }, []));

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" backgroundColor={C.BG} />
      {/* 标题 */}
      <View style={{ paddingHorizontal: 20, paddingTop: 56, paddingBottom: 16 }}>
        <Text style={{ color: C.WHITE, fontSize: 20, fontWeight: 'bold' }}>📋 牌局记录本</Text>
        <Text style={{ color: C.GRAY, fontSize: 11, marginTop: 2 }}>GAME RECORDS</Text>
      </View>

      {records.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Text style={{ fontSize: 48 }}>📋</Text>
          <Text style={{ color: C.GRAY, fontSize: 14 }}>暂无护航记录</Text>
          <Text style={{ color: C.GRAY2, fontSize: 12 }}>完成一次护航后记录将显示在这里</Text>
          <Pressable cssInterop={false}
            onPress={() => router.push('/(app)/(tabs)/home')}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#1A5FCC' : C.BLUE,
              borderRadius: 12, paddingVertical: 12, paddingHorizontal: 24, marginTop: 8,
            })}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>去开始护航</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={records}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 12 }}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <Pressable cssInterop={false}
              onPress={() => {/* 查看详情 */}}
              style={({ pressed }) => ({
                backgroundColor: pressed ? C.PANEL2 : C.PANEL,
                borderRadius: 14, borderWidth: 1, borderColor: C.BORDER,
                padding: 14, gap: 8,
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: C.GRAY, fontSize: 11 }}>{formatDateTime(item.timestamp)}</Text>
                <View style={{
                  backgroundColor: C.BLUE_BG, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
                  borderWidth: 1, borderColor: `${C.BLUE}40`,
                }}>
                  <Text style={{ color: C.BLUE, fontSize: 10, fontWeight: 'bold' }}>
                    安全评分 {item.score}分
                  </Text>
                </View>
              </View>
              <Text style={{ color: C.WHITE, fontSize: 12 }}>
                {item.detectId} · {item.passCount}/{item.totalCount} 项通过
              </Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {item.detectItems.map(d => (
                  <View key={d.label} style={{
                    backgroundColor: `${C.GREEN}15`, borderRadius: 6,
                    paddingHorizontal: 6, paddingVertical: 2,
                  }}>
                    <Text style={{ color: C.GREEN, fontSize: 10 }}>{d.icon} {d.result}</Text>
                  </View>
                ))}
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
