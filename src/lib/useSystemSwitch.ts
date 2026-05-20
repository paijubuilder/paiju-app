/**
 * useSystemSwitch — 直接读写 system_switches 表的持久化开关 Hook
 *
 * 与 usePersistSwitch（基于 AdminConfig）不同，
 * 本 Hook 直接操作 system_switches 表，适用于原生功能开关。
 */
import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/client/supabase';

const RETRY_COUNT = 3;
const RETRY_DELAY = 1000;

interface UseSystemSwitchOptions {
  switchKey: string;
  initialValue: boolean;
}

export function useSystemSwitch({ switchKey, initialValue }: UseSystemSwitchOptions) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevValue = useRef(initialValue);

  const toggle = useCallback(() => {
    const nextVal = !value;
    setValue(nextVal);  // 乐观更新
    setSaving(true);
    setError(null);

    let attempt = 0;
    const tryCommit = async (): Promise<void> => {
      attempt++;
      try {
        const { error: dbErr } = await supabase
          .from('system_switches')
          .update({ is_enabled: nextVal, updated_at: new Date().toISOString() })
          .eq('switch_key', switchKey);

        if (dbErr) throw new Error(dbErr.message);
        prevValue.current = nextVal;
      } catch (e) {
        if (attempt < RETRY_COUNT) {
          await new Promise(r => setTimeout(r, RETRY_DELAY));
          return tryCommit();
        }
        // 3次失败 → 回滚
        setValue(prevValue.current);
        setError('保存失败，已回滚');
      } finally {
        if (attempt >= RETRY_COUNT || !error) setSaving(false);
      }
    };

    tryCommit().finally(() => setSaving(false));
  }, [value, switchKey, error]);

  return { value, toggle, saving, error };
}

/** 批量从 DB 加载 system_switches 开关状态 */
export async function loadSystemSwitches(
  keys: string[]
): Promise<Record<string, boolean>> {
  const { data } = await supabase
    .from('system_switches')
    .select('switch_key, is_enabled')
    .in('switch_key', keys);

  const result: Record<string, boolean> = {};
  if (data) {
    for (const row of data) {
      result[row.switch_key] = row.is_enabled;
    }
  }
  return result;
}
