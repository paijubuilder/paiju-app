/**
 * 会员Tab — 直接渲染付费激活页内容（带底部导航）
 */
import { Redirect } from 'expo-router';

// 直接跳转到activation页（Stack层），避免重复实现
export default function MemberTab() {
  return <Redirect href="/(app)/activation" />;
}
