@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -File "%~dp0launch.ps1" -App zcode
if errorlevel 1 (
  pause
  exit /b 1
)
exit /b 0
