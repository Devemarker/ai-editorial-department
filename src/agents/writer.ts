import { BaseAgent, type AgentContext } from './base.js';
import { memoryManagerAgent } from './memoryManager.js';
import type { ChapterDraft, ChapterPlan } from '../types/index.js';
import { chapterRepository } from '../memory/chapterRepository.js';

export class WriterAgent extends BaseAgent {
  constructor() {
    super('Writer');
  }

  async act(context: AgentContext): Promise<ChapterDraft> {
    if (!context.chapterPlan || !context.projectInput) {
      throw new Error('缺少章节规划或项目输入');
    }

    const plan = context.chapterPlan;

    // 检索相关记忆
    const memories = await memoryManagerAgent.retrieveMemories(
      `第${plan.number}章 ${plan.title}`
    );

    // 构建 prompt
    const prompt = this.buildPrompt(plan, memories, context.projectInput);

    this.log('生成章节', `第${plan.number}章 "${plan.title}"`);

    // 调用 LLM
    const content = await this.think(prompt);

    // 保存到数据库
    const chapter = chapterRepository.create({
      number: plan.number,
      title: plan.title,
      content,
      status: 'draft',
    });

    // 更新记忆
    await memoryManagerAgent.saveChapterContext(
      chapter.id,
      content,
      plan.characterStates
    );

    this.log('章节已保存', chapter.id);

    return {
      chapterId: chapter.id,
      number: plan.number,
      title: plan.title,
      content,
      plan,
    };
  }

  private buildPrompt(
    plan: ChapterPlan,
    memories: { characters: string; events: string; worldKnowledge: string },
    project: AgentContext['projectInput']
  ): string {
    const characterContext = memories.characters
      ? `【人物状态】\n${memories.characters}\n`
      : '';
    const eventContext = memories.events
      ? `【已发生事件】\n${memories.events}\n`
      : '';
    const worldContext = memories.worldKnowledge
      ? `【世界观设定】\n${memories.worldKnowledge}\n`
      : '';

    const characterStatesText = Object.entries(plan.characterStates)
      .map(([name, state]) => `- ${name}: ${state}`)
      .join('\n');

    return `你是一位专业的小说作家，请根据以下信息撰写小说章节。

【故事背景】
标题：${project?.title || '未命名'}
类型：${project?.genre || '未知'}
大纲：${project?.outline || '未提供'}

${worldContext}
${characterContext}
${eventContext}

【本章规划】
章节号：${plan.number}
标题：${plan.title}
要点：
${plan.keyPoints.map((p) => `- ${p}`).join('\n')}

本章人物状态：
${characterStatesText}

请撰写完整的章节内容，要求：
1. 遵循上述要点
2. 保持人物状态一致性
3. 自然衔接已发生的事件
4. 字数在 1000-3000 字之间
5. 直接输出章节内容，不要加标题前缀

章节内容：
`;
  }
}

export const writerAgent = new WriterAgent();
