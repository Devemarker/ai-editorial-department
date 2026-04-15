import { getDb } from '../db/sqlite.js';
import type { CharacterState, CreateCharacterInput, UpdateCharacterInput } from '../types/index.js';

function generateId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export class CharacterRepository {
  create(input: CreateCharacterInput): CharacterState {
    const db = getDb();
    const now = Date.now();
    const id = generateId();
    const relationships = JSON.stringify(input.relationships || {});

    const stmt = db.prepare(`
      INSERT INTO characters (id, name, description, current_state, relationships, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(id, input.name, input.description || '', input.currentState || '', relationships, now, now);

    return this.findById(id)!;
  }

  findById(id: string): CharacterState | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM characters WHERE id = ?');
    const row = stmt.get(id) as CharacterRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  findByName(name: string): CharacterState | undefined {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM characters WHERE name = ?');
    const row = stmt.get(name) as CharacterRow | undefined;
    return row ? this.mapRow(row) : undefined;
  }

  findAll(): CharacterState[] {
    const db = getDb();
    const stmt = db.prepare('SELECT * FROM characters ORDER BY created_at');
    const rows = stmt.all() as CharacterRow[];
    return rows.map((r) => this.mapRow(r));
  }

  update(id: string, input: UpdateCharacterInput): CharacterState | undefined {
    const db = getDb();
    const existing = this.findById(id);
    if (!existing) return undefined;

    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }
    if (input.currentState !== undefined) {
      updates.push('current_state = ?');
      values.push(input.currentState);
    }
    if (input.relationships !== undefined) {
      updates.push('relationships = ?');
      values.push(JSON.stringify(input.relationships));
    }

    if (updates.length === 0) return existing;

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(id);

    const stmt = db.prepare(`UPDATE characters SET ${updates.join(', ')} WHERE id = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  delete(id: string): boolean {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM characters WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }

  private mapRow(row: CharacterRow): CharacterState {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      currentState: row.current_state,
      relationships: JSON.parse(row.relationships),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

interface CharacterRow {
  id: string;
  name: string;
  description: string;
  current_state: string;
  relationships: string;
  created_at: number;
  updated_at: number;
}

export const characterRepository = new CharacterRepository();
