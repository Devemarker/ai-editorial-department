import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DashboardPrinter } from '../dashboard/printer.js';
import type { PipelineTask, QualityReport } from '../types/index.js';

describe('DashboardPrinter', () => {
  let printer: DashboardPrinter;
  let consoleMock: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    printer = new DashboardPrinter();
    consoleMock = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleMock.mockRestore();
  });

  describe('printHeader', () => {
    it('应打印居中标题', () => {
      printer.printHeader('测试标题');
      expect(consoleMock).toHaveBeenCalled();
      const firstCall = consoleMock.mock.calls[0][0] as string;
      expect(firstCall).toContain('═'.repeat(60));
    });
  });

  describe('printProjectStatus', () => {
    it('应打印正确的统计数据', () => {
      printer.printProjectStatus({
        totalChapters: 10,
        completed: 5,
        inProgress: 3,
        pending: 2,
      });

      expect(consoleMock).toHaveBeenCalledWith('\n【项目统计】');
      expect(consoleMock).toHaveBeenCalledWith('   总章节数：10');
      expect(consoleMock).toHaveBeenCalledWith('   已完成：5');
      expect(consoleMock).toHaveBeenCalledWith('   进行中：3');
      expect(consoleMock).toHaveBeenCalledWith('   待处理：2');
    });

    it('应处理零值', () => {
      printer.printProjectStatus({
        totalChapters: 0,
        completed: 0,
        inProgress: 0,
        pending: 0,
      });

      expect(consoleMock).toHaveBeenCalledWith('   总章节数：0');
    });
  });

  describe('printTaskList', () => {
    it('应按章节号排序打印任务', () => {
      const tasks: PipelineTask[] = [
        { id: '3', chapterNumber: 3, status: 'pending', createdAt: 0, updatedAt: 0 },
        { id: '1', chapterNumber: 1, status: 'approved', createdAt: 0, updatedAt: 0 },
        { id: '2', chapterNumber: 2, status: 'writing', createdAt: 0, updatedAt: 0 },
      ];

      printer.printTaskList(tasks);

      const calls = consoleMock.mock.calls.map(c => c[0] as string);
      expect(calls[1]).toContain('第1章');
      expect(calls[2]).toContain('第2章');
      expect(calls[3]).toContain('第3章');
    });

    it('应使用正确的状态图标', () => {
      const tasks: PipelineTask[] = [
        { id: '1', chapterNumber: 1, status: 'approved', createdAt: 0, updatedAt: 0 },
      ];

      printer.printTaskList(tasks);

      const output = consoleMock.mock.calls.map(c => c[0] as string).join('');
      expect(output).toContain('✅');
    });
  });

  describe('printChapterGrid', () => {
    it('应正确分排任务', () => {
      const tasks: PipelineTask[] = [
        { id: '1', chapterNumber: 1, status: 'pending', createdAt: 0, updatedAt: 0 },
        { id: '2', chapterNumber: 2, status: 'pending', createdAt: 0, updatedAt: 0 },
        { id: '3', chapterNumber: 3, status: 'pending', createdAt: 0, updatedAt: 0 },
      ];

      printer.printChapterGrid(tasks);

      expect(consoleMock).toHaveBeenCalled();
    });
  });

  describe('printQualityReports', () => {
    it('应打印质量报告标题', () => {
      const reports: QualityReport[] = [];

      printer.printQualityReports(reports);

      expect(consoleMock).toHaveBeenCalledWith('\n【质量报告】');
      expect(consoleMock).toHaveBeenCalledWith('   暂无检测报告');
    });
  });
});
