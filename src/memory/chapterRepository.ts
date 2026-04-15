import { getDb } from '../db/sqlite.js';
import type { Chapter } from '../types/index.js';

function generateId(): string {
  return `ch_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class ChapterRepository {
  create(input: {
    number: number;
    title: string;
    content: string;
    status?: string;
  }): Chapter {
    const db = getDb();
    const now = Date.now();
    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO chapters (id, number, title, content, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.number, input.title, input.content, input.status || 'draft', now, now);

    return this.findById(id)!;
  }

  findById(id: string): Chapter | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM chapters WHERE id = ?');
    const row = stmt.get(id) as ChapterRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  findByNumber(number: number): Chapter | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM chapters WHERE number = ?');
    const row = stmt.get(number) as ChapterRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  findAll(): Chapter[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM chapters ORDER BY number');
    const rows = stmt.all() as ChapterRow[];
    return rows.map((r) => this.mapRow(r));
  }

  update(
    id: string,
    input: Partial<{ title: string; content: string; status: string }>
  ): Chapter | undefined {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title);
    }
    if (input.content !== undefined) {
      updates.push('content = ?');
      values.push(input.content);
    }
    if (input.status !== undefined) {
      updates.push('status = ?');
      values.push(input.status);
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`UPDATE chapters SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM chapters WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapRow(row: ChapterRow): Chapter {
    return {
      id: row.id,
      number: row.number,
      title: row.title,
      content: row.content,
      status: row.status as Chapter['status'],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

interface ChapterRow {
  id: string;
  number: number;
  title: string;
  content: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export const chapterRepository = new ChapterRepository();
