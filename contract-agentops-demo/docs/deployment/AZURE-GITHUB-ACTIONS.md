# Azure Deployment Automation

This repo now uses GitHub Actions workflows from the repository root for CI and manual Azure deployment of the `contract-agentops-demo` app.

## Workflows

- Root CI workflow: `.github/workflows/contract-agentops-ci.yml`
- Root deployment workflow: `.github/workflows/contract-agentops-deploy.yml`

These workflows are placed at the repository root because GitHub Actions does not execute workflow files stored under `contract-agentops-demo/.github/workflows/`.

## Required GitHub Secrets

Configure these repository or environment secrets before running the deployment workflow:

- `AZURE_CLIENT_ID`
- `AZURE_CLIENT_SECRET`
- `AZURE_TENANT_ID`
- `AZURE_SUBSCRIPTION_ID`
- `FOUNDRY_ENDPOINT`
- `FOUNDRY_PROJECT_ENDPOINT`
- `FOUNDRY_API_KEY`

## Optional GitHub Variables

- `AZURE_LOCATION` default: `eastus2`
- `FOUNDRY_MODEL` default: `gpt-4o`
- `DEMO_MODE` default: `simulated`
- `AZD_ENV_NAME` default: `contract-agentops-prod`

## Deployment Flow

The deployment workflow performs these steps:

1. Validate the app with lint, typecheck, tests, and build.
2. Authenticate to Azure using a service principal.
3. Select or create the `azd` environment.
4. Set environment values for Azure and Foundry.
5. Run `azd provision`.
6. Run `azd deploy`.
7. Verify health, deployment mode, deployment status, agent registration, and evaluation output.

## Notes

- `FOUNDRY_PROJECT_ENDPOINT` is now wired through Bicep into App Service settings.
- The deployment verification script is at `contract-agentops-demo/scripts/deploy/verify-deployment.ps1`.
- The post-deploy `azd` hook still invokes `POST /api/v1/deploy/pipeline` on the deployed app.
- The root CI workflow also enforces lint, typecheck, tests, and build for `contract-agentops-demo` changes.