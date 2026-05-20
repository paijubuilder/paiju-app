/**
 * 权限管理页面 — 仅超级管理员可见
 * 四个子模块：角色管理 · 管理员管理 · 分级授权配置 · 操作日志
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable, ScrollView,
  Switch, Text, TextInput, View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import {
  fetchRoles, fetchPermissions, fetchRolePermIds, updateRolePermissions,
  fetchAdminAccounts, createAdminAccount, toggleAdminStatus, setTierAdmin,
  fetchManagementScopes, saveManagementScope,
  fetchLogs, writeLog,
  getRbacSession, isRbacSuperAdmin,
  generateInitPassword, resetAdminPassword, unlockAdminAccount, deleteAdminAccount,
  getCreatableRoles,
  ROLE_META,
  fmtDate, formatRelativeTime,
  type RbacRole, type RbacPermission, type AdminAccount,
  type RoleManagementScope, type OperationLog,
} from '@/lib/rbac';
import { isAdminSessionValidated } from '@/lib/appStore';

// ── 常量 ─────────────────────────────────────────────────
const SUBTABS = [
  { key: 'roles',   label: '角色管理',   icon: '🎭' },
  { key: 'admins',  label: '管理员管理', icon: '👤' },
  { key: 'tier',    label: '分级授权',   icon: '🔑' },
  { key: 'logs',    label: '操作日志',   icon: '📋' },
] as const;
type SubTab = typeof SUBTABS[number]['key'];

// ── 颜色常量 ─────────────────────────────────────────────
const BG   = '#0D0F12';
const CARD = '#161A1F';
const BD   = '#2A3140';
const T1   = '#F0F4FF';
const T2   = '#8899AA';
const T3   = '#667080';

// ── 公共小组件 ───────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1, borderColor: BD, marginBottom: 12, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BD }}>
        <Text style={{ color: T2, fontSize: 11, fontWeight: 'bold', letterSpacing: 0.5 }}>{title}</Text>
      </View>
      <View style={{ padding: 14, gap: 10 }}>{children}</View>
    </View>
  );
}

function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ color, fontSize: 10, fontWeight: 'bold' }}>{label}</Text>
    </View>
  );
}

function Btn({
  label, onPress, color = '#2563EB', outline, small,
}: {
  label: string; onPress: () => void; color?: string; outline?: boolean; small?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{ backgroundColor: outline ? 'transparent' : color,
        borderWidth: outline ? 1 : 0, borderColor: outline ? color : undefined,
        borderRadius: 10, paddingVertical: small ? 6 : 10,
        paddingHorizontal: small ? 12 : 18, alignItems: 'center' }}>
      <Text style={{ color: outline ? color : '#fff', fontSize: small ? 12 : 13, fontWeight: 'bold' }}>{label}</Text>
    </Pressable>
  );
}

function ModalSheet({ visible, title, onClose, children }: {
  visible: boolean; title: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: CARD, borderTopLeftRadius: 22, borderTopRightRadius: 22,
          borderTopWidth: 1, borderTopColor: BD, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: BD }}>
            <Text style={{ color: T1, fontSize: 15, fontWeight: 'bold', flex: 1 }}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={{ color: T2, fontSize: 20 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 14 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ── Tab1：角色管理 ────────────────────────────────────────

function RolesTab() {
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [perms, setPerms] = useState<RbacPermission[]>([]);
  const [selectedRole, setSelectedRole] = useState<RbacRole | null>(null);
  const [rolePermIds, setRolePermIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchRoles(), fetchPermissions()])
      .then(([r, p]) => { setRoles(r); setPerms(p); })
      .finally(() => setLoading(false));
  }, []);

  const openEdit = async (role: RbacRole) => {
    setSelectedRole(role);
    const ids = await fetchRolePermIds(role.id);
    setRolePermIds(ids);
    setEditing(true);
  };

  const togglePerm = (id: string) => {
    setRolePermIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await updateRolePermissions(selectedRole.id, rolePermIds);
      await writeLog({
        admin_name: '超级管理员',
        action: '修改角色权限',
        target_type: 'role',
        target_id: selectedRole.id,
        target_name: selectedRole.label,
        detail: { perm_count: rolePermIds.length },
      });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  // 按模块分组权限
  const permsByModule = perms.reduce<Record<string, RbacPermission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2563EB" />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <SectionCard title="📋 权限矩阵说明">
        <Text style={{ color: T2, fontSize: 12, lineHeight: 18 }}>
          共 8 个预置角色，点击角色卡片可查看并编辑其权限点。
          系统角色（🔒）的角色结构不可删除，但权限可调整。
        </Text>
      </SectionCard>

      {roles.map(role => {
        const meta = ROLE_META[role.name] ?? { color: T2, bg: '#33333322', icon: '👤' };
        return (
          <Pressable key={role.id} onPress={() => openEdit(role)}
            style={{ backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
              borderColor: BD, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ width: 42, height: 42, borderRadius: 12, backgroundColor: meta.bg,
              alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 20 }}>{meta.icon}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Text style={{ color: T1, fontWeight: 'bold', fontSize: 14 }}>{role.label}</Text>
                {role.is_system && <Tag label="系统" color={T3} bg="#33333344" />}
                <Tag label={`Lv.${role.level}`} color={meta.color} bg={meta.bg} />
              </View>
              <Text style={{ color: T3, fontSize: 11 }} numberOfLines={1}>{role.description}</Text>
            </View>
            <Text style={{ color: T3, fontSize: 18 }}>›</Text>
          </Pressable>
        );
      })}

      {/* 编辑权限弹窗 */}
      <ModalSheet
        visible={editing}
        title={`编辑权限 · ${selectedRole?.label ?? ''}`}
        onClose={() => setEditing(false)}>
        {Object.entries(permsByModule).map(([module, mPerms]) => (
          <View key={module}>
            <Text style={{ color: T2, fontSize: 11, fontWeight: 'bold', marginBottom: 8,
              letterSpacing: 0.5, textTransform: 'uppercase' }}>{module}</Text>
            {mPerms.map(p => (
              <Pressable key={p.id} onPress={() => togglePerm(p.id)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8,
                  borderBottomWidth: 1, borderBottomColor: BD }}>
                <View style={{ width: 20, height: 20, borderRadius: 6,
                  backgroundColor: rolePermIds.includes(p.id) ? '#2563EB' : '#33333344',
                  borderWidth: 1, borderColor: rolePermIds.includes(p.id) ? '#2563EB' : BD,
                  alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  {rolePermIds.includes(p.id) && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                </View>
                <Text style={{ color: T1, fontSize: 13, flex: 1 }}>{p.label}</Text>
                <Text style={{ color: T3, fontSize: 10 }}>{p.code}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
          <View style={{ flex: 1 }}>
            <Btn label="取消" onPress={() => setEditing(false)} color={T2} outline />
          </View>
          <View style={{ flex: 2 }}>
            <Btn label={saving ? '保存中…' : `保存（${rolePermIds.length}项权限）`}
              onPress={handleSave} />
          </View>
        </View>
      </ModalSheet>
    </ScrollView>
  );
}

// ── Tab2：管理员管理 ──────────────────────────────────────

function AdminsTab() {
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [roles, setRoles] = useState<RbacRole[]>([]);          // 全量角色（用于显示）
  const [creatableRoles, setCreatableRoles] = useState<RbacRole[]>([]);  // 当前管理员可创建的角色
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    role_ids: [] as string[],
    notes: '',
    auto_pw: generateInitPassword(),
  });
  const [showFormPw, setShowFormPw] = useState(false);
  const [saving, setSaving] = useState(false);

  // 各行展开的密码显示 & 操作
  const [revealPw, setRevealPw] = useState<Record<string, boolean>>({});
  const [resetResult, setResetResult] = useState<Record<string, string>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);  // 待删除 id

  const rbacSession = getRbacSession();
  const operatorName = rbacSession?.adminName ?? '管理员';
  const superAdmin = isRbacSuperAdmin();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, r, cr] = await Promise.all([
        fetchAdminAccounts(),
        fetchRoles(),
        getCreatableRoles(rbacSession?.adminId ?? ''),
      ]);
      setAccounts(a.filter(x => !x.deleted_at));
      setRoles(r);
      setCreatableRoles(cr);
    } finally {
      setLoading(false);
    }
  }, [rbacSession?.adminId]);

  useEffect(() => { load(); }, [load]);

  const refreshFormPw = () => setForm(f => ({ ...f, auto_pw: generateInitPassword() }));

  const handleCreate = async () => {
    if (!form.username.trim() || !form.display_name.trim()) return;
    if (form.role_ids.length === 0) return;
    setSaving(true);
    try {
      await createAdminAccount({
        username: form.username.trim(),
        display_name: form.display_name.trim(),
        role_ids: form.role_ids,
        plain_password: form.auto_pw,
        password_hash: form.auto_pw,
        notes: form.notes.trim() || undefined,
      });
      await writeLog({
        admin_name: operatorName,
        action: '新增管理员账号',
        target_type: 'admin',
        target_name: form.display_name,
        detail: { username: form.username, roles: form.role_ids.length, notes: form.notes },
      });
      setShowCreate(false);
      setForm({ username: '', display_name: '', role_ids: [], notes: '', auto_pw: generateInitPassword() });
      load();
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    await toggleAdminStatus(id, !current);
    await writeLog({ admin_name: operatorName, action: current ? '禁用管理员' : '启用管理员', target_type: 'admin', target_id: id });
    load();
  };

  const handleSetTier = async (id: string, current: boolean) => {
    await setTierAdmin(id, !current);
    await writeLog({ admin_name: operatorName, action: current ? '撤销分级管理员' : '设为分级管理员', target_type: 'admin', target_id: id });
    load();
  };

  const handleResetPw = async (id: string) => {
    const newPw = await resetAdminPassword(id, operatorName);
    setResetResult(r => ({ ...r, [id]: newPw }));
    load();
  };

  const handleUnlock = async (id: string) => {
    await unlockAdminAccount(id, operatorName);
    load();
  };

  const handleDelete = async (id: string) => {
    await deleteAdminAccount(id, operatorName);
    setDeleteConfirm(null);
    load();
  };

  const getRoleLabel = (roleId: string) => roles.find(r => r.id === roleId)?.label ?? roleId;

  const isLocked = (acc: AdminAccount) =>
    !!acc.locked_until && new Date(acc.locked_until) > new Date();

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2563EB" />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      {/* 顶栏：可创建角色提示 + 新增按钮 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: T3, fontSize: 11 }}>
            {superAdmin
              ? '当前可创建：全部角色'
              : `可创建角色：${creatableRoles.map(r => r.label).join('、') || '无（请联系超级管理员配置分级授权）'}`}
          </Text>
        </View>
        {creatableRoles.length > 0 && (
          <Btn label="＋ 新增管理员" onPress={() => setShowCreate(true)} small />
        )}
      </View>

      {accounts.map(acc => {
        const meta = acc.role_ids.length > 0
          ? (ROLE_META[roles.find(r => r.id === acc.role_ids[0])?.name ?? ''] ?? { color: T2, bg: '#33333322', icon: '👤' })
          : { color: T2, bg: '#33333322', icon: '👤' };
        const locked = isLocked(acc);
        const newPw = resetResult[acc.id];
        return (
          <View key={acc.id} style={{
            backgroundColor: CARD, borderRadius: 14, borderWidth: 1,
            borderColor: locked ? '#F59E0B44' : BD, padding: 14, gap: 10,
          }}>
            {/* 基本信息行 */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{
                width: 38, height: 38, borderRadius: 10, backgroundColor: meta.bg,
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                  <Text style={{ color: T1, fontWeight: 'bold', fontSize: 14 }}>{acc.display_name}</Text>
                  {acc.is_tier_admin && <Tag label="分级管理员" color="#F59E0B" bg="#F59E0B22" />}
                  <Tag
                    label={acc.is_active ? '启用' : '禁用'}
                    color={acc.is_active ? '#10B981' : '#EF4444'}
                    bg={acc.is_active ? '#10B98122' : '#EF444422'}
                  />
                  {locked && <Tag label="🔒 已锁定" color="#F59E0B" bg="#F59E0B22" />}
                </View>
                <Text style={{ color: T3, fontSize: 11 }}>@{acc.username}</Text>
                {acc.notes ? <Text style={{ color: T3, fontSize: 10, marginTop: 2 }}>{acc.notes}</Text> : null}
              </View>
              <Switch
                value={acc.is_active}
                onValueChange={() => handleToggle(acc.id, acc.is_active)}
                trackColor={{ true: '#2563EB55', false: '#33333355' }}
                thumbColor={acc.is_active ? '#2563EB' : T3}
              />
            </View>

            {/* 角色标签 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {acc.role_ids.map(rid => {
                const rName = roles.find(r => r.id === rid)?.name ?? '';
                const rm = ROLE_META[rName] ?? { color: T2, bg: '#33333322' };
                return <Tag key={rid} label={getRoleLabel(rid)} color={rm.color} bg={rm.bg} />;
              })}
            </View>

            {/* 初始/重置密码展示行 */}
            {(acc.plain_password || newPw) && (
              <View style={{
                backgroundColor: '#10B98118', borderRadius: 8, borderWidth: 1,
                borderColor: '#10B98133', padding: 10, gap: 4,
              }}>
                <Text style={{ color: '#10B981', fontSize: 11, fontWeight: 'bold' }}>
                  {newPw ? '🔑 最新密码（已重置）' : '🔑 初始密码'}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ color: T1, fontSize: 14, fontWeight: 'bold', flex: 1, letterSpacing: 1 }}>
                    {revealPw[acc.id] ? (newPw || acc.plain_password) : '••••••••'}
                  </Text>
                  <Pressable onPress={() => setRevealPw(r => ({ ...r, [acc.id]: !r[acc.id] }))}>
                    <Text style={{ color: T2, fontSize: 13 }}>{revealPw[acc.id] ? '隐藏' : '显示'}</Text>
                  </Pressable>
                </View>
                <Text style={{ color: T3, fontSize: 10 }}>请通知账号持有人妥善保管，首次登录建议更换密码</Text>
              </View>
            )}

            {/* 操作行 */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: BD, paddingTop: 10 }}>
              <Btn
                label={acc.is_tier_admin ? '撤销分级' : '设为分级'}
                onPress={() => handleSetTier(acc.id, acc.is_tier_admin)}
                color={acc.is_tier_admin ? '#EF4444' : '#8B5CF6'}
                small outline
              />
              <Btn
                label="重置密码"
                onPress={() => handleResetPw(acc.id)}
                color="#F59E0B"
                small outline
              />
              {locked && (
                <Btn
                  label="解除锁定"
                  onPress={() => handleUnlock(acc.id)}
                  color="#10B981"
                  small outline
                />
              )}
              <Btn
                label="删除"
                onPress={() => setDeleteConfirm(acc.id)}
                color="#EF4444"
                small outline
              />
              {acc.last_login_at && (
                <Text style={{ color: T3, fontSize: 10, alignSelf: 'center', marginLeft: 'auto' }}>
                  最近登录 {formatRelativeTime(acc.last_login_at)}
                </Text>
              )}
            </View>
          </View>
        );
      })}

      {accounts.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <Text style={{ fontSize: 36, marginBottom: 10 }}>👤</Text>
          <Text style={{ color: T2, fontSize: 14 }}>暂无管理员账号</Text>
          <Text style={{ color: T3, fontSize: 12, marginTop: 4 }}>点击「新增管理员」创建第一个账号</Text>
        </View>
      )}

      {/* ── 新增管理员弹窗 ── */}
      <ModalSheet visible={showCreate} title="新增管理员账号" onClose={() => setShowCreate(false)}>
        {/* 账号 */}
        <Text style={{ color: T2, fontSize: 12 }}>账号（用于登录）</Text>
        <TextInput
          value={form.username}
          onChangeText={v => setForm(f => ({ ...f, username: v }))}
          placeholder="英文用户名 / 手机号 / 邮箱"
          placeholderTextColor={T3}
          autoCapitalize="none"
          style={{ backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 10,
            padding: 12, color: T1, fontSize: 13 }}
        />
        {/* 姓名 */}
        <Text style={{ color: T2, fontSize: 12 }}>姓名 / 显示名</Text>
        <TextInput
          value={form.display_name}
          onChangeText={v => setForm(f => ({ ...f, display_name: v }))}
          placeholder="真实姓名或昵称"
          placeholderTextColor={T3}
          style={{ backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 10,
            padding: 12, color: T1, fontSize: 13 }}
        />
        {/* 初始密码 */}
        <Text style={{ color: T2, fontSize: 12 }}>初始密码（系统生成，可修改）</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, position: 'relative' }}>
            <TextInput
              value={form.auto_pw}
              onChangeText={v => setForm(f => ({ ...f, auto_pw: v }))}
              secureTextEntry={!showFormPw}
              style={{ backgroundColor: BG, borderWidth: 1, borderColor: '#10B98144', borderRadius: 10,
                padding: 12, color: '#10B981', fontSize: 14, fontWeight: 'bold', paddingRight: 40 }}
            />
            <Pressable
              onPress={() => setShowFormPw(v => !v)}
              style={{ position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center' }}
            >
              <Text style={{ color: T3, fontSize: 14 }}>{showFormPw ? '🙈' : '👁'}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={refreshFormPw}
            style={{ backgroundColor: '#10B98122', borderRadius: 8, padding: 10 }}
          >
            <Text style={{ color: '#10B981', fontSize: 13 }}>🔄</Text>
          </Pressable>
        </View>
        <Text style={{ color: T3, fontSize: 11 }}>请将此密码告知新管理员，首次登录后建议联系超管重置</Text>
        {/* 备注 */}
        <Text style={{ color: T2, fontSize: 12 }}>备注（可选）</Text>
        <TextInput
          value={form.notes}
          onChangeText={v => setForm(f => ({ ...f, notes: v }))}
          placeholder="职位、负责范围等"
          placeholderTextColor={T3}
          style={{ backgroundColor: BG, borderWidth: 1, borderColor: BD, borderRadius: 10,
            padding: 12, color: T1, fontSize: 13 }}
        />
        {/* 角色选择（仅显示可创建的角色） */}
        <Text style={{ color: T2, fontSize: 12 }}>分配角色（可多选）</Text>
        {creatableRoles.length === 0
          ? <Text style={{ color: T3, fontSize: 12 }}>当前账号暂无可创建的角色范围</Text>
          : creatableRoles.map(r => {
            const selected = form.role_ids.includes(r.id);
            const meta = ROLE_META[r.name] ?? { color: T2, bg: '#33333322', icon: '👤' };
            return (
              <Pressable key={r.id}
                onPress={() => setForm(f => ({
                  ...f,
                  role_ids: selected ? f.role_ids.filter(x => x !== r.id) : [...f.role_ids, r.id],
                }))}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BD }}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 6,
                  backgroundColor: selected ? '#2563EB' : '#33333344',
                  borderWidth: 1, borderColor: selected ? '#2563EB' : BD,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 16 }}>{meta.icon}</Text>
                <Text style={{ color: T1, fontSize: 13, flex: 1 }}>{r.label}</Text>
                <Tag label={`Lv.${r.level}`} color={meta.color} bg={meta.bg} />
              </Pressable>
            );
          })
        }
        <Btn
          label={saving ? '创建中…' : '确认创建'}
          onPress={handleCreate}
        />
      </ModalSheet>

      {/* ── 删除确认弹窗 ── */}
      <Modal visible={!!deleteConfirm} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
          alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <View style={{ backgroundColor: CARD, borderRadius: 18, borderWidth: 1,
            borderColor: '#EF444444', padding: 24, width: 280, gap: 14 }}>
            <Text style={{ color: T1, fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
              ⚠️ 确认删除账号？
            </Text>
            <Text style={{ color: T2, fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
              账号将被软删除，操作不可撤销。{'\n'}此操作将记录到操作日志。
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={() => setDeleteConfirm(null)}
                style={{ flex: 1, backgroundColor: '#33333344', borderRadius: 10,
                  paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: T2 }}>取消</Text>
              </Pressable>
              <Pressable
                onPress={() => deleteConfirm && handleDelete(deleteConfirm)}
                style={{ flex: 1, backgroundColor: '#EF4444', borderRadius: 10,
                  paddingVertical: 12, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>确认删除</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ── Tab3：分级授权配置 ────────────────────────────────────

function TierTab() {
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [perms, setPerms] = useState<RbacPermission[]>([]);
  const [scopes, setScopes] = useState<RoleManagementScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [editScope, setEditScope] = useState<{ role: RbacRole; scope: RoleManagementScope | null } | null>(null);
  const [managedRoleIds, setManagedRoleIds] = useState<string[]>([]);
  const [allowedPermIds, setAllowedPermIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [r, p, s] = await Promise.all([fetchRoles(), fetchPermissions(), fetchManagementScopes()]);
    setRoles(r);
    setPerms(p);
    setScopes(s);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openEdit = (role: RbacRole) => {
    const scope = scopes.find(s => s.tier_admin_role_id === role.id) ?? null;
    setEditScope({ role, scope });
    setManagedRoleIds(scope?.managed_role_ids ?? []);
    setAllowedPermIds(scope?.allowed_perm_ids ?? []);
  };

  const handleSave = async () => {
    if (!editScope) return;
    setSaving(true);
    try {
      await saveManagementScope(editScope.role.id, managedRoleIds, allowedPermIds);
      await writeLog({
        admin_name: '超级管理员',
        action: '配置分级授权范围',
        target_type: 'role',
        target_name: editScope.role.label,
        detail: { managed_roles: managedRoleIds.length, allowed_perms: allowedPermIds.length },
      });
      setEditScope(null);
      load();
    } finally {
      setSaving(false);
    }
  };

  const permsByModule = perms.reduce<Record<string, RbacPermission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2563EB" />
    </View>
  );

  // 只显示非超级管理员角色（可能成为分级管理员）
  const eligibleRoles = roles.filter(r => r.name !== 'super_admin');

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <SectionCard title="💡 功能说明">
        <Text style={{ color: T2, fontSize: 12, lineHeight: 18 }}>
          指定哪些角色成为"分级管理员"，并限定其可管理的下级角色范围和可分配的权限子集。
          {'\n'}分级管理员登录后可看到"下级角色管理"子菜单，但不能管理同级或上级角色。
        </Text>
      </SectionCard>

      {eligibleRoles.map(role => {
        const scope = scopes.find(s => s.tier_admin_role_id === role.id);
        const meta = ROLE_META[role.name] ?? { color: T2, bg: '#33333322', icon: '👤' };
        const hasTierConfig = !!scope;

        return (
          <View key={role.id} style={{ backgroundColor: CARD, borderRadius: 14,
            borderWidth: 1, borderColor: hasTierConfig ? '#F59E0B44' : BD, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: meta.bg,
                alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18 }}>{meta.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ color: T1, fontWeight: 'bold', fontSize: 13 }}>{role.label}</Text>
                  {hasTierConfig && <Tag label="分级管理员" color="#F59E0B" bg="#F59E0B22" />}
                </View>
                {hasTierConfig ? (
                  <Text style={{ color: T3, fontSize: 11, marginTop: 2 }}>
                    可管理 {scope.managed_role_ids.length} 个下级角色 · {scope.allowed_perm_ids.length} 项权限
                  </Text>
                ) : (
                  <Text style={{ color: T3, fontSize: 11, marginTop: 2 }}>未配置分级授权</Text>
                )}
              </View>
              <Btn label={hasTierConfig ? '编辑范围' : '配置授权'} onPress={() => openEdit(role)} small />
            </View>
            {hasTierConfig && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingTop: 4,
                borderTopWidth: 1, borderTopColor: BD }}>
                {scope.managed_role_ids.slice(0, 4).map(rid => {
                  const r = roles.find(x => x.id === rid);
                  const rm = ROLE_META[r?.name ?? ''] ?? { color: T2, bg: '#33333322' };
                  return r ? <Tag key={rid} label={r.label} color={rm.color} bg={rm.bg} /> : null;
                })}
              </View>
            )}
          </View>
        );
      })}

      {/* 编辑分级范围弹窗 */}
      {editScope && (
        <ModalSheet
          visible
          title={`分级授权配置 · ${editScope.role.label}`}
          onClose={() => setEditScope(null)}>
          <Text style={{ color: '#F59E0B', fontSize: 12, lineHeight: 18, backgroundColor: '#F59E0B11',
            padding: 10, borderRadius: 8 }}>
            ⚠️ 分级管理员的任何操作不能超出此处划定的范围。所有操作均记录到操作日志。
          </Text>

          <Text style={{ color: T1, fontWeight: 'bold', fontSize: 13 }}>可管理的下级角色</Text>
          {eligibleRoles.filter(r => r.id !== editScope.role.id).map(r => {
            const selected = managedRoleIds.includes(r.id);
            const meta = ROLE_META[r.name] ?? { color: T2, bg: '#33333322', icon: '👤' };
            return (
              <Pressable key={r.id}
                onPress={() => setManagedRoleIds(prev =>
                  selected ? prev.filter(x => x !== r.id) : [...prev, r.id]
                )}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                  paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: BD }}>
                <View style={{ width: 20, height: 20, borderRadius: 6,
                  backgroundColor: selected ? '#F59E0B' : '#33333344',
                  borderWidth: 1, borderColor: selected ? '#F59E0B' : BD,
                  alignItems: 'center', justifyContent: 'center' }}>
                  {selected && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 15 }}>{meta.icon}</Text>
                <Text style={{ color: T1, fontSize: 13, flex: 1 }}>{r.label}</Text>
              </Pressable>
            );
          })}

          <Text style={{ color: T1, fontWeight: 'bold', fontSize: 13, marginTop: 8 }}>可分配的权限子集</Text>
          {Object.entries(permsByModule).map(([module, mPerms]) => (
            <View key={module}>
              <Text style={{ color: T3, fontSize: 11, fontWeight: 'bold', marginTop: 6, marginBottom: 4 }}>{module}</Text>
              {mPerms.map(p => {
                const selected = allowedPermIds.includes(p.id);
                return (
                  <Pressable key={p.id}
                    onPress={() => setAllowedPermIds(prev =>
                      selected ? prev.filter(x => x !== p.id) : [...prev, p.id]
                    )}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10,
                      paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: BD }}>
                    <View style={{ width: 18, height: 18, borderRadius: 4,
                      backgroundColor: selected ? '#8B5CF6' : '#33333344',
                      borderWidth: 1, borderColor: selected ? '#8B5CF6' : BD,
                      alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <Text style={{ color: '#fff', fontSize: 10 }}>✓</Text>}
                    </View>
                    <Text style={{ color: T1, fontSize: 12, flex: 1 }}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}

          <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Btn label="取消" onPress={() => setEditScope(null)} color={T2} outline />
            </View>
            <View style={{ flex: 2 }}>
              <Btn
                label={saving ? '保存中…' : `保存配置`}
                onPress={handleSave}
                color="#8B5CF6"
              />
            </View>
          </View>
        </ModalSheet>
      )}
    </ScrollView>
  );
}

// ── Tab4：操作日志 ────────────────────────────────────────

function LogsTab() {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await fetchLogs(200);
    setLogs(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const ACTION_COLORS: Record<string, string> = {
    '系统初始化':     '#64748B',
    '角色配置':       '#8B5CF6',
    '配置分级授权范围':'#8B5CF6',
    '修改角色权限':   '#2563EB',
    '新增管理员账号': '#10B981',
    '禁用管理员':     '#EF4444',
    '启用管理员':     '#10B981',
    '设为分级管理员': '#F59E0B',
    '撤销分级管理员': '#EF4444',
  };

  const filtered = filter
    ? logs.filter(l =>
        l.admin_name.includes(filter) ||
        l.action.includes(filter) ||
        (l.target_name ?? '').includes(filter)
      )
    : logs;

  if (loading) return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#2563EB" />
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <TextInput
          value={filter}
          onChangeText={setFilter}
          placeholder="搜索操作人、操作类型或对象名称…"
          placeholderTextColor={T3}
          style={{ backgroundColor: CARD, borderWidth: 1, borderColor: BD,
            borderRadius: 10, padding: 10, color: T1, fontSize: 13 }}
        />
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 8 }}>
        <Text style={{ color: T3, fontSize: 11, marginBottom: 4 }}>
          共 {filtered.length} 条记录（最近 200 条，保留 90 天）
        </Text>
        {filtered.map(log => {
          const color = ACTION_COLORS[log.action] ?? '#64748B';
          return (
            <View key={log.id} style={{ backgroundColor: CARD, borderRadius: 12,
              borderWidth: 1, borderColor: BD, padding: 12, gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <View style={{ backgroundColor: `${color}22`, borderRadius: 6,
                  paddingHorizontal: 8, paddingVertical: 3, marginTop: 1 }}>
                  <Text style={{ color, fontSize: 11, fontWeight: 'bold' }}>{log.action}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: T1, fontSize: 12 }}>
                    <Text style={{ fontWeight: 'bold' }}>{log.admin_name}</Text>
                    {log.target_name ? ` 对象：${log.target_name}` : ''}
                  </Text>
                  {log.detail && (
                    <Text style={{ color: T3, fontSize: 11, marginTop: 2 }}>
                      {JSON.stringify(log.detail)}
                    </Text>
                  )}
                </View>
                <Text style={{ color: T3, fontSize: 10, flexShrink: 0 }}>
                  {fmtDate(log.created_at)}
                </Text>
              </View>
            </View>
          );
        })}
        {filtered.length === 0 && (
          <View style={{ alignItems: 'center', paddingVertical: 40 }}>
            <Text style={{ color: T3, fontSize: 14 }}>📋 暂无匹配记录</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── 主页面 ────────────────────────────────────────────────

export default function AdminPermissionScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SubTab>('roles');

  useFocusEffect(useCallback(() => {
    if (!isAdminSessionValidated()) {
      router.replace('/(app)/admin-verify' as never);
    }
  }, [router]));

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar style="light" backgroundColor={BG} />

      {/* 顶部标题栏 */}
      <View style={{ paddingTop: 52, paddingBottom: 10, paddingHorizontal: 20,
        backgroundColor: BG, borderBottomWidth: 1, borderBottomColor: '#1E2530' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <Pressable onPress={() => router.back()} style={{ marginRight: 12 }}>
            <Text style={{ color: C.BLUE, fontSize: 22 }}>←</Text>
          </Pressable>
          <Text style={{ color: T1, fontSize: 16, fontWeight: 'bold', flex: 1 }}>权限管理</Text>
          <Tag label="仅超级管理员" color="#F59E0B" bg="#F59E0B22" />
        </View>
        <Text style={{ color: T3, fontSize: 11, paddingLeft: 34 }}>
          💡 RBAC角色权限体系 · 分级管理 · 操作可追溯
        </Text>
      </View>

      {/* 子Tab栏 */}
      <View style={{ flexDirection: 'row', backgroundColor: BG,
        borderBottomWidth: 1, borderBottomColor: '#1E2530' }}>
        {SUBTABS.map(tab => (
          <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 10, gap: 2,
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? '#2563EB' : 'transparent' }}>
            <Text style={{ fontSize: 16 }}>{tab.icon}</Text>
            <Text style={{ fontSize: 10, color: activeTab === tab.key ? '#2563EB' : T3,
              fontWeight: activeTab === tab.key ? 'bold' : 'normal' }}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 内容区 */}
      <View style={{ flex: 1 }}>
        {activeTab === 'roles'  && <RolesTab />}
        {activeTab === 'admins' && <AdminsTab />}
        {activeTab === 'tier'   && <TierTab />}
        {activeTab === 'logs'   && <LogsTab />}
      </View>
    </View>
  );
}
