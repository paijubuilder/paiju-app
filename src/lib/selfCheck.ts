/**
 * selfCheck.ts
 * 自动自检模块入口 — 统一导出所有自检相关接口
 * 实际逻辑在 pricePlanStore.ts，此文件提供清晰的导入路径
 *
 * 指令6：自动自检与发布拦截
 * 检测项（共9项）：
 *   1. 全局价格配置（DB vs 内存一致性）
 *   2. 前端付费页展示（价格有效性）
 *   3. 代理成本计算（折扣比例误差 < 0.1）
 *   4. 千帆知识库同步（API 已含最新价格）
 *   5. AI 客服话术（csMode 已开启）
 *   6. 支付流程配置（收款二维码/链接已设置）
 *   7. 回滚功能（历史记录存在）
 *   8. AI 应用管理开关持久化（featureFloatWindow 等已入库）
 *   9. 方案切换完整性（套餐数量/价格与方案定义一致）
 *
 * 使用方式：
 *   import { runSelfCheck, exportSelfCheckAsJSON } from '@/lib/selfCheck';
 *   const report = await runSelfCheck();
 *   if (!report.allPassed) { ... }
 */
export {
  runSelfCheck,
  exportSelfCheckAsJSON,
  type SelfCheckItem,
  type SelfCheckReport,
} from '@/lib/pricePlanStore';
