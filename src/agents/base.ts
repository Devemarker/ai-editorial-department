import { llm } from '../llm/openai.js';
import { memoryService } from '../memory/memoryService.js';
import type { ProjectInput, ChapterPlan } from '../types/index.js';

export interface AgentContext {
  projectInput?: ProjectInput;
  chapterPlan?: ChapterPlan;
  previousChapterId?: string;
  memories?: {
    characters: string[];
    events: string[];
    worldKnowledge: string[];
  };
}

export abstract class BaseAgent {
  protected name: string;

  constructor(name: string) {
    this.name = name;
  }

  protected async think(prompt: string): Promise<string> {
    const response = await llm.complete(prompt, {
      temperature: 0.7,
      maxTokens: 2048,
    });
    return response.text;
  }

  protected log(action: string, detail?: string): void {
    console.log(`[${this.name}] ${action}${detail ? ': ' + detail : ''}`);
  }

  async act(context: AgentContext): Promise<unknown> {
    throw new Error(`${this.name} 不支持直接调用 act 方法，请使用具体方法`);
  }
}
