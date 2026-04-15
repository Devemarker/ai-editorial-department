import { BaseAgent, type AgentContext } from './base.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { parseJsonResponse } from '../llm/parseResponse.js';
import type { ContentEditResult, ContentChange } from '../types/index.js';

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
    const fallback = { editedContent: original, changes: [] as ContentChange[] };
    const parsed = parseJsonResponse<typeof fallback>(response, fallback);
    if (parsed.editedContent === original && parsed.changes.length === 0) {
      console.warn('[ContentEditor] JSON 解析返回空结果');
    }
    return parsed;
  }
}

export const contentEditorAgent = new ContentEditorAgent();
