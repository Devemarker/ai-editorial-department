import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { characterRepository } from '../memory/characterRepository.js';
import { eventRepository } from '../memory/eventRepository.js';
import { initDb, resetDb, disableForeignKeys, enableForeignKeys, cleanDb } from '../db/sqlite.js';

describe('记忆仓储', () => {
  beforeEach(() => {
    cleanDb(); // 清理数据库文件确保隔离
    initDb();
    disableForeignKeys(); // 测试时禁用外键约束
  });

  afterEach(() => {
    enableForeignKeys();
  });

  describe('CharacterRepository', () => {
    it('应创建人物', () => {
      const char = characterRepository.create({
        name: '张三',
        description: '主角',
        currentState: '在家中',
      });
      expect(char.name).toBe('张三');
      expect(char.currentState).toBe('在家中');
      expect(char.id).toBeDefined();
    });

    it('应按 ID 查找人物', () => {
      const created = characterRepository.create({ name: '李四' });
      const found = characterRepository.findById(created.id);
      expect(found?.name).toBe('李四');
    });

    it('应按名称查找人物', () => {
      characterRepository.create({ name: '王五' });
      const found = characterRepository.findByName('王五');
      expect(found?.name).toBe('王五');
    });

    it('应更新人物状态', () => {
      const created = characterRepository.create({ name: '赵六', currentState: '初始' });
      const updated = characterRepository.update(created.id, { currentState: '已改变' });
      expect(updated?.currentState).toBe('已改变');
    });

    it('应删除人物', () => {
      const created = characterRepository.create({ name: '孙七' });
      const deleted = characterRepository.delete(created.id);
      expect(deleted).toBe(true);
      expect(characterRepository.findById(created.id)).toBeUndefined();
    });

    it('应列出所有人物', () => {
      characterRepository.create({ name: '甲' });
      characterRepository.create({ name: '乙' });
      const all = characterRepository.findAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it('应处理不存在的 ID', () => {
      expect(characterRepository.findById('nonexistent')).toBeUndefined();
      expect(characterRepository.update('nonexistent', { currentState: 'x' })).toBeUndefined();
      expect(characterRepository.delete('nonexistent')).toBe(false);
    });
  });

  describe('EventRepository', () => {
    it('应创建事件', () => {
      const chapterId = 'test_chapter_1';
      const evt = eventRepository.create({
        chapterId,
        description: '主角开始冒险',
      });
      expect(evt.description).toBe('主角开始冒险');
      expect(evt.chapterId).toBe(chapterId);
      expect(evt.id).toBeDefined();
    });

    it('应按章节查找事件', () => {
      const chapterId = 'test_chapter_2';
      eventRepository.create({ chapterId, description: '事件1' });
      eventRepository.create({ chapterId, description: '事件2' });

      const events = eventRepository.findByChapterId(chapterId);
      expect(events).toHaveLength(2);
    });

    it('应列出所有事件', () => {
      eventRepository.create({ chapterId: 'c1', description: 'e1' });
      eventRepository.create({ chapterId: 'c2', description: 'e2' });
      const all = eventRepository.findAll();
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it('应删除事件', () => {
      const created = eventRepository.create({ chapterId: 'c1', description: 'e1' });
      const deleted = eventRepository.delete(created.id);
      expect(deleted).toBe(true);
      expect(eventRepository.findById(created.id)).toBeUndefined();
    });
  });
});
