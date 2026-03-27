param(
  [string]$EnvFile
)

. (Join-Path $PSScriptRoot "common.ps1")

$projectRoot = Get-KarpikProjectRoot
$envFilePath = Resolve-KarpikEnvFile -ProjectRoot $projectRoot -EnvFile $EnvFile
$envMap = Read-KarpikEnvFile -EnvFilePath $envFilePath
$httpPort = Get-KarpikEnvValue -EnvMap $envMap -Key "KARPIK_HTTP_PORT" -DefaultValue "8080"

Write-Host "Using env file: $envFilePath"
Invoke-KarpikCompose -ProjectRoot $projectRoot -EnvFilePath $envFilePath -Arguments @("up", "-d", "--build")
Invoke-KarpikCompose -ProjectRoot $projectRoot -EnvFilePath $envFilePath -Arguments @("ps")

$baseUri = "http://127.0.0.1:$httpPort"
Assert-KarpikHealthEndpoint -Uri "$baseUri/health"
Assert-KarpikHealthEndpoint -Uri "$baseUri/api/health"

Write-Host "Smoke check passed for $baseUri"
