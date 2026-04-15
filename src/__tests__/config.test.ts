import { describe, it, expect, vi, beforeEach } from 'vitest';
import { config, validateLlmConfig } from '../config/index.js';

describe('配置模块', () => {
  describe('基本配置', () => {
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

    it('应有 LLM temperature 配置', () => {
      expect(config.llmTemperature).toBeGreaterThan(0);
      expect(config.llmTemperature).toBeLessThanOrEqual(2);
    });

    it('应有 LLM maxTokens 配置', () => {
      expect(config.llmMaxTokens).toBeGreaterThan(0);
      expect(config.llmMaxTokens).toBeLessThanOrEqual(100000);
    });
  });

  describe('validateLlmConfig', () => {
    it('OPENAI_API_KEY 为空时应抛出错误', () => {
      // 保存原始值
      const originalKey = config.openaiApiKey;
      config.openaiApiKey = '';

      expect(() => validateLlmConfig()).toThrow('[config] OPENAI_API_KEY 是必填的环境变量');

      // 恢复原始值
      config.openaiApiKey = originalKey;
    });

    it('OPENAI_API_KEY 有值时不应抛出错误', () => {
      // 如果有 API key，应该通过验证
      if (config.openaiApiKey) {
        expect(() => validateLlmConfig()).not.toThrow();
      }
    });
  });
});
