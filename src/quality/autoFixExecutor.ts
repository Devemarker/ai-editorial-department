import { fixStrategy } from './fixStrategy.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { writerAgent } from '../agents/writer.js';
import type { QualityIssue, QualityReport, ProjectInput } from '../types/index.js';

export class AutoFixExecutor {
  async executeFix(issue: QualityIssue, projectInput?: ProjectInput): Promise<boolean> {
    const strategy = fixStrategy.selectStrategy(issue);

    switch (strategy) {
      case 'ignore':
        return true; // 忽略，继续

      case 'retry':
        // 重新生成当前章节
        if (issue.chapterId && projectInput) {
          await this.retryChapter(issue.chapterId, projectInput);
          return true;
        }
        return false;

      case 'rebuild':
        // 重建需要更多上下文，标记为需要人工处理
        issue.suggestedFix = fixStrategy.generateSuggestion(issue);
        return false;
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
  }> {
    const strategyMap = fixStrategy.processIssues(report.issues);
    let fixed = 0;
    let failed = 0;
    let ignored = 0;

    // 处理 ignore 策略
    ignored = (strategyMap.get('ignore') || []).length;

    // 处理 rebuild 策略（标记需要人工）
    for (const issue of strategyMap.get('rebuild') || []) {
      issue.suggestedFix = fixStrategy.generateSuggestion(issue);
      failed++;
    }

    // 处理 retry 策略
    for (const issue of strategyMap.get('retry') || []) {
      const success = await this.executeFix(issue, projectInput);
      if (success) fixed++;
      else failed++;
    }

    return { fixed, failed, ignored };
  }
}

export const autoFixExecutor = new AutoFixExecutor();
