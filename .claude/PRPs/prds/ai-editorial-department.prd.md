# AI 编辑部智能体编排系统

## Problem Statement

个人创作者想用 AI 写长篇小说，但面临核心问题：长篇一致性（人物性格、人物状态、情节不重复）难以维护，世界观和人物设定容易出现逻辑冲突。现有工具（如 OpenClaw）指令遵循不稳定，细节配置过多，学习成本高。核心需求是降低写小说的场景配置复杂度，并通过阶段性质量检测（每 5 章）确保符合大纲和原子设定。

## Evidence

- 用户自述：使用 OpenClaw 时 LLM 不按指令执行，不确定是设置问题还是模型问题
- 用户需求：减少细节设置，专注于创意方向
- 用户期望：每 5 章进行一次质量检测，验证是否符合大纲和原子设定

> Assumption - needs validation through user research

## Proposed Solution

构建一个多智能体协作系统，模拟真实编辑部的分工：主智能体（总编）统筹协调，其他专业智能体（Writer、内容编辑、校对润色、记忆管理员、故事架构师、创意顾问、世界观规划师、人设规划师）各司其职。通过混合记忆系统（向量数据库 + 结构化存储）管理创意设定和精确原子数据，确保长篇一致性。系统以流水线方式协作：Writer → 编辑 → 校对 → 总编审核，每 5 章触发质量检测节点。

## Key Hypothesis

We believe [一个专业分工的 AI 编辑部智能体系统] will [降低长篇小说创作的一致性管理复杂度] for [不擅长编故事的個人创作者].
We'll know we're right when [用户能够完成一部 50 章以上的长篇小说，且人物状态、世界观、情节一致性检测通过率 > 80%]。

## What We're NOT Building

- 互动式小说/游戏引擎 - 不做分支剧情选择
- 多语言支持 - 只做中文内容创作
- 角色图片/形象生成 - 只做文字内容
- 实时协作编辑 - 不做多人同时编辑
- 专业出版工作流 - 不做 ISBN、排版等

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| 人物状态一致性通过率 | > 95% | 5章检测节点检测无矛盾 |
| 世界观规则冲突率 | < 5% | 自动检测到的规则违反次数 |
| 情节重复率 | < 10% | 语义相似度检测重复章节 |
| 用户配置项数量 | < 10 项 | 首次使用的设置项统计 |
| 章节生成完成时间 | < 5 分钟/章 | 单章生成耗时统计 |

## Open Questions

- [ ] 智能体之间的通信协议具体设计？（共享内存 vs 消息队列 vs API 调用）
- [ ] 质量检测不通过时的自动修复策略？（重写局部 vs 重建整章 vs 人工确认）
- [ ] 是否需要支持断点续写？（重启后从上次进度继续）
- [ ] 向量数据库选型？（Pinecode / Milvus / Chroma / Qdrant）
- [ ] LLM 提供者是否需要可切换？（单一 provider 足够验证概念）

---

## Users & Context

**Primary User**
- **Who**: 个人创作者，无专业写作背景，想尝试 AI 辅助写小说
- **Current behavior**: 使用 OpenClaw，需要手动配置大量细节，仍然遇到一致性问题
- **Trigger**: 想要创作长篇小说（如 50+ 章节），但被人物关系、情节连贯性、世界观自洽等问题困扰
- **Success state**: 只需要提供故事大纲和基本设定，AI 自动完成章节撰写，并自动维护一致性

**Job to Be Done**
When 我想写长篇小说但不想操心细节一致性, I want 一个 AI 编辑部自动处理人物、世界观、情节衔接, so I can 专注于故事创意方向和核心情节发展.

**Non-Users**
- 专业作家（有自己成熟的创作方法论，不需要 AI 介入）
- 内容农场运营者（追求产量而非质量）
- 游戏叙事设计师（需要分支剧情和对话树）

**Constraints**
- 暂无（无时间、预算、技术、监管限制）

---

## Solution Detail

### Core Capabilities (MoSCoW)

| Priority | Capability | Rationale |
|----------|------------|-----------|
| Must | 总编智能体（主智能体） | 统筹协调，质量把控，流水线调度 |
| Must | 记忆管理员 | 混合存储管理（向量 + 结构化），一致性保障核心 |
| Must | Writer（撰稿人） | 核心内容生成 |
| Should | 校对润色 | 语言质量保证 |
| Should | 内容编辑 | 结构和逻辑审核 |
| Should | 故事架构师 | 情节设计和节奏把控 |
| Could | 创意顾问 | 标题、角度、创意建议 |
| Could | 世界观规划师 | 世界观和设定构建 |
| Could | 人设规划师 | 角色性格和对话风格 |
| Won't | 总看板 | 可视化进度（第一期暂不实现） |

### MVP Scope

**最小可行产品**：验证核心假设
- 3 个核心智能体：总编 + 记忆管理员 + Writer
- 简单流水线：用户输入大纲 → Writer 生成 → 记忆管理员记录 → 总编审核
- 手动触发的 5 章质量检测
- 基础记忆存储（结构化 JSON 文件，向量用内存模拟）
- 仅支持 OpenAI API

### User Flow

```
1. 用户输入
   ├── 故事标题/类型
   ├── 故事大纲（3-5 句话）
   ├── 主要人物设定（名字、性格、外貌）
   └── 世界观/背景设定

2. 初始化
   ├── 记忆管理员：创建项目记忆库
   ├── 世界观规划师：根据设定构建世界观（可选调用）
   ├── 人设规划师：根据人物设定构建人设档案（可选调用）
   └── 总编：生成章节计划

3. 章节生成（循环）
   ├── 总编：规划本章内容要点
   ├── Writer：根据要点生成初稿
   ├── 内容编辑：检查结构和逻辑
   ├── 校对润色：语言和风格润色
   └── 总编：最终审核

4. 质量检测（每5章）
   ├── 记忆管理员：提取相关记忆
   ├── 总编：执行一致性检查
   │   ├── 人物状态检查
   │   ├── 世界观规则检查
   │   └── 情节重复检查
   └── 不通过：自动修复或标记

5. 完成
   └── 输出完整小说 + 一致性报告
```

---

## Technical Approach

**Feasibility**: MEDIUM

**Architecture Notes**

- **整体架构**：Node.js/TypeScript 单体应用，轻量级启动
- **智能体模式**：每个智能体是一个独立类/模块，通过事件总线通信
- **记忆系统**：
  - 结构化存储：SQLite（人物状态、事件时间线）
  - 向量存储：ChromaDB（世界观描述、创意设定）
- **LLM 集成**：统一接口，支持 OpenAI → Anthropic → 本地模型
- **流水线调度**：基于状态机的任务队列

**技术栈选择**：
- 语言：TypeScript
- 数据库：SQLite（简单，无需额外服务）
- 向量库：ChromaDB（轻量，可嵌入）
- LLM：OpenAI GPT-4o（验证期），Anthropic Claude（后续）
- 框架：Express.js 或纯 Node.js

**Key Technical Decisions**

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 语言 | TypeScript | Python, Go | 与 OpenClaw 一致，便于后续集成 |
| 存储 | SQLite + ChromaDB | PostgreSQL + Pinecone | 轻量，无需运维 |
| LLM 抽象 | 统一接口 | 直接调用 | 便于切换 provider |
| 智能体通信 | 事件总线 | 共享内存, API 调用 | 解耦，易扩展 |

**Technical Risks**

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| LLM 生成质量不稳定 | H | 提供详细 prompt 模板，章节生成后自动质量评估 |
| 向量检索不准确 | M | 混合检索，结合关键词过滤 |
| 长上下文丢失 | H | 分段记忆提取，只传递相关上下文 |
| 自动修复效果差 | H | 设计人工确认环节，不做全自动覆盖 |

---

## Implementation Phases

| # | Phase | Description | Status | Parallel | Depends | PRP Plan |
|---|-------|-------------|--------|----------|---------|----------|
| 1 | 项目初始化 | 基础项目结构、数据库、LLM 接口抽象 | complete | - | - | [.claude/PRPs/plans/phase-1-project-initialization.plan.md] [.claude/PRPs/reports/phase-1-project-initialization-report.md] |
| 2 | 记忆系统 | 结构化存储 + 向量存储 + 记忆提取 | complete | - | 1 | [.claude/PRPs/plans/phase-2-memory-system.plan.md] [.claude/PRPs/reports/phase-2-memory-system-report.md] |
| 3 | 核心智能体 | 总编、Writer、记忆管理员基础实现 | complete | - | 1 | [.claude/PRPs/plans/phase-3-core-agents.plan.md] [.claude/PRPs/reports/phase-3-core-agents-report.md] |
| 4 | 流水线编排 | 事件总线、任务队列、智能体协作 | complete | 3 | 2 | [.claude/PRPs/plans/phase-4-pipeline-orchestration.plan.md] [.claude/PRPs/reports/phase-4-pipeline-orchestration-report.md] |
| 5 | 质量检测 | 5章检测机制、一致性检查、自动修复 | complete | - | 3, 4 | [.claude/PRPs/plans/phase-5-quality-detection.plan.md] [.claude/PRPs/reports/phase-5-quality-detection-report.md] |
| 6 | 扩展智能体 | 内容编辑、校对润色、故事架构师 | complete | 5 | 3 | [.claude/PRPs/plans/phase-6-extended-agents.plan.md] [.claude/PRPs/reports/phase-6-extended-agents-report.md] |
| 7 | 总看板 | 进度可视化、状态管理 | complete | - | 5 | [.claude/PRPs/plans/phase-7-dashboard.plan.md] [.claude/PRPs/reports/phase-7-dashboard-report.md] |

### Phase Details

**Phase 1: 项目初始化**
- **Goal**: 建立可运行的基础项目骨架
- **Scope**:
  - TypeScript 项目结构
  - SQLite 数据库初始化
  - ChromaDB 嵌入
  - LLM provider 接口抽象（OpenAI 实现）
  - 基础配置文件
- **Success signal**: 运行 `npm run dev` 能启动服务，API 可调用

**Phase 2: 记忆系统**
- **Goal**: 实现混合记忆存储和检索
- **Scope**:
  - 人物状态表（姓名、当前状态、关系网络）
  - 事件时间线（章节-事件映射）
  - 世界观向量存储（描述、规则、设定）
  - 记忆提取接口（给定上下文，检索相关记忆）
- **Success signal**: 能存储人物状态，能根据章节内容检索相关记忆

**Phase 3: 核心智能体**
- **Goal**: 实现三个核心智能体的基础功能
- **Scope**:
  - **总编**：接收用户输入，规划章节，统筹协调
  - **Writer**：接收章节要点，生成初稿
  - **记忆管理员**：响应记忆读写请求，维护一致性
- **Success signal**: 能通过 CLI 或 API 完成一个简单章节的生成和记忆存储

**Phase 4: 流水线编排**
- **Goal**: 实现智能体之间的自动化协作
- **Scope**:
  - 事件总线（智能体间消息传递）
  - 任务队列（章节生成任务调度）
  - 流水线状态机（待生成 → 写作中 → 编辑中 → 校对中 → 完成）
- **Success signal**: 输入大纲，自动完成 Writer → 编辑 → 校对 → 总编审核的完整流程

**Phase 5: 质量检测**
- **Goal**: 实现 5 章检测节点和自动修复
- **Scope**:
  - 检测触发器（每 5 章自动触发）
  - 一致性检查（人物状态冲突、世界观违反、情节重复）
  - 自动修复策略（局部重写、整章重建）
  - 检测报告生成
- **Success signal**: 生成 5 章后自动触发检测，输出一致性报告

**Phase 6: 扩展智能体**
- **Goal**: 添加内容编辑、校对润色、故事架构师
- **Scope**:
  - **内容编辑**：结构、逻辑、叙事节奏检查
  - **校对润色**：语法、标点、风格一致性
  - **故事架构师**：情节设计、节奏建议（可被总编调用）
  - **创意顾问**：标题建议、角度创新（可选）
  - **世界观规划师**：世界观构建辅助（可选）
  - **人设规划师**：角色设定辅助（可选）
- **Success signal**: 流水线支持全部智能体协作

**Phase 7: 总看板**
- **Goal**: 实现可视化进度管理
- **Scope**:
  - 项目状态总览（总章节数、已完成、待审核）
  - 章节进度（生成中、待编辑、待校对、已完成）
  - 一致性报告查看
  - 手动干预入口（重写、重审）
- **Success signal**: Web UI 或 CLI 可视化显示当前项目进度

### Parallelism Notes

- Phase 3 和 Phase 2 可并行开发（智能体实现依赖抽象接口）
- Phase 6 的扩展智能体可与 Phase 5 并行开发（各自独立模块）
- Phase 7 总看板依赖 Phase 5 的检测机制，需串行

---

## Decisions Log

| Decision | Choice | Alternatives | Rationale |
|----------|--------|--------------|-----------|
| 构建方式 | 从零构建 | 基于 OpenClaw 扩展 | 架构更清晰，完全可控，无历史包袱 |
| 智能体通信 | 事件总线 | 共享内存, API 调用 | 解耦良好，易于添加新智能体 |
| 记忆存储 | SQLite + ChromaDB | PostgreSQL + Pinecone | 轻量嵌入，无需运维服务 |
| 质量检测触发 | 半自动 | 全自动 | 自动触发检测 + 自动修复，但保留人工确认 |
| MVP 智能体数量 | 3 个 | 1 个, 9 个全部 | 3 个（总编+记忆管理员+Writer）验证核心假设 |

---

## Research Summary

**Market Context**
- 目前市面缺乏专门针对"长篇小说一致性问题"的多智能体产品
- NovelAI、Squibler 等侧重生成而非专业编辑分工
- 多智能体记忆管理是核心技术难点

**Technical Context**
- OpenClaw 的 task-registry、task-executor、acp-spawn 等模块提供了成熟的参考
- 向量数据库（ChromaDB）+ 结构化存储（SQLite）是轻量级混合存储的有效方案
- 事件驱动的智能体协作模式已被广泛验证

---

*Generated: 2026-04-14*
*Status: DRAFT - needs validation*
