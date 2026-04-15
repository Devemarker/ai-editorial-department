import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { taskQueue } from '../pipeline/taskQueue.js';
import { stateMachine } from '../pipeline/stateMachine.js';
import { globalEventBus } from '../pipeline/eventBus.js';
import { initDb, resetDb, disableForeignKeys, enableForeignKeys, cleanDb } from '../db/sqlite.js';

describe('StateMachine', () => {
  beforeEach(() => {
    cleanDb();
    initDb();
    disableForeignKeys();
    // 重置状态
    resetDb();
  });

  afterEach(() => {
    enableForeignKeys();
  });

  describe('状态转换验证', () => {
    it('应允许有效的状态转换', () => {
      const task = taskQueue.createTask(1);
      expect(stateMachine.canTransition(task.id, 'writing')).toBe(true);
    });

    it('应拒绝无效的状态转换', () => {
      const task = taskQueue.createTask(1);
      // pending -> proofreading 是无效的
      expect(stateMachine.canTransition(task.id, 'proofreading')).toBe(false);
    });

    it('应拒绝从 approved 状态转换', () => {
      const task = taskQueue.createTask(1);
      taskQueue.updateTaskStatus(task.id, 'approved');
      // approved -> 任何状态都无效
      expect(stateMachine.canTransition(task.id, 'writing')).toBe(false);
      expect(stateMachine.canTransition(task.id, 'editing')).toBe(false);
    });

    it('应允许 rejected -> pending 转换（重新生成）', () => {
      const task = taskQueue.createTask(1);
      taskQueue.updateTaskStatus(task.id, 'rejected');
      expect(stateMachine.canTransition(task.id, 'pending')).toBe(true);
    });
  });

  describe('完整流水线转换', () => {
    it('应遵循 pending -> writing -> editing -> proofreading -> approved', () => {
      const task = taskQueue.createTask(1);

      expect(task.status).toBe('pending');
      expect(stateMachine.transition(task.id, 'writing')).toBe(true);

      const updated1 = taskQueue.getTask(task.id);
      expect(updated1?.status).toBe('writing');

      expect(stateMachine.transition(task.id, 'editing')).toBe(true);
      const updated2 = taskQueue.getTask(task.id);
      expect(updated2?.status).toBe('editing');

      expect(stateMachine.transition(task.id, 'proofreading')).toBe(true);
      const updated3 = taskQueue.getTask(task.id);
      expect(updated3?.status).toBe('proofreading');

      expect(stateMachine.transition(task.id, 'approved')).toBe(true);
      const updated4 = taskQueue.getTask(task.id);
      expect(updated4?.status).toBe('approved');
    });

    it('应在任意阶段支持 rejected', () => {
      const task = taskQueue.createTask(1);

      taskQueue.updateTaskStatus(task.id, 'writing');
      expect(stateMachine.transition(task.id, 'rejected')).toBe(true);

      taskQueue.updateTaskStatus(task.id, 'editing');
      expect(stateMachine.transition(task.id, 'rejected')).toBe(true);

      taskQueue.updateTaskStatus(task.id, 'proofreading');
      expect(stateMachine.transition(task.id, 'rejected')).toBe(true);
    });
  });

  describe('错误处理', () => {
    it('应处理不存在的任务', () => {
      expect(stateMachine.transition('nonexistent', 'writing')).toBe(false);
      expect(stateMachine.canTransition('nonexistent', 'writing')).toBe(false);
    });
  });
});
