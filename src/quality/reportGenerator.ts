import type { QualityIssue, QualityReport, IssueType } from '../types/index.js';

function generateId(): string {
  return `report_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class ReportGenerator {
  generate(input: {
    checkpointNumber: number;
    totalChapters: number;
    issues: QualityIssue[];
  }): QualityReport {
    const { checkpointNumber, totalChapters, issues } = input;

    // 计算各项分数
    const characterConsistency = this.calculateCharacterScore(issues);
    const worldRuleCompliance = this.calculateWorldScore(issues);
    const plotUniqueness = this.calculatePlotScore(issues);

    // 综合评分（加权平均）
    const overallScore = Math.round(
      characterConsistency * 0.4 + worldRuleCompliance * 0.3 + plotUniqueness * 0.3
    );

    // 通过标准：总分 >= 80 且无 critical 问题
    const passed = overallScore >= 80 && !issues.some((i) => i.severity === 'critical');

    return {
      id: generateId(),
      checkpointNumber,
      totalChapters,
      issues,
      characterConsistency,
      worldRuleCompliance,
      plotUniqueness,
      overallScore,
      passed,
      createdAt: Date.now(),
    };
  }

  formatReport(report: QualityReport): string {
    const lines: string[] = [
      `========== 质量检测报告 #${report.checkpointNumber} ==========`,
      `检测时间：${new Date(report.createdAt).toLocaleString()}`,
      `总章节数：${report.totalChapters}`,
      '',
      '【评分详情】',
      `  人物状态一致性：${report.characterConsistency}%`,
      `  世界观规则遵守：${report.worldRuleCompliance}%`,
      `  情节唯一性：${report.plotUniqueness}%`,
      `  综合评分：${report.overallScore}%`,
      '',
      `【检测结果】：${report.passed ? '✅ 通过' : '❌ 未通过'}`,
      '',
    ];

    if (report.issues.length > 0) {
      lines.push('【问题列表】');
      const byType = this.groupByType(report.issues);
      for (const [type, typeIssues] of Object.entries(byType)) {
        lines.push(`\n  [${type}] (${typeIssues.length} 个问题)`);
        for (const issue of typeIssues) {
          lines.push(`    - ${issue.description}`);
          if (issue.suggestedFix) {
            lines.push(`      建议修复：${issue.suggestedFix}`);
          }
        }
      }
    }

    lines.push('\n' + '='.repeat(50));
    return lines.join('\n');
  }

  private calculateCharacterScore(issues: QualityIssue[]): number {
    const characterIssues = issues.filter((i) => i.type === 'character_conflict');
    if (characterIssues.length === 0) return 100;
    const penalty = characterIssues.reduce((sum, i) => {
      return sum + (i.severity === 'critical' ? 30 : i.severity === 'major' ? 15 : 5);
    }, 0);
    return Math.max(0, 100 - penalty);
  }

  private calculateWorldScore(issues: QualityIssue[]): number {
    const worldIssues = issues.filter((i) => i.type === 'world_rule_violation');
    if (worldIssues.length === 0) return 100;
    const penalty = worldIssues.reduce((sum, i) => {
      return sum + (i.severity === 'critical' ? 30 : i.severity === 'major' ? 15 : 5);
    }, 0);
    return Math.max(0, 100 - penalty);
  }

  private calculatePlotScore(issues: QualityIssue[]): number {
    const plotIssues = issues.filter((i) => i.type === 'plot_repetition');
    if (plotIssues.length === 0) return 100;
    const penalty = plotIssues.reduce((sum, i) => {
      return sum + (i.severity === 'critical' ? 30 : i.severity === 'major' ? 15 : 5);
    }, 0);
    return Math.max(0, 100 - penalty);
  }

  private groupByType(issues: QualityIssue[]): Record<IssueType, QualityIssue[]> {
    return issues.reduce(
      (acc, issue) => {
        if (!acc[issue.type]) acc[issue.type] = [];
        acc[issue.type].push(issue);
        return acc;
      },
      {} as Record<IssueType, QualityIssue[]>
    );
  }
}

export const reportGenerator = new ReportGenerator();
