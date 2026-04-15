import { characterRepository } from '../memory/characterRepository.js';
import { eventRepository } from '../memory/eventRepository.js';
import { chapterRepository } from '../memory/chapterRepository.js';
import { worldKnowledgeRepository } from '../memory/worldKnowledgeRepository.js';
import { llm } from '../llm/openai.js';
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
    const events = eventRepository.findAll();

    for (const char of characters) {
      // 检查1：状态描述是否为空或过短
      if (!char.currentState || char.currentState.length < 2) {
        issues.push({
          id: generateId('issue'),
          type: 'character_conflict',
          severity: 'major',
          description: `人物 "${char.name}" 状态描述异常：状态为空或过短`,
          relatedContent: char.currentState || '(空)',
          createdAt: Date.now(),
        });
      }

      // 检查2：人物关系是否包含不存在的人物
      if (char.relationships) {
        const charNames = characters.map((c) => c.name);
        for (const [relName, relDesc] of Object.entries(char.relationships)) {
          // 关系描述中提到的人物应该存在
          for (const otherChar of characters) {
            if (otherChar.name !== char.name && relDesc.includes(otherChar.name)) {
              // 检查该人物是否存在
              if (!charNames.includes(otherChar.name)) {
                issues.push({
                  id: generateId('issue'),
                  type: 'character_conflict',
                  severity: 'minor',
                  description: `人物 "${char.name}" 的关系 "${relName}" 中提到的人物 "${otherChar.name}" 未在系统中注册`,
                  relatedContent: `${relName}: ${relDesc}`,
                  createdAt: Date.now(),
                });
              }
            }
          }
        }
      }

      // 检查3：同一人物的状态变化是否合理（检查事件中的人物状态是否一致）
      const charEvents = events.filter((e) =>
        e.description.includes(char.name) && e.description.includes('状态')
      );

      if (charEvents.length >= 2) {
        // 检查连续事件中人物状态是否矛盾
        for (let i = 1; i < charEvents.length; i++) {
          const prevEvent = charEvents[i - 1];
          const currEvent = charEvents[i];
          // 简单检查：状态不应该在短时间内剧烈变化
          const timeDiff = currEvent.timestampInStory - prevEvent.timestampInStory;
          if (timeDiff < 0) {
            issues.push({
              id: generateId('issue'),
              type: 'character_conflict',
              severity: 'minor',
              description: `人物 "${char.name}" 的事件时间线可能存在矛盾`,
              relatedContent: `前事件: ${prevEvent.description.slice(0, 50)}...`,
              createdAt: Date.now(),
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * 检查世界观规则遵守情况
   * 验证章节内容是否充分展开世界观
   */
  async checkWorldRuleCompliance(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const chapters = chapterRepository.findAll();

    for (const chapter of chapters) {
      // 检查1：章节内容是否过短
      if (chapter.content.length < 500) {
        issues.push({
          id: generateId('issue'),
          type: 'world_rule_violation',
          severity: 'minor',
          description: `第 ${chapter.number} 章内容过短（${chapter.content.length}字），可能未充分展开世界观`,
          chapterId: chapter.id,
          relatedContent: chapter.content.slice(0, 100),
          createdAt: Date.now(),
        });
      }

      // 检查2：章节内容是否为空
      if (!chapter.content.trim()) {
        issues.push({
          id: generateId('issue'),
          type: 'world_rule_violation',
          severity: 'critical',
          description: `第 ${chapter.number} 章内容为空`,
          chapterId: chapter.id,
          createdAt: Date.now(),
        });
      }

      // 检查3：章节是否缺少标点符号（简单检查）
      const punctuationCount = (chapter.content.match(/[。！？；：""''（）]/g) || []).length;
      const avgPunctuationPerHundredChars = (punctuationCount / chapter.content.length) * 100;
      if (avgPunctuationPerHundredChars < 2 && chapter.content.length > 100) {
        issues.push({
          id: generateId('issue'),
          type: 'world_rule_violation',
          severity: 'major',
          description: `第 ${chapter.number} 章标点符号使用异常，可能存在语法问题`,
          chapterId: chapter.id,
          relatedContent: `标点密度: ${avgPunctuationPerHundredChars.toFixed(2)}%`,
          createdAt: Date.now(),
        });
      }
    }

    // 检查4：世界观一致性（通过 LLM 分析）
    const worldIssues = await this.checkWorldConsistencyWithLLM(chapters);
    issues.push(...worldIssues);

    return issues;
  }

  /**
   * 使用 LLM 检查世界观一致性
   */
  private async checkWorldConsistencyWithLLM(chapters: { id: string; number: number; content: string }[]): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    if (chapters.length < 2) return issues;

    // 检查相邻章节间的世界观一致性
    for (let i = 1; i < chapters.length; i++) {
      const prev = chapters[i - 1];
      const curr = chapters[i];

      // 截取内容用于分析
      const prevContent = prev.content.slice(0, 1000);
      const currContent = curr.content.slice(0, 1000);

      const prompt = `你是一个世界观一致性检查员。请分析以下两个相邻章节的内容，判断是否存在世界观矛盾。

【第 ${prev.number} 章内容摘要】
${prevContent}

【第 ${curr.number} 章内容摘要】
${currContent}

请检查：
1. 场景设定是否一致
2. 人物出现的位置是否合理
3. 时间线是否矛盾
4. 规则设定是否自相矛盾

请以 JSON 格式输出：
{
  "hasConflict": true或false,
  "conflictType": "场景冲突/人物位置冲突/时间线冲突/规则冲突/无冲突",
  "description": "如果有问题，简要描述问题"
}`;

      try {
        const response = await llm.complete(prompt, { temperature: 0.3 });
        const result = this.parseWorldConsistencyResponse(response.text);

        if (result.hasConflict) {
          issues.push({
            id: generateId('issue'),
            type: 'world_rule_violation',
            severity: 'major',
            description: `第 ${prev.number} 章和第 ${curr.number} 章存在世界观${result.conflictType}：${result.description}`,
            chapterId: curr.id,
            relatedContent: `${result.conflictType}: ${result.description}`,
            createdAt: Date.now(),
          });
        }
      } catch (err) {
        console.error('[ConsistencyChecker] 世界观一致性检查失败:', err);
      }
    }

    return issues;
  }

  /**
   * 检查情节唯一性
   * 验证相邻章节是否存在情节重复
   */
  async checkPlotUniqueness(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];
    const chapters = chapterRepository.findAll();

    // 检查1：相邻章节标题是否相似
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

      // 检查2：检查内容重复（通过 LLM 分析）
      const contentIssue = await this.checkContentRepetition(prev, curr);
      if (contentIssue) {
        issues.push(contentIssue);
      }
    }

    // 检查3：检查所有章节间的整体情节发展趋势
    if (chapters.length >= 3) {
      const plotIssue = await this.checkOverallPlotProgression(chapters);
      if (plotIssue) {
        issues.push(plotIssue);
      }
    }

    return issues;
  }

  /**
   * 使用 LLM 检查两章节间的内容重复
   */
  private async checkContentRepetition(
    prev: { id: string; number: number; content: string },
    curr: { id: string; number: number; content: string }
  ): Promise<QualityIssue | null> {
    const prompt = `你是一个情节重复检测员。请分析以下两个相邻章节的内容，判断是否存在重复。

【第 ${prev.number} 章内容】
${prev.content.slice(0, 1500)}

【第 ${curr.number} 章内容】
${curr.content.slice(0, 1500)}

请检查：
1. 是否有完全相同的段落或句子
2. 是否有相同的情节描写
3. 是否有重复的对话内容

请以 JSON 格式输出：
{
  "hasRepetition": true或false,
  "repetitionType": "完全重复/部分重复/无重复",
  "description": "如果有问题，简要描述重复内容"
}`;

    try {
      const response = await llm.complete(prompt, { temperature: 0.3 });
      const result = this.parseRepetitionResponse(response.text);

      if (result.hasRepetition) {
        return {
          id: generateId('issue'),
          type: 'plot_repetition',
          severity: result.repetitionType === '完全重复' ? 'critical' : 'major',
          description: `第 ${prev.number} 章和第 ${curr.number} 章存在${result.repetitionType}：${result.description}`,
          chapterId: curr.id,
          relatedContent: result.description,
          createdAt: Date.now(),
        };
      }
    } catch (err) {
      console.error('[ConsistencyChecker] 情节重复检查失败:', err);
    }

    return null;
  }

  /**
   * 检查整体情节发展趋势是否有问题
   */
  private async checkOverallPlotProgression(
    chapters: { id: string; number: number; content: string }[]
  ): Promise<QualityIssue | null> {
    if (chapters.length < 3) return null;

    // 取最近3章进行分析
    const recentChapters = chapters.slice(-3);
    const prompt = `你是一个情节发展分析师。请分析以下章节的发展趋势。

${recentChapters.map((c, i) => `【第 ${c.number} 章】\n${c.content.slice(0, 500)}`).join('\n\n')}

请检查：
1. 情节是否在推进，还是在原地踏步
2. 是否有重复的发展模式
3. 节奏是否合理

请以 JSON 格式输出：
{
  "hasIssue": true或false,
  "issueType": "停滞不前/重复模式/节奏问题/无问题",
  "description": "如果有问题，简要描述"
}`;

    try {
      const response = await llm.complete(prompt, { temperature: 0.3 });
      const result = this.parsePlotProgressionResponse(response.text);

      if (result.hasIssue) {
        return {
          id: generateId('issue'),
          type: 'plot_repetition',
          severity: 'minor',
          description: `最近几章存在${result.issueType}：${result.description}`,
          chapterId: recentChapters[recentChapters.length - 1].id,
          relatedContent: result.description,
          createdAt: Date.now(),
        };
      }
    } catch (err) {
      console.error('[ConsistencyChecker] 整体情节发展检查失败:', err);
    }

    return null;
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

  private parseWorldConsistencyResponse(response: string): { hasConflict: boolean; conflictType: string; description: string } {
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {}
    return { hasConflict: false, conflictType: '无冲突', description: '' };
  }

  private parseRepetitionResponse(response: string): { hasRepetition: boolean; repetitionType: string; description: string } {
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {}
    return { hasRepetition: false, repetitionType: '无重复', description: '' };
  }

  private parsePlotProgressionResponse(response: string): { hasIssue: boolean; issueType: string; description: string } {
    try {
      const match = response.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
    } catch {}
    return { hasIssue: false, issueType: '无问题', description: '' };
  }
}

export const consistencyChecker = new ConsistencyChecker();
