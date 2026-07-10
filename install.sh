#!/bin/bash
# Personal Memory MCP Server — 一键安装脚本
# 用法: curl -fsSL https://raw.githubusercontent.com/Emama-bit/personal-memory-mcp/master/install.sh | bash

set -e

REPO="https://github.com/Emama-bit/personal-memory-mcp.git"
INSTALL_DIR="$HOME/.personal-memory"

echo "🧠 Personal Memory MCP Server 安装中..."
echo ""

# 1. Clone
if [ -d "$INSTALL_DIR" ]; then
  echo "📁 已有安装，更新中..."
  cd "$INSTALL_DIR" && git pull
else
  echo "📥 下载项目..."
  git clone "$REPO" "$INSTALL_DIR"
fi

# 2. Install dependencies
echo "📦 安装依赖..."
cd "$INSTALL_DIR/agent" && npm install --production 2>/dev/null

# 3. Get absolute path to server.ts
SERVER_PATH="$INSTALL_DIR/agent/src/server.ts"
# Convert to forward-slash path for Windows
SERVER_PATH=$(echo "$SERVER_PATH" | sed 's|\\|/|g')

# 4. Detect and configure
echo "🔧 配置 MCP Server..."
CONFIGURED=false

# Claude Desktop (macOS)
CLAUDE_MAC="$HOME/Library/Application Support/Claude/claude_desktop_config.json"
if [ -f "$CLAUDE_MAC" ] || [ -d "$(dirname "$CLAUDE_MAC")" ]; then
  update_config "$CLAUDE_MAC" "$SERVER_PATH"
  echo "  ✅ Claude Desktop (macOS)"
  CONFIGURED=true
fi

# Claude Desktop (Windows)
CLAUDE_WIN="$APPDATA/Claude/claude_desktop_config.json"
if [ -f "$CLAUDE_WIN" ] || [ -d "$(dirname "$CLAUDE_WIN")" 2>/dev/null ]; then
  update_config "$CLAUDE_WIN" "$SERVER_PATH"
  echo "  ✅ Claude Desktop (Windows)"
  CONFIGURED=true
fi

# Cursor
CURSOR_CONFIG="$HOME/.cursor/mcp.json"
if [ -d "$HOME/.cursor" ] || [ -f "$CURSOR_CONFIG" ]; then
  update_config "$CURSOR_CONFIG" "$SERVER_PATH"
  echo "  ✅ Cursor"
  CONFIGURED=true
fi

if [ "$CONFIGURED" = false ]; then
  echo "  ⚠️  未检测到 Claude Desktop 或 Cursor"
  echo "  请手动配置，将以下内容添加到 MCP 配置文件："
  echo ""
  echo '  {'
  echo '    "mcpServers": {'
  echo '      "personal-memory": {'
  echo "        \"command\": \"npx\","
  echo "        \"args\": [\"tsx\", \"$SERVER_PATH\"]"
  echo '      }'
  echo '    }'
  echo '  }'
fi

echo ""
echo "✅ 安装完成！重启 Claude Desktop / Cursor 即可使用。"
echo "📁 数据存储在: $INSTALL_DIR/agent/memory/"

# Helper function: update JSON config
update_config() {
  local config_file="$1"
  local server_path="$2"
  local config_dir=$(dirname "$config_file")

  mkdir -p "$config_dir"

  if [ -f "$config_file" ]; then
    # Check if personal-memory already configured
    if grep -q "personal-memory" "$config_file" 2>/dev/null; then
      return
    fi
    # Append to existing config (simplified — just warn user)
    echo "  ⚠️  $config_file 已存在，请手动添加 personal-memory 配置"
  else
    cat > "$config_file" << EOF
{
  "mcpServers": {
    "personal-memory": {
      "command": "npx",
      "args": ["tsx", "$server_path"]
    }
  }
}
EOF
  fi
}
