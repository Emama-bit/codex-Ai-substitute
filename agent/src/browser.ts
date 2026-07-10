import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import os from "os";

export interface BrowsingEntry {
  url: string;
  title: string;
  visitCount: number;
  lastVisit: string;
}

/**
 * 读取 Chrome/Edge 浏览器历史记录
 * @param limit 最多返回条数
 * @param browser 浏览器类型
 */
export function readBrowserHistory(
  limit: number = 100,
  browser: "chrome" | "edge" = "chrome"
): BrowsingEntry[] {
  const historyPath = getHistoryPath(browser);
  if (!historyPath || !fs.existsSync(historyPath)) {
    return [];
  }

  // Copy the file first (Chrome locks the DB while running)
  const tmpPath = path.join(os.tmpdir(), `browser-history-${Date.now()}.db`);
  try {
    fs.copyFileSync(historyPath, tmpPath);
  } catch {
    return [];
  }

  try {
    const db = new Database(tmpPath, { readonly: true });
    const rows = db.prepare(`
      SELECT url, title, visit_count,
             datetime(last_visit_time / 1000000 - 11644473600, 'unixepoch', 'localtime') as last_visit
      FROM urls
      WHERE url NOT LIKE 'chrome://%'
        AND url NOT LIKE 'edge://%'
        AND url NOT LIKE 'about:%'
        AND url NOT LIKE 'file://%'
        AND title != ''
      ORDER BY last_visit_time DESC
      LIMIT ?
    `).all(limit) as BrowsingEntry[];

    db.close();
    return rows;
  } catch {
    return [];
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

function getHistoryPath(browser: "chrome" | "edge"): string | null {
  const home = os.homedir();
  switch (browser) {
    case "chrome":
      return path.join(home, "AppData", "Local", "Google", "Chrome", "User Data", "Default", "History");
    case "edge":
      return path.join(home, "AppData", "Local", "Microsoft", "Edge", "User Data", "Default", "History");
    default:
      return null;
  }
}

/**
 * 从浏览器历史中提取兴趣标签
 */
export function extractInterests(entries: BrowsingEntry[]): {
  domains: { domain: string; count: number }[];
  topics: { topic: string; count: number }[];
} {
  const domainMap = new Map<string, number>();
  const topicMap = new Map<string, number>();

  for (const e of entries) {
    // Extract domain
    try {
      const domain = new URL(e.url).hostname.replace(/^www\./, "");
      domainMap.set(domain, (domainMap.get(domain) || 0) + e.visitCount);
    } catch {}

    // Extract topics from titles (simple keyword extraction)
    const title = e.title.toLowerCase();
    const keywords = title.split(/[\s\-_|/·]+/).filter(w =>
      w.length >= 2 && !isStopWord(w)
    );
    for (const kw of keywords.slice(0, 3)) {
      topicMap.set(kw, (topicMap.get(kw) || 0) + 1);
    }
  }

  const domains = [...domainMap.entries()]
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const topics = [...topicMap.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count)
    .filter(t => t.count >= 2)
    .slice(0, 20);

  return { domains, topics };
}

function isStopWord(w: string): boolean {
  const stops = new Set([
    "the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to",
    "for", "of", "with", "by", "from", "and", "or", "not", "but", "this",
    "that", "it", "as", "be", "do", "has", "have", "had", "will", "can",
    "github", "com", "www", "http", "https", "html", "php", "asp",
  ]);
  return stops.has(w);
}
