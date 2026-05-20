/**
 * 价格方案选择器（嵌入到【经营】→【会员价格】Card 顶部）
 * - 4套内置方案 + 自定义方案
 * - 应用确认 → 分步进度
 * - 手动编辑 → 保存为自定义方案
 * - 10条历史 + 回滚
 * - 9项自检 + JSON 导出
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Modal, Pressable,
  ScrollView, Share, Text, TextInput, View,
} from 'react-native';
import { getConfig } from '@/lib/appStore';
import {
  BUILTIN_PLANS, getAllPlans, saveCustomPlan,
  applyPricePlan, detectActivePresetId,
  loadConfigHistory, rollbackToHistory, saveManualConfig,
  runSelfCheck, exportSelfCheckAsJSON,
  buildAIKnowledgeText,
} from '@/lib/pricePlanStore';
import type {
  PricePlanPreset, ConfigHistoryEntry, SelfCheckReport,
} from '@/lib/pricePlanStore';

// ─── 颜色 ─────────────────────────────────────────────────
const C = {
  bg: '#0B0E14', card: '#161A1F', border: '#2A3140',
  text: '#E8EAF0', muted: '#8899AA', accent: '#2563EB',
  accentDim: '#1A3A80', success: '#22C55E', error: '#EF4444',
  warning: '#F59E0B', gold: '#D4AF37', purple: '#A855F7',
};

// ─── 应用进度弹窗 ─────────────────────────────────────────
type StepStatus = 'pending' | 'running' | 'done' | 'error';
interface Step { label: string; status: StepStatus }

function ProgressModal({
  visible, steps, done, copyText, onClose,
}: {
  visible: boolean; steps: Step[]; done: boolean;
  copyText?: string | null; onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 }}>
        <View style={{ backgroundColor: '#111827', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border }}>
          <Text style={{ color: C.text, fontSize: 16, fontWeight: 'bold', marginBottom: 18 }}>
            {done ? '✅ 方案已应用' : '⏳ 正在应用方案…'}
          </Text>
          <View style={{ gap: 12 }}>
            {steps.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{
                  width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                  backgroundColor: s.status === 'done' ? C.success : s.status === 'error' ? C.error
                    : s.status === 'running' ? C.accent : '#2A3140',
                }}>
                  {s.status === 'running'
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                        {s.status === 'done' ? '✓' : s.status === 'error' ? '✗' : `${i + 1}`}
                      </Text>
                  }
                </View>
                <Text style={{
                  color: s.status === 'done' ? C.success : s.status === 'error' ? C.error
                    : s.status === 'running' ? C.text : C.muted, fontSize: 13, flex: 1,
                }}>{s.label}</Text>
              </View>
            ))}
          </View>

          {copyText && (
            <View style={{ backgroundColor: C.warning + '11', borderRadius: 10, padding: 12, marginTop: 16, borderWidth: 1, borderColor: C.warning }}>
              <Text style={{ color: C.warning, fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>⚠️ AI 知识库同步失败，请手动更新</Text>
              <Text style={{ color: C.muted, fontSize: 11, lineHeight: 16, marginBottom: 6 }}>
                复制以下内容，前往百度千帆 AppBuilder 后台更新知识库文档：
              </Text>
              <ScrollView style={{ maxHeight: 100 }}>
                <Text style={{ color: C.muted, fontSize: 10, lineHeight: 14 }} selectable>{copyText}</Text>
              </ScrollView>
            </View>
          )}

          {done && (
            <Pressable
              cssInterop={false}
              onPress={onClose}
              style={({ pressed }) => ({
                backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12,
                alignItems: 'center', marginTop: 18, opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>完成</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── 自检报告弹窗 ─────────────────────────────────────────
function SelfCheckModal({
  visible, report, loading, onClose, onExport,
}: {
  visible: boolean; report: SelfCheckReport | null; loading: boolean;
  onClose: () => void; onExport: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#0D1117', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: C.border, maxHeight: '88%' }}>
          {/* 头部 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: 'bold', flex: 1 }}>🔍 自检报告</Text>
            {report && !loading && (
              <Pressable onPress={onExport} style={{ marginRight: 14 }}>
                <Text style={{ color: C.accent, fontSize: 13 }}>导出 JSON</Text>
              </Pressable>
            )}
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ color: C.muted, fontSize: 20 }}>✕</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 18, gap: 4 }}>
            {loading && (
              <View style={{ alignItems: 'center', padding: 32 }}>
                <ActivityIndicator color={C.accent} size="large" />
                <Text style={{ color: C.muted, marginTop: 12 }}>正在运行自检（共9项）…</Text>
              </View>
            )}

            {!loading && report && (
              <>
                {/* 总分 */}
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: report.allPassed ? C.success + '22' : C.warning + '22',
                  borderRadius: 12, padding: 14, marginBottom: 12,
                  borderWidth: 1, borderColor: report.allPassed ? C.success : C.warning,
                }}>
                  <Text style={{ color: report.allPassed ? C.success : C.warning, fontSize: 15, fontWeight: 'bold' }}>
                    通过 {report.passCount}/{report.total} 项
                  </Text>
                  <Text style={{ fontSize: 20 }}>{report.allPassed ? '✅' : '⚠️'}</Text>
                </View>

                {/* 明细 */}
                {report.items.map(item => (
                  <View key={item.id} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: C.border }}>
                    <Text style={{ fontSize: 16, width: 22 }}>{item.passed ? '✅' : '❌'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', marginBottom: 2 }}>{item.name}</Text>
                      <Text style={{ color: item.passed ? C.muted : C.error, fontSize: 12, lineHeight: 16 }}>{item.detail}</Text>
                    </View>
                  </View>
                ))}

                {report.suggestion && (
                  <View style={{ backgroundColor: C.error + '11', borderRadius: 8, padding: 12, marginTop: 12 }}>
                    <Text style={{ color: C.error, fontSize: 12 }}>💡 {report.suggestion}</Text>
                  </View>
                )}
                {report.allPassed && (
                  <View style={{ backgroundColor: C.success + '11', borderRadius: 8, padding: 12, marginTop: 12 }}>
                    <Text style={{ color: C.success, fontSize: 12, textAlign: 'center', fontWeight: 'bold' }}>
                      ✅ 所有自检通过，可以安全发布
                    </Text>
                  </View>
                )}

                <Text style={{ color: C.muted, fontSize: 10, textAlign: 'right', marginTop: 12 }}>
                  生成时间：{new Date(report.generatedAt).toLocaleString('zh-CN')}
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── 历史记录弹窗 ─────────────────────────────────────────
function HistoryModal({
  visible, history, onClose, onRollback,
}: {
  visible: boolean; history: ConfigHistoryEntry[];
  onClose: () => void; onRollback: (entry: ConfigHistoryEntry) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: '#0D1117', borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: 1, borderColor: C.border, maxHeight: '80%' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', padding: 18, borderBottomWidth: 1, borderBottomColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: 'bold', flex: 1 }}>📋 配置变更历史（最近10条）</Text>
            <Pressable onPress={onClose} hitSlop={12}><Text style={{ color: C.muted, fontSize: 20 }}>✕</Text></Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 18, gap: 0 }}>
            {history.length === 0
              ? <Text style={{ color: C.muted, textAlign: 'center', padding: 24, fontSize: 13 }}>暂无历史记录</Text>
              : history.map((entry, idx) => (
                <View key={entry.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: C.border }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ color: C.text, fontSize: 13, fontWeight: '600', flex: 1 }}>{entry.planName}</Text>
                    {idx === 0 && (
                      <View style={{ backgroundColor: C.accent + '22', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: C.accent, fontSize: 10, fontWeight: 'bold' }}>最新</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>
                    {new Date(entry.appliedAt).toLocaleString('zh-CN')} · {entry.isManual ? '手动保存' : '方案应用'} · {entry.operator}
                  </Text>
                  <Text style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
                    3天¥{entry.snapshot.cost3Day} / 月¥{entry.snapshot.cost30Day} / 年¥{entry.snapshot.cost365Day}
                  </Text>
                  <Pressable
                    cssInterop={false}
                    onPress={() => onRollback(entry)}
                    style={({ pressed }) => ({
                      backgroundColor: C.purple + '22', borderRadius: 8, paddingVertical: 8,
                      alignItems: 'center', borderWidth: 1, borderColor: C.purple,
                      opacity: pressed ? 0.7 : 1,
                    })}
                  >
                    <Text style={{ color: C.purple, fontSize: 12, fontWeight: 'bold' }}>↩️ 回滚到此时</Text>
                  </Pressable>
                </View>
              ))
            }
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── 主组件：PricePlanSelector ────────────────────────────
export interface PricePlanSelectorProps {
  /** 当前价格被外部手动修改时通知 */
  onExternalUpdate?: () => void;
  /** 方案应用完成后回调（刷新父组件）*/
  onApplied?: () => void;
}

export function PricePlanSelector({ onApplied }: PricePlanSelectorProps) {
  const [allPlans, setAllPlans] = useState<PricePlanPreset[]>(BUILTIN_PLANS);
  const [activeId, setActiveId] = useState('');
  const [confirmPreset, setConfirmPreset] = useState<PricePlanPreset | null>(null);

  // 应用进度
  const [applying, setApplying] = useState(false);
  const [applySteps, setApplySteps] = useState<Step[]>([]);
  const [applyDone, setApplyDone] = useState(false);
  const [copyText, setCopyText] = useState<string | null>(null);

  // 快速自检摘要（应用后显示在顶部）
  const [quickCheck, setQuickCheck] = useState<{ passed: boolean; passCount: number; total: number } | null>(null);

  // 自检弹窗
  const [selfCheckOpen, setSelfCheckOpen] = useState(false);
  const [selfCheckReport, setSelfCheckReport] = useState<SelfCheckReport | null>(null);
  const [selfCheckLoading, setSelfCheckLoading] = useState(false);

  // 历史弹窗
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ConfigHistoryEntry[]>([]);

  // 自定义方案保存弹窗
  const [customNameOpen, setCustomNameOpen] = useState(false);
  const [customPlanName, setCustomPlanName] = useState('');

  // 首次加载
  useEffect(() => {
    getAllPlans().then(plans => {
      setAllPlans(plans);
      setActiveId(detectActivePresetId(plans));
    });
    loadConfigHistory().then(setHistory);
  }, []);

  // 开始应用方案（动画驱动）
  const handleApplyConfirmed = useCallback(async (preset: PricePlanPreset) => {
    setConfirmPreset(null);
    setCopyText(null);
    setApplyDone(false);

    const steps: Step[] = [
      { label: '备份当前配置到历史记录', status: 'running' },
      { label: '更新全局会员套餐价格', status: 'pending' },
      { label: '同步标签与诱导文案', status: 'pending' },
      { label: '重新计算代理成本（×折扣比例）', status: 'pending' },
      { label: '同步千帆 AI 知识库', status: 'pending' },
    ];
    setApplySteps([...steps]);
    setApplying(true);

    const tick = (delay: number) => new Promise(r => setTimeout(r, delay));

    await tick(350);
    steps[0] = { ...steps[0], status: 'done' };
    steps[1] = { ...steps[1], status: 'running' };
    setApplySteps([...steps]);

    await tick(280);
    steps[1] = { ...steps[1], status: 'done' };
    steps[2] = { ...steps[2], status: 'running' };
    setApplySteps([...steps]);

    await tick(250);
    steps[2] = { ...steps[2], status: 'done' };
    steps[3] = { ...steps[3], status: 'running' };
    setApplySteps([...steps]);

    await tick(250);
    steps[3] = { ...steps[3], status: 'done' };
    steps[4] = { ...steps[4], status: 'running' };
    setApplySteps([...steps]);

    const result = await applyPricePlan(preset);
    steps[4] = { ...steps[4], status: result.aiKnowledgeSynced ? 'done' : 'error' };
    setApplySteps([...steps]);

    if (result.aiKnowledgeCopyText) setCopyText(result.aiKnowledgeCopyText);
    if (result.configUpdated) setActiveId(preset.id);

    // 刷新历史 & 快速自检
    const newHistory = await loadConfigHistory();
    setHistory(newHistory);

    setSelfCheckLoading(true);
    setApplyDone(true);
    try {
      const report = await runSelfCheck(preset);
      setSelfCheckReport(report);
      setQuickCheck({ passed: report.allPassed, passCount: report.passCount, total: report.total });
    } finally {
      setSelfCheckLoading(false);
    }

    onApplied?.();
  }, [onApplied]);

  // 回滚
  const handleRollback = useCallback(async (entry: ConfigHistoryEntry) => {
    setHistoryOpen(false);
    const { ok, msg } = await rollbackToHistory(entry);
    if (ok) {
      const plans = await getAllPlans();
      setAllPlans(plans);
      setActiveId(detectActivePresetId(plans));
      setQuickCheck(null);
    } else {
      // 直接使用 quickCheck banner 展示回滚失败
      setQuickCheck({ passed: false, passCount: 0, total: 1 });
      console.warn(msg);
    }
    onApplied?.();
  }, [onApplied]);

  // 保存自定义方案
  const handleSaveCustomPlan = useCallback(async () => {
    if (!customPlanName.trim()) return;
    const cfg = getConfig();
    const custom: PricePlanPreset = {
      id: `custom_${Date.now()}`,
      name: customPlanName.trim(),
      description: `手动配置：3天¥${cfg.cost3Day} / 月¥${cfg.cost30Day} / 年¥${cfg.cost365Day}`,
      cost3Day: cfg.cost3Day, cost30Day: cfg.cost30Day,
      cost180Day: cfg.cost180Day, cost365Day: cfg.cost365Day,
      isCustom: true, createdAt: new Date().toISOString(),
      plans: [
        { title: '3天体验卡', days: 3, price: cfg.cost3Day, label: '', subTexts: [], isMost: false, enabled: parseFloat(cfg.cost3Day) > 0 },
        { title: '30天月卡', days: 30, price: cfg.cost30Day, label: '', subTexts: [], isMost: true, enabled: true },
        { title: '半年卡', days: 180, price: cfg.cost180Day, label: '', subTexts: [], isMost: false, enabled: parseFloat(cfg.cost180Day) > 0 },
        { title: '年卡', days: 365, price: cfg.cost365Day, label: '', subTexts: [], isMost: false, enabled: true },
      ],
    };
    await saveCustomPlan(custom);
    await saveManualConfig(customPlanName.trim());
    const plans = await getAllPlans();
    setAllPlans(plans);
    setActiveId(custom.id);
    setCustomNameOpen(false);
    setCustomPlanName('');
    const newHistory = await loadConfigHistory();
    setHistory(newHistory);
  }, [customPlanName]);

  const handleRunSelfCheck = useCallback(async () => {
    setSelfCheckOpen(true);
    setSelfCheckLoading(true);
    setSelfCheckReport(null);
    try {
      const report = await runSelfCheck();
      setSelfCheckReport(report);
      setQuickCheck({ passed: report.allPassed, passCount: report.passCount, total: report.total });
    } finally {
      setSelfCheckLoading(false);
    }
  }, []);

  const handleExportReport = useCallback(async () => {
    if (!selfCheckReport) return;
    const json = exportSelfCheckAsJSON(selfCheckReport);
    try {
      await Share.share({ title: '自检报告.json', message: json });
    } catch { /* ignore */ }
  }, [selfCheckReport]);

  const allPresets = allPlans; // 包含内置 + 自定义

  return (
    <View style={{ gap: 14 }}>
      {/* 标题 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: C.text, fontSize: 14, fontWeight: 'bold' }}>⚡ 快速切换价格方案</Text>
        <Pressable onPress={() => { loadConfigHistory().then(h => { setHistory(h); setHistoryOpen(true); }); }}>
          <Text style={{ color: C.accent, fontSize: 12 }}>历史记录 ›</Text>
        </Pressable>
      </View>

      {/* 快速自检摘要 Banner */}
      {quickCheck && (
        <Pressable
          cssInterop={false}
          onPress={() => selfCheckReport && setSelfCheckOpen(true)}
          style={({ pressed }) => ({
            flexDirection: 'row', alignItems: 'center', gap: 8,
            backgroundColor: quickCheck.passed ? C.success + '18' : C.error + '18',
            borderRadius: 10, padding: 10, borderWidth: 1,
            borderColor: quickCheck.passed ? C.success : C.error,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontSize: 16 }}>{quickCheck.passed ? '✅' : '⚠️'}</Text>
          <Text style={{ color: quickCheck.passed ? C.success : C.warning, fontSize: 12, flex: 1, fontWeight: '600' }}>
            自检 {quickCheck.passCount}/{quickCheck.total} 项通过{quickCheck.passed ? '，可以发布' : '，点击查看详情'}
          </Text>
          {selfCheckLoading && <ActivityIndicator size="small" color={C.accent} />}
        </Pressable>
      )}

      {/* 方案按钮横向滚动 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
        {allPresets.map(preset => {
          const isActive = activeId === preset.id;
          return (
            <Pressable
              key={preset.id}
              cssInterop={false}
              onPress={() => setConfirmPreset(preset)}
              style={({ pressed }) => ({
                backgroundColor: isActive ? '#1A3A80' : '#161A2A',
                borderRadius: 12, borderWidth: isActive ? 2 : 1,
                borderColor: isActive ? C.accent : C.border,
                padding: 10, marginHorizontal: 4, minWidth: 110, maxWidth: 140,
                alignItems: 'center', gap: 4,
                opacity: pressed ? 0.8 : 1,
              })}
            >
              {isActive && (
                <View style={{ position: 'absolute', top: -1, right: -1, backgroundColor: C.accent, borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 }}>
                  <Text style={{ color: '#fff', fontSize: 9, fontWeight: 'bold' }}>生效中</Text>
                </View>
              )}
              <Text style={{ color: isActive ? C.accent : C.text, fontSize: 12, fontWeight: 'bold', textAlign: 'center' }}>
                {preset.name}
              </Text>
              <Text style={{ color: C.muted, fontSize: 10, textAlign: 'center', lineHeight: 14 }}>
                {preset.description.length > 30 ? preset.description.slice(0, 28) + '…' : preset.description}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* 操作区 */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          cssInterop={false}
          onPress={handleRunSelfCheck}
          style={({ pressed }) => ({
            flex: 1, backgroundColor: '#161A2A', borderRadius: 10, paddingVertical: 10,
            alignItems: 'center', borderWidth: 1, borderColor: C.border,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ color: C.muted, fontSize: 12 }}>🔍 运行自检</Text>
        </Pressable>
        <Pressable
          cssInterop={false}
          onPress={() => { setCustomPlanName(''); setCustomNameOpen(true); }}
          style={({ pressed }) => ({
            flex: 1, backgroundColor: '#161A2A', borderRadius: 10, paddingVertical: 10,
            alignItems: 'center', borderWidth: 1, borderColor: C.border,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ color: C.muted, fontSize: 12 }}>📌 保存为自定义方案</Text>
        </Pressable>
      </View>

      {/* 无活跃方案提示 */}
      {!activeId && (
        <View style={{ backgroundColor: C.warning + '11', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: C.warning }}>
          <Text style={{ color: C.warning, fontSize: 11 }}>
            当前价格不匹配任何预设方案（已自定义）。可点击【保存为自定义方案】保存当前配置。
          </Text>
        </View>
      )}

      {/* ── 二次确认弹窗 ──────────────────────────────── */}
      <Modal visible={!!confirmPreset} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#111827', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>⚠️ 确认应用方案</Text>
            <Text style={{ color: C.muted, fontSize: 13, lineHeight: 22, marginBottom: 6 }}>
              <Text style={{ color: C.text, fontWeight: '600' }}>方案：</Text>{confirmPreset?.name}
            </Text>
            <Text style={{ color: C.muted, fontSize: 12, lineHeight: 20, marginBottom: 18 }}>
              应用该方案将覆盖当前设置（<Text style={{ color: C.warning }}>套餐名称、价格、标签文案、代理成本、AI知识库</Text>），当前配置将自动备份。若已自定义套餐名称，应用后将重置为方案默认名称。
            </Text>
            {/* 方案套餐预览 */}
            <View style={{ backgroundColor: '#0D1117', borderRadius: 10, padding: 12, marginBottom: 18 }}>
              {confirmPreset?.plans.filter(p => p.enabled).map((p, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
                  <Text style={{ color: C.muted, fontSize: 12 }}>{p.title}（{p.days}天）</Text>
                  <Text style={{ color: C.text, fontSize: 12, fontWeight: '600' }}>¥{p.price}</Text>
                </View>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                cssInterop={false}
                onPress={() => setConfirmPreset(null)}
                style={({ pressed }) => ({ flex: 1, backgroundColor: '#2A3140', borderRadius: 10, paddingVertical: 13, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ color: C.muted, fontWeight: '600' }}>取消</Text>
              </Pressable>
              <Pressable
                cssInterop={false}
                onPress={() => confirmPreset && handleApplyConfirmed(confirmPreset)}
                style={({ pressed }) => ({ flex: 1, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 13, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>确认应用</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 应用进度弹窗 */}
      <ProgressModal
        visible={applying}
        steps={applySteps}
        done={applyDone}
        copyText={copyText}
        onClose={() => { setApplying(false); setApplyDone(false); }}
      />

      {/* 自检报告弹窗 */}
      <SelfCheckModal
        visible={selfCheckOpen}
        report={selfCheckReport}
        loading={selfCheckLoading}
        onClose={() => setSelfCheckOpen(false)}
        onExport={handleExportReport}
      />

      {/* 历史记录弹窗 */}
      <HistoryModal
        visible={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onRollback={handleRollback}
      />

      {/* 自定义方案命名弹窗 */}
      <Modal visible={customNameOpen} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: '#111827', borderRadius: 20, padding: 24, borderWidth: 1, borderColor: C.border }}>
            <Text style={{ color: C.text, fontSize: 15, fontWeight: 'bold', marginBottom: 6 }}>📌 保存自定义方案</Text>
            <Text style={{ color: C.muted, fontSize: 12, marginBottom: 16 }}>
              当前手动编辑的价格将被保存为新方案，并显示在方案按钮区。
            </Text>
            <TextInput
              value={customPlanName}
              onChangeText={setCustomPlanName}
              placeholder="输入方案名称（如：促销方案）"
              placeholderTextColor={C.muted}
              style={{ backgroundColor: '#0D1117', color: C.text, fontSize: 14, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16 }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                cssInterop={false}
                onPress={() => setCustomNameOpen(false)}
                style={({ pressed }) => ({ flex: 1, backgroundColor: '#2A3140', borderRadius: 10, paddingVertical: 12, alignItems: 'center', opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={{ color: C.muted, fontWeight: '600' }}>取消</Text>
              </Pressable>
              <Pressable
                cssInterop={false}
                onPress={handleSaveCustomPlan}
                disabled={!customPlanName.trim()}
                style={({ pressed }) => ({ flex: 1, backgroundColor: C.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center', opacity: (!customPlanName.trim() || pressed) ? 0.6 : 1 })}
              >
                <Text style={{ color: '#fff', fontWeight: 'bold' }}>保存方案</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
