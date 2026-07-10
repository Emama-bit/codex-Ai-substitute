import { getDb } from "./db";

export function saveConversation(id: string, messages: unknown[]): void {
  const db = getDb();
  const ts = new Date().toISOString();
  const json = JSON.stringify(messages);

  db.prepare(`
    INSERT INTO conversations (id, messages, updated_at) VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET messages = excluded.messages, updated_at = excluded.updated_at
  `).run(id, json, ts);
}

export function loadConversation(id: string): unknown[] {
  const db = getDb();
  const row = db.prepare("SELECT messages FROM conversations WHERE id = ?").get(id) as
    | { messages: string }
    | undefined;

  if (!row) return [];
  try {
    return JSON.parse(row.messages);
  } catch {
    return [];
  }
}

export function listConversations(): string[] {
  const db = getDb();
  const rows = db.prepare("SELECT id FROM conversations ORDER BY updated_at DESC").all() as {
    id: string;
  }[];
  return rows.map((r) => r.id);
}
