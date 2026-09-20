@echo off
echo ========================================
echo    EchoRelay - Emergency BLE Mesh PWA
echo ========================================
echo.

REM Kill existing node processes
echo Cleaning up existing Node.js processes...
taskkill /F /IM node.exe >nul 2>&1

cd /d "D:\Desktop\Echo\echorealy"

echo.
echo Building production bundle...
npm run build
if errorlevel 1 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Build successful!
echo.

echo Starting production server on port 3001...
echo Browser will open automatically at http://localhost:3001
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

start "" http://localhost:3001
npx next start -H 0.0.0.0 -p 3001