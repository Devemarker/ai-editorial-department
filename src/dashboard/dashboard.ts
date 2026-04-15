import { taskQueue } from '../pipeline/taskQueue.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { qualityReportRepository } from '../quality/qualityReportRepository.js';
import { dashboardPrinter } from './printer.js';
import type { PipelineTask } from '../types/index.js';

export class Dashboard {
  // 显示完整看板
  showFullDashboard(): void {
    const tasks = taskQueue.getAllTasks();
    const chapters = chapterRepository.findAll();
    const reports = qualityReportRepository.findAll();

    dashboardPrinter.printHeader('AI 编辑部 - 项目总览');

    // 项目统计
    const stats = this.calculateStats(tasks);
    dashboardPrinter.printProjectStatus(stats);

    // 章节进度
    if (tasks.length > 0) {
      dashboardPrinter.printChapterGrid(tasks);
    } else if (chapters.length > 0) {
      // 如果没有流水线任务，显示已有章节
      this.showChaptersOnly(chapters);
    } else {
      console.log('\n   暂无章节数据');
    }

    // 质量报告
    if (reports.length > 0) {
      dashboardPrinter.printQualityReports(reports);
    }

    // 手动干预提示
    dashboardPrinter.printManualIntervention();
  }

  // 显示章节列表（无流水线任务时）
  private showChaptersOnly(chapters: { number: number; status: string }[]): void {
    console.log('\n【已有章节】');
    const sorted = [...chapters].sort((a, b) => a.number - b.number);

    for (const chapter of sorted) {
      const icon = chapter.status === 'approved' ? '✅' :
                  chapter.status === 'draft' ? '📝' : '📋';
      console.log(`   ${icon} 第${chapter.number}章: ${chapter.status}`);
    }
  }

  // 计算统计
  private calculateStats(tasks: PipelineTask[]): {
    totalChapters: number;
    completed: number;
    inProgress: number;
    pending: number;
  } {
    return {
      totalChapters: taskQueue.getAllTasks().length,
      completed: tasks.filter((t) => t.status === 'approved').length,
      inProgress: tasks.filter((t) => ['writing', 'editing', 'proofreading'].includes(t.status)).length,
      pending: tasks.filter((t) => t.status === 'pending').length,
    };
  }

  // 显示详细任务列表
  showTaskList(): void {
    const tasks = taskQueue.getAllTasks();

    dashboardPrinter.printHeader('AI 编辑部 - 任务列表');
    dashboardPrinter.printTaskList(tasks);
  }

  // 显示章节详情
  showChapterDetail(chapterNumber: number): void {
    const chapter = chapterRepository.findByNumber(chapterNumber);

    if (!chapter) {
      console.log(`\n❌ 章节 ${chapterNumber} 不存在`);
      return;
    }

    dashboardPrinter.printHeader(`AI 编辑部 - 第${chapterNumber}章详情`);

    console.log('\n【基本信息】');
    console.log(`   章节号：${chapter.number}`);
    console.log(`   标题：${chapter.title}`);
    console.log(`   状态：${chapter.status}`);
    console.log(`   字数：${chapter.content.length}`);
    console.log(`   创建时间：${new Date(chapter.createdAt).toLocaleString()}`);
    console.log(`   更新时间：${new Date(chapter.updatedAt).toLocaleString()}`);

    console.log('\n【内容预览】');
    const preview = chapter.content.slice(0, 300);
    console.log('   ' + preview + (chapter.content.length > 300 ? '...' : ''));
  }

  // 手动重写章节
  async rewriteChapter(chapterNumber: number): Promise<void> {
    const task = taskQueue.getAllTasks().find((t) => t.chapterNumber === chapterNumber);

    if (task) {
      console.log(`\n⚙️ 正在重新生成第 ${chapterNumber} 章...`);
      // 重置任务状态
      taskQueue.updateTaskStatus(task.id, 'pending');
      console.log(`✅ 第 ${chapterNumber} 章已重新加入队列`);
    } else {
      console.log(`\n❌ 章节 ${chapterNumber} 不在流水线中，请使用 generate 命令先生成`);
    }
  }

  // 获取质量报告
  getQualityReports() {
    return qualityReportRepository.findAll();
  }
}

export const dashboard = new Dashboard();
