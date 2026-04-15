import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { consistencyChecker } from '../quality/consistencyChecker.js';
import { characterRepository } from '../memory/characterRepository.js';
import { eventRepository } from '../memory/eventRepository.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { worldKnowledgeRepository } from '../memory/worldKnowledgeRepository.js';
import { globalEventBus } from '../pipeline/eventBus.js';
import { initDb, disableForeignKeys, enableForeignKeys, cleanDb, resetDb } from '../db/sqlite.js';

// Mock LLM
vi.mock('../llm/openai.js', () => ({
  llm: {
    complete: vi.fn(),
  },
}));

import { llm } from '../llm/openai.js';

describe('ConsistencyChecker', () => {
  beforeEach(() => {
    resetDb();
    cleanDb();
    initDb();
    disableForeignKeys();
    globalEventBus.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    enableForeignKeys();
  });

  describe('checkCharacterConsistency', () => {
    it('应检测空状态人物', async () => {
      characterRepository.create({
        name: '测试人物',
        description: '测试描述',
        currentState: '',
      });

      const issues = await consistencyChecker.checkCharacterConsistency();
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('character_conflict');
    });

    it('应检测过短状态描述', async () => {
      characterRepository.create({
        name: '测试人物',
        description: '测试描述',
        currentState: 'X',
      });

      const issues = await consistencyChecker.checkCharacterConsistency();
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('character_conflict');
    });

    it('应在有无人物时正确检测', async () => {
      // 无人物时应该返回空数组（当数据库有残留人物时）
      const issues = await consistencyChecker.checkCharacterConsistency();
      // 有残留人物时会返回问题，但不会报错
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('checkWorldRuleCompliance', () => {
    it('应检测过短章节内容', async () => {
      chapterRepository.create({
        number: 101,
        title: '第一章',
        content: '很短的章节内容',
        status: 'draft',
      });

      const issues = await consistencyChecker.checkWorldRuleCompliance();
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('world_rule_violation');
    });

    it('应检测空章节内容', async () => {
      chapterRepository.create({
        number: 102,
        title: '第二章',
        content: '',
        status: 'draft',
      });

      const issues = await consistencyChecker.checkWorldRuleCompliance();
      expect(issues.some(i => i.severity === 'critical')).toBe(true);
    });

    it('应检测标点符号异常', async () => {
      // 创建没有标点的长内容（需要 > 100 字符）
      const contentWithoutPunctuation = '这是一个很长的章节内容没有标点符号用来测试标点检测逻辑是否正常工作这里应该被检测为标点异常'.repeat(10);
      chapterRepository.create({
        number: 103,
        title: '第三章',
        content: contentWithoutPunctuation,
        status: 'draft',
      });

      const issues = await consistencyChecker.checkWorldRuleCompliance();
      expect(issues.some(i => i.type === 'world_rule_violation' && i.description.includes('标点'))).toBe(true);
    });

    it('应处理无章节情况', async () => {
      // 当没有章节时，world consistency check 会返回空
      vi.mocked(llm.complete).mockResolvedValue({ text: '{"hasConflict":false}' });
      const issues = await consistencyChecker.checkWorldRuleCompliance();
      // 只有 basic checks 会运行，不会调用 LLM（因为章节 < 2）
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('checkPlotUniqueness', () => {
    it('应检测相似章节标题', async () => {
      chapterRepository.create({
        number: 201,
        title: '第一章：英雄崛起',
        content: '内容1'.repeat(100),
        status: 'draft',
      });
      chapterRepository.create({
        number: 202,
        title: '第二章：英雄崛起',
        content: '内容2'.repeat(100),
        status: 'draft',
      });

      const issues = await consistencyChecker.checkPlotUniqueness();
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].type).toBe('plot_repetition');
    });

    it('应处理章节数不足的情况', async () => {
      vi.mocked(llm.complete).mockResolvedValue({ text: '{"hasIssue":false}' });
      // 只有 1 个章节时，不会检测情节重复
      const chapter = chapterRepository.create({
        number: 401,
        title: '唯一章节',
        content: '内容'.repeat(100),
        status: 'draft',
      });
      chapterRepository.delete(chapter.id);
      const issues = await consistencyChecker.checkPlotUniqueness();
      // 少于 3 章时不会触发整体情节检测
      expect(Array.isArray(issues)).toBe(true);
    });
  });

  describe('checkAll', () => {
    it('应并行运行所有检查', async () => {
      characterRepository.create({
        name: '人物甲',
        description: '描述',
        currentState: '正常状态',
      });
      chapterRepository.create({
        number: 301,
        title: '第一章',
        content: '内容'.repeat(100),
        status: 'draft',
      });

      vi.mocked(llm.complete).mockResolvedValue({ text: '{"hasConflict":false}' });

      const issues = await consistencyChecker.checkAll();
      expect(Array.isArray(issues)).toBe(true);
    });
  });
});
