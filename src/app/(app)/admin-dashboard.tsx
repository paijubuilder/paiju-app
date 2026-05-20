/**
 * admin-dashboard → 重定向到新管理后台（保持路由兼容）
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { isAdminSessionValidated } from '@/lib/appStore';

export default function AdminDashboardRedirect() {
  const router = useRouter();
  useEffect(() => {
    if (isAdminSessionValidated()) {
      router.replace('/(app)/admin-portal' as never);
    } else {
      router.replace('/(app)/admin-verify' as never);
    }
  }, [router]);
  return null;
}
