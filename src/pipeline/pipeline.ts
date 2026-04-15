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
