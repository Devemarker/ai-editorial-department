# Plan: Phase 6 - 扩展智能体

## Summary

添加内容编辑（ContentEditor）、校对润色（Proofreader）、故事架构师（StoryArchitect）三个扩展智能体，完善流水线后期处理能力。

## User Story

As a **用户**, I want **流水线支持编辑、校对、故事架构智能体**, so that **生成的内容质量更高，结构更合理**。

## Problem → Solution

单一 Writer 输出质量有限 → 多智能体协作提升质量

## Metadata

- **Complexity**: Medium
- **Source PRD**: `.claude/PRPs/prds/ai-editorial-department.prd.md`
- **PRD Phase**: Phase 6 - 扩展智能体
- **Estimated Files**: 6 个

---

## UX Design

N/A — 内部智能体

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `src/agents/base.ts` | all | BaseAgent 基类 |
| P0 | `src/agents/writer.ts` | all | Writer 实现参考 |
| P1 | `src/types/index.ts` | all | 相关类型 |
| P1 | `src/pipeline/pipeline.ts` | all | 流水线集成点 |

---

## Patterns to Mirror

### AGENT_PATTERN
```typescript
// SOURCE: src/agents/base.ts
export abstract class BaseAgent {
  protected name: string;
  constructor(name: string) { this.name = name; }
  protected async think(prompt: string): Promise<string>
  protected log(action: string, detail?: string): void
  async act(context: AgentContext): Promise<unknown> // 默认抛出错误
}
```

### WRITER_PATTERN
```typescript
// SOURCE: src/agents/writer.ts
export class WriterAgent extends BaseAgent {
  async act(context: AgentContext): Promise<ChapterDraft> {
    // 1. 检索记忆
    // 2. 构建 prompt
    // 3. 调用 LLM
    // 4. 保存结果
    // 5. 返回结果
  }
}
```

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `src/agents/contentEditor.ts` | CREATE | 内容编辑智能体 |
| `src/agents/proofreader.ts` | CREATE | 校对润色智能体 |
| `src/agents/storyArchitect.ts` | CREATE | 故事架构师智能体 |
| `src/agents/index.ts` | UPDATE | 添加导出 |
| `src/types/index.ts` | UPDATE | 添加编辑结果类型 |

## NOT Building

- 创意顾问（Phase 6 后续）
- 世界观规划师（Phase 6 后续）
- 人设规划师（Phase 6 后续）

---

## Step-by-Step Tasks

### Task 1: 添加编辑结果类型

- **ACTION**: 扩展 `src/types/index.ts`
- **IMPLEMENT**:
  ```typescript
  // 内容编辑结果
  export interface ContentEditResult {
    chapterId: string;
    originalContent: string;
    editedContent: string;
    changes: ContentChange[];
    feedback?: string;
  }

  // 内容变更
  export interface ContentChange {
    type: 'structure' | 'logic' | 'rhythm' | 'coherence';
    original: string;
    edited: string;
    reason: string;
  }

  // 校对润色结果
  export interface ProofreadResult {
    chapterId: string;
    originalContent: string;
    polishedContent: string;
    corrections: ProofreadCorrection[];
  }

  // 校对修正
  export interface ProofreadCorrection {
    type: 'grammar' | 'punctuation' | 'spelling' | 'style';
    original: string;
    corrected: string;
    reason: string;
  }

  // 故事架构建议
  export interface StoryArchitectResult {
    chapterNumber: number;
    plotSuggestions: PlotSuggestion[];
    rhythmAnalysis?: RhythmAnalysis;
  }

  // 情节建议
  export interface PlotSuggestion {
    type: 'add' | 'remove' | 'modify';
    description: string;
    reason: string;
  }

  // 节奏分析
  export interface RhythmAnalysis {
    pacing: 'slow' | 'moderate' | 'fast';
    tension: 'low' | 'medium' | 'high';
    suggestions: string[];
  }
  ```
- **MIRROR**: 类型定义遵循现有模式
- **IMPORTS**: 无新增
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 2: 内容编辑智能体

- **ACTION**: 创建 `src/agents/contentEditor.ts`
- **IMPLEMENT**:
  ```typescript
  import { BaseAgent, type AgentContext } from './base.js';
  import { chapterRepository } from '../memory/chapterRepository.js';
  import type { ChapterDraft, ContentEditResult, ContentChange } from '../types/index.js';

  export class ContentEditorAgent extends BaseAgent {
    constructor() {
      super('内容编辑');
    }

    async act(context: AgentContext): Promise<ContentEditResult> {
      if (!context.chapterPlan) {
        throw new Error('缺少章节规划');
      }

      const chapterId = context.chapterPlan.number.toString();
      const chapter = chapterRepository.findByNumber(parseInt(chapterId));

      if (!chapter) {
        throw new Error(`章节 ${chapterId} 不存在`);
      }

      this.log('编辑章节', chapterId);

      const prompt = this.buildEditPrompt(chapter.content);
      const response = await this.think(prompt);

      const { editedContent, changes } = this.parseEditResponse(response, chapter.content);

      // 更新章节
      chapterRepository.update(chapter.id, { content: editedContent });

      return {
        chapterId: chapter.id,
        originalContent: chapter.content,
        editedContent,
        changes,
      };
    }

    private buildEditPrompt(content: string): string {
      return `你是一位资深内容编辑，请审查并改进以下小说章节。

请检查以下方面：
1. **结构**：开头、发展和结尾是否完整
2. **逻辑**：情节推进是否合理，有无逻辑漏洞
3. **叙事节奏**：节奏是否张弛有度，有无拖沓
4. **连贯性**：段落之间过渡是否自然

原文：
${content}

请以 JSON 格式输出改进建议：
{
  "editedContent": "改进后的完整内容",
  "changes": [
    {
      "type": "structure|logic|rhythm|coherence",
      "original": "原文片段",
      "edited": "修改后片段",
      "reason": "修改原因"
    }
  ]
}

只输出 JSON，不要有其他内容。`;
    }

    private parseEditResponse(response: string, original: string): { editedContent: string; changes: ContentChange[] } {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            editedContent: parsed.editedContent || original,
            changes: parsed.changes || [],
          };
        }
      } catch {
        // 解析失败，返回原文
      }
      return { editedContent: original, changes: [] };
    }
  }

  export const contentEditorAgent = new ContentEditorAgent();
  ```
- **MIRROR**: WRITER_PATTERN
- **IMPORTS**: BaseAgent, chapterRepository
- **GOTCHA**: 使用现有章节内容进行编辑
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 3: 校对润色智能体

- **ACTION**: 创建 `src/agents/proofreader.ts`
- **IMPLEMENT**:
  ```typescript
  import { BaseAgent, type AgentContext } from './base.js';
  import { chapterRepository } from '../memory/chapterRepository.js';
  import type { ProofreadResult, ProofreadCorrection } from '../types/index.js';

  export class ProofreaderAgent extends BaseAgent {
    constructor() {
      super('校对润色');
    }

    async act(context: AgentContext): Promise<ProofreadResult> {
      if (!context.chapterPlan) {
        throw new Error('缺少章节规划');
      }

      const chapterId = context.chapterPlan.number.toString();
      const chapter = chapterRepository.findByNumber(parseInt(chapterId));

      if (!chapter) {
        throw new Error(`章节 ${chapterId} 不存在`);
      }

      this.log('校对章节', chapterId);

      const prompt = this.buildProofreadPrompt(chapter.content);
      const response = await this.think(prompt);

      const { polishedContent, corrections } = this.parseProofreadResponse(response, chapter.content);

      // 更新章节
      chapterRepository.update(chapter.id, { content: polishedContent });

      return {
        chapterId: chapter.id,
        originalContent: chapter.content,
        polishedContent,
        corrections,
      };
    }

    private buildProofreadPrompt(content: string): string {
      return `你是一位资深校对润色专家，请对以下小说章节进行语言质量检查和改进。

请检查以下方面：
1. **语法**：主谓一致、时态正确、句式完整
2. **标点**：标点使用规范、正确
3. **拼写**：错别字、词语误用
4. **风格**：语言风格一致、表达流畅

原文：
${content}

请以 JSON 格式输出校对结果：
{
  "polishedContent": "润色后的完整内容",
  "corrections": [
    {
      "type": "grammar|punctuation|spelling|style",
      "original": "原文片段",
      "corrected": "修改后片段",
      "reason": "修改原因"
    }
  ]
}

只输出 JSON，不要有其他内容。`;
    }

    private parseProofreadResponse(response: string, original: string): { polishedContent: string; corrections: ProofreadCorrection[] } {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            polishedContent: parsed.polishedContent || original,
            corrections: parsed.corrections || [],
          };
        }
      } catch {
        // 解析失败，返回原文
      }
      return { polishedContent: original, corrections: [] };
    }
  }

  export const proofreaderAgent = new ProofreaderAgent();
  ```
- **MIRROR**: WRITER_PATTERN
- **IMPORTS**: BaseAgent, chapterRepository
- **GOTCHA**: 与 ContentEditor 类似，但关注点不同
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 4: 故事架构师智能体

- **ACTION**: 创建 `src/agents/storyArchitect.ts`
- **IMPLEMENT**:
  ```typescript
  import { BaseAgent, type AgentContext } from './base.js';
  import { memoryManagerAgent } from './memoryManager.js';
  import type { StoryArchitectResult, PlotSuggestion, RhythmAnalysis } from '../types/index.js';

  export class StoryArchitectAgent extends BaseAgent {
    constructor() {
      super('故事架构师');
    }

    async provideSuggestions(
      chapterNumber: number,
      previousChapterSummary?: string
    ): Promise<StoryArchitectResult> {
      this.log('提供情节建议', `第${chapterNumber}章`);

      // 检索相关记忆
      const memories = await memoryManagerAgent.retrieveMemories(
        previousChapterSummary || '开场'
      );

      const prompt = this.buildArchitectPrompt(chapterNumber, memories, previousChapterSummary);
      const response = await this.think(prompt);

      return this.parseArchitectResponse(chapterNumber, response);
    }

    private buildArchitectPrompt(
      chapterNumber: number,
      memories: { characters: string; events: string; worldKnowledge: string },
      previousSummary?: string
    ): string {
      return `你是一位资深故事架构师，请为小说第${chapterNumber}章提供情节设计建议。

${previousSummary ? `【前章概要】\n${previousSummary}\n` : ''}
${memories.worldKnowledge ? `【世界观】\n${memories.worldKnowledge}\n` : ''}
${memories.characters ? `【人物状态】\n${memories.characters}\n` : ''}
${memories.events ? `【已发生事件】\n${memories.events}\n` : ''}

请提供以下建议：
1. **情节建议**：本章应该发生什么关键事件
2. **节奏分析**：本章节的节奏应该是快是慢，张力如何

请以 JSON 格式输出：
{
  "plotSuggestions": [
    {
      "type": "add|remove|modify",
      "description": "建议内容",
      "reason": "原因"
    }
  ],
  "rhythmAnalysis": {
    "pacing": "slow|moderate|fast",
    "tension": "low|medium|high",
    "suggestions": ["节奏建议1", "节奏建议2"]
  }
}

只输出 JSON，不要有其他内容。`;
    }

    private parseArchitectResponse(chapterNumber: number, response: string): StoryArchitectResult {
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            chapterNumber,
            plotSuggestions: parsed.plotSuggestions || [],
            rhythmAnalysis: parsed.rhythmAnalysis,
          };
        }
      } catch {
        // 解析失败，返回空结果
      }
      return {
        chapterNumber,
        plotSuggestions: [],
      };
    }
  }

  export const storyArchitectAgent = new StoryArchitectAgent();
  ```
- **MIRROR**: AGENT_PATTERN
- **IMPORTS**: BaseAgent, memoryManagerAgent
- **GOTCHA**: 不直接修改内容，只提供建议
- **VALIDATE**: `tsc --noEmit` 无错误

### Task 5: 更新智能体导出

- **ACTION**: 更新 `src/agents/index.ts`
- **IMPLEMENT**:
  ```typescript
  export { BaseAgent } from './base.js';
  export { MemoryManagerAgent, memoryManagerAgent } from './memoryManager.js';
  export { WriterAgent, writerAgent } from './writer.js';
  export { ChiefEditorAgent, chiefEditorAgent } from './chiefEditor.js';
  export { ContentEditorAgent, contentEditorAgent } from './contentEditor.js';
  export { ProofreaderAgent, proofreaderAgent } from './proofreader.js';
  export { StoryArchitectAgent, storyArchitectAgent } from './storyArchitect.js';
  ```
- **MIRROR**: N/A
- **IMPORTS**: 各智能体
- **GOTCHA**: 无
- **VALIDATE**: `tsc --noEmit` 无错误

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| ContentEditor.act | 有效章节 | ContentEditResult | 章节不存在 |
| Proofreader.act | 有效章节 | ProofreadResult | 章节不存在 |
| StoryArchitect.provideSuggestions | 章节号 | StoryArchitectResult | 无记忆数据 |

### Edge Cases Checklist

- [x] 章节不存在
- [x] LLM 返回非 JSON 格式
- [x] 空内容章节

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
EXPECT: All agent tests pass

### Build
```bash
npm run build
```
EXPECT: dist/ 包含新智能体文件

---

## Acceptance Criteria

- [ ] ContentEditor — 结构、逻辑、节奏检查
- [ ] Proofreader — 语法、标点、风格润色
- [ ] StoryArchitect — 情节建议和节奏分析
- [ ] 智能体统一导出

---

## Notes

- MVP 只实现 3 个核心扩展智能体
- 扩展智能体暂时不接入流水线（Phase 7 集成）
- LLM 返回解析使用正则匹配 JSON，容忍一定格式变化
