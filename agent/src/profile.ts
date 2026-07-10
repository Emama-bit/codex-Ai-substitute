import { getDb } from "./memory/db";

export interface PersonalProfile {
  name: string;
  avatar: string;
  bio: string;
  habits: Habit[];
  preferences: Record<string, string>;
  workStyle: Record<string, string>;
  updatedAt: string;
}

export interface Habit {
  id: string;
  category: string;
  content: string;
  source: string;
  confidence: number;
  createdAt: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── KV helpers ────────────────────────────────────────────

function getKV(key: string): string {
  const db = getDb();
  const row = db.prepare("SELECT value FROM profile_kv WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value || "";
}

function setKV(key: string, value: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO profile_kv (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value);
}

// ─── Habits (stored in memories table, type='habit') ───────

function loadHabits(): Habit[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, category, content, source, importance as confidence, created_at as createdAt
    FROM memories WHERE type = 'habit' AND archived = 0
    ORDER BY created_at DESC
  `).all() as Habit[];
  return rows;
}

// ─── Profile CRUD ──────────────────────────────────────────

export function loadProfile(): PersonalProfile {
  const habits = loadHabits();
  const prefsRaw = getKV("preferences");
  const wsRaw = getKV("workStyle");

  let preferences: Record<string, string> = {};
  let workStyle: Record<string, string> = {};
  try { preferences = JSON.parse(prefsRaw || "{}"); } catch {}
  try { workStyle = JSON.parse(wsRaw || "{}"); } catch {}

  return {
    name: getKV("name"),
    avatar: getKV("avatar"),
    bio: getKV("bio"),
    habits,
    preferences,
    workStyle,
    updatedAt: getKV("updatedAt") || new Date().toISOString(),
  };
}

export function saveProfile(profile: PersonalProfile): void {
  setKV("name", profile.name);
  setKV("avatar", profile.avatar);
  setKV("bio", profile.bio);
  setKV("preferences", JSON.stringify(profile.preferences));
  setKV("workStyle", JSON.stringify(profile.workStyle));
  setKV("updatedAt", new Date().toISOString());
}

export function addHabit(
  category: string,
  content: string,
  source: string = "conversation",
  confidence: number = 8
): Habit {
  const db = getDb();
  const ts = new Date().toISOString();
  const id = genId();

  db.prepare(`
    INSERT INTO memories (id, type, category, content, source, importance, created_at, updated_at)
    VALUES (?, 'habit', ?, ?, ?, ?, ?, ?)
  `).run(id, category, content, source, confidence, ts, ts);

  return { id, category, content, source, confidence, createdAt: ts };
}

export function removeHabit(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM memories WHERE id = ? AND type = 'habit'").run(id);
  return result.changes > 0;
}

export function updatePreference(key: string, value: string): void {
  const prefs = loadProfile().preferences;
  prefs[key] = value;
  setKV("preferences", JSON.stringify(prefs));
}

export function updateBio(bio: string): void {
  setKV("bio", bio);
}

export function updateName(name: string): void {
  setKV("name", name);
}

export function getProfileSummary(): string {
  const p = loadProfile();
  const parts: string[] = [];
  if (p.name) parts.push(`姓名: ${p.name}`);
  if (p.bio) parts.push(`简介: ${p.bio}`);
  if (p.habits.length > 0) {
    const byCategory = p.habits.reduce((acc, h) => {
      (acc[h.category] ??= []).push(h.content);
      return acc;
    }, {} as Record<string, string[]>);
    parts.push("习惯:");
    for (const [cat, items] of Object.entries(byCategory)) {
      parts.push(`  [${cat}] ${items.join("; ")}`);
    }
  }
  if (Object.keys(p.preferences).length > 0) {
    parts.push("偏好:");
    for (const [k, v] of Object.entries(p.preferences)) {
      parts.push(`  ${k}: ${v}`);
    }
  }
  if (Object.keys(p.workStyle).length > 0) {
    parts.push("工作方式:");
    for (const [k, v] of Object.entries(p.workStyle)) {
      parts.push(`  ${k}: ${v}`);
    }
  }
  return parts.length > 0 ? parts.join("\n") : "（暂无个人画像数据）";
}
