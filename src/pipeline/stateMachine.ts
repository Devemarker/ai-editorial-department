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
      if (e.type !== 'task:error') return;
      taskQueue.updateTaskStatus(e.taskId, 'rejected', { error: e.error });
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
