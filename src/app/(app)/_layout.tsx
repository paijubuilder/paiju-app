import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#0D0F12' },
        animation: 'slide_from_right',
      }}
    >
      {/* Tabs根路由 */}
      <Stack.Screen name="(tabs)" />
      {/* 各详情/功能页（叠加在Tabs之上） */}
      <Stack.Screen name="activation" />
      <Stack.Screen name="admin-first-setup" />
      <Stack.Screen name="detect" />
      <Stack.Screen name="float-window" />
      <Stack.Screen name="permission-guide" />
      <Stack.Screen name="install-guide" />
      <Stack.Screen name="user-feedback" />
      <Stack.Screen name="game-records" />
      <Stack.Screen name="agent-center" />
      <Stack.Screen name="agent-upgrade" />
      <Stack.Screen name="agent-login" />
      <Stack.Screen name="admin-login" />
      <Stack.Screen name="admin-verify" />
      <Stack.Screen name="admin-settings" />
      <Stack.Screen name="admin-dashboard" />
      <Stack.Screen name="admin-portal" />
      <Stack.Screen name="push-center" />
      <Stack.Screen name="feedback-admin" />
      <Stack.Screen name="optimization-report" />
      <Stack.Screen name="optimization-history" />
      <Stack.Screen name="ai-auto-rules" />
      <Stack.Screen name="ai-experience-center" />
      <Stack.Screen name="ai-traffic-collab" />
      <Stack.Screen name="agent-ai-monitor" />
      <Stack.Screen name="apk-install" />
      <Stack.Screen name="toolbox" />
      <Stack.Screen name="agent-intro" />
      <Stack.Screen name="guard-report" />
      <Stack.Screen name="guard-poster" />
      <Stack.Screen name="admin-float-window" />
      <Stack.Screen name="admin-native-features" />
      <Stack.Screen name="admin-permission" />
      <Stack.Screen name="admin-rbac-login" />
      <Stack.Screen name="creator-login" />
      <Stack.Screen name="admin-rbac-portal" />
      <Stack.Screen name="sales-workspace" />
    </Stack>
  );
}
