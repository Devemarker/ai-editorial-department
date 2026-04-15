# Plan: Phase 7 - 总看板

## Summary

实现 CLI 可视化总看板，显示项目进度、章节状态、质量报告，并提供手动干预入口（重写、重审）。

## User Story

As a **用户**, I want **通过 CLI 查看项目进度和质量报告**, so that **实时了解章节生成状态并进行必要的手动干预**。

## Problem → Solution

无可视化进度管理 → CLI 总看板

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/ai-editorial-department.prd.md`
- **PRD Phase**: Phase 7 - 总看板
- **Estimated Files**: 3 个

---

## UX Design

### CLI Dashboard Display

```
╔══════════════════════════════════════════════════════════════╗
║                    📊 AI 编辑部 - 项目总览                    ║
╠══════════════════════════════════════════════════════════════╣
║  项目：我的小说                                               ║
║  章节总数：10    已完成：6    进行中：2    待处理：2          ║
╠══════════════════════════════════════════════════════════════╣
║                      📝 章节进度                            ║
╠──────────────────────────────────────────────────────────────╣
║  [✅ 第1章]  [✅ 第2章]  [✅ 第3章]  [⚙️ 第4章]  [⏳ 第5章]  ║
║  [✅ 第6章]  [❌ 第7章]  [📋 第8章]  [📋 第9章]  [📋 第10章] ║
╠══════════════════════════════════════════════════════════════╣
║                      📋 质量报告                            ║
╠──────────────────────────────────────────────────────────────╣
║  检测点 #1 (5章): 评分 85分 ✅ 通过                          ║
║  检测点 #2 (10章): 评分 72分 ❌ 需修复                       ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/pipeline/pipeline.ts` | all | 流水线状态 |
| P0 | `src/pipeline/taskQueue.ts` | all | 任务队列 |
| P1 | `src/cli.ts` | all | CLI 入口 |
| P1 | `src/quality/reportGenerator.ts` | all | 报告生成 |

---

## Patterns to Mirror

### CLI_STYLE
```typescript
// SOURCE: src/cli.ts
console.log(`\n📊 项目状态`);
console.log(`   人物数：${characters.length}`);
console.log(`   事件数：${events.length}`);
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/dashboard/dashboard.ts` | CREATE | 总看板主模块 |
| `src/dashboard/printer.ts` | CREATE | 格式化输出 |
| `src/dashboard/index.ts` | CREATE | 统一导出 |
| `src/cli.ts` | UPDATE | 添加 dashboard 命令 |

## NOT Building

- Web UI（后续迭代）
- 实时推送通知（后续迭代）

---

## Step-by-Step Tasks

### Task 1: 看板格式化输出

- **ACTION**: 创建 `src/dashboard/printer.ts`
- **IMPLEMENT**:
  ```typescript
  import type { PipelineTask, QualityReport } from '../types/index.js';

  const STATUS_ICONS: Record<string, string> = {
    pending: '⏳',
    writing: '⚙️',
    editing: '📝',
    proofreading: '🔍',
    approved: '✅',
    rejected: '❌',
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: '待处理',
    writing: '写作中',
    editing: '编辑中',
    proofreading: '校对中',
    approved: '已完成',
    rejected: '已拒绝',
  };

  export class DashboardPrinter {
    printHeader(title: string): void {
      const width = 60;
      const content = `📊 ${title}`;
      console.log('\n' + '═'.repeat(width));
      console.log(content.padStart((width + content.length) / 2).padEnd(width));
      console.log('═'.repeat(width));
    }

    printProjectStatus(stats: {
      totalChapters: number;
      completed: number;
      inProgress: number;
      pending: number;
    }): void {
      console.log('\n【项目统计】');
      console.log(`   总章节数：${stats.totalChapters}`);
      console.log(`   已完成：${stats.completed}`);
      console.log(`   进行中：${stats.inProgress}`);
      console.log(`   待处理：${stats.pending}`);
    }

    printChapterGrid(tasks: PipelineTask[]): void {
      console.log('\n【章节进度】');
      const sorted = [...tasks].sort((a, b) => a.chapterNumber - b.chapterNumber);

      // 每行显示 5 个
      const rows: string[][] = [];
      for (let i = 0; i < sorted.length; i += 5) {
        rows.push(sorted.slice(i, i + 5).map((t) => t.chapterNumber.toString()));
      }

      for (const row of rows) {
        const cells = row.map((n) => {
          const task = sorted.find((t) => t.chapterNumber === parseInt(n));
          const status = task?.status || 'pending';
          const icon = STATUS_ICONS[status] || '📋';
          return `${icon} 第${n}章`;
        });
        console.log('   ' + cells.join('  '));
      }
    }

    printTaskList(tasks: PipelineTask[]): void {
      console.log('\n【任务列表】');
      const sorted = [...tasks].sort((a, b) => a.chapterNumber - b.chapterNumber);

      for (const task of sorted) {
        const icon = STATUS_ICONS[task.status] || '📋';
        const label = STATUS_LABELS[task.status] || task.status;
        console.log(`   ${icon} 第${task.chapterNumber}章: ${label}`);
      }
    }

    printQualityReports(reports: QualityReport[]): void {
      console.log('\n【质量报告】');

      if (reports.length === 0) {
        console.log('   暂无检测报告');
        return;
      }

      for (const report of reports) {
        const status = report.passed ? '✅ 通过' : '❌ 需修复';
        console.log(`   检测点 #${report.checkpointNumber} (${report.totalChapters}章): 评分 ${report.overallScore}分 ${status}`);
      }
    }

    printQualityReportDetail(report: QualityReport): void {
      console.log('\n' + '─'.repeat(60));
      console.log(`       质量检测报告 #${report.checkpointNumber}`);
      console.log('─'.repeat(60));

      console.log(`检测时间：${new Date(report.createdAt).toLocaleString()}`);
      console.log(`总章节数：${report.totalChapters}`);
      console.log('');

      console.log('【评分详情】');
      console.log(`   人物状态一致性：${report.characterConsistency}%`);
      console.log(`   世界观规则遵守：${report.worldRuleCompliance}%`);
      console.log(`   情节唯一性：${report.plotUniqueness}%`);
      console.log(`   综合评分：${report.overallScore}%`);
      console.log('');
      console.log(`【检测结果】：${report.passed ? '✅ 通过' : '❌ 未通过'}`);

      if (report.issues.length > 0) {
        console.log('\n【问题列表】');
        for (const issue of report.issues) {
          const severityTag = issue.severity === 'critical' ? '🔴' :
                             issue.severity === 'major' ? '🟡' : '🟢';
          console.log(`   ${severityTag} [${issue.type}] ${issue.description}`);
        }
      }
      console.log('─'.repeat(60));
    }

    printManualIntervention(): void {
      console.log('\n【手动干预】');
      console.log('   使用以下命令进行干预：');
      console.log('   npm run cli -- dashboard:rewrite <章节号>  # 重写章节');
      console.log('   npm run cli -- dashboard:rerview <章节号> # 重新审核');
    }
  }

  export const dashboardPrinter = new DashboardPrinter();
  ```
- **MIRROR**: CLI_STYLE
- **IMPORTS**: PipelineTask, QualityReport
- **GOTCHA**: 使用 Unicode 字符美化输出
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 2: 总看板模块

- **ACTION**: 创建 `src/dashboard/dashboard.ts`
- **IMPLEMENT**:
  ```typescript
  import { taskQueue } from '../pipeline/taskQueue.js';
  import { chapterRepository } from '../memory/chapterRepository.js';
  import { characterRepository } from '../memory/characterRepository.js';
  import { eventRepository } from '../memory/eventRepository.js';
  import { dashboardPrinter } from './printer.js';
  import type { PipelineTask, QualityReport } from '../types/index.js';

  // 模拟质量报告存储（实际应从数据库读取）
  const qualityReports: QualityReport[] = [];

  export class Dashboard {
    // 显示完整看板
    showFullDashboard(): void {
      const tasks = taskQueue.getAllTasks();
      const chapters = chapterRepository.findAll();

      dashboardPrinter.printHeader('AI 编辑部 - 项目总览');

      // 项目统计
      const stats = this.calculateStats(tasks);
      dashboardPrinter.printProjectStatus(stats);

      // 章节进度
      if (tasks.length > 0) {
        dashboardPrinter.printChapterGrid(tasks);
      } else if (chapters.length > 0) {
        // 如果没有流水线任务，显示已有章节
        this.showChaptersOnly(chapters);
      } else {
        console.log('\n   暂无章节数据');
      }

      // 质量报告
      if (qualityReports.length > 0) {
        dashboardPrinter.printQualityReports(qualityReports);
      }

      // 手动干预提示
      dashboardPrinter.printManualIntervention();
    }

    // 显示章节列表（无流水线任务时）
    private showChaptersOnly(chapters: { number: number; status: string }[]): void {
      console.log('\n【已有章节】');
      const sorted = [...chapters].sort((a, b) => a.number - b.number);

      for (const chapter of sorted) {
        const icon = chapter.status === 'approved' ? '✅' :
                    chapter.status === 'draft' ? '📝' : '📋';
        console.log(`   ${icon} 第${chapter.number}章: ${chapter.status}`);
      }
    }

    // 计算统计
    private calculateStats(tasks: PipelineTask[]): {
      totalChapters: number;
      completed: number;
      inProgress: number;
      pending: number;
    } {
      return {
        totalChapters: taskQueue.getAllTasks().length,
        completed: tasks.filter((t) => t.status === 'approved').length,
        inProgress: tasks.filter((t) => ['writing', 'editing', 'proofreading'].includes(t.status)).length,
        pending: tasks.filter((t) => t.status === 'pending').length,
      };
    }

    // 显示详细任务列表
    showTaskList(): void {
      const tasks = taskQueue.getAllTasks();

      dashboardPrinter.printHeader('AI 编辑部 - 任务列表');
      dashboardPrinter.printTaskList(tasks);
    }

    // 显示章节详情
    showChapterDetail(chapterNumber: number): void {
      const chapter = chapterRepository.findByNumber(chapterNumber);

      if (!chapter) {
        console.log(`\n❌ 章节 ${chapterNumber} 不存在`);
        return;
      }

      dashboardPrinter.printHeader(`AI 编辑部 - 第${chapterNumber}章详情`);

      console.log('\n【基本信息】');
      console.log(`   章节号：${chapter.number}`);
      console.log(`   标题：${chapter.title}`);
      console.log(`   状态：${chapter.status}`);
      console.log(`   字数：${chapter.content.length}`);
      console.log(`   创建时间：${new Date(chapter.createdAt).toLocaleString()}`);
      console.log(`   更新时间：${new Date(chapter.updatedAt).toLocaleString()}`);

      console.log('\n【内容预览】');
      const preview = chapter.content.slice(0, 300);
      console.log('   ' + preview + (chapter.content.length > 300 ? '...' : ''));
    }

    // 手动重写章节
    async rewriteChapter(chapterNumber: number): Promise<void> {
      const task = taskQueue.getAllTasks().find((t) => t.chapterNumber === chapterNumber);

      if (task) {
        console.log(`\n⚙️ 正在重新生成第 ${chapterNumber} 章...`);
        // 重置任务状态
        taskQueue.updateTaskStatus(task.id, 'pending');
        // TODO: 触发重新生成
        console.log(`✅ 第 ${chapterNumber} 章已重新加入队列`);
      } else {
        console.log(`\n❌ 章节 ${chapterNumber} 不在流水线中，请使用 generate 命令先生成`);
      }
    }

    // 添加质量报告（供测试/集成使用）
    addQualityReport(report: QualityReport): void {
      qualityReports.push(report);
    }
  }

  export const dashboard = new Dashboard();
  ```
- **MIRROR**: SERVICE_PATTERN
- **IMPORTS**: taskQueue, chapterRepository, dashboardPrinter
- **GOTCHA**: 质量报告存储在内存中，后续应持久化到数据库
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 3: 统一导出

- **ACTION**: 创建 `src/dashboard/index.ts`
- **IMPLEMENT**:
  ```typescript
  export { Dashboard, dashboard } from './dashboard.js';
  export { DashboardPrinter, dashboardPrinter } from './printer.js';
  ```
- **MIRROR**: N/A
- **IMPORTS**: 各模块
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 4: 更新 CLI 集成

- **ACTION**: 更新 `src/cli.ts`
- **IMPLEMENT**:
  ```typescript
  // 添加 dashboard 命令
  case 'dashboard': {
    dashboard.showFullDashboard();
    break;
  }

  case 'dashboard:tasks': {
    dashboard.showTaskList();
    break;
  }

  case 'dashboard:chapter': {
    const chapterNumber = parseInt(args[1] || '1', 10);
    dashboard.showChapterDetail(chapterNumber);
    break;
  }

  case 'dashboard:rewrite': {
    const chapterNumber = parseInt(args[1] || '1', 10);
    await dashboard.rewriteChapter(chapterNumber);
    break;
  }

  // 帮助信息更新
  default:
    console.log(`
  AI 编辑部系统 CLI

  用法：
    npm run cli -- init <标题> <大纲>
    npm run cli -- status
    npm run cli -- generate <章节号> [标题] [大纲]
    npm run cli -- pipeline:status
    npm run cli -- dashboard
    npm run cli -- dashboard:tasks
    npm run cli -- dashboard:chapter <章节号>
    npm run cli -- dashboard:rewrite <章节号>

  示例：
    npm run cli -- init 我的小说 "一个关于勇气和友谊的故事"
    npm run cli -- status
    npm run cli -- generate 1 我的小说 "继续故事的发展"
    npm run cli -- dashboard
    npm run cli -- dashboard:chapter 1
    npm run cli -- dashboard:rewrite 1
    `);
  ```
- **MIRROR**: CLI_PATTERN
- **IMPORTS**: dashboard
- **GOTCHA**: dashboard 命令放在 default 之前
- **VALIDATE**: `tsc --noEmit` 无错误

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| DashboardPrinter.printChapterGrid | 任务列表 | 格式化输出 | 空列表 |
| DashboardPrinter.printQualityReportDetail | 报告 | 格式化输出 | 无问题报告 |
| Dashboard.showChapterDetail | 章节号 | 章节信息 | 章节不存在 |

### Edge Cases Checklist

- [x] 无章节数据
- [x] 章节不存在
- [x] 无质量报告

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
EXPECT: All dashboard tests pass

### Build
```bash
npm run build
```
EXPECT: dist/ 包含 dashboard/ 目录

---

## Acceptance Criteria

- [ ] Dashboard — 完整看板显示
- [ ] DashboardPrinter — 格式化输出
- [ ] CLI 集成 — dashboard 系列命令
- [ ] 章节详情查看
- [ ] 手动干预入口

---

## Notes

- MVP 只实现 CLI 看板，Web UI 在后续迭代
- 质量报告暂存内存中，后续持久化到数据库
- 手动重写功能需要与流水线集成
