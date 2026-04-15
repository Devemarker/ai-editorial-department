import { globalEventBus } from '../pipeline/eventBus.js';
import { consistencyChecker } from './consistencyChecker.js';
import { reportGenerator } from './reportGenerator.js';
import { qualityReportRepository } from './qualityReportRepository.js';
import { autoFixExecutor } from './autoFixExecutor.js';
import type { PipelineEvent, QualityReport } from '../types/index.js';

const CHECKPOINT_INTERVAL = 5; // 每 5 章检测一次

let checkpointCounter = 0;

export class Checkpoint {
  private config: {
    interval: number;
    onCheckpointComplete?: (report: QualityReport) => void;
  };

  constructor(config?: { interval?: number; onCheckpointComplete?: (report: QualityReport) => void }) {
    this.config = {
      interval: config?.interval ?? CHECKPOINT_INTERVAL,
      onCheckpointComplete: config?.onCheckpointComplete,
    };
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 监听章节完成事件
    globalEventBus.on<PipelineEvent>('task:written', () => {
      checkpointCounter++;
      if (checkpointCounter % this.config.interval === 0) {
        this.triggerCheckpoint(Math.floor(checkpointCounter / this.config.interval));
      }
    });
  }

  async triggerCheckpoint(checkpointNumber: number): Promise<QualityReport> {
    console.log(`[Checkpoint] 触发第 ${checkpointNumber} 次检测...`);

    // 执行一致性检查
    const issues = await consistencyChecker.checkAll();

    // 生成报告
    const report = reportGenerator.generate({
      checkpointNumber,
      totalChapters: checkpointCounter,
      issues,
    });

    // 保存到数据库
    qualityReportRepository.create(report);

    // 自动修复
    const { fixed, failed, ignored, rebuildIssues } = await autoFixExecutor.processReport(report);
    console.log(`[Checkpoint] 自动修复完成: 修复 ${fixed} 个, 失败 ${failed} 个, 忽略 ${ignored} 个`);
    if (rebuildIssues.length > 0) {
      console.log(`[Checkpoint] 需要人工处理 ${rebuildIssues.length} 个问题`);
    }

    this.config.onCheckpointComplete?.(report);
    return report;
  }

  getCheckpointCount(): number {
    return checkpointCounter;
  }

  getChapterCount(): number {
    return checkpointCounter;
  }
}

export const checkpoint = new Checkpoint();
