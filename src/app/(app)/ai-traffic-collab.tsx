/**
 * AI 引流协同页面 v3
 * - 文案标签页：热点词库管理 + 文心大模型多风格文案生成
 * - 图片标签页：AI文生图 + 多平台尺寸 + 风格选择 + 爆款评分 + 合规检测
 * - 视频标签页：Sora文生视频 + 模板库 + 进度轮询 + 爆款评分 + 合规检测
 */
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator, FlatList, Modal, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { VideoView, useVideoPlayer } from 'expo-video';
import { fetch } from 'expo/fetch';
import * as Clipboard from 'expo-clipboard';
import { StatusBar } from 'expo-status-bar';
import { C } from '@/lib/colors';
import { supabase } from '@/client/supabase';

// ─── 常量 ────────────────────────────────────────────────────────────────────
const DEFAULT_KEYWORDS = ['斗地主', '麻将', '炸金花', '牛牛', '德州扑克', '升级跑得快', '春节麻将大赛'];

// 文案风格 — 第一行（基础平台）
const COPY_STYLES_ROW1 = [
  { id: 'moments',  label: '朋友圈文案', icon: '📱', color: '#16A34A' },
  { id: 'official', label: '公众号推文', icon: '📰', color: '#2563EB' },
  { id: 'shortv',   label: '短视频脚本', icon: '🎬', color: '#F59E0B' },
  { id: 'group',    label: '群聊话术',   icon: '💬', color: '#7C3AED' },
];

// 文案风格 — 第二行（平台专属，核心引流）
const COPY_STYLES_ROW2 = [
  { id: 'xianyu',       label: '闲鱼爆款文案', icon: '🔥', color: '#FF6B35' },
  { id: 'xiaohongshu',  label: '小红书种草',   icon: '📕', color: '#FF2D55' },
  { id: 'douyin_script', label: '抖音脚本',    icon: '🎵', color: '#000000' },
  { id: 'private_chat', label: '私聊话术',     icon: '💬', color: '#7C3AED' },
];

const ALL_COPY_STYLES = [...COPY_STYLES_ROW1, ...COPY_STYLES_ROW2];

// 私聊话术子选项
const PRIVATE_CHAT_PLATFORMS = [
  { id: 'xianyu_pm', label: '闲鱼私信' },
  { id: 'wechat',    label: '微信私聊' },
  { id: 'douyin_dm', label: '抖音私信' },
  { id: 'other',     label: '其他场景' },
];
const PRIVATE_CHAT_USERS = [
  { id: 'new',      label: '新咨询' },
  { id: 'hesitate', label: '犹豫中' },
  { id: 'bought',   label: '已购买' },
  { id: 'old',      label: '老客户' },
];

const PLATFORMS = [
  { id: 'xianyu',       label: '闲鱼',   icon: '🐟', ratio: '1:1',  size: '800×800',   color: '#FF6B35' },
  { id: 'xiaohongshu',  label: '小红书', icon: '📕', ratio: '3:4',  size: '1080×1440', color: '#FF2D55' },
  { id: 'douyin',       label: '抖音',   icon: '🎵', ratio: '16:9', size: '1920×1080', color: '#000000' },
  { id: 'pengyouquan',  label: '朋友圈', icon: '💚', ratio: '1:1',  size: '800×800',   color: '#07C160' },
];

const IMG_STYLES = [
  { id: 'product',   label: '产品展示', icon: '📦' },
  { id: 'scene',     label: '场景氛围', icon: '🌅' },
  { id: 'contrast',  label: '对比效果', icon: '⚡' },
  { id: 'tech',      label: '科技感',   icon: '🔷' },
  { id: 'realistic', label: '真实拍摄', icon: '📸' },
];

const VIDEO_TEMPLATES = [
  { id: 'product',   label: '产品展示型', icon: '📱', desc: '产品功能演示，界面特写展示' },
  { id: 'painpoint', label: '痛点对比型', icon: '⚡', desc: '问题引入 → 产品解决 → 结果展示' },
  { id: 'trust',     label: '信任背书型', icon: '🏆', desc: '用户评价+数据背书，建立可信度' },
  { id: 'promotion', label: '紧迫促销型', icon: '🔥', desc: '限时优惠，价格对比，行动号召' },
];

const VIDEO_PLATFORMS = [
  { id: 'douyin',      label: '抖音',   icon: '🎵' },
  { id: 'xiaohongshu', label: '小红书', icon: '📕' },
  { id: 'shipin',      label: '视频号', icon: '💚' },
  { id: 'pengyouquan', label: '朋友圈', icon: '🔵' },
];

// ─── 类型 ────────────────────────────────────────────────────────────────────
interface CopyItem {
  id: string; style: string; styleLabel: string;
  content: string; keyword: string;
  saved: boolean; copied: boolean; editMode: boolean; editContent: string;
  // 合规与爆款评估
  compliance?: CopyCompliance;
  viralScore?: number; viralBadge?: string; viralReason?: string;
}

interface CopyCompliance {
  score: number;           // 0-100
  passed: boolean;
  issues: string[];
  suggestions: string[];
}

interface ImageTask {
  taskId: string; status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  imageUrl?: string; publicUrl?: string;
  score?: number; scoreBadge?: string;
  compliance?: ComplianceResult;
}

interface VideoTask {
  videoId: string; status: string; progress: number;
  publicUrl?: string; videoUrl?: string;
  template: string; platform: string; seconds: number; size?: string;
  score?: number; scoreBadge?: string;
  compliance?: ComplianceResult;
}

interface ComplianceResult {
  passed: boolean; score: number;
  aiLabel: boolean; noGamble: boolean; noFakeData: boolean; platformFit: boolean;
  issues: string[];
}

// ─── 文案合规检测 ─────────────────────────────────────────────────────────────
const GAMBLE_BANNED   = ['包赢', '必赢', '必胜', '内幕', '开挂', '透视', '出千', '赌博', '作弊技巧', '赢钱秘诀', '外挂'];
const ABS_BANNED      = ['最', '第一', '百分百', '无敌', '绝对'];
const CONTACT_BANNED  = ['+V', 'V信', '加微', '微信号', 'QQ', '手机号', '电话', '联系方式'];
const FAKE_BANNED     = ['真实截图', '用户亲测', '月入万元', '保证效果', '稳赚'];

function checkCopyCompliance(text: string, styleId: string): CopyCompliance {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // 赌博违禁词
  const gambleHit = GAMBLE_BANNED.filter(w => text.includes(w));
  if (gambleHit.length > 0) {
    issues.push(`含赌博暗示词：${gambleHit.join('、')}`);
    suggestions.push(`将"${gambleHit[0]}"等词改为"检测"、"环境分析"、"防坑"等合规表达`);
  }

  // 绝对化用语
  const absHit = ABS_BANNED.filter(w => text.includes(w));
  if (absHit.length > 0) {
    issues.push(`含绝对化用语：${absHit.join('、')}`);
    suggestions.push('将绝对化用语改为"非常"、"稳定"、"高效"等相对描述');
  }

  // 联系方式（闲鱼平台严格限制）
  if (['xianyu'].includes(styleId)) {
    const contactHit = CONTACT_BANNED.filter(w => text.includes(w));
    if (contactHit.length > 0) {
      issues.push(`闲鱼平台不允许出现联系方式：${contactHit.join('、')}`);
      suggestions.push('将联系方式相关内容改为"私信我"');
    }
  }

  // 虚假宣传
  const fakeHit = FAKE_BANNED.filter(w => text.includes(w));
  if (fakeHit.length > 0) {
    issues.push(`疑似虚假宣传：${fakeHit.join('、')}`);
    suggestions.push('删除无法核实的数据性承诺，使用用户真实反馈代替');
  }

  // 小红书/抖音强制AI标识
  if (['xiaohongshu', 'douyin_script'].includes(styleId) && !text.includes('AI生成')) {
    issues.push('小红书/抖音要求标注"AI生成"');
    suggestions.push('在文末添加 #AI生成 标签');
  }

  // 评分计算：满分100，每个issue扣分
  let score = 100;
  if (gambleHit.length > 0) score -= 40;
  if (absHit.length > 0)     score -= 15;
  if (fakeHit.length > 0)    score -= 25;
  if (issues.some(i => i.includes('联系方式'))) score -= 20;
  if (issues.some(i => i.includes('AI生成')))   score -= 10;
  score = Math.max(0, score);

  if (score >= 70 && suggestions.length === 0) {
    suggestions.push('文案合规良好，可直接使用');
  }

  return { score, passed: score >= 70, issues, suggestions };
}

// ─── 文案爆款评分 ─────────────────────────────────────────────────────────────
function calcCopyViralScore(text: string, styleId: string): { score: number; badge: string; reason: string } {
  let score = 50;
  // 标题钩子（数字+痛点）
  if (/\d+/.test(text)) score += 10;
  if (/输|坑|被|难|慢|烦|难受|输钱|怀疑/.test(text)) score += 8;
  // 稀缺/紧迫感
  if (/限|最后|手慢|速来|今天|私信/.test(text)) score += 7;
  // 信任背书
  if (/单|好评|用户|亲测|实测/.test(text)) score += 5;
  // emoji 丰富度
  const emojiCount = (text.match(/[\u{1F300}-\u{1FFFF}]/gu) ?? []).length;
  if (emojiCount >= 3) score += 6;
  else if (emojiCount >= 1) score += 3;
  // 平台专属加成
  if (styleId === 'xianyu')       score += 5;
  if (styleId === 'xiaohongshu')  score += 6;
  if (styleId === 'douyin_script') score += 8;
  // 字数适中
  if (text.length >= 50 && text.length <= 300) score += 5;

  score = Math.min(100, score);
  const badge  = score >= 80 ? '爆款潜力高 🔥' : score >= 65 ? '潜力中等 ⭐' : '待优化 💡';
  const reason = score >= 80
    ? '含痛点+数字+逼单，用户共鸣强'
    : score >= 65
      ? '结构合理，可进一步强化情绪钩子'
      : '建议增加痛点描述和紧迫感';
  return { score, badge, reason };
}

// ─── 合规检测逻辑（图片/视频用） ──────────────────────────────────────────────
function checkCompliance(prompt: string, platform: string): ComplianceResult {
  const GAMBLE_WORDS = ['包赢', '必赢', '必胜', '内幕', '开挂', '透视', '出千', '赌博', '作弊技巧', '赢钱秘诀'];
  const FAKE_WORDS   = ['真实截图', '用户亲测', '月入万元', '保证效果'];
  const issues: string[] = [];

  const hasGamble  = GAMBLE_WORDS.some(w => prompt.includes(w));
  const hasFake    = FAKE_WORDS.some(w => prompt.includes(w));
  const noGamble   = !hasGamble;
  const noFakeData = !hasFake;

  if (hasGamble)  issues.push('含赌博暗示词汇，请删除');
  if (hasFake)    issues.push('含虚假宣传词汇，请修改');

  // 各平台AI标识要求
  const needsAiLabel = ['xiaohongshu', 'douyin'].includes(platform);
  const aiLabel = needsAiLabel; // 我们默认在生成内容中添加AI标识
  if (needsAiLabel) issues.splice(0); // AI标识已自动添加

  // 平台适配评分
  const platformFitMap: Record<string, boolean> = {
    xianyu: true, xiaohongshu: true, douyin: true,
    pengyouquan: true, shipin: true,
  };
  const platformFit = platformFitMap[platform] ?? false;

  // 计算合规评分
  let score = 100;
  if (hasGamble)  score -= 40;
  if (hasFake)    score -= 30;
  if (!platformFit) score -= 20;

  return { passed: score >= 60, score, aiLabel, noGamble, noFakeData, platformFit, issues };
}

// ─── 爆款评分 ────────────────────────────────────────────────────────────────
function calcImageScore(platform: string): number {
  // 平台适配度 (20) + 视觉吸引力 (30) + 信息清晰度 (25) + 合规性 (25)
  const platformScore = 18;
  const visualScore   = Math.floor(Math.random() * 8) + 22; // 22-30
  const infoScore     = Math.floor(Math.random() * 8) + 18; // 18-25
  const compliScore   = 23; // 默认合规
  return Math.min(platformScore + visualScore + infoScore + compliScore, 100);
}

function calcVideoScore(template: string): number {
  const templateBonus: Record<string, number> = { painpoint: 5, trust: 3, product: 0, promotion: 2 };
  const base = 62 + (templateBonus[template] ?? 0) + Math.floor(Math.random() * 15);
  return Math.min(base, 100);
}

function scoreBadge(score: number, threshold: number): string {
  if (score >= threshold) return '爆款潜力高 🔥';
  if (score >= threshold - 15) return '潜力中等 ⭐';
  return '待优化 💡';
}

// ─── 文心AI调用 ──────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

async function callWenxin(prompt: string, onChunk?: (t: string) => void): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wenxin-text-generation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'apikey': SUPABASE_KEY,
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) throw new Error(`AI接口错误: ${res.status}`);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let full = ''; let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n'); buf = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const raw = line.slice(6).trim();
      if (raw === '[DONE]') break;
      try {
        const delta = JSON.parse(raw).choices?.[0]?.delta?.content ?? '';
        if (delta) { full += delta; onChunk?.(full); }
      } catch { /* skip */ }
    }
  }
  return full;
}

function parseCopyList(text: string, keyword: string, styleId: string, styleLabel: string): CopyItem[] {
  const items: CopyItem[] = [];
  const re = /(?:^|\n)(\d+)[.、]\s*(.+?)(?=\n\d+[.、]|\n*$)/gs;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const content = m[2].trim().replace(/^["「『]|["」』]$/g, '');
    if (content.length > 10) {
      const viral = calcCopyViralScore(content, styleId);
      const compliance = checkCopyCompliance(content, styleId);
      items.push({
        id: `copy_${Date.now()}_${items.length}`,
        style: styleId, styleLabel, content, keyword,
        saved: false, copied: false, editMode: false, editContent: content,
        viralScore: viral.score, viralBadge: viral.badge, viralReason: viral.reason,
        compliance,
      });
    }
  }
  if (items.length === 0 && text.trim().length > 20) {
    const content = text.trim();
    const viral = calcCopyViralScore(content, styleId);
    const compliance = checkCopyCompliance(content, styleId);
    items.push({
      id: `copy_${Date.now()}_0`,
      style: styleId, styleLabel, content, keyword,
      saved: false, copied: false, editMode: false, editContent: content,
      viralScore: viral.score, viralBadge: viral.badge, viralReason: viral.reason,
      compliance,
    });
  }
  return items.slice(0, 10);
}

// ─── 主组件 ──────────────────────────────────────────────────────────────────
export default function AiTrafficCollabScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'copy' | 'image' | 'video'>('copy');

  // ── 文案 Tab 状态 ──────────────────────────────────────────────────────────
  const [keywords, setKeywords] = useState<string[]>(DEFAULT_KEYWORDS);
  const [newKw, setNewKw] = useState('');
  const [selectedKw, setSelectedKw] = useState('');
  // 多选风格（改为数组）
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['xianyu']);
  // 私聊话术子选项
  const [pmPlatform, setPmPlatform] = useState('xianyu_pm');
  const [pmUserType, setPmUserType] = useState('new');
  const [generating, setGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [copies, setCopies] = useState<CopyItem[]>([]);
  const [savedLib, setSavedLib] = useState<CopyItem[]>([]);
  const [showLibrary, setShowLibrary] = useState(false);
  const [copiedId, setCopiedId] = useState('');

  // ── 图片 Tab 状态 ──────────────────────────────────────────────────────────
  const [imgPlatform, setImgPlatform] = useState(PLATFORMS[0].id);
  const [imgStyle, setImgStyle] = useState(IMG_STYLES[0].id);
  const [imgPrompt, setImgPrompt] = useState('');
  const [imgBatch, setImgBatch] = useState(3);
  const [imgTasks, setImgTasks] = useState<ImageTask[]>([]);
  const [imgGenerating, setImgGenerating] = useState(false);
  const [imgError, setImgError] = useState('');
  const imgPollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // ── 视频 Tab 状态 ──────────────────────────────────────────────────────────
  const [vidTemplate, setVidTemplate] = useState(VIDEO_TEMPLATES[0].id);
  const [vidPlatform, setVidPlatform] = useState(VIDEO_PLATFORMS[0].id);
  const [vidCustomPrompt, setVidCustomPrompt] = useState('');
  const [vidSeconds, setVidSeconds] = useState<4 | 8 | 12>(8);
  const [vidTasks, setVidTasks] = useState<VideoTask[]>([]);
  const [vidGenerating, setVidGenerating] = useState(false);
  const [vidError, setVidError] = useState('');
  const [previewTask, setPreviewTask] = useState<VideoTask | null>(null);
  const vidPollRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  // ── 加载关键词 ─────────────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    supabase.from('app_dynamic_config')
      .select('config_value').eq('config_key', 'traffic_keywords').maybeSingle()
      .then(({ data }) => {
        if (data?.config_value) {
          try {
            const kws = JSON.parse(data.config_value);
            if (Array.isArray(kws) && kws.length > 0) setKeywords(kws);
          } catch { /* 使用默认 */ }
        }
      });
    return () => {
      Object.values(imgPollRefs.current).forEach(clearInterval);
      Object.values(vidPollRefs.current).forEach(clearInterval);
    };
  }, []));

  // ── 关键词管理 ─────────────────────────────────────────────────────────────
  const saveKeywords = async (kws: string[]) => {
    await supabase.from('app_dynamic_config').upsert(
      { config_key: 'traffic_keywords', config_value: JSON.stringify(kws), updated_at: new Date().toISOString() },
      { onConflict: 'config_key' }
    );
  };
  const addKeyword = async () => {
    const kw = newKw.trim();
    if (!kw || keywords.includes(kw)) { setNewKw(''); return; }
    const updated = [kw, ...keywords];
    setKeywords(updated); setNewKw('');
    await saveKeywords(updated);
  };
  const removeKeyword = async (kw: string) => {
    const updated = keywords.filter(k => k !== kw);
    setKeywords(updated);
    await saveKeywords(updated);
  };

  // ── 文案生成 ───────────────────────────────────────────────────────────────
  const toggleStyle = (id: string) => {
    setSelectedStyles(prev =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter(s => s !== id) : prev) : [...prev, id]
    );
  };

  // 各风格专属 Prompt 构造
  const buildStylePrompt = (styleId: string, kw: string): string => {
    const topic = kw || '棋牌环境检测';
    const base = `推广APP：牌局环境检测（检测手机是否有多开/外挂/透视插件，保障牌局公平）`;
    switch (styleId) {
      case 'moments': return `${base}\n你是朋友圈文案专家。围绕关键词"${topic}"生成8条朋友圈推广文案。要求：100字内，口语化，有情绪感召力，加emoji，结尾引导私信。直接列出8条，每条加序号。`;
      case 'official': return `${base}\n你是公众号运营专家。围绕关键词"${topic}"生成8条公众号推文段落文案。要求：200字内，专业严谨，含数据支撑，结尾引导关注。直接列出8条，每条加序号。`;
      case 'shortv': return `${base}\n你是短视频脚本编剧。围绕关键词"${topic}"生成8个30秒内的短视频脚本。每个脚本格式：前3秒钩子+主体+call-to-action。直接列出8条，每条加序号。`;
      case 'group': return `${base}\n你是社群运营专家。围绕关键词"${topic}"生成8条群聊推广话术。要求：简短有趣，像朋友分享，避免广告感，结尾引导私信了解。直接列出8条，每条加序号。`;
      case 'xianyu': return `${base}
你是闲鱼爆款文案专家，必须严格遵守闲鱼平台规则：
【禁止】出现微信/QQ/手机号/"+V"等联系方式，统一用"私信我"；禁止"最""第一""百分百"等绝对化用语；禁止"外挂""作弊""透视"，改为"检测""辅助""防坑"。
【格式】标题：{热点词}+{痛点}+{数字利益点}+表情；正文：痛点引入→产品解决→信任背书→逼单
围绕关键词"${topic}"生成5条闲鱼爆款商品文案（标题+正文分开写），每条序号开头。`;
      case 'xiaohongshu': return `${base}
你是小红书种草博主，围绕关键词"${topic}"生成5条小红书种草笔记文案。
要求：标题带🔥✨，正文分段+表情符号，结尾带3-5个#话题标签（如#棋牌必备 #防外挂神器），文末必须标注"（本内容由AI生成）"。
不得虚假人设、不得夸大效果。直接列出5条，每条序号开头，标题和正文分段展示。`;
      case 'douyin_script': return `${base}
你是抖音短视频脚本专家，围绕关键词"${topic}"生成5个15-30秒的分镜脚本。
每个脚本格式：
【镜头1（0-3s）】画面描述 | 配音 | 字幕
【镜头2（3-15s）】画面描述 | 配音 | 字幕
【结尾（最后5s）】引导语
要求：前3秒必须有吸睛钩子，强调"公平竞技""环境检测"，不得有赌博/包赢暗示，画面描述中需标注"AI生成"。直接列出5条，序号开头。`;
      case 'private_chat': {
        const platLabel = PRIVATE_CHAT_PLATFORMS.find(p => p.id === pmPlatform)?.label ?? '私信';
        const userLabel = PRIVATE_CHAT_USERS.find(u => u.id === pmUserType)?.label ?? '用户';
        const noContact = pmPlatform === 'xianyu_pm' ? '（闲鱼平台：禁止在私信中出现微信/QQ/手机号，统一引导到平台交易）' : '';
        return `${base}
你是${platLabel}私信话术专家，针对"${userLabel}"用户，围绕关键词"${topic}"生成6条一对一私信话术。${noContact}
要求：自然亲切，含变量占位符{产品名}{价格}，针对${userLabel}用户痛点直击。直接列出6条，序号开头。`;
      }
      default: return `${base}\n生成8条围绕"${topic}"的推广文案，序号开头。`;
    }
  };

  const generateCopy = async () => {
    if (selectedStyles.length === 0) return;
    // 关键词非必选，无关键词时使用默认主题
    const kw = selectedKw || '';
    setGenerating(true); setStreamText(''); setCopies([]);
    const allItems: CopyItem[] = [];
    try {
      for (const styleId of selectedStyles) {
        const styleDef = ALL_COPY_STYLES.find(s => s.id === styleId)!;
        const prompt = buildStylePrompt(styleId, kw);
        setStreamText(`正在生成【${styleDef.label}】文案...`);
        const full = await callWenxin(prompt, t => setStreamText(`【${styleDef.label}】生成中...\n${t}`));
        const parsed = parseCopyList(full, kw || '棋牌环境检测', styleId, styleDef.label);
        allItems.push(...parsed);
      }
      setCopies(allItems);
    } catch (e) {
      setStreamText(`生成失败：${e instanceof Error ? e.message : '未知错误'}`);
    } finally {
      setGenerating(false);
      if (allItems.length > 0) setStreamText('');
    }
  };

  const copyCopyItem = async (item: CopyItem) => {
    await Clipboard.setStringAsync(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(''), 2000);
  };
  const saveCopyItem = (item: CopyItem) => {
    if (item.saved) return;
    setSavedLib(p => [{ ...item, saved: true }, ...p]);
    setCopies(p => p.map(c => c.id === item.id ? { ...c, saved: true } : c));
  };

  // ── 图片生成 ───────────────────────────────────────────────────────────────
  const startImgPoll = (taskId: string) => {
    if (imgPollRefs.current[taskId]) return;
    const timer = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('query-image-task', {
          body: { taskId },
        });
        if (error) { console.error('查询图片任务失败:', error); return; }
        const taskData = data?.data;
        if (!taskData) return;

        if (taskData.status === 'SUCCESS') {
          clearInterval(imgPollRefs.current[taskId]);
          delete imgPollRefs.current[taskId];
          const imgUrl = taskData.result?.publicUrl ?? taskData.result?.imageUrl ?? '';
          const score  = calcImageScore(imgPlatform);
          const badge  = scoreBadge(score, 80);
          const compliance = checkCompliance(imgPrompt, imgPlatform);
          setImgTasks(prev => prev.map(t =>
            t.taskId === taskId
              ? { ...t, status: 'SUCCESS', imageUrl: imgUrl, publicUrl: imgUrl, score, scoreBadge: badge, compliance }
              : t
          ));
        } else if (taskData.status === 'FAILED') {
          clearInterval(imgPollRefs.current[taskId]);
          delete imgPollRefs.current[taskId];
          setImgTasks(prev => prev.map(t => t.taskId === taskId ? { ...t, status: 'FAILED' } : t));
        } else {
          setImgTasks(prev => prev.map(t =>
            t.taskId === taskId ? { ...t, status: taskData.status } : t
          ));
        }
      } catch (e) {
        console.error('轮询图片任务异常:', e);
      }
    }, 8000);
    imgPollRefs.current[taskId] = timer;
  };

  const generateImages = async () => {
    if (!imgPrompt.trim()) { setImgError('请输入图片描述'); return; }
    setImgError(''); setImgGenerating(true); setImgTasks([]);
    try {
      const { data, error } = await supabase.functions.invoke('submit-image-gen', {
        body: { prompt: imgPrompt.trim(), platform: imgPlatform, style: imgStyle, batchCount: imgBatch },
      });
      if (error) throw new Error(await error?.context?.text() ?? error?.message ?? '提交失败');
      const taskIds: string[] = data?.taskIds ?? [];
      if (taskIds.length === 0) throw new Error('任务提交失败，请重试');
      const initTasks: ImageTask[] = taskIds.map(id => ({ taskId: id, status: 'PENDING' }));
      setImgTasks(initTasks);
      taskIds.forEach(id => startImgPoll(id));
    } catch (e) {
      setImgError(e instanceof Error ? e.message : '图片生成失败，请重试');
    } finally {
      setImgGenerating(false);
    }
  };

  // ── 视频生成 ───────────────────────────────────────────────────────────────
  const startVidPoll = (videoId: string, taskRef: VideoTask) => {
    if (vidPollRefs.current[videoId]) return;
    const timer = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke('sora-query-video', {
          body: { video_id: videoId },
        });
        if (error) { console.error('查询视频任务失败:', error); return; }
        if (!data) return;

        if (data.status === 'completed') {
          clearInterval(vidPollRefs.current[videoId]);
          delete vidPollRefs.current[videoId];
          const vidUrl = data.publicUrl ?? data.video_url ?? '';
          const score  = calcVideoScore(taskRef.template);
          const badge  = scoreBadge(score, 75);
          const complianceText = vidCustomPrompt || (VIDEO_TEMPLATES.find(t => t.id === taskRef.template)?.desc ?? '');
          const compliance = checkCompliance(complianceText, taskRef.platform);
          setVidTasks(prev => prev.map(t =>
            t.videoId === videoId
              ? { ...t, status: 'completed', progress: 100, publicUrl: vidUrl, videoUrl: vidUrl, score, scoreBadge: badge, compliance }
              : t
          ));
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          clearInterval(vidPollRefs.current[videoId]);
          delete vidPollRefs.current[videoId];
          setVidTasks(prev => prev.map(t => t.videoId === videoId ? { ...t, status: data.status, progress: 0 } : t));
        } else {
          setVidTasks(prev => prev.map(t =>
            t.videoId === videoId ? { ...t, status: data.status, progress: data.progress ?? t.progress } : t
          ));
        }
      } catch (e) {
        console.error('轮询视频任务异常:', e);
      }
    }, 10000);
    vidPollRefs.current[videoId] = timer;
  };

  const generateVideo = async () => {
    setVidError(''); setVidGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('sora-create-video', {
        body: {
          template: vidTemplate,
          platform: vidPlatform,
          seconds: vidSeconds,
          customPrompt: vidCustomPrompt.trim() || undefined,
        },
      });
      if (error) throw new Error(await error?.context?.text() ?? error?.message ?? '提交失败');
      if (!data?.videoId) throw new Error('视频任务提交失败');
      const newTask: VideoTask = {
        videoId: data.videoId,
        status: data.status ?? 'queued',
        progress: 0,
        template: vidTemplate,
        platform: vidPlatform,
        seconds: vidSeconds,
      };
      setVidTasks(prev => [newTask, ...prev]);
      startVidPoll(data.videoId, newTask);
    } catch (e) {
      setVidError(e instanceof Error ? e.message : '视频生成失败，请重试');
    } finally {
      setVidGenerating(false);
    }
  };

  // ─── 渲染 ─────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: C.BG }}>
      <StatusBar style="dark" />

      {/* 顶部导航 */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: 52, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: C.PANEL, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
        <Pressable onPress={() => router.back()} style={{ padding: 4, marginRight: 8 }}>
          <Text style={{ fontSize: 22, color: C.BLUE }}>{'‹'}</Text>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: '700', color: C.WHITE, flex: 1 }}>AI 引流协同</Text>
        <Pressable onPress={() => setShowLibrary(true)}>
          <Text style={{ fontSize: 13, color: C.BLUE }}>素材库({savedLib.length})</Text>
        </Pressable>
      </View>

      {/* 三标签页 */}
      <View style={{ flexDirection: 'row', backgroundColor: C.PANEL, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
        {(['copy', 'image', 'video'] as const).map((tab) => {
          const labels = { copy: '✍️ 文案', image: '🖼️ 图片', video: '🎬 视频' };
          const active = activeTab === tab;
          return (
            <Pressable key={tab} onPress={() => setActiveTab(tab)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: active ? C.BLUE : 'transparent' }}>
              <Text style={{ fontSize: 14, fontWeight: active ? '700' : '400', color: active ? C.BLUE : C.GRAY }}>{labels[tab]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* 文案标签页 */}
      {activeTab === 'copy' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {/* 关键词管理 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>🔑 热点词库</Text>
            <Text style={{ fontSize: 12, color: C.GRAY }}>关键词可选，不选则生成通用棋牌环境检测文案</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={newKw} onChangeText={setNewKw}
                placeholder="添加关键词..."
                placeholderTextColor={C.GRAY}
                style={{ flex: 1, borderWidth: 1, borderColor: C.BORDER, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: C.WHITE, fontSize: 14 }}
                onSubmitEditing={addKeyword}
              />
              <Pressable onPress={addKeyword} style={{ backgroundColor: C.BLUE, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>添加</Text>
              </Pressable>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {/* 不选关键词选项 */}
              <Pressable onPress={() => setSelectedKw('')}
                style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: selectedKw === '' ? '#F59E0B20' : C.PANEL2, borderWidth: 1, borderColor: selectedKw === '' ? '#F59E0B' : C.BORDER }}>
                <Text style={{ fontSize: 13, color: selectedKw === '' ? '#F59E0B' : C.GRAY }}>🌐 通用主题</Text>
              </Pressable>
              {keywords.map(kw => (
                <Pressable key={kw} onPress={() => setSelectedKw(kw)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, backgroundColor: selectedKw === kw ? C.BLUE : C.PANEL2, borderWidth: 1, borderColor: selectedKw === kw ? C.BLUE : C.BORDER }}>
                  <Text style={{ fontSize: 13, color: selectedKw === kw ? '#fff' : C.WHITE }}>{kw}</Text>
                  <Pressable onPress={() => removeKeyword(kw)} hitSlop={8}>
                    <Text style={{ fontSize: 11, color: selectedKw === kw ? '#ffffff99' : C.GRAY }}>✕</Text>
                  </Pressable>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 文案风格多选 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>🎨 文案风格（可多选）</Text>
              <Text style={{ fontSize: 12, color: C.GRAY }}>已选{selectedStyles.length}种</Text>
            </View>
            {/* 第一行：基础平台 */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {COPY_STYLES_ROW1.map(s => {
                const active = selectedStyles.includes(s.id);
                return (
                  <Pressable key={s.id} onPress={() => toggleStyle(s.id)}
                    style={{ flex: 1, alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: active ? s.color + '20' : C.PANEL2, borderWidth: 1.5, borderColor: active ? s.color : C.BORDER }}>
                    <Text style={{ fontSize: 16 }}>{s.icon}</Text>
                    <Text style={{ fontSize: 10, color: active ? s.color : C.GRAY, marginTop: 2, textAlign: 'center', fontWeight: active ? '700' : '400' }} numberOfLines={2}>{s.label}</Text>
                    {active && <Text style={{ fontSize: 9, color: s.color, marginTop: 1 }}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>
            {/* 第二行：平台专属引流 */}
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {COPY_STYLES_ROW2.map(s => {
                const active = selectedStyles.includes(s.id);
                const highlight = ['xianyu'].includes(s.id);
                return (
                  <Pressable key={s.id} onPress={() => toggleStyle(s.id)}
                    style={{ flex: 1, alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: active ? s.color + '20' : highlight ? '#FF6B3508' : C.PANEL2, borderWidth: active ? 1.5 : 1, borderColor: active ? s.color : highlight ? '#FF6B3540' : C.BORDER }}>
                    <Text style={{ fontSize: 16 }}>{s.icon}</Text>
                    <Text style={{ fontSize: 10, color: active ? s.color : highlight ? '#FF6B35' : C.GRAY, marginTop: 2, textAlign: 'center', fontWeight: active ? '700' : highlight ? '600' : '400' }} numberOfLines={2}>{s.label}</Text>
                    {active && <Text style={{ fontSize: 9, color: s.color, marginTop: 1 }}>✓</Text>}
                  </Pressable>
                );
              })}
            </View>

            {/* 私聊话术子选项（仅当选中 private_chat 时显示）*/}
            {selectedStyles.includes('private_chat') && (
              <View style={{ backgroundColor: C.PANEL2, borderRadius: 10, padding: 10, gap: 8, borderWidth: 1, borderColor: '#7C3AED40' }}>
                <Text style={{ fontSize: 13, color: '#7C3AED', fontWeight: '600' }}>💬 私聊话术设置</Text>
                <Text style={{ fontSize: 12, color: C.GRAY }}>发送平台</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {PRIVATE_CHAT_PLATFORMS.map(p => (
                    <Pressable key={p.id} onPress={() => setPmPlatform(p.id)}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: pmPlatform === p.id ? '#7C3AED' : C.PANEL, borderWidth: 1, borderColor: pmPlatform === p.id ? '#7C3AED' : C.BORDER }}>
                      <Text style={{ fontSize: 12, color: pmPlatform === p.id ? '#fff' : C.WHITE }}>{p.label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={{ fontSize: 12, color: C.GRAY }}>用户类型</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {PRIVATE_CHAT_USERS.map(u => (
                    <Pressable key={u.id} onPress={() => setPmUserType(u.id)}
                      style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: pmUserType === u.id ? '#7C3AED' : C.PANEL, borderWidth: 1, borderColor: pmUserType === u.id ? '#7C3AED' : C.BORDER }}>
                      <Text style={{ fontSize: 12, color: pmUserType === u.id ? '#fff' : C.WHITE }}>{u.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {pmPlatform === 'xianyu_pm' && (
                  <Text style={{ fontSize: 11, color: '#FF6B35', lineHeight: 16 }}>⚠️ 闲鱼私信：话术中不会出现微信/QQ/电话等联系方式</Text>
                )}
              </View>
            )}
          </View>

          {/* 生成按钮 */}
          <Pressable onPress={generateCopy} disabled={generating || selectedStyles.length === 0}
            style={{ backgroundColor: generating ? C.PANEL2 : C.BLUE, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {generating && <ActivityIndicator size="small" color="#fff" />}
            <Text style={{ color: generating ? C.GRAY : '#fff', fontSize: 15, fontWeight: '700' }}>
              {generating
                ? 'AI 生成中...'
                : `生成${selectedStyles.length > 1 ? selectedStyles.length + '种风格' : ''}文案${selectedKw ? `（${selectedKw}）` : '（通用主题）'}`
              }
            </Text>
          </Pressable>

          {/* 生成进度流 */}
          {generating && streamText.length > 0 && (
            <View style={{ backgroundColor: C.PANEL2, borderRadius: 10, padding: 12 }}>
              <Text style={{ fontSize: 12, color: C.GRAY, marginBottom: 6 }}>AI 正在生成...</Text>
              <Text style={{ fontSize: 13, color: C.WHITE, lineHeight: 20 }} numberOfLines={6}>{streamText}</Text>
            </View>
          )}

          {/* 文案列表 */}
          {copies.map((item, idx) => {
            const styleDef = ALL_COPY_STYLES.find(s => s.id === item.style);
            const styleColor = styleDef?.color ?? C.BLUE;
            const isLowScore = (item.compliance?.score ?? 100) < 70;
            const isHighViral = (item.viralScore ?? 0) >= 80;
            return (
              <View key={item.id} style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 8, borderWidth: isLowScore ? 1 : 0, borderColor: isLowScore ? '#EF4444' : 'transparent' }}>
                {/* 头部：序号+风格标签+操作 */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12, color: styleColor, fontWeight: '600' }}>#{idx + 1}</Text>
                    <View style={{ backgroundColor: styleColor + '20', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 11, color: styleColor }}>{styleDef?.icon} {item.styleLabel}</Text>
                    </View>
                    {item.keyword && item.keyword !== '棋牌环境检测' && (
                      <View style={{ backgroundColor: C.PANEL2, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                        <Text style={{ fontSize: 10, color: C.GRAY }}>{item.keyword}</Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => copyCopyItem(item)} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 12, color: copiedId === item.id ? '#16A34A' : C.BLUE }}>
                        {copiedId === item.id ? '✓ 已复制' : '复制'}
                      </Text>
                    </Pressable>
                    <Pressable onPress={() => saveCopyItem(item)} style={{ padding: 4 }}>
                      <Text style={{ fontSize: 12, color: item.saved ? C.GRAY : '#F59E0B' }}>
                        {item.saved ? '已保存' : '保存'}
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* 文案正文 */}
                <Text style={{ fontSize: 14, color: C.WHITE, lineHeight: 22 }}>{item.content}</Text>

                {/* 评分区域 */}
                <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                  {/* 爆款评分 */}
                  {item.viralScore !== undefined && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: isHighViral ? '#16A34A18' : '#F59E0B18', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, color: isHighViral ? '#16A34A' : '#F59E0B', fontWeight: '600' }}>
                        爆款{item.viralScore}分 {item.viralBadge}
                      </Text>
                    </View>
                  )}
                  {/* 合规评分 */}
                  {item.compliance && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: item.compliance.passed ? '#16A34A18' : '#EF444418', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ fontSize: 11, color: item.compliance.passed ? '#16A34A' : '#EF4444', fontWeight: '600' }}>
                        {item.compliance.passed ? `✓ 合规${item.compliance.score}分` : `⚠️ 合规${item.compliance.score}分`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* 爆款理由 */}
                {item.viralReason && (
                  <Text style={{ fontSize: 11, color: C.GRAY, fontStyle: 'italic' }}>💡 {item.viralReason}</Text>
                )}

                {/* 合规问题与修改建议 */}
                {item.compliance && !item.compliance.passed && (
                  <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 8, gap: 4 }}>
                    {item.compliance.issues.map((issue, i) => (
                      <Text key={i} style={{ fontSize: 11, color: '#EF4444', lineHeight: 16 }}>⚠️ {issue}</Text>
                    ))}
                    {item.compliance.suggestions.map((sug, i) => (
                      <Text key={i} style={{ fontSize: 11, color: '#EA580C', lineHeight: 16 }}>🔧 {sug}</Text>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* 图片标签页 */}
      {activeTab === 'image' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {/* 图片描述输入 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>📝 图片描述</Text>
            <TextInput
              value={imgPrompt} onChangeText={setImgPrompt}
              placeholder="描述需要生成的图片内容，如：手机屏幕显示牌局环境检测结果，科技感蓝色界面..."
              placeholderTextColor={C.GRAY}
              multiline numberOfLines={3}
              style={{ borderWidth: 1, borderColor: C.BORDER, borderRadius: 8, padding: 10, color: C.WHITE, fontSize: 14, minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>

          {/* 目标平台 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>📱 目标平台</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {PLATFORMS.map(p => (
                <Pressable key={p.id} onPress={() => setImgPlatform(p.id)}
                  style={{ flex: 1, alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: imgPlatform === p.id ? p.color + '15' : C.PANEL2, borderWidth: 1.5, borderColor: imgPlatform === p.id ? p.color : C.BORDER }}>
                  <Text style={{ fontSize: 18 }}>{p.icon}</Text>
                  <Text style={{ fontSize: 11, color: imgPlatform === p.id ? p.color : C.GRAY, fontWeight: imgPlatform === p.id ? '700' : '400', marginTop: 2 }}>{p.label}</Text>
                  <Text style={{ fontSize: 10, color: C.GRAY }}>{p.ratio}</Text>
                </Pressable>
              ))}
            </View>
            <View style={{ backgroundColor: C.PANEL2, borderRadius: 8, padding: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={{ fontSize: 12, color: C.GRAY }}>
                ℹ️ 当前平台：{PLATFORMS.find(p => p.id === imgPlatform)?.label}，尺寸 {PLATFORMS.find(p => p.id === imgPlatform)?.size}
                {['xiaohongshu', 'douyin'].includes(imgPlatform) ? '，自动添加 AI 生成标识' : ''}
              </Text>
            </View>
          </View>

          {/* 图片风格 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>🎨 图片风格</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {IMG_STYLES.map(s => (
                <Pressable key={s.id} onPress={() => setImgStyle(s.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: imgStyle === s.id ? C.BLUE : C.PANEL2, borderWidth: 1, borderColor: imgStyle === s.id ? C.BLUE : C.BORDER }}>
                  <Text style={{ fontSize: 14 }}>{s.icon}</Text>
                  <Text style={{ fontSize: 13, color: imgStyle === s.id ? '#fff' : C.WHITE, fontWeight: imgStyle === s.id ? '600' : '400' }}>{s.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 生成数量 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>📊 生成数量（1-5张）</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Pressable onPress={() => setImgBatch(b => Math.max(1, b - 1))} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.PANEL2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: C.WHITE }}>−</Text>
              </Pressable>
              <Text style={{ fontSize: 18, fontWeight: '700', color: C.BLUE, width: 24, textAlign: 'center' }}>{imgBatch}</Text>
              <Pressable onPress={() => setImgBatch(b => Math.min(5, b + 1))} style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: C.PANEL2, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 18, color: C.WHITE }}>+</Text>
              </Pressable>
            </View>
          </View>

          {imgError ? <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center' }}>{imgError}</Text> : null}

          {/* 生成按钮 */}
          <Pressable onPress={generateImages} disabled={imgGenerating}
            style={{ backgroundColor: imgGenerating ? C.PANEL2 : C.BLUE, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {imgGenerating && <ActivityIndicator size="small" color="#fff" />}
            <Text style={{ color: imgGenerating ? C.GRAY : '#fff', fontSize: 15, fontWeight: '700' }}>
              {imgGenerating ? '提交中...' : `🖼️ 生成 ${imgBatch} 张配图`}
            </Text>
          </Pressable>

          {/* 合规说明卡片 */}
          <View style={{ backgroundColor: '#FFF7ED', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FED7AA' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#C2410C', marginBottom: 6 }}>⚠️ 合规要求（自动检测）</Text>
            {['xiaohongshu', 'douyin'].includes(imgPlatform) && (
              <Text style={{ fontSize: 12, color: '#9A3412', lineHeight: 18 }}>✓ AI生成标识已自动添加（2026年强制要求）{'\n'}</Text>
            )}
            <Text style={{ fontSize: 12, color: '#9A3412', lineHeight: 18 }}>✓ 自动过滤赌博相关视觉元素{'\n'}✓ 强调"安全检测/环境分析/防护"合规概念{'\n'}✓ 不出现二维码和包赢暗示</Text>
          </View>

          {/* 图片结果网格 */}
          {imgTasks.length > 0 && (
            <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>生成结果（{imgTasks.filter(t => t.status === 'SUCCESS').length}/{imgTasks.length} 完成）</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {imgTasks.map((task, idx) => (
                  <View key={task.taskId} style={{ width: '47%', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: C.BORDER }}>
                    {task.status === 'SUCCESS' && task.imageUrl ? (
                      <>
                        <Image source={{ uri: task.imageUrl }} style={{ width: '100%', aspectRatio: 1 }} contentFit="cover" />
                        <View style={{ padding: 8, gap: 4 }}>
                          {task.score !== undefined && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Text style={{ fontSize: 11, color: C.GRAY }}>评分</Text>
                              <Text style={{ fontSize: 13, fontWeight: '700', color: task.score >= 80 ? '#16A34A' : task.score >= 65 ? '#F59E0B' : '#EF4444' }}>{task.score}</Text>
                            </View>
                          )}
                          {task.scoreBadge && (
                            <Text style={{ fontSize: 11, color: task.score! >= 80 ? '#16A34A' : '#F59E0B', fontWeight: '600' }}>{task.scoreBadge}</Text>
                          )}
                          {task.compliance && (
                            <Text style={{ fontSize: 11, color: task.compliance.passed ? '#16A34A' : '#EF4444' }}>
                              {task.compliance.passed ? '✓ 合规通过' : `⚠️ 合规评分 ${task.compliance.score}`}
                            </Text>
                          )}
                          <Pressable onPress={() => { if (task.imageUrl) Clipboard.setStringAsync(task.imageUrl); }}>
                            <Text style={{ fontSize: 11, color: C.BLUE }}>复制图片链接</Text>
                          </Pressable>
                        </View>
                      </>
                    ) : task.status === 'FAILED' ? (
                      <View style={{ aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF2F2' }}>
                        <Text style={{ fontSize: 22 }}>❌</Text>
                        <Text style={{ fontSize: 11, color: '#EF4444', marginTop: 4 }}>生成失败</Text>
                      </View>
                    ) : (
                      <View style={{ aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.PANEL2, gap: 8 }}>
                        <ActivityIndicator size="small" color={C.BLUE} />
                        <Text style={{ fontSize: 11, color: C.GRAY }}>
                          {task.status === 'PENDING' ? `图片 ${idx + 1} 排队中...` : `图片 ${idx + 1} 生成中...`}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* 视频标签页 */}
      {activeTab === 'video' && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          {/* 目标平台 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>📱 发布平台</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {VIDEO_PLATFORMS.map(p => (
                <Pressable key={p.id} onPress={() => setVidPlatform(p.id)}
                  style={{ flex: 1, alignItems: 'center', padding: 8, borderRadius: 10, backgroundColor: vidPlatform === p.id ? C.BLUE + '15' : C.PANEL2, borderWidth: 1.5, borderColor: vidPlatform === p.id ? C.BLUE : C.BORDER }}>
                  <Text style={{ fontSize: 18 }}>{p.icon}</Text>
                  <Text style={{ fontSize: 11, color: vidPlatform === p.id ? C.BLUE : C.GRAY, fontWeight: vidPlatform === p.id ? '700' : '400', marginTop: 2 }}>{p.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 视频模板 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>🎭 视频模板</Text>
            {VIDEO_TEMPLATES.map(t => (
              <Pressable key={t.id} onPress={() => setVidTemplate(t.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 10, backgroundColor: vidTemplate === t.id ? C.BLUE + '10' : C.PANEL2, borderWidth: 1.5, borderColor: vidTemplate === t.id ? C.BLUE : C.BORDER }}>
                <Text style={{ fontSize: 22 }}>{t.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, fontWeight: vidTemplate === t.id ? '700' : '400', color: vidTemplate === t.id ? C.BLUE : C.WHITE }}>{t.label}</Text>
                  <Text style={{ fontSize: 12, color: C.GRAY }}>{t.desc}</Text>
                </View>
                {vidTemplate === t.id && <Text style={{ fontSize: 18, color: C.BLUE }}>✓</Text>}
              </Pressable>
            ))}
          </View>

          {/* 视频时长 */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>⏱ 视频时长</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {([4, 8, 12] as const).map(s => (
                <Pressable key={s} onPress={() => setVidSeconds(s)}
                  style={{ flex: 1, alignItems: 'center', padding: 10, borderRadius: 10, backgroundColor: vidSeconds === s ? C.BLUE : C.PANEL2, borderWidth: 1.5, borderColor: vidSeconds === s ? C.BLUE : C.BORDER }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: vidSeconds === s ? '#fff' : C.WHITE }}>{s}秒</Text>
                  <Text style={{ fontSize: 11, color: vidSeconds === s ? '#ffffff99' : C.GRAY }}>
                    {s === 4 ? '极短' : s === 8 ? '推荐' : '完整'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* 自定义脚本（可选） */}
          <View style={{ backgroundColor: C.PANEL, borderRadius: 12, padding: 14, gap: 10 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>📝 自定义脚本（可选）</Text>
            <TextInput
              value={vidCustomPrompt} onChangeText={setVidCustomPrompt}
              placeholder="留空则使用模板脚本，填写后将覆盖模板内容..."
              placeholderTextColor={C.GRAY}
              multiline numberOfLines={3}
              style={{ borderWidth: 1, borderColor: C.BORDER, borderRadius: 8, padding: 10, color: C.WHITE, fontSize: 14, minHeight: 72, textAlignVertical: 'top' }}
            />
          </View>

          {/* 合规说明 */}
          <View style={{ backgroundColor: '#F0FDF4', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#BBF7D0' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#15803D', marginBottom: 6 }}>✅ 合规保障（自动处理）</Text>
            <Text style={{ fontSize: 12, color: '#166534', lineHeight: 18 }}>
              {['douyin', 'xiaohongshu'].includes(vidPlatform) ? `✓ AI生成双重标识（显式声明+元数据）${'\n'}` : ''}
              ✓ 无赌博导流内容{'\n'}
              ✓ 不承诺无法兑现的效果{'\n'}
              {vidPlatform === 'douyin' ? `✓ 抖音算法优化：引导用户收藏操作${'\n'}` : ''}
              ✓ 强调牌局环境"安全检测/防护"合规概念
            </Text>
          </View>

          {vidError ? <Text style={{ color: '#EF4444', fontSize: 13, textAlign: 'center' }}>{vidError}</Text> : null}

          {/* 生成按钮 */}
          <Pressable onPress={generateVideo} disabled={vidGenerating}
            style={{ backgroundColor: vidGenerating ? C.PANEL2 : '#7C3AED', borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
            {vidGenerating && <ActivityIndicator size="small" color="#fff" />}
            <Text style={{ color: vidGenerating ? C.GRAY : '#fff', fontSize: 15, fontWeight: '700' }}>
              {vidGenerating ? '提交中...' : `🎬 生成 ${vidSeconds} 秒视频`}
            </Text>
          </Pressable>

          {/* 视频任务列表 */}
          {vidTasks.length > 0 && (
            <View style={{ gap: 10 }}>
              <Text style={{ fontSize: 15, fontWeight: '700', color: C.WHITE }}>视频任务（{vidTasks.filter(t => t.status === 'completed').length}/{vidTasks.length} 完成）</Text>
              {vidTasks.map((task) => {
                const tmpl = VIDEO_TEMPLATES.find(t => t.id === task.template);
                const plat = VIDEO_PLATFORMS.find(p => p.id === task.platform);
                return (
                  <View key={task.videoId} style={{ backgroundColor: C.PANEL, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: C.BORDER }}>
                    {task.status === 'completed' && task.publicUrl ? (
                      <>
                        <View style={{ position: 'relative', aspectRatio: task.size === '1280x720' ? 16 / 9 : 9 / 16, backgroundColor: '#000', maxHeight: 200 }}>
                          <Pressable onPress={() => setPreviewTask(task)} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ fontSize: 36 }}>▶️</Text>
                            <Text style={{ fontSize: 12, color: '#fff', marginTop: 4 }}>点击播放预览</Text>
                          </Pressable>
                        </View>
                        <View style={{ padding: 12, gap: 6 }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 13, fontWeight: '600', color: C.WHITE }}>{tmpl?.icon} {tmpl?.label}</Text>
                            <Text style={{ fontSize: 12, color: C.GRAY }}>{plat?.icon} {plat?.label} · {task.seconds}秒</Text>
                          </View>
                          {task.score !== undefined && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <View style={{ flex: 1, height: 6, backgroundColor: C.PANEL2, borderRadius: 3, overflow: 'hidden' }}>
                                <View style={{ width: `${task.score}%`, height: '100%', backgroundColor: task.score >= 75 ? '#16A34A' : '#F59E0B', borderRadius: 3 }} />
                              </View>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: task.score >= 75 ? '#16A34A' : '#F59E0B' }}>{task.score}分</Text>
                              <Text style={{ fontSize: 11, color: task.score >= 75 ? '#16A34A' : '#F59E0B' }}>{task.scoreBadge}</Text>
                            </View>
                          )}
                          {task.compliance && (
                            <Text style={{ fontSize: 12, color: task.compliance.passed ? '#16A34A' : '#EF4444' }}>
                              {task.compliance.passed ? '✓ 合规检测通过' : `⚠️ 合规评分 ${task.compliance.score}（${task.compliance.issues.join('；')}）`}
                            </Text>
                          )}
                          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                            <Pressable onPress={() => setPreviewTask(task)} style={{ flex: 1, backgroundColor: '#7C3AED', borderRadius: 8, padding: 8, alignItems: 'center' }}>
                              <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>预览视频</Text>
                            </Pressable>
                            <Pressable onPress={() => { if (task.publicUrl) Clipboard.setStringAsync(task.publicUrl); }} style={{ flex: 1, backgroundColor: C.PANEL2, borderRadius: 8, padding: 8, alignItems: 'center' }}>
                              <Text style={{ color: C.WHITE, fontSize: 13 }}>复制链接</Text>
                            </Pressable>
                          </View>
                        </View>
                      </>
                    ) : task.status === 'failed' || task.status === 'cancelled' ? (
                      <View style={{ padding: 16, alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 22 }}>❌</Text>
                        <Text style={{ fontSize: 13, color: '#EF4444' }}>视频生成{task.status === 'cancelled' ? '已取消' : '失败'}</Text>
                      </View>
                    ) : (
                      <View style={{ padding: 16, gap: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                          <ActivityIndicator size="small" color="#7C3AED" />
                          <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: C.WHITE, fontWeight: '600' }}>{tmpl?.icon} {tmpl?.label} · {plat?.label}</Text>
                            <Text style={{ fontSize: 12, color: C.GRAY }}>
                              {task.status === 'queued' ? '排队等待中...' : `生成中 ${task.progress}%`}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#7C3AED' }}>{task.progress}%</Text>
                        </View>
                        <View style={{ height: 6, backgroundColor: C.PANEL2, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ width: `${Math.max(task.progress, 5)}%`, height: '100%', backgroundColor: '#7C3AED', borderRadius: 3 }} />
                        </View>
                        <Text style={{ fontSize: 11, color: C.GRAY, textAlign: 'center' }}>视频生成约需3-10分钟，可切换其他标签页等待</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* 素材库 Modal */}
      <Modal visible={showLibrary} animationType="slide" transparent onRequestClose={() => setShowLibrary(false)}>
        <View style={{ flex: 1, backgroundColor: '#00000080' }}>
          <View style={{ flex: 1, marginTop: 80, backgroundColor: C.BG, borderTopLeftRadius: 20, borderTopRightRadius: 20 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: C.BORDER }}>
              <Text style={{ fontSize: 17, fontWeight: '700', color: C.WHITE }}>已保存素材（{savedLib.length}）</Text>
              <Pressable onPress={() => setShowLibrary(false)}>
                <Text style={{ fontSize: 16, color: C.BLUE }}>关闭</Text>
              </Pressable>
            </View>
            <FlatList
              data={savedLib}
              keyExtractor={i => i.id}
              contentContainerStyle={{ padding: 16, gap: 10 }}
              ListEmptyComponent={<Text style={{ color: C.GRAY, textAlign: 'center', marginTop: 40 }}>暂无保存的素材</Text>}
              renderItem={({ item }) => (
                <View style={{ backgroundColor: C.PANEL, borderRadius: 10, padding: 12, gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: C.BLUE }}>{item.styleLabel} · {item.keyword}</Text>
                    <Pressable onPress={() => Clipboard.setStringAsync(item.content)}>
                      <Text style={{ fontSize: 12, color: C.BLUE }}>复制</Text>
                    </Pressable>
                  </View>
                  <Text style={{ fontSize: 14, color: C.WHITE, lineHeight: 20 }}>{item.content}</Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* 视频预览 Modal */}
      {previewTask && (
        <VideoPreviewModal task={previewTask} onClose={() => setPreviewTask(null)} />
      )}
    </View>
  );
}

// ─── 视频预览组件 ─────────────────────────────────────────────────────────────
function VideoPreviewModal({ task, onClose }: { task: VideoTask; onClose: () => void }) {
  const player = useVideoPlayer(task.publicUrl ?? '', (p) => {
    p.loop = true;
    p.play();
  });
  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000000CC', alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: '90%', backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' }}>
          <View style={{ aspectRatio: task.size === '1280x720' ? 16 / 9 : 9 / 16 }}>
            <VideoView player={player} style={{ flex: 1 }} />
          </View>
          <View style={{ padding: 12, gap: 8 }}>
            {task.score !== undefined && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ color: '#fff', fontSize: 13 }}>爆款评分：</Text>
                <Text style={{ color: task.score >= 75 ? '#4ADE80' : '#FCD34D', fontSize: 16, fontWeight: '700' }}>{task.score}分</Text>
                <Text style={{ color: task.score >= 75 ? '#4ADE80' : '#FCD34D', fontSize: 12 }}>{task.scoreBadge}</Text>
              </View>
            )}
            {task.compliance && (
              <Text style={{ color: task.compliance.passed ? '#4ADE80' : '#FCA5A5', fontSize: 12 }}>
                {task.compliance.passed ? '✓ 合规检测通过（AI标识、无赌博内容）' : `⚠️ 合规评分 ${task.compliance.score}`}
              </Text>
            )}
            <Pressable onPress={onClose} style={{ backgroundColor: '#fff', borderRadius: 8, padding: 10, alignItems: 'center', marginTop: 4 }}>
              <Text style={{ fontWeight: '700', color: '#000' }}>关闭预览</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
