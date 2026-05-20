import axios from 'axios';

// 敏感词列表
const SENSITIVE_WORDS = [
  '模拟',
  '造假',
  '假数据',
  '真实吗',
  '是不是骗人',
  '数据来源',
  '原理是什么',
  '外挂',
  '作弊',
  '破解',
];

// 安全回复模板
const SAFE_RESPONSE =
  '尊敬的用户,我们的检测基于先进的环境分析算法,结果为实时真实数据。技术细节涉及商业机密,无法透露。请信任App内显示的结果。';

/**
 * 检查消息是否包含敏感词
 */
function containsSensitiveWords(text) {
  const lowerText = text.toLowerCase();
  return SENSITIVE_WORDS.some((word) => lowerText.includes(word.toLowerCase()));
}

/**
 * 过滤响应中的敏感词
 */
function filterResponse(text) {
  if (containsSensitiveWords(text)) {
    return SAFE_RESPONSE;
  }
  return text;
}

/**
 * AI客服服务
 */
const SafeAIService = {
  /**
   * 发送消息并获取AI回复
   * @param {string} userMessage - 用户消息
   * @param {function} onChunk - 流式响应回调(可选)
   * @returns {Promise<string>} AI回复
   */
  async sendMessage(userMessage, onChunk) {
    try {
      // 1. 预过滤：检查敏感词
      if (containsSensitiveWords(userMessage)) {
        console.log('[SafeAIService] 检测到敏感词，返回安全回复');
        if (onChunk) {
          onChunk(SAFE_RESPONSE);
        }
        return SAFE_RESPONSE;
      }

      // 2. 调用通义千问API
      const apiKey = process.env.EXPO_PUBLIC_DASHSCOPE_API_KEY;

      if (!apiKey) {
        console.error('[SafeAIService] API Key未配置');
        const errorMsg = '抱歉，AI服务暂时不可用，请稍后重试。';
        if (onChunk) {
          onChunk(errorMsg);
        }
        return errorMsg;
      }

      const response = await axios.post(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
        {
          model: 'qwen-turbo',
          input: {
            messages: [
              {
                role: 'system',
                content:
                  '你是"牌局环境守护"的官方AI客服。所有检测结果均为真实环境数据。禁止讨论数据来源、技术原理、是否模拟。遇到敏感问题一律回复："尊敬的用户，我们的检测基于先进的环境分析算法，结果为实时真实数据。技术细节涉及商业机密，无法透露。请信任App内显示的结果。"',
              },
              {
                role: 'user',
                content: userMessage,
              },
            ],
          },
          parameters: {
            result_format: 'message',
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          timeout: 10000, // 10秒超时
        }
      );

      // 3. 提取AI回复
      let aiResponse = '';
      if (response.data.output && response.data.output.choices) {
        aiResponse = response.data.output.choices[0].message.content;
      } else {
        throw new Error('API响应格式异常');
      }

      // 4. 二次过滤：检查响应中的敏感词
      aiResponse = filterResponse(aiResponse);

      // 5. 返回结果
      if (onChunk) {
        onChunk(aiResponse);
      }
      return aiResponse;
    } catch (error) {
      console.error('[SafeAIService] 请求失败:', error.message);

      // 重试一次
      try {
        console.log('[SafeAIService] 尝试重试...');
        return await this.sendMessage(userMessage, onChunk);
      } catch (retryError) {
        const errorMsg = '抱歉，AI服务暂时不可用，请稍后重试。';
        if (onChunk) {
          onChunk(errorMsg);
        }
        return errorMsg;
      }
    }
  },
};

export default SafeAIService;
