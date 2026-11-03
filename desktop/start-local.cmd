@echo off
setlocal
if exist "%~dp0package.json" (cd /d "%~dp0") else (cd /d "%~dp0..")
where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js 20.19+ is required. Install Node.js, then reopen this launcher.
  pause
  exit /b 1
)
if not exist "node_modules\electron\index.js" (
  echo Installing JI-DAW dependencies...
  call npm.cmd install
  if errorlevel 1 goto failed
)
echo Building and opening JI-DAW locally...
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:failed
echo JI-DAW could not start. Review the error above.
pause
exit /b 1
