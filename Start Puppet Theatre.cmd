@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start Puppet Theatre.ps1"
if errorlevel 1 pause
