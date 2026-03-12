# Azure Deployment Automation

This repo now uses GitHub Actions workflows from the repository root for CI and Azure CD of the `contract-agentops-demo` app.

## Workflows

- Root CI workflow: `.github/workflows/contract-agentops-ci.yml`
- Root deployment workflow: `.github/workflows/contract-agentops-deploy.yml`
- Root ACA deployment workflow: `.github/workflows/contract-agentops-deploy-aca.yml`

These workflows are placed at the repository root because GitHub Actions does not execute workflow files stored under `contract-agentops-demo/.github/workflows/`.

## Required GitHub Secrets

Configure these repository or environment secrets before running the deployment workflow:

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`

Foundry endpoint and API key secrets are no longer required. The deployment workflow provisions the Azure OpenAI account through Bicep, assigns the App Service and ACA runtimes the `Cognitive Services OpenAI User` role, and lets both Azure runtimes use managed identity for Foundry access.

The Azure service principal behind these secrets must be able to create Azure RBAC role assignments on the deployment scope. Use `User Access Administrator` plus deployment permissions, or `Owner`, on the target subscription or resource group.

## Triggers

- Push to `main` deploys automatically to `contract-agentops-main`
- Push of tags matching `v*` deploys automatically to `contract-agentops-prod`
- `workflow_dispatch` remains available for manual overrides
- ACA deployments are manual-only so App Service stays the default automatic path

## Manual Workflow Inputs

- `demo_mode` default: `live`
- `environment_name` default: `contract-agentops-prod`
- `azure_location` default: `eastus2`
- `foundry_model` default: `gpt-5.4`
- `foundry_model_version` default: `2024-11-20`

The ACA workflow uses the same inputs, with `environment_name` defaulting to `contract-agentops-aca-prod`.

## Deployment Flow

The deployment workflow performs these steps:

1. Validate the app with lint, typecheck, tests, and build.
2. Authenticate to Azure using a service principal.
3. Resolve deployment defaults from the triggering branch, tag, or manual inputs.
4. Generate a deployment admin key for the live-mode registration hook.
5. Select or create the `azd` environment.
6. Run `azd provision` to create the resource group, App Service plan, App Service, and Azure OpenAI account.
7. Check whether the configured model deployment already exists and create it only when missing.
8. Run `azd deploy`.
9. Verify health, deployment mode, deployment status, agent registration, and evaluation output.

## ACA Deployment Flow

The ACA workflow performs these steps:

1. Validate the app with lint, typecheck, tests, and build.
2. Authenticate to Azure using the same service principal secrets as the App Service workflow.
3. Provision ACA base infrastructure from `contract-agentops-demo/infra/container-apps.bicep`.
4. Reuse or create the Azure OpenAI model deployment.
5. Build the application image in Azure Container Registry with `az acr build`.
6. Create or update the Azure Container App with the new image, managed identity, runtime configuration, and secrets.
7. Verify health and deployment registration with `contract-agentops-demo/scripts/deploy/verify-deployment.ps1`.

## Notes

- `FOUNDRY_PROJECT_ENDPOINT` now falls back to `FOUNDRY_ENDPOINT` when not explicitly set.
- The deployment verification script is at `contract-agentops-demo/scripts/deploy/verify-deployment.ps1`.
- The post-deploy `azd` hook invokes `POST /api/v1/deploy/pipeline` on the deployed app and now fails the deployment on any non-2xx response.
- In live mode, the hook automatically supplies `x-admin-key` using the generated `DEPLOY_ADMIN_KEY` environment value.
- The root CI workflow also enforces lint, typecheck, tests, and build for `contract-agentops-demo` changes.
- The ACA workflow keeps App Service as the default path and adds a containerized deployment option for scale-out or background-agent scenarios.
- Both Azure hosting lanes use managed identity for Foundry access instead of injecting `FOUNDRY_API_KEY` into the runtime.