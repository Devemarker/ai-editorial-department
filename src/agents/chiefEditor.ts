import { BaseAgent, type AgentContext } from './base.js';
import { writerAgent } from './writer.js';
import { memoryManagerAgent } from './memoryManager.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { parseJsonResponse } from '../llm/parseResponse.js';
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

  /**
   * 审核章节内容
   * 检查内容质量、长度、一致性等
   */
  async reviewChapter(chapterId: string): Promise<{
    approved: boolean;
    feedback?: string;
  }> {
    this.log('审核章节', chapterId);

    const chapter = chapterRepository.findById(chapterId);
    if (!chapter) {
      return { approved: false, feedback: `章节 ${chapterId} 不存在` };
    }

    // 基础检查：内容长度
    if (chapter.content.length < 500) {
      return {
        approved: false,
        feedback: `章节内容过短（${chapter.content.length} 字），需要至少 500 字`
      };
    }

    if (chapter.content.length > 30000) {
      return {
        approved: false,
        feedback: `章节内容过长（${chapter.content.length} 字），建议拆分`
      };
    }

    // 使用 LLM 进行质量审核
    const memories = await memoryManagerAgent.retrieveMemories(
      `第${chapter.number}章 ${chapter.title}`
    );

    const prompt = `你是一位资深编辑，请审核以下章节内容。

【章节信息】
章节号：${chapter.number}
标题：${chapter.title}

【当前章节内容】
${chapter.content.slice(0, 5000)}

${memories.characters ? `【人物状态】\n${memories.characters}\n` : ''}
${memories.worldKnowledge ? `【世界观设定】\n${memories.worldKnowledge}\n` : ''}

请进行以下审核：
1. 内容是否完整、有深度
2. 人物行为是否符合其状态设定
3. 情节推进是否合理
4. 是否有明显的逻辑问题或前后矛盾

请以 JSON 格式输出审核结果：
{
  "approved": true或false,
  "score": 1-100之间的评分,
  "issues": ["问题1描述", "问题2描述"],
  "strengths": ["优点1", "优点2"]
}`;

    const response = await this.think(prompt);
    const result = this.parseReviewResponse(response);

    if (result.approved && result.score >= 70) {
      this.log('审核通过', `评分 ${result.score}`);
      return { approved: true, feedback: `评分 ${result.score}/100` };
    } else {
      this.log('审核不通过', `评分 ${result.score}，问题：${result.issues.join(', ')}`);
      return {
        approved: false,
        feedback: `评分 ${result.score}/100\n问题：${result.issues.join('\n')}`
      };
    }
  }

  private parsePlan(chapterNumber: number, response: string): ChapterPlan {
    const fallback: ChapterPlan = {
      number: chapterNumber,
      title: `第${chapterNumber}章`,
      keyPoints: ['待补充'],
      characterStates: {},
    };
    const parsed = parseJsonResponse<Omit<ChapterPlan, 'number'>>(response, fallback);
    if (parsed.keyPoints.length === 0 && parsed.title === fallback.title) {
      console.warn('[ChiefEditor] 章节规划 JSON 解析返回默认值');
    }
    return { number: chapterNumber, ...parsed };
  }

  private parseReviewResponse(response: string): { approved: boolean; score: number; issues: string[]; strengths: string[] } {
    const fallback = { approved: false, score: 0, issues: ['审核失败'], strengths: [] as string[] };
    const parsed = parseJsonResponse<typeof fallback>(response, fallback);
    return parsed;
  }
}

export const chiefEditorAgent = new ChiefEditorAgent();
