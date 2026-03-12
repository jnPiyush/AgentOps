param(
    [Parameter(Mandatory = $true)]
    [string]$AppUrl,

    [switch]$TriggerPipeline,

    [string]$DeployAdminKey,

    [int]$StartupRetries = 12,

    [int]$StartupDelaySeconds = 10
)

$ErrorActionPreference = "Stop"

function Invoke-JsonGet {
    param([string]$Url)

    $headers = @{}
    if ($DeployAdminKey) {
        $headers["x-admin-key"] = $DeployAdminKey
    }

    return Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 60 -Headers $headers
}

function Invoke-JsonPost {
    param([string]$Url)

    $headers = @{}
    if ($DeployAdminKey) {
        $headers["x-admin-key"] = $DeployAdminKey
    }

    return Invoke-RestMethod -Method Post -Uri $Url -TimeoutSec 180 -ContentType "application/json" -Headers $headers
}

for ($attempt = 1; $attempt -le $StartupRetries; $attempt++) {
    try {
        $health = Invoke-JsonGet "$AppUrl/api/v1/health"
        if ($health.status -eq "ok") {
            break
        }
    } catch {
        if ($attempt -eq $StartupRetries) {
            throw
        }
    }

    Start-Sleep -Seconds $StartupDelaySeconds
}

$health = Invoke-JsonGet "$AppUrl/api/v1/health"
if ($health.status -ne "ok") {
    throw "Health check failed."
}

$mode = Invoke-JsonGet "$AppUrl/api/v1/deploy/mode"

if ($TriggerPipeline) {
    $null = Invoke-JsonPost "$AppUrl/api/v1/deploy/pipeline"
}

$status = Invoke-JsonGet "$AppUrl/api/v1/deploy/status"

if (-not $status.summary) {
    throw "Deployment status response did not include summary."
}

if ($status.summary.errors -gt 0) {
    throw "Deployment pipeline reported $($status.summary.errors) error(s)."
}

if (-not $status.stages -or $status.stages.Count -lt 4) {
    throw "Deployment pipeline did not report the expected stages."
}

if (-not $status.agents -or $status.agents.Count -lt 4) {
    throw "Deployment pipeline did not register the expected number of agents."
}

if ($mode.mode -eq "live" -and $status.summary.agents_deployed -lt 4) {
    throw "Live deployment did not register all agents."
}

Write-Host "Deployment verification succeeded for $AppUrl"
Write-Host "Mode: $($mode.mode)"
Write-Host "Agents deployed: $($status.summary.agents_deployed)"
Write-Host "Tools registered: $($status.summary.tools_registered)"
Write-Host "Errors: $($status.summary.errors)"