# AI Skill 试单市场 + 个人智能体

一个 AI 增强型自由职业服务市场 MVP，附带可独立运行的个人智能体 Agent。

## 项目简介

本项目包含两个核心模块：

### 1. 市场平台（Next.js Web 应用）

让需求方先通过 Skill AI 低成本"试镜"自由职业者的方法、风格和判断能力，再决定是否提交真人服务意向；响应侧可以发布自己的 Skill AI，用经验、流程、案例和服务边界承接轻量咨询，并把高价值需求转化为线索。

**已实现功能：**
- Skill 市场（搜索、筛选、排序）
- 需求雷达（模糊需求匹配）
- AI 试镜聊天（RAG 知识库）
- 线索 CRM（新线索 → 已联系 → 方案沟通 → 成交/关闭）
- 报价单与托管订单模拟
- 评价系统
- 需求侧/响应侧个人中心

### 2. 个人智能体 Agent（独立 Node.js 服务）

一个能"记住你"的个人 AI 助手，通过日常对话和数据导入不断学习你的习惯、偏好和经历。

**已实现功能：**
- 🧠 **个人画像** — 记录习惯、偏好、工作方式
- 📝 **事件记忆** — 自动提取对话中的事件、人物、决策
- 👥 **人脉管理** — 自动识别人物关系和互动历史
- 📱 **微信导入** — 解析导出的聊天记录，自动提取信息
- 💬 **CLI / HTTP API** — 两种接入方式
- 🔄 **跨对话记忆** — 新对话自动加载历史画像

## 快速开始

### 市场平台

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

打开 http://localhost:3000 查看市场页面。

### 个人智能体 Agent

```bash
# 进入 agent 目录
cd agent

# 安装依赖
npm install

# 复制配置模板
cp .env.example .env

# 编辑 .env，填入你的 API 配置
# API_KEY=your-api-key
# BASE_URL=https://your-proxy-url/v1
# MODEL=your-model-name

# 启动 CLI 模式（交互式聊天）
npx tsx src/index.ts

# 或启动 HTTP API 模式
npx tsx src/index.ts --http --port 3001
```

## 使用示例

### 个人智能体 CLI 模式

```
You: 我叫小明，习惯每天早上7点起床，喜欢用 VS Code

Agent: 小明，你好！我已经记住了你的习惯：
- 早上 7:00 起床
- 编程工具：VS Code

You: 今天跟老王讨论了新项目技术选型，决定用 Rust

Agent: （自动记录事件 + 决策 + 人物）
好的，我帮你记下了。老王是谁？同事还是朋友？

You: 帮我导入微信聊天记录：D:\wechat-export.txt，我的昵称是小明

Agent: 导入成功！提取了 5 个事件、3 条习惯、2 个人物...
```

### HTTP API 模式

```bash
# 启动服务
npx tsx src/index.ts --http --port 3001

# 发送请求
curl -X POST http://localhost:3001/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "有哪些可用的 Skill？"}'
```

## 项目结构

```
codex-Ai-substitute/
├── src/                    # 市场平台源码（Next.js）
│   ├── app/               # 页面路由
│   ├── components/        # React 组件
│   └── lib/               # 工具函数（store、rag、ai）
├── data/                   # 市场数据（JSON）
├── agent/                  # 个人智能体 Agent
│   ├── src/
│   │   ├── agent.ts       # Agent 核心循环
│   │   ├── tools.ts       # 工具定义（24个）
│   │   ├── profile.ts     # 个人画像系统
│   │   ├── events.ts      # 事件记忆系统
│   │   ├── wechat.ts      # 微信聊天记录解析
│   │   ├── system.ts      # 系统提示词
│   │   ├── memory.ts      # 对话持久化
│   │   ├── cli.ts         # CLI 入口
│   │   ├── http.ts        # HTTP API 入口
│   │   └── lib/           # 共享工具（store、rag）
│   ├── data/              # 市场数据（Agent 读取）
│   └── memory/            # 个人记忆存储（gitignore）
├── package.json
└── README.md
```

## Agent 工具列表

### 市场业务工具（18个）
| 工具 | 说明 |
|------|------|
| `list_skills` | 列出所有 Skill |
| `get_skill` | 获取 Skill 详情 |
| `create_skill` | 创建新 Skill |
| `delete_skill` | 删除 Skill |
| `chat_with_skill` | 与 Skill AI 对话 |
| `rate_skill` | 评价 Skill |
| `list_leads` | 列出线索 |
| `get_lead` | 获取线索详情 |
| `create_lead` | 创建线索 |
| `update_lead` | 更新线索状态 |
| `list_quotes` | 列出报价单 |
| `create_quote` | 创建报价单 |
| `accept_quote` | 接受报价 |
| `list_orders` | 列出订单 |
| `create_order` | 创建订单 |
| `update_order` | 更新订单状态 |
| `list_reviews` | 列出评价 |
| `create_review` | 创建评价 |

### 个人智能体工具（8个）
| 工具 | 说明 |
|------|------|
| `feed_habit` | 喂养个人习惯 |
| `feed_preference` | 喂养偏好设置 |
| `feed_document` | 喂养文档（简历/日记） |
| `get_profile` | 查看个人画像 |
| `add_event` | 记录事件 |
| `add_decision` | 记录决策 |
| `search_events` | 搜索事件记忆 |
| `import_wechat` | 导入微信聊天记录 |

## 技术栈

### 市场平台
- **前端/后端**: Next.js 16 (App Router)
- **UI**: React + Tailwind CSS
- **数据存储**: 本地 JSON 文件
- **AI 调用**: 预留适配层，支持 mock/真实模型切换

### 个人智能体
- **运行时**: Node.js + TypeScript
- **AI SDK**: OpenAI 兼容格式
- **执行**: tsx（直接运行 TS）
- **存储**: 本地 JSON 文件

## 环境变量

创建 `agent/.env` 文件：

```env
# API 配置（支持 OpenAI 兼容格式）
API_KEY=your-api-key-here
BASE_URL=https://your-proxy-url/v1
MODEL=your-model-name

# 数据目录
DATA_DIR=../data
MEMORY_DIR=./memory
```

## 微信聊天记录导入

1. 在 PC 微信打开聊天窗口
2. 选中聊天记录 → 复制
3. 粘贴给 Agent，或保存为 `.txt` 文件后告诉 Agent 路径

支持格式：
- 微信 PC 版导出格式
- 时间戳格式 `[2024-01-15 14:30:20] 昵称: 消息`
- 简单格式 `2024-01-15 14:30 昵称: 消息`

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请联系：2012943494@qq.com 或 lk2012943494@outlook.com

## 许可证

MIT License
