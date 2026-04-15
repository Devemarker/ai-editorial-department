import { globalEventBus } from '../pipeline/eventBus.js';
import { consistencyChecker } from './consistencyChecker.js';
import { reportGenerator } from './reportGenerator.js';
import { qualityReportRepository } from './qualityReportRepository.js';
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
