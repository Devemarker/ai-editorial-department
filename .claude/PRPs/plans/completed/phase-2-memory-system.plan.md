# Plan: Phase 2 - 记忆系统

## Summary

实现混合记忆存储和检索系统，包含结构化数据存储（SQLite）和向量存储（ChromaDB），提供统一的记忆提取接口。核心是记忆仓储层，供 Phase 3 的智能体调用。

## User Story

As a **AI 智能体（总编/Writer/记忆管理员）**, I want **存储和检索人物状态、事件时间线、世界观知识**, so that **我可以在生成章节时引用之前的上下文，保持长篇一致性**。

## Problem → Solution

无记忆系统 → 混合记忆存储（SQLite 精确 + ChromaDB 语义）

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/ai-editorial-department.prd.md`
- **PRD Phase**: Phase 2 - 记忆系统
- **Estimated Files**: 8 个

---

## UX Design

N/A — 内部基础设施，无用户界面

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/types/index.ts` | all | 已定义 CharacterState, StoryEvent, WorldRule |
| P0 | `src/db/sqlite.ts` | all | 单例模式，getDb() 接口 |
| P1 | `src/vector/chroma.ts` | all | ChromaDB 封装，集合操作 |
| P1 | `src/db/schema.sql` | all | 数据库表结构 |

---

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| ChromaDB JS SDK | npm: chromadb | Collection add/query API |
| better-sqlite3 | npm | 同步 API，prepare().get() |

---

## Patterns to Mirror

### SINGLETON_PATTERN
// SOURCE: src/db/sqlite.ts:13-24
单例 getDb() 函数，首次调用时初始化

### REPOSITORY_PATTERN
每个仓储类负责单一实体的 CRUD，返回类型化对象

### HYBRID_SEARCH
精确匹配（SQLite WHERE）+ 语义搜索（ChromaDB query）组合

---

## Files to Change

| File | Action | Justification |
|------|--------|---------------|
| `src/memory/characterRepository.ts` | CREATE | 人物状态 CRUD |
| `src/memory/eventRepository.ts` | CREATE | 事件时间线 CRUD |
| `src/memory/worldKnowledgeRepository.ts` | CREATE | 世界观向量存储 |
| `src/memory/memoryService.ts` | CREATE | 统一检索接口 |
| `src/memory/index.ts` | CREATE | 统一导出 |
| `src/__tests__/memory.test.ts` | CREATE | 记忆系统测试 |
| `src/types/index.ts` | UPDATE | 添加检索结果类型 |

## NOT Building

- 智能体集成（Phase 3）
- 流水线编排（Phase 4）
- 质量检测（Phase 5）

---

## Step-by-Step Tasks

### Task 1: 添加记忆检索结果类型

- **ACTION**: 扩展 `src/types/index.ts`
- **IMPLEMENT**:
  ```typescript
  // 记忆检索结果
  export interface MemorySearchResult {
    characters: CharacterState[];
    events: StoryEvent[];
    worldKnowledge: WorldKnowledgeItem[];
  }

  export interface WorldKnowledgeItem {
    id: string;
    content: string;
    metadata: Record<string, string>;
  }

  // 人物创建/更新 DTO
  export interface CreateCharacterInput {
    name: string;
    description?: string;
    currentState?: string;
    relationships?: Record<string, string>;
  }

  export interface UpdateCharacterInput {
    description?: string;
    currentState?: string;
    relationships?: Record<string, string>;
  }

  // 事件创建 DTO
  export interface CreateEventInput {
    chapterId: string;
    description: string;
    timestampInStory?: number;
  }
  ```
- **MIRROR**: 类型定义遵循现有模式
- **IMPORTS**: 无新增
- **GOTCHA**: relationships 存为 JSON 字符串
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 2: 人物状态仓储

- **ACTION**: 创建 `src/memory/characterRepository.ts`
- **IMPLEMENT**:
  ```typescript
  import { getDb } from '../db/sqlite.js';
  import { config } from '../config/index.js';
  import type { CharacterState, CreateCharacterInput, UpdateCharacterInput } from '../types/index.js';

  function generateId(): string {
    return `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  export class CharacterRepository {
    create(input: CreateCharacterInput): CharacterState {
      const db = getDb();
      const now = Date.now();
      const id = generateId();
      const relationships = JSON.stringify(input.relationships || {});

      const stmt = db.prepare(`
        INSERT INTO characters (id, name, description, current_state, relationships, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(id, input.name, input.description || '', input.currentState || '', relationships, now, now);

      return this.findById(id)!;
    }

    findById(id: string): CharacterState | undefined {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM characters WHERE id = ?');
      const row = stmt.get(id) as CharacterRow | undefined;
      return row ? this.mapRow(row) : undefined;
    }

    findByName(name: string): CharacterState | undefined {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM characters WHERE name = ?');
      const row = stmt.get(name) as CharacterRow | undefined;
      return row ? this.mapRow(row) : undefined;
    }

    findAll(): CharacterState[] {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM characters ORDER BY created_at');
      const rows = stmt.all() as CharacterRow[];
      return rows.map((r) => this.mapRow(r));
    }

    update(id: string, input: UpdateCharacterInput): CharacterState | undefined {
      const db = getDb();
      const existing = this.findById(id);
      if (!existing) return undefined;

      const updates: string[] = [];
      const values: unknown[] = [];

      if (input.description !== undefined) {
        updates.push('description = ?');
        values.push(input.description);
      }
      if (input.currentState !== undefined) {
        updates.push('current_state = ?');
        values.push(input.currentState);
      }
      if (input.relationships !== undefined) {
        updates.push('relationships = ?');
        values.push(JSON.stringify(input.relationships));
      }

      if (updates.length === 0) return existing;

      updates.push('updated_at = ?');
      values.push(Date.now());
      values.push(id);

      const stmt = db.prepare(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`);
      stmt.run(...values);

      return this.findById(id);
    }

    delete(id: string): boolean {
      const db = getDb();
      const stmt = db.prepare('DELETE FROM characters WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    }

    private mapRow(row: CharacterRow): CharacterState {
      return {
        id: row.id,
        name: row.name,
        description: row.description,
        currentState: row.current_state,
        relationships: JSON.parse(row.relationships),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }
  }

  interface CharacterRow {
    id: string;
    name: string;
    description: string;
    current_state: string;
    relationships: string;
    created_at: number;
    updated_at: number;
  }

  export const characterRepository = new CharacterRepository();
  ```
- **MIRROR**: REPOSITORY_PATTERN — 单表 CRUD
- **IMPORTS**: getDb, config, types
- **GOTCHA**: relationships 序列化为 JSON 字符串存储
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 3: 事件时间线仓储

- **ACTION**: 创建 `src/memory/eventRepository.ts`
- **IMPLEMENT**:
  ```typescript
  import { getDb } from '../db/sqlite.js';
  import type { StoryEvent, CreateEventInput } from '../types/index.js';

  function generateId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  export class EventRepository {
    create(input: CreateEventInput): StoryEvent {
      const db = getDb();
      const now = Date.now();
      const id = generateId();

      const stmt = db.prepare(`
        INSERT INTO events (id, chapter_id, description, timestamp_in_story, created_at)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(id, input.chapterId, input.description, input.timestampInStory || 0, now);

      return this.findById(id)!;
    }

    findById(id: string): StoryEvent | undefined {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM events WHERE id = ?');
      const row = stmt.get(id) as EventRow | undefined;
      return row ? this.mapRow(row) : undefined;
    }

    findByChapterId(chapterId: string): StoryEvent[] {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM events WHERE chapter_id = ? ORDER BY timestamp_in_story');
      const rows = stmt.all(chapterId) as EventRow[];
      return rows.map((r) => this.mapRow(r));
    }

    findAll(): StoryEvent[] {
      const db = getDb();
      const stmt = db.prepare('SELECT * FROM events ORDER BY timestamp_in_story');
      const rows = stmt.all() as EventRow[];
      return rows.map((r) => this.mapRow(r));
    }

    delete(id: string): boolean {
      const db = getDb();
      const stmt = db.prepare('DELETE FROM events WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    }

    deleteByChapterId(chapterId: string): number {
      const db = getDb();
      const stmt = db.prepare('DELETE FROM events WHERE chapter_id = ?');
      const result = stmt.run(chapterId);
      return result.changes;
    }

    private mapRow(row: EventRow): StoryEvent {
      return {
        id: row.id,
        chapterId: row.chapter_id,
        description: row.description,
        timestampInStory: row.timestamp_in_story,
        createdAt: row.created_at,
      };
    }
  }

  interface EventRow {
    id: string;
    chapter_id: string;
    description: string;
    timestamp_in_story: number;
    created_at: number;
  }

  export const eventRepository = new EventRepository();
  ```
- **MIRROR**: REPOSITORY_PATTERN
- **IMPORTS**: getDb, types
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 4: 世界观向量仓储

- **ACTION**: 创建 `src/memory/worldKnowledgeRepository.ts`
- **IMPLEMENT**:
  ```typescript
  import { ChromaClient, Collection } from 'chromadb';
  import { getChromaClient, WORLD_COLLECTION } from '../vector/chroma.js';
  import { llm } from '../llm/openai.js';
  import type { WorldKnowledgeItem } from '../types/index.js';

  let collection: Collection | null = null;

  async function getCollection(): Promise<Collection> {
    if (!collection) {
      const client = getChromaClient();
      collection = await client.getOrCreateCollection({ name: WORLD_COLLECTION });
    }
    return collection;
  }

  export class WorldKnowledgeRepository {
    async add(content: string, metadata: Record<string, string> = {}): Promise<WorldKnowledgeItem> {
      const col = await getCollection();
      const id = `world_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const embedding = await llm.embed([content]);

      await col.add({
        ids: [id],
        embeddings: embedding,
        documents: [content],
        metadatas: [metadata],
      });

      return { id, content, metadata };
    }

    async addBatch(items: Array<{ content: string; metadata?: Record<string, string> }>): Promise<WorldKnowledgeItem[]> {
      const col = await getCollection();
      const texts = items.map((i) => i.content);
      const embeddings = await llm.embed(texts);
      const ids = items.map(
        (_, i) => `world_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${i}`
      );
      const metadatas = items.map((i) => i.metadata || {});

      await col.add({
        ids,
        embeddings,
        documents: texts,
        metadatas,
      });

      return items.map((item, i) => ({
        id: ids[i],
        content: item.content,
        metadata: item.metadata || {},
      }));
    }

    async search(query: string, nResults: number = 5): Promise<WorldKnowledgeItem[]> {
      const col = await getCollection();
      const queryEmbedding = await llm.embed([query]);

      const results = await col.query({
        queryEmbeddings: queryEmbedding,
        nResults,
      });

      const ids = results.ids[0] || [];
      const documents = (results.documents[0] || []).filter((d): d is string => d !== null);
      const metadatas = (results.metadatas?.[0] || []) as Record<string, string>[];

      return ids.map((id, i) => ({
        id,
        content: documents[i] || '',
        metadata: metadatas[i] || {},
      }));
    }

    async delete(id: string): Promise<boolean> {
      const col = await getCollection();
      try {
        await col.delete({ ids: [id] });
        return true;
      } catch {
        return false;
      }
    }
  }

  export const worldKnowledgeRepository = new WorldKnowledgeRepository();
  ```
- **MIRROR**: ChromaDB 封装模式
- **IMPORTS**: chromadb, getChromaClient, llm
- **GOTCHA**: ChromaDB 需要服务运行；embed 调用 LLM
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 5: 统一记忆服务

- **ACTION**: 创建 `src/memory/memoryService.ts`
- **IMPLEMENT**:
  ```typescript
  import { characterRepository } from './characterRepository.js';
  import { eventRepository } from './eventRepository.js';
  import { worldKnowledgeRepository } from './worldKnowledgeRepository.js';
  import type { MemorySearchResult, CreateCharacterInput, UpdateCharacterInput, CreateEventInput } from '../types/index.js';

  export class MemoryService {
    // === 人物管理 ===
    createCharacter(input: CreateCharacterInput) {
      return characterRepository.create(input);
    }

    getCharacter(id: string) {
      return characterRepository.findById(id);
    }

    getCharacterByName(name: string) {
      return characterRepository.findByName(name);
    }

    getAllCharacters() {
      return characterRepository.findAll();
    }

    updateCharacter(id: string, input: UpdateCharacterInput) {
      return characterRepository.update(id, input);
    }

    deleteCharacter(id: string) {
      return characterRepository.delete(id);
    }

    // === 事件管理 ===
    createEvent(input: CreateEventInput) {
      return eventRepository.create(input);
    }

    getEvent(id: string) {
      return eventRepository.findById(id);
    }

    getEventsByChapter(chapterId: string) {
      return eventRepository.findByChapterId(chapterId);
    }

    getAllEvents() {
      return eventRepository.findAll();
    }

    deleteEvent(id: string) {
      return eventRepository.delete(id);
    }

    // === 世界观知识管理 ===
    async addWorldKnowledge(content: string, metadata?: Record<string, string>) {
      return await worldKnowledgeRepository.add(content, metadata);
    }

    async searchWorldKnowledge(query: string, nResults: number = 5) {
      return await worldKnowledgeRepository.search(query, nResults);
    }

    async deleteWorldKnowledge(id: string) {
      return await worldKnowledgeRepository.delete(id);
    }

    // === 混合检索 ===
    async searchMemories(context: string, options: {
      includeCharacters?: boolean;
      includeEvents?: boolean;
      includeWorld?: boolean;
      maxResults?: number;
    } = {}): Promise<MemorySearchResult> {
      const {
        includeCharacters = true,
        includeEvents = true,
        includeWorld = true,
        maxResults = 5,
      } = options;

      const result: MemorySearchResult = {
        characters: [],
        events: [],
        worldKnowledge: [],
      };

      if (includeCharacters) {
        // 精确搜索人物（按名称）
        result.characters = characterRepository.findAll().slice(0, maxResults);
      }

      if (includeEvents) {
        // 精确搜索事件
        result.events = eventRepository.findAll().slice(0, maxResults);
      }

      if (includeWorld) {
        // 语义搜索世界观
        result.worldKnowledge = await worldKnowledgeRepository.search(context, maxResults);
      }

      return result;
    }
  }

  export const memoryService = new MemoryService();
  ```
- **MIRROR**: SERVICE_PATTERN — 组合多个仓储
- **IMPORTS**: characterRepository, eventRepository, worldKnowledgeRepository
- **GOTCHA**: 混合检索中人物/事件用精确，worldKnowledge 用语义
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 6: 统一导出

- **ACTION**: 创建 `src/memory/index.ts`
- **IMPLEMENT**:
  ```typescript
  export { characterRepository, CharacterRepository } from './characterRepository.js';
  export { eventRepository, EventRepository } from './eventRepository.js';
  export { worldKnowledgeRepository, WorldKnowledgeRepository } from './worldKnowledgeRepository.js';
  export { memoryService, MemoryService } from './memoryService.js';
  ```
- **MIRROR**: N/A
- **IMPORTS**: 各仓储
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 7: 测试

- **ACTION**: 创建 `src/__tests__/memory.test.ts`
- **IMPLEMENT**:
  ```typescript
  import { describe, it, expect, beforeEach } from 'vitest';
  import { characterRepository } from '../memory/characterRepository.js';
  import { eventRepository } from '../memory/eventRepository.js';
  import { initDb } from '../db/sqlite.js';

  describe('记忆仓储', () => {
    beforeEach(() => {
      initDb();
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
      });

      it('应按 ID 查找人物', () => {
        const created = characterRepository.create({ name: '李四' });
        const found = characterRepository.findById(created.id);
        expect(found?.name).toBe('李四');
      });

      it('应更新人物状态', () => {
        const created = characterRepository.create({ name: '王五', currentState: '初始' });
        const updated = characterRepository.update(created.id, { currentState: '已改变' });
        expect(updated?.currentState).toBe('已改变');
      });

      it('应删除人物', () => {
        const created = characterRepository.create({ name: '赵六' });
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
      });

      it('应按章节查找事件', () => {
        const chapterId = 'test_chapter_2';
        eventRepository.create({ chapterId, description: '事件1' });
        eventRepository.create({ chapterId, description: '事件2' });

        const events = eventRepository.findByChapterId(chapterId);
        expect(events).toHaveLength(2);
      });
    });
  });
  ```
- **MIRROR**: TEST_STRUCTURE from Phase 1
- **IMPORTS**: vitest, repositories, initDb
- **GOTCHA**: 每个测试前 initDb() 确保干净状态；世界知识测试需要 ChromaDB
- **VALIDATE**: `vitest run` 所有测试通过

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| CharacterRepository.create | 有效输入 | 返回带 ID 的 CharacterState | 缺少可选字段 |
| CharacterRepository.findById | 存在的 ID | 返回 CharacterState | 不存在的 ID |
| CharacterRepository.update | 存在的 ID + 部分更新 | 返回更新后状态 | 不存在的 ID |
| CharacterRepository.delete | 存在的 ID | true | 不存在的 ID |
| EventRepository.create | 有效输入 | 返回带 ID 的 StoryEvent | 无 |
| EventRepository.findByChapterId | 存在的 chapterId | 返回事件数组 | 无章节的事件 |

### Edge Cases Checklist

- [x] 空输入字段 — 使用默认值
- [x] 不存在的 ID — 返回 undefined
- [x] 重复的人物名 — 允许（按 ID 区分）
- [x] 删除有外键关联的事件 — SQLite CASCADE

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
EXPECT: All memory tests pass

### Build

```bash
npm run build
```
EXPECT: dist/ 包含 memory/ 目录

---

## Acceptance Criteria

- [ ] `CharacterRepository` — create, findById, findByName, findAll, update, delete
- [ ] `EventRepository` — create, findById, findByChapterId, findAll, delete
- [ ] `WorldKnowledgeRepository` — add, addBatch, search, delete
- [ ] `MemoryService` — 组合所有仓储，提供统一接口
- [ ] `searchMemories()` — 混合检索（精确 + 语义）
- [ ] 类型定义更新 — MemorySearchResult, WorldKnowledgeItem, DTOs
- [ ] 测试覆盖 — repository 基本 CRUD

---

## Completion Checklist

- [ ] 所有任务完成
- [ ] 无 TypeScript 类型错误
- [ ] 测试通过
- [ ] Build 成功
- [ ] 代码遵循 Phase 1 模式

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ChromaDB 服务未运行 | M | M | 测试时 skip；添加友好错误信息 |
| LLM embed 调用失败 | L | M | 捕获异常，返回空结果 |
| SQLite 并发写入 | L | L | WAL 模式已配置 |

---

## Notes

- 人物 relationships 存为 JSON 字符串，检索时需要 JSON.parse
- 世界知识向量存储依赖 LLM embed，需确认 API 可用
- 混合检索策略：人物/事件用精确（SQLite），世界观用语义（ChromaDB）
