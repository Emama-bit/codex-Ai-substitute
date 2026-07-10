import { getDb } from "./db";

export interface Person {
  id: string;
  name: string;
  relation: string;
  notes: string;   // JSON array
  interaction_count: number;
  last_interaction: string;
  created_at: string;
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function upsertPerson(name: string, note: string, relation?: string): Person {
  const db = getDb();
  const ts = new Date().toISOString();
  const td = today();

  const existing = db.prepare(
    "SELECT * FROM people WHERE name = ? COLLATE NOCASE"
  ).get(name) as Person | undefined;

  if (existing) {
    const notes: string[] = JSON.parse(existing.notes || "[]");
    notes.push(`[${td}] ${note}`);
    if (notes.length > 20) notes.splice(0, notes.length - 20);

    db.prepare(`
      UPDATE people SET notes = ?, interaction_count = interaction_count + 1,
        last_interaction = ?, relation = COALESCE(?, relation)
      WHERE id = ?
    `).run(JSON.stringify(notes), td, relation || null, existing.id);

    return db.prepare("SELECT * FROM people WHERE id = ?").get(existing.id) as Person;
  }

  const person: Person = {
    id: genId(),
    name,
    relation: relation || "",
    notes: JSON.stringify([`[${td}] ${note}`]),
    interaction_count: 1,
    last_interaction: td,
    created_at: ts,
  };

  db.prepare(`
    INSERT INTO people (id, name, relation, notes, interaction_count, last_interaction, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(person.id, person.name, person.relation, person.notes,
    person.interaction_count, person.last_interaction, person.created_at);

  return person;
}

export function updatePersonRelation(name: string, relation: string): Person | null {
  const db = getDb();
  const existing = db.prepare(
    "SELECT * FROM people WHERE name = ? COLLATE NOCASE"
  ).get(name) as Person | undefined;

  if (!existing) return null;

  db.prepare("UPDATE people SET relation = ? WHERE id = ?").run(relation, existing.id);
  return db.prepare("SELECT * FROM people WHERE id = ?").get(existing.id) as Person;
}

export function getPeople(limit: number = 20): Person[] {
  const db = getDb();
  return db.prepare(
    "SELECT * FROM people ORDER BY interaction_count DESC LIMIT ?"
  ).all(limit) as Person[];
}

export function getPersonByName(name: string): Person | null {
  const db = getDb();
  const person = db.prepare(
    "SELECT * FROM people WHERE name = ? COLLATE NOCASE"
  ).get(name) as Person | undefined;
  return person || null;
}

export function getPersonSummary(): string {
  const people = getPeople(10);
  if (people.length === 0) return "（暂无人脉记录）";

  return people.map(p => {
    const notes: string[] = JSON.parse(p.notes || "[]");
    const recent = notes.slice(-3).join("; ");
    return `${p.name}（${p.relation || "未分类"}）互动${p.interaction_count}次，最近：${recent}`;
  }).join("\n");
}
