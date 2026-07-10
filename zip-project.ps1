# =============================================================================
# zip-project.ps1 - Crea uno ZIP del progetto per trasferirlo su un altro PC
# =============================================================================
# Esclude le cartelle/artefatti che si (ri)generano avviando run-local.ps1 o la
# build: backend\.venv, frontend\node_modules, cache Python, dist/.vite, DB SQLite.
#
# Uso:
#   .\zip-project.ps1                     # crea ..\dashboard-raspi-<data>.zip
#   .\zip-project.ps1 -OutputPath C:\tmp\proj.zip
#   .\zip-project.ps1 -ExcludeSecrets     # esclude anche .env, chiavi SSH, devices.yaml, .ovpn
#   .\zip-project.ps1 -ExcludeGit         # esclude anche la cartella .git
#
# Nota: sull'altro PC, dopo aver estratto, riesegui .\run-local.ps1 (o
# docker compose up --build) per rigenerare venv/node_modules.
# =============================================================================
[CmdletBinding()]
param(
    [string]$OutputPath,
    [switch]$ExcludeSecrets,
    [switch]$ExcludeGit
)

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$projectName = Split-Path $root -Leaf

# Percorso di default: FUORI dalla cartella progetto (cosi' non si auto-include).
if (-not $OutputPath) {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $OutputPath = Join-Path (Split-Path $root -Parent) "$projectName-$stamp.zip"
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

# --- Regole di esclusione ----------------------------------------------------
# Cartelle generate da run-local / build / cache (escluse ovunque nel percorso).
$excludeDirs = @(
    '.venv', 'venv',           # virtualenv Python (backend)
    'node_modules',            # dipendenze npm (frontend)
    '__pycache__',             # bytecode Python
    '.pytest_cache', '.mypy_cache',
    'dist', '.vite',           # build/cache frontend
    'backend_data'             # eventuale volume locale
)
# File generati/temporanei da escludere (per nome).
$excludeFilePatterns = @('*.db', '*.db-journal', '*.sqlite', '*.sqlite3', '*.pyc', '*.log')

if ($ExcludeGit) { $excludeDirs += '.git' }

# Esclusioni opzionali di segreti/config sensibili.
$excludeSecretDirs = @()
$excludeSecretPatterns = @()
if ($ExcludeSecrets) {
    $excludeSecretDirs += 'ovpn-profiles'
    $excludeSecretPatterns += @('.env', '*.env', '*.ovpn', '*.pem', '*.key', 'id_*', 'devices.yaml')
}

function Test-Excluded {
    param([string]$RelativePath, [string]$FileName)

    $segments = $RelativePath -split '[\\/]'
    foreach ($seg in $segments) {
        if ($excludeDirs -contains $seg) { return $true }
        if ($excludeSecretDirs -contains $seg) { return $true }
    }
    foreach ($pat in $excludeFilePatterns) { if ($FileName -like $pat) { return $true } }
    foreach ($pat in $excludeSecretPatterns) {
        # ".env" non deve escludere ".env.example".
        if ($FileName -eq '.env') { if ($pat -eq '.env') { return $true } continue }
        if ($FileName -like $pat -and $FileName -ne '.env.example') { return $true }
    }
    return $false
}

Write-Host "==> Creazione archivio di '$projectName'" -ForegroundColor Cyan
Write-Host "    Output: $OutputPath"

Add-Type -AssemblyName System.IO.Compression | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem | Out-Null
if (Test-Path $OutputPath) { Remove-Item $OutputPath -Force }

$added = 0
$skipped = 0
$zip = [System.IO.Compression.ZipFile]::Open($OutputPath, [System.IO.Compression.ZipArchiveMode]::Create)
try {
    Get-ChildItem -Path $root -Recurse -File -Force | ForEach-Object {
        $full = $_.FullName
        if ($full -eq $OutputPath) { return }               # non includere lo zip stesso
        $rel = $full.Substring($root.Length + 1)

        if (Test-Excluded -RelativePath $rel -FileName $_.Name) {
            $script:skipped++
            return
        }
        $entryName = ($projectName + '/' + ($rel -replace '\\', '/'))
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
            $zip, $full, $entryName,
            [System.IO.Compression.CompressionLevel]::Optimal) | Out-Null
        $script:added++
    }
}
finally {
    $zip.Dispose()
}

$sizeMB = [Math]::Round((Get-Item $OutputPath).Length / 1MB, 2)
Write-Host ""
Write-Host "==> Fatto." -ForegroundColor Green
Write-Host "    File inclusi:  $added"
Write-Host "    File esclusi:  $skipped"
Write-Host "    Dimensione:    $sizeMB MB"
Write-Host "    Archivio:      $OutputPath"
Write-Host ""
Write-Host "Escluse le cartelle rigenerabili: $($excludeDirs -join ', ')" -ForegroundColor DarkGray
if ($ExcludeSecrets) {
    Write-Host "Esclusi anche segreti/config: .env, *.ovpn, chiavi SSH, devices.yaml" -ForegroundColor DarkGray
}
else {
    Write-Host "NB: lo ZIP include .env / secrets / config/devices.yaml. Usa -ExcludeSecrets per ometterli." -ForegroundColor Yellow
}
Write-Host "Sull'altro PC: estrai e riesegui .\run-local.ps1 (o docker compose up --build)." -ForegroundColor DarkGray
