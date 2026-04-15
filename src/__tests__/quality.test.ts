import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fixStrategy } from '../quality/fixStrategy.js';
import { reportGenerator } from '../quality/reportGenerator.js';
import { initDb, disableForeignKeys, enableForeignKeys, cleanDb, resetDb } from '../db/sqlite.js';
import type { QualityIssue } from '../types/index.js';

describe('FixStrategy', () => {
  beforeEach(() => {
    cleanDb();
    initDb();
    disableForeignKeys();
    resetDb();
  });

  afterEach(() => {
    enableForeignKeys();
  });

  describe('selectStrategy', () => {
    it('应为 critical 级别人物冲突选择 rebuild', () => {
      const issue: QualityIssue = {
        id: 'test_1',
        type: 'character_conflict',
        severity: 'critical',
        description: '人物状态矛盾',
        createdAt: Date.now(),
      };
      expect(fixStrategy.selectStrategy(issue)).toBe('rebuild');
    });

    it('应为 major 级别人物冲突选择 retry', () => {
      const issue: QualityIssue = {
        id: 'test_2',
        type: 'character_conflict',
        severity: 'major',
        description: '人物状态可能矛盾',
        createdAt: Date.now(),
      };
      expect(fixStrategy.selectStrategy(issue)).toBe('retry');
    });

    it('应为 minor 级别人物冲突选择 retry', () => {
      const issue: QualityIssue = {
        id: 'test_3',
        type: 'character_conflict',
        severity: 'minor',
        description: '人物状态轻微问题',
        createdAt: Date.now(),
      };
      expect(fixStrategy.selectStrategy(issue)).toBe('retry');
    });

    it('应为 critical 级别世界观违规选择 rebuild', () => {
      const issue: QualityIssue = {
        id: 'test_4',
        type: 'world_rule_violation',
        severity: 'critical',
        description: '严重违反世界观规则',
        createdAt: Date.now(),
      };
      expect(fixStrategy.selectStrategy(issue)).toBe('rebuild');
    });

    it('应为 minor 级别世界观违规选择 ignore', () => {
      const issue: QualityIssue = {
        id: 'test_5',
        type: 'world_rule_violation',
        severity: 'minor',
        description: '轻微违反世界观',
        createdAt: Date.now(),
      };
      expect(fixStrategy.selectStrategy(issue)).toBe('ignore');
    });

    it('应为情节重复选择 rebuild', () => {
      const issue: QualityIssue = {
        id: 'test_6',
        type: 'plot_repetition',
        severity: 'major',
        description: '情节重复',
        createdAt: Date.now(),
      };
      expect(fixStrategy.selectStrategy(issue)).toBe('rebuild');
    });
  });

  describe('generateSuggestion', () => {
    it('应为人物冲突生成正确的建议', () => {
      const issue: QualityIssue = {
        id: 'test_1',
        type: 'character_conflict',
        severity: 'major',
        description: '测试',
        createdAt: Date.now(),
      };
      const suggestion = fixStrategy.generateSuggestion(issue);
      expect(suggestion).toContain('人物状态');
    });

    it('应为世界观违规生成正确的建议', () => {
      const issue: QualityIssue = {
        id: 'test_2',
        type: 'world_rule_violation',
        severity: 'major',
        description: '测试',
        createdAt: Date.now(),
      };
      const suggestion = fixStrategy.generateSuggestion(issue);
      expect(suggestion).toContain('世界观');
    });

    it('应为情节重复生成正确的建议', () => {
      const issue: QualityIssue = {
        id: 'test_3',
        type: 'plot_repetition',
        severity: 'major',
        description: '测试',
        createdAt: Date.now(),
      };
      const suggestion = fixStrategy.generateSuggestion(issue);
      expect(suggestion).toContain('情节');
    });
  });

  describe('processIssues', () => {
    it('应将问题分类到正确的策略组', () => {
      const issues: QualityIssue[] = [
        { id: '1', type: 'character_conflict', severity: 'critical', description: '1', createdAt: Date.now() },
        { id: '2', type: 'character_conflict', severity: 'minor', description: '2', createdAt: Date.now() },
        { id: '3', type: 'world_rule_violation', severity: 'critical', description: '3', createdAt: Date.now() },
        { id: '4', type: 'world_rule_violation', severity: 'minor', description: '4', createdAt: Date.now() },
        { id: '5', type: 'plot_repetition', severity: 'major', description: '5', createdAt: Date.now() },
      ];

      const result = fixStrategy.processIssues(issues);

      expect(result.get('rebuild')).toHaveLength(3); // critical character + critical world + plot
      expect(result.get('retry')).toHaveLength(1); // minor character
      expect(result.get('ignore')).toHaveLength(1); // minor world
    });

    it('应处理空问题列表', () => {
      const result = fixStrategy.processIssues([]);
      expect(result.get('rebuild')).toHaveLength(0);
      expect(result.get('retry')).toHaveLength(0);
      expect(result.get('ignore')).toHaveLength(0);
    });
  });
});

describe('ReportGenerator', () => {
  beforeEach(() => {
    cleanDb();
    initDb();
    disableForeignKeys();
    resetDb();
  });

  afterEach(() => {
    enableForeignKeys();
  });

  describe('generate', () => {
    it('应生成正确的报告结构', () => {
      const issues: QualityIssue[] = [
        {
          id: '1',
          type: 'character_conflict',
          severity: 'major',
          description: '人物状态矛盾',
          createdAt: Date.now(),
        },
      ];

      const report = reportGenerator.generate({
        checkpointNumber: 1,
        totalChapters: 5,
        issues,
      });

      expect(report.checkpointNumber).toBe(1);
      expect(report.totalChapters).toBe(5);
      expect(report.issues).toHaveLength(1);
      expect(report.characterConsistency).toBeLessThan(100);
      expect(report.overallScore).toBeLessThan(100);
      // 单个 major 不会导致失败（总分仍 >= 80），只有 critical 或总分 < 80 才失败
      expect(report.passed).toBe(true);
    });

    it('应在没有问题时生成通过报告', () => {
      const report = reportGenerator.generate({
        checkpointNumber: 1,
        totalChapters: 5,
        issues: [],
      });

      expect(report.issues).toHaveLength(0);
      expect(report.characterConsistency).toBe(100);
      expect(report.worldRuleCompliance).toBe(100);
      expect(report.plotUniqueness).toBe(100);
      expect(report.overallScore).toBe(100);
      expect(report.passed).toBe(true);
    });

    it('应在有 critical 问题时生成不通过报告', () => {
      const issues: QualityIssue[] = [
        {
          id: '1',
          type: 'character_conflict',
          severity: 'critical',
          description: '严重人物状态矛盾',
          createdAt: Date.now(),
        },
      ];

      const report = reportGenerator.generate({
        checkpointNumber: 1,
        totalChapters: 5,
        issues,
      });

      // 即使总分 >= 80，有 critical 问题也应该不通过
      expect(report.passed).toBe(false);
    });
  });

  describe('formatReport', () => {
    it('应生成格式化的报告文本', () => {
      const report = reportGenerator.generate({
        checkpointNumber: 1,
        totalChapters: 3,
        issues: [],
      });

      const formatted = reportGenerator.formatReport(report);

      expect(formatted).toContain('质量检测报告');
      expect(formatted).toContain('1');
      expect(formatted).toContain('3');
      expect(formatted).toContain('人物状态一致性');
      expect(formatted).toContain('世界观规则遵守');
    });
  });
});
