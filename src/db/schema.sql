-- AI 编辑部智能体编排系统 - 数据库 Schema

-- 人物状态表
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  current_state TEXT NOT NULL DEFAULT '',
  relationships TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 章节表
CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- 事件时间线
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL,
  description TEXT NOT NULL,
  timestamp_in_story INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
);

-- 世界观规则
CREATE TABLE IF NOT EXISTS world_rules (
  id TEXT PRIMARY KEY,
  rule TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_events_chapter_id ON events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(number);
CREATE INDEX IF NOT EXISTS idx_characters_name ON characters(name);

-- 检测报告表
CREATE TABLE IF NOT EXISTS quality_reports (
  id TEXT PRIMARY KEY,
  checkpoint_number INTEGER NOT NULL,
  total_chapters INTEGER NOT NULL,
  character_consistency INTEGER NOT NULL,
  world_rule_compliance INTEGER NOT NULL,
  plot_uniqueness INTEGER NOT NULL,
  overall_score INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

-- 检测问题表
CREATE TABLE IF NOT EXISTS quality_issues (
  id TEXT PRIMARY KEY,
  report_id TEXT NOT NULL,
  type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL,
  chapter_id TEXT,
  related_content TEXT,
  suggested_fix TEXT,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (report_id) REFERENCES quality_reports(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_issues_report_id ON quality_issues(report_id);
CREATE INDEX IF NOT EXISTS idx_reports_checkpoint ON quality_reports(checkpoint_number);
