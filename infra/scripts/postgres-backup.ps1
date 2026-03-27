param(
  [string]$EnvFile,
  [string]$OutputDir = "infra/backups"
)

. (Join-Path $PSScriptRoot "common.ps1")

$projectRoot = Get-KarpikProjectRoot
$envFilePath = Resolve-KarpikEnvFile -ProjectRoot $projectRoot -EnvFile $EnvFile
$envMap = Read-KarpikEnvFile -EnvFilePath $envFilePath
$postgresUser = Get-KarpikEnvValue -EnvMap $envMap -Key "POSTGRES_USER" -DefaultValue "karpik"
$postgresDb = Get-KarpikEnvValue -EnvMap $envMap -Key "POSTGRES_DB" -DefaultValue "karpik"
$postgresPassword = Get-KarpikEnvValue -EnvMap $envMap -Key "POSTGRES_PASSWORD" -DefaultValue "karpik"
$backupDirectory = Resolve-KarpikPath -ProjectRoot $projectRoot -Path $OutputDir
$containerId = Get-KarpikPostgresContainerId -ProjectRoot $projectRoot -EnvFilePath $envFilePath
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFilePath = Join-Path $backupDirectory "karpik-$timestamp.dump"
$remoteBackupPath = "/tmp/karpik-$timestamp.dump"

New-Item -ItemType Directory -Force -Path $backupDirectory | Out-Null

$dumpCommand = @(
  "PGPASSWORD=$(ConvertTo-KarpikShellLiteral -Value $postgresPassword)",
  "pg_dump",
  "-Fc",
  "-f", (ConvertTo-KarpikShellLiteral -Value $remoteBackupPath),
  "-h", "127.0.0.1",
  "-U", (ConvertTo-KarpikShellLiteral -Value $postgresUser),
  "-d", (ConvertTo-KarpikShellLiteral -Value $postgresDb)
) -join " "

try {
  & docker exec $containerId sh -lc $dumpCommand
  if ($LASTEXITCODE -ne 0) {
    throw "pg_dump failed with exit code $LASTEXITCODE"
  }

  & docker cp "${containerId}:$remoteBackupPath" $backupFilePath
  if ($LASTEXITCODE -ne 0) {
    throw "docker cp failed with exit code $LASTEXITCODE"
  }
} finally {
  & docker exec $containerId rm -f $remoteBackupPath | Out-Null
}

Write-Host "Backup created: $backupFilePath"
Write-Output $backupFilePath
