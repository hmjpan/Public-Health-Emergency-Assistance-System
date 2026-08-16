// LLM Provider — 多提供商抽象（零新依赖，使用 Node.js 内置 https）
// 支持：DashScope（通义千问）/ OpenAI 兼容接口
// 配置：LLM_PROVIDER, LLM_API_KEY, LLM_MODEL, LLM_BASE_URL
// 降级：API 不可用时返回模板化 fallback 文本（标记 llmUsed: false）
const https = require('https');
const http = require('http');

const DEFAULT_CONFIG = {
  provider: process.env.LLM_PROVIDER || 'dashscope',  // dashscope | openai
  apiKey: process.env.LLM_API_KEY || '',
  model: process.env.LLM_MODEL || 'qwen-turbo',
  baseUrl: process.env.LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
};

/**
 * 调用 LLM chat 接口
 * @param {Array} messages - [{role: 'system'|'user'|'assistant', content: string}]
 * @param {Object} options - { temperature, maxTokens, model }
 * @returns {Promise<{ok, content, usage, llmUsed, error?}>}
 */
async function chat(messages, options = {}) {
  const config = { ...DEFAULT_CONFIG };
  if (!config.apiKey) {
    return fallback(messages, '未配置 LLM_API_KEY，使用模板化回复');
  }

  const model = options.model || config.model;
  const body = JSON.stringify({
    model,
    messages,
    temperature: options.temperature || 0.3,
    max_tokens: options.maxTokens || 1024
  });

  let url;
  try {
    url = new URL(config.baseUrl + '/chat/completions');
  } catch (e) {
    return fallback(messages, `LLM 配置地址无效: ${e.message}`);
  }
  const isHttps = url.protocol === 'https:';
  const lib = isHttps ? https : http;

  return new Promise((resolve) => {
    const req = lib.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      timeout: 30000
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.choices && json.choices[0]) {
            resolve({
              ok: true,
              content: json.choices[0].message.content,
              usage: json.usage || {},
              llmUsed: true,
              model
            });
          } else if (json.error) {
            resolve(fallback(messages, `LLM 返回错误: ${json.error.message || JSON.stringify(json.error)}`));
          } else {
            resolve(fallback(messages, 'LLM 返回格式异常'));
          }
        } catch (e) {
          resolve(fallback(messages, `LLM 响应解析失败: ${e.message}`));
        }
      });
    });
    req.on('error', (e) => {
      resolve(fallback(messages, `LLM 请求失败: ${e.message}`));
    });
    req.on('timeout', () => {
      req.destroy();
      resolve(fallback(messages, 'LLM 请求超时'));
    });
    req.write(body);
    req.end();
  });
}

/**
 * 降级策略：LLM 不可用时返回模板化文本
 */
function fallback(messages, reason) {
  const lastMsg = messages[messages.length - 1] || {};
  const userContent = lastMsg.content || '';
  return {
    ok: true,
    content: `[模板回复] ${reason}。用户输入: ${userContent.slice(0, 100)}...`,
    usage: {},
    llmUsed: false,
    model: 'fallback',
    fallbackReason: reason
  };
}

/**
 * 检测 LLM 是否可用
 */
function isAvailable() {
  return !!DEFAULT_CONFIG.apiKey;
}

module.exports = { chat, fallback, isAvailable, DEFAULT_CONFIG };
