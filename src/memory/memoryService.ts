import { characterRepository } from './characterRepository.js';
import { eventRepository } from './eventRepository.js';
import { worldKnowledgeRepository } from './worldKnowledgeRepository.js';
import type { MemorySearchResult, CreateCharacterInput, UpdateCharacterInput, CreateEventInput, CharacterState, StoryEvent, WorldKnowledgeItem } from '../types/index.js';

/**
 * 记忆服务
 * 统一管理人物、事件、世界观知识的存储和检索
 */
export class MemoryService {
  // === 人物管理 ===

  /**
   * 创建人物
   */
  createCharacter(input: CreateCharacterInput): CharacterState {
    return characterRepository.create(input);
  }

  /**
   * 根据 ID 获取人物
   */
  getCharacter(id: string): CharacterState | undefined {
    return characterRepository.findById(id);
  }

  /**
   * 根据名称获取人物
   */
  getCharacterByName(name: string): CharacterState | undefined {
    return characterRepository.findByName(name);
  }

  /**
   * 获取所有人物
   */
  getAllCharacters(): CharacterState[] {
    return characterRepository.findAll();
  }

  /**
   * 更新人物信息
   */
  updateCharacter(id: string, input: UpdateCharacterInput): CharacterState | undefined {
    return characterRepository.update(id, input);
  }

  /**
   * 删除人物
   */
  deleteCharacter(id: string): boolean {
    return characterRepository.delete(id);
  }

  // === 事件管理 ===

  /**
   * 创建事件记录
   */
  createEvent(input: CreateEventInput): StoryEvent {
    return eventRepository.create(input);
  }

  /**
   * 根据 ID 获取事件
   */
  getEvent(id: string): StoryEvent | undefined {
    return eventRepository.findById(id);
  }

  /**
   * 获取指定章节的所有事件
   */
  getEventsByChapter(chapterId: string): StoryEvent[] {
    return eventRepository.findByChapterId(chapterId);
  }

  /**
   * 获取所有事件
   */
  getAllEvents(): StoryEvent[] {
    return eventRepository.findAll();
  }

  /**
   * 删除事件
   */
  deleteEvent(id: string): boolean {
    return eventRepository.delete(id);
  }

  // === 世界观知识管理 ===

  /**
   * 添加世界观知识
   */
  async addWorldKnowledge(content: string, metadata?: Record<string, string>): Promise<WorldKnowledgeItem> {
    return await worldKnowledgeRepository.add(content, metadata);
  }

  /**
   * 搜索世界观知识
   */
  async searchWorldKnowledge(query: string, nResults: number = 5): Promise<WorldKnowledgeItem[]> {
    return await worldKnowledgeRepository.search(query, nResults);
  }

  /**
   * 删除世界观知识
   */
  async deleteWorldKnowledge(id: string): Promise<boolean> {
    return await worldKnowledgeRepository.delete(id);
  }

  // === 混合检索 ===

  /**
   * 综合检索记忆
   * 同时检索人物、事件和世界观知识
   */
  async searchMemories(context: string, options: {
    includeCharacters?: boolean;
    includeEvents?: boolean;
    includeWorld?: boolean;
    maxResults?: number;
  } = {}): Promise<MemorySearchResult> {
    const {
      includeCharacters = true,
      includeEvents = true,
      includeWorld = true,
      maxResults = 5,
    } = options;

    const result: MemorySearchResult = {
      characters: [],
      events: [],
      worldKnowledge: [],
    };

    if (includeCharacters) {
      result.characters = characterRepository.findAll().slice(0, maxResults);
    }

    if (includeEvents) {
      result.events = eventRepository.findAll().slice(0, maxResults);
    }

    if (includeWorld) {
      result.worldKnowledge = await worldKnowledgeRepository.search(context, maxResults);
    }

    return result;
  }
}

export const memoryService = new MemoryService();
