import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { join } from 'path';

// 加载环境变量
const envPath = join(process.cwd(), '.env');
if (existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else if (process.env.NODE_ENV !== 'production') {
  console.warn('[config] .env 文件未找到，使用环境变量或默认值');
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
  dbPath: process.env.DB_PATH || './data/ai-editorial.db',
  chromaPath: process.env.CHROMA_PATH || './data/chroma',
  // LLM Provider 选择
  llmProvider: (process.env.LLM_PROVIDER as 'openai' | 'minimax') || 'openai',
  // MiniMax 配置
  minimaxApiKey: process.env.MINIMAX_API_KEY || '',
  minimaxGroupId: process.env.MINIMAX_GROUP_ID || '',
  minimaxModel: process.env.MINIMAX_MODEL || 'abab5.5-chat',
  // LLM 默认配置
  llmTemperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
  llmMaxTokens: parseInt(process.env.LLM_MAX_TOKENS || '2048', 10),
};

// 懒验证：确保 LLM 配置存在（在使用时才检查）
export function validateLlmConfig(): void {
  const provider = config.llmProvider;

  if (provider === 'minimax') {
    if (!config.minimaxApiKey) {
      throw new Error('[config] MINIMAX_API_KEY 是必填的环境变量，请检查 .env 文件');
    }
    if (!config.minimaxGroupId) {
      throw new Error('[config] MINIMAX_GROUP_ID 是必填的环境变量，请检查 .env 文件');
    }
  } else {
    // OpenAI 是默认 provider
    if (!config.openaiApiKey) {
      throw new Error('[config] OPENAI_API_KEY 是必填的环境变量，请检查 .env 文件');
    }
  }
}
