# Contract AgentOps Demo Setup and Deployment Guide

This guide covers local setup, live-mode configuration with Azure AI Foundry, and Azure deployment using Azure Developer CLI (`azd`).

## Overview

The solution runs as a single Node.js application hosted by the gateway. The gateway serves the static UI and starts the MCP servers as child processes.

Execution modes:

- `simulated`: Uses local sample data and does not require Azure AI Foundry credentials.
- `live`: Uses Azure AI Foundry credentials and real model calls.

Azure hosting model:

- Azure App Service for the application runtime
- Bicep infrastructure under `infra/`
- `azd` orchestration via `azure.yaml`

## What Gets Deployed

The Azure deployment provisions:

- One resource group
- One Linux Azure App Service Plan
- One Linux Azure App Service running `npx tsx start.ts`

The App Service is configured with:

- `DEMO_MODE`
- `FOUNDRY_ENDPOINT`
- `FOUNDRY_API_KEY`
- `FOUNDRY_PROJECT_ENDPOINT`
- `FOUNDRY_MODEL`
- `GATEWAY_PORT=8080`
- `NODE_ENV=production`

After deployment, `azd` runs a post-deploy hook that calls `POST /api/v1/deploy/pipeline` on the deployed app.

## Prerequisites

Install these locally before setup or deployment:

- Node.js 20 or later
- npm
- Git
- Azure CLI
- Azure Developer CLI (`azd`)

Optional but useful:

- `curl` for API verification
- Azure Portal access for inspecting deployed resources

For live mode, you also need:

- An Azure subscription
- An Azure AI Foundry or Azure OpenAI resource
- A deployed model matching `FOUNDRY_MODEL` such as `gpt-4o`
- The Foundry endpoint
- The Foundry project endpoint
- An API key

## Local Setup

Run all commands from the app root:

```powershell
cd "c:\Piyush - Personal\GenAI\Contract Management\contract-agentops-demo"
```

Install dependencies:

```powershell
npm install
```

Create your local environment file:

```powershell
Copy-Item .env.example .env
```

### Local Simulated Mode

This is the fastest path and does not require Azure credentials.

Set these values in `.env`:

```env
DEMO_MODE=simulated
GATEWAY_PORT=8000
MCP_BASE_PORT=9001
LOG_LEVEL=INFO
```

Start the stack:

```powershell
npm start
```

Verify:

```powershell
curl http://localhost:8000/api/v1/health
curl http://localhost:8000/api/v1/tools
```

UI URL:

```text
http://localhost:8000
```

### Local Live Mode

Live mode requires Foundry settings. Update `.env`:

```env
DEMO_MODE=live
FOUNDRY_API_KEY=<your-api-key>
FOUNDRY_ENDPOINT=https://<your-resource>.openai.azure.com
FOUNDRY_PROJECT_ENDPOINT=https://<your-project-endpoint>
FOUNDRY_MODEL=gpt-4o
FOUNDRY_MODEL_SWAP=gpt-4o-mini
GATEWAY_PORT=8000
MCP_BASE_PORT=9001
LOG_LEVEL=INFO
```

Then start the stack:

```powershell
npm start
```

If `FOUNDRY_API_KEY`, `FOUNDRY_ENDPOINT`, or `FOUNDRY_PROJECT_ENDPOINT` is missing, the gateway will fail fast at startup.

## Local Validation

Recommended checks before deployment:

```powershell
npm test
npm run typecheck
npm run build
npm run lint
```

Additional smoke tests:

```powershell
npx tsx tests/test-comprehensive.ts
npx tsx tests/test-deployment.ts
```

## Azure Deployment with azd

Run all commands from:

```powershell
cd "c:\Piyush - Personal\GenAI\Contract Management\contract-agentops-demo"
```

### 1. Sign in

```powershell
az login
azd auth login
```

If you use multiple subscriptions, select the right one first:

```powershell
az account set --subscription "<subscription-name-or-id>"
```

### 2. Create or Select an azd Environment

```powershell
azd env new contract-agentops-dev
```

Set deployment values:

```powershell
azd env set AZURE_LOCATION eastus2
azd env set FOUNDRY_ENDPOINT https://<your-resource>.openai.azure.com
azd env set FOUNDRY_API_KEY <your-api-key>
azd env set FOUNDRY_MODEL gpt-4o
azd env set DEMO_MODE simulated
```

Use `DEMO_MODE=live` when your Foundry endpoint, project endpoint, API key, and model deployment are all available.

### 3. Provision and Deploy

```powershell
azd up
```

What `azd up` does in this repo:

- Provisions Azure resources from `infra/main.bicep`
- Deploys the app to Azure App Service
- Runs the `postdeploy` hook in `azure.yaml`
- Calls `POST /api/v1/deploy/pipeline` on the deployed app

### 4. Get the Deployed URL

```powershell
azd env get-value AZURE_APP_SERVICE_URL
```

### 5. Verify the Deployment

Set the URL in your shell:

```powershell
$APP_URL = azd env get-value AZURE_APP_SERVICE_URL
```

Run these checks:

```powershell
curl "$APP_URL/api/v1/health"
curl "$APP_URL/api/v1/deploy/mode"
curl "$APP_URL/api/v1/deploy/status"
```

If you want to manually rerun the deployment registration pipeline:

```powershell
curl -Method Post "$APP_URL/api/v1/deploy/pipeline"
```

Open the UI:

```text
<AZURE_APP_SERVICE_URL>
```

## Live-Mode Azure Deployment

The Azure infrastructure now wires all required Foundry settings through `azd` into App Service, including `FOUNDRY_PROJECT_ENDPOINT`.

For live mode, set these `azd` environment values before deployment:

```powershell
azd env set FOUNDRY_ENDPOINT https://<your-resource>.openai.azure.com
azd env set FOUNDRY_PROJECT_ENDPOINT https://<your-project-endpoint>
azd env set FOUNDRY_API_KEY <your-api-key>
azd env set FOUNDRY_MODEL gpt-4o
azd env set DEMO_MODE live
```

Then deploy:

```powershell
azd up
```

Then verify:

```powershell
$APP_URL = azd env get-value AZURE_APP_SERVICE_URL
curl "$APP_URL/api/v1/deploy/mode"
curl "$APP_URL/api/v1/deploy/status"
```

## Operational Notes

Current behavior in this repo:

- The App Service startup command is `npx tsx start.ts`
- `start.ts` launches the MCP servers and gateway in one app process tree
- The gateway serves the UI from `ui/`
- Health is exposed at `/api/v1/health`

Current security posture:

- Live mode uses API-key based Foundry access
- That matches the current implementation
- Managed identity and Key Vault references would be a stronger production pattern, but they are not wired into this repo today

## Troubleshooting

### App fails in live mode at startup

Likely cause:

- Missing `FOUNDRY_API_KEY`
- Missing `FOUNDRY_ENDPOINT`
- Missing `FOUNDRY_PROJECT_ENDPOINT`

Check the deployment mode endpoint and App Service settings.

### postdeploy hook does not register agents

Check:

- The app is reachable at `AZURE_APP_SERVICE_URL`
- The app finished starting before the hook ran
- `POST /api/v1/deploy/pipeline` succeeds manually

### Need to inspect App Service logs

```powershell
$RG = azd env get-value AZURE_RESOURCE_GROUP
$APP_NAME = az webapp list --resource-group $RG --query "[0].name" -o tsv
az webapp log tail --resource-group $RG --name $APP_NAME
```

### Health endpoint shows MCP servers offline

The gateway checks MCP servers on localhost ports `9001` through `9008`. If those are offline, the startup command may have failed before the child processes were fully launched.

## GitHub Actions Deployment

GitHub Actions workflows now live at the repository root:

- `.github/workflows/contract-agentops-ci.yml`
- `.github/workflows/contract-agentops-deploy.yml`

See `docs/deployment/AZURE-GITHUB-ACTIONS.md` for required secrets and the deployment flow.

## Recommended Deployment Flow

For the current repo state, use this sequence:

1. Validate locally in `simulated` mode.
2. Deploy to Azure with `DEMO_MODE=simulated` using `azd up` or the root deployment workflow.
3. Verify health, UI, and deployment status on Azure.
4. Switch the environment to `DEMO_MODE=live` once Foundry settings are available.
5. Re-run `POST /api/v1/deploy/pipeline` or the deployment workflow and validate live behavior.

## Quick Reference

Local start:

```powershell
npm install
Copy-Item .env.example .env
npm start
```

Local quality gates:

```powershell
npm test
npm run typecheck
npm run build
npm run lint
```

Azure deploy:

```powershell
az login
azd auth login
azd env new contract-agentops-dev
azd env set AZURE_LOCATION eastus2
azd env set FOUNDRY_ENDPOINT https://<your-resource>.openai.azure.com
azd env set FOUNDRY_API_KEY <your-api-key>
azd env set FOUNDRY_MODEL gpt-4o
azd env set DEMO_MODE simulated
azd up
```