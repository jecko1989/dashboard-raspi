param(
	[string]$SshHost = "raspberry.example.ts.net",
	[string]$SshUser = "deploy",
	[string]$DeployPath = "/home/deploy/workspace/dashboard-raspi",
	[int]$SshPort = 22,
	[string]$IdentityFile = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSCommandPath
Set-Location $RepoRoot

$envExample = Join-Path $RepoRoot ".env.example"
$devicesExample = Join-Path $RepoRoot "config/devices.example.yaml"
$sshSecretsDir = Join-Path $RepoRoot "secrets/ssh"

if (-not (Test-Path $envExample)) {
	throw "File non trovato: $envExample"
}

if (-not (Test-Path $devicesExample)) {
	throw "File non trovato: $devicesExample"
}

if (-not (Test-Path $sshSecretsDir)) {
	throw "Cartella non trovata: $sshSecretsDir"
}

$sshTarget = "$SshUser@$SshHost"
$sshOptions = @("-p", "$SshPort")
$scpOptions = @("-P", "$SshPort")

if ($IdentityFile) {
	$sshOptions += @("-i", $IdentityFile)
	$scpOptions += @("-i", $IdentityFile)
}

$privateKeyFiles = Get-ChildItem -Path $sshSecretsDir -File | Where-Object {
	$_.Name -ne "README.md" -and $_.Extension -ne ".pub"
}

ssh @sshOptions $sshTarget "mkdir -p '$DeployPath/config' '$DeployPath/secrets/ssh'"

scp @scpOptions $envExample "$($sshTarget):$DeployPath/.env"
scp @scpOptions $devicesExample "$($sshTarget):$DeployPath/config/devices.yaml"

if ($privateKeyFiles.Count -gt 0) {
	foreach ($privateKeyFile in $privateKeyFiles) {
		scp @scpOptions $privateKeyFile.FullName "$($sshTarget):$DeployPath/secrets/ssh/$($privateKeyFile.Name)"
	}
	ssh @sshOptions $sshTarget "chmod 600 '$DeployPath/secrets/ssh/'*"
} else {
	Write-Warning "Nessuna chiave privata trovata in secrets/ssh. La cartella remota e' stata creata, ma devi copiarci le chiavi prima di usare la dashboard."
}

ssh @sshOptions $sshTarget "test -f '$DeployPath/.env' && test -f '$DeployPath/config/devices.yaml' && test -d '$DeployPath/secrets/ssh'"
Write-Host "Bootstrap configurazione completato per ${sshTarget}:$DeployPath"