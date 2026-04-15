import { config } from '../src/config/index.js';

// 测试配置（不设置 OPENAI_API_KEY 时跳过 LLM 测试）
export const skipLLM = !config.openaiApiKey;
