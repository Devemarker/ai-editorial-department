# Plan: Phase 1 - 项目初始化

## Summary

建立 AI 编辑部智能体系统的可运行基础项目骨架，包含 TypeScript 项目结构、SQLite 数据库初始化、ChromaDB 向量存储集成、LLM Provider 接口抽象（OpenAI 实现），以及基础配置文件。成功信号：运行 `npm run dev` 能启动服务，API 可调用。

## User Story

As a **AI 编辑部系统开发者**，I want **一个结构清晰、可运行的基础项目骨架**，so that **后续智能体开发、记忆系统、流水线编排都可以在此基础上快速迭代**。

## Problem → Solution

从零开始 → 完整的基础设施，包括：
- 项目结构
- 数据库层
- 向量存储层
- LLM 抽象接口
- 配置管理

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/ai-editorial-department.prd.md`
- **PRD Phase**: Phase 1 - 项目初始化
- **Estimated Files**: 12-15 个

---

## UX Design

### Before

N/A — 内部基础设施，无用户界面

### After

项目启动后：
```
npm run dev
→ 服务启动在 http://localhost:3000
→ API 端点可用
→ 数据库已初始化
→ 向量存储已连接
```

---

## Mandatory Reading

无（全新项目，无历史代码）

---

## External Documentation

| Topic | Source | Key Takeaway |
|-------|--------|--------------|
| ChromaDB JS SDK | npm: chromadb | `ChromaClient` 类，ESM/CJS 导入方式 |
| better-sqlite3 | npm: better-sqlite3 | 同步 SQLite API |
| OpenAI SDK | npm: openai | `OpenAI` 类 completions API |
| TypeScript 项目初始化 | 最佳实践 | `tsconfig.json` 配置 |

---

## Patterns to Mirror

全新项目，建立以下核心模式：

### DIRECTORY_STRUCTURE
```
src/
├── config/           # 配置管理
├── db/               # 数据库层
│   ├── sqlite.ts     # SQLite 连接
│   └── migrations/   # 迁移脚本
├── vector/           # 向量存储
│   └── chroma.ts     # ChromaDB 客户端
├── llm/              # LLM 抽象层
│   ├── provider.ts   # 接口定义
│   └── openai.ts     # OpenAI 实现
├── agents/           # 智能体（Phase 3）
├── pipelines/        # 流水线（Phase 4）
├── types/            # 类型定义
└── index.ts          # 入口
```

### CONFIG_PATTERN
// 配置使用环境变量 + 默认值
```typescript
export const config = {
  port: parseInt(process.env.PORT || '3000'),
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  dbPath: process.env.DB_PATH || './data/ai-editorial.db',
  chromaPath: process.env.CHROMA_PATH || './data/chroma',
}
```

### DB_PATTERN
// 使用 better-sqlite3 同步 API
```typescript
import Database from 'better-sqlite3';
const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
```

### LLM_PROVIDER_INTERFACE
```typescript
interface LLMProvider {
  complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
  embed(texts: string[]): Promise<number[][]>;
}
```

---

## Files to Change

| File | Action | Justification |
|------|--------|----------------|
| `package.json` | CREATE | 项目依赖定义 |
| `tsconfig.json` | CREATE | TypeScript 配置 |
| `src/index.ts` | CREATE | 应用入口 |
| `src/config/index.ts` | CREATE | 配置管理 |
| `src/db/sqlite.ts` | CREATE | SQLite 连接 |
| `src/db/schema.sql` | CREATE | 数据库 Schema |
| `src/vector/chroma.ts` | CREATE | ChromaDB 客户端 |
| `src/llm/provider.ts` | CREATE | LLM 接口定义 |
| `src/llm/openai.ts` | CREATE | OpenAI 实现 |
| `src/types/index.ts` | CREATE | 共享类型定义 |
| `.env.example` | CREATE | 环境变量示例 |
| `data/.gitkeep` | CREATE | 数据目录占位 |
| `tests/setup.ts` | CREATE | 测试初始化 |
| `src/__tests__/config.test.ts` | CREATE | 配置测试 |
| `src/__tests__/llm.test.ts` | CREATE | LLM 接口测试 |

## NOT Building

- 智能体实现（Phase 3）
- 流水线编排（Phase 4）
- 质量检测（Phase 5）
- API 路由（Phase 1 仅基础结构）

---

## Step-by-Step Tasks

### Task 1: 初始化项目基础结构

- **ACTION**: 创建目录结构和基础配置文件
- **IMPLEMENT**:
  - `package.json` — dependencies: `typescript`, `@types/node`, `better-sqlite3`, `chromadb`, `openai`, `dotenv`, `tsx`
  - `tsconfig.json` — 严格模式，ESNext target
  - `.env.example` — 列出所有环境变量
- **MIRROR**: N/A（全新项目）
- **IMPORTS**: N/A
- **GOTCHA**: 确保 `data/` 目录存在，SQLite 和 ChromaDB 需要写入路径
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 2: 配置管理模块

- **ACTION**: 创建 `src/config/index.ts`
- **IMPLEMENT**:
  ```typescript
  import dotenv from 'dotenv';
  dotenv.config();

  export const config = {
    port: parseInt(process.env.PORT || '3000', 10),
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o',
    dbPath: process.env.DB_PATH || './data/ai-editorial.db',
    chromaPath: process.env.CHROMA_PATH || './data/chroma',
  };

  // 验证必填配置
  if (!config.openaiApiKey) {
    throw new Error('OPENAI_API_KEY is required');
  }
  ```
- **MIRROR**: CONFIG_PATTERN
- **IMPORTS**: `dotenv`
- **GOTCHA**: 应用启动时立即检查必填配置，避免运行中才发现缺失
- **VALIDATE**: `node -e "require('./src/config')"` 无报错

### Task 3: 类型定义

- **ACTION**: 创建 `src/types/index.ts`
- **IMPLEMENT**:
  ```typescript
  // LLM 类型
  export interface LLMOptions {
    temperature?: number;
    maxTokens?: number;
    topP?: number;
  }

  export interface LLMResponse {
    text: string;
    usage?: {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
    };
  }

  export interface LLMProvider {
    complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
    embed(texts: string[]): Promise<number[][]>;
  }

  // 智能体消息类型
  export interface AgentMessage {
    id: string;
    agent: string;
    type: string;
    content: string;
    timestamp: number;
  }

  // 章节类型
  export interface Chapter {
    id: string;
    number: number;
    title: string;
    content: string;
    status: 'draft' | 'edited' | 'proofread' | 'approved';
    createdAt: number;
    updatedAt: number;
  }

  // 人物状态类型
  export interface CharacterState {
    id: string;
    name: string;
    description: string;
    currentState: string;
    relationships: Record<string, string>;
  }
  ```
- **MIRROR**: N/A
- **IMPORTS**: N/A
- **GOTCHA**: 保持类型定义完整，后续智能体开发直接引用
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 4: SQLite 数据库层

- **ACTION**: 创建 `src/db/sqlite.ts` 和 `src/db/schema.sql`
- **IMPLEMENT**:
  ```typescript
  // schema.sql
  CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    current_state TEXT NOT NULL DEFAULT '',
    relationships TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS chapters (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    chapter_id TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp_in_story INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
  );

  CREATE TABLE IF NOT EXISTS world_rules (
    id TEXT PRIMARY KEY,
    rule TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
  );
  ```

  ```typescript
  // sqlite.ts
  import Database from 'better-sqlite3';
  import { readFileSync } from 'fs';
  import { join } from 'path';
  import { config } from '../config';

  let db: Database.Database | null = null;

  export function getDb(): Database.Database {
    if (!db) {
      db = new Database(config.dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('foreign_keys = ON');
    }
    return db;
  }

  export function initDb(): void {
    const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
    getDb().exec(schema);
  }

  export function closeDb(): void {
    if (db) {
      db.close();
      db = null;
    }
  }
  ```
- **MIRROR**: DB_PATTERN
- **IMPORTS**: `better-sqlite3`
- **GOTCHA**: SQLite 路径必须是绝对路径或相对于执行目录，`./data/xxx.db` 在 `npm run dev` 时是相对于项目根目录
- **VALIDATE**: `initDb()` 执行后数据库文件存在且可读

### Task 5: ChromaDB 向量存储层

- **ACTION**: 创建 `src/vector/chroma.ts`
- **IMPLEMENT**:
  ```typescript
  import { ChromaClient, Collection } from 'chromadb';
  import { config } from '../config';
  import { LLMProvider } from '../types';

  let client: ChromaClient | null = null;

  export function getChromaClient(): ChromaClient {
    if (!client) {
      client = new ChromaClient({
        path: config.chromaPath,
      });
    }
    return client;
  }

  // 默认集合名称
  export const WORLD_COLLECTION = 'world_knowledge';
  export const CHARACTER_COLLECTION = 'character_profiles';

  export async function getOrCreateCollection(
    name: string
  ): Promise<Collection> {
    const chroma = getChromaClient();
    return await chroma.getOrCreateCollection({ name });
  }

  // 便捷封装：添加世界观知识
  export async function addWorldKnowledge(
    texts: string[],
    embeddings: number[][],
    metadatas: Record<string, string>[]
  ): Promise<void> {
    const collection = await getOrCreateCollection(WORLD_COLLECTION);
    await collection.add({
      ids: texts.map((_, i) => `world_${Date.now()}_${i}`),
      embeddings,
      documents: texts,
      metadatas,
    });
  }

  // 便捷封装：语义检索
  export async function searchWorldKnowledge(
    query: string,
    nResults: number = 5
  ): Promise<{ documents: string[]; metadatas: Record<string, string>[] }> {
    const collection = await getOrCreateCollection(WORLD_COLLECTION);
    const results = await collection.query({
      queryTexts: [query],
      nResults,
    });
    return {
      documents: results.documents[0] || [],
      metadatas: (results.metadatas?.[0] || []) as Record<string, string>[],
    };
  }
  ```
- **MIRROR**: N/A（基于 ChromaDB 官方 API）
- **IMPORTS**: `chromadb`
- **GOTCHA**: ChromaDB 默认使用 HTTP 客户端连接 localhost:8000，但也可以用持久化模式 path。`config.chromaPath` 是目录路径，不是文件路径
- **VALIDATE**: `getChromaClient()` 不抛错

### Task 6: LLM Provider 接口和 OpenAI 实现

- **ACTION**: 创建 `src/llm/provider.ts` 和 `src/llm/openai.ts`
- **IMPLEMENT**:
  ```typescript
  // provider.ts
  import { LLMProvider, LLMOptions, LLMResponse } from '../types';

  export interface LLMProvider {
    complete(prompt: string, options?: LLMOptions): Promise<LLMResponse>;
    embed(texts: string[]): Promise<number[][]>;
  }
  ```

  ```typescript
  // openai.ts
  import OpenAI from 'openai';
  import { config } from '../config';
  import { LLMProvider, LLMOptions, LLMResponse } from './provider';

  let openaiClient: OpenAI | null = null;

  function getClient(): OpenAI {
    if (!openaiClient) {
      openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
    }
    return openaiClient;
  }

  export class OpenAIProvider implements LLMProvider {
    async complete(
      prompt: string,
      options: LLMOptions = {}
    ): Promise<LLMResponse> {
      const client = getClient();
      const response = await client.chat.completions.create({
        model: config.openaiModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 2048,
        top_p: options.topP,
      });

      const message = response.choices[0]?.message;
      return {
        text: message?.content || '',
        usage: response.usage
          ? {
              promptTokens: response.usage.prompt_tokens,
              completionTokens: response.usage.completion_tokens,
              totalTokens: response.usage.total_tokens,
            }
          : undefined,
      };
    }

    async embed(texts: string[]): Promise<number[][]> {
      const client = getClient();
      const response = await client.embeddings.create({
        model: 'text-embedding-3-small',
        input: texts,
      });
      return response.data.map((item) => item.embedding);
    }
  }

  export const llm = new OpenAIProvider();
  ```
- **MIRROR**: LLM_PROVIDER_INTERFACE
- **IMPORTS**: `openai`
- **GOTCHA**:
  - OpenAI SDK 默认从 `OPENAI_API_KEY` 环境变量读取 key，但我们的 config 用 `OPENAI_API_KEY`
  - embed() 使用 `text-embedding-3-small` 模型，需确认 API 支持
- **VALIDATE**: `llm.embed(['test'])` 返回数组

### Task 7: 应用入口

- **ACTION**: 创建 `src/index.ts`
- **IMPLEMENT**:
  ```typescript
  import { config } from './config';
  import { initDb, closeDb } from './db/sqlite';
  import { getChromaClient } from './vector/chroma';
  import { llm } from './llm/openai';

  async function main() {
    console.log('🚀 AI 编辑部系统启动中...');

    // 初始化数据库
    console.log('📦 初始化 SQLite 数据库...');
    initDb();
    console.log('✅ SQLite 初始化完成');

    // 验证 ChromaDB 连接
    console.log('🔍 连接 ChromaDB...');
    try {
      const chroma = getChromaClient();
      await chroma.heartbeat();
      console.log('✅ ChromaDB 连接成功');
    } catch (err) {
      console.warn('⚠️ ChromaDB 连接失败（可能需要启动 ChromaDB 服务）:', err);
    }

    // 验证 LLM
    console.log('🤖 验证 LLM 连接...');
    try {
      const test = await llm.embed(['连接测试']);
      console.log('✅ LLM 连接成功，向量维度:', test[0]?.length);
    } catch (err) {
      console.error('❌ LLM 连接失败:', err);
      process.exit(1);
    }

    console.log(`\n🎉 AI 编辑部系统已就绪！`);
    console.log(`📍 服务地址: http://localhost:${config.port}`);
  }

  main().catch((err) => {
    console.error('启动失败:', err);
    process.exit(1);
  });
  ```
- **MIRROR**: N/A
- **IMPORTS**: config, db/sqlite, vector/chroma, llm/openai
- **GOTCHA**: 启动顺序：DB → Chroma → LLM，避免 LLM 失败时 DB 连接已占用
- **VALIDATE**: `npm run dev` 输出 "AI 编辑部系统已就绪"

### Task 8: 测试文件

- **ACTION**: 创建配置和 LLM 的单元测试
- **IMPLEMENT**:
  ```typescript
  // tests/setup.ts
  import { config } from '../src/config';

  // 测试配置（不设置 OPENAI_API_KEY 时跳过 LLM 测试）
  export const skipLLM = !config.openaiApiKey;
  ```

  ```typescript
  // src/__tests__/config.test.ts
  import { describe, it, expect } from 'vitest';
  import { config } from '../config';

  describe('配置模块', () => {
    it('应有默认端口', () => {
      expect(config.port).toBe(3000);
    });

    it('应有数据库路径', () => {
      expect(config.dbPath).toBeDefined();
      expect(config.dbPath.length).toBeGreaterThan(0);
    });
  });
  ```

  ```typescript
  // src/__tests__/llm.test.ts
  import { describe, it, expect } from 'vitest';
  import { skipLLM } from '../../tests/setup';

  describe('LLM Provider', () => {
    if (skipLLM) {
      it.skip('需要 OPENAI_API_KEY 环境变量', () => {});
      return;
    }

    it('应能生成文本', async () => {
      const { llm } = await import('../llm/openai');
      const response = await llm.complete('Say "test" only', { maxTokens: 10 });
      expect(response.text.toLowerCase()).toContain('test');
    });

    it('应能生成嵌入向量', async () => {
      const { llm } = await import('../llm/openai');
      const embeddings = await llm.embed(['hello world']);
      expect(embeddings).toHaveLength(1);
      expect(embeddings[0]).toHaveLength(1536); // text-embedding-3-small 维度
    });
  });
  ```
- **MIRROR**: TEST_STRUCTURE
- **IMPORTS**: `vitest`
- **GOTCHA**: LLM 测试需要真实 API Key，测试框架应 skip 而非 fail
- **VALIDATE**: `vitest run` 所有测试通过（或 skip）

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|------|-------|-----------------|------------|
| config.test.ts | 无需环境变量 | 默认配置正确 | 缺失环境变量 |
| llm.test.ts | 有效 API Key | 文本 + 向量输出 | 无 API Key 时 skip |

### Edge Cases Checklist

- [x] 空 API Key — 启动时检查并报错
- [x] 数据库路径不存在 — SQLite 会自动创建目录
- [x] ChromaDB 服务未启动 — 警告但不阻塞
- [x] 并发初始化 — 单例模式防止重复连接

---

## Validation Commands

### Static Analysis

```bash
tsc --noEmit
```
EXPECT: Zero type errors

### Unit Tests

```bash
npm test
```
EXPECT: All tests pass (or skip if no API key)

### Full Build

```bash
npm run build
```
EXPECT: `dist/` 目录生成，无编译错误

### Manual Validation

```bash
npm run dev
```
EXPECT:
- "AI 编辑部系统启动中..."
- "✅ SQLite 初始化完成"
- "✅ ChromaDB 连接成功" 或 "⚠️ ChromaDB 连接失败"
- "✅ LLM 连接成功"
- "🎉 AI 编辑部系统已就绪！"

---

## Acceptance Criteria

- [ ] `package.json` 包含所有必要依赖
- [ ] `tsconfig.json` 配置正确，`tsc --noEmit` 无错误
- [ ] 配置模块 `src/config/index.ts` 读取环境变量
- [ ] SQLite 数据库 `src/db/sqlite.ts` 可初始化
- [ ] Schema `src/db/schema.sql` 定义人物、章节、事件、世界观规则表
- [ ] ChromaDB 客户端 `src/vector/chroma.ts` 可连接
- [ ] LLM Provider 接口 `src/llm/provider.ts` 定义完成
- [ ] OpenAI 实现 `src/llm/openai.ts` 可调用
- [ ] 应用入口 `src/index.ts` 可启动并通过健康检查
- [ ] 测试文件存在：`src/__tests__/config.test.ts`、`src/__tests__/llm.test.ts`
- [ ] `npm run dev` 输出成功信号
- [ ] `.env.example` 列出所有环境变量

---

## Completion Checklist

- [ ] 所有任务完成
- [ ] 无 TypeScript 类型错误
- [ ] 测试覆盖配置和 LLM 模块
- [ ] 目录结构清晰，分层合理
- [ ] ChromaDB 和 SQLite 数据目录已创建
- [ ] README 或启动说明待补充（可选）

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ChromaDB 持久化路径配置问题 | M | M | 使用相对路径 `./data/chroma`，确保目录存在 |
| OpenAI API Key 未设置 | H | L | 启动时检查，友好报错提示 |
| better-sqlite3 编译问题（Windows） | M | M | 确认 node-gyp 构建工具已安装 |

---

## Notes

- ChromaDB 有两种模式：嵌入式（in-memory 或持久化到文件）和 HTTP 客户端。Phase 1 使用默认 HTTP 客户端（localhost:8000），需要 ChromaDB 服务运行。后续可考虑嵌入式模式减少依赖。
- 向量嵌入使用 `text-embedding-3-small`（1536 维），比 `text-embedding-ada-002`（1536 维）更便宜效果相当。
- TypeScript 项目使用 `tsx` 替代 `ts-node`，启动更快且支持 ESM。
