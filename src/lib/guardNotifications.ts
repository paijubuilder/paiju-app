/**
 * 护航通知管理器 v2
 *
 * 差异化策略：
 *   试用用户 → 4条通知（扫描完成/第5分/第8分/第10分）
 *   付费会员 → 2条通知（扫描完成/第10分）
 *
 * 无响应静默：第10分钟通知推送后，若用户5分钟内无交互，
 *   自动推送"护航已结束超5分钟，任务自动关闭"，之后不再推送任何通知。
 *
 * 因无原生推送依赖，采用 setTimeout 驱动的应用内通知横幅。
 */

import { getConfig } from './appStore';

export type GuardNotif = {
  id: string;
  icon: string;
  message: string;
  /** 是否可点击跳转（试用 → 付费页；会员 → 报告页） */
  clickable: boolean;
  /** 触发时间（护航启动后多少毫秒，扫描完成=0） */
  delayMs: number;
  /** 跳转目标路由 */
  targetRoute?: string;
};

// ── 试用用户通知（4条，价格动态读取） ────────────────────
export function getTrialNotifs(): GuardNotif[] {
  const cfg = getConfig();
  const daily = (parseFloat(cfg.cost30Day) / 30).toFixed(2);
  return [
    {
      id: 't0',
      icon: '✅',
      message: '扫描完成，环境安全。护航已开启。',
      clickable: false,
      delayMs: 0,
    },
    {
      id: 't1',
      icon: '🛡️',
      message: '护航运行正常，已守护5分钟。',
      clickable: false,
      delayMs: 5 * 60 * 1000,
    },
    {
      id: 't2',
      icon: '⏰',
      message: `护航还剩2分钟，月卡每天仅¥${daily}，立即开通继续守护。`,
      clickable: true,
      delayMs: 8 * 60 * 1000,
      targetRoute: '/(app)/activation',
    },
    {
      id: 't3',
      icon: '🔒',
      message: '护航已结束。点击查看报告并开通会员。',
      clickable: true,
      delayMs: 10 * 60 * 1000,
      targetRoute: '/(app)/activation',
    },
  ];
}
/** @deprecated 使用 getTrialNotifs() 代替 */
export const TRIAL_NOTIFS: GuardNotif[] = getTrialNotifs();

// ── 付费会员通知（2条） ───────────────────────────────────
export const MEMBER_NOTIFS: GuardNotif[] = [
  {
    id: 'm0',
    icon: '✅',
    message: '扫描完成，环境安全。护航已开启。',
    clickable: false,
    delayMs: 0,
  },
  {
    id: 'm1',
    icon: '✅',
    message: '护航已完成。点击查看本次护航报告。',
    clickable: true,
    delayMs: 10 * 60 * 1000,
    targetRoute: '/(app)/guard-report',
  },
];

// ── 无响应静默通知（第10分钟后5分钟触发） ────────────────
export const SILENT_NOTIF: GuardNotif = {
  id: 'silent',
  icon: '⏸',
  message: '护航已结束超5分钟，任务自动关闭。',
  clickable: false,
  delayMs: 15 * 60 * 1000,
};

type NotifCallback = (notif: GuardNotif) => void;

let timers: ReturnType<typeof setTimeout>[] = [];
let onNotifCallback: NotifCallback | null = null;
let guardRunning = false;
// 用户最后一次交互时间（用于无响应静默检测）
let lastInteractTime = 0;

/** 记录用户交互（返回App、点击通知等），重置静默计时器 */
export function recordGuardInteract(): void {
  lastInteractTime = Date.now();
}

/**
 * 启动护航通知
 * @param onNotif  通知回调
 * @param isMember 是否付费会员
 */
export function startGuardNotifications(
  onNotif: NotifCallback,
  isMember = false
): void {
  stopGuardNotifications();
  guardRunning = true;
  onNotifCallback = onNotif;
  lastInteractTime = Date.now();

  const notifs = isMember ? MEMBER_NOTIFS : getTrialNotifs();

  notifs.forEach(n => {
    const t = setTimeout(() => {
      if (!guardRunning || !onNotifCallback) return;
      onNotifCallback(n);
      // 第10分钟通知推送后，启动"无响应静默"倒计时（5分钟）
      if (n.delayMs === 10 * 60 * 1000) {
        scheduleSilentClose();
      }
    }, n.delayMs);
    timers.push(t);
  });
}

/** 第10分钟后5分钟无交互 → 推送静默关闭通知，停止所有后续通知 */
function scheduleSilentClose(): void {
  const t = setTimeout(() => {
    if (!guardRunning || !onNotifCallback) return;
    // 检查用户是否在这5分钟内有过交互
    const elapsed = Date.now() - lastInteractTime;
    if (elapsed < 5 * 60 * 1000) return; // 用户有交互，不触发
    onNotifCallback(SILENT_NOTIF);
    // 静默后彻底停止
    stopGuardNotifications();
  }, 5 * 60 * 1000);
  timers.push(t);
}

export function stopGuardNotifications(): void {
  guardRunning = false;
  onNotifCallback = null;
  timers.forEach(t => clearTimeout(t));
  timers = [];
}

export function isGuardNotifRunning(): boolean {
  return guardRunning;
}
