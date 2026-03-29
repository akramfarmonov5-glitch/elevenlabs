@echo off
cd /d "%~dp0"
echo Launching ElevenLabs TTS server in a new window...
start "ElevenLabs TTS Server" cmd /k "cd /d %~dp0 && node server.js"
