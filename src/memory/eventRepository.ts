import { getDb } from '../db/sqlite.js';
import { generateId } from '../lib/id.js';
import type { StoryEvent, CreateEventInput } from '../types/index.js';

export class EventRepository {
  create(input: CreateEventInput): StoryEvent {
    const db = getDb();
    const now = Date.now();
    const id = generateId('evt');

    const stmt = db.prepare(`
      INSERT INTO events (id, chapter_id, description, timestamp_in_story, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.chapterId, input.description, input.timestampInStory || 0, now);

    const created = this.findById(id);
    if (!created) throw new Error(`创建事件失败: ${id}`);
    return created;
  }

  findById(id: string): StoryEvent | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM events WHERE id = ?');
    const row = stmt.get(id) as EventRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  findByChapterId(chapterId: string): StoryEvent[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM events WHERE chapter_id = ? ORDER BY timestamp_in_story');
    const rows = stmt.all(chapterId) as EventRow[];
    return rows.map((r) => this.mapRow(r));
  }

  findAll(): StoryEvent[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM events ORDER BY timestamp_in_story');
    const rows = stmt.all() as EventRow[];
    return rows.map((r) => this.mapRow(r));
  }

  delete(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM events WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  deleteByChapterId(chapterId: string): number {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM events WHERE chapter_id = ?');
    const result = stmt.run(chapterId);
    return result.changes;
  }

  private mapRow(row: EventRow): StoryEvent {
    return {
      id: row.id,
      chapterId: row.chapter_id,
      description: row.description,
      timestampInStory: row.timestamp_in_story,
      createdAt: row.created_at,
    };
  }
}

interface EventRow {
  id: string;
  chapter_id: string;
  description: string;
  timestamp_in_story: number;
  created_at: number;
}

export const eventRepository = new EventRepository();
