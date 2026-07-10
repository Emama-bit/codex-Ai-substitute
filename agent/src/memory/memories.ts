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

// ─── Phase 2: Proactive Intelligence ──────────────────────

export function getDailyBriefing(): {
  yesterday: Memory[];
  pendingFollowUps: string[];
  habitAlerts: string[];
  recentImportant: Memory[];
} {
  const db = getDb();

  // Yesterday's memories
  const yesterday = db.prepare(`
    SELECT * FROM memories
    WHERE archived = 0
      AND created_at >= datetime('now', '-1 day')
      AND created_at < datetime('now', 'start of day')
    ORDER BY created_at DESC
  `).all() as Memory[];

  // Memories with question marks or TODO-like content (potential follow-ups)
  const pendingFollowUps = db.prepare(`
    SELECT content, details FROM memories
    WHERE archived = 0
      AND (content LIKE '%计划%' OR content LIKE '%打算%' OR content LIKE '%要%'
           OR content LIKE '%准备%' OR content LIKE '%下周%' OR content LIKE '%明天%'
           OR content LIKE '%TODO%' OR content LIKE '%待%')
      AND created_at >= datetime('now', '-7 days')
    ORDER BY created_at DESC LIMIT 5
  `).all() as { content: string; details: string }[];

  // Habit gap detection
  const habitAlerts = detectHabitGaps(db);

  // Recent high-importance memories
  const recentImportant = db.prepare(`
    SELECT * FROM memories
    WHERE archived = 0 AND importance >= 7
      AND created_at >= datetime('now', '-3 days')
    ORDER BY importance DESC, created_at DESC LIMIT 5
  `).all() as Memory[];

  return {
    yesterday,
    pendingFollowUps: pendingFollowUps.map(m => m.content),
    habitAlerts,
    recentImportant,
  };
}

function detectHabitGaps(db: ReturnType<typeof getDb>): string[] {
  const alerts: string[] = [];

  // Get all habits
  const habits = db.prepare(`
    SELECT content, category, created_at FROM memories
    WHERE type = 'habit' AND archived = 0
  `).all() as { content: string; category: string; created_at: string }[];

  // Check if there are recent events related to each habit category
  const categories = [...new Set(habits.map(h => h.category))];

  for (const cat of categories) {
    if (!cat) continue;

    // Count events in this category in last 3 days
    const recentCount = db.prepare(`
      SELECT COUNT(*) as c FROM memories
      WHERE type = 'event' AND category = ? AND archived = 0
        AND created_at >= datetime('now', '-3 days')
    `).get(cat) as { c: number };

    // Count events in this category in the 3 days before that
    const olderCount = db.prepare(`
      SELECT COUNT(*) as c FROM memories
      WHERE type = 'event' AND category = ? AND archived = 0
        AND created_at >= datetime('now', '-6 days')
        AND created_at < datetime('now', '-3 days')
    `).get(cat) as { c: number };

    if (olderCount.c > 0 && recentCount.c === 0) {
      alerts.push(`最近3天没有关于"${cat}"的记录，之前有${olderCount.c}条`);
    }
  }

  // Check for specific habit keywords
  const exerciseHabit = habits.find(h => h.category === "运动" || /运动|健身|跑步/.test(h.content));
  if (exerciseHabit) {
    const lastExercise = db.prepare(`
      SELECT created_at FROM memories
      WHERE type = 'event' AND (category = '运动' OR content LIKE '%运动%' OR content LIKE '%健身%' OR content LIKE '%跑步%')
        AND archived = 0
      ORDER BY created_at DESC LIMIT 1
    `).get() as { created_at: string } | undefined;

    if (lastExercise) {
      const daysSince = Math.floor((Date.now() - new Date(lastExercise.created_at).getTime()) / 86400000);
      if (daysSince >= 3) {
        alerts.push(`你已经${daysSince}天没有运动了`);
      }
    }
  }

  return alerts;
}

export function getFollowUps(): { memory: Memory; reason: string }[] {
  const db = getDb();
  const results: { memory: Memory; reason: string }[] = [];

  // 1. Memories that mention plans/future actions
  const plans = db.prepare(`
    SELECT * FROM memories
    WHERE archived = 0
      AND (content LIKE '%计划%' OR content LIKE '%打算%' OR content LIKE '%要%'
           OR content LIKE '%准备%' OR content LIKE '%下周%' OR content LIKE '%明天%')
      AND created_at >= datetime('now', '-7 days')
    ORDER BY created_at DESC LIMIT 10
  `).all() as Memory[];

  for (const m of plans) {
    results.push({ memory: m, reason: "这是一个计划/打算，可能需要跟进" });
  }

  // 2. Decisions without follow-up events
  const decisions = db.prepare(`
    SELECT * FROM memories WHERE type = 'decision' AND archived = 0
    ORDER BY created_at DESC LIMIT 5
  `).all() as Memory[];

  for (const d of decisions) {
    // Check if there are events after this decision that relate to it
    const followUp = db.prepare(`
      SELECT COUNT(*) as c FROM memories
      WHERE type = 'event' AND archived = 0
        AND created_at > ?
        AND (content LIKE ? OR details LIKE ?)
    `).get(d.created_at, `%${d.content.slice(0, 20)}%`, `%${d.content.slice(0, 20)}%`) as { c: number };

    if (followUp.c === 0) {
      results.push({ memory: d, reason: "这个决定还没有后续行动记录" });
    }
  }

  // 3. People with high interaction but no recent contact
  const people = db.prepare(`
    SELECT name, last_interaction, interaction_count FROM people
    WHERE interaction_count >= 3
    ORDER BY interaction_count DESC LIMIT 10
  `).all() as { name: string; last_interaction: string; interaction_count: number }[];

  for (const p of people) {
    if (p.last_interaction) {
      const daysSince = Math.floor((Date.now() - new Date(p.last_interaction).getTime()) / 86400000);
      if (daysSince >= 7) {
        const mem = db.prepare(`
          SELECT * FROM memories WHERE archived = 0 AND people LIKE ? ORDER BY created_at DESC LIMIT 1
        `).get(`%${p.name}%`) as Memory | undefined;
        if (mem) {
          results.push({ memory: mem, reason: `已经${daysSince}天没有和${p.name}联系了` });
        }
      }
    }
  }

  return results.slice(0, 10);
}
