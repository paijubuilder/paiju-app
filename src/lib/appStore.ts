/**
 * 全局状态存储 — 牌局环境守护
 * 纯前端内存存储，所有状态跨页面共享
 */

// ─── 类型定义 ───────────────────────────────────────────
export type AgentRank = '初级代理' | '中级代理' | '高级代理';
export type GuardPhase = 'idle' | 'waiting' | 'detecting' | 'guarding' | 'paused' | 'expired';
export type NightModeOption = 'auto' | 'on' | 'off';
export type SoundEffectOption = 'on' | 'off';

// 牌局记录条目
export interface GameRecord {
  id: string;           // 唯一ID
  detectId: string;     // 检测编号
  timestamp: number;    // 时间戳
  result: '赢' | '输' | '平' | null;  // 用户标注结果
  score: number;        // 环境评分
  passCount: number;    // 通过检测项
  totalCount: number;   // 总检测项
  guardDuration: number; // 守护时长（秒）
  detectItems: { icon: string; label: string; result: string }[]; // 四项检测结果
}

// 管理员后台设置
export interface AdminConfig {
  // 一、会员零售价（4套餐：3天体验卡 / 30天月卡 / 半年卡 / 年卡）
  cost3Day: string;
  cost30Day: string;
  cost180Day: string;
  cost365Day: string;
  // 二、试用专属套餐
  trialBonusEnabled: boolean;   // 套餐开关
  trialBonusDays: number;       // 加赠天数（在30天月卡基础上）
  trialBonusPrice: string;      // 套餐价格（与30天月卡同步，可独立改）
  // 三、代理成本折扣（百分比，拿货价 = 零售价 × 折扣%）
  discountBasic: number;        // 初级代理拿货折扣 %
  discountMid: number;          // 中级代理拿货折扣 %
  discountHigh: number;         // 高级代理拿货折扣 %
  // 四、代理加价上限（百分比）
  markupLimitBasic: number;     // 初级代理加价上限 %
  markupLimitMid: number;       // 中级代理加价上限 %
  markupLimitHigh: number;      // 高级代理加价上限 %
  // 五、代理开通/升级费用（开通费 = 用户缴纳的入会费；拿货成本 = 年卡×折扣%，自动计算）
  agentSignupFee: string;       // 开通初级代理入会费（管理员手动设置，如¥399）
  costAgentMidUp: string;       // 初级升中级费用
  costAgentHighUp: string;      // 中级升高级费用
  costAgentBasic: string;       // 初级代理拿货成本（= 年卡×折扣%，由方案应用自动计算）
  // 六、其他
  trialMinutes: number;         // 试用时长（分钟）
  adminPassword: string;
  featureStartDate: number;     // 功能开启日（时间戳），用于15/30天计算
  // 七、客服入口配置
  csMode: 'ai' | 'link' | 'qrcode' | 'off';  // 展示形态：AI智能客服/链接跳转/二维码/关闭
  csUrl: string;                       // 企业微信客服链接（仅 link 模式有效）
  csQrUrl: string;                     // 客服二维码图片 URL（仅 qrcode 模式有效）
  csGreeting: string;                  // AI客服开场白（仅 ai 模式有效）
  // 八、支付配置
  memberPayMode: 'off' | 'wechat_link' | 'alipay_link' | 'qrcode';  // 会员收款方式
  memberPayLink: string;               // 会员支付链接（wechat_link/alipay_link）
  memberPayQrUrl: string;              // 会员微信收款二维码图片URL
  memberAlipayQrUrl: string;           // 会员支付宝收款二维码图片URL
  agentPayMode: 'off' | 'wechat_link' | 'alipay_link' | 'qrcode';   // 代理收款方式
  agentPayLink: string;                // 代理支付链接
  agentPayQrUrl: string;               // 代理收款二维码图片URL
  // 九、版本更新
  latestApkUrl: string;                // 最新版本APK下载链接（空=无新版本）
  // 十、功能可用性控制开关（管理员后台统一控制）
  featureFloatWindow: boolean;         // 通知栏提醒开关（默认开启，沿用 featureFloatWindow 字段名保持兼容）
  featureNotification: boolean;        // 通知栏推送开关（默认开启）
  featurePip: boolean;                 // 画中画功能开关（默认关闭）
  featureAutoUpdate: boolean;          // 自动更新功能开关（默认关闭）
  // 十一、智能推广海报与文案生成器配置
  posterTitle0: string;                // 危机警示型主标题（含 | 分隔的多个备选，轮换使用）
  posterSubTitle0: string;             // 危机警示型副标题（含 {N} 占位符由动态数据替换）
  posterTitle1: string;                // 利益驱动型主标题
  posterSubTitle1: string;             // 利益驱动型副标题
  posterTitle2: string;                // 权威背书型主标题（含 {N} 占位符）
  posterSubTitle2: string;             // 权威背书型副标题
  dynamicBaseCount: number;            // 动态用户数基数（如 12847），每日自动微调 ±50
  bonusText: string;                   // 限时优惠文案（如 "加赠5天"）
  promoTemplate0: string;              // 恐惧唤醒型文案模板（含 {LINK} 占位符）
  promoTemplate1: string;              // 利益诱惑型文案模板
  promoTemplate2: string;              // 用户见证型文案模板
  promoTemplate3: string;              // 专家科普型文案模板
  posterColorScheme: 'dark_blue' | 'gold' | 'tech_blue'; // 海报配色方案（对应三种模板默认色）
  // 海报/推广二维码与链接（可灵活配置）
  posterPromoLink: string;   // 推广链接（如 https://xxx/invite?code=yyy）
  posterQrImageUrl: string;  // 推广二维码图片URL（上传后填入）
  // 十二、首页提示语配置（固定方案，已移除 A/B 测试）
  homeTitle: string;   // 首页提示语第一行
  homeSubtitle: string; // 首页提示语第二行（可为空）
  // 十三、当前生效方案的套餐明细（由 pricePlanStore 写入，getGlobalPlans 优先读取）
  activePlanItems?: { title: string; days: number; price: string; label: string; subTexts: string[]; isMost: boolean; enabled: boolean }[];
  // 十四、套餐名称自定义（管理员可单独修改，与价格字段独立）
  planTitle3Day: string;
  planTitle30Day: string;
  planTitle180Day: string;
  planTitle365Day: string;
}

// ─── 默认配置 ───────────────────────────────────────────
const DEFAULT_CONFIG: AdminConfig = {
  // 会员零售价
  cost3Day: '9.9',
  cost30Day: '39.9',
  cost180Day: '99.9',
  cost365Day: '149.9',
  planTitle3Day: '3天体验卡',
  planTitle30Day: '30天月卡',
  planTitle180Day: '半年卡',
  planTitle365Day: '年卡',
  // 试用专属套餐
  trialBonusEnabled: true,
  trialBonusDays: 5,
  trialBonusPrice: '39.9',
  // 代理成本折扣
  discountBasic: 40,
  discountMid: 33,
  discountHigh: 28,
  // 代理加价上限
  markupLimitBasic: 50,
  markupLimitMid: 70,
  markupLimitHigh: 100,
  // 代理费用（开通费 vs 拿货成本分离）
  agentSignupFee: '399',        // 开通初级代理入会费（用户缴纳）
  costAgentBasic: '60',         // 初级代理拿货成本（年卡×折扣，自动计算）
  costAgentMidUp: '499',
  costAgentHighUp: '799',
  // 其他
  trialMinutes: 10,
  adminPassword: 'admin123',
  featureStartDate: Date.now(),
  // 客服入口配置（默认关闭）
  csMode: 'ai',
  csUrl: '',
  csQrUrl: '',
  csGreeting: '您好！我是牌局环境守护的智能客服，有什么可以帮助您的？',
  // 支付配置（默认未开通）
  memberPayMode: 'off',
  memberPayLink: '',
  memberPayQrUrl: '',
  memberAlipayQrUrl: '',
  agentPayMode: 'off',
  agentPayLink: '',
  agentPayQrUrl: '',
  // 版本更新（空=无新版本）
  latestApkUrl: '',
  // 功能可用性控制开关
  featureFloatWindow: true,      // 通知栏提醒 — 默认开启（字段沿用，语义已更新）
  featureNotification: true,     // 通知栏推送 — 默认开启
  featurePip: false,             // 画中画 — 默认关闭
  featureAutoUpdate: false,      // 自动更新 — 默认关闭
  // 智能推广海报与文案生成器配置
  posterTitle0: "😨 牌局上总有人'手气太好'？|你不是运气差，是有人开了'天眼'",
  posterSubTitle0: '已帮{N}位牌友揪出异常对局',
  posterTitle1: '📊 每4个牌友，就有1个怀疑对局不干净',
  posterSubTitle1: '25%玩家曾遇到异常牌局，你确定你是剩下的75%？',
  posterTitle2: '🏆 聪明牌友都在用！已有{N}人开启护航',
  posterSubTitle2: "牌友圈疯传的'防作弊神器'",
  dynamicBaseCount: 12847,
  bonusText: '',  // 已移除"加赠5天"，如需新活动文案在此设置
  promoTemplate0: '最近听说好几个牌友都遇到过"手气特别背"的情况，一查才发现是有人开了多开。我现在每次打牌前都用这个APP扫一下，虽然不能保证百分百，但至少心里踏实。有需要的可以试试，首次还免费。{LINK}',
  promoTemplate1: '发现一个好东西！打牌前扫一下手机环境，看看有没有多开软件在后台跑。新用户免费试用10分钟，我试了觉得挺靠谱的。扫码就能用，不用填任何东西。{LINK}',
  promoTemplate2: '用了这个护航工具一个月了，每天打牌前开一下，已经成了习惯。虽然不是每次都能查出什么，但偶尔看到"环境安全"的报告，心里就踏实。推荐给经常打牌的兄弟。{LINK}',
  promoTemplate3: '很多人问我手机麻将到底有没有外挂？作为研究手机安全的人，我可以负责任地说：多开、虚拟机、辅助工具确实存在。这款检测工具可以扫描手机环境，帮你排除常见风险。免费的，建议牌友们都试试。{LINK}',
  posterColorScheme: 'dark_blue',
  posterPromoLink: '',
  posterQrImageUrl: '',
  // 首页提示语（固定配置，已移除 A/B 测试）
  homeTitle: '🎁 新用户专享：免费护航10分钟',
  homeSubtitle: '请点击下方「开始护航」立即体验',
};

// 代理客户条目
export interface AgentCustomer {
  id: string;
  phoneMasked: string;     // 脱敏手机号，如 138****0001
  plan: string;            // 开通套餐
  expireTime: number;      // 到期时间戳
  orderedAt: number;       // 购买时间戳
}

// 推送历史条目
export interface PushRecord {
  id: string;
  time: number;
  target: string;          // 推送对象描述
  content: string;         // 内容摘要
  deliveredCount: number;  // 送达人数
}

// 登录状态
export interface LoginState {
  isAdminLoggedIn: boolean;
  adminPhone: string;
  adminPassword: string;   // 运行时存储，首次改密后更新
  isFirstAdminLogin: boolean; // 是否首次登录（需强制改密）
  adminFaceEnrolled: boolean; // 是否已录入人脸
  adminBoundPhone: string;    // 已绑定手机号（空=未绑定）
  isAgentLoggedIn: boolean;
  agentPhone: string;
  agentPassword: string;
}

// ─── 模块级单例状态 ─────────────────────────────────────
let config: AdminConfig = { ...DEFAULT_CONFIG };
let agentRank: AgentRank = '初级代理';
/** 代理资格是否已由管理员确认开通（false=未开通，所有人默认未开通） */
let agentActivated = false;
let agentMarkup: number = 10;

// 计时器
let guardStartTime: number | null = null;
let guardPhase: GuardPhase = 'idle';

// 隐私授权
let privacyAccepted = false;

// 连续守护天数
let streakDays = 0;
let lastGuardDate: string | null = null; // 'YYYY-MM-DD'

// 上次检测时间（时间戳）
let lastDetectTime: number | null = null;

// 激活记录（首次点击「开始守护本局」的时间戳）
let activationTime: number | null = null;

// 会员到期时间（时间戳，null 表示无会员）
let memberExpireTime: number | null = null;

// 到期后是否已弹窗提醒（每次到期后首次打开）
let expiredAlertShown = false;

// 牌局记录
let gameRecords: GameRecord[] = [];

// 夜间模式 & 音效
let nightModeOption: NightModeOption = 'auto';
let soundEffectOption: SoundEffectOption = 'on';

// 首次启动引导
let isFirstLaunch = true;
let hasShownUpdateBanner = false;

// ─── 管理员凭据（锁定版，最高优先级，不可被后续修改覆盖）────
const ADMIN_FIXED_PHONE    = '13699509969';
const ADMIN_FIXED_PASSWORD = 'to1997320ng';

// 登录状态
let loginState: LoginState = {
  isAdminLoggedIn: false,
  adminPhone: ADMIN_FIXED_PHONE,
  adminPassword: ADMIN_FIXED_PASSWORD,
  isFirstAdminLogin: false,         // 固定凭据无需首次设置流程
  adminFaceEnrolled: false,
  adminBoundPhone: ADMIN_FIXED_PHONE,
  isAgentLoggedIn: false,
  agentPhone: '',
  agentPassword: '',
};

// ─── 教程引导步骤（6步） ────────────────────────────────
// 步骤键：step1-step6；true=已完成(跳过或经历过)
export type TutorialStepKey = 'step1'|'step2'|'step3'|'step4'|'step5'|'step6';
let tutorialDone: Record<TutorialStepKey, boolean> = {
  step1: false, step2: false, step3: false,
  step4: false, step5: false, step6: false,
};
export function isTutorialStepDone(key: TutorialStepKey): boolean { return tutorialDone[key]; }
export function markTutorialStep(key: TutorialStepKey): void { tutorialDone = { ...tutorialDone, [key]: true }; }
export function skipAllTutorial(): void {
  (Object.keys(tutorialDone) as TutorialStepKey[]).forEach(k => { tutorialDone[k] = true; });
}

// ─── 微信登录状态 ────────────────────────────────────────
let wechatBound = false;   // 是否已绑定微信
let wechatNickname = '';   // 微信昵称（模拟）
export function isWechatBound(): boolean { return wechatBound; }
export function getWechatNickname(): string { return wechatNickname; }
export function bindWechat(nickname: string): void {
  wechatBound = true;
  wechatNickname = nickname;
}

// ─── 管理员激活码（设备绑定策略）────────────────────────
// 激活码：首次在本设备上进入后台前须验证；手动退出后需再次验证
let adminActivationCode = '958262';
export function getAdminActivationCode(): string { return adminActivationCode; }
export function setAdminActivationCode(code: string): void { adminActivationCode = code; }
export function verifyAdminActivationCode(code: string): boolean { return code === adminActivationCode; }

// 设备激活状态（localStorage 持久化，手动退出时清除）
const DEVICE_ACTIVATION_KEY = '__admin_device_activated__';

export function isDeviceActivated(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(DEVICE_ACTIVATION_KEY) === '1';
    }
  } catch { /* noop */ }
  return false;
}

export function markDeviceActivated(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(DEVICE_ACTIVATION_KEY, '1');
    }
  } catch { /* noop */ }
}

export function clearDeviceActivated(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(DEVICE_ACTIVATION_KEY);
    }
  } catch { /* noop */ }
}

// ─── 管理后台入口「已发现」标志 ──────────────────────────────
// 用户首次通过版本号连点3次触发后，持久化记录；后续"我的"页面常显入口按钮
const ADMIN_ENTRY_REVEALED_KEY = '__admin_entry_revealed__';

export function isAdminEntryRevealed(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(ADMIN_ENTRY_REVEALED_KEY) === '1';
    }
  } catch { /* noop */ }
  return false;
}

export function markAdminEntryRevealed(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADMIN_ENTRY_REVEALED_KEY, '1');
    }
  } catch { /* noop */ }
}

// ─── 权限引导完成标记 ────────────────────────────────────
let permissionGuideShown = false;
export function isPermissionGuideShown(): boolean { return permissionGuideShown; }
export function markPermissionGuideShown(): void { permissionGuideShown = true; }

// ─── 护航任务编号 ────────────────────────────────────────
function pad(n: number, len: number): string { return String(n).padStart(len, '0'); }
export function genGuardId(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${pad(d.getMonth()+1,2)}${pad(d.getDate(),2)}`;
  const seq = pad(Math.floor(Math.random() * 9000) + 1000, 4);
  return `YC-${date}-${seq}`;
}
// 当前护航编号（整个护航流程共享）
let currentGuardId: string = genGuardId();
export function getCurrentGuardId(): string { return currentGuardId; }
export function renewGuardId(): string {
  currentGuardId = genGuardId();
  return currentGuardId;
}

// 代理客户列表（云端同步模拟）
const MOCK_AGENT_CUSTOMERS: AgentCustomer[] = [
  { id: 'ac1', phoneMasked: '138****0011', plan: '30天月卡', expireTime: Date.now() + 2 * 24 * 3600 * 1000, orderedAt: Date.now() - 28 * 24 * 3600 * 1000 },
  { id: 'ac2', phoneMasked: '139****5522', plan: '年卡',     expireTime: Date.now() + 180 * 24 * 3600 * 1000, orderedAt: Date.now() - 185 * 24 * 3600 * 1000 },
  { id: 'ac3', phoneMasked: '186****7733', plan: '半年卡',   expireTime: Date.now() + 45 * 24 * 3600 * 1000, orderedAt: Date.now() - 135 * 24 * 3600 * 1000 },
  { id: 'ac4', phoneMasked: '135****9944', plan: '30天月卡', expireTime: Date.now() + 12 * 24 * 3600 * 1000, orderedAt: Date.now() - 18 * 24 * 3600 * 1000 },
  { id: 'ac5', phoneMasked: '152****1155', plan: '3天体验卡', expireTime: Date.now() - 2 * 24 * 3600 * 1000, orderedAt: Date.now() - 5 * 24 * 3600 * 1000 },
];
let agentCustomers: AgentCustomer[] = [...MOCK_AGENT_CUSTOMERS];

// 推送历史
const MOCK_PUSH_RECORDS: PushRecord[] = [
  { id: 'pr1', time: Date.now() - 3 * 24 * 3600 * 1000, target: '全部用户', content: '🛡️ 护航新版本上线，点击体验', deliveredCount: 1283 },
  { id: 'pr2', time: Date.now() - 7 * 24 * 3600 * 1000, target: '未付费用户', content: '⏰ 30天月卡每天¥1.33，大部分牌友都选择月卡', deliveredCount: 856 },
  { id: 'pr3', time: Date.now() - 14 * 24 * 3600 * 1000, target: '3天未使用', content: '👋 好久不见，您的护航任务还在等您', deliveredCount: 234 },
];
let pushHistory: PushRecord[] = [...MOCK_PUSH_RECORDS];

// ─── 配置 ────────────────────────────────────────────
export function getConfig(): AdminConfig { return { ...config }; }
export function saveConfig(partial: Partial<AdminConfig>): void {
  config = { ...config, ...partial };
  // 异步持久化到 Supabase（不阻塞 UI）
  _persistConfigToDB(config).catch(() => { /* 静默失败，下次刷新会重新加载 */ });
}

// ─── Supabase 持久化（开关状态持久化核心逻辑）─────────────────
import { createClient } from '@supabase/supabase-js';

// 仅持久化需要跨会话保存的开关字段（避免覆盖 AI 知识库等其他配置）
const _PERSIST_KEYS: (keyof AdminConfig)[] = [
  'featureFloatWindow', 'featureNotification', 'featurePip', 'featureAutoUpdate',
  'csMode', 'csUrl', 'csQrUrl', 'csGreeting',
  'memberPayMode', 'memberPayLink', 'memberPayQrUrl', 'memberAlipayQrUrl',
  'agentPayMode', 'agentPayLink', 'agentPayQrUrl',
  'cost3Day', 'cost30Day', 'cost180Day', 'cost365Day',
  'trialMinutes', 'trialBonusEnabled', 'trialBonusDays', 'trialBonusPrice',
  'discountBasic', 'discountMid', 'discountHigh',
  'markupLimitBasic', 'markupLimitMid', 'markupLimitHigh',
  'costAgentBasic', 'costAgentMidUp', 'costAgentHighUp', 'agentSignupFee',
  'latestApkUrl', 'homeTitle', 'homeSubtitle',
  'planTitle3Day', 'planTitle30Day', 'planTitle180Day', 'planTitle365Day',
  'activePlanItems',
];

function _getSupabase() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  if (!url || !key) return null;
  return createClient(url, key);
}

async function _persistConfigToDB(cfg: AdminConfig): Promise<void> {
  const sb = _getSupabase();
  if (!sb) return;
  const payload: Partial<AdminConfig> = {};
  for (const k of _PERSIST_KEYS) (payload as Record<string, unknown>)[k] = cfg[k];
  await sb.from('app_dynamic_config')
    .update({ config_value: JSON.stringify(payload), updated_at: new Date().toISOString() })
    .eq('config_key', 'admin_config');
}

/** 从 Supabase 加载持久化配置（管理员后台挂载时调用）*/
export async function loadConfigFromDB(): Promise<void> {
  const sb = _getSupabase();
  if (!sb) return;
  try {
    const { data } = await sb.from('app_dynamic_config')
      .select('config_value')
      .eq('config_key', 'admin_config')
      .maybeSingle();
    if (data?.config_value && data.config_value !== '{}') {
      const saved = JSON.parse(data.config_value) as Partial<AdminConfig>;
      // 仅覆盖已持久化的字段，其余保留默认值
      config = { ...DEFAULT_CONFIG, ...saved };
    }
  } catch { /* 网络失败时使用内存配置 */ }
}

// ─── 开关操作日志（写入 switch_change_logs 表）────────────────

/** 记录开关变更到数据库 */
export async function logSwitchChange(params: {
  switchKey: string;
  switchLabel: string;
  oldValue: unknown;
  newValue: unknown;
  module?: string;
  operator?: string;
}): Promise<void> {
  const sb = _getSupabase();
  if (!sb) return;
  try {
    await sb.from('switch_change_logs').insert({
      switch_key: params.switchKey,
      switch_label: params.switchLabel,
      old_value: JSON.stringify(params.oldValue),
      new_value: JSON.stringify(params.newValue),
      module: params.module ?? '',
      operator: params.operator ?? 'admin',
    });
  } catch { /* 日志写入失败不影响主流程 */ }
}

/** 查询最近开关操作日志（最多100条）*/
export async function loadSwitchLogs(limit = 100): Promise<{
  id: number; switch_key: string; switch_label: string;
  old_value: string; new_value: string; operator: string;
  module: string; created_at: string;
}[]> {
  const sb = _getSupabase();
  if (!sb) return [];
  try {
    const { data } = await sb.from('switch_change_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

/** 开关健康检测：遍历所有已知开关，验证 DB 状态与内存状态一致 */
export async function runSwitchHealthCheck(): Promise<{
  allPassed: boolean;
  items: { key: string; label: string; memValue: unknown; dbValue: unknown; passed: boolean }[];
  generatedAt: string;
}> {
  const SWITCH_DEFS: { key: keyof AdminConfig; label: string; module: string }[] = [
    { key: 'featureFloatWindow',   label: '通知栏提醒开关', module: '系统设置' },
    { key: 'featureNotification',  label: '通知栏推送开关', module: '系统设置' },
    { key: 'featurePip',           label: '画中画功能开关', module: '系统设置' },
    { key: 'featureAutoUpdate',    label: '自动更新开关',   module: '系统设置' },
    { key: 'trialBonusEnabled',    label: '试用套餐开关',   module: '经营/会员价格' },
  ];
  const memCfg = getConfig();
  const sb = _getSupabase();
  let dbCfg: Partial<AdminConfig> = {};
  if (sb) {
    try {
      const { data } = await sb.from('app_dynamic_config')
        .select('config_value').eq('config_key', 'admin_config').maybeSingle();
      if (data?.config_value) dbCfg = JSON.parse(data.config_value) as Partial<AdminConfig>;
    } catch { /* ignore */ }
  }
  const items = SWITCH_DEFS.map(def => {
    const memValue = memCfg[def.key];
    const dbValue = (dbCfg as Record<string, unknown>)[def.key as string];
    const passed = dbValue !== undefined ? String(memValue) === String(dbValue) : false;
    return { key: def.key, label: def.label, memValue, dbValue, passed };
  });
  return { allPassed: items.every(i => i.passed), items, generatedAt: new Date().toISOString() };
}

/** 批量同步：将当前内存中所有开关状态强制写入数据库 */
export async function batchSyncSwitchesToDB(): Promise<{ ok: boolean; msg: string }> {
  try {
    await _persistConfigToDB(getConfig());
    return { ok: true, msg: '所有开关状态已强制同步到数据库' };
  } catch (e) {
    return { ok: false, msg: `同步失败: ${e}` };
  }
}

// ─── 隐私授权 ─────────────────────────────────────────
export function isPrivacyAccepted(): boolean { return privacyAccepted; }
export function acceptPrivacy(): void { privacyAccepted = true; }

// ─── 代理 ─────────────────────────────────────────────
export function getAgentRank(): AgentRank { return agentRank; }
export function setAgentRank(rank: AgentRank): void { agentRank = rank; }
/** 代理是否已由管理员确认开通 */
export function isAgentActivated(): boolean { return agentActivated; }
export function setAgentActivated(val: boolean): void { agentActivated = val; }
export function getAgentMarkup(): number { return agentMarkup; }
export function setAgentMarkup(pct: number): void {
  const limit = getMarkupLimitForRank(agentRank);
  agentMarkup = Math.min(Math.max(1, pct), limit);
}
export function calcAgentPrice(costStr: string): string {
  const base = parseFloat(costStr) || 0;
  return (base * (1 + agentMarkup / 100)).toFixed(1);
}

/** 根据代理等级获取成本折扣 % */
export function getDiscountForRank(rank: AgentRank): number {
  if (rank === '高级代理') return config.discountHigh;
  if (rank === '中级代理') return config.discountMid;
  return config.discountBasic;
}

/** 根据代理等级获取加价上限 % */
export function getMarkupLimitForRank(rank: AgentRank): number {
  if (rank === '高级代理') return config.markupLimitHigh;
  if (rank === '中级代理') return config.markupLimitMid;
  return config.markupLimitBasic;
}

/** 代理拿货价 = 零售价 × 折扣% */
export function calcCostPrice(retailStr: string, rank?: AgentRank): string {
  const base = parseFloat(retailStr) || 0;
  const discount = getDiscountForRank(rank ?? agentRank);
  return (base * discount / 100).toFixed(1);
}

// ─── 设备ID ───────────────────────────────────────────
export function getDeviceId(): string { return 'PJ-6K8M3N5R'; }

// ─── 上次检测时间 ─────────────────────────────────────
export function getLastDetectTime(): number | null { return lastDetectTime; }
export function setLastDetectTime(): void { lastDetectTime = Date.now(); }

// 格式化时间为 YYYY-MM-DD HH:MM
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// 格式化日期 YYYY-MM-DD
export function formatDate(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}

// ─── 检测编号 ─────────────────────────────────────────
export function genDetectId(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `JC-${date}-${rand}`;
}

// ─── 激活记录 ─────────────────────────────────────────
export function getActivationTime(): number | null { return activationTime; }
export function setActivation(): void {
  if (activationTime === null) activationTime = Date.now();
}
export function isActivated(): boolean { return activationTime !== null; }

// ─── 会员到期时间 ─────────────────────────────────────
export function getMemberExpireTime(): number | null { return memberExpireTime; }
export function setMemberExpire(days: number): void {
  memberExpireTime = Date.now() + days * 24 * 60 * 60 * 1000;
  expiredAlertShown = false; // 续费后重置弹窗标志
}
/** 会员是否有效 */
export function isMemberActive(): boolean {
  if (memberExpireTime === null) return false;
  return Date.now() < memberExpireTime;
}
/** 距离到期剩余毫秒 */
export function getMemberRemainingMs(): number {
  if (!memberExpireTime) return 0;
  return Math.max(0, memberExpireTime - Date.now());
}
/** 是否在24h内到期 */
export function isMemberExpiringSoon(): boolean {
  const ms = getMemberRemainingMs();
  return ms > 0 && ms < 24 * 60 * 60 * 1000;
}
/** 是否在48h内到期 */
export function isMemberExpiring48h(): boolean {
  const ms = getMemberRemainingMs();
  return ms > 0 && ms < 48 * 60 * 60 * 1000;
}

// ─── 到期弹窗标志 ─────────────────────────────────────
export function isExpiredAlertShown(): boolean { return expiredAlertShown; }
export function markExpiredAlertShown(): void { expiredAlertShown = true; }

// ─── 连续守护天数 ─────────────────────────────────────
function todayStr(): string {
  return formatDate(Date.now());
}
export function getStreakDays(): number { return streakDays; }
export function getLastGuardDate(): string | null { return lastGuardDate; }

/** 每次用户点击「开始守护本局」时调用，更新连续天数 */
export function recordGuardToday(): void {
  const today = todayStr();
  if (lastGuardDate === today) return; // 今天已记录，不重复

  if (lastGuardDate === null) {
    streakDays = 1;
  } else {
    // 判断是否是昨天
    const yesterday = formatDate(Date.now() - 24 * 60 * 60 * 1000);
    if (lastGuardDate === yesterday) {
      streakDays += 1;
    } else {
      streakDays = 1; // 断了，重新开始
    }
  }
  lastGuardDate = today;
}

/** 检查是否中断（用于每次打开App时调用） */
export function checkStreakBreak(): void {
  if (lastGuardDate === null) return;
  const today = todayStr();
  const yesterday = formatDate(Date.now() - 24 * 60 * 60 * 1000);
  if (lastGuardDate !== today && lastGuardDate !== yesterday) {
    // 超过一天没守护，归零
    streakDays = 0;
  }
}

// ─── 牌局记录 ─────────────────────────────────────────
export function getGameRecords(): GameRecord[] {
  return [...gameRecords].sort((a, b) => b.timestamp - a.timestamp);
}
export function addGameRecord(): GameRecord {
  const rec: GameRecord = {
    id: `rec-${Date.now()}`,
    detectId: genDetectId(),
    timestamp: Date.now(),
    result: null,
    score: 98,
    passCount: 4,
    totalCount: 4,
    guardDuration: 0,
    detectItems: [
      { icon: '🛡', label: '多开/分身检测', result: '通过' },
      { icon: '🔒', label: '异常辅助工具', result: '未发现（特征库匹配 0/86）' },
      { icon: '👁', label: '异常行为检测', result: '正常（无透视/看牌特征）' },
      { icon: '⊞', label: '牌局环境安全', result: '通过（可正常对局）' },
    ],
  };
  gameRecords.unshift(rec);
  return rec;
}
export function updateGameRecordResult(id: string, result: GameRecord['result']): void {
  const r = gameRecords.find(r => r.id === id);
  if (r) r.result = result;
}
export function updateGameRecordDuration(id: string, seconds: number): void {
  const r = gameRecords.find(r => r.id === id);
  if (r) r.guardDuration = seconds;
}

// ─── 代理AI状态 ──────────────────────────────────────────

// 当前代理的AI是否被总台开启
let agentAiEnabled = true;
export function getAgentAiEnabled(): boolean { return agentAiEnabled; }
export function setAgentAiEnabled(v: boolean): void { agentAiEnabled = v; }

// 违规词列表
export const AI_VIOLATION_WORDS = ['包赢', '透视', '100%', '必赢', '无敌', '看牌', '外挂', '作弊'];

// 代理AI监控：模拟代理列表
export interface AgentAiItem {
  id: string;
  name: string;
  rank: AgentRank;
  aiEnabled: boolean;
  suspended: boolean;     // 违规熔断中
  suspendUntil: number | null; // 恢复时间戳
}

// 违规日志条目
export interface AgentViolationLog {
  id: string;
  agentId: string;
  agentName: string;
  word: string;          // 触发词
  content: string;       // 完整违规句
  time: number;
}

// 代理AI对话记录
export interface AgentChatLogEntry {
  id: string;
  agentId: string;
  agentName: string;
  agentRank: AgentRank;
  role: 'user' | 'bot';
  text: string;
  time: number;
  hasViolation: boolean;
}

// 初始化模拟代理列表
const MOCK_AGENTS: AgentAiItem[] = [
  { id: 'ag1', name: '张三', rank: '高级代理', aiEnabled: true,  suspended: false, suspendUntil: null },
  { id: 'ag2', name: '李四', rank: '中级代理', aiEnabled: true,  suspended: false, suspendUntil: null },
  { id: 'ag3', name: '王五', rank: '初级代理', aiEnabled: false, suspended: false, suspendUntil: null },
  { id: 'ag4', name: '赵六', rank: '中级代理', aiEnabled: true,  suspended: true,  suspendUntil: Date.now() + 20 * 60 * 60 * 1000 },
  { id: 'ag5', name: '孙七', rank: '初级代理', aiEnabled: true,  suspended: false, suspendUntil: null },
];

let agentAiList: AgentAiItem[] = [...MOCK_AGENTS];
let violationLogs: AgentViolationLog[] = [
  {
    id: 'vl1', agentId: 'ag4', agentName: '赵六', word: '100%',
    content: '用了这个工具100%能赢，放心买！',
    time: Date.now() - 3 * 60 * 60 * 1000,
  },
];
let agentChatLogs: AgentChatLogEntry[] = [];

export function getAgentAiList(): AgentAiItem[] { return [...agentAiList]; }
export function setAgentAiItemEnabled(id: string, enabled: boolean): void {
  agentAiList = agentAiList.map(a => a.id === id ? { ...a, aiEnabled: enabled, suspended: false, suspendUntil: null } : a);
}
export function getViolationLogs(): AgentViolationLog[] { return [...violationLogs].sort((a, b) => b.time - a.time); }
export function getAgentChatLogs(): AgentChatLogEntry[] { return [...agentChatLogs].sort((a, b) => b.time - a.time); }

/** 代理发送消息 → 检测违规词 → 若违规则熔断24h并上报 */
export function addAgentChatLog(agentId: string, agentName: string, agentRankVal: AgentRank, role: 'user' | 'bot', text: string): void {
  const hasViolation = role === 'user' && AI_VIOLATION_WORDS.some(w => text.includes(w));
  agentChatLogs.unshift({
    id: `acl${Date.now()}${Math.random()}`, agentId, agentName, agentRank: agentRankVal,
    role, text, time: Date.now(), hasViolation,
  });
  if (hasViolation) {
    // 触发熔断
    const word = AI_VIOLATION_WORDS.find(w => text.includes(w))!;
    agentAiList = agentAiList.map(a => a.id === agentId
      ? { ...a, suspended: true, suspendUntil: Date.now() + 24 * 60 * 60 * 1000 }
      : a
    );
    violationLogs.unshift({
      id: `vl${Date.now()}`, agentId, agentName, word, content: text, time: Date.now(),
    });
    // 同步关闭当前用户AI（如果是自己触发的）
    if (agentId === 'self') agentAiEnabled = false;
  }
}

// ─── 用户反馈 ────────────────────────────────────────────

export type FeedbackType = '功能建议' | 'Bug反馈' | '使用问题' | '代理相关' | '其他';
export type FeedbackStatus = '待处理' | '处理中' | '已采纳' | '已回复';

export interface FeedbackItem {
  id: string;
  type: FeedbackType;
  content: string;
  contact: string;         // 联系方式（选填）
  imageUri: string | null; // 截图 URI（选填）
  time: number;
  status: FeedbackStatus;
  reply: string;           // 管理员回复内容
  aiPriority: 'high' | 'normal'; // AI自动优先级评估
}

// 预置模拟反馈数据
const MOCK_FEEDBACKS: FeedbackItem[] = [
  {
    id: 'fb001', type: 'Bug反馈', content: '通知提醒偶尔延迟，护航结束后通知未及时推送',
    contact: '13800138001', imageUri: null, time: Date.now() - 2 * 24 * 3600 * 1000,
    status: '待处理', reply: '', aiPriority: 'high',
  },
  {
    id: 'fb002', type: '功能建议', content: '希望能增加检测历史导出功能，方便存档',
    contact: '', imageUri: null, time: Date.now() - 5 * 24 * 3600 * 1000,
    status: '处理中', reply: '', aiPriority: 'normal',
  },
  {
    id: 'fb003', type: '使用问题', content: '开通会员后扫码付款成功但没有显示已激活',
    contact: 'wx_user123', imageUri: null, time: Date.now() - 7 * 24 * 3600 * 1000,
    status: '已回复', reply: '您好，请重启APP即可看到激活状态，感谢您的反馈！', aiPriority: 'high',
  },
  {
    id: 'fb004', type: '代理相关', content: '想了解中级代理和高级代理的收益差距',
    contact: '', imageUri: null, time: Date.now() - 10 * 24 * 3600 * 1000,
    status: '已采纳', reply: '', aiPriority: 'normal',
  },
  {
    id: 'fb005', type: '功能建议', content: '检测报告能不能做得更详细一点，比如具体检测了哪些进程',
    contact: '', imageUri: null, time: Date.now() - 12 * 24 * 3600 * 1000,
    status: '待处理', reply: '', aiPriority: 'normal',
  },
];

let feedbackList: FeedbackItem[] = [...MOCK_FEEDBACKS];

export function getFeedbackList(): FeedbackItem[] {
  return [...feedbackList].sort((a, b) => {
    // 高优先级置顶
    if (a.aiPriority === 'high' && b.aiPriority !== 'high') return -1;
    if (b.aiPriority === 'high' && a.aiPriority !== 'high') return 1;
    return b.time - a.time;
  });
}

export function addFeedback(item: Omit<FeedbackItem, 'id' | 'time' | 'status' | 'reply' | 'aiPriority'>): FeedbackItem {
  const highTypes: FeedbackType[] = ['Bug反馈'];
  const newItem: FeedbackItem = {
    ...item,
    id: `fb${Date.now()}`,
    time: Date.now(),
    status: '待处理',
    reply: '',
    aiPriority: highTypes.includes(item.type) ? 'high' : 'normal',
  };
  feedbackList.unshift(newItem);
  return newItem;
}

export function updateFeedbackStatus(id: string, status: FeedbackStatus): void {
  feedbackList = feedbackList.map(f => f.id === id ? { ...f, status } : f);
}

export function updateFeedbackReply(id: string, reply: string): void {
  feedbackList = feedbackList.map(f => f.id === id ? { ...f, reply, status: '已回复' } : f);
}

// ─── AI优化报告 ──────────────────────────────────────────

export type ReportType = '15天小优化' | '30天大优化';
export type OptimizationStatus = '待执行' | '已采纳' | '已忽略';

export interface OptimizationSuggestion {
  id: string;
  title: string;
  detail: string;
  expectedEffect: string;
  priority: number; // 1=最高
  status: OptimizationStatus;
  miaoInstruction: string; // 采纳后生成的秒哒指令文本
}

export interface OptimizationReport {
  id: string;
  type: ReportType;
  generatedAt: number;
  totalFeedbacks: number;
  typeDistribution: Record<FeedbackType, number>;
  topProblems: string[];
  suggestions: OptimizationSuggestion[];
  // 30天专属
  trendSummary?: string;
  conversionFunnelNote?: string;
}

// 模拟已生成的历史报告
const MOCK_REPORTS: OptimizationReport[] = [
  {
    id: 'rpt001', type: '15天小优化', generatedAt: Date.now() - 5 * 24 * 3600 * 1000,
    totalFeedbacks: 23,
    typeDistribution: { '功能建议': 8, 'Bug反馈': 5, '使用问题': 6, '代理相关': 3, '其他': 1 },
    topProblems: ['通知提醒推送延迟', '付款后激活状态未刷新', '检测报告内容不够详细'],
    suggestions: [
      {
        id: 'sg001', title: '优化通知推送时效', status: '已采纳',
        detail: '通知推送延迟导致5条反馈，建议优化推送触发逻辑，减少护航关键节点通知的延迟时间。',
        expectedEffect: '预计减少约60%的通知相关投诉', priority: 1,
        miaoInstruction: '请优化 guardNotifications.ts 中的通知推送时机，确保护航关键节点通知在触发后500ms内推送给用户。',
      },
      {
        id: 'sg002', title: '添加付款成功自动激活提示', status: '待执行',
        detail: '6条使用问题反馈涉及"付款后状态未刷新"，建议在收款码页面增加"付款后请点击我已付款"确认按钮，触发激活状态刷新。',
        expectedEffect: '预计消除此类反馈 80% 以上', priority: 2,
        miaoInstruction: '请在 activation.tsx 收款码展示区域下方增加"✅ 我已付款"确认按钮，点击后显示激活成功提示并刷新会员状态。',
      },
      {
        id: 'sg003', title: '丰富检测报告内容展示', status: '待执行',
        detail: '8条功能建议涉及检测内容不够透明，建议在扫描动画第二阶段增加"已扫描进程数"动态数字显示（模拟86个特征库）。',
        expectedEffect: '提升用户信任感，有助于提高付费转化率', priority: 3,
        miaoInstruction: '请在 home.tsx 扫描动画第二阶段末尾增加一行文字：「已扫描 86 个已知特征，均未匹配」，使用金色小字展示。',
      },
    ],
  },
];

// 当前是否有新的15天/30天报告待查看
let has15DayReport = true;  // 模拟已触发
let has30DayReport = true;  // 模拟已触发

let allReports: OptimizationReport[] = [...MOCK_REPORTS];

export function getAllReports(): OptimizationReport[] {
  return [...allReports].sort((a, b) => b.generatedAt - a.generatedAt);
}
export function getReportById(id: string): OptimizationReport | undefined {
  return allReports.find(r => r.id === id);
}
export function getLatestReport(type: ReportType): OptimizationReport | undefined {
  return allReports.filter(r => r.type === type).sort((a, b) => b.generatedAt - a.generatedAt)[0];
}
export function getHas15DayReport(): boolean { return has15DayReport; }
export function getHas30DayReport(): boolean { return has30DayReport; }
export function clearReportFlag(type: '15' | '30'): void {
  if (type === '15') has15DayReport = false;
  else has30DayReport = false;
}
export function adoptSuggestion(reportId: string, suggestionId: string): string {
  let instruction = '';
  allReports = allReports.map(r => {
    if (r.id !== reportId) return r;
    return {
      ...r,
      suggestions: r.suggestions.map(s => {
        if (s.id !== suggestionId) return s;
        instruction = s.miaoInstruction;
        return { ...s, status: '已采纳' as OptimizationStatus };
      }),
    };
  });
  return instruction;
}

// 生成新的15天报告（基于当前反馈数据）
export function generate15DayReport(): OptimizationReport {
  const feedbacks = getFeedbackList();
  const dist = { '功能建议': 0, 'Bug反馈': 0, '使用问题': 0, '代理相关': 0, '其他': 0 } as Record<FeedbackType, number>;
  feedbacks.forEach(f => { dist[f.type] = (dist[f.type] || 0) + 1; });

  const report: OptimizationReport = {
    id: `rpt${Date.now()}`, type: '15天小优化', generatedAt: Date.now(),
    totalFeedbacks: feedbacks.length,
    typeDistribution: dist,
    topProblems: ['功能操作指引不够清晰', '检测结果展示可更丰富', '代理收益说明需细化'],
    suggestions: [
      {
        id: `sg${Date.now()}a`, title: '增加新手引导流程', status: '待执行',
        detail: '多条反馈指出首次使用不知道如何开始守护，建议增加3步新手引导，在首次打开App时弹出。',
        expectedEffect: '预计提升新用户留存率约15%', priority: 1,
        miaoInstruction: '请在 home.tsx 中增加首次使用引导弹窗，分3步介绍：①点击准备检测②开始守护本局③通知提醒说明，使用金色高亮步骤指示器。',
      },
      {
        id: `sg${Date.now()}b`, title: '优化检测结果页数据展示', status: '待执行',
        detail: '建议在检测结果页增加"对比行业均值"小字注释，增强用户对安全评分的感知价值。',
        expectedEffect: '预计提升检测→购买转化约8%', priority: 2,
        miaoInstruction: '请在 home.tsx 检测结果展示区域的"本局安全评分：98分"下方增加浅灰色小字：「高于行业平均 23 分」。',
      },
      {
        id: `sg${Date.now()}c`, title: '代理中心增加收益计算器', status: '待执行',
        detail: '代理相关反馈集中在"不清楚能赚多少"，建议在代理中心页增加简单的收益模拟器。',
        expectedEffect: '预计提升代理升级意愿约20%', priority: 3,
        miaoInstruction: '请在 agent-center.tsx 代理权益说明卡片下方增加"收益估算"模块，输入每日推广人数，自动计算月收益区间。',
      },
    ],
  };
  allReports.unshift(report);
  has15DayReport = true;
  return report;
}

// 生成新的30天大优化报告
export function generate30DayReport(): OptimizationReport {
  const feedbacks = getFeedbackList();
  const dist = { '功能建议': 0, 'Bug反馈': 0, '使用问题': 0, '代理相关': 0, '其他': 0 } as Record<FeedbackType, number>;
  feedbacks.forEach(f => { dist[f.type] = (dist[f.type] || 0) + 1; });

  const report: OptimizationReport = {
    id: `rpt${Date.now()}`, type: '30天大优化', generatedAt: Date.now(),
    totalFeedbacks: feedbacks.length,
    typeDistribution: dist,
    trendSummary: '与上周期相比：反馈总量增加 34%，Bug反馈占比从 28% 降至 18%，功能建议占比提升至 42%，说明产品稳定性提升，用户期望也在提高。',
    conversionFunnelNote: '检测→开始守护转化率约82%，守护→付费转化率约12%，付费转化核心流失点在"守护结束过渡页"（约45%用户在此流失）。',
    topProblems: [
      '守护结束过渡页转化力度不足',
      '30天月卡价格对新用户略高',
      '代理体系说明不够直观',
      '检测结果页面停留时间过短',
      '缺少老用户回归激励',
    ],
    suggestions: [
      {
        id: `sg${Date.now()}a`, title: '优化守护结束过渡页转化文案', status: '待执行',
        detail: '当前过渡页文案偏说教，建议改为场景化痛点刺激：展示"您刚才守护的对局，对手可能用了什么"，配合一条模拟的风险检测结果，增强危机感。',
        expectedEffect: '预期提升守护→付费转化率 25-40%，这是当前最高ROI优化点', priority: 1,
        miaoInstruction: '请修改 home.tsx 守护结束过渡页（到期弹窗）文案，将"环境守护已停止"替换为"⚠️ 您已离开守护范围，上局对手的设备我们检测到了什么？"并在下方增加一条模拟检测警告卡片，使用红色边框，底部放"立即恢复守护"按钮。',
      },
      {
        id: `sg${Date.now()}b`, title: '增加7天限时折扣策略', status: '待执行',
        detail: '试用到期后72小时内，在付费激活页显示首次开通限时折扣（原价的8折），时效性促进决策。',
        expectedEffect: '预期首次付费转化率提升15-20%', priority: 2,
        miaoInstruction: '请在 activation.tsx 中增加"首次开通限时折扣"模块：在顶部显示红色倒计时标签（72小时），并将套餐价格展示为划线原价+折扣价，仅对未付费用户显示。',
      },
      {
        id: `sg${Date.now()}c`, title: '代理招募页增加真实收益案例', status: '待执行',
        detail: '分析代理相关反馈，最大疑虑是"能不能真的赚到钱"，建议在代理升级页增加3个匿名代理的月收益案例（模拟数据）。',
        expectedEffect: '预期代理开通率提升30%', priority: 3,
        miaoInstruction: '请在 agent-upgrade.tsx 三级对比卡片顶部增加"代理收益实例"横向滚动卡片组，展示3个案例：①初级代理·月入820元②中级代理·月入2600元③高级代理·月入6800元，使用金色标注数字。',
      },
      {
        id: `sg${Date.now()}d`, title: '延长检测结果页展示时间', status: '待执行',
        detail: '用户在检测结果页平均停留仅2.3秒，建议增加3秒"分析中"过渡动效，让用户充分感受检测价值。',
        expectedEffect: '提升检测结果感知价值，辅助提升付费意愿', priority: 4,
        miaoInstruction: '请在 home.tsx 第二阶段检测动画结束后增加一个3秒的"AI深度分析中..."过渡状态（转圈动画），然后再展示"环境安全，放心游戏"最终结果页。',
      },
      {
        id: `sg${Date.now()}e`, title: '增加老用户续费提醒优惠', status: '待执行',
        detail: '到期前3天发送App内提醒，附带"续费立减2元"专属优惠，降低续费决策门槛。',
        expectedEffect: '预期续费率提升20%，减少流失', priority: 5,
        miaoInstruction: '请在 home.tsx 到期前3天提醒弹窗中增加"续费专属优惠"标签，文案为：「老用户专属 · 续费立减2元 · 仅剩3天」，并在激活页面对应套餐显示折后价。',
      },
    ],
  };
  allReports.unshift(report);
  has30DayReport = true;
  return report;
}

// ─── 守护计时器 ─────────────────────────────────────────
export function startGuard(): void {
  guardStartTime = Date.now();
  guardPhase = 'waiting'; // 从等待阶段开始
}
export function setGuardPhaseDetecting(): void {
  guardPhase = 'detecting';
}
export function setGuardPhaseGuarding(): void {
  guardPhase = 'guarding';
}
export function pauseGuard(): void {
  if (guardPhase === 'guarding') guardPhase = 'paused';
}
export function resumeGuard(): void {
  if (guardPhase === 'paused') guardPhase = 'guarding';
}
export function stopGuard(): void {
  guardStartTime = null;
  guardPhase = 'idle';
}
export function expireGuard(): void {
  guardPhase = 'expired';
}
export function getGuardPhase(): GuardPhase { return guardPhase; }
export function isGuardRunning(): boolean { return guardStartTime !== null; }
export function getTotalSeconds(): number { return config.trialMinutes * 60; }
export function getRemainingSeconds(): number {
  const total = getTotalSeconds();
  if (guardStartTime === null) return total;
  // 等待阶段(2分钟)不计入正式护航时间
  if (guardPhase === 'waiting' || guardPhase === 'detecting') return total;
  const elapsed = Math.floor((Date.now() - guardStartTime) / 1000);
  return Math.max(0, total - elapsed);
}
export function getElapsedSeconds(): number {
  return getTotalSeconds() - getRemainingSeconds();
}
export function isGuardExpired(): boolean {
  return guardPhase === 'guarding' && guardStartTime !== null && getRemainingSeconds() === 0;
}
export function shouldShowReport(): boolean {
  if (!guardStartTime || guardPhase !== 'guarding') return false;
  const remaining = getRemainingSeconds();
  return remaining > 0 && remaining <= 120;
}

// ─── 夜间模式 & 音效 ────────────────────────────────────
export function getNightModeOption(): NightModeOption { return nightModeOption; }
export function setNightModeOption(opt: NightModeOption): void { nightModeOption = opt; }
export function getSoundEffectOption(): SoundEffectOption { return soundEffectOption; }
export function setSoundEffectOption(opt: SoundEffectOption): void { soundEffectOption = opt; }
/** 根据选项和当前时间判断是否为暗色模式 */
export function isDarkMode(): boolean {
  if (nightModeOption === 'on') return true;
  if (nightModeOption === 'off') return false;
  // auto: 20:00-06:00 为暗色
  const h = new Date().getHours();
  return h >= 20 || h < 6;
}

// ─── 首次启动 & 更新提示 ─────────────────────────────────
export function getIsFirstLaunch(): boolean { return isFirstLaunch; }
export function markFirstLaunchDone(): void { isFirstLaunch = false; }
export function getShouldShowUpdateBanner(): boolean { return !hasShownUpdateBanner; }
export function markUpdateBannerShown(): void { hasShownUpdateBanner = true; }

// ─── 免费10分钟横幅（永久消失 key） ─────────────────────────
const FREE_BANNER_KEY = '__free_guard_banner_dismissed__';
export function isFreeBannerDismissed(): boolean {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(FREE_BANNER_KEY) === '1'; } catch { return false; }
}
export function dismissFreeBanner(): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(FREE_BANNER_KEY, '1'); } catch { /* noop */ }
}

// ─── 管理员会话：一次验证全程有效（含 localStorage 持久化） ──
const ADMIN_VERIFIED_KEY    = '__admin_verified__';
const ADMIN_FACE_KEY        = '__admin_face_enrolled__';
const ADMIN_PHONE_KEY       = '__admin_bound_phone__';
const ADMIN_PASS_KEY        = '__admin_password__';
const ADMIN_FIRST_LOGIN_KEY = '__admin_first_login__';
// 永久登录持久化键（手动退出前永不清除）
const ADMIN_LOGGED_IN_KEY   = '__admin_logged_in__';

// 运行时 flag（同一进程内使用）
let adminSessionValidated = false;

/** 从 localStorage 恢复管理员验证状态和持久化数据 */
export function restoreAdminSession(): void {
  try {
    if (typeof localStorage !== 'undefined') {
      // 永久登录：只要未手动退出，直接恢复已验证状态
      const loggedIn = localStorage.getItem(ADMIN_LOGGED_IN_KEY);
      if (loggedIn === '1') {
        adminSessionValidated = true;
        loginState = { ...loginState, isAdminLoggedIn: true };
      }

      const verified = localStorage.getItem(ADMIN_VERIFIED_KEY);
      if (verified === '1') { adminSessionValidated = true; }

      const face = localStorage.getItem(ADMIN_FACE_KEY);
      if (face === '1') { loginState = { ...loginState, adminFaceEnrolled: true }; }

      // 仅允许安全设置中用户主动修改的手机号覆盖（固定手机号作为兜底）
      const phone = localStorage.getItem(ADMIN_PHONE_KEY);
      if (phone) { loginState = { ...loginState, adminBoundPhone: phone }; }

      // 仅允许用户主动改密覆盖（固定密码作为兜底）
      const pass = localStorage.getItem(ADMIN_PASS_KEY);
      if (pass) { loginState = { ...loginState, adminPassword: pass, isFirstAdminLogin: false }; }

      // isFirstAdminLogin 始终保持 false（固定凭据不需要首次设置）
      loginState = { ...loginState, isFirstAdminLogin: false };
    }
  } catch { /* 忽略 SSR / 沙箱环境 */ }
}
// 应用启动时自动恢复
restoreAdminSession();

export function isAdminSessionValidated(): boolean { return adminSessionValidated; }

export function persistAdminVerified(): void {
  adminSessionValidated = true;
  loginState = { ...loginState, isAdminLoggedIn: true };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADMIN_VERIFIED_KEY, '1');
      localStorage.setItem(ADMIN_LOGGED_IN_KEY, '1'); // 永久登录
    }
  } catch { /* noop */ }
}

export function clearAdminVerified(): void {
  adminSessionValidated = false;
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(ADMIN_VERIFIED_KEY);
      localStorage.removeItem(ADMIN_LOGGED_IN_KEY); // 手动退出时清除永久登录
      localStorage.removeItem(DEVICE_ACTIVATION_KEY); // 手动退出时清除设备激活状态，下次需重新验证激活码
    }
  } catch { /* noop */ }
}

// 兼容旧接口
export function setAdminSessionValidated(v: boolean): void {
  if (v) persistAdminVerified(); else clearAdminVerified();
}

// ─── 登录状态 ────────────────────────────────────────────
export function getLoginState(): LoginState { return { ...loginState }; }

/** 管理员账号密码登录（支持固定手机号 / 已绑定手机号 / admin） */
export function adminLogin(phone: string, password: string): boolean {
  const currentPass = loginState.adminPassword;
  const currentBound = loginState.adminBoundPhone;
  const validPhone =
    phone === ADMIN_FIXED_PHONE ||
    phone === 'admin' ||
    (currentBound && phone === currentBound) ||
    phone === loginState.adminPhone;
  const validPass = password === currentPass;
  if (validPhone && validPass) {
    loginState = { ...loginState, isAdminLoggedIn: true, adminPhone: phone };
    return true;
  }
  return false;
}

/** 检查是否正在使用默认密码（admin123） */
export function isDefaultAdminPassword(): boolean {
  return loginState.adminPassword === 'admin123' && loginState.isFirstAdminLogin;
}

/** 管理员改密（同时更新 localStorage 持久化 + 标记首次登录已完成） */
export function adminChangePassword(newPhone: string, newPassword: string): void {
  loginState = { ...loginState, adminPhone: newPhone || loginState.adminPhone, adminPassword: newPassword, isFirstAdminLogin: false };
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(ADMIN_PASS_KEY, newPassword);
      localStorage.setItem(ADMIN_FIRST_LOGIN_KEY, '0');
    }
  } catch { /* noop */ }
}

/**
 * 首次安全设置：可只绑手机、只改密，或两者同时完成。
 * 至少传入其中一项（phone 非空 或 newPassword 非空）。
 * 设置完毕后标记 isFirstAdminLogin = false。
 */
export function adminFirstSetup(phone: string, newPassword: string): void {
  const update: Partial<LoginState> = { isFirstAdminLogin: false };
  if (phone) {
    update.adminBoundPhone = phone;
  }
  if (newPassword) {
    update.adminPassword = newPassword;
  }
  loginState = { ...loginState, ...update };
  try {
    if (typeof localStorage !== 'undefined') {
      if (phone) localStorage.setItem(ADMIN_PHONE_KEY, phone);
      if (newPassword) localStorage.setItem(ADMIN_PASS_KEY, newPassword);
      localStorage.setItem(ADMIN_FIRST_LOGIN_KEY, '0');
    }
  } catch { /* noop */ }
}

/** 绑定/更换管理员手机号 */
export function adminBindPhone(phone: string): void {
  loginState = { ...loginState, adminBoundPhone: phone };
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(ADMIN_PHONE_KEY, phone); } catch { /* noop */ }
}

/** 录入/清除人脸 */
export function adminSetFaceEnrolled(enrolled: boolean): void {
  loginState = { ...loginState, adminFaceEnrolled: enrolled };
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(ADMIN_FACE_KEY, enrolled ? '1' : '0'); } catch { /* noop */ }
}

export function adminLogout(): void {
  loginState = { ...loginState, isAdminLoggedIn: false };
  clearAdminVerified(); // 同时清除永久登录标记
}
export function agentLogin(phone: string, password: string): boolean {
  // 模拟：任意手机号+密码登录代理（实际应有注册逻辑）
  if (phone.length >= 11 && password.length >= 6) {
    loginState = { ...loginState, isAgentLoggedIn: true, agentPhone: phone, agentPassword: password };
    return true;
  }
  return false;
}
export function agentLogout(): void {
  loginState = { ...loginState, isAgentLoggedIn: false };
}
export function isAdminLoggedIn(): boolean { return loginState.isAdminLoggedIn; }
export function isAgentLoggedIn(): boolean { return loginState.isAgentLoggedIn; }

// ─── 代理客户管理 ────────────────────────────────────────
export function getAgentCustomers(): AgentCustomer[] {
  return [...agentCustomers].sort((a, b) => {
    // 即将到期（3天内）置顶
    const aExpiringSoon = (a.expireTime - Date.now()) < 3 * 24 * 3600 * 1000 && a.expireTime > Date.now();
    const bExpiringSoon = (b.expireTime - Date.now()) < 3 * 24 * 3600 * 1000 && b.expireTime > Date.now();
    if (aExpiringSoon && !bExpiringSoon) return -1;
    if (!aExpiringSoon && bExpiringSoon) return 1;
    return b.orderedAt - a.orderedAt;
  });
}

// ─── 推送历史 ────────────────────────────────────────────
export function getPushHistory(): PushRecord[] {
  return [...pushHistory].sort((a, b) => b.time - a.time);
}
export function addPushRecord(rec: Omit<PushRecord, 'id' | 'time'>): void {
  pushHistory.unshift({ ...rec, id: `pr${Date.now()}`, time: Date.now() });
}

// ─── 代理收益（模拟） ────────────────────────────────────
export function getAgentEarnings(): { today: number; month: number; total: number } {
  return {
    today: Math.floor(Math.random() * 100) + 50,
    month: Math.floor(Math.random() * 800) + 400,
    total: Math.floor(Math.random() * 5000) + 2000,
  };
}

// ─── 代理排行榜（模拟） ──────────────────────────────────
export interface AgentRankEntry {
  rank: number;
  phoneMasked: string;
  sales: number;
  isSelf: boolean;
}
export function getAgentLeaderboard(): AgentRankEntry[] {
  return [
    { rank: 1, phoneMasked: '138****1234', sales: 6800, isSelf: false },
    { rank: 2, phoneMasked: '139****5678', sales: 3200, isSelf: true },
    { rank: 3, phoneMasked: '186****9012', sales: 1560, isSelf: false },
  ];
}

// ─── 管理员仪表盘数据（模拟）────────────────────────────────
export interface AdminWarning {
  key: string;
  icon: string;
  label: string;
  desc: string;
  count: number;
}
export interface AdminDashboard {
  todayIncome: number;
  monthIncome: number;
  onlineUsers: number;
  weekIncome: number[];
  warnings: AdminWarning[];
}
export function getAdminDashboardData(): AdminDashboard {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  // 只统计「已完成」订单的 payAmount（用户实际付款金额）
  const completedOrders = payOrders.filter(o => o.status === '已完成');

  const todayIncome = completedOrders
    .filter(o => (o.resolvedAt ?? 0) >= todayStart)
    .reduce((sum, o) => sum + (parseFloat(o.payAmount) || 0), 0);

  const monthIncome = completedOrders
    .filter(o => (o.resolvedAt ?? 0) >= monthStart)
    .reduce((sum, o) => sum + (parseFloat(o.payAmount) || 0), 0);

  // 近7天每天收入（index 0 = 6天前，index 6 = 今天）
  const weekIncome: number[] = Array.from({ length: 7 }, (_, i) => {
    const dayStart = todayStart - (6 - i) * 86400000;
    const dayEnd = dayStart + 86400000;
    return completedOrders
      .filter(o => (o.resolvedAt ?? 0) >= dayStart && (o.resolvedAt ?? 0) < dayEnd)
      .reduce((sum, o) => sum + (parseFloat(o.payAmount) || 0), 0);
  });

  // 预警：待核实订单数
  const pendingCount = payOrders.filter(o =>
    o.status === 'AI审核中' || o.status === '待管理员确认' || o.status === '异常-价格不符'
  ).length;
  const fraudCount = payOrders.filter(o => o.status === '高危欺诈').length;

  const warnings: AdminWarning[] = [];
  if (pendingCount > 0) warnings.push({ key: 'pending', icon: '⏳', label: '待核实订单', desc: '需尽快审核', count: pendingCount });
  if (fraudCount > 0) warnings.push({ key: 'fraud', icon: '🚨', label: '高危欺诈订单', desc: '请立即处理', count: fraudCount });

  return {
    todayIncome,
    monthIncome,
    onlineUsers: 0,
    weekIncome,
    warnings,
  };
}

// ─── 付款订单 ────────────────────────────────────────────────
export type OrderStatus =
  | '待付款'
  | 'AI审核中'
  | '待管理员确认'
  | '已完成'
  | '已驳回'
  | '异常-价格不符'   // 管理员标记：需退款/补款处理
  | '高危欺诈'        // AI标记高危
  | '已退款';         // 管理员已退款
export type OrderAiStatus = 'pending' | 'confirmed' | 'abnormal' | 'fraud';
/** 套餐类型：member=会员套餐, agent=代理等级 */
export type OrderPlanType = 'member' | 'agent';

export interface PayOrder {
  id: string;                   // 唯一订单编号，如 ORD20260510XXXX
  deviceId: string;             // 设备ID
  planType: OrderPlanType;      // 会员/代理
  planLabel: string;            // 套餐名称，如"30天月卡"/"高级代理"
  planDays: number;             // 会员天数（代理=0）
  planPrice: string;            // 套餐标准价格
  agentLevel: string;           // 代理等级（仅代理类型有效）
  createdAt: number;            // 订单创建时间
  status: OrderStatus;          // 订单状态
  // 用户填写的付款信息
  payAmount: string;            // 用户填写的付款金额
  payTime: string;              // 用户填写的付款时间（如 2025-05-12 14:30）
  payNickOrNo: string;          // 昵称或交易单号（选填）
  payScreenshotUrl: string;     // 截图URL（选填）
  // AI审核结果
  aiStatus: OrderAiStatus;      // pending/confirmed/abnormal/fraud
  aiNote: string;               // AI审核备注（含差异详情）
  // 退款/补款信息
  refundScreenshotUrl: string;  // 管理员上传退款凭证截图
  refundAmount: string;         // 实际退款金额
  refundNote: string;           // 退款备注
  // 处理信息
  resolvedAt: number | null;    // 处理时间
  resolvedBy: string;           // 处理人（管理员）
}

// 设备驳回计数（24h 熔断）
interface DeviceRejection { count: number; firstAt: number; blocked: boolean }
const deviceRejections: Record<string, DeviceRejection> = {};

/** 记录一次驳回；若 24h 内累计 ≥3 次，自动标记设备熔断 */
export function recordDeviceRejection(deviceId: string): boolean {
  const now = Date.now();
  const rec = deviceRejections[deviceId] ?? { count: 0, firstAt: now, blocked: false };
  const within24h = now - rec.firstAt < 24 * 3600 * 1000;
  const newCount = within24h ? rec.count + 1 : 1;
  const newFirst = within24h ? rec.firstAt : now;
  const blocked = newCount >= 3;
  deviceRejections[deviceId] = { count: newCount, firstAt: newFirst, blocked };
  return blocked;
}

/** 查询设备是否被熔断（24h 内 ≥3 次驳回） */
export function isDeviceBlocked(deviceId: string): boolean {
  const rec = deviceRejections[deviceId];
  if (!rec) return false;
  const within24h = Date.now() - rec.firstAt < 24 * 3600 * 1000;
  return within24h && rec.blocked;
}

let payOrders: PayOrder[] = [];

/** 生成订单编号 */
function genOrderId(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `ORD${date}${rand}`;
}

export function createOrder(params: {
  planType: OrderPlanType;
  planLabel: string;
  planDays: number;
  planPrice: string;
  agentLevel?: string;
}): PayOrder {
  const order: PayOrder = {
    id: genOrderId(),
    deviceId: getDeviceId(),
    planType: params.planType,
    planLabel: params.planLabel,
    planDays: params.planDays,
    planPrice: params.planPrice,
    agentLevel: params.agentLevel ?? '',
    createdAt: Date.now(),
    status: '待付款',
    payAmount: '',
    payTime: '',
    payNickOrNo: '',
    payScreenshotUrl: '',
    aiStatus: 'pending',
    aiNote: '',
    refundScreenshotUrl: '',
    refundAmount: '',
    refundNote: '',
    resolvedAt: null,
    resolvedBy: '',
  };
  payOrders = [order, ...payOrders];
  return order;
}

export function getOrders(): PayOrder[] {
  return [...payOrders].sort((a, b) => b.createdAt - a.createdAt);
}

/** 用户待处理订单（AI审核中 / 待管理员确认 / 异常-价格不符） */
export function getPendingUserOrders(): PayOrder[] {
  return payOrders.filter(o =>
    o.status === 'AI审核中' ||
    o.status === '待管理员确认' ||
    o.status === '异常-价格不符'
  );
}

/** 管理员待核实列表（AI审核中 + 待管理员确认 + 高危欺诈 + 异常-价格不符），AI已确认排前，高危置顶 */
export function getAdminPendingOrders(): PayOrder[] {
  const pending = payOrders.filter(o =>
    o.status === 'AI审核中' ||
    o.status === '待管理员确认' ||
    o.status === '高危欺诈' ||
    o.status === '异常-价格不符'
  );
  return pending.sort((a, b) => {
    // 高危欺诈最优先(0)；AI已确认其次(1)；AI审核中(2)；abnormal(3)
    const rank = (o: PayOrder): number => {
      if (o.status === '高危欺诈') return 0;
      if (o.aiStatus === 'confirmed') return 1;
      if (o.aiStatus === 'pending') return 2;
      return 3;
    };
    return rank(a) - rank(b);
  });
}

export function updateOrderPayInfo(
  id: string,
  payAmount: string,
  payTime: string,
  payNickOrNo: string,
  payScreenshotUrl: string,
): void {
  payOrders = payOrders.map(o =>
    o.id === id
      ? { ...o, payAmount, payTime, payNickOrNo, payScreenshotUrl, status: 'AI审核中' }
      : o
  );
}

export function updateOrderAiResult(id: string, aiStatus: OrderAiStatus, aiNote: string): void {
  payOrders = payOrders.map(o => {
    if (o.id !== id) return o;
    let status: OrderStatus;
    if (aiStatus === 'fraud') {
      status = '高危欺诈';
      // 设备熔断记录
      recordDeviceRejection(o.deviceId);
      addOrderOpLog(`⚠️ 高危欺诈标记 ${id}（设备${o.deviceId}）`);
    } else if (aiStatus === 'confirmed') {
      status = '待管理员确认';
    } else {
      status = 'AI审核中';
    }
    return { ...o, aiStatus, aiNote, status };
  });
}

/** 管理员将订单标记为"异常-价格不符"（触发用户端客服入口） */
export function markOrderPriceAbnormal(id: string, note: string): void {
  payOrders = payOrders.map(o =>
    o.id === id
      ? { ...o, status: '异常-价格不符', aiNote: note || o.aiNote, resolvedAt: Date.now(), resolvedBy: '管理员' }
      : o
  );
  addOrderOpLog(`标记异常-价格不符 ${id}：${note}`);
}

/** 管理员批量开通：激活多笔已确认订单 */
export function activateOrdersBatch(ids: string[]): void {
  ids.forEach(id => activateOrderById(id));
}

/** 管理员上传退款凭证并将订单置为"已退款" */
export function refundOrderById(
  id: string,
  refundScreenshotUrl: string,
  refundAmount: string,
  refundNote: string,
): void {
  const order = payOrders.find(o => o.id === id);
  if (!order) return;
  payOrders = payOrders.map(o =>
    o.id === id
      ? { ...o, status: '已退款', refundScreenshotUrl, refundAmount, refundNote, resolvedAt: Date.now(), resolvedBy: '管理员' }
      : o
  );
  addOrderOpLog(`退款订单 ${id}：金额¥${refundAmount}，备注：${refundNote}`);
}

/** 管理员一键开通：激活会员或代理权益 */
export function activateOrderById(id: string): void {
  const order = payOrders.find(o => o.id === id);
  if (!order) return;
  if (order.status === '已完成') return; // 防止重复开通

  // 激活对应权益
  if (order.planType === 'member' && order.planDays > 0) {
    setMemberExpire(order.planDays);
  } else if (order.planType === 'agent' && order.agentLevel) {
    setAgentRank(order.agentLevel as AgentRank);
    setAgentActivated(true); // 管理员确认开通后才标记为已激活
  }

  payOrders = payOrders.map(o =>
    o.id === id
      ? { ...o, status: '已完成', resolvedAt: Date.now(), resolvedBy: '管理员' }
      : o
  );

  // 写入操作日志
  addOrderOpLog(`开通订单 ${id}：${order.planLabel}（设备${order.deviceId}）`);
}

export function rejectOrderById(id: string, reason: string): void {
  const order = payOrders.find(o => o.id === id);
  payOrders = payOrders.map(o =>
    o.id === id
      ? { ...o, status: '已驳回', resolvedAt: Date.now(), resolvedBy: '管理员', aiNote: reason || o.aiNote }
      : o
  );
  // 记录设备驳回次数用于熔断判断
  if (order) recordDeviceRejection(order.deviceId);
  addOrderOpLog(`驳回订单 ${id}：${reason}`);
}

/** 今日已核实订单数 */
export function getTodayResolvedCount(): number {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  return payOrders.filter(o => o.status === '已完成' && o.resolvedAt && o.resolvedAt >= todayStart.getTime()).length;
}

/** 今日总收款金额 */
export function getTodayTotalIncome(): number {
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  return payOrders
    .filter(o => o.status === '已完成' && o.resolvedAt && o.resolvedAt >= todayStart.getTime())
    .reduce((sum, o) => sum + (parseFloat(o.payAmount) || parseFloat(o.planPrice) || 0), 0);
}

// ─── 操作日志 & 回滚（模拟）────────────────────────────────
export interface OpLog {
  id: string;
  time: number;
  desc: string;
  isRollback: boolean;
  /** 该日志可回滚到的前值快照（纯文本） */
  snapshot?: string;
}

const MOCK_OP_LOGS: OpLog[] = [
  { id: 'ol1', time: Date.now() - 1000 * 60 * 30, desc: '修改30天月卡价格：¥39.9（已更新新价格体系）', isRollback: false, snapshot: '39.9' },
  { id: 'ol2', time: Date.now() - 1000 * 60 * 90, desc: '开启 AI Lv3 自动执行权限',          isRollback: false, snapshot: 'lv3=false' },
  { id: 'ol3', time: Date.now() - 1000 * 3600 * 3, desc: '修改代理初级升级费用：¥199 → ¥299', isRollback: false, snapshot: '199' },
];

let opLogs: OpLog[] = [...MOCK_OP_LOGS];

export function getOpLogs(): OpLog[] {
  return [...opLogs].sort((a, b) => b.time - a.time);
}

export function rollbackOpLog(id: string): void {
  const target = opLogs.find(l => l.id === id);
  if (!target) return;
  // 标记原日志已回滚（设为只读，不可再回滚）
  opLogs = opLogs.map(l => l.id === id ? { ...l, isRollback: true } : l);
  // 新增一条回滚记录
  opLogs.unshift({
    id: `ol_rb_${Date.now()}`,
    time: Date.now(),
    desc: `⏪ 已回滚"${target.desc}"`,
    isRollback: true,
  });
}

/** 追加订单操作日志 */
export function addOrderOpLog(desc: string): void {
  opLogs.unshift({
    id: `ol_ord_${Date.now()}`,
    time: Date.now(),
    desc,
    isRollback: false,
  });
}

// ── 手动创建代理 ─────────────────────────────────────────────
export interface ManualAgentRecord {
  id: string;
  phone: string;
  rank: AgentRank;
  note: string;
  createdAt: number;
  /** true=手动创建，false=自助付费 */
  isManual: boolean;
  /** 账号状态 */
  status: 'active' | 'paused';
  /** 默认密码（手机号后6位，仅手动创建时有值，展示一次后建议提示修改） */
  defaultPassword: string;
}

let manualAgents: ManualAgentRecord[] = [];

export function getManualAgents(): ManualAgentRecord[] {
  return [...manualAgents].sort((a, b) => b.createdAt - a.createdAt);
}

export function createManualAgent(
  phone: string,
  rank: AgentRank,
  note: string,
): ManualAgentRecord {
  const defaultPassword = phone.slice(-6);
  const rec: ManualAgentRecord = {
    id: `mag_${Date.now()}`,
    phone,
    rank,
    note,
    createdAt: Date.now(),
    isManual: true,
    status: 'active',
    defaultPassword,
  };
  manualAgents = [rec, ...manualAgents];
  // 手动创建代理也视为管理员已确认开通
  setAgentRank(rank);
  setAgentActivated(true);
  return rec;
}

export function updateManualAgentStatus(id: string, status: 'active' | 'paused'): void {
  manualAgents = manualAgents.map(a => a.id === id ? { ...a, status } : a);
}

export function deleteManualAgent(id: string): void {
  manualAgents = manualAgents.filter(a => a.id !== id);
}

export function updateManualAgentRank(id: string, rank: AgentRank): void {
  manualAgents = manualAgents.map(a => a.id === id ? { ...a, rank } : a);
}


// ─── 套餐定义（原 abExpStore.ts，迁移至此）────────────────────
export interface ExpPlanDef {
  title: string;       // 套餐名称（如"3天体验卡"）
  days: number;        // 有效天数
  price: string;       // 展示价格（如"¥9.9"）
  label: string;       // 卡片标签（如"🔥最划算"）
  subTexts: string[];  // 诱导文案（如["日均¥1.33"]）
  isMost: boolean;     // 是否默认选中
  enabled: boolean;    // 是否启用（false=隐藏）
}

/** 从全局配置生成当前生效套餐列表（唯一价格来源）
 *  优先使用 activePlanItems（由 pricePlanStore 写入，含标签/文案）
 *  退化时从价格字段自动计算
 */
export function getGlobalPlans(): ExpPlanDef[] {
  const cfg = getConfig();
  // 优先使用方案应用后写入的 activePlanItems（含正确标签/文案）
  if (Array.isArray(cfg.activePlanItems) && cfg.activePlanItems.length > 0) {
    return cfg.activePlanItems
      .filter(p => p.enabled)
      .map(p => ({
        ...p,
        price: p.price.startsWith('¥') ? p.price : `¥${p.price}`,
      }));
  }
  // 退化：从价格字段自动计算（使用自定义套餐名称，不含自定义标签/文案）
  const plans: ExpPlanDef[] = [
    {
      title: cfg.planTitle3Day || '3天体验卡',
      days: 3,
      price: `¥${cfg.cost3Day}`,
      label: '',
      subTexts: [`日均¥${(parseFloat(cfg.cost3Day) / 3).toFixed(2)}`],
      isMost: false,
      enabled: true,
    },
    {
      title: cfg.planTitle30Day || '30天月卡',
      days: 30,
      price: `¥${cfg.cost30Day}`,
      label: '🔥热门',
      subTexts: [`日均¥${(parseFloat(cfg.cost30Day) / 30).toFixed(2)}`],
      isMost: true,
      enabled: true,
    },
    {
      title: cfg.planTitle180Day || '半年卡',
      days: 180,
      price: `¥${cfg.cost180Day}`,
      label: '💎超值',
      subTexts: [`日均¥${(parseFloat(cfg.cost180Day) / 180).toFixed(2)}`],
      isMost: false,
      enabled: parseFloat(cfg.cost180Day) > 0,
    },
    {
      title: cfg.planTitle365Day || '年卡',
      days: 365,
      price: `¥${cfg.cost365Day}`,
      label: '🔥最划算',
      subTexts: [`日均¥${(parseFloat(cfg.cost365Day) / 365).toFixed(2)}`],
      isMost: false,
      enabled: true,
    },
  ];
  return plans.filter(p => p.enabled);
}

// ─── 首页提示语（固定方案，已移除 A/B 实验）─────────────────
export function getHomeVariant(): { title: string; subtitle: string } {
  const cfg = getConfig();
  return { title: cfg.homeTitle, subtitle: cfg.homeSubtitle };
}
