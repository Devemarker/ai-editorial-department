import { config, validateLlmConfig } from '../config/index.js';
import type { LLMProvider, LLMOptions, LLMResponse } from './provider.js';

interface MiniMaxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface MiniMaxChoice {
  finish_reason: string;
  index: number;
  message: {
    role: string;
    content: string;
  };
}

interface MiniMaxUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface MiniMaxResponse {
  id: string;
  choices: MiniMaxChoice[];
  usage: MiniMaxUsage;
  created: number;
}

export class MiniMaxProvider implements LLMProvider {
  private getHeaders(): Record<string, string> {
    return {
      'Authorization': `Bearer ${config.minimaxApiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private getEndpoint(): string {
    // MiniMax API endpoint
    return 'https://api.minimax.chat/v1/text/chatcompletion_v2';
  }

  async complete(
    prompt: string,
    options: LLMOptions = {}
  ): Promise<LLMResponse> {
    // 懒验证：首次使用时检查
    validateLlmConfig();

    const messages: MiniMaxMessage[] = [{ role: 'user', content: prompt }];

    const body = {
      model: config.minimaxModel || 'abab5.5-chat',
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 2048,
      top_p: options.topP,
    };

    try {
      const response = await fetch(this.getEndpoint(), {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MiniMax API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json() as MiniMaxResponse;

      const message = data.choices[0]?.message;
      return {
        text: message?.content || '',
        usage: data.usage
          ? {
              promptTokens: data.usage.prompt_tokens,
              completionTokens: data.usage.completion_tokens,
              totalTokens: data.usage.total_tokens,
            }
          : undefined,
      };
    } catch (err) {
      if (err instanceof Error && err.message.includes('MiniMax API error')) {
        throw err;
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[MiniMax] API 调用失败: ${errorMsg}`);
      throw new Error(`LLM completion failed: ${errorMsg}`);
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    // MiniMax embedding API endpoint
    const embedEndpoint = 'https://api.minimax.chat/v1/text/embeddings';

    validateLlmConfig();

    const body = {
      model: 'embo-01',
      input: texts,
    };

    try {
      const response = await fetch(embedEndpoint, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MiniMax Embed API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      interface EmbedData {
        data: Array<{ embedding: number[] }>;
      }
      const data = await response.json() as EmbedData;
      return data.data.map((item) => item.embedding);
    } catch (err) {
      if (err instanceof Error && err.message.includes('MiniMax Embed API error')) {
        throw err;
      }
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[MiniMax] Embed API 调用失败: ${errorMsg}`);
      throw new Error(`LLM embed failed: ${errorMsg}`);
    }
  }
}

export const minimax = new MiniMaxProvider();
