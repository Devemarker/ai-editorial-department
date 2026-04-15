import type { LLMOptions, LLMResponse } from '../types/index.js';

// LLM Provider 接口定义
export interface LLMProvider {
  complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  embed(texts: string[]): Promise<number[][]>;
}

export type { LLMOptions, LLMResponse };
