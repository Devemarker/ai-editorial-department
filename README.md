# AI 编辑部智能体系统

多智能体协作平台，用于 AI 辅助长篇小说创作。

## 功能特性

### 智能体

| 智能体 | 职责 |
|--------|------|
| **总编 (ChiefEditor)** | 统筹协调，规划章节 |
| **撰稿人 (Writer)** | 生成章节内容 |
| **记忆管理员 (MemoryManager)** | 管理人物、事件、世界观记忆 |
| **内容编辑 (ContentEditor)** | 检查结构、逻辑、叙事节奏 |
| **校对润色 (Proofreader)** | 语法、标点、风格润色 |
| **故事架构师 (StoryArchitect)** | 提供情节设计和节奏建议 |

### 流水线

- **事件总线 (EventBus)** — 智能体间消息传递
- **任务队列 (TaskQueue)** — 章节生成任务调度
- **状态机 (StateMachine)** — 状态流转：pending → writing → editing → proofreading → approved/rejected

### 质量检测

- **检测触发器** — 每 5 章自动触发
- **一致性检查** — 人物状态冲突、世界观违反、情节重复
- **报告生成** — 带评分和质量问题的详细报告

## 技术栈

- **TypeScript** + ES Modules
- **SQLite** (better-sqlite3) — 结构化存储
- **ChromaDB** — 向量存储（需服务器）
- **OpenAI** — GPT-4o LLM

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境

复制 `.env.example` 为 `.env`，填入必要的 API Key：

```bash
cp .env.example .env
```

编辑 `.env`：

```env
OPENAI_API_KEY=your-api-key-here
OPENAI_MODEL=gpt-4o
```

### 3. 启动 ChromaDB（可选）

向量搜索需要 ChromaDB 服务器：

```bash
# 安装
pip install chromadb

# 启动服务器
chromadb
```

或使用 Docker：

```bash
docker run -p 8000:8000 chromadb/chroma
```

然后在 `.env` 中配置：

```env
CHROMA_PATH=http://localhost:8000
```

### 4. 使用 CLI

```bash
# 初始化项目
npm run cli -- init 我的小说 "一个关于勇气和友谊的故事"

# 查看状态
npm run cli -- status

# 生成章节
npm run cli -- generate 1 我的小说 "主角开始冒险"

# 查看流水线状态
npm run cli -- pipeline:status

# 查看总看板
npm run cli -- dashboard

# 查看章节详情
npm run cli -- dashboard:chapter 1
```

## CLI 命令

| 命令 | 说明 |
|------|------|
| `init <标题> <大纲>` | 初始化项目 |
| `status` | 查看项目状态 |
| `generate <章节号>` | 生成指定章节 |
| `pipeline:status` | 查看流水线状态 |
| `dashboard` | 显示总看板 |
| `dashboard:chapter <n>` | 显示第 n 章详情 |
| `dashboard:rewrite <n>` | 重新生成第 n 章 |

## 项目结构

```
src/
├── agents/           # 智能体实现
│   ├── base.ts      # 基类
│   ├── chiefEditor.ts
│   ├── writer.ts
│   ├── memoryManager.ts
│   ├── contentEditor.ts
│   ├── proofreader.ts
│   └── storyArchitect.ts
├── memory/           # 记忆系统
│   ├── characterRepository.ts
│   ├── chapterRepository.ts
│   ├── eventRepository.ts
│   ├── worldKnowledgeRepository.ts
│   └── memoryService.ts
├── pipeline/         # 流水线编排
│   ├── eventBus.ts
│   ├── taskQueue.ts
│   ├── stateMachine.ts
│   └── pipeline.ts
├── quality/          # 质量检测
│   ├── checkpoint.ts
│   ├── consistencyChecker.ts
│   ├── reportGenerator.ts
│   ├── fixStrategy.ts
│   └── qualityReportRepository.ts
├── dashboard/        # CLI 看板
│   ├── dashboard.ts
│   └── printer.ts
├── db/              # 数据库
│   ├── sqlite.ts
│   └── schema.sql
├── llm/             # LLM 抽象
│   ├── provider.ts
│   └── openai.ts
├── vector/          # 向量存储
│   └── chroma.ts
├── config/          # 配置
│   └── index.ts
├── types/           # 类型定义
│   └── index.ts
└── cli.ts          # CLI 入口
```

## 数据库

SQLite 数据库包含以下表：

- `characters` — 人物状态
- `chapters` — 章节内容
- `events` — 事件时间线
- `world_rules` — 世界观规则
- `quality_reports` — 质量检测报告
- `quality_issues` — 检测问题

## 开发

```bash
# 类型检查
npm run typecheck

# 运行测试
npm run test

# 构建
npm run build

# 开发模式
npm run dev
```

## 许可证

MIT
