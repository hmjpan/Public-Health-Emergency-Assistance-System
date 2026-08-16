@echo off
cd /d "%~dp0server"
if not exist node_modules (
  echo Installing dependencies...
  call npm install
)
echo.
echo Starting server: http://localhost:3000
echo.
node "%~dp0server\index.js"
pause
