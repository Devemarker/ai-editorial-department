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

  async saveChapterContext(
    chapterId: string,
    content: string,
    characterStates: Record<string, string>
  ): Promise<void> {
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
