# Azure Container Apps Deployment

This document describes the Azure Container Apps deployment option for `contract-agentops-demo`.

## When to use ACA

ACA is the better fit when you want:

- A containerized runtime instead of App Service code deployment
- Cleaner scaling boundaries for the agent host
- A future path to split gateway and background workers into separate deployable services
- A consistent image-based deployment artifact in Azure Container Registry

Keep App Service when you want the simplest `azd`-based experience.

## What gets provisioned

The ACA infrastructure template at `infra/container-apps.bicep` provisions:

- One resource group for the ACA lane
- One Azure OpenAI account
- One Azure Container Registry
- One Log Analytics workspace
- One Azure Container Apps managed environment
- One user-assigned managed identity with `AcrPull` and `Cognitive Services OpenAI User`

The workflow then creates or updates the container app itself with the current image.

## Workflow

Use the root workflow `.github/workflows/contract-agentops-deploy-aca.yml`.

The workflow:

1. Runs lint, typecheck, tests, and build.
2. Provisions ACA base resources from Bicep.
3. Creates the Foundry model deployment when missing.
4. Builds the app image into ACR with `az acr build`.
5. Creates or updates the ACA app.
6. Runs `scripts/deploy/verify-deployment.ps1` against the ACA ingress URL.

## Required secrets

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

No separate registry secrets are required because the workflow uses Azure CLI and a user-assigned managed identity for image pulls and Foundry runtime access.

## Runtime configuration

The workflow configures these runtime values in the container app:

- `DEMO_MODE`
- `FOUNDRY_AUTH_MODE=managed-identity`
- `FOUNDRY_ENDPOINT`
- `FOUNDRY_PROJECT_ENDPOINT`
- `FOUNDRY_MANAGED_IDENTITY_CLIENT_ID`
- `FOUNDRY_MODEL`
- `DEPLOY_ADMIN_KEY` as a secret reference
- `GATEWAY_PORT=8000`
- `MCP_BASE_PORT=9001`
- `LOG_LEVEL=INFO`
- `NODE_ENV=production`

The ACA workflow is manual-only so App Service remains the default deployment lane unless you explicitly choose ACA.

## Container details

- Image source: Azure Container Registry
- Exposed port: `8000`
- Health endpoint: `/api/v1/health`
- Entry command: `npm start`

## Rollback

Use one of these rollback approaches:

1. Redeploy a prior image tag through the ACA workflow.
2. Update the container app image manually to a known-good ACR tag.
3. If the issue is infrastructure-related, re-run the workflow after correcting the Bicep template.

## Operational notes

- This implementation keeps the current single-container runtime model intact.
- It does not yet split the gateway and MCP servers into separate ACA services.
- If the agent topology becomes more asynchronous or queue-driven, the next step should be dedicated worker container apps or ACA jobs.