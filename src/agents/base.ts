import { llm } from '../llm/openai.js';
import { memoryService } from '../memory/memoryService.js';
import { config } from '../config/index.js';
import type { ProjectInput, ChapterPlan } from '../types/index.js';

/**
 * 智能体执行上下文
 */
export interface AgentContext {
  /** 项目输入信息 */
  projectInput?: ProjectInput;
  /** 章节规划 */
  chapterPlan?: ChapterPlan;
  /** 上一章 ID */
  previousChapterId?: string;
  /** 检索到的记忆上下文 */
  memories?: {
    characters: string[];
    events: string[];
    worldKnowledge: string[];
  };
}

/**
 * 智能体基类
 * 所有智能体（Writer、Editor、Proofreader 等）都继承此类
 */
export abstract class BaseAgent {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  /**
   * 调用 LLM 进行推理
   * @param prompt - 输入提示词
   * @returns LLM 返回的文本
   */
  protected async think(prompt: string): Promise<string> {
    const response = await llm.complete(prompt, {
      temperature: config.llmTemperature,
      maxTokens: config.llmMaxTokens,
    });
    return response.text;
  }

  /**
   * 记录智能体日志
   * @param action - 操作名称
   * @param detail - 详细信息（可选）
   */
  protected log(action: string, detail?: string): void {
    console.log(`[${this.name}] ${action}${detail ? ': ' + detail : ''}`);
  }

  /**
   * 执行智能体任务
   * @param context - 执行上下文
   * @returns 任务结果
   */
  async act(context: AgentContext): Promise<unknown> {
    throw new Error(`${this.name} 不支持直接调用 act 方法，请使用具体方法`);
  }
}
