import { BaseAgent, type AgentContext } from './base.js';
import { writerAgent } from './writer.js';
import { memoryManagerAgent } from './memoryManager.js';
import type { ChapterPlan, ChapterDraft, ProjectInput } from '../types/index.js';

export class ChiefEditorAgent extends BaseAgent {
  constructor() {
    super('总编');
  }

  async initializeProject(input: ProjectInput): Promise<{
    title: string;
    characterCount: number;
    worldKnowledgeCount: number;
  }> {
    this.log('初始化项目', input.title);

    // 调用记忆管理员初始化记忆
    const result = await memoryManagerAgent.act({ projectInput: input });

    return {
      title: input.title,
      characterCount: result.initializedCharacters,
      worldKnowledgeCount: result.initializedWorldKnowledge,
    };
  }

  async planChapter(
    chapterNumber: number,
    previousChapterSummary?: string
  ): Promise<ChapterPlan> {
    this.log('规划章节', `第${chapterNumber}章`);

    // 检索已有记忆
    const memories = await memoryManagerAgent.retrieveMemories(
      previousChapterSummary || '开场'
    );

    // 构建规划 prompt
    const prompt = `你是一位资深编辑，请为小说规划第${chapterNumber}章。

${previousChapterSummary ? `【上一章概要】\n${previousChapterSummary}\n` : ''}
${memories.worldKnowledge ? `【世界观】\n${memories.worldKnowledge}\n` : ''}
${memories.characters ? `【人物状态】\n${memories.characters}\n` : ''}

请规划第${chapterNumber}章，要求：
1. 标题简洁有力（不超过15字）
2. 列出3-5个关键情节点
3. 明确本章各人物的状态变化
4. 自然承接上文

请以 JSON 格式输出：
{
  "title": "章节标题",
  "keyPoints": ["要点1", "要点2", "要点3"],
  "characterStates": {"人物名": "本章状态"}
}`;

    const response = await this.think(prompt);

    // 简单解析 JSON
    const plan = this.parsePlan(chapterNumber, response);

    this.log('章节规划完成', plan.title);

    return plan;
  }

  async generateChapter(
    chapterNumber: number,
    projectInput: ProjectInput,
    previousChapterSummary?: string
  ): Promise<ChapterDraft> {
    // 1. 规划章节
    const plan = await this.planChapter(chapterNumber, previousChapterSummary);

    // 2. 调用 Writer 生成
    const draft = await writerAgent.act({
      projectInput,
      chapterPlan: plan,
    });

    this.log('章节生成完成', `第${chapterNumber}章`);

    return draft;
  }

  async reviewChapter(chapterId: string): Promise<{
    approved: boolean;
    feedback?: string;
  }> {
    // 简化实现：不做自动审核，只标记为已审核
    this.log('审核章节', chapterId);
    return { approved: true };
  }

  private parsePlan(chapterNumber: number, response: string): ChapterPlan {
    try {
      // 尝试解析 JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          number: chapterNumber,
          title: parsed.title || `第${chapterNumber}章`,
          keyPoints: parsed.keyPoints || [],
          characterStates: parsed.characterStates || {},
        };
      }
    } catch {
      // 解析失败，使用默认值
    }

    return {
      number: chapterNumber,
      title: `第${chapterNumber}章`,
      keyPoints: ['待补充'],
      characterStates: {},
    };
  }
}

export const chiefEditorAgent = new ChiefEditorAgent();
