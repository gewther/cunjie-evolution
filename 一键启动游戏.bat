@echo off
setlocal
chcp 65001 >nul
pushd "%~dp0"

set "PORT=8000"
for /l %%P in (8000,1,8020) do (
    netstat -ano | findstr ":%%P " | findstr "LISTENING" >nul 2>&1
    if errorlevel 1 (
        set "PORT=%%P"
        goto :FOUND_PORT
    )
)
:FOUND_PORT

set "MODE="
where py >nul 2>&1
if errorlevel 1 goto :TRY_PYTHON
py -3 -c "import http.server" >nul 2>&1
if errorlevel 1 goto :TRY_PYTHON
set "MODE=PY3"
goto :SERVER_READY

:TRY_PYTHON
python -c "import http.server" >nul 2>&1
if errorlevel 1 goto :TRY_NODE
set "MODE=PYTHON"
goto :SERVER_READY

:TRY_NODE
where node >nul 2>&1
if errorlevel 1 goto :NO_RUNTIME
set "MODE=NODE"
goto :SERVER_READY

:NO_RUNTIME
echo [Error] Python 3 or Node.js is required to start the local game server.
echo You can also open dist\cunjie-offline.html directly if no runtime is installed.
pause
exit /b 1

:SERVER_READY
set "LAN_IP="
for /f "usebackq delims=" %%I in (`powershell -NoProfile -Command "$ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -match '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' -and $_.PrefixOrigin -ne 'WellKnown' -and $_.InterfaceAlias -notmatch 'vEthernet|WSL|Hyper-V|Loopback|Bluetooth|Teredo|Wintun|Tun|Clash|Mihomo|Meta|ZeroTier|Tailscale' }; $pick = $ips | Sort-Object @{Expression={if($_.IPAddress -like '192.168.*'){0}else{1}}},@{Expression={(Get-NetIPInterface -InterfaceIndex $_.InterfaceIndex -AddressFamily IPv4 -ErrorAction SilentlyContinue).InterfaceMetric}} | Select-Object -First 1 -ExpandProperty IPAddress; if ($pick) { $pick }"`) do set "LAN_IP=%%I"

echo ============================================================
echo   Cunjie (AJ6 Rooftop Edition) - Local Game Launcher
echo ============================================================
echo.
echo   PC Browser     : http://127.0.0.1:%PORT%/impact.html
if defined LAN_IP (
    echo   Same Wi-Fi LAN : http://%LAN_IP%:%PORT%/impact.html
    echo   Android Offline: http://%LAN_IP%:%PORT%/cunjie-offline.html
)
echo.
echo   Keep this window open while playing. Close it to stop server.
echo ============================================================
echo.

start "" cmd /c "timeout /t 1 /nobreak >nul && start "" "http://127.0.0.1:%PORT%/impact.html""

if "%MODE%"=="PY3" py -3 -m http.server %PORT% --directory dist
if "%MODE%"=="PYTHON" python -m http.server %PORT% --directory dist
if "%MODE%"=="NODE" node -e "const h=require('http'),f=require('fs'),p=require('path'),m={'.html':'text/html;charset=utf-8','.js':'application/javascript;charset=utf-8','.webp':'image/webp','.png':'image/png','.css':'text/css','.json':'application/json'};h.createServer((q,s)=>{const u=decodeURIComponent((q.url||'/').split('?')[0]);const t=p.join('dist',u==='/'?'impact.html':u.replace(/^\/+/,''));if(!t.startsWith('dist')||!f.existsSync(t)||f.statSync(t).isDirectory()){s.writeHead(404);return s.end('Not found');}s.writeHead(200,{'Content-Type':m[p.extname(t)]||'application/octet-stream'});f.createReadStream(t).pipe(s);}).listen(Number(process.argv[1]));" %PORT%
popd
