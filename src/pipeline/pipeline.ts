import { globalEventBus } from './eventBus.js';
import { taskQueue } from './taskQueue.js';
import { writerAgent } from '../agents/writer.js';
import { contentEditorAgent } from '../agents/contentEditor.js';
import { proofreaderAgent } from '../agents/proofreader.js';
import type { PipelineTask, PipelineEvent, ProjectInput, PipelineConfig } from '../types/index.js';

export class Pipeline {
  private config: PipelineConfig;
  private projectInput?: ProjectInput;

  constructor(config?: Partial<PipelineConfig>) {
    this.config = {
      autoWriting: config?.autoWriting ?? true,
      autoEditing: config?.autoEditing ?? true, // 启用自动编辑
      autoProofreading: config?.autoProofreading ?? true, // 启用自动校对
      requireApproval: config?.requireApproval ?? false, // 默认自动批准
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

    // 写作完成 → 自动编辑
    globalEventBus.on<PipelineEvent>('task:written', async (e) => {
      if (this.config.autoEditing) {
        this.startEditing(e.taskId);
      }
    });

    // 编辑完成 → 自动校对
    globalEventBus.on<PipelineEvent>('task:edited', async (e) => {
      if (this.config.autoProofreading) {
        this.startProofreading(e.taskId);
      }
    });

    // 校对完成 → 批准
    globalEventBus.on<PipelineEvent>('task:proofread', async (e) => {
      if (this.config.requireApproval) {
        globalEventBus.emit('task:rejected', { type: 'task:rejected', taskId: e.taskId, reason: '需要人工审核' });
      } else {
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

      const draft = await writerAgent.act({
        projectInput: this.projectInput,
        chapterPlan: {
          number: task.chapterNumber,
          title: `第${task.chapterNumber}章`,
          keyPoints: [],
          characterStates: {},
        },
      });

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

  async startEditing(taskId: string): Promise<void> {
    const task = taskQueue.getTask(taskId);
    if (!task) return;

    globalEventBus.emit<PipelineEvent>('task:editing', { type: 'task:editing', taskId });

    try {
      await contentEditorAgent.act({
        chapterPlan: {
          number: task.chapterNumber,
          title: `第${task.chapterNumber}章`,
          keyPoints: [],
          characterStates: {},
        },
      });

      globalEventBus.emit<PipelineEvent>('task:edited', { type: 'task:edited', taskId });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      globalEventBus.emit<PipelineEvent>('task:error', { type: 'task:error', taskId, error });
    }
  }

  async startProofreading(taskId: string): Promise<void> {
    const task = taskQueue.getTask(taskId);
    if (!task) return;

    globalEventBus.emit<PipelineEvent>('task:proofreading', { type: 'task:proofreading', taskId });

    try {
      await proofreaderAgent.act({
        chapterPlan: {
          number: task.chapterNumber,
          title: `第${task.chapterNumber}章`,
          keyPoints: [],
          characterStates: {},
        },
      });

      globalEventBus.emit<PipelineEvent>('task:proofread', { type: 'task:proofread', taskId });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      globalEventBus.emit<PipelineEvent>('task:error', { type: 'task:error', taskId, error });
    }
  }

  async run(chapterNumbers: number[]): Promise<PipelineTask[]> {
    const tasks: PipelineTask[] = [];

    for (const num of chapterNumbers) {
      const task = await this.createChapter(num);
      tasks.push(task);
    }

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
