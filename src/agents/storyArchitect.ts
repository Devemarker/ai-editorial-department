import { BaseAgent } from './base.js';
import { memoryManagerAgent } from './memoryManager.js';
import type { StoryArchitectResult } from '../types/index.js';

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
