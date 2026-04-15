import { characterRepository } from './characterRepository.js';
import { eventRepository } from './eventRepository.js';
import { worldKnowledgeRepository } from './worldKnowledgeRepository.js';
import type { MemorySearchResult, CreateCharacterInput, UpdateCharacterInput, CreateEventInput } from '../types/index.js';

export class MemoryService {
  // === 人物管理 ===
  createCharacter(input: CreateCharacterInput) {
    return characterRepository.create(input);
  }

  getCharacter(id: string) {
    return characterRepository.findById(id);
  }

  getCharacterByName(name: string) {
    return characterRepository.findByName(name);
  }

  getAllCharacters() {
    return characterRepository.findAll();
  }

  updateCharacter(id: string, input: UpdateCharacterInput) {
    return characterRepository.update(id, input);
  }

  deleteCharacter(id: string) {
    return characterRepository.delete(id);
  }

  // === 事件管理 ===
  createEvent(input: CreateEventInput) {
    return eventRepository.create(input);
  }

  getEvent(id: string) {
    return eventRepository.findById(id);
  }

  getEventsByChapter(chapterId: string) {
    return eventRepository.findByChapterId(chapterId);
  }

  getAllEvents() {
    return eventRepository.findAll();
  }

  deleteEvent(id: string) {
    return eventRepository.delete(id);
  }

  // === 世界观知识管理 ===
  async addWorldKnowledge(content: string, metadata?: Record<string, string>) {
    return await worldKnowledgeRepository.add(content, metadata);
  }

  async searchWorldKnowledge(query: string, nResults: number = 5) {
    return await worldKnowledgeRepository.search(query, nResults);
  }

  async deleteWorldKnowledge(id: string) {
    return await worldKnowledgeRepository.delete(id);
  }

  // === 混合检索 ===
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
