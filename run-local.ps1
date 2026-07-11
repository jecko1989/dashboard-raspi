# =============================================================================
# run-local.ps1 - Avvio in locale (senza Docker) di backend + frontend
# =============================================================================
# Uso:
#   .\run-local.ps1                 # setup (se serve) e avvio backend + frontend
#   .\run-local.ps1 -SkipInstall    # salta pip/npm install (avvio piu' rapido)
#   .\run-local.ps1 -BackendPort 8001 -FrontendPort 5174
#
# Requisiti: Python 3.12 e Node.js 20 (vedi README, sezione "Esecuzione in locale").
# Lo script apre DUE nuove finestre PowerShell: una per il backend, una per il
# frontend. Chiudile (o Ctrl+C) per fermare i servizi.
# =============================================================================
[CmdletBinding()]
param(
    [switch]$SkipInstall,
    [switch]$InstallPython,
    [switch]$InstallNode,
    [int]$BackendPort = 8000,
    [int]$FrontendPort = 5173
)

$ErrorActionPreference = 'Stop'

# In PowerShell 7 l'uscita non-zero di un comando nativo (es. 'py -3.12' quando la
# 3.12 non e' installata) verrebbe trasformata in errore TERMINANTE a causa di
# ErrorActionPreference='Stop', interrompendo il rilevamento. Lo disattiviamo:
# controlliamo noi gli exit code dove serve. (Variabile ignorata da PS 5.1.)
$PSNativeCommandUseErrorActionPreference = $false

$root     = $PSScriptRoot
$backend  = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$venvDir  = Join-Path $backend '.venv'
$venvPy   = Join-Path $venvDir 'Scripts\python.exe'

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# --- Individua un interprete Python 3.12 per creare il venv ------------------
function Resolve-Py312 {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        try {
            & py -3.12 --version 1>$null 2>$null
            if ($LASTEXITCODE -eq 0) { return @('py', '-3.12') }
        }
        catch { }
    }
    foreach ($name in @('python3.12', 'python')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            try {
                $ver = (& $name --version 2>&1) -join ' '
                if ($ver -match '3\.12') { return @($name) }
            }
            catch { }
        }
    }
    return $null
}

# --- Elenco diagnostico delle versioni di Python installate ------------------
function Get-InstalledPythonsInfo {
    if (Get-Command py -ErrorAction SilentlyContinue) {
        try {
            $list = (& py -0p 2>$null) -join "`n"
            if ($list) { return $list }
        }
        catch { }
    }
    $found = @()
    foreach ($name in @('python', 'python3', 'python3.12', 'python3.11')) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) {
            try {
                $ver = (& $name --version 2>&1) -join ' '
                $found += "  $name -> $ver ($($cmd.Source))"
            }
            catch { }
        }
    }
    if ($found.Count -gt 0) { return $found -join "`n" }
    return '  (nessun interprete Python trovato)'
}

# --- Installazione automatica di Node.js LTS tramite winget -----------------
function Install-NodeLTS {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget non disponibile. Installa Node.js 20 LTS manualmente da https://nodejs.org/en/download e riesegui lo script."
    }
    Write-Step "Installazione di Node.js LTS tramite winget"
    winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements
    # Ricarica il PATH nella sessione corrente per rendere visibile 'node'/'npm'.
    $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath    = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path    = "$machinePath;$userPath"
}

# --- Installazione automatica di Python 3.12 tramite winget ------------------
function Install-Python312 {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
        throw "winget non disponibile. Installa Python 3.12 manualmente da https://www.python.org/downloads/release/python-3120/ e riesegui lo script."
    }
    Write-Step "Installazione di Python 3.12 tramite winget"
    winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements
    # Ricarica il PATH nella sessione corrente per rendere visibile 'py'/'python'.
    $machinePath = [System.Environment]::GetEnvironmentVariable('Path', 'Machine')
    $userPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
    $env:Path = "$machinePath;$userPath"
}

# --- Verifica Node.js --------------------------------------------------------
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    if ($InstallNode) {
        Install-NodeLTS
    }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
        Write-Host @"

Node.js non trovato: e' obbligatorio per il frontend.

Come procedere:
  - Installazione automatica:   .\run-local.ps1 -InstallNode
  - Manuale con winget:         winget install -e --id OpenJS.NodeJS.LTS
  - Download manuale:           https://nodejs.org/en/download

Dopo l'installazione riesegui:  .\run-local.ps1
"@ -ForegroundColor Yellow
        exit 1
    }
}

# --- Setup backend: virtualenv + dipendenze ---------------------------------
if (-not (Test-Path $venvPy)) {
    Write-Step "Creazione virtualenv Python 3.12 in backend\.venv"
    $py = Resolve-Py312

    if (-not $py -and $InstallPython) {
        Install-Python312
        $py = Resolve-Py312
    }

    if (-not $py) {
        $installed = Get-InstalledPythonsInfo
        Write-Host @"

Python 3.12 non trovato: e' obbligatorio per il backend.
(Alcune dipendenze, es. pydantic-core, non hanno wheel per Python 3.13/3.14 e su
Windows richiederebbero Rust + Visual C++ Build Tools.)

Versioni di Python attualmente rilevate:
$installed

Come procedere:
  - Installazione automatica:   .\run-local.ps1 -InstallPython
  - Manuale con winget:         winget install -e --id Python.Python.3.12
  - Download manuale:           https://www.python.org/downloads/release/python-3120/

Dopo l'installazione riesegui:  .\run-local.ps1
"@ -ForegroundColor Yellow
        exit 1
    }

    $rest = @()
    if ($py.Count -gt 1) { $rest += $py[1..($py.Count - 1)] }
    $rest += @('-m', 'venv', $venvDir)
    & $py[0] @rest

    if (-not (Test-Path $venvPy)) {
        throw "Creazione del virtualenv fallita: '$venvPy' non trovato."
    }
}

if (-not $SkipInstall) {
    Write-Step "Installazione dipendenze backend (pip)"
    & $venvPy -m pip install --upgrade pip 1>$null
    & $venvPy -m pip install -r (Join-Path $backend 'requirements.txt')
}

# --- Setup frontend: dipendenze npm -----------------------------------------
if (-not $SkipInstall -or -not (Test-Path (Join-Path $frontend 'node_modules'))) {
    Write-Step "Installazione dipendenze frontend (npm install)"
    Push-Location $frontend
    try { npm install } finally { Pop-Location }
}

# --- Genera un JWT secret di sviluppo se non gia' impostato ------------------
$jwtSecret = if ($env:JWT_SECRET_KEY) { $env:JWT_SECRET_KEY } else { [guid]::NewGuid().ToString('N') }

# --- Avvio backend in una nuova finestra ------------------------------------
Write-Step "Avvio backend su http://localhost:$BackendPort (nuova finestra)"
$backendCmd = @"
`$env:DATABASE_URL        = 'sqlite:///./raspberry_dashboard.db'
`$env:DEVICES_CONFIG_PATH = '..\config\devices.yaml'
`$env:SSH_KEYS_DIR        = '..\secrets\ssh'
`$env:CORS_ORIGINS        = 'http://localhost:$FrontendPort'
`$env:JWT_SECRET_KEY      = '$jwtSecret'
`$env:ADMIN_USERNAME      = 'admin'
`$env:ADMIN_PASSWORD      = 'admin'
Write-Host 'Backend in avvio...' -ForegroundColor Green
& '$venvPy' -m uvicorn app.main:app --reload --port $BackendPort
"@
Start-Process powershell -WorkingDirectory $backend -ArgumentList '-NoExit', '-Command', $backendCmd

# --- Avvio frontend in una nuova finestra -----------------------------------
Write-Step "Avvio frontend su http://localhost:$FrontendPort (nuova finestra)"
$frontendCmd = @"
`$env:VITE_API_BASE_URL = 'http://localhost:$BackendPort'
Write-Host 'Frontend in avvio...' -ForegroundColor Green
npm run dev -- --port $FrontendPort
"@
Start-Process powershell -WorkingDirectory $frontend -ArgumentList '-NoExit', '-Command', $frontendCmd

Write-Host ""
Write-Host "Pronto." -ForegroundColor Green
Write-Host "  Backend : http://localhost:$BackendPort  (docs: /docs)"
Write-Host "  Frontend: http://localhost:$FrontendPort"
Write-Host "  Login (sviluppo): admin / admin" -ForegroundColor Yellow
Write-Host "Chiudi le due finestre PowerShell per fermare i servizi."
