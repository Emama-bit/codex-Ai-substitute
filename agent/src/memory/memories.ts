import { getDb } from "./db";

export interface Memory {
  id: string;
  type: string;       // 'event' | 'decision' | 'habit' | 'document' | 'insight'
  category: string;
  content: string;
  details: string;
  people: string;     // JSON array
  tags: string;       // JSON array
  source: string;
  importance: number;  // 1-10
  archived: number;    // 0 | 1
  created_at: string;
  updated_at: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function now(): string {
  return new Date().toISOString();
}

// ─── Dedup: check if similar memory already exists ──────────

function findSimilar(content: string): Memory | null {
  const db = getDb();
  // Use FTS5 to find content-similar memories
  // Escape special FTS5 characters
  const query = content.replace(/['"*()^~]/g, " ").trim();
  if (query.length < 2) return null;

  try {
    const row = db.prepare(`
      SELECT m.* FROM memory_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memory_fts MATCH ?
      ORDER BY rank
      LIMIT 1
    `).get(query) as Memory | undefined;
    return row || null;
  } catch {
    return null;
  }
}

// ─── Add Memory (with dedup) ───────────────────────────────

export function addMemory(
  type: string,
  content: string,
  opts: {
    category?: string;
    details?: string;
    people?: string[];
    tags?: string[];
    source?: string;
    importance?: number;
  } = {}
): Memory {
  const db = getDb();
  const ts = now();

  // Dedup: if similar exists, boost its importance instead of adding
  const existing = findSimilar(content);
  if (existing && existing.type === type) {
    db.prepare(`
      UPDATE memories SET importance = MIN(10, importance + 1), updated_at = ?
      WHERE id = ?
    `).run(ts, existing.id);
    return { ...existing, importance: Math.min(10, existing.importance + 1), updated_at: ts };
  }

  const memory: Memory = {
    id: genId(),
    type,
    category: opts.category || "",
    content,
    details: opts.details || "",
    people: JSON.stringify(opts.people || []),
    tags: JSON.stringify(opts.tags || []),
    source: opts.source || "conversation",
    importance: opts.importance || 5,
    archived: 0,
    created_at: ts,
    updated_at: ts,
  };

  db.prepare(`
    INSERT INTO memories (id, type, category, content, details, people, tags, source, importance, archived, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    memory.id, memory.type, memory.category, memory.content,
    memory.details, memory.people, memory.tags, memory.source,
    memory.importance, memory.archived, memory.created_at, memory.updated_at
  );

  return memory;
}

// ─── Search (FTS5) ─────────────────────────────────────────

export function searchMemories(
  query: string,
  opts: { type?: string; limit?: number; includeArchived?: boolean } = {}
): Memory[] {
  const db = getDb();
  const limit = opts.limit || 10;
  const q = query.replace(/['"*()^~]/g, " ").trim();
  if (q.length < 2) return [];

  try {
    let sql = `
      SELECT m.* FROM memory_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memory_fts MATCH ?
    `;
    const params: unknown[] = [q];

    if (opts.type) {
      sql += ` AND m.type = ?`;
      params.push(opts.type);
    }
    if (!opts.includeArchived) {
      sql += ` AND m.archived = 0`;
    }

    sql += ` ORDER BY rank LIMIT ?`;
    params.push(limit);

    return db.prepare(sql).all(...params) as Memory[];
  } catch {
    return [];
  }
}

// ─── Recent Memories ───────────────────────────────────────

export function getRecentMemories(
  opts: { type?: string; days?: number; limit?: number; includeArchived?: boolean } = {}
): Memory[] {
  const db = getDb();
  const days = opts.days || 30;
  const limit = opts.limit || 20;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString();

  let sql = `SELECT * FROM memories WHERE created_at >= ?`;
  const params: unknown[] = [cutoffStr];

  if (opts.type) {
    sql += ` AND type = ?`;
    params.push(opts.type);
  }
  if (!opts.includeArchived) {
    sql += ` AND archived = 0`;
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(...params) as Memory[];
}

// ─── For System Prompt: tiered context ─────────────────────

export function getMemoriesForPrompt(): { recent: Memory[]; important: Memory[] } {
  const db = getDb();

  // Recent 7 days, all
  const recent = db.prepare(`
    SELECT * FROM memories
    WHERE archived = 0 AND created_at >= datetime('now', '-7 days')
    ORDER BY created_at DESC LIMIT 15
  `).all() as Memory[];

  // 7-30 days, importance >= 7
  const important = db.prepare(`
    SELECT * FROM memories
    WHERE archived = 0
      AND created_at < datetime('now', '-7 days')
      AND created_at >= datetime('now', '-30 days')
      AND importance >= 7
    ORDER BY importance DESC, created_at DESC LIMIT 10
  `).all() as Memory[];

  return { recent, important };
}

// ─── Archive old memories ──────────────────────────────────

export function archiveOldMemories(days: number = 30): number {
  const db = getDb();
  const result = db.prepare(`
    UPDATE memories SET archived = 1, updated_at = ?
    WHERE archived = 0 AND created_at < datetime('now', '-' || ? || ' days')
    AND importance < 7
  `).run(now(), days);
  return result.changes;
}

// ─── Remove ────────────────────────────────────────────────

export function removeMemory(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM memories WHERE id = ?").run(id);
  return result.changes > 0;
}
