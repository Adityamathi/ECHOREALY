#!/usr/bin/env pwsh
<#
.SYNOPSIS
    EchoRelay - Build and run server in foreground, open browser at LAN URL
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   EchoRelay - Emergency BLE Mesh PWA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Kill existing node processes
Write-Host "Cleaning up existing Node.js processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force

# Navigate to project directory
$projectDir = "D:\Desktop\Echo\echorealy"
Set-Location $projectDir

# Build
Write-Host "`nBuilding production bundle..." -ForegroundColor Green
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Build successful!" -ForegroundColor Green

# Detect laptop LAN IP via the default-route interface (the real Wi-Fi, not virtual adapters)
$lanIp = $null
try {
    $route = Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction Stop |
        Sort-Object RouteMetric | Select-Object -First 1
    $lanIp = Get-NetIPAddress -AddressFamily IPv4 -InterfaceIndex $route.InterfaceIndex -ErrorAction Stop |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        Select-Object -First 1 -ExpandProperty IPAddress
} catch {}
if (-not $lanIp) {
    try {
        $lanIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { ($_.IPAddress -like '192.168.*' -or $_.IPAddress -like '10.*') -and $_.PrefixOrigin -eq 'Dhcp' } |
            Select-Object -First 1 -ExpandProperty IPAddress
    } catch {}
}
if (-not $lanIp) { $lanIp = 'localhost' }
Write-Host "   All phone-reachable candidates:" -ForegroundColor Gray
try {
    Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
        ForEach-Object { Write-Host "     http://$($_.IPAddress):3001  ($($_.InterfaceAlias))" -ForegroundColor Gray }
} catch {}
$baseUrl = "http://${lanIp}:3001"
Write-Host "`nLaptop LAN URL (use THIS on laptop + phone): $baseUrl" -ForegroundColor Cyan

# Try to allow inbound connections through Windows Firewall (needs admin; ignored if it fails)
try {
    netsh advfirewall firewall add rule name="EchoRelay 3001" dir=in action=allow protocol=TCP localport=3001 | Out-Null
    Write-Host "Firewall rule for port 3001 ensured (or already exists)" -ForegroundColor Gray
} catch {}

# Open browser at LAN URL so share links are phone-openable
Write-Host "`nOpening browser at $baseUrl ..." -ForegroundColor Green
Start-Process $baseUrl

# Start server in foreground (this will block until Ctrl+C)
Write-Host "`nStarting server on port 3001 (foreground)..." -ForegroundColor Green
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

npx next start -H 0.0.0.0 -p 3001
