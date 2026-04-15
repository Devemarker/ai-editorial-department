import { BaseAgent, type AgentContext } from './base.js';
import { memoryService } from '../memory/memoryService.js';
import { llm } from '../llm/openai.js';
import type { StoryEvent } from '../types/index.js';

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

  /**
   * 保存章节上下文
   * 使用 LLM 提取关键事件和人物状态
   */
  async saveChapterContext(
    chapterId: string,
    content: string,
    characterStates: Record<string, string>
  ): Promise<void> {
    // 提取事件（增强实现：使用 LLM 分析）
    const events = await this.extractEventsWithLLM(chapterId, content);

    for (const event of events) {
      memoryService.createEvent({
        chapterId,
        description: event.description,
        timestampInStory: event.timestampInStory,
      });
    }

    // 更新人物状态
    for (const [name, state] of Object.entries(characterStates)) {
      const char = memoryService.getCharacterByName(name);
      if (char) {
        memoryService.updateCharacter(char.id, { currentState: state });
      }
    }

    this.log('保存章节上下文', `章节 ${chapterId}，提取 ${events.length} 个事件`);
  }

  /**
   * 使用 LLM 从章节内容中提取关键事件
   */
  private async extractEventsWithLLM(
    chapterId: string,
    content: string
  ): Promise<Array<{ description: string; timestampInStory: number }>> {
    const prompt = `你是一个事件提取专家。请从以下小说章节中提取关键事件。

章节内容：
${content.slice(0, 3000)}

请提取 3-5 个关键事件，每个事件应该：
1. 是情节中的重要转折点或关键情节
2. 包含人物参与
3. 有明确的描述（20-100字）

请以 JSON 格式输出事件列表：
{
  "events": [
    {
      "description": "事件描述",
      "timestampInStory": 事件在故事中的大致时间位置（1-100的相对值）
    }
  ]
}`;

    try {
      const response = await llm.complete(prompt, { temperature: 0.3 });
      const result = this.parseEventsResponse(response.text);

      if (result.events && result.events.length > 0) {
        return result.events.map((e: { description: string; timestampInStory?: number }) => ({
          description: e.description,
          timestampInStory: e.timestampInStory || 50,
        }));
      }
    } catch (err) {
      console.error('[MemoryManager] 事件提取失败，使用简单提取:', err);
    }

    // 回退到简单提取
    return this.extractEventsSimple(content, chapterId);
  }

  /**
   * 简单事件提取（作为 LLM 提取失败时的回退方案）
   */
  private extractEventsSimple(
    content: string,
    chapterId: string
  ): Array<{ description: string; timestampInStory: number }> {
    const events: Array<{ description: string; timestampInStory: number }> = [];

    // 按段落分割，提取包含人物和动作的段落作为事件
    const paragraphs = content.split(/\n+/).filter((p) => p.trim().length > 50);
    const totalLength = paragraphs.reduce((sum, p) => sum + p.length, 0);

    let accumulatedLength = 0;
    for (let i = 0; i < Math.min(paragraphs.length, 5); i++) {
      const para = paragraphs[i];
      accumulatedLength += para.length;

      events.push({
        description: para.trim().slice(0, 200),
        timestampInStory: Math.round((accumulatedLength / totalLength) * 100),
      });
    }

    return events;
  }

  private parseEventsResponse(response: string): { events: Array<{ description: string; timestampInStory?: number }> } {
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {}
    return { events: [] };
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
