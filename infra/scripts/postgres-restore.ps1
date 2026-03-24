param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$EnvFile
)

. (Join-Path $PSScriptRoot "common.ps1")

$projectRoot = Get-KarpikProjectRoot
$envFilePath = Resolve-KarpikEnvFile -ProjectRoot $projectRoot -EnvFile $EnvFile
$envMap = Read-KarpikEnvFile -EnvFilePath $envFilePath
$postgresUser = Get-KarpikEnvValue -EnvMap $envMap -Key "POSTGRES_USER" -DefaultValue "karpik"
$postgresDb = Get-KarpikEnvValue -EnvMap $envMap -Key "POSTGRES_DB" -DefaultValue "karpik"
$postgresPassword = Get-KarpikEnvValue -EnvMap $envMap -Key "POSTGRES_PASSWORD" -DefaultValue "karpik"
$backupFilePath = Resolve-KarpikPath -ProjectRoot $projectRoot -Path $BackupFile
$containerId = Get-KarpikPostgresContainerId -ProjectRoot $projectRoot -EnvFilePath $envFilePath
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$remoteBackupPath = "/tmp/karpik-restore-$timestamp.dump"

if (-not (Test-Path -LiteralPath $backupFilePath)) {
  throw "Backup file not found: $backupFilePath"
}

$restoreCommand = @(
  "PGPASSWORD=$(ConvertTo-KarpikShellLiteral -Value $postgresPassword)",
  "pg_restore",
  "--clean",
  "--if-exists",
  "--no-owner",
  "--no-privileges",
  "--exit-on-error",
  "-h", "127.0.0.1",
  "-U", (ConvertTo-KarpikShellLiteral -Value $postgresUser),
  "-d", (ConvertTo-KarpikShellLiteral -Value $postgresDb),
  (ConvertTo-KarpikShellLiteral -Value $remoteBackupPath)
) -join " "

try {
  & docker cp $backupFilePath "${containerId}:$remoteBackupPath"
  if ($LASTEXITCODE -ne 0) {
    throw "docker cp failed with exit code $LASTEXITCODE"
  }

  & docker exec $containerId sh -lc $restoreCommand
  if ($LASTEXITCODE -ne 0) {
    throw "pg_restore failed with exit code $LASTEXITCODE"
  }
} finally {
  & docker exec $containerId rm -f $remoteBackupPath | Out-Null
}

Write-Host "Restore completed from $backupFilePath"
