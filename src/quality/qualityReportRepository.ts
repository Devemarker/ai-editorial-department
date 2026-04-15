import { getDb } from '../db/sqlite.js';
import type { QualityReport, QualityIssue } from '../types/index.js';

export class QualityReportRepository {
  create(report: QualityReport): QualityReport {
    const stmt = getDb().prepare(`
      INSERT INTO quality_reports
      (id, checkpoint_number, total_chapters, character_consistency,
       world_rule_compliance, plot_uniqueness, overall_score, passed, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      report.id,
      report.checkpointNumber,
      report.totalChapters,
      report.characterConsistency,
      report.worldRuleCompliance,
      report.plotUniqueness,
      report.overallScore,
      report.passed ? 1 : 0,
      report.createdAt
    );

    // 保存问题
    for (const issue of report.issues) {
      const issueStmt = getDb().prepare(`
        INSERT INTO quality_issues
        (id, report_id, type, severity, description, chapter_id,
         related_content, suggested_fix, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      issueStmt.run(
        issue.id,
        report.id,
        issue.type,
        issue.severity,
        issue.description,
        issue.chapterId || null,
        issue.relatedContent || null,
        issue.suggestedFix || null,
        issue.createdAt
      );
    }

    return report;
  }

  findById(id: string): QualityReport | undefined {
    const stmt = getDb().prepare('SELECT * FROM quality_reports WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;

    if (!row) return undefined;

    const issues = this.findIssuesByReportId(id);

    return this.rowToReport(row, issues);
  }

  findAll(): QualityReport[] {
    const stmt = getDb().prepare('SELECT * FROM quality_reports ORDER BY checkpoint_number DESC');
    const rows = stmt.all() as Record<string, unknown>[];

    return rows.map((row) => {
      const issues = this.findIssuesByReportId(row.id as string);
      return this.rowToReport(row, issues);
    });
  }

  private findIssuesByReportId(reportId: string): QualityIssue[] {
    const stmt = getDb().prepare('SELECT * FROM quality_issues WHERE report_id = ?');
    const rows = stmt.all(reportId) as Record<string, unknown>[];

    return rows.map((row) => ({
      id: row.id as string,
      type: row.type as QualityIssue['type'],
      severity: row.severity as QualityIssue['severity'],
      description: row.description as string,
      chapterId: row.chapter_id as string | undefined,
      relatedContent: row.related_content as string | undefined,
      suggestedFix: row.suggested_fix as string | undefined,
      createdAt: row.created_at as number,
    }));
  }

  private rowToReport(row: Record<string, unknown>, issues: QualityIssue[]): QualityReport {
    return {
      id: row.id as string,
      checkpointNumber: row.checkpoint_number as number,
      totalChapters: row.total_chapters as number,
      characterConsistency: row.character_consistency as number,
      worldRuleCompliance: row.world_rule_compliance as number,
      plotUniqueness: row.plot_uniqueness as number,
      overallScore: row.overall_score as number,
      passed: (row.passed as number) === 1,
      createdAt: row.created_at as number,
      issues,
    };
  }
}

export const qualityReportRepository = new QualityReportRepository();
