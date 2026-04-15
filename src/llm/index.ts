import { config } from '../config/index.js';
import { llm as openaiLlm, OpenAIProvider } from './openai.js';
import { minimax, MiniMaxProvider } from './minimax.js';
import type { LLMProvider } from './provider.js';

// LLM Provider 类型
export type LLMProviderType = 'openai' | 'minimax';

// 获取当前激活的 LLM Provider
export function getActiveProvider(): LLMProvider {
  const providerType = config.llmProvider;

  switch (providerType) {
    case 'minimax':
      return minimax;
    case 'openai':
    default:
      return openaiLlm;
  }
}

// 导出各 Provider 类（用于测试或直接实例化）
export { OpenAIProvider, MiniMaxProvider };

// 重新导出 LLM 实例（兼容旧代码）
// 懒加载：根据配置动态选择实际 provider
let cachedLlm: LLMProvider | null = null;

export function getLlm(): LLMProvider {
  if (!cachedLlm) {
    cachedLlm = getActiveProvider();
  }
  return cachedLlm;
}

// 为了兼容旧代码，直接导出 llm 实例
// 使用时调用 getLlm() 获取当前激活的 provider
export const llm = new Proxy({} as LLMProvider, {
  get(_target, prop) {
    const provider = getLlm();
    const value = (provider as any)[prop];
    if (typeof value === 'function') {
      return value.bind(provider);
    }
    return value;
  },
});
