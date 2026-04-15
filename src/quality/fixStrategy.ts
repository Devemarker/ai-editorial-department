import type { QualityIssue } from '../types/index.js';

// 修复策略类型
export type FixStrategyType = 'ignore' | 'retry' | 'rebuild';

export class FixStrategy {
  // 根据问题类型选择策略
  selectStrategy(issue: QualityIssue): FixStrategyType {
    switch (issue.type) {
      case 'character_conflict':
        return issue.severity === 'critical' ? 'rebuild' : 'retry';
      case 'world_rule_violation':
        return issue.severity === 'critical' ? 'rebuild' : 'ignore';
      case 'plot_repetition':
        return 'rebuild';
      default:
        return 'ignore';
    }
  }

  // 生成修复建议
  generateSuggestion(issue: QualityIssue): string {
    switch (issue.type) {
      case 'character_conflict':
        return '建议重新生成章节，确保人物状态与之前一致';
      case 'world_rule_violation':
        return '建议补充世界观细节，增强章节内容深度';
      case 'plot_repetition':
        return '建议重新设计本章情节，避免与前文重复';
      default:
        return '请人工审核';
    }
  }

  // 批量处理问题
  processIssues(issues: QualityIssue[]): Map<FixStrategyType, QualityIssue[]> {
    const result = new Map<FixStrategyType, QualityIssue[]>();
    result.set('ignore', []);
    result.set('retry', []);
    result.set('rebuild', []);

    for (const issue of issues) {
      const strategy = this.selectStrategy(issue);
      result.get(strategy)!.push(issue);
    }

    return result;
  }
}

export const fixStrategy = new FixStrategy();
