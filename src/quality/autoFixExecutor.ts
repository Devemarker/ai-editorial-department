import { fixStrategy } from './fixStrategy.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { writerAgent } from '../agents/writer.js';
import type { QualityIssue, QualityReport, ProjectInput } from '../types/index.js';

export class AutoFixExecutor {
  async executeFix(issue: QualityIssue, projectInput?: ProjectInput): Promise<{ success: boolean; suggestedFix?: string }> {
    const strategy = fixStrategy.selectStrategy(issue);

    switch (strategy) {
      case 'ignore':
        return { success: true }; // 忽略，继续

      case 'retry':
        // 重新生成当前章节
        if (issue.chapterId && projectInput) {
          await this.retryChapter(issue.chapterId, projectInput);
          return { success: true };
        }
        return { success: false, suggestedFix: fixStrategy.generateSuggestion(issue) };

      case 'rebuild':
        // 重建需要更多上下文，标记为需要人工处理
        return { success: false, suggestedFix: fixStrategy.generateSuggestion(issue) };
    }
  }

  private async retryChapter(chapterId: string, projectInput: ProjectInput): Promise<void> {
    const chapter = chapterRepository.findById(chapterId);
    if (!chapter) return;

    // 调用 Writer 重新生成
    const draft = await writerAgent.act({
      projectInput,
      chapterPlan: {
        number: chapter.number,
        title: chapter.title,
        keyPoints: [],
        characterStates: {},
      },
    });

    // 更新章节
    chapterRepository.update(chapterId, { content: draft.content });
  }

  async processReport(report: QualityReport, projectInput?: ProjectInput): Promise<{
    fixed: number;
    failed: number;
    ignored: number;
    rebuildIssues: Array<{ issue: QualityIssue; suggestedFix: string }>;
  }> {
    const strategyMap = fixStrategy.processIssues(report.issues);
    let fixed = 0;
    let failed = 0;
    const ignored = (strategyMap.get('ignore') || []).length;
    const rebuildIssues: Array<{ issue: QualityIssue; suggestedFix: string }> = [];

    // 处理 rebuild 策略（收集需要人工处理的问题）
    for (const issue of strategyMap.get('rebuild') || []) {
      const suggestedFix = fixStrategy.generateSuggestion(issue);
      rebuildIssues.push({ issue, suggestedFix });
      failed++;
    }

    // 处理 retry 策略
    for (const issue of strategyMap.get('retry') || []) {
      const result = await this.executeFix(issue, projectInput);
      if (result.success) {
        fixed++;
      } else {
        failed++;
      }
    }

    return { fixed, failed, ignored, rebuildIssues };
  }
}

export const autoFixExecutor = new AutoFixExecutor();
