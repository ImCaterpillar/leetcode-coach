@echo off
chcp 65001 >nul
cd /d %~dp0
echo Hot 100 极简刷题台 v2
echo.
where npm >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js / npm。请先安装 Node.js LTS。
  pause
  exit /b 1
)
if not exist node_modules (
  echo 正在安装依赖...
  npm install
)
echo 正在启动开发服务器...
npm run dev
pause
