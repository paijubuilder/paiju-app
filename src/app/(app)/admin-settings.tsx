/**
 * 管理员设置页 — 已迁移至 admin-portal（底部4Tab布局）
 * 本文件仅做路由兼容重定向
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function AdminSettingsScreen() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/(app)/admin-portal' as never);
  }, [router]);
  return null;
}
