import type { PipelineTask, QualityReport } from '../types/index.js';

const STATUS_ICONS: Record<string, string> = {
  pending: '⏳',
  writing: '⚙️',
  editing: '📝',
  proofreading: '🔍',
  approved: '✅',
  rejected: '❌',
};

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  writing: '写作中',
  editing: '编辑中',
  proofreading: '校对中',
  approved: '已完成',
  rejected: '已拒绝',
};

export class DashboardPrinter {
  printHeader(title: string): void {
    const width = 60;
    const content = `📊 ${title}`;
    console.log('\n' + '═'.repeat(width));
    console.log(content.padStart((width + content.length) / 2).padEnd(width));
    console.log('═'.repeat(width));
  }

  printProjectStatus(stats: {
    totalChapters: number;
    completed: number;
    inProgress: number;
    pending: number;
  }): void {
    console.log('\n【项目统计】');
    console.log(`   总章节数：${stats.totalChapters}`);
    console.log(`   已完成：${stats.completed}`);
    console.log(`   进行中：${stats.inProgress}`);
    console.log(`   待处理：${stats.pending}`);
  }

  printChapterGrid(tasks: PipelineTask[]): void {
    console.log('\n【章节进度】');
    const sorted = [...tasks].sort((a, b) => a.chapterNumber - b.chapterNumber);

    // 每行显示 5 个
    const rows: string[][] = [];
    for (let i = 0; i < sorted.length; i += 5) {
      rows.push(sorted.slice(i, i + 5).map((t) => t.chapterNumber.toString()));
    }

    for (const row of rows) {
      const cells = row.map((n) => {
        const task = sorted.find((t) => t.chapterNumber === parseInt(n));
        const status = task?.status || 'pending';
        const icon = STATUS_ICONS[status] || '📋';
        return `${icon} 第${n}章`;
      });
      console.log('   ' + cells.join('  '));
    }
  }

  printTaskList(tasks: PipelineTask[]): void {
    console.log('\n【任务列表】');
    const sorted = [...tasks].sort((a, b) => a.chapterNumber - b.chapterNumber);

    for (const task of sorted) {
      const icon = STATUS_ICONS[task.status] || '📋';
      const label = STATUS_LABELS[task.status] || task.status;
      console.log(`   ${icon} 第${task.chapterNumber}章: ${label}`);
    }
  }

  printQualityReports(reports: QualityReport[]): void {
    console.log('\n【质量报告】');

    if (reports.length === 0) {
      console.log('   暂无检测报告');
      return;
    }

    for (const report of reports) {
      const status = report.passed ? '✅ 通过' : '❌ 需修复';
      console.log(`   检测点 #${report.checkpointNumber} (${report.totalChapters}章): 评分 ${report.overallScore}分 ${status}`);
    }
  }

  printQualityReportDetail(report: QualityReport): void {
    console.log('\n' + '─'.repeat(60));
    console.log(`       质量检测报告 #${report.checkpointNumber}`);
    console.log('─'.repeat(60));

    console.log(`检测时间：${new Date(report.createdAt).toLocaleString()}`);
    console.log(`总章节数：${report.totalChapters}`);
    console.log('');

    console.log('【评分详情】');
    console.log(`   人物状态一致性：${report.characterConsistency}%`);
    console.log(`   世界观规则遵守：${report.worldRuleCompliance}%`);
    console.log(`   情节唯一性：${report.plotUniqueness}%`);
    console.log(`   综合评分：${report.overallScore}%`);
    console.log('');
    console.log(`【检测结果】：${report.passed ? '✅ 通过' : '❌ 未通过'}`);

    if (report.issues.length > 0) {
      console.log('\n【问题列表】');
      for (const issue of report.issues) {
        const severityTag = issue.severity === 'critical' ? '🔴' :
                           issue.severity === 'major' ? '🟡' : '🟢';
        console.log(`   ${severityTag} [${issue.type}] ${issue.description}`);
      }
    }
    console.log('─'.repeat(60));
  }

  printManualIntervention(): void {
    console.log('\n【手动干预】');
    console.log('   使用以下命令进行干预：');
    console.log('   npm run cli -- dashboard:rewrite <章节号>  # 重写章节');
    console.log('   npm run cli -- dashboard:review <章节号> # 重新审核');
  }
}

export const dashboardPrinter = new DashboardPrinter();
