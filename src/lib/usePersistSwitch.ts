/**
 * usePersistSwitch — 统一开关持久化 Hook
 *
 * 用法：
 *   const { value, toggle, saving, error } = usePersistSwitch({
 *     switchKey: 'featureFloatWindow',
 *     switchLabel: '通知栏提醒',
 *     module: '系统设置',
 *     initialValue: cfg.featureFloatWindow,
 *     onCommit: (v) => onSave({ featureFloatWindow: v }),
 *   });
 *
 * 特性：
 * - 乐观更新：UI 立即响应
 * - 自动重试：失败后间隔 1s 重试 3 次
 * - 失败回滚：3 次均失败后恢复原值
 * - 日志记录：每次成功变更写入 switch_change_logs
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { logSwitchChange } from '@/lib/appStore';
import type { AdminConfig } from '@/lib/appStore';

const RETRY_COUNT = 3;
const RETRY_DELAY = 1000;

interface UsePersistSwitchOptions {
  switchKey: keyof AdminConfig;
  switchLabel: string;
  module?: string;
  initialValue: boolean;
  /** 将新值提交到持久化层（调用 onSave/saveConfig） */
  onCommit: (newValue: boolean) => void | Promise<void>;
}

interface UsePersistSwitchResult {
  value: boolean;
  toggle: () => void;
  saving: boolean;
  error: string | null;
}

export function usePersistSwitch({
  switchKey, switchLabel, module: mod = '', initialValue, onCommit,
}: UsePersistSwitchOptions): UsePersistSwitchResult {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevValue = useRef(initialValue);
  // 关键修复：当父组件从 DB 刷新 config 后同步最新值到 hook 内部 state
  // 仅在非保存中且值确实变化时才同步（避免覆盖乐观更新）
  useEffect(() => {
    if (!saving) {
      setValue(initialValue);
      prevValue.current = initialValue;
    }
  }, [initialValue]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    const next = !value;
    const prev = value;
    prevValue.current = prev;

    // 乐观更新 UI
    setValue(next);
    setError(null);
    setSaving(true);

    // 带重试的提交
    let attempt = 0;
    const tryCommit = async (): Promise<void> => {
      try {
        await onCommit(next);
        // 成功：写入日志
        await logSwitchChange({
          switchKey: switchKey as string,
          switchLabel,
          oldValue: prev,
          newValue: next,
          module: mod,
        });
        setSaving(false);
      } catch (e) {
        attempt++;
        if (attempt < RETRY_COUNT) {
          await new Promise(r => setTimeout(r, RETRY_DELAY));
          return tryCommit();
        }
        // 3 次全失败：回滚 UI，显示错误
        setValue(prev);
        setError(`网络错误，已自动恢复，请稍后再试（${e instanceof Error ? e.message : '未知错误'}）`);
        setSaving(false);
      }
    };

    tryCommit();
  }, [value, onCommit, switchKey, switchLabel, mod]);

  return { value, toggle, saving, error };
}
