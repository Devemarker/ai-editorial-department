import { describe, it, expect } from 'vitest';
import { generateId } from '../lib/id.js';

describe('generateId', () => {
  describe('基本功能', () => {
    it('应生成带有指定前缀的 ID', () => {
      const id = generateId('task');
      expect(id.startsWith('task_')).toBe(true);
    });

    it('应生成带有默认前缀的 ID', () => {
      const id = generateId();
      expect(id.startsWith('id_')).toBe(true);
    });

    it('每次调用应生成不同的 ID', () => {
      const id1 = generateId('task');
      const id2 = generateId('task');
      expect(id1).not.toBe(id2);
    });

    it('应生成足够长度的 ID', () => {
      const id = generateId('task');
      // 格式: prefix_timestamp_random
      // 最小长度应该 > 10
      expect(id.length).toBeGreaterThan(10);
    });
  });

  describe('唯一性', () => {
    it('生成 100 个 ID 应该全部唯一', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateId('task'));
      }
      expect(ids.size).toBe(100);
    });

    it('不同前缀应生成不同的 ID', () => {
      const idTask = generateId('task');
      const idChapter = generateId('chapter');
      expect(idTask).not.toBe(idChapter);
    });
  });

  describe('格式验证', () => {
    it('ID 应包含下划线分隔符', () => {
      const id = generateId('test');
      expect(id).toContain('_');
    });

    it('ID 不应包含空格', () => {
      const id = generateId('task');
      expect(id).not.toContain(' ');
    });

    it('ID 应为纯字母数字组合', () => {
      const id = generateId('task');
      expect(id).toMatch(/^[a-z0-9_]+$/);
    });
  });

  describe('边界情况', () => {
    it('空字符串前缀应产生下划线开头的 ID', () => {
      const id = generateId('');
      // 空字符串前缀会直接产生 _timestamp_random
      expect(id.startsWith('_')).toBe(true);
    });

    it('特殊字符前缀应被正确处理', () => {
      const id = generateId('task-123');
      // ID 格式: prefix_timestamp_random，前缀包含的字符会保留
      expect(id).toMatch(/^[a-z0-9_-]+$/);
      expect(id.startsWith('task-123_')).toBe(true);
    });
  });
});
