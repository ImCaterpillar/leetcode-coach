@echo off
chcp 65001 >nul
cd /d %~dp0
echo 构建 Hot 100 极简刷题台 v2
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
npm test
npm run build
echo.
echo 构建完成，产物位于 dist 文件夹。
pause
