# Personal Memory MCP Server

> 让 AI 记住你 — 一个基于 MCP 协议的个人记忆引擎

## 这是什么

Personal Memory 是一个 MCP (Model Context Protocol) Server，为 Claude、Cursor 等 AI 宿主提供**持久化个人记忆**能力。

装上之后，AI 能记住你的习惯、偏好、经历、人际关系，不再每次对话都从零开始。

## 功能

| 工具 | 说明 |
|------|------|
| `add_memory` | 记录事件/决策/洞见（自动去重） |
| `search_memories` | FTS5 全文搜索历史记忆 |
| `get_memory_summary` | 获取完整的个人画像概览 |
| `upsert_person` | 记录/更新人脉关系 |
| `feed_habit` | 记录用户习惯 |
| `feed_preference` | 记录用户偏好 |
| `import_wechat` | 导入微信聊天记录，自动提取事件 |
| `archive_old_memories` | 归档旧记忆，减少噪音 |

## 快速开始

### 1. 安装依赖

```bash
cd agent
npm install
```

### 2. 迁移旧数据（可选）

```bash
npm run migrate
```

### 3. 配置 Claude Desktop

编辑 Claude Desktop 设置 → Developer → Edit Config：

```json
{
  "mcpServers": {
    "personal-memory": {
      "command": "npx",
      "args": ["tsx", "E:/codex-Ai-substitute/agent/src/server.ts"]
    }
  }
}
```

### 4. 配置 Cursor

编辑 `.cursor/mcp.json`：

```json
{
  "mcpServers": {
    "personal-memory": {
      "command": "npx",
      "args": ["tsx", "E:/codex-Ai-substitute/agent/src/server.ts"]
    }
  }
}
```

重启后，AI 自动拥有记忆能力。

## 使用示例

```
你: 我叫小明，每天7点起床，喜欢用 VS Code
AI: [静默调用 feed_habit + feed_preference]

你: 你还记得我吗？
AI: 当然！你是小明，早上7点起床，用 VS Code 写代码...

你: 帮我搜一下之前关于 Rust 的记忆
AI: 你之前决定在新项目中使用 Rust，原因是...
```

## 技术架构

```
Claude / Cursor / 任何 MCP 宿主
        │ MCP 协议 (stdio)
        ▼
  Personal Memory Server
  ├── 记忆引擎 (SQLite + FTS5)
  ├── 人脉管理
  ├── 用户画像
  └── 微信聊天导入
```

- **存储**: SQLite WAL 模式，原子写入
- **搜索**: FTS5 全文索引，支持中英文
- **去重**: 写入前自动检测相似记忆
- **分层**: 7天/30天/归档三层，提示词不膨胀
- **隐私**: 所有数据仅在本地，不上传

## 项目结构

```
agent/
├── src/
│   ├── server.ts           ← MCP Server 入口
│   ├── memory/
│   │   ├── db.ts           ← SQLite 初始化
│   │   ├── memories.ts     ← 记忆 CRUD + FTS5
│   │   ├── people.ts       ← 人脉管理
│   │   └── conversations.ts← 对话存储
│   ├── profile.ts          ← 用户画像
│   ├── system.ts           ← 系统提示词
│   └── wechat.ts           ← 微信聊天解析
├── memory/agent.db         ← 本地数据
└── package.json
```

## License

MIT
