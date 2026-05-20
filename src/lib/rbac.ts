/**
 * RBAC 权限系统 — 常量、类型与辅助函数
 * 与 Supabase rbac_* 表结构保持同步
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
export const rbacClient = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── 类型定义 ──────────────────────────────────────────────

export interface RbacRole {
  id: string;
  name: string;
  label: string;
  level: number;
  description?: string;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
}

export interface RbacPermission {
  id: string;
  code: string;
  label: string;
  module: string;
}

export interface AdminAccount {
  id: string;
  username: string;
  display_name: string;
  role_ids: string[];
  is_active: boolean;
  is_tier_admin: boolean;
  last_login_at?: string;
  created_at: string;
  plain_password?: string;
  login_attempts?: number;
  locked_until?: string;
  email?: string;
  phone?: string;
  notes?: string;
  deleted_at?: string;
}

/** RBAC 会话（存内存，app 重启后需重新登录） */
export interface RbacSession {
  adminId: string;
  adminName: string;
  username: string;
  roleIds: string[];
  roleNames: string[];
  permCodes: string[];
  sessionToken: string;
  expiresAt: string;
}

// ── 内存中的 RBAC 会话 ──────────────────────────────────
let _rbacSession: RbacSession | null = null;

export function getRbacSession(): RbacSession | null {
  if (!_rbacSession) return null;
  if (new Date(_rbacSession.expiresAt) <= new Date()) { _rbacSession = null; return null; }
  return _rbacSession;
}

export function clearRbacSession(): void { _rbacSession = null; }

export function rbacHasPerm(code: string): boolean {
  const s = getRbacSession();
  if (!s) return false;
  return s.permCodes.includes(code) || s.permCodes.includes('*');
}

export function isRbacSuperAdmin(): boolean {
  const s = getRbacSession();
  if (!s) return false;
  return s.roleNames.includes('super_admin');
}

/** 生成随机初始密码 8位 */
export function generateInitPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '@#!';
  const all = upper + lower + digits;
  let pw = upper[Math.floor(Math.random() * upper.length)]
         + lower[Math.floor(Math.random() * lower.length)]
         + digits[Math.floor(Math.random() * digits.length)]
         + special[Math.floor(Math.random() * special.length)];
  for (let i = 0; i < 4; i++) pw += all[Math.floor(Math.random() * all.length)];
  return pw.split('').sort(() => Math.random() - 0.5).join('');
}

/** 登录 RBAC 管理员账号（简单明文匹配，实际项目应接 bcrypt） */
export async function loginRbacAdmin(
  username: string,
  password: string
): Promise<{ session: RbacSession } | { error: string }> {
  const { data: acc, error: e1 } = await rbacClient
    .from('admin_accounts')
    .select('*')
    .eq('username', username.trim())
    .is('deleted_at', null)
    .maybeSingle();
  if (e1 || !acc) return { error: '账号不存在或已删除' };
  if (!acc.is_active) return { error: '账号已被禁用，请联系上级管理员' };
  // 检查锁定状态
  if (acc.locked_until && new Date(acc.locked_until) > new Date()) {
    const remaining = Math.ceil((new Date(acc.locked_until).getTime() - Date.now()) / 60000);
    return { error: `账号已锁定，请 ${remaining} 分钟后再试` };
  }
  // 验证密码（使用 password_hash 字段存储明文密码）
  const pwMatch = acc.password_hash === password.trim();
  if (!pwMatch) {
    const newAttempts = (acc.login_attempts ?? 0) + 1;
    const updates: Record<string, unknown> = { login_attempts: newAttempts };
    if (newAttempts >= 5) {
      updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      updates.login_attempts = 0;
    }
    await rbacClient.from('admin_accounts').update(updates).eq('id', acc.id);
    const leftTimes = Math.max(0, 5 - newAttempts);
    return { error: newAttempts >= 5 ? '密码连续错误5次，账号已锁定15分钟' : `密码错误，还剩 ${leftTimes} 次机会` };
  }
  // 重置错误计数
  await rbacClient.from('admin_accounts').update({ login_attempts: 0, locked_until: null, last_login_at: new Date().toISOString() }).eq('id', acc.id);
  // 拉取角色名 & 权限码
  let roleNames: string[] = [];
  let permCodes: string[] = [];
  if (acc.role_ids?.length) {
    const { data: roles } = await rbacClient.from('rbac_roles').select('id,name').in('id', acc.role_ids);
    roleNames = (roles ?? []).map((r: { name: string }) => r.name);
    // 超级管理员拥有所有权限
    if (roleNames.includes('super_admin')) {
      permCodes = ['*'];
    } else {
      const { data: rpRows } = await rbacClient.from('role_permissions').select('permission_id').in('role_id', acc.role_ids);
      const permIds = (rpRows ?? []).map((r: { permission_id: string }) => r.permission_id);
      if (permIds.length) {
        const { data: perms } = await rbacClient.from('rbac_permissions').select('code').in('id', permIds);
        permCodes = (perms ?? []).map((p: { code: string }) => p.code);
      }
    }
  }
  // 写入会话
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const sessionToken = Math.random().toString(36).slice(2) + Date.now().toString(36);
  _rbacSession = {
    adminId: acc.id,
    adminName: acc.display_name,
    username: acc.username,
    roleIds: acc.role_ids ?? [],
    roleNames,
    permCodes,
    sessionToken,
    expiresAt,
  };
  return { session: _rbacSession };
}

/** 获取当前管理员可创建的角色列表（基于分级管理范围） */
export async function getCreatableRoles(currentAdminId: string): Promise<RbacRole[]> {
  const session = getRbacSession();
  if (!session) return [];
  // 超级管理员可创建所有角色
  if (isRbacSuperAdmin()) {
    const { data } = await rbacClient.from('rbac_roles').select('*').eq('is_active', true).order('level');
    return (data ?? []) as RbacRole[];
  }
  // 分级管理员：查询被授权管理的角色范围
  if (!session.roleIds.length) return [];
  const { data: scopeRows } = await rbacClient
    .from('role_management_scope')
    .select('managed_role_ids')
    .in('tier_admin_role_id', session.roleIds);
  if (!scopeRows?.length) return [];
  const allManagedIds = Array.from(new Set(scopeRows.flatMap((r: { managed_role_ids: string[] }) => r.managed_role_ids)));
  if (!allManagedIds.length) return [];
  const { data: roles } = await rbacClient.from('rbac_roles').select('*').in('id', allManagedIds).eq('is_active', true).order('level');
  return (roles ?? []) as RbacRole[];
}

/** 重置管理员密码（返回新密码） */
export async function resetAdminPassword(adminId: string, operatorName: string): Promise<string> {
  const newPw = generateInitPassword();
  await rbacClient.from('admin_accounts').update({
    password_hash: newPw,
    plain_password: newPw,
    login_attempts: 0,
    locked_until: null,
  }).eq('id', adminId);
  await writeLog({ admin_name: operatorName, action: '重置密码', target_type: 'admin', target_id: adminId, detail: { note: '密码已重置' } });
  return newPw;
}

/** 解锁账号（清除锁定） */
export async function unlockAdminAccount(adminId: string, operatorName: string): Promise<void> {
  await rbacClient.from('admin_accounts').update({ login_attempts: 0, locked_until: null }).eq('id', adminId);
  await writeLog({ admin_name: operatorName, action: '解锁账号', target_type: 'admin', target_id: adminId, detail: { note: '已清除登录锁定' } });
}

/** 软删除管理员账号 */
export async function deleteAdminAccount(adminId: string, operatorName: string): Promise<void> {
  await rbacClient.from('admin_accounts').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', adminId);
  await writeLog({ admin_name: operatorName, action: '删除账号', target_type: 'admin', target_id: adminId, detail: { note: '账号已软删除' } });
}

export interface RoleManagementScope {
  id: string;
  tier_admin_role_id: string;
  managed_role_ids: string[];
  allowed_perm_ids: string[];
  created_at: string;
}

export interface OperationLog {
  id: string;
  admin_name: string;
  action: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  detail?: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
}

export interface SalesCustomer {
  id: string;
  name: string;
  phone?: string;
  wechat?: string;
  source: string;
  status: string;
  owner_id?: string;
  notes?: string;
  follow_ups: FollowUp[];
  promo_code?: string;
  created_at: string;
  updated_at: string;
}

export interface FollowUp {
  date: string;
  content: string;
  admin_name: string;
}

export interface DiscountRequest {
  id: string;
  applicant_id?: string;
  applicant_name: string;
  customer_name: string;
  plan_name: string;
  original_amount: number;
  discount_rate: number;
  final_amount: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewer_name?: string;
  review_note?: string;
  coupon_code?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface SalesOrder {
  id: string;
  customer_name: string;
  plan_name: string;
  amount: number;
  discount_rate: number;
  final_amount: number;
  status: string;
  owner_id?: string;
  coupon_code?: string;
  notes?: string;
  created_at: string;
}

// ── 角色标识常量 ──────────────────────────────────────────

export const ROLE_NAMES = {
  SUPER_ADMIN:    'super_admin',
  OPS_DIRECTOR:   'ops_director',
  CONTENT_OPS:    'content_ops',
  CS_MANAGER:     'cs_manager',
  CS_AGENT:       'cs_agent',
  AGENT_MANAGER:  'agent_manager',
  TECH_SUPPORT:   'tech_support',
  SALES_AGENT:    'sales_agent',
} as const;

// ── 权限代码常量 ──────────────────────────────────────────

export const PERM = {
  // 经营核心
  PRICING_VIEW:     'pricing.view',
  PRICING_EDIT:     'pricing.edit',
  PRICING_APPLY:    'pricing.apply',
  SIMULATION_SWITCH:'simulation.switch',
  AGENT_COST_EDIT:  'agent_cost.edit',
  // AI引流
  AI_CONTENT_VIEW:  'ai_content.view',
  AI_CONTENT_GEN:   'ai_content.generate',
  AI_CONTENT_EDIT:  'ai_content.edit',
  KEYWORD_MANAGE:   'keyword.manage',
  MATERIAL_MANAGE:  'material.manage',
  // 客服
  CS_VIEW_ALL:      'cs.view_all',
  CS_VIEW_MINE:     'cs.view_mine',
  CS_REPLY:         'cs.reply',
  CS_SCRIPT_EDIT:   'cs_script.edit',
  // 代理
  AGENT_VIEW:       'agent.view',
  AGENT_APPROVE:    'agent.approve',
  AGENT_DISCOUNT:   'agent.discount_edit',
  AGENT_REFER:      'agent.refer',
  // 客户
  CUSTOMER_VIEW_MINE:'customer.view_mine',
  CUSTOMER_VIEW_ALL: 'customer.view_all',
  CUSTOMER_EDIT:     'customer.edit',
  CUSTOMER_ASSIGN:   'customer.assign',
  // 订单
  ORDER_VIEW_MINE:   'order.view_mine',
  ORDER_VIEW_ALL:    'order.view_all',
  ORDER_CREATE:      'order.create',
  DISCOUNT_APPLY:    'discount.apply',
  COUPON_ISSUE:      'coupon.issue',
  // 报表
  REPORT_DASHBOARD:  'report.dashboard',
  REPORT_PERSONAL:   'report.personal',
  REPORT_EXPORT:     'report.export',
  // 系统
  NATIVE_CONFIG:     'native.config',
  CODE_DOWNLOAD:     'code.download',
  PAYMENT_CONFIG:    'payment.config',
  QUALITY_VIEW:      'quality.view',
  // 权限管理
  ADMIN_MANAGE:      'admin.manage',
  ROLE_EDIT:         'role.edit',
  TIER_ADMIN_CONFIG: 'tier_admin.config',
  AUDIT_LOG_VIEW:    'audit_log.view',
} as const;

// ── 角色颜色/图标 ─────────────────────────────────────────

export const ROLE_META: Record<string, { color: string; bg: string; icon: string }> = {
  super_admin:   { color: '#F59E0B', bg: '#F59E0B22', icon: '👑' },
  ops_director:  { color: '#2563EB', bg: '#2563EB22', icon: '📊' },
  content_ops:   { color: '#8B5CF6', bg: '#8B5CF622', icon: '✍️' },
  cs_manager:    { color: '#0EA5E9', bg: '#0EA5E922', icon: '🎧' },
  cs_agent:      { color: '#64748B', bg: '#64748B22', icon: '💬' },
  agent_manager: { color: '#10B981', bg: '#10B98122', icon: '🤝' },
  tech_support:  { color: '#6366F1', bg: '#6366F122', icon: '🔧' },
  sales_agent:   { color: '#EF4444', bg: '#EF444422', icon: '💼' },
};

// ── 状态标签 ──────────────────────────────────────────────

export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  lead:        '意向客户',
  negotiating: '洽谈中',
  closed:      '已成交',
  churned:     '已流失',
};

export const DISCOUNT_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: '待审批', color: '#F59E0B' },
  approved: { label: '已通过', color: '#10B981' },
  rejected: { label: '已拒绝', color: '#EF4444' },
};

// ── API 函数 ──────────────────────────────────────────────

/** 拉取全部角色 */
export async function fetchRoles(): Promise<RbacRole[]> {
  const { data, error } = await rbacClient
    .from('rbac_roles')
    .select('*')
    .order('level');
  if (error) throw error;
  return (data ?? []) as RbacRole[];
}

/** 拉取全部权限点 */
export async function fetchPermissions(): Promise<RbacPermission[]> {
  const { data, error } = await rbacClient
    .from('rbac_permissions')
    .select('*')
    .order('module');
  if (error) throw error;
  return (data ?? []) as RbacPermission[];
}

/** 拉取角色已绑定权限ID */
export async function fetchRolePermIds(roleId: string): Promise<string[]> {
  const { data, error } = await rbacClient
    .from('rbac_role_permissions')
    .select('permission_id')
    .eq('role_id', roleId);
  if (error) throw error;
  return (data ?? []).map((r: { permission_id: string }) => r.permission_id);
}

/** 更新角色权限（全量替换） */
export async function updateRolePermissions(roleId: string, permIds: string[]): Promise<void> {
  await rbacClient.from('rbac_role_permissions').delete().eq('role_id', roleId);
  if (permIds.length > 0) {
    const rows = permIds.map(pid => ({ role_id: roleId, permission_id: pid }));
    const { error } = await rbacClient.from('rbac_role_permissions').insert(rows);
    if (error) throw error;
  }
}

/** 拉取全部管理员账号 */
export async function fetchAdminAccounts(): Promise<AdminAccount[]> {
  const { data, error } = await rbacClient
    .from('admin_accounts')
    .select('id,username,display_name,role_ids,is_active,is_tier_admin,last_login_at,created_at')
    .order('created_at');
  if (error) throw error;
  return (data ?? []) as AdminAccount[];
}

/** 创建管理员账号 */
export async function createAdminAccount(
  params: { username: string; display_name: string; role_ids: string[]; plain_password?: string; password_hash?: string; notes?: string }
): Promise<void> {
  const { error } = await rbacClient.from('admin_accounts').insert({
    username: params.username,
    display_name: params.display_name,
    role_ids: params.role_ids,
    plain_password: params.plain_password ?? null,
    password_hash: params.password_hash ?? 'system_managed',
    notes: params.notes ?? null,
  });
  if (error) throw error;
}

/** 切换管理员启用状态 */
export async function toggleAdminStatus(id: string, is_active: boolean): Promise<void> {
  const { error } = await rbacClient
    .from('admin_accounts')
    .update({ is_active, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 设置/取消分级管理员 */
export async function setTierAdmin(id: string, is_tier_admin: boolean): Promise<void> {
  const { error } = await rbacClient
    .from('admin_accounts')
    .update({ is_tier_admin, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 拉取分级管理范围 */
export async function fetchManagementScopes(): Promise<RoleManagementScope[]> {
  const { data, error } = await rbacClient
    .from('role_management_scope')
    .select('*');
  if (error) throw error;
  return (data ?? []) as RoleManagementScope[];
}

/** 保存分级管理范围（upsert） */
export async function saveManagementScope(
  roleId: string,
  managedRoleIds: string[],
  allowedPermIds: string[]
): Promise<void> {
  const { error } = await rbacClient
    .from('role_management_scope')
    .upsert({
      tier_admin_role_id: roleId,
      managed_role_ids: managedRoleIds,
      allowed_perm_ids: allowedPermIds,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'tier_admin_role_id' });
  if (error) throw error;
}

/** 写入操作日志 */
export async function writeLog(params: {
  admin_name: string;
  action: string;
  target_type?: string;
  target_id?: string;
  target_name?: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  await rbacClient.from('operation_logs').insert(params);
}

/** 拉取操作日志（最近100条） */
export async function fetchLogs(limit = 100): Promise<OperationLog[]> {
  const { data, error } = await rbacClient
    .from('operation_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as OperationLog[];
}

/** 拉取销售客户（支持 ownerId 过滤） */
export async function fetchCustomers(ownerId?: string): Promise<SalesCustomer[]> {
  let q = rbacClient.from('sales_customers').select('*').order('updated_at', { ascending: false });
  if (ownerId) q = q.eq('owner_id', ownerId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SalesCustomer[];
}

/** 创建客户 */
export async function createCustomer(
  params: Partial<SalesCustomer> & { name: string }
): Promise<void> {
  const { error } = await rbacClient.from('sales_customers').insert(params);
  if (error) throw error;
}

/** 提交折扣申请 */
export async function submitDiscountRequest(
  params: Omit<DiscountRequest, 'id' | 'status' | 'created_at'>
): Promise<void> {
  const { error } = await rbacClient.from('discount_requests').insert({
    ...params,
    status: 'pending',
  });
  if (error) throw error;
}

/** 拉取折扣申请（审批方：全部；申请方：按 applicant_id）*/
export async function fetchDiscountRequests(applicantId?: string): Promise<DiscountRequest[]> {
  let q = rbacClient
    .from('discount_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (applicantId) q = q.eq('applicant_id', applicantId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as DiscountRequest[];
}

/** 审批折扣申请 */
export async function reviewDiscountRequest(
  id: string,
  status: 'approved' | 'rejected',
  reviewer_name: string,
  review_note?: string
): Promise<void> {
  const coupon_code = status === 'approved'
    ? `DISC${Date.now().toString(36).toUpperCase()}`
    : undefined;
  const { error } = await rbacClient
    .from('discount_requests')
    .update({
      status,
      reviewer_name,
      review_note: review_note ?? null,
      coupon_code: coupon_code ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

/** 拉取销售订单 */
export async function fetchOrders(ownerId?: string): Promise<SalesOrder[]> {
  let q = rbacClient.from('sales_orders').select('*').order('created_at', { ascending: false });
  if (ownerId) q = q.eq('owner_id', ownerId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as SalesOrder[];
}

/** 创建销售订单 */
export async function createOrder(
  params: Omit<SalesOrder, 'id' | 'created_at'>
): Promise<void> {
  const { error } = await rbacClient.from('sales_orders').insert(params);
  if (error) throw error;
}

// ── 工具函数 ──────────────────────────────────────────────

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins}分钟前`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}小时前`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}
