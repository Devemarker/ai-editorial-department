import OpenAI from 'openai';
import { config, validateLlmConfig } from '../config/index.js';
import type { LLMProvider, LLMOptions, LLMResponse } from './provider.js';

let openaiClient: OpenAI | null = null;

function getClient(): OpenAI {
  if (!openaiClient) {
    validateLlmConfig(); // 懒验证：首次使用时检查
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return openaiClient;
}

export class OpenAIProvider implements LLMProvider {
  async complete(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: config.openaiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP,
    });

    const message = response.choices[0]?.message;
    return {
      text: message?.content || '',
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const client = getClient();
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map((item) => item.embedding);
  }
}

export const llm = new OpenAIProvider();
