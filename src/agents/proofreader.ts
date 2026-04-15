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
