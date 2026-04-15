import Database from 'better-sqlite3';
import { readFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { dirname, resolve } from 'path';
import { config } from '../config/index.js';

let db: Database.Database | null = null;

function ensureDir(filePath: string): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
}

export function getDb(): Database.Database {
  if (!db) {
    // 确保目录存在
    const resolvedPath = resolve(process.cwd(), config.dbPath);
    ensureDir(resolvedPath);

    db = new Database(resolvedPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function initDb(): void {
  const schemaPath = resolve(process.cwd(), 'src/db/schema.sql');
  const schema = readFileSync(schemaPath, 'utf-8');
  getDb().exec(schema);
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// 测试用：重置数据库连接（清除单例）
export function resetDb(): void {
  if (db) {
    db.close();
  }
  db = null;
}

// 测试用：禁用外键约束（用于测试环境）
export function disableForeignKeys(): void {
  getDb().pragma('foreign_keys = OFF');
}

// 测试用：启用外键约束
export function enableForeignKeys(): void {
  getDb().pragma('foreign_keys = ON');
}

// 测试用：清理数据库文件
export function cleanDb(): void {
  const dbPath = resolve(process.cwd(), config.dbPath);

  // 先关闭连接
  if (db) {
    db.close();
    db = null;
  }

  // 删除数据库文件及相关文件
  try {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
    const walPath = dbPath + '-wal';
    const shmPath = dbPath + '-shm';
    if (existsSync(walPath)) unlinkSync(walPath);
    if (existsSync(shmPath)) unlinkSync(shmPath);
  } catch (err) {
    console.warn('[DB] 清理数据库文件失败（文件可能被占用）:', err);
  }
}
