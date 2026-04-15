# Plan: Phase 3 - 核心智能体

## Summary

实现三个核心智能体（总编、Writer、记忆管理员）的基础功能，通过共享 MemoryService 协作，完成用户输入大纲到章节生成的完整流程。

## User Story

As a **用户**, I want **通过简单命令生成章节**, so that **我只需提供故事大纲，AI 自动完成章节撰写并维护一致性**。

## Problem → Solution

无智能体系统 → 总编协调 + Writer 生成 + 记忆管理

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/ai-editorial-department.prd.md`
- **PRD Phase**: Phase 3 - 核心智能体
- **Estimated Files**: 10 个

---

## UX Design

N/A — 内部智能体系统，有简单 CLI 接口

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/memory/memoryService.ts` | all | 记忆服务接口 |
| P0 | `src/llm/openai.ts` | all | LLM 调用方式 |
| P1 | `src/types/index.ts` | all | 章节、人物类型定义 |
| P1 | `src/db/schema.sql` | all | 数据库表结构 |

---

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| LLM Prompt Engineering | 最佳实践 | 结构化 prompt 提高输出质量 |

---

## Patterns to Mirror

### AGENT_PATTERN
每个智能体是一个类，有 `act(context)` 方法返回结果

### PIPELINE_PATTERN
总编协调 → Writer 生成 → 记忆存储 → 总编审核

### CLI_PATTERN
简单的命令行交互接口

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/types/index.ts` | UPDATE | 添加项目输入、智能体结果类型 |
| `src/agents/base.ts` | CREATE | 基础智能体类 |
| `src/agents/writer.ts` | CREATE | Writer 智能体 |
| `src/agents/chiefEditor.ts` | CREATE | 总编智能体 |
| `src/agents/memoryManager.ts` | CREATE | 记忆管理员智能体 |
| `src/agents/index.ts` | CREATE | 统一导出 |
| `src/cli.ts` | CREATE | CLI 入口 |
| `src/__tests__/agents.test.ts` | CREATE | 智能体测试 |
| `src/db/schema.sql` | UPDATE | 添加 chapters 表 |
| `src/memory/chapterRepository.ts` | CREATE | 章节仓储 |

## NOT Building

- 流水线编排（Phase 4）
- 质量检测（Phase 5）
- 扩展智能体（Phase 6）

---

## Step-by-Step Tasks

### Task 1: 添加类型定义

- **ACTION**: 扩展 `src/types/index.ts`
- **IMPLEMENT**:
  ```typescript
  // 项目输入
  export interface ProjectInput {
    title: string;
    genre?: string;
    outline: string;
    characters: CreateCharacterInput[];
    worldSetting?: string;
  }

  // 章节规划
  export interface ChapterPlan {
    number: number;
    title: string;
    keyPoints: string[];
    characterStates: Record<string, string>; // 人物名 -> 本章状态
  }

  // 智能体结果
  export interface AgentResult {
    success: boolean;
    content?: string;
    error?: string;
  }

  // 章节生成结果
  export interface ChapterDraft {
    chapterId: string;
    number: number;
    title: string;
    content: string;
    plan: ChapterPlan;
  }
  ```
- **MIRROR**: 类型定义遵循现有模式
- **IMPORTS**: CreateCharacterInput
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 2: 章节仓储

- **ACTION**: 创建 `src/memory/chapterRepository.ts`
- **IMPLEMENT**:
  ```typescript
  import { getDb } from '../db/sqlite.js';
  import type { Chapter } from '../types/index.js';

  function generateId(): string {
    return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  export class ChapterRepository {
    create(input: {
      number: number;
      title: string;
      content: string;
      status?: string;
    }): Chapter {
      const db = getDb();
      const now = Date.now();
      const id = generateId();

      const stmt = db.prepare(`
        INSERT INTO chapters (id, number, title, content, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, input.number, input.title, input.content, input.status || 'draft', now, now);

      return this.findById(id)!;
    }

    findById(id: string): Chapter | undefined {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM chapters WHERE id = ?');
      const row = stmt.get(id) as ChapterRow | undefined;
      return row ? this.mapRow(row) : undefined;
    }

    findByNumber(number: number): Chapter | undefined {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM chapters WHERE number = ?');
      const row = stmt.get(number) as ChapterRow | undefined;
      return row ? this.mapRow(row) : undefined;
    }

    findAll(): Chapter[] {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM chapters ORDER BY number');
      const rows = stmt.all() as ChapterRow[];
      return rows.map((r) => this.mapRow(r));
    }

    update(id: string, input: Partial<{ title: string; content: string; status: string }>): Chapter | undefined {
      const db = getDb();
      const existing = this.findById(id);
      if (!existing) return undefined;

      const updates: string[] = [];
      const values: unknown[] = [];

      if (input.title !== undefined) {
        updates.push('title = ?');
        values.push(input.title);
      }
      if (input.content !== undefined) {
        updates.push('content = ?');
        values.push(input.content);
      }
      if (input.status !== undefined) {
        updates.push('status = ?');
        values.push(input.status);
      }

      if (updates.length === 0) return existing;

      updates.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);

      const stmt = db.prepare(`UPDATE chapters SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    }

    delete(id: string): boolean {
      const db = getDb();
      const stmt = db.prepare('DELETE FROM chapters WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    }

    private mapRow(row: ChapterRow): Chapter {
      return {
        id: row.id,
        number: row.number,
        title: row.title,
        content: row.content,
        status: row.status as Chapter['status'],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  }

  interface ChapterRow {
    id: string;
    number: number;
    title: string;
    content: string;
    status: string;
    created_at: number;
    updated_at: number;
  }

  export const chapterRepository = new ChapterRepository();
  ```
- **MIRROR**: REPOSITORY_PATTERN
- **IMPORTS**: getDb, types
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 3: 基础智能体类

- **ACTION**: 创建 `src/agents/base.ts`
- **IMPLEMENT**:
  ```typescript
  import { llm } from '../llm/openai.js';
  import { memoryService } from '../memory/memoryService.js';

  export interface AgentContext {
    projectInput?: {
      title: string;
      genre?: string;
      outline: string;
      characters?: Array<{ name: string; description: string }>;
      worldSetting?: string;
    };
    chapterPlan?: {
      number: number;
      title: string;
      keyPoints: string[];
      characterStates: Record<string, string>;
    };
    previousChapterId?: string;
    memories?: {
      characters: string[];
      events: string[];
      worldKnowledge: string[];
    };
  }

  export abstract class BaseAgent {
    protected name: string;

    constructor(name: string) {
      this.name = name;
    }

    protected async think(prompt: string): Promise<string> {
      const response = await llm.complete(prompt, {
        temperature: 0.7,
        maxTokens: 2048,
      });
      return response.text;
    }

    protected log(action: string, detail?: string): void {
      console.log(`[${this.name}] ${action}${detail ? ': ' + detail : ''}`);
    }

    abstract act(context: AgentContext): Promise<unknown>;
  }
  ```
- **MIRROR**: AGENT_PATTERN
- **IMPORTS**: llm, memoryService
- **GOTCHA**: 异步方法，think() 封装 LLM 调用
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 4: 记忆管理员

- **ACTION**: 创建 `src/agents/memoryManager.ts`
- **IMPLEMENT**:
  ```typescript
  import { BaseAgent, type AgentContext } from './base.js';
  import { memoryService } from '../memory/memoryService.js';

  export class MemoryManagerAgent extends BaseAgent {
    constructor() {
      super('记忆管理员');
    }

    async act(context: AgentContext): Promise<{
      initializedCharacters: number;
      initializedWorldKnowledge: number;
    }> {
      let initializedCharacters = 0;
      let initializedWorldKnowledge = 0;

      // 初始化人物
      if (context.projectInput?.characters) {
        for (const char of context.projectInput.characters) {
          memoryService.createCharacter({
            name: char.name,
            description: char.description,
            currentState: '待定',
          });
          initializedCharacters++;
          this.log('创建人物', char.name);
        }
      }

      // 初始化世界观
      if (context.projectInput?.worldSetting) {
        await memoryService.addWorldKnowledge(
          context.projectInput.worldSetting,
          { type: 'world_setting' }
        );
        initializedWorldKnowledge++;
        this.log('创建世界观设定');
      }

      // 存储项目大纲
      if (context.projectInput?.outline) {
        await memoryService.addWorldKnowledge(
          `故事大纲：${context.projectInput.outline}`,
          { type: 'outline' }
        );
        this.log('存储故事大纲');
      }

      return { initializedCharacters, initializedWorldKnowledge };
    }

    async saveChapterContext(chapterId: string, content: string, characterStates: Record<string, string>): Promise<void> {
      // 提取事件（简单实现：按句号分割，取前3句作为事件描述）
      const sentences = content.split(/[。！？]/).filter((s) => s.trim().length > 10);
      const keyEvents = sentences.slice(0, 3);

      for (const event of keyEvents) {
        memoryService.createEvent({
          chapterId,
          description: event.trim(),
        });
      }

      // 更新人物状态
      for (const [name, state] of Object.entries(characterStates)) {
        const char = memoryService.getCharacterByName(name);
        if (char) {
          memoryService.updateCharacter(char.id, { currentState: state });
        }
      }

      this.log('保存章节上下文', `章节 ${chapterId}`);
    }

    async retrieveMemories(context: string): Promise<{
      characters: string;
      events: string;
      worldKnowledge: string;
    }> {
      const result = await memoryService.searchMemories(context);

      return {
        characters: result.characters
          .map((c) => `${c.name}: ${c.currentState}`)
          .join('\n'),
        events: result.events.map((e) => e.description).join('\n'),
        worldKnowledge: result.worldKnowledge.map((w) => w.content).join('\n'),
      };
    }
  }

  export const memoryManagerAgent = new MemoryManagerAgent();
  ```
- **MIRROR**: AGENT_PATTERN
- **IMPORTS**: BaseAgent, memoryService
- **GOTCHA**: 事件提取是简化实现
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 5: Writer

- **ACTION**: 创建 `src/agents/writer.ts`
- **IMPLEMENT**:
  ```typescript
  import { BaseAgent, type AgentContext } from './base.js';
  import { memoryManagerAgent } from './memoryManager.js';
  import type { ChapterDraft, ChapterPlan } from '../types/index.js';
  import { chapterRepository } from '../memory/chapterRepository.js';

  export class WriterAgent extends BaseAgent {
    constructor() {
      super('Writer');
    }

    async act(context: AgentContext): Promise<ChapterDraft> {
      if (!context.chapterPlan || !context.projectInput) {
        throw new Error('缺少章节规划或项目输入');
      }

      const plan = context.chapterPlan;

      // 检索相关记忆
      const memories = await memoryManagerAgent.retrieveMemories(
        `第${plan.number}章 ${plan.title}`
      );

      // 构建 prompt
      const prompt = this.buildPrompt(plan, memories, context.projectInput);

      this.log('生成章节', `第${plan.number}章 "${plan.title}"`);

      // 调用 LLM
      const content = await this.think(prompt);

      // 保存到数据库
      const chapter = chapterRepository.create({
        number: plan.number,
        title: plan.title,
        content,
        status: 'draft',
      });

      // 更新记忆
      await memoryManagerAgent.saveChapterContext(
        chapter.id,
        content,
        plan.characterStates
      );

      this.log('章节已保存', chapter.id);

      return {
        chapterId: chapter.id,
        number: plan.number,
        title: plan.title,
        content,
        plan,
      };
    }

    private buildPrompt(
      plan: ChapterPlan,
      memories: { characters: string; events: string; worldKnowledge: string },
      project: AgentContext['projectInput']
    ): string {
      const characterContext = memories.characters
        ? `【人物状态】\n${memories.characters}\n`
        : '';
      const eventContext = memories.events
        ? `【已发生事件】\n${memories.events}\n`
        : '';
      const worldContext = memories.worldKnowledge
        ? `【世界观设定】\n${memories.worldKnowledge}\n`
        : '';

      const characterStatesText = Object.entries(plan.characterStates)
        .map(([name, state]) => `- ${name}: ${state}`)
        .join('\n');

      return `你是一位专业的小说作家，请根据以下信息撰写小说章节。

【故事背景】
标题：${project?.title || '未命名'}
类型：${project?.genre || '未知'}
大纲：${project?.outline || '未提供'}

${worldContext}
${characterContext}
${eventContext}

【本章规划】
章节号：${plan.number}
标题：${plan.title}
要点：
${plan.keyPoints.map((p) => `- ${p}`).join('\n')}

本章人物状态：
${characterStatesText}

请撰写完整的章节内容，要求：
1. 遵循上述要点
2. 保持人物状态一致性
3. 自然衔接已发生的事件
4. 字数在 1000-3000 字之间
5. 直接输出章节内容，不要加标题前缀

章节内容：
`;
    }
  }

  export const writerAgent = new WriterAgent();
  ```
- **MIRROR**: AGENT_PATTERN + PIPELINE_PATTERN
- **IMPORTS**: BaseAgent, memoryManagerAgent, chapterRepository, types
- **GOTCHA**: 依赖 memoryManagerAgent
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 6: 总编

- **ACTION**: 创建 `src/agents/chiefEditor.ts`
- **IMPLEMENT**:
  ```typescript
  import { BaseAgent, type AgentContext } from './base.js';
  import { writerAgent } from './writer.js';
  import { memoryManagerAgent } from './memoryManager.js';
  import type { ChapterPlan, ChapterDraft, ProjectInput } from '../types/index.js';

  export class ChiefEditorAgent extends BaseAgent {
    constructor() {
      super('总编');
    }

    async initializeProject(input: ProjectInput): Promise<{
      title: string;
      characterCount: number;
      worldKnowledgeCount: number;
    }> {
      this.log('初始化项目', input.title);

      // 调用记忆管理员初始化记忆
      const result = await memoryManagerAgent.act({ projectInput: input });

      return {
        title: input.title,
        characterCount: result.initializedCharacters,
        worldKnowledgeCount: result.initializedWorldKnowledge,
      };
    }

    async planChapter(
      chapterNumber: number,
      previousChapterSummary?: string
    ): Promise<ChapterPlan> {
      this.log('规划章节', `第${chapterNumber}章`);

      // 检索已有记忆
      const memories = await memoryManagerAgent.retrieveMemories(
        previousChapterSummary || '开场'
      );

      // 构建规划 prompt
      const prompt = `你是一位资深编辑，请为小说《${await this.getProjectTitle()}》规划第${chapterNumber}章。

${previousChapterSummary ? `【上一章概要】\n${previousChapterSummary}\n` : ''}
${memories.worldKnowledge ? `【世界观】\n${memories.worldKnowledge}\n` : ''}
${memories.characters ? `【人物状态】\n${memories.characters}\n` : ''}

请规划第${chapterNumber}章，要求：
1. 标题简洁有力（不超过15字）
2. 列出3-5个关键情节点
3. 明确本章各人物的状态变化
4. 自然承接上文

请以 JSON 格式输出：
{
  "title": "章节标题",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "characterStates": {"人物名": "本章状态"}
}`;
      const response = await this.think(prompt);

      // 简单解析 JSON（实际应用需要更robust的解析）
      const plan = this.parsePlan(chapterNumber, response);

      this.log('章节规划完成', plan.title);

      return plan;
    }

    async generateChapter(
      chapterNumber: number,
      previousChapterSummary?: string
    ): Promise<ChapterDraft> {
      // 1. 规划章节
      const plan = await this.planChapter(chapterNumber, previousChapterSummary);

      // 2. 调用 Writer 生成
      const projectInput = await this.getProjectInput();
      const draft = await writerAgent.act({
        projectInput,
        chapterPlan: plan,
      });

      this.log('章节生成完成', `第${chapterNumber}章`);

      return draft;
    }

    async reviewChapter(chapterId: string): Promise<{
      approved: boolean;
      feedback?: string;
    }> {
      // 简化实现：不做自动审核，只标记为已审核
      this.log('审核章节', chapterId);
      return { approved: true };
    }

    private async getProjectTitle(): Promise<string> {
      // 简化：直接从上下文获取
      return '未命名项目';
    }

    private async getProjectInput(): Promise<ProjectInput | undefined> {
      // 简化：后续从上下文获取
      return undefined;
    }

    private parsePlan(chapterNumber: number, response: string): ChapterPlan {
      try {
        // 尝试解析 JSON
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            number: chapterNumber,
            title: parsed.title || `第${chapterNumber}章`,
            keyPoints: parsed.keyPoints || [],
            characterStates: parsed.characterStates || {},
          };
        }
      } catch {
        // 解析失败，使用默认值
      }

      return {
        number: chapterNumber,
        title: `第${chapterNumber}章`,
        keyPoints: ['待补充'],
        characterStates: {},
      };
    }
  }

  export const chiefEditorAgent = new ChiefEditorAgent();
  ```
- **MIRROR**: AGENT_PATTERN + PIPELINE_PATTERN
- **IMPORTS**: BaseAgent, writerAgent, memoryManagerAgent, types
- **GOTCHA**: 简化实现，JSON 解析需要 robust 处理
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 7: 统一导出

- **ACTION**: 创建 `src/agents/index.ts`
- **IMPLEMENT**:
  ```typescript
  export { BaseAgent, type AgentContext } from './base.js';
  export { WriterAgent, writerAgent } from './writer.js';
  export { ChiefEditorAgent, chiefEditorAgent } from './chiefEditor.js';
  export { MemoryManagerAgent, memoryManagerAgent } from './memoryManager.js';
  ```
- **MIRROR**: N/A
- **IMPORTS**: 各智能体
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 8: CLI 入口

- **ACTION**: 创建 `src/cli.ts`
- **IMPLEMENT**:
  ```typescript
  #!/usr/bin/env node
  import { chiefEditorAgent } from './agents/chiefEditor.js';
  import { memoryService } from './memory/memoryService.js';
  import type { ProjectInput } from './types/index.js';

  // 简单的命令行接口
  async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'init': {
        const title = args[1] || '未命名项目';
        const outline = args.slice(2).join(' ') || '待补充';

        const input: ProjectInput = {
          title,
          outline,
          characters: [],
        };

        const result = await chiefEditorAgent.initializeProject(input);
        console.log(`\n✅ 项目 "${result.title}" 初始化完成`);
        console.log(`   人物数：${result.characterCount}`);
        console.log(`   世界观知识：${result.worldKnowledgeCount}`);
        break;
      }

      case 'status': {
        const characters = memoryService.getAllCharacters();
        const events = memoryService.getAllEvents();

        console.log(`\n📊 项目状态`);
        console.log(`   人物数：${characters.length}`);
        console.log(`   事件数：${events.length}`);

        if (characters.length > 0) {
          console.log('\n👤 人物状态：');
          for (const char of characters) {
            console.log(`   - ${char.name}: ${char.currentState}`);
          }
        }
        break;
      }

      case 'generate': {
        const chapterNumber = parseInt(args[1] || '1', 10);

        console.log(`\n📝 正在生成第${chapterNumber}章...`);
        const draft = await chiefEditorAgent.generateChapter(chapterNumber);

        console.log(`\n✅ 第${draft.number}章 "${draft.title}" 生成完成`);
        console.log(`   章节ID：${draft.chapterId}`);
        console.log(`   字数：${draft.content.length}`);
        console.log('\n--- 内容预览 ---');
        console.log(draft.content.slice(0, 200) + '...');
        break;
      }

      default:
        console.log(`
  AI 编辑部系统 CLI

  用法：
    npm run cli -- init <标题> <大纲>
    npm run cli -- status
    npm run cli -- generate <章节号>

  示例：
    npm run cli -- init 我的小说 "一个关于勇气和友谊的故事"
    npm run cli -- status
    npm run cli -- generate 1
        `);
    }
  }

  main().catch(console.error);
  ```
- **MIRROR**: CLI_PATTERN
- **IMPORTS**: chiefEditorAgent, memoryService, types
- **GOTCHA**: 实际需要完善参数解析
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 9: 更新 package.json scripts

- **ACTION**: 更新 `package.json`
- **IMPLEMENT**:
  ```json
  {
    "scripts": {
      "dev": "tsx src/index.ts",
      "cli": "tsx src/cli.ts",
      "build": "tsc",
      "test": "vitest run",
      "test:watch": "vitest",
      "typecheck": "tsc --noEmit"
    }
  }
  ```
- **MIRROR**: N/A
- **IMPORTS**: N/A
- **GOTCHA**: 无
- **VALIDATE**: `cat package.json | grep cli`

### Task 10: 测试

- **ACTION**: 创建 `src/__tests__/agents.test.ts`
- **IMPLEMENT**:
  ```typescript
  import { describe, it, expect } from 'vitest';
  import { ChiefEditorAgent } from '../agents/chiefEditor.js';
  import { MemoryManagerAgent } from '../agents/memoryManager.js';

  describe('智能体', () => {
    describe('ChiefEditorAgent', () => {
      it('应初始化项目', async () => {
        const agent = new ChiefEditorAgent();
        const result = await agent.initializeProject({
          title: '测试小说',
          outline: '一个测试故事',
          characters: [
            { name: '张三', description: '主角' },
          ],
        });
        expect(result.title).toBe('测试小说');
        expect(result.characterCount).toBe(1);
      });

      it('应规划章节', async () => {
        const agent = new ChiefEditorAgent();
        // 需要先初始化
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
    });
  });
  ```
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: vitest, agents
- **GOTCHA**: 需要 LLM API key 才能运行
- **VALIDATE**: `vitest run` 所有测试通过（或 skip）

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| ChiefEditorAgent.initializeProject | 有效输入 | 返回初始化结果 | 缺少必填字段 |
| ChiefEditorAgent.planChapter | 章节号 | 返回章节规划 | LLM 调用失败 |
| MemoryManagerAgent.act | 项目输入 | 返回初始化统计 | 无人物/世界观 |

### Edge Cases Checklist

- [x] 缺少项目输入 — 抛出明确错误
- [x] LLM 调用失败 — 捕获异常并传播
- [x] 无记忆可用 — 返回空结果

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
EXPECT: All agent tests pass (or skip if no API key)

### Build

```bash
npm run build
```
EXPECT: dist/ 包含 agents/ 目录

---

## Acceptance Criteria

- [ ] ChiefEditorAgent — initializeProject, planChapter, generateChapter
- [ ] WriterAgent — act 生成章节
- [ ] MemoryManagerAgent — 初始化记忆, saveChapterContext, retrieveMemories
- [ ] ChapterRepository — CRUD
- [ ] CLI — init, status, generate 命令
- [ ] 类型定义 — ProjectInput, ChapterPlan, ChapterDraft

---

## Completion Checklist

- [ ] 所有任务完成
- [ ] 无 TypeScript 类型错误
- [ ] 测试通过
- [ ] Build 成功
- [ ] 代码遵循 Phase 1-2 模式

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LLM 输出不稳定 | H | M | 使用结构化 prompt + JSON 解析 |
| 人物状态更新遗漏 | M | H | 确保章节生成后调用 saveChapterContext |

---

## Notes

- 智能体间通信：Writer 直接调用 MemoryManager，ChiefEditor 协调 Writer
- 总编负责任务调度但不直接处理记忆
- JSON 解析是简化实现，后续需要 robust 解析
