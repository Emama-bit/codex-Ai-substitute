# Personal Memory MCP Server

基于 MCP 协议的个人记忆引擎，让 AI 宿主（Claude/Cursor）拥有持久化记忆。

## 技术栈
- TypeScript + Node.js
- SQLite (better-sqlite3) + FTS5 全文搜索
- MCP SDK (@modelcontextprotocol/sdk)

## 开发命令
```bash
cd agent
npm run mcp        # 启动 MCP server
npm run cli        # CLI 模式测试
npm run migrate    # 迁移旧 JSON 数据
```

## 代码规范
- 最少代码、最短 diff（Ponytail 风格）
- 所有数据存储在 SQLite，不用 JSON 文件
- 工具函数保持纯函数，数据库操作集中在 memory/ 模块
