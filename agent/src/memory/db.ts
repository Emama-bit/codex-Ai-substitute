import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_DIR = process.env.MEMORY_DIR || path.resolve(__dirname, "../../memory");
const DB_FILE = path.join(DB_DIR, "agent.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  _db = new Database(DB_FILE);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  initDB(_db);
  return _db;
}

function initDB(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      category TEXT DEFAULT '',
      content TEXT NOT NULL,
      details TEXT DEFAULT '',
      people TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      source TEXT DEFAULT 'conversation',
      importance INTEGER DEFAULT 5,
      archived INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS people (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      relation TEXT DEFAULT '',
      notes TEXT DEFAULT '[]',
      interaction_count INTEGER DEFAULT 0,
      last_interaction TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      messages TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profile_kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // FTS5 virtual table — idempotent
  const hasFTS = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts'"
  ).get();
  if (!hasFTS) {
    db.exec(`
      CREATE VIRTUAL TABLE memory_fts USING fts5(
        content, details, category, tags,
        content='memories', content_rowid='rowid'
      );

      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memory_fts(rowid, content, details, category, tags)
        VALUES (new.rowid, new.content, new.details, new.category, new.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content, details, category, tags)
        VALUES ('delete', old.rowid, old.content, old.details, old.category, old.tags);
      END;

      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memory_fts(memory_fts, rowid, content, details, category, tags)
        VALUES ('delete', old.rowid, old.content, old.details, old.category, old.tags);
        INSERT INTO memory_fts(rowid, content, details, category, tags)
        VALUES (new.rowid, new.content, new.details, new.category, new.tags);
      END;
    `);
  }

  // Indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type);
    CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at);
    CREATE INDEX IF NOT EXISTS idx_memories_archived ON memories(archived);
    CREATE INDEX IF NOT EXISTS idx_people_name ON people(name);
  `);
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
