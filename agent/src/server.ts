#!/usr/bin/env node
/**
 * Personal Memory MCP Server
 * 让 Claude/Cursor 等 AI 宿主拥有持久化个人记忆
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { addMemory, searchMemories, getRecentMemories, getMemoriesForPrompt, removeMemory, archiveOldMemories, getDailyBriefing, getFollowUps } from "./memory/memories";
import { upsertPerson, getPersonByName, getPersonSummary, getPeople, updatePersonRelation } from "./memory/people";
import { addHabit, removeHabit, updatePreference, updateBio, updateName, getProfileSummary, loadProfile } from "./profile";
import { importWeChatChat, importWeChatFile } from "./wechat";
import { closeDb } from "./memory/db";

const server = new McpServer({
  name: "personal-memory",
  version: "1.0.0",
});

// ─── Memory Tools ──────────────────────────────────────────

server.tool(
  "add_memory",
  "记录一条记忆。自动去重（相似记忆不重复写入）。当用户提到发生的事、做的决定、新发现时调用。",
  {
    type: z.enum(["event", "decision", "insight"]).describe("记忆类型"),
    summary: z.string().describe("一句话概括"),
    category: z.string().optional().describe("分类：会议、社交、工作、学习、生活、项目"),
    details: z.string().optional().describe("详细描述"),
    people: z.array(z.string()).optional().describe("涉及的人物姓名"),
    tags: z.array(z.string()).optional().describe("标签关键词"),
    importance: z.number().min(1).max(10).optional().describe("重要性 1-10"),
  },
  async (args) => {
    const m = addMemory(args.type, args.summary, {
      category: args.category,
      details: args.details,
      people: args.people,
      tags: args.tags,
      importance: args.importance,
    });
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, id: m.id, type: m.type, content: m.content }) }],
    };
  }
);

server.tool(
  "search_memories",
  "全文搜索历史记忆。支持按类型过滤。当用户问'之前说过什么'、'上次那个事'时调用。",
  {
    query: z.string().describe("搜索关键词"),
    type: z.enum(["event", "decision", "habit", "insight"]).optional().describe("过滤记忆类型"),
    limit: z.number().optional().describe("返回数量，默认10"),
  },
  async (args) => {
    const results = searchMemories(args.query, { type: args.type, limit: args.limit });
    return {
      content: [{ type: "text", text: JSON.stringify({ count: results.length, memories: results.map(m => ({ id: m.id, type: m.type, content: m.content, date: m.created_at.slice(0, 10) })) }) }],
    };
  }
);

server.tool(
  "get_recent_memories",
  "查看最近的记忆记录。",
  {
    days: z.number().optional().describe("查看最近几天，默认7天"),
    type: z.enum(["event", "decision", "habit", "insight"]).optional().describe("过滤类型"),
    limit: z.number().optional().describe("返回数量，默认20"),
  },
  async (args) => {
    const results = getRecentMemories({ type: args.type, days: args.days, limit: args.limit });
    return {
      content: [{ type: "text", text: JSON.stringify({ count: results.length, memories: results.map(m => ({ id: m.id, type: m.type, category: m.category, content: m.content, date: m.created_at.slice(0, 10) })) }) }],
    };
  }
);

server.tool(
  "get_memory_summary",
  "获取记忆概览：近期记忆、重要记忆、人脉关系、个人画像。适合在对话开始时调用以了解用户。",
  {},
  async () => {
    const { recent, important } = getMemoriesForPrompt();
    const people = getPeople(10);
    const profile = getProfileSummary();

    const parts: string[] = [];
    parts.push("## 个人画像\n" + profile);

    if (recent.length > 0) {
      parts.push("\n## 近期记忆（7天内）");
      for (const m of recent) {
        const ppl = JSON.parse(m.people || "[]");
        const pStr = ppl.length > 0 ? ` [${ppl.join(",")}]` : "";
        parts.push(`- ${m.created_at.slice(0, 10)} [${m.type}] ${m.content}${pStr}`);
      }
    }

    if (important.length > 0) {
      parts.push("\n## 重要记忆（7-30天）");
      for (const m of important) {
        parts.push(`- ${m.created_at.slice(0, 10)} ${m.content}`);
      }
    }

    if (people.length > 0) {
      parts.push("\n## 人脉关系");
      for (const p of people) {
        const notes: string[] = JSON.parse(p.notes || "[]");
        const recent = notes.slice(-2).join("; ");
        parts.push(`- ${p.name}（${p.relation || "未分类"}）互动${p.interaction_count}次${recent ? "，最近：" + recent : ""}`);
      }
    }

    return {
      content: [{ type: "text", text: parts.join("\n") || "（暂无记忆）" }],
    };
  }
);

server.tool(
  "remove_memory",
  "删除一条记忆记录。",
  { id: z.string().describe("记忆 ID") },
  async (args) => {
    const ok = removeMemory(args.id);
    return { content: [{ type: "text", text: ok ? "已删除" : "未找到该记忆" }] };
  }
);

// ─── People Tools ──────────────────────────────────────────

server.tool(
  "upsert_person",
  "记录或更新一个人物。当用户提到人名时自动调用。",
  {
    name: z.string().describe("人名"),
    note: z.string().describe("本次互动备注"),
    relation: z.string().optional().describe("关系：同事、朋友、家人、客户等"),
  },
  async (args) => {
    const p = upsertPerson(args.name, args.note, args.relation);
    return {
      content: [{ type: "text", text: JSON.stringify({ success: true, name: p.name, relation: p.relation, interactions: p.interaction_count }) }],
    };
  }
);

server.tool(
  "get_person_info",
  "查看某个人的信息和互动历史。",
  { name: z.string().describe("人名") },
  async (args) => {
    const p = getPersonByName(args.name);
    if (!p) return { content: [{ type: "text", text: "未找到此人" }] };
    const notes: string[] = JSON.parse(p.notes || "[]");
    return {
      content: [{ type: "text", text: JSON.stringify({ name: p.name, relation: p.relation, interactions: p.interaction_count, lastInteraction: p.last_interaction, recentNotes: notes.slice(-5) }) }],
    };
  }
);

server.tool(
  "get_people_list",
  "查看所有人脉记录。",
  {},
  async () => {
    return { content: [{ type: "text", text: getPersonSummary() }] };
  }
);

// ─── Profile Tools ─────────────────────────────────────────

server.tool(
  "feed_habit",
  "记录用户的习惯。当用户描述自己的作息、饮食、运动、工作习惯时调用。",
  {
    category: z.string().describe("习惯分类：作息、饮食、工作、运动、学习、社交"),
    content: z.string().describe("习惯内容"),
    confidence: z.number().min(1).max(10).optional().describe("置信度 1-10"),
  },
  async (args) => {
    const h = addHabit(args.category, args.content, "conversation", args.confidence || 8);
    return { content: [{ type: "text", text: JSON.stringify({ success: true, id: h.id, category: h.category, content: h.content }) }] };
  }
);

server.tool(
  "feed_preference",
  "记录用户偏好设置。",
  {
    key: z.string().describe("偏好名称"),
    value: z.string().describe("偏好值"),
  },
  async (args) => {
    updatePreference(args.key, args.value);
    return { content: [{ type: "text", text: `已记录偏好: ${args.key} = ${args.value}` }] };
  }
);

server.tool(
  "get_profile",
  "查看当前用户画像：习惯、偏好、简介。",
  {},
  async () => {
    return { content: [{ type: "text", text: getProfileSummary() }] };
  }
);

// ─── WeChat Import ─────────────────────────────────────────

server.tool(
  "import_wechat",
  "导入微信聊天记录文本，自动提取事件、人物、习惯。",
  {
    content: z.string().describe("聊天记录文本内容"),
    ownerName: z.string().optional().describe("主人的昵称"),
  },
  async (args) => {
    const result = importWeChatChat(args.content, args.ownerName || "");
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

server.tool(
  "import_wechat_file",
  "从文件导入微信聊天记录。",
  {
    filePath: z.string().describe("文件路径"),
    ownerName: z.string().optional().describe("主人的昵称"),
  },
  async (args) => {
    const result = importWeChatFile(args.filePath, args.ownerName || "");
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  }
);

// ─── Phase 2: Proactive Intelligence ──────────────────────

server.tool(
  "get_daily_briefing",
  "每日简报。在新对话开始时调用，返回：昨日记忆、待跟进事项、习惯异常提醒、近期重要事项。",
  {},
  async () => {
    const briefing = getDailyBriefing();
    const parts: string[] = [];

    if (briefing.yesterday.length > 0) {
      parts.push("## 昨日记忆");
      for (const m of briefing.yesterday) {
        parts.push(`- [${m.type}] ${m.content}`);
      }
    }

    if (briefing.pendingFollowUps.length > 0) {
      parts.push("\n## 待跟进事项");
      for (const f of briefing.pendingFollowUps) {
        parts.push(`- ${f}`);
      }
    }

    if (briefing.habitAlerts.length > 0) {
      parts.push("\n## ⚠️ 习惯提醒");
      for (const a of briefing.habitAlerts) {
        parts.push(`- ${a}`);
      }
    }

    if (briefing.recentImportant.length > 0) {
      parts.push("\n## 近期重要事项");
      for (const m of briefing.recentImportant) {
        parts.push(`- [${m.type}] ${m.content} (${m.created_at.slice(0, 10)})`);
      }
    }

    if (parts.length === 0) {
      parts.push("暂无需要关注的事项，一切正常 ✅");
    }

    return { content: [{ type: "text", text: parts.join("\n") }] };
  }
);

server.tool(
  "get_follow_ups",
  "获取需要跟进的事项：未完成的计划、没有后续的决定、失联的人脉。适合在对话中主动提醒用户。",
  {},
  async () => {
    const followUps = getFollowUps();
    if (followUps.length === 0) {
      return { content: [{ type: "text", text: "暂无需要跟进的事项 ✅" }] };
    }

    const parts = ["## 需要跟进的事项\n"];
    for (const f of followUps) {
      const m = f.memory;
      parts.push(`- **${m.content}** (${m.created_at.slice(0, 10)})`);
      parts.push(`  原因: ${f.reason}`);
    }

    return { content: [{ type: "text", text: parts.join("\n") }] };
  }
);

server.tool(
  "check_habit_patterns",
  "检测习惯异常模式：最近某类活动频率下降、作息变化等。返回提醒列表。",
  {},
  async () => {
    const briefing = getDailyBriefing();
    if (briefing.habitAlerts.length === 0) {
      return { content: [{ type: "text", text: "习惯模式正常，没有异常 ✅" }] };
    }
    return {
      content: [{ type: "text", text: "## 习惯异常提醒\n" + briefing.habitAlerts.map(a => `- ${a}`).join("\n") }],
    };
  }
);

// ─── Maintenance ───────────────────────────────────────────

server.tool(
  "archive_old_memories",
  "归档超过指定天数的低重要性记忆，减少噪音。",
  {
    days: z.number().optional().describe("归档多少天前的记忆，默认30"),
  },
  async (args) => {
    const count = archiveOldMemories(args.days);
    return { content: [{ type: "text", text: `已归档 ${count} 条旧记忆` }] };
  }
);

// ─── Start ─────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  process.on("SIGINT", () => { closeDb(); process.exit(0); });
  process.on("SIGTERM", () => { closeDb(); process.exit(0); });
}

main().catch((err) => {
  console.error("MCP Server error:", err);
  closeDb();
  process.exit(1);
});
