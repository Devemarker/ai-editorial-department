import { globalEventBus } from './eventBus.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { generateId } from '../lib/id.js';
import type { PipelineTask, PipelineEvent } from '../types/index.js';

export class TaskQueue {
  private tasks: Map<string, PipelineTask> = new Map();
  private processing: Set<string> = new Set();

  createTask(chapterNumber: number): PipelineTask {
    const id = generateId('task');
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

    // 创建新对象而非修改原对象（不可变性）
    const updatedTask: PipelineTask = {
      ...task,
      status,
      updatedAt: Date.now(),
      ...extra,
    };
    this.tasks.set(taskId, updatedTask);

    // 持久化章节ID
    if (extra?.chapterId) {
      const chapter = chapterRepository.findById(extra.chapterId);
      if (chapter) {
        chapterRepository.update(extra.chapterId, { status });
      }
    }

    return updatedTask;
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
    return Array.from(this.tasks.values()).slice().sort((a, b) => a.chapterNumber - b.chapterNumber);
  }

  // 重置队列状态（用于测试）
  reset(): void {
    this.tasks.clear();
    this.processing.clear();
  }
}

export const taskQueue = new TaskQueue();
