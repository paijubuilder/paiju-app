/**
 * 开关持久化 Store（统一方案）
 * - 所有后台开关通过此模块读写 Supabase system_switches 表
 * - 支持批量加载、单个更新、带日志的变更记录
 */
import { createClient } from '@supabase/supabase-js';

function _sb() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface SwitchDef {
  key: string;
  label: string;
  module: 'feature' | 'ai' | 'payment' | 'general';
  defaultValue: boolean;
}

/** 全部开关定义（单一来源）*/
export const SWITCH_DEFS: SwitchDef[] = [
  { key: 'featureFloatWindow',  label: '通知栏提醒',         module: 'feature',  defaultValue: true  },
  { key: 'featureNotification', label: '系统通知推送',        module: 'feature',  defaultValue: true  },
  { key: 'featurePip',          label: '画中画功能',          module: 'feature',  defaultValue: false },
  { key: 'featureAutoUpdate',   label: '自动更新',            module: 'feature',  defaultValue: false },
  { key: 'ai_autonomous_mode',  label: 'AI自主经营模式',      module: 'ai',       defaultValue: false },
  { key: 'ai_auto_sync_price',  label: '修改价格后自动同步知识库', module: 'ai',  defaultValue: true  },
  { key: 'ai_cs_enabled',       label: 'AI智能客服',          module: 'ai',       defaultValue: true  },
  { key: 'ai_optimize_enabled', label: 'AI自主优化规则',      module: 'ai',       defaultValue: false },
  { key: 'payment_member',      label: '会员支付开关',        module: 'payment',  defaultValue: false },
  { key: 'payment_agent',       label: '代理支付开关',        module: 'payment',  defaultValue: false },
];

export type SwitchMap = Record<string, boolean>;

/** 内存缓存（避免每次重复请求） */
let _cache: SwitchMap | null = null;
let _cacheAt = 0;
const CACHE_TTL = 30_000; // 30秒

/** 获取所有开关状态（优先缓存，缓存过期则重新拉取）*/
export async function loadAllSwitches(): Promise<SwitchMap> {
  const now = Date.now();
  if (_cache && now - _cacheAt < CACHE_TTL) return _cache;
  const sb = _sb();
  if (!sb) return _buildDefault();
  try {
    const { data, error } = await sb.from('system_switches').select('switch_key, is_enabled');
    if (error || !data) return _buildDefault();
    const map: SwitchMap = _buildDefault();
    for (const row of data) map[row.switch_key] = row.is_enabled;
    _cache = map;
    _cacheAt = now;
    return map;
  } catch { return _buildDefault(); }
}

/** 更新单个开关（写 DB + 失效缓存 + 记录日志）*/
export async function updateSwitch(key: string, enabled: boolean, operator = '管理员'): Promise<boolean> {
  const sb = _sb();
  if (!sb) return false;
  try {
    const def = SWITCH_DEFS.find(d => d.key === key);
    const label = def?.label ?? key;
    // 先读旧值用于日志
    const { data: old } = await sb.from('system_switches').select('is_enabled').eq('switch_key', key).maybeSingle();
    // upsert 开关状态
    const { error } = await sb.from('system_switches').upsert(
      { switch_key: key, switch_label: label, is_enabled: enabled, module: def?.module ?? 'general', updated_at: new Date().toISOString(), updated_by: operator },
      { onConflict: 'switch_key' }
    );
    if (error) return false;
    // 写变更日志
    await sb.from('switch_change_logs').insert({
      switch_key: key, switch_label: label,
      old_value: old?.is_enabled != null ? String(old.is_enabled) : 'unknown',
      new_value: String(enabled),
      operator, module: def?.module ?? 'general',
    });
    // 失效缓存，下次 loadAllSwitches 重新拉取
    _cache = null;
    return true;
  } catch { return false; }
}

/** 批量更新开关（如从 admin_config 同步） */
export async function syncSwitchesFromConfig(cfg: Record<string, unknown>): Promise<void> {
  const switchKeys = SWITCH_DEFS.map(d => d.key);
  for (const key of switchKeys) {
    if (key in cfg) {
      await updateSwitch(key, Boolean(cfg[key]), '配置同步');
    }
  }
}

function _buildDefault(): SwitchMap {
  const m: SwitchMap = {};
  for (const d of SWITCH_DEFS) m[d.key] = d.defaultValue;
  return m;
}

/** 获取单个开关状态（先查缓存） */
export async function getSwitch(key: string): Promise<boolean> {
  const map = await loadAllSwitches();
  const def = SWITCH_DEFS.find(d => d.key === key);
  return map[key] ?? def?.defaultValue ?? false;
}
