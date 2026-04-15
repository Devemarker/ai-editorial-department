import { describe, it, expect, beforeAll } from 'vitest';
import { config } from '../config/index.js';

describe('配置模块', () => {
  it('应有默认端口', () => {
    expect(config.port).toBe(3000);
  });

  it('应有数据库路径', () => {
    expect(config.dbPath).toBeDefined();
    expect(config.dbPath.length).toBeGreaterThan(0);
  });

  it('应有 ChromaDB 路径', () => {
    expect(config.chromaPath).toBeDefined();
    expect(config.chromaPath.length).toBeGreaterThan(0);
  });

  it('应有 OpenAI 模型', () => {
    expect(config.openaiModel).toBeDefined();
    expect(config.openaiModel.length).toBeGreaterThan(0);
  });

  it('OPENAI_API_KEY 应该有值（测试环境应设置）', () => {
    // 注意：这个测试会在没有 API key 时跳过（懒验证）
    // 实际验证在使用 LLM 时进行
    if (!config.openaiApiKey) {
      console.warn('[config test] OPENAI_API_KEY 未设置，跳过此测试');
    }
    expect(config.openaiApiKey).toBeDefined();
  });
});
