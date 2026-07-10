import fs from "fs";
import path from "path";
import { addMemory } from "./memory/memories";
import { upsertPerson } from "./memory/people";
import { addHabit, updatePreference } from "./profile";

// ─── Types ───────────────────────────────────────────────

export interface ChatMessage {
  time: string;
  sender: string;
  content: string;
}

export interface ImportResult {
  totalMessages: number;
  timeRange: string;
  senders: string[];
  extractedEvents: number;
  extractedPeople: number;
  extractedHabits: number;
  preview: string;
}

// ─── Parser ──────────────────────────────────────────────

/**
 * 解析微信聊天记录导出文件
 * 支持多种格式：
 * 1. 微信PC版导出: "昵称\n2024-01-15 14:30:20\n消息内容"
 * 2. 时间戳格式: "[2024-01-15 14:30:20] 昵称: 消息内容"
 * 3. 简单格式: "2024-01-15 14:30 昵称: 消息内容"
 */
export function parseWeChatExport(content: string): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const lines = content.split("\n").map(l => l.trim()).filter(Boolean);

  // Try format 1: 微信PC版标准导出
  // Pattern: 昵称(可选括号)\n时间戳\n消息内容
  const format1 = parseFormat1(lines);
  if (format1.length > 0) return format1;

  // Try format 2: [时间戳] 昵称: 消息
  const format2 = parseFormat2(lines);
  if (format2.length > 0) return format2;

  // Try format 3: 时间戳 昵称: 消息
  const format3 = parseFormat3(lines);
  if (format3.length > 0) return format3;

  // Fallback: treat each line as a message
  return lines.map((line, i) => ({
    time: new Date().toISOString(),
    sender: "unknown",
    content: line,
  }));
}

function parseFormat1(lines: string[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const timeRegex = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/;
  const nameRegex = /^[\w一-鿿()（）\s·-]+$/;

  let i = 0;
  while (i < lines.length) {
    // Look for pattern: name, time, content
    if (
      i + 2 < lines.length &&
      nameRegex.test(lines[i]) &&
      timeRegex.test(lines[i + 1])
    ) {
      messages.push({
        time: lines[i + 1],
        sender: lines[i],
        content: lines[i + 2],
      });
      i += 3;
    } else {
      i++;
    }
  }
  return messages;
}

function parseFormat2(lines: string[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const regex = /^\[(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})\]\s*(.+?)[:：]\s*(.+)$/;

  for (const line of lines) {
    const m = line.match(regex);
    if (m) {
      messages.push({ time: m[1], sender: m[2].trim(), content: m[3].trim() });
    }
  }
  return messages;
}

function parseFormat3(lines: string[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  const regex = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(.+?)[:：]\s*(.+)$/;

  for (const line of lines) {
    const m = line.match(regex);
    if (m) {
      messages.push({ time: m[1], sender: m[2].trim(), content: m[3].trim() });
    }
  }
  return messages;
}

// ─── Import ──────────────────────────────────────────────

/**
 * 导入微信聊天记录并自动提取信息
 * @param content 聊天记录文本内容
 * @param ownerName 聊天记录主人的昵称（用于区分自己和他人）
 * @param source 来源标识
 */
export function importWeChatChat(
  content: string,
  ownerName: string = "",
  source: string = "wechat-export"
): ImportResult {
  const messages = parseWeChatExport(content);
  if (messages.length === 0) {
    return {
      totalMessages: 0,
      timeRange: "",
      senders: [],
      extractedEvents: 0,
      extractedPeople: 0,
      extractedHabits: 0,
      preview: "无法解析聊天记录，请检查格式",
    };
  }

  // Collect unique senders
  const senderSet = new Set(messages.map(m => m.sender));
  const senders = [...senderSet];

  // Update people records for all participants
  for (const sender of senders) {
    if (sender !== ownerName && sender !== "unknown") {
      upsertPerson(sender, `[微信导入] 参与对话`);
    }
  }

  // Extract structured info from message batches
  let extractedEvents = 0;
  let extractedHabits = 0;

  // Group messages by date
  const byDate = groupByDate(messages);

  for (const [date, dayMsgs] of Object.entries(byDate)) {
    // Extract events from each day's messages
    const events = extractEventsFromMessages(dayMsgs, ownerName, date);
    for (const evt of events) {
      addMemory("event", evt.summary, {
        category: evt.category,
        details: evt.details,
        people: evt.people,
        tags: evt.tags,
        source,
      });
      extractedEvents++;
    }

    // Extract habits
    const habits = extractHabitsFromMessages(dayMsgs, ownerName);
    for (const habit of habits) {
      addHabit(habit.category, habit.content, source, 6);
      extractedHabits++;
    }
  }

  const timeRange = `${messages[0].time.slice(0, 10)} ~ ${messages[messages.length - 1].time.slice(0, 10)}`;

  // Generate preview
  const preview = generatePreview(messages, senders, extractedEvents, extractedHabits);

  return {
    totalMessages: messages.length,
    timeRange,
    senders,
    extractedEvents,
    extractedPeople: senders.filter(s => s !== ownerName && s !== "unknown").length,
    extractedHabits,
    preview,
  };
}

// ─── Extraction Helpers ──────────────────────────────────

function groupByDate(messages: ChatMessage[]): Record<string, ChatMessage[]> {
  const groups: Record<string, ChatMessage[]> = {};
  for (const msg of messages) {
    const date = msg.time.slice(0, 10);
    (groups[date] ??= []).push(msg);
  }
  return groups;
}

interface ExtractedEvent {
  category: string;
  summary: string;
  details: string;
  people: string[];
  tags: string[];
}

function extractEventsFromMessages(
  messages: ChatMessage[],
  ownerName: string,
  date: string
): ExtractedEvent[] {
  const events: ExtractedEvent[] = [];
  const allContent = messages.map(m => m.content).join(" ");
  const otherPeople = [...new Set(messages.map(m => m.sender).filter(s => s !== ownerName && s !== "unknown"))];

  // Meeting patterns
  const meetPatterns = [
    /见面|约了|聚餐|吃饭|聚会|开会|meeting|见面聊聊/i,
    /(明天|今天|下周|后天|周末).{0,10}(见|聚|约|聊|吃)/i,
  ];
  for (const pat of meetPatterns) {
    if (pat.test(allContent)) {
      const match = allContent.match(/(.{0,30}(见面|约了|聚餐|吃饭|聚会|开会).{0,30})/);
      events.push({
        category: "社交",
        summary: match ? match[0].slice(0, 50) : "社交活动",
        details: allContent.slice(0, 200),
        people: otherPeople,
        tags: ["社交"],
      });
      break;
    }
  }

  // Work/project patterns
  const workPatterns = [
    /项目|需求|bug|上线|部署|代码|review|测试|发布/i,
    /deadline|排期|迭代|版本|修复|优化/i,
  ];
  for (const pat of workPatterns) {
    if (pat.test(allContent)) {
      events.push({
        category: "工作",
        summary: `工作讨论 (${otherPeople.join(", ") || "群聊"})`,
        details: extractRelevantLines(messages, pat).join("; ").slice(0, 200),
        people: otherPeople,
        tags: ["工作"],
      });
      break;
    }
  }

  // Travel/outing patterns
  const travelPatterns = [
    /旅游|出差|去.{2,6}(玩|逛|看)|机票|酒店|高铁|火车/i,
    /(周末|假期|放假).{0,10}(去|到|在)/i,
  ];
  for (const pat of travelPatterns) {
    if (pat.test(allContent)) {
      events.push({
        category: "生活",
        summary: "出行/旅游计划",
        details: extractRelevantLines(messages, pat).join("; ").slice(0, 200),
        people: otherPeople,
        tags: ["出行"],
      });
      break;
    }
  }

  // Shopping patterns
  const shopPatterns = [
    /买了|下单|购物|淘宝|京东|拼多多|快递|外卖/i,
  ];
  for (const pat of shopPatterns) {
    if (pat.test(allContent)) {
      events.push({
        category: "生活",
        summary: "购物/消费",
        details: extractRelevantLines(messages, pat).join("; ").slice(0, 200),
        people: otherPeople,
        tags: ["购物"],
      });
      break;
    }
  }

  return events;
}

function extractHabitsFromMessages(
  messages: ChatMessage[],
  ownerName: string
): { category: string; content: string }[] {
  const habits: { category: string; content: string }[] = [];
  const myMessages = messages.filter(m => m.sender === ownerName);
  const allContent = myMessages.map(m => m.content).join(" ");

  // Eating habits
  if (/奶茶|咖啡|可乐|火锅|烧烤|外卖|快餐/.test(allContent)) {
    const match = allContent.match(/(奶茶|咖啡|可乐|火锅|烧烤|外卖)/);
    if (match) {
      habits.push({ category: "饮食", content: `经常提及: ${match[1]}` });
    }
  }

  // Activity patterns
  if (/健身|跑步|游泳|瑜伽|运动/.test(allContent)) {
    habits.push({ category: "运动", content: "有运动习惯" });
  }

  if (/熬夜|通宵|失眠/.test(allContent)) {
    habits.push({ category: "作息", content: "可能有熬夜习惯" });
  }

  if (/游戏|王者|吃鸡|原神|LOL/.test(allContent)) {
    const match = allContent.match(/(王者|吃鸡|原神|LOL|游戏)/);
    if (match) {
      habits.push({ category: "娱乐", content: `玩游戏: ${match[1]}` });
    }
  }

  return habits;
}

function extractRelevantLines(messages: ChatMessage[], pattern: RegExp): string[] {
  return messages
    .filter(m => pattern.test(m.content))
    .map(m => m.content.slice(0, 80))
    .slice(0, 5);
}

function generatePreview(
  messages: ChatMessage[],
  senders: string[],
  events: number,
  habits: number
): string {
  const lines: string[] = [];
  lines.push(`📊 共解析 ${messages.length} 条消息`);
  lines.push(`👥 参与者: ${senders.join(", ")}`);
  lines.push(`📅 时间范围: ${messages[0].time.slice(0, 10)} ~ ${messages[messages.length - 1].time.slice(0, 10)}`);
  lines.push(`📌 提取事件: ${events} 条`);
  lines.push(`🏷 提取习惯: ${habits} 条`);
  lines.push("");
  lines.push("最近消息预览:");
  for (const msg of messages.slice(-5)) {
    lines.push(`  [${msg.time.slice(11, 16)}] ${msg.sender}: ${msg.content.slice(0, 50)}`);
  }
  return lines.join("\n");
}

// ─── File Import ─────────────────────────────────────────

/**
 * 从文件导入微信聊天记录
 */
export function importWeChatFile(
  filePath: string,
  ownerName: string = ""
): ImportResult {
  if (!fs.existsSync(filePath)) {
    return {
      totalMessages: 0,
      timeRange: "",
      senders: [],
      extractedEvents: 0,
      extractedPeople: 0,
      extractedHabits: 0,
      preview: `文件不存在: ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  // Handle different file types
  if (ext === ".txt" || ext === ".text") {
    return importWeChatChat(content, ownerName, `file:${path.basename(filePath)}`);
  }

  // CSV format
  if (ext === ".csv") {
    const lines = content.split("\n").map(l => l.trim()).filter(Boolean);
    // Skip header if present
    const start = lines[0].includes("时间") || lines[0].includes("time") ? 1 : 0;
    const txtContent = lines.slice(start).join("\n");
    return importWeChatChat(txtContent, ownerName, `file:${path.basename(filePath)}`);
  }

  return {
    totalMessages: 0,
    timeRange: "",
    senders: [],
    extractedEvents: 0,
    extractedPeople: 0,
    extractedHabits: 0,
    preview: `不支持的文件格式: ${ext}，请使用 .txt 或 .csv`,
  };
}
