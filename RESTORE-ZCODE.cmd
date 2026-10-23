@echo off
powershell.exe -NoProfile -File "%~dp0launch.ps1" -App zcode -Action Restore
pause
