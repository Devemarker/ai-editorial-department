import { characterRepository } from '../memory/characterRepository.js';
import { eventRepository } from '../memory/eventRepository.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { worldKnowledgeRepository } from '../memory/worldKnowledgeRepository.js';
import { generateId } from '../lib/id.js';
import type { QualityIssue } from '../types/index.js';

/**
 * 一致性检查器
 * 检查人物状态一致性、世界观规则遵守情况和情节唯一性
 */
export class ConsistencyChecker {
  /**
   * 检查人物状态一致性
   * 验证所有人物的状态是否有矛盾（如状态描述为空或过短）
   */
  async checkCharacterConsistency(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const characters = characterRepository.findAll();

    for (const char of characters) {
      // 检查人物状态是否有矛盾（简化实现）
      if (!char.currentState || char.currentState.length < 2) {
        issues.push({
          id: generateId('issue'),
          type: 'character_conflict',
          severity: 'major',
          description: `人物 "${char.name}" 状态异常：${char.currentState}`,
          relatedContent: char.currentState,
          createdAt: Date.now(),
        });
      }
    }

    return issues;
  }

  /**
   * 检查世界观规则遵守情况
   * 验证章节内容是否充分展开世界观（内容过短可能未充分描写）
   */
  async checkWorldRuleCompliance(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const chapters = chapterRepository.findAll();

    // 简化实现：检查章节内容是否过短（可能违反详细世界观）
    for (const chapter of chapters) {
      if (chapter.content.length < 500) {
        issues.push({
          id: generateId('issue'),
          type: 'world_rule_violation',
          severity: 'minor',
          description: `第 ${chapter.number} 章内容过短，可能未充分展开世界观`,
          chapterId: chapter.id,
          relatedContent: chapter.content.slice(0, 100),
          createdAt: Date.now(),
        });
      }
    }

    return issues;
  }

  /**
   * 检查情节唯一性
   * 验证相邻章节是否存在情节重复（通过标题相似度判断）
   */
  async checkPlotUniqueness(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const chapters = chapterRepository.findAll();

    // 简化实现：检查相邻章节标题是否相似
    for (let i = 1; i < chapters.length; i++) {
      const prev = chapters[i - 1];
      const curr = chapters[i];

      // 简单相似度检查：标题相似度
      if (this.similarity(prev.title, curr.title) > 0.7) {
        issues.push({
          id: generateId('issue'),
          type: 'plot_repetition',
          severity: 'major',
          description: `第 ${prev.number} 章和第 ${curr.number} 章标题相似度较高，可能存在情节重复`,
          chapterId: curr.id,
          relatedContent: `前章: ${prev.title}, 本章: ${curr.title}`,
          createdAt: Date.now(),
        });
      }
    }

    return issues;
  }

  /**
   * 执行所有检查
   * 并行运行三项检查并汇总结果
   */
  async checkAll(): Promise<QualityIssue[]> {
    const [characterIssues, worldIssues, plotIssues] = await Promise.all([
      this.checkCharacterConsistency(),
      this.checkWorldRuleCompliance(),
      this.checkPlotUniqueness(),
    ]);

    return [...characterIssues, ...worldIssues, ...plotIssues];
  }

  /**
   * 简单字符串相似度计算
   * 基于字符集合的交集/并集比率
   */
  private similarity(a: string, b: string): number {
    const s1 = a.toLowerCase();
    const s2 = b.toLowerCase();
    if (s1 === s2) return 1;
    if (s1.length < 2 || s2.length < 2) return 0;

    const set1 = new Set(s1.split(''));
    const set2 = new Set(s2.split(''));
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    return intersection.size / Math.max(set1.size, set2.size);
  }
}

export const consistencyChecker = new ConsistencyChecker();
