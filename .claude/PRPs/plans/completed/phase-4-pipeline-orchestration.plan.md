# Plan: Phase 4 - 流水线编排

## Summary

实现智能体之间的自动化协作流水线，包含事件总线（EventBus）进行消息传递、任务队列（TaskQueue）调度章节生成任务、流水线状态机（PipelineStateMachine）管理章节状态流转（待生成 → 写作中 → 编辑中 → 校对中 → 完成）。

## User Story

As a **用户**, I want **输入大纲后自动完成完整流水线**, so that **我只需等待章节生成完成，无需手动协调各个智能体**。

## Problem → Solution

手动协调智能体 → 自动流水线编排

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/ai-editorial-department.prd.md`
- **PRD Phase**: Phase 4 - 流水线编排
- **Estimated Files**: 6 个

---

## UX Design

N/A — 内部基础设施

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/agents/chiefEditor.ts` | all | 总编协调逻辑 |
| P0 | `src/agents/writer.ts` | all | Writer 生成逻辑 |
| P1 | `src/types/index.ts` | all | ChapterDraft, ChapterPlan |
| P1 | `src/memory/chapterRepository.ts` | all | 章节存储 |

---

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| TypeScript EventEmitter | Node.js 内置 | 发布/订阅模式 |
| State Machine | 最佳实践 | 有限状态自动机 |

---

## Patterns to Mirror

### EVENT_BUS_PATTERN
发布/订阅模式，智能体通过事件通信

### STATE_MACHINE_PATTERN
状态流转清晰，每个状态有明确的进入/退出动作

### TASK_QUEUE_PATTERN
任务入队，按顺序处理，支持状态跟踪

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/pipeline/eventBus.ts` | CREATE | 事件总线 |
| `src/pipeline/taskQueue.ts` | CREATE | 任务队列 |
| `src/pipeline/stateMachine.ts` | CREATE | 流水线状态机 |
| `src/pipeline/pipeline.ts` | CREATE | 主编排器 |
| `src/pipeline/index.ts` | CREATE | 统一导出 |
| `src/types/index.ts` | UPDATE | 添加流水线相关类型 |
| `src/db/schema.sql` | UPDATE | 添加 pipeline_tasks 表 |

## NOT Building

- 质量检测（Phase 5）
- 扩展智能体（Phase 6）

---

## Step-by-Step Tasks

### Task 1: 添加流水线类型

- **ACTION**: 扩展 `src/types/index.ts`
- **IMPLEMENT**:
  ```typescript
  // 流水线状态
  export type PipelineStatus =
    | 'pending'
    | 'writing'
    | 'editing'
    | 'proofreading'
    | 'approved'
    | 'rejected';

  // 流水线任务
  export interface PipelineTask {
    id: string;
    chapterNumber: number;
    status: PipelineStatus;
    chapterId?: string;
    error?: string;
    createdAt: number;
    updatedAt: number;
  }

  // 流水线事件
  export type PipelineEvent =
    | { type: 'task:created'; taskId: string; chapterNumber: number }
    | { type: 'task:writing'; taskId: string }
    | { type: 'task:written'; taskId: string; chapterId: string }
    | { type: 'task:editing'; taskId: string }
    | { type: 'task:edited'; taskId: string }
    | { type: 'task:proofreading'; taskId: string }
    | { type: 'task:proofread'; taskId: string }
    | { type: 'task:approved'; taskId: string }
    | { type: 'task:rejected'; taskId: string; reason: string }
    | { type: 'task:error'; taskId: string; error: string };

  // 流水线配置
  export interface PipelineConfig {
    autoWriting: boolean;
    autoEditing: boolean;
    autoProofreading: boolean;
    requireApproval: boolean;
  }
  ```
- **MIRROR**: 类型定义遵循现有模式
- **IMPORTS**: 无新增
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 2: 事件总线

- **ACTION**: 创建 `src/pipeline/eventBus.ts`
- **IMPLEMENT**:
  ```typescript
  type EventHandler<T = unknown> = (event: T) => void;

  export class EventBus {
    private handlers: Map<string, Set<EventHandler>> = new Map();

    on<T>(eventType: string, handler: EventHandler<T>): () => void {
      if (!this.handlers.has(eventType)) {
        this.handlers.set(eventType, new Set());
      }
      this.handlers.get(eventType)!.add(handler as EventHandler);

      // 返回取消订阅函数
      return () => this.off(eventType, handler);
    }

    off<T>(eventType: string, handler: EventHandler<T>): void {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        handlers.delete(handler as EventHandler);
      }
    }

    emit<T>(eventType: string, event: T): void {
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        for (const handler of handlers) {
          try {
            (handler as EventHandler<T>)(event);
          } catch (err) {
            console.error(`[EventBus] Handler error for ${eventType}:`, err);
          }
        }
      }
    }

    once<T>(eventType: string, handler: EventHandler<T>): () => void {
      const wrappedHandler: EventHandler<T> = (event) => {
        this.off(eventType, wrappedHandler);
        handler(event);
      };
      return this.on(eventType, wrappedHandler);
    }

    clear(): void {
      this.handlers.clear();
    }
  }

  // 全局事件总线单例
  export const globalEventBus = new EventBus();
  ```
- **MIRROR**: EVENT_BUS_PATTERN
- **IMPORTS**: 无
- **GOTCHA**: 异常不会中断其他处理器
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 3: 任务队列

- **ACTION**: 创建 `src/pipeline/taskQueue.ts`
- **IMPLEMENT**:
  ```typescript
  import { globalEventBus } from './eventBus.js';
  import { chapterRepository } from '../memory/chapterRepository.js';
  import type { PipelineTask, PipelineEvent } from '../types/index.js';

  function generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  export class TaskQueue {
    private tasks: Map<string, PipelineTask> = new Map();
    private processing: Set<string> = new Set();

    createTask(chapterNumber: number): PipelineTask {
      const id = generateId();
      const task: PipelineTask = {
        id,
        chapterNumber,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      this.tasks.set(id, task);

      globalEventBus.emit<PipelineEvent>('task:created', { type: 'task:created', taskId: id, chapterNumber });

      return task;
    }

    getTask(taskId: string): PipelineTask | undefined {
      return this.tasks.get(taskId);
    }

    getTasksByStatus(status: PipelineTask['status']): PipelineTask[] {
      return Array.from(this.tasks.values()).filter((t) => t.status === status);
    }

    getPendingTasks(): PipelineTask[] {
      return this.getTasksByStatus('pending');
    }

    updateTaskStatus(taskId: string, status: PipelineTask['status'], extra?: Partial<PipelineTask>): PipelineTask | undefined {
      const task = this.tasks.get(taskId);
      if (!task) return undefined;

      task.status = status;
      task.updatedAt = Date.now();
      if (extra) {
        Object.assign(task, extra);
      }

      // 持久化章节ID
      if (extra?.chapterId) {
        const chapter = chapterRepository.findById(extra.chapterId);
        if (chapter) {
          chapterRepository.update(extra.chapterId, { status: status as string });
        }
      }

      return task;
    }

    startProcessing(taskId: string): boolean {
      if (this.processing.has(taskId)) return false;
      this.processing.add(taskId);
      return true;
    }

    stopProcessing(taskId: string): void {
      this.processing.delete(taskId);
    }

    isProcessing(taskId: string): boolean {
      return this.processing.has(taskId);
    }

    getAllTasks(): PipelineTask[] {
      return Array.from(this.tasks.values()).sort((a, b) => a.chapterNumber - b.chapterNumber);
    }
  }

  export const taskQueue = new TaskQueue();
  ```
- **MIRROR**: TASK_QUEUE_PATTERN
- **IMPORTS**: globalEventBus, chapterRepository
- **GOTCHA**: 任务状态变更需要同步更新章节状态
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 4: 流水线状态机

- **ACTION**: 创建 `src/pipeline/stateMachine.ts`
- **IMPLEMENT**:
  ```typescript
  import { globalEventBus } from './eventBus.js';
  import { taskQueue } from './taskQueue.js';
  import type { PipelineTask, PipelineEvent, PipelineStatus } from '../types/index.js';

  // 有效的状态转换
  const VALID_TRANSITIONS: Record<PipelineStatus, PipelineStatus[]> = {
    pending: ['writing'],
    writing: ['editing', 'rejected'],
    editing: ['proofreading', 'rejected'],
    proofreading: ['approved', 'rejected'],
    approved: [],
    rejected: ['pending'], // 可以重新生成
  };

  export class StateMachine {
    private config: {
      onTransition?: (from: PipelineStatus, to: PipelineStatus, task: PipelineTask) => void;
    };

    constructor(config?: { onTransition?: (from: PipelineStatus, to: PipelineStatus, task: PipelineTask) => void }) {
      this.config = config || {};
      this.setupEventListeners();
    }

    private setupEventListeners(): void {
      globalEventBus.on<PipelineEvent>('task:writing', (e) => {
        this.transition(e.taskId, 'writing');
      });

      globalEventBus.on<PipelineEvent>('task:written', (e) => {
        this.transition(e.taskId, 'editing');
      });

      globalEventBus.on<PipelineEvent>('task:edited', (e) => {
        this.transition(e.taskId, 'proofreading');
      });

      globalEventBus.on<PipelineEvent>('task:proofread', (e) => {
        this.transition(e.taskId, 'approved');
      });

      globalEventBus.on<PipelineEvent>('task:rejected', (e) => {
        this.transition(e.taskId, 'rejected');
      });

      globalEventBus.on<PipelineEvent>('task:error', (e) => {
        const task = taskQueue.getTask(e.taskId);
        if (task) {
          taskQueue.updateTaskStatus(e.taskId, task.status, { error: e.error });
        }
      });
    }

    transition(taskId: string, newStatus: PipelineStatus): boolean {
      const task = taskQueue.getTask(taskId);
      if (!task) {
        console.warn(`[StateMachine] Task ${taskId} not found`);
        return false;
      }

      const currentStatus = task.status;
      const validNextStatuses = VALID_TRANSITIONS[currentStatus];

      if (!validNextStatuses.includes(newStatus)) {
        console.warn(`[StateMachine] Invalid transition ${currentStatus} -> ${newStatus} for task ${taskId}`);
        return false;
      }

      taskQueue.updateTaskStatus(taskId, newStatus);
      this.config.onTransition?.(currentStatus, newStatus, task);

      return true;
    }

    canTransition(taskId: string, newStatus: PipelineStatus): boolean {
      const task = taskQueue.getTask(taskId);
      if (!task) return false;
      return VALID_TRANSITIONS[task.status].includes(newStatus);
    }
  }

  export const stateMachine = new StateMachine();
  ```
- **MIRROR**: STATE_MACHINE_PATTERN
- **IMPORTS**: globalEventBus, taskQueue
- **GOTCHA**: 状态转换必须遵循定义的规则
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 5: 流水线编排器

- **ACTION**: 创建 `src/pipeline/pipeline.ts`
- **IMPLEMENT**:
  ```typescript
  import { globalEventBus } from './eventBus.js';
  import { taskQueue } from './taskQueue.js';
  import { stateMachine } from './stateMachine.js';
  import { writerAgent } from '../agents/writer.js';
  import { chiefEditorAgent } from '../agents/chiefEditor.js';
  import type { PipelineTask, PipelineEvent, ProjectInput, PipelineConfig } from '../types/index.js';

  export class Pipeline {
    private config: PipelineConfig;
    private projectInput?: ProjectInput;

    constructor(config?: Partial<PipelineConfig>) {
      this.config = {
        autoWriting: config?.autoWriting ?? true,
        autoEditing: config?.autoEditing ?? false, // MVP 暂时不实现
        autoProofreading: config?.autoProofreading ?? false,
        requireApproval: config?.requireApproval ?? true,
      };
      this.setupEventListeners();
    }

    setProjectInput(input: ProjectInput): void {
      this.projectInput = input;
    }

    private setupEventListeners(): void {
      // 任务创建后自动开始写作
      globalEventBus.on<PipelineEvent>('task:created', async (e) => {
        if (this.config.autoWriting) {
          this.startWriting(e.taskId);
        }
      });

      // 写作完成
      globalEventBus.on<PipelineEvent>('task:written', async (e) => {
        const task = taskQueue.getTask(e.taskId);
        if (task?.chapterId && this.config.autoProofreading) {
          // 自动校对
          globalEventBus.emit('task:proofreading', { type: 'task:proofreading', taskId: e.taskId });
        }
      });

      // 校对完成
      globalEventBus.on<PipelineEvent>('task:proofread', async (e) => {
        if (this.config.requireApproval) {
          // 需要人工审核
          globalEventBus.emit('task:rejected', { type: 'task:rejected', taskId: e.taskId, reason: '需要人工审核' });
        } else {
          // 自动批准
          globalEventBus.emit('task:approved', { type: 'task:approved', taskId: e.taskId });
        }
      });
    }

    async createChapter(chapterNumber: number): Promise<PipelineTask> {
      const task = taskQueue.createTask(chapterNumber);
      return task;
    }

    async startWriting(taskId: string): Promise<void> {
      const task = taskQueue.getTask(taskId);
      if (!task || !taskQueue.startProcessing(taskId)) return;

      globalEventBus.emit<PipelineEvent>('task:writing', { type: 'task:writing', taskId });

      try {
        if (!this.projectInput) {
          throw new Error('Project input not set');
        }

        // 调用 Writer 生成章节
        const draft = await writerAgent.act({
          projectInput: this.projectInput,
          chapterPlan: {
            number: task.chapterNumber,
            title: `第${task.chapterNumber}章`,
            keyPoints: [],
            characterStates: {},
          },
        });

        // 更新任务状态
        taskQueue.updateTaskStatus(taskId, 'writing', { chapterId: draft.chapterId });
        globalEventBus.emit<PipelineEvent>('task:written', {
          type: 'task:written',
          taskId,
          chapterId: draft.chapterId,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        globalEventBus.emit<PipelineEvent>('task:error', { type: 'task:error', taskId, error });
      } finally {
        taskQueue.stopProcessing(taskId);
      }
    }

    async run(chapterNumbers: number[]): Promise<PipelineTask[]> {
      const tasks: PipelineTask[] = [];

      // 按顺序创建任务
      for (const num of chapterNumbers) {
        const task = await this.createChapter(num);
        tasks.push(task);
      }

      // 并行处理所有任务
      await Promise.all(tasks.map((t) => this.startWriting(t.id)));

      return tasks;
    }

    getStatus(): {
      total: number;
      pending: number;
      processing: number;
      completed: number;
    } {
      const all = taskQueue.getAllTasks();
      return {
        total: all.length,
        pending: all.filter((t) => t.status === 'pending').length,
        processing: all.filter((t) => ['writing', 'editing', 'proofreading'].includes(t.status)).length,
        completed: all.filter((t) => t.status === 'approved').length,
      };
    }
  }

  export const pipeline = new Pipeline();
  ```
- **MIRROR**: PIPELINE_PATTERN
- **IMPORTS**: globalEventBus, taskQueue, stateMachine, writerAgent, chiefEditorAgent
- **GOTCHA**: MVP 只实现自动写作，其他阶段暂不实现
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 6: 统一导出

- **ACTION**: 创建 `src/pipeline/index.ts`
- **IMPLEMENT**:
  ```typescript
  export { EventBus, globalEventBus } from './eventBus.js';
  export { TaskQueue, taskQueue } from './taskQueue.js';
  export { StateMachine, stateMachine } from './stateMachine.js';
  export { Pipeline, pipeline } from './pipeline.js';
  ```
- **MIRROR**: N/A
- **IMPORTS**: 各模块
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 7: 更新 CLI 集成

- **ACTION**: 更新 `src/cli.ts` 使用流水线
- **IMPLEMENT**:
  ```typescript
  import { pipeline } from './pipeline/pipeline.js';
  import { taskQueue } from './pipeline/taskQueue.js';
  import { memoryService } from './memory/memoryService.js';
  import type { ProjectInput } from './types/index.js';

  // 在 generate 命令中使用流水线
  case 'generate': {
    const chapterNumber = parseInt(args[1] || '1', 10);
    const title = args[2] || '未命名项目';
    const outline = args.slice(3).join(' ') || '待补充';

    const projectInput: ProjectInput = {
      title,
      outline,
      characters: memoryService.getAllCharacters().map((c) => ({
        name: c.name,
        description: c.description,
      })),
    };

    pipeline.setProjectInput(projectInput);

    console.log(`\n📝 正在生成第${chapterNumber}章...`);
    const task = await pipeline.createChapter(chapterNumber);
    console.log(`   任务ID: ${task.id}`);

    // 等待完成
    console.log('   状态: pending -> writing...');
    break;
  }

  case 'status': {
    const status = pipeline.getStatus();
    console.log(`\n📊 流水线状态`);
    console.log(`   总任务: ${status.total}`);
    console.log(`   待处理: ${status.pending}`);
    console.log(`   处理中: ${status.processing}`);
    console.log(`   已完成: ${status.completed}`);
    break;
  }
  ```
- **MIRROR**: CLI_PATTERN
- **IMPORTS**: pipeline, taskQueue, memoryService
- **GOTCHA**: 简化实现
- **VALIDATE**: `tsc --noEmit` 无错误

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| EventBus.on/off | 订阅/取消订阅 | 正确触发处理器 | 多次取消 |
| TaskQueue.createTask | 章节号 | 返回任务 | 重复章节号 |
| StateMachine.transition | 有效/无效转换 | 正确状态变更 | 无效转换拒绝 |
| Pipeline.createChapter | 章节号 | 返回 PipelineTask | 无 |

### Edge Cases Checklist

- [x] 重复订阅 — 正常处理
- [x] 无效状态转换 — 返回 false
- [x] 任务处理中再次触发 — 忽略
- [x] 章节生成失败 — 错误事件

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
EXPECT: All pipeline tests pass

### Build

```bash
npm run build
```
EXPECT: dist/ 包含 pipeline/ 目录

---

## Acceptance Criteria

- [ ] EventBus — on, off, emit, once, clear
- [ ] TaskQueue — createTask, getTask, updateTaskStatus, getAllTasks
- [ ] StateMachine — transition, canTransition, 状态转换规则
- [ ] Pipeline — createChapter, startWriting, run, getStatus
- [ ] CLI 集成 — generate, status 命令
- [ ] 类型定义 — PipelineTask, PipelineEvent, PipelineStatus

---

## Completion Checklist

- [ ] 所有任务完成
- [ ] 无 TypeScript 类型错误
- [ ] 测试通过
- [ ] Build 成功
- [ ] 代码遵循 Phase 1-3 模式

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| 事件循环触发 | M | H | 状态机验证转换有效性 |
| 异步任务竞争 | M | M | TaskQueue processing 集合管理 |

---

## Notes

- MVP 只实现写作阶段自动化，其他阶段（编辑、校对）在 Phase 5-6 实现
- 事件总线使用简单 Map+Set 实现，后续可替换为更成熟的 EventEmitter
- 状态转换规则硬编码在 StateMachine 中
