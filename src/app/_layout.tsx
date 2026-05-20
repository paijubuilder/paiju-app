import * as Sentry from '@sentry/react-native';
import { Stack } from 'expo-router';
import { PortalHost } from '@rn-primitives/portal';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';

import BrandSplash from '@/components/BrandSplash';
import "../global.css";

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN ?? '',
  enabled: !!process.env.EXPO_PUBLIC_SENTRY_DSN,
});

const BG = '#0D0F12';

const RootLayout: React.FC = () => {
  const [splashDone, setSplashDone] = useState(false);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0D0F12' } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(app)" />
      </Stack>
      <PortalHost />
      {/* 全屏品牌加载页 - 首次打开时展示 */}
      {!splashDone && <BrandSplash onDone={() => setSplashDone(true)} />}
    </GestureHandlerRootView>
  );
};

export default Sentry.wrap(RootLayout);
