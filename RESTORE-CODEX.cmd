@echo off
powershell.exe -NoProfile -File "%~dp0launch.ps1" -App codex -Action Restore
pause
