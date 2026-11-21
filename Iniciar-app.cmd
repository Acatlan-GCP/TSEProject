@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Se requiere Node.js 22 o posterior. Consulta README.md.
  pause
  exit /b 1
)
echo Abre http://127.0.0.1:8080 en tu navegador.
node server.mjs
if errorlevel 1 pause
