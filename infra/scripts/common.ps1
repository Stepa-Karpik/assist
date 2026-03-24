Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-KarpikProjectRoot {
  return [System.IO.Path]::GetFullPath(
    (Join-Path $PSScriptRoot "..\..")
  )
}

function Resolve-KarpikPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $Path))
}

function Resolve-KarpikEnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [string]$EnvFile
  )

  if (-not [string]::IsNullOrWhiteSpace($EnvFile)) {
    $explicitPath = Resolve-KarpikPath -ProjectRoot $ProjectRoot -Path $EnvFile
    if (-not (Test-Path -LiteralPath $explicitPath)) {
      throw "Env file not found: $explicitPath"
    }

    return $explicitPath
  }

  foreach ($candidate in @(".env", ".env.example")) {
    $candidatePath = Join-Path $ProjectRoot $candidate
    if (Test-Path -LiteralPath $candidatePath) {
      return $candidatePath
    }
  }

  throw "No .env or .env.example file was found under $ProjectRoot"
}

function Read-KarpikEnvFile {
  param(
    [Parameter(Mandatory = $true)]
    [string]$EnvFilePath
  )

  $values = @{}

  foreach ($line in Get-Content -LiteralPath $EnvFilePath) {
    $trimmedLine = $line.Trim()
    if ($trimmedLine.Length -eq 0 -or $trimmedLine.StartsWith("#")) {
      continue
    }

    $separatorIndex = $trimmedLine.IndexOf("=")
    if ($separatorIndex -lt 1) {
      continue
    }

    $key = $trimmedLine.Substring(0, $separatorIndex).Trim()
    $value = $trimmedLine.Substring($separatorIndex + 1).Trim()

    if (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    $values[$key] = $value
  }

  return $values
}

function Get-KarpikEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$EnvMap,
    [Parameter(Mandatory = $true)]
    [string]$Key,
    [Parameter(Mandatory = $true)]
    [string]$DefaultValue
  )

  if ($EnvMap.ContainsKey($Key) -and -not [string]::IsNullOrWhiteSpace($EnvMap[$Key])) {
    return [string]$EnvMap[$Key]
  }

  return $DefaultValue
}

function Invoke-KarpikCompose {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$EnvFilePath,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  Push-Location $ProjectRoot
  try {
    & docker compose --env-file $EnvFilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
}

function Get-KarpikComposeOutput {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$EnvFilePath,
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  Push-Location $ProjectRoot
  try {
    $output = & docker compose --env-file $EnvFilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "docker compose $($Arguments -join ' ') failed with exit code $LASTEXITCODE"
    }

    return @($output)
  } finally {
    Pop-Location
  }
}

function Get-KarpikPostgresContainerId {
  param(
    [Parameter(Mandatory = $true)]
    [string]$ProjectRoot,
    [Parameter(Mandatory = $true)]
    [string]$EnvFilePath
  )

  $containerId = (
    Get-KarpikComposeOutput -ProjectRoot $ProjectRoot -EnvFilePath $EnvFilePath -Arguments @("ps", "-q", "postgres")
  ) -join ""
  $containerId = $containerId.Trim()

  if ([string]::IsNullOrWhiteSpace($containerId)) {
    throw "The postgres service is not running. Start the Docker stack first."
  }

  return $containerId
}

function ConvertTo-KarpikShellLiteral {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Value
  )

  return "'" + ($Value -replace "'", "'""'""'") + "'"
}

function Assert-KarpikHealthEndpoint {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Uri,
    [int]$MaxAttempts = 30,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $response = Invoke-RestMethod -Uri $Uri -Method Get
      if ($response.status -eq "ok") {
        return
      }
    } catch {
      if ($attempt -eq $MaxAttempts) {
        throw "Health check failed for $Uri after $MaxAttempts attempts. $($_.Exception.Message)"
      }
    }

    Start-Sleep -Seconds $DelaySeconds
  }

  throw "Health check failed for $Uri after $MaxAttempts attempts."
}
