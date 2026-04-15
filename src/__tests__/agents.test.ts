import { describe, it, expect, beforeEach } from 'vitest';
import { ChiefEditorAgent } from '../agents/chiefEditor.js';
import { MemoryManagerAgent } from '../agents/memoryManager.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { resetDb, initDb, disableForeignKeys } from '../db/sqlite.js';

// 跳过 ChromaDB 依赖的测试（需要 ChromaDB 服务运行）
const skipChroma = !process.env.CHROMA_PATH;

describe('智能体', () => {
  beforeEach(() => {
    resetDb();
    initDb();
    disableForeignKeys();
  });

  describe('ChiefEditorAgent', () => {
    if (skipChroma) {
      it.skip('需要 ChromaDB 服务', () => {});
      return;
    }

    it('应初始化项目', async () => {
      const agent = new ChiefEditorAgent();
      const result = await agent.initializeProject({
        title: '测试小说',
        outline: '一个测试故事',
        characters: [{ name: '张三', description: '主角' }],
      });
      expect(result.title).toBe('测试小说');
      expect(result.characterCount).toBe(1);
    });

    it('应规划章节', async () => {
      const agent = new ChiefEditorAgent();
      await agent.initializeProject({
        title: '测试小说',
        outline: '测试大纲',
        characters: [{ name: '张三', description: '主角' }],
      });

      const plan = await agent.planChapter(1);
      expect(plan.number).toBe(1);
      expect(plan.title).toBeDefined();
    });
  });

  describe('MemoryManagerAgent', () => {
    if (skipChroma) {
      it.skip('需要 ChromaDB 服务', () => {});
      return;
    }

    it('应初始化人物', async () => {
      const agent = new MemoryManagerAgent();
      const result = await agent.act({
        projectInput: {
          title: '测试',
          outline: '测试大纲',
          characters: [{ name: '李四', description: '配角' }],
        },
      });
      expect(result.initializedCharacters).toBe(1);
    });

    it('应检索记忆', async () => {
      const agent = new MemoryManagerAgent();
      await agent.act({
        projectInput: {
          title: '测试',
          outline: '测试大纲',
          characters: [],
        },
      });

      const memories = await agent.retrieveMemories('测试');
      expect(memories.worldKnowledge).toBeDefined();
    });
  });

  describe('ChapterRepository', () => {
    it('应创建章节', () => {
      const chapter = chapterRepository.create({
        number: 1,
        title: '第一章',
        content: '测试内容',
        status: 'draft',
      });
      expect(chapter.number).toBe(1);
      expect(chapter.title).toBe('第一章');
    });

    it('应按章节号查找', () => {
      chapterRepository.create({
        number: 2,
        title: '第二章',
        content: '测试内容2',
      });
      const found = chapterRepository.findByNumber(2);
      expect(found?.title).toBe('第二章');
    });
  });
});
