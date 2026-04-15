import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Pipeline } from '../pipeline/pipeline.js';
import { taskQueue } from '../pipeline/taskQueue.js';
import { globalEventBus } from '../pipeline/eventBus.js';
import { initDb, resetDb, disableForeignKeys, enableForeignKeys, cleanDb } from '../db/sqlite.js';
import type { ProjectInput } from '../types/index.js';

describe('Pipeline', () => {
  const testProjectInput: ProjectInput = {
    title: '测试小说',
    outline: '一个关于勇气和友谊的故事',
    characters: [
      { name: '张三', description: '主角', currentState: '待定' },
      { name: '李四', description: '配角', currentState: '待定' },
    ],
    genre: '奇幻',
    worldSetting: '一个魔法世界',
  };

  beforeEach(() => {
    cleanDb();
    initDb();
    disableForeignKeys();
    resetDb();
    taskQueue.reset(); // 重置任务队列
    globalEventBus.clear(); // 清除事件监听器累积
  });

  afterEach(() => {
    enableForeignKeys();
  });

  describe('createChapter', () => {
    it('应创建章节任务', async () => {
      const pipeline = new Pipeline();
      const task = await pipeline.createChapter(1);

      expect(task.chapterNumber).toBe(1);
      expect(task.status).toBe('pending');
      expect(task.id).toBeDefined();
    });

    it('应创建多个章节任务', async () => {
      const pipeline = new Pipeline();
      const task1 = await pipeline.createChapter(1);
      const task2 = await pipeline.createChapter(2);

      expect(task1.chapterNumber).toBe(1);
      expect(task2.chapterNumber).toBe(2);
      expect(task1.id).not.toBe(task2.id);
    });
  });

  describe('setProjectInput', () => {
    it('应设置项目输入', async () => {
      const pipeline = new Pipeline();
      pipeline.setProjectInput(testProjectInput);

      // 通过 startWriting 验证 projectInput 已设置
      const task = await pipeline.createChapter(1);
      // 由于没有 LLM，这里只验证不抛异常
      expect(task.id).toBeDefined();
    });
  });

  describe('getStatus', () => {
    it('应返回正确的状态统计', async () => {
      const pipeline = new Pipeline();
      pipeline.setProjectInput(testProjectInput);

      await pipeline.createChapter(1);
      await pipeline.createChapter(2);
      await pipeline.createChapter(3);

      const status = pipeline.getStatus();

      expect(status.total).toBe(3);
      expect(status.pending).toBe(3);
      expect(status.processing).toBe(0);
      expect(status.completed).toBe(0);
    });

    it('应正确计算进行中的任务', async () => {
      const pipeline = new Pipeline();
      pipeline.setProjectInput(testProjectInput);

      const task1 = await pipeline.createChapter(1);
      const task2 = await pipeline.createChapter(2);

      // 模拟任务状态变化
      taskQueue.updateTaskStatus(task1.id, 'writing');
      taskQueue.updateTaskStatus(task2.id, 'approved');

      const status = pipeline.getStatus();

      expect(status.total).toBe(2);
      expect(status.pending).toBe(0);
      expect(status.processing).toBe(1);
      expect(status.completed).toBe(1);
    });
  });

  describe('run', () => {
    it('应创建多个章节任务', async () => {
      const pipeline = new Pipeline();
      pipeline.setProjectInput(testProjectInput);

      const tasks = await pipeline.run([1, 2, 3]);

      expect(tasks).toHaveLength(3);
      expect(tasks[0].chapterNumber).toBe(1);
      expect(tasks[1].chapterNumber).toBe(2);
      expect(tasks[2].chapterNumber).toBe(3);
    });
  });
});
