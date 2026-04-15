# Plan: Phase 5 - 质量检测

## Summary

实现 5 章检测节点和自动修复功能，包括检测触发器、一致性检查（人物状态冲突、世界观违反、情节重复）、修复策略和检测报告生成。

## User Story

As a **用户**, I want **每5章自动进行一致性检测**, so that **确保生成内容符合大纲和原子设定，人物状态和世界观不出现矛盾**。

## Problem → Solution

手动质量检查 → 自动检测 + 修复策略

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/ai-editorial-department.prd.md`
- **PRD Phase**: Phase 5 - 质量检测
- **Estimated Files**: 6 个

---

## UX Design

N/A — 内部质量保障系统

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/memory/memoryService.ts` | all | 记忆检索接口 |
| P0 | `src/memory/characterRepository.ts` | all | 人物状态管理 |
| P1 | `src/memory/eventRepository.ts` | all | 事件时间线 |
| P1 | `src/pipeline/pipeline.ts` | all | 流水线集成点 |
| P2 | `src/types/index.ts` | all | 相关类型定义 |

---

## Patterns to Mirror

### AGENT_PATTERN
```typescript
// SOURCE: src/agents/base.ts
export abstract class BaseAgent {
  protected name: string;
  protected async think(prompt: string): Promise<string>
  protected log(action: string, detail?: string): void
}
```

### REPOSITORY_PATTERN
```typescript
// SOURCE: src/memory/characterRepository.ts
export class XxxRepository {
  create(input): Xxx
  findById(id): Xxx | undefined
  findAll(): Xxx[]
  update(id, input): Xxx | undefined
}
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/types/index.ts` | UPDATE | 添加检测相关类型 |
| `src/quality/checkpoint.ts` | CREATE | 检测触发器 |
| `src/quality/consistencyChecker.ts` | CREATE | 一致性检查器 |
| `src/quality/reportGenerator.ts` | CREATE | 报告生成器 |
| `src/quality/fixStrategy.ts` | CREATE | 修复策略 |
| `src/quality/index.ts` | CREATE | 统一导出 |
| `src/db/schema.sql` | UPDATE | 添加检测报告表 |

## NOT Building

- 人工审核界面（Phase 7）
- 自动修复执行（后续迭代）

---

## Step-by-Step Tasks

### Task 1: 添加检测类型

- **ACTION**: 扩展 `src/types/index.ts`
- **IMPLEMENT**:
  ```typescript
  // 检测问题类型
  export type IssueType = 'character_conflict' | 'world_rule_violation' | 'plot_repetition';

  // 检测问题严重程度
  export type IssueSeverity = 'critical' | 'major' | 'minor';

  // 检测问题
  export interface QualityIssue {
    id: string;
    type: IssueType;
    severity: IssueSeverity;
    description: string;
    chapterId?: string;
    relatedContent?: string;
    suggestedFix?: string;
    createdAt: number;
  }

  // 检测报告
  export interface QualityReport {
    id: string;
    checkpointNumber: number;
    totalChapters: number;
    issues: QualityIssue[];
    characterConsistency: number; // 0-100
    worldRuleCompliance: number; // 0-100
    plotUniqueness: number; // 0-100
    overallScore: number; // 0-100
    passed: boolean;
    createdAt: number;
  }

  // 检测配置
  export interface QualityConfig {
    checkpointInterval: number; // 默认 5
    autoFix: boolean;
    requireHumanReview: boolean;
  }
  ```
- **MIRROR**: 类型定义遵循现有模式
- **IMPORTS**: 无新增
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 2: 检测触发器

- **ACTION**: 创建 `src/quality/checkpoint.ts`
- **IMPLEMENT**:
  ```typescript
  import { globalEventBus } from '../pipeline/eventBus.js';
  import { taskQueue } from '../pipeline/taskQueue.js';
  import { consistencyChecker } from './consistencyChecker.js';
  import { reportGenerator } from './reportGenerator.js';
  import type { PipelineEvent, QualityReport } from '../types/index.js';

  const CHECKPOINT_INTERVAL = 5; // 每 5 章检测一次

  let checkpointCounter = 0;

  export class Checkpoint {
    private config: {
      interval: number;
      onCheckpointComplete?: (report: QualityReport) => void;
    };

    constructor(config?: { interval?: number; onCheckpointComplete?: (report: QualityReport) => void }) {
      this.config = {
        interval: config?.interval ?? CHECKPOINT_INTERVAL,
        onCheckpointComplete: config?.onCheckpointComplete,
      };
      this.setupEventListeners();
    }

    private setupEventListeners(): void {
      // 监听章节完成事件
      globalEventBus.on<PipelineEvent>('task:written', () => {
        checkpointCounter++;
        if (checkpointCounter % this.config.interval === 0) {
          this.triggerCheckpoint(Math.floor(checkpointCounter / this.config.interval));
        }
      });
    }

    async triggerCheckpoint(checkpointNumber: number): Promise<QualityReport> {
      console.log(`[Checkpoint] 触发第 ${checkpointNumber} 次检测...`);

      // 执行一致性检查
      const issues = await consistencyChecker.checkAll();

      // 生成报告
      const report = reportGenerator.generate({
        checkpointNumber,
        totalChapters: checkpointCounter,
        issues,
      });

      this.config.onCheckpointComplete?.(report);
      return report;
    }

    getCheckpointCount(): number {
      return checkpointCounter;
    }
  }

  export const checkpoint = new Checkpoint();
  ```
- **MIRROR**: AGENT_PATTERN
- **IMPORTS**: globalEventBus, taskQueue, consistencyChecker, reportGenerator
- **GOTCHA**: 检测触发需要等所有章节任务完成
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 3: 一致性检查器

- **ACTION**: 创建 `src/quality/consistencyChecker.ts`
- **IMPLEMENT**:
  ```typescript
  import { characterRepository } from '../memory/characterRepository.js';
  import { eventRepository } from '../memory/eventRepository.js';
  import { chapterRepository } from '../memory/chapterRepository.js';
  import { worldKnowledgeRepository } from '../memory/worldKnowledgeRepository.js';
  import type { QualityIssue } from '../types/index.js';

  function generateId(): string {
    return `issue_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  export class ConsistencyChecker {
    // 检查人物状态一致性
    async checkCharacterConsistency(): Promise<QualityIssue[]> {
      const issues: QualityIssue[] = [];
      const characters = characterRepository.findAll();

      for (const char of characters) {
        // 检查人物状态是否有矛盾（简化实现）
        if (!char.currentState || char.currentState.length < 2) {
          issues.push({
            id: generateId(),
            type: 'character_conflict',
            severity: 'major',
            description: `人物 "${char.name}" 状态异常：${char.currentState}`,
            relatedContent: char.currentState,
            createdAt: Date.now(),
          });
        }
      }

      return issues;
    }

    // 检查世界观规则违反
    async checkWorldRuleCompliance(): Promise<QualityIssue[]> {
      const issues: QualityIssue[] = [];
      const chapters = chapterRepository.findAll();

      // 简化实现：检查章节内容是否过短（可能违反详细世界观）
      for (const chapter of chapters) {
        if (chapter.content.length < 500) {
          issues.push({
            id: generateId(),
            type: 'world_rule_violation',
            severity: 'minor',
            description: `第 ${chapter.number} 章内容过短，可能未充分展开世界观`,
            chapterId: chapter.id,
            relatedContent: chapter.content.slice(0, 100),
            createdAt: Date.now(),
          });
        }
      }

      return issues;
    }

    // 检查情节重复
    async checkPlotUniqueness(): Promise<QualityIssue[]> {
      const issues: QualityIssue[] = [];
      const chapters = chapterRepository.findAll();

      // 简化实现：检查相邻章节标题是否相似
      for (let i = 1; i < chapters.length; i++) {
        const prev = chapters[i - 1];
        const curr = chapters[i];

        // 简单相似度检查：标题相似度
        if (this.similarity(prev.title, curr.title) > 0.7) {
          issues.push({
            id: generateId(),
            type: 'plot_repetition',
            severity: 'major',
            description: `第 ${prev.number} 章和第 ${curr.number} 章标题相似度较高，可能存在情节重复`,
            chapterId: curr.id,
            relatedContent: `前章: ${prev.title}, 本章: ${curr.title}`,
            createdAt: Date.now(),
          });
        }
      }

      return issues;
    }

    // 执行所有检查
    async checkAll(): Promise<QualityIssue[]> {
      const [characterIssues, worldIssues, plotIssues] = await Promise.all([
        this.checkCharacterConsistency(),
        this.checkWorldRuleCompliance(),
        this.checkPlotUniqueness(),
      ]);

      return [...characterIssues, ...worldIssues, ...plotIssues];
    }

    // 简单字符串相似度计算
    private similarity(a: string, b: string): number {
      const s1 = a.toLowerCase();
      const s2 = b.toLowerCase();
      if (s1 === s2) return 1;
      if (s1.length < 2 || s2.length < 2) return 0;

      const set1 = new Set(s1.split(''));
      const set2 = new Set(s2.split(''));
      const intersection = new Set([...set1].filter((x) => set2.has(x)));
      return intersection.size / Math.max(set1.size, set2.size);
    }
  }

  export const consistencyChecker = new ConsistencyChecker();
  ```
- **MIRROR**: REPOSITORY_PATTERN + AGENT_PATTERN
- **IMPORTS**: characterRepository, eventRepository, chapterRepository, worldKnowledgeRepository
- **GOTCHA**: 情节重复检测使用简单相似度算法，后续可升级为向量相似度
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 4: 报告生成器

- **ACTION**: 创建 `src/quality/reportGenerator.ts`
- **IMPLEMENT**:
  ```typescript
  import type { QualityIssue, QualityReport, IssueType } from '../types/index.js';

  function generateId(): string {
    return `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  export class ReportGenerator {
    generate(input: {
      checkpointNumber: number;
      totalChapters: number;
      issues: QualityIssue[];
    }): QualityReport {
      const { checkpointNumber, totalChapters, issues } = input;

      // 计算各项分数
      const characterConsistency = this.calculateCharacterScore(issues);
      const worldRuleCompliance = this.calculateWorldScore(issues);
      const plotUniqueness = this.calculatePlotScore(issues);

      // 综合评分（加权平均）
      const overallScore = Math.round(
        characterConsistency * 0.4 + worldRuleCompliance * 0.3 + plotUniqueness * 0.3
      );

      // 通过标准：总分 >= 80 且无 critical 问题
      const passed = overallScore >= 80 && !issues.some((i) => i.severity === 'critical');

      return {
        id: generateId(),
        checkpointNumber,
        totalChapters,
        issues,
        characterConsistency,
        worldRuleCompliance,
        plotUniqueness,
        overallScore,
        passed,
        createdAt: Date.now(),
      };
    }

    formatReport(report: QualityReport): string {
      const lines: string[] = [
        `========== 质量检测报告 #${report.checkpointNumber} ==========`,
        `检测时间：${new Date(report.createdAt).toLocaleString()}`,
        `总章节数：${report.totalChapters}`,
        '',
        '【评分详情】',
        `  人物状态一致性：${report.characterConsistency}%`,
        `  世界观规则遵守：${report.worldRuleCompliance}%`,
        `  情节唯一性：${report.plotUniqueness}%`,
        `  综合评分：${report.overallScore}%`,
        '',
        `【检测结果】：${report.passed ? '✅ 通过' : '❌ 未通过'}`,
        '',
      ];

      if (report.issues.length > 0) {
        lines.push('【问题列表】');
        const byType = this.groupByType(report.issues);
        for (const [type, typeIssues] of Object.entries(byType)) {
          lines.push(`\n  [${type}] (${typeIssues.length} 个问题)`);
          for (const issue of typeIssues) {
            lines.push(`    - ${issue.description}`);
            if (issue.suggestedFix) {
              lines.push(`      建议修复：${issue.suggestedFix}`);
            }
          }
        }
      }

      lines.push('\n' + '='.repeat(50));
      return lines.join('\n');
    }

    private calculateCharacterScore(issues: QualityIssue[]): number {
      const characterIssues = issues.filter((i) => i.type === 'character_conflict');
      if (characterIssues.length === 0) return 100;
      const penalty = characterIssues.reduce((sum, i) => {
        return sum + (i.severity === 'critical' ? 30 : i.severity === 'major' ? 15 : 5);
      }, 0);
      return Math.max(0, 100 - penalty);
    }

    private calculateWorldScore(issues: QualityIssue[]): number {
      const worldIssues = issues.filter((i) => i.type === 'world_rule_violation');
      if (worldIssues.length === 0) return 100;
      const penalty = worldIssues.reduce((sum, i) => {
        return sum + (i.severity === 'critical' ? 30 : i.severity === 'major' ? 15 : 5);
      }, 0);
      return Math.max(0, 100 - penalty);
    }

    private calculatePlotScore(issues: QualityIssue[]): number {
      const plotIssues = issues.filter((i) => i.type === 'plot_repetition');
      if (plotIssues.length === 0) return 100;
      const penalty = plotIssues.reduce((sum, i) => {
        return sum + (i.severity === 'critical' ? 30 : i.severity === 'major' ? 15 : 5);
      }, 0);
      return Math.max(0, 100 - penalty);
    }

    private groupByType(issues: QualityIssue[]): Record<IssueType, QualityIssue[]> {
      return issues.reduce(
        (acc, issue) => {
          if (!acc[issue.type]) acc[issue.type] = [];
          acc[issue.type].push(issue);
          return acc;
        },
        {} as Record<IssueType, QualityIssue[]>
      );
    }
  }

  export const reportGenerator = new ReportGenerator();
  ```
- **MIRROR**: 格式化输出遵循 CLI 模式
- **IMPORTS**: QualityIssue, QualityReport, IssueType
- **GOTCHA**: 评分权重可配置
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 5: 修复策略

- **ACTION**: 创建 `src/quality/fixStrategy.ts`
- **IMPLEMENT**:
  ```typescript
  import type { QualityIssue, IssueType } from '../types/index.js';

  // 修复策略类型
  export type FixStrategy = 'ignore' | 'retry' | 'rebuild';

  export class FixStrategy {
    // 根据问题类型选择策略
    selectStrategy(issue: QualityIssue): FixStrategy {
      switch (issue.type) {
        case 'character_conflict':
          return issue.severity === 'critical' ? 'rebuild' : 'retry';
        case 'world_rule_violation':
          return issue.severity === 'critical' ? 'rebuild' : 'ignore';
        case 'plot_repetition':
          return 'rebuild';
        default:
          return 'ignore';
      }
    }

    // 生成修复建议
    generateSuggestion(issue: QualityIssue): string {
      switch (issue.type) {
        case 'character_conflict':
          return '建议重新生成章节，确保人物状态与之前一致';
        case 'world_rule_violation':
          return '建议补充世界观细节，增强章节内容深度';
        case 'plot_repetition':
          return '建议重新设计本章情节，避免与前文重复';
        default:
          return '请人工审核';
      }
    }

    // 批量处理问题
    processIssues(issues: QualityIssue[]): Map<FixStrategy, QualityIssue[]> {
      const result = new Map<FixStrategy, QualityIssue[]>();
      result.set('ignore', []);
      result.set('retry', []);
      result.set('rebuild', []);

      for (const issue of issues) {
        const strategy = this.selectStrategy(issue);
        result.get(strategy)!.push(issue);
      }

      return result;
    }
  }

  export const fixStrategy = new FixStrategy();
  ```
- **MIRROR**: 简单策略模式
- **IMPORTS**: QualityIssue, IssueType
- **GOTCHA**: MVP 只生成建议，不自动执行修复
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 6: 统一导出

- **ACTION**: 创建 `src/quality/index.ts`
- **IMPLEMENT**:
  ```typescript
  export { Checkpoint, checkpoint } from './checkpoint.js';
  export { ConsistencyChecker, consistencyChecker } from './consistencyChecker.js';
  export { ReportGenerator, reportGenerator } from './reportGenerator.js';
  export { FixStrategy, fixStrategy } from './fixStrategy.js';
  ```
- **MIRROR**: N/A
- **IMPORTS**: 各模块
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 7: 更新数据库 Schema

- **ACTION**: 更新 `src/db/schema.sql`
- **IMPLEMENT**:
  ```sql
  -- 检测报告表
  CREATE TABLE IF NOT EXISTS quality_reports (
    id TEXT PRIMARY KEY,
    checkpoint_number INTEGER NOT NULL,
    total_chapters INTEGER NOT NULL,
    character_consistency INTEGER NOT NULL,
    world_rule_compliance INTEGER NOT NULL,
    plot_uniqueness INTEGER NOT NULL,
    overall_score INTEGER NOT NULL,
    passed INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- 检测问题表
  CREATE TABLE IF NOT EXISTS quality_issues (
    id TEXT PRIMARY KEY,
    report_id TEXT NOT NULL,
    type TEXT NOT NULL,
    severity TEXT NOT NULL,
    description TEXT NOT NULL,
    chapter_id TEXT,
    related_content TEXT,
    suggested_fix TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (report_id) REFERENCES quality_reports(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_issues_report_id ON quality_issues(report_id);
  CREATE INDEX IF NOT EXISTS idx_reports_checkpoint ON quality_reports(checkpoint_number);
  ```
- **MIRROR**: 遵循现有表结构模式
- **IMPORTS**: 无
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| ConsistencyChecker.checkCharacterConsistency | 有效人物 | 空数组或问题列表 | 状态为空 |
| ConsistencyChecker.checkPlotUniqueness | 相似的相邻标题 | 检测到重复 | 首次生成 |
| ReportGenerator.generate | 问题列表 | QualityReport | 无问题 |
| ReportGenerator.formatReport | QualityReport | 格式化字符串 | 长报告 |
| FixStrategy.selectStrategy | QualityIssue | FixStrategy | 未知问题类型 |

### Edge Cases Checklist

- [x] 无章节数据时检测
- [x] 首次检测（少于 5 章）
- [x] 重复检测同一批次
- [x] 大量问题累积

---

## Validation Commands

### Static Analysis
```bash
npm run typecheck
```
EXPECT: Zero type errors

### Unit Tests
```bash
npm test
```
EXPECT: All quality tests pass

### Build
```bash
npm run build
```
EXPECT: dist/ 包含 quality/ 目录

---

## Acceptance Criteria

- [ ] Checkpoint — 每 5 章自动触发检测
- [ ] ConsistencyChecker — character/world/plot 三种检查
- [ ] ReportGenerator — 生成带评分的报告
- [ ] FixStrategy — 提供修复建议
- [ ] CLI 集成 — `quality:report` 命令

---

## Notes

- MVP 只生成报告和修复建议，不自动执行修复
- 情节重复检测使用简单字符串相似度，后续可升级为向量语义相似度
- 检测触发依赖事件总线，章节完成后自动计数
