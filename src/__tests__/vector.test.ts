import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  isChromaAvailable,
  setChromaUnavailable,
  searchWorldKnowledge,
  addWorldKnowledge,
} from '../vector/chroma.js';

// Mock the chromadb module
vi.mock('chromadb', () => ({
  ChromaClient: vi.fn(),
}));

describe('Chroma Module', () => {
  beforeEach(() => {
    // 重置 ChromaDB 可用状态
    setChromaUnavailable();
  });

  describe('isChromaAvailable', () => {
    it('初始状态应为 false（未连接）', () => {
      expect(isChromaAvailable()).toBe(false);
    });
  });

  describe('setChromaUnavailable', () => {
    it('应设置 ChromaDB 为不可用状态', () => {
      expect(isChromaAvailable()).toBe(false);
    });
  });

  describe('searchWorldKnowledge', () => {
    it('Chroma 不可用时应返回空结果', async () => {
      const result = await searchWorldKnowledge('测试查询', 5);

      expect(result.documents).toEqual([]);
      expect(result.metadatas).toEqual([]);
    });
  });

  describe('addWorldKnowledge', () => {
    it('Chroma 不可用时应提前返回', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      await addWorldKnowledge(
        ['测试文本'],
        [[0.1, 0.2]],
        [{ source: 'test' }]
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith('[ChromaDB] 未连接，跳过添加世界观知识');
      consoleWarnSpy.mockRestore();
    });
  });
});
