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

function Test-AllServersOnline {
    param($HealthPayload)

    if (-not $HealthPayload.servers) {
        return $false
    }

    foreach ($server in $HealthPayload.servers.PSObject.Properties) {
        if ($server.Value -ne "online") {
            return $false
        }
    }

    return $true
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

if (-not (Test-AllServersOnline $health)) {
    $serverSummary = ($health.servers.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ", "
    throw "Health check succeeded but one or more MCP servers are not online: $serverSummary"
}

$mode = Invoke-JsonGet "$AppUrl/api/v1/deploy/mode"

if ($TriggerPipeline) {
    $null = Invoke-JsonPost "$AppUrl/api/v1/deploy/pipeline"
}

$status = Invoke-JsonGet "$AppUrl/api/v1/deploy/status"
$tools = Invoke-JsonGet "$AppUrl/api/v1/tools"

if (-not $status.summary) {
    throw "Deployment status response did not include summary."
}

if (-not $tools -or $tools.Count -lt 8) {
    throw "Tool registry did not report the expected MCP server count."
}

if (($tools | Where-Object { $_.status -ne 'online' }).Count -gt 0) {
    $offline = ($tools | Where-Object { $_.status -ne 'online' } | ForEach-Object { "$($_.name)=$($_.status)" }) -join ", "
    throw "One or more MCP tool servers are not online after deployment: $offline"
}

if ($status.summary.errors -gt 0) {
    throw "Deployment pipeline reported $($status.summary.errors) error(s)."
}

if ($mode.mode -eq "live") {
    if (-not $status.evaluation) {
        throw "Live deployment did not return canonical evaluation results."
    }

    if ($status.evaluation.quality_gate -ne "PASS") {
        throw "Canonical evaluation quality gate failed for live deployment."
    }
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