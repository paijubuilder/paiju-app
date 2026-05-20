/**
 * RBAC 管理员门户首页 — 角色感知
 * - 根据登录角色展示对应模块入口
 * - 超级管理员 → 全部菜单 + 权限管理
 * - 销售专员    → 销售工作台
 * - 客服专员    → 客服工作台（功能提示）
 * - 注销 → 清除会话，返回登录页
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  getRbacSession,
  clearRbacSession,
  isRbacSuperAdmin,
  ROLE_META,
  type RbacSession,
} from '@/lib/rbac';

// ── 菜单项类型 ────────────────────────────────────────────
interface MenuItem {
  icon: string;
  label: string;
  desc: string;
  badge?: string;
  badgeColor?: string;
  route?: string;
  roles?: string[];   // undefined = 对所有角色显示
}

const ALL_MENUS: MenuItem[] = [
  {
    icon: '🏠', label: '运营后台', desc: '数据总览、用户管理、订单处理',
    route: '/(app)/admin-portal',
    roles: ['super_admin', 'ops_director', 'content_ops', 'agent_manager', 'tech_support'],
  },
  {
    icon: '💼', label: '销售工作台', desc: '客户管理、折扣申请、推广链接、业绩追踪',
    route: '/(app)/sales-workspace',
    roles: ['super_admin', 'sales_agent'],
    badge: '销售专员', badgeColor: '#EF4444',
  },
  {
    icon: '🛡️', label: '权限管理', desc: '角色权限、管理员账号、分级授权、操作日志',
    route: '/(app)/admin-permission',
    roles: ['super_admin'],
    badge: '超管专属', badgeColor: '#F59E0B',
  },
  {
    icon: '🎧', label: '客服工作台', desc: '查看咨询列表、处理用户问题',
    roles: ['super_admin', 'cs_manager', 'cs_agent'],
    badge: '建设中', badgeColor: '#64748B',
  },
  {
    icon: '📊', label: '数据报表', desc: '经营数据、销售统计、用户行为分析',
    roles: ['super_admin', 'ops_director'],
    badge: '建设中', badgeColor: '#64748B',
  },
  {
    icon: '✍️', label: '内容管理', desc: '内容创作、发布审核、素材库',
    roles: ['super_admin', 'content_ops'],
    badge: '建设中', badgeColor: '#64748B',
  },
  {
    icon: '🔧', label: '技术支持', desc: '系统监控、日志查看、故障排查',
    roles: ['super_admin', 'tech_support'],
    badge: '建设中', badgeColor: '#64748B',
  },
];

function RoleTag({ name }: { name: string }) {
  const meta = ROLE_META[name] ?? { color: C.GRAY, bg: `${C.GRAY}22`, icon: '👤' };
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center', gap: 4,
      backgroundColor: meta.bg, borderRadius: 8,
      paddingHorizontal: 8, paddingVertical: 3,
    }}>
      <Text style={{ fontSize: 12 }}>{meta.icon}</Text>
      <Text style={{ color: meta.color, fontSize: 11, fontWeight: 'bold' }}>
        {name === 'super_admin' ? '超级管理员'
          : name === 'ops_director' ? '运营总监'
          : name === 'content_ops' ? '内容运营'
          : name === 'cs_manager' ? '客服主管'
          : name === 'cs_agent' ? '客服专员'
          : name === 'agent_manager' ? '代理主管'
          : name === 'tech_support' ? '技术支持'
          : name === 'sales_agent' ? '销售专员'
          : name}
      </Text>
    </View>
  );
}

export default function AdminRbacPortalScreen() {
  const router = useRouter();
  const [session, setSession] = useState<RbacSession | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useFocusEffect(useCallback(() => {
    const s = getRbacSession();
    if (!s) { router.replace('/(app)/admin-rbac-login' as never); return; }
    setSession(s);
  }, []));

  const handleLogout = () => {
    clearRbacSession();
    router.replace('/(app)/admin-rbac-login' as never);
  };

  const visibleMenus = ALL_MENUS.filter(m => {
    if (!m.roles) return true;
    return m.roles.some(r => session?.roleNames.includes(r));
  });

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: C.BG, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={C.BLUE} />
      </View>
    );
  }

  const isSuperAdmin = isRbacSuperAdmin();

  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 60 }}
        contentInsetAdjustmentBehavior="automatic"
      >
        {/* ── 顶部信息栏 ── */}
        <View style={{
          flexDirection: 'row', alignItems: 'center',
          paddingTop: 56, paddingBottom: 20, gap: 12,
        }}>
          <View style={{
            width: 50, height: 50, borderRadius: 14, backgroundColor: C.BLUE_BG,
            borderWidth: 1, borderColor: C.BLUE, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontSize: 24 }}>🛡️</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: C.WHITE, fontSize: 17, fontWeight: 'bold' }}>
              {session.adminName}
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 12, marginTop: 2 }}>
              账号：{session.username}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowLogoutConfirm(true)}
            style={{ backgroundColor: 'rgba(224,82,82,0.12)', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={{ color: C.RED, fontSize: 13 }}>退出</Text>
          </Pressable>
        </View>

        {/* 角色标签 */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {session.roleNames.map(r => <RoleTag key={r} name={r} />)}
          {isSuperAdmin && (
            <View style={{ backgroundColor: '#F59E0B22', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: 'bold' }}>拥有全部权限</Text>
            </View>
          )}
        </View>

        {/* 欢迎语 */}
        <View style={{
          backgroundColor: C.BLUE_BG, borderRadius: 14, borderWidth: 1,
          borderColor: `${C.BLUE}40`, padding: 14, marginBottom: 20, gap: 4,
        }}>
          <Text style={{ color: C.BLUE, fontSize: 14, fontWeight: 'bold' }}>
            👋 欢迎回来，{session.adminName.split('（')[0]}！
          </Text>
          <Text style={{ color: C.GRAY, fontSize: 12 }}>
            当前时间：{new Date().toLocaleString('zh-CN', { hour12: false })}
          </Text>
          <Text style={{ color: C.GRAY, fontSize: 12 }}>
            会话有效至：{new Date(session.expiresAt).toLocaleString('zh-CN', { hour12: false })}
          </Text>
        </View>

        {/* ── 功能菜单 ── */}
        <Text style={{ color: C.GRAY, fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 10 }}>
          功能模块
        </Text>
        <View style={{ gap: 10 }}>
          {visibleMenus.map((m, i) => (
            <Pressable
              key={i}
              cssInterop={false}
              onPress={() => {
                if (m.route) router.push(m.route as never);
              }}
              style={({ pressed }) => ({
                backgroundColor: pressed ? C.PANEL2 : C.PANEL,
                borderRadius: 14, borderWidth: 1, borderColor: C.BORDER,
                padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14,
                opacity: m.badge === '建设中' ? 0.6 : 1,
              })}
            >
              <View style={{
                width: 44, height: 44, borderRadius: 12, backgroundColor: C.PANEL2,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 22 }}>{m.icon}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: C.WHITE, fontSize: 15, fontWeight: 'bold' }}>{m.label}</Text>
                  {m.badge && (
                    <View style={{
                      backgroundColor: `${m.badgeColor}22`, borderRadius: 6,
                      paddingHorizontal: 6, paddingVertical: 2,
                    }}>
                      <Text style={{ color: m.badgeColor, fontSize: 10, fontWeight: 'bold' }}>{m.badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: C.GRAY, fontSize: 12 }}>{m.desc}</Text>
              </View>
              {m.route && <Text style={{ color: C.GRAY, fontSize: 18 }}>›</Text>}
            </Pressable>
          ))}
        </View>

        {/* ── 账号安全提示 ── */}
        <View style={{
          marginTop: 24, backgroundColor: C.PANEL, borderRadius: 14,
          borderWidth: 1, borderColor: C.BORDER, padding: 16, gap: 6,
        }}>
          <Text style={{ color: C.GRAY, fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>
            🔒 账号安全
          </Text>
          <Text style={{ color: C.GRAY, fontSize: 12, lineHeight: 18 }}>
            · 每次会话有效期 8 小时，过期后需重新登录{'\n'}
            · 密码连续错误 5 次将锁定账号 15 分钟{'\n'}
            · 如需修改密码请联系上级管理员重置{'\n'}
            · 不支持同一账号多端同时登录
          </Text>
        </View>

        {/* 版本 */}
        <Text style={{ color: C.GRAY2, fontSize: 11, textAlign: 'center', marginTop: 20 }}>
          管理后台 · 牌局环境守护
        </Text>
      </ScrollView>

      {/* 退出确认弹窗 */}
      {showLogoutConfirm && (
        <View style={{
          position: 'absolute', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.75)',
          alignItems: 'center', justifyContent: 'center', padding: 32,
        }}>
          <View style={{
            backgroundColor: C.PANEL, borderRadius: 18, borderWidth: 1,
            borderColor: C.BORDER, padding: 24, width: 280, gap: 16,
          }}>
            <Text style={{ color: C.WHITE, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              确认退出登录？
            </Text>
            <Text style={{ color: C.GRAY, fontSize: 13, textAlign: 'center' }}>
              退出后需重新输入账号密码才能登录管理后台
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowLogoutConfirm(false)}
                style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: C.GRAY, fontSize: 14 }}>取消</Text>
              </Pressable>
              <Pressable
                onPress={handleLogout}
                style={{ flex: 1, backgroundColor: C.RED, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>退出</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
