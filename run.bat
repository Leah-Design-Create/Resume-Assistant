@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo 正在启动简历机器人（后端 + 前端）...
echo.

npm run dev:all

pause
