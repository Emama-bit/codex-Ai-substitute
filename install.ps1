# Personal Memory MCP Server — Windows 一键安装
# 用法: irm https://raw.githubusercontent.com/Emama-bit/personal-memory-mcp/master/install.ps1 | iex

$ErrorActionPreference = "Stop"
$Repo = "https://github.com/Emama-bit/personal-memory-mcp.git"
$InstallDir = "$env:USERPROFILE\.personal-memory"

Write-Host "🧠 Personal Memory MCP Server 安装中..." -ForegroundColor Cyan
Write-Host ""

# 1. Clone
if (Test-Path "$InstallDir\.git") {
    Write-Host "📁 已有安装，更新中..."
    Set-Location $InstallDir; git pull
} else {
    Write-Host "📥 下载项目..."
    git clone $Repo $InstallDir
}

# 2. Install dependencies
Write-Host "📦 安装依赖..."
Set-Location "$InstallDir\agent"
npm install --production 2>$null

$ServerPath = "$InstallDir\agent\src\server.ts" -replace '\\', '/'

# 3. Configure Claude Desktop
$ClaudeConfig = "$env:APPDATA\Claude\claude_desktop_config.json"
$ClaudeDir = Split-Path $ClaudeConfig

if (Test-Path $ClaudeDir) {
    if (Test-Path $ClaudeConfig) {
        $config = Get-Content $ClaudeConfig -Raw | ConvertFrom-Json
        if (-not $config.mcpServers.'personal-memory') {
            $config.mcpServers | Add-Member -NotePropertyName "personal-memory" -NotePropertyValue @{
                command = "npx"
                args = @("tsx", $ServerPath)
            } -Force
            $config | ConvertTo-Json -Depth 10 | Set-Content $ClaudeConfig
            Write-Host "  ✅ Claude Desktop 已配置" -ForegroundColor Green
        } else {
            Write-Host "  ✅ Claude Desktop 已配置（跳过）" -ForegroundColor Yellow
        }
    } else {
        @{
            mcpServers = @{
                "personal-memory" = @{
                    command = "npx"
                    args = @("tsx", $ServerPath)
                }
            }
        } | ConvertTo-Json -Depth 10 | Set-Content $ClaudeConfig
        Write-Host "  ✅ Claude Desktop 已配置" -ForegroundColor Green
    }
}

# 4. Configure Cursor
$CursorConfig = "$env:USERPROFILE\.cursor\mcp.json"
$CursorDir = Split-Path $CursorConfig

if (Test-Path $CursorDir) {
    if (Test-Path $CursorConfig) {
        Write-Host "  ⚠️  $CursorConfig 已存在，请手动添加 personal-memory" -ForegroundColor Yellow
    } else {
        @{
            mcpServers = @{
                "personal-memory" = @{
                    command = "npx"
                    args = @("tsx", $ServerPath)
                }
            }
        } | ConvertTo-Json -Depth 10 | Set-Content $CursorConfig
        Write-Host "  ✅ Cursor 已配置" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ 安装完成！重启 Claude Desktop / Cursor 即可使用。" -ForegroundColor Green
Write-Host "📁 数据存储: $InstallDir\agent\memory\" -ForegroundColor Gray
