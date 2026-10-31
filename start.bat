@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js topilmadi. https://nodejs.org dan LTS versiyani o'rnating. & pause & exit /b 1)
if not exist node_modules (
  echo Paketlar o'rnatilmoqda ^(birinchi marta 1-3 daqiqa^)...
  call npm install || (pause & exit /b 1)
)
echo Brauzerda http://localhost:4200 ochiladi...
call npm start
