/**
 * 一次性迁移脚本：将 JSON 文件数据迁移到 SQLite
 * 运行: npx tsx scripts/migrate-json-to-sqlite.ts
 */

import fs from "fs";
import path from "path";
import { getDb, closeDb } from "../src/memory/db";

const MEMORY_DIR = path.resolve(__dirname, "../memory");

function loadJSON<T>(file: string, fallback: T): T {
  const fp = path.join(MEMORY_DIR, file);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8"));
  } catch {
    return fallback;
  }
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function migrate() {
  const db = getDb();

  console.log("🚀 开始迁移...\n");

  // ── Migrate Events → memories table ──────────────────────
  const events = loadJSON<any[]>("events.json", []);
  console.log(`📌 事件: ${events.length} 条`);
  const insertMemory = db.prepare(`
    INSERT OR IGNORE INTO memories (id, type, category, content, details, people, tags, source, importance, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const e of events) {
    const ts = e.createdAt || new Date().toISOString();
    insertMemory.run(
      e.id || genId(),
      "event",
      e.category || "",
      e.summary || e.content || "",
      e.details || "",
      JSON.stringify(e.people || []),
      JSON.stringify(e.tags || []),
      e.source || "migration",
      5,
      ts,
      ts
    );
  }

  // ── Migrate Decisions → memories table ───────────────────
  const decisions = loadJSON<any[]>("decisions.json", []);
  console.log(`📋 决策: ${decisions.length} 条`);
  for (const d of decisions) {
    insertMemory.run(
      d.id || genId(),
      "decision",
      "",
      `${d.topic}: 选了"${d.chosen}"`,
      `选项: ${(d.options || []).join(", ")}。原因: ${d.reason || ""}`,
      "[]",
      "[]",
      "migration",
      7,
      d.createdAt || new Date().toISOString(),
      d.createdAt || new Date().toISOString()
    );
  }

  // ── Migrate Habits (from profile.json) → memories table ──
  const profile = loadJSON<any>("profile.json", {});
  const habits = profile.habits || [];
  console.log(`🧠 习惯: ${habits.length} 条`);
  for (const h of habits) {
    insertMemory.run(
      h.id || genId(),
      "habit",
      h.category || "",
      h.content || "",
      "",
      "[]",
      "[]",
      h.source || "migration",
      h.confidence || 5,
      h.createdAt || new Date().toISOString(),
      h.createdAt || new Date().toISOString()
    );
  }

  // ── Migrate Profile KV ───────────────────────────────────
  const insertKV = db.prepare(`
    INSERT OR REPLACE INTO profile_kv (key, value) VALUES (?, ?)
  `);
  const kvs: [string, string][] = [
    ["name", profile.name || ""],
    ["avatar", profile.avatar || ""],
    ["bio", profile.bio || ""],
    ["preferences", JSON.stringify(profile.preferences || {})],
    ["workStyle", JSON.stringify(profile.workStyle || {})],
    ["updatedAt", profile.updatedAt || new Date().toISOString()],
  ];
  console.log(`👤 画像: ${kvs.length} 个字段`);
  for (const [k, v] of kvs) {
    insertKV.run(k, v);
  }

  // ── Migrate People → people table ────────────────────────
  const people = loadJSON<any[]>("people.json", []);
  console.log(`👥 人脉: ${people.length} 人`);
  const insertPerson = db.prepare(`
    INSERT OR IGNORE INTO people (id, name, relation, notes, interaction_count, last_interaction, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of people) {
    insertPerson.run(
      p.id || genId(),
      p.name,
      p.relation || "",
      JSON.stringify(p.notes || []),
      p.interactionCount || 0,
      p.lastInteraction || "",
      p.createdAt || new Date().toISOString()
    );
  }

  // ── Migrate Conversations → conversations table ──────────
  const convFiles = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith(".json") && !["profile.json", "events.json", "people.json", "decisions.json"].includes(f));
  console.log(`💬 对话: ${convFiles.length} 个`);
  const insertConv = db.prepare(`
    INSERT OR REPLACE INTO conversations (id, messages, updated_at) VALUES (?, ?, ?)
  `);
  for (const f of convFiles) {
    const convId = f.replace(".json", "");
    const messages = loadJSON<any[]>(f, []);
    insertConv.run(convId, JSON.stringify(messages), new Date().toISOString());
  }

  // ── Summary ──────────────────────────────────────────────
  const totalMemories = (db.prepare("SELECT COUNT(*) as c FROM memories").get() as any).c;
  const totalPeople = (db.prepare("SELECT COUNT(*) as c FROM people").get() as any).c;
  const totalConvs = (db.prepare("SELECT COUNT(*) as c FROM conversations").get() as any).c;

  console.log(`\n✅ 迁移完成！`);
  console.log(`   记忆: ${totalMemories} 条`);
  console.log(`   人脉: ${totalPeople} 人`);
  console.log(`   对话: ${totalConvs} 个`);
  console.log(`\n📁 原 JSON 文件已保留作备份，可手动删除。`);
  console.log(`📁 新数据库: ${path.join(MEMORY_DIR, "agent.db")}`);

  closeDb();
}

migrate();
