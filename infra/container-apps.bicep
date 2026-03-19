// =============================================================================
// WARNING: ALTERNATIVE / INCOMPLETE INFRA TARGET - NOT ACTIVE
// =============================================================================
// This file is an ALTERNATIVE deployment target for Azure Container Apps.
// It is NOT referenced by main.bicep or azure.yaml (which use App Service).
//
// Status: INCOMPLETE - the Microsoft.App/containerApps resource itself is not
//   yet defined here. This file provisions supporting resources only:
//   foundry account, log analytics, container registry, managed identity,
//   role assignments, and the Container App Environment.
//
// Known fixme: The role assignment below uses the corrected 'existing' resource
//   pattern (matching main.bicep) instead of 'scope: foundryAccount' (a module).
//   'scope:' requires a resource reference, not a module deployment.
//
// To activate this file:
//   1. Add the Microsoft.App/containerApps resource
//   2. Add outputs: AZURE_CONTAINER_APP_FQDN
//   3. Add an 'aca' service entry to azure.yaml
//   4. Add azure.yaml postdeploy curl using AZURE_CONTAINER_APP_FQDN
// =============================================================================

targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Model deployment name')
param foundryModel string = 'gpt-5.4'

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location, 'aca'))
var tags = {
  'azd-env-name': environmentName
  application: 'contract-agentops-demo'
  hosting: 'container-apps'
}
var containerAppName = 'ca-${resourceToken}'
var containerRegistryName = take('acr${replace(resourceToken, '-', '')}', 50)
var containerAppEnvironmentName = 'cae-${resourceToken}'
var managedIdentityName = '${abbrs.userAssignedIdentities}${resourceToken}'
var logAnalyticsWorkspaceName = '${abbrs.operationalInsightsWorkspaces}${resourceToken}'

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}-aca'
  location: location
  tags: tags
}

module foundryAccount './modules/foundry-account.bicep' = {
  name: 'foundry-account'
  scope: rg
  params: {
    name: 'aoai${resourceToken}'
    location: location
    tags: tags
  }
}

// Existing resource reference is required for 'scope:' on role assignments.
// Using module deployment as scope is a Bicep error (modules are not resources).
resource foundryAccountResource 'Microsoft.CognitiveServices/accounts@2024-10-01' existing = {
  scope: rg
  name: foundryAccount.outputs.name
}

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  scope: rg
  name: logAnalyticsWorkspaceName
  location: location
  tags: tags
  properties: {
    retentionInDays: 30
    sku: {
      name: 'PerGB2018'
    }
  }
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-11-01-preview' = {
  scope: rg
  name: containerRegistryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

resource pullIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  scope: rg
  name: managedIdentityName
  location: location
  tags: tags
}

resource acrPullAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: containerRegistry
  name: guid(containerRegistry.id, pullIdentity.id, 'AcrPull')
  properties: {
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d')
  }
}

resource foundryOpenAiUserAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: foundryAccountResource
  name: guid(foundryAccount.outputs.name, pullIdentity.id, 'CognitiveServicesOpenAIUser')
  properties: {
    principalId: pullIdentity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '5e0bd9bd-7b93-4f28-af87-19fc36ad61bd')
  }
}

resource containerAppEnvironment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  scope: rg
  name: containerAppEnvironmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspace.properties.customerId
        sharedKey: listKeys(logAnalyticsWorkspace.id, '2023-09-01').primarySharedKey
      }
    }
  }
}

output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_CONTAINER_APPS_ENVIRONMENT string = containerAppEnvironment.name
output AZURE_CONTAINER_APP_NAME string = containerAppName
output AZURE_CONTAINER_REGISTRY_NAME string = containerRegistry.name
output AZURE_CONTAINER_REGISTRY_LOGIN_SERVER string = containerRegistry.properties.loginServer
output AZURE_CONTAINER_REGISTRY_PULL_IDENTITY_RESOURCE_ID string = pullIdentity.id
output AZURE_CONTAINER_REGISTRY_PULL_IDENTITY_CLIENT_ID string = pullIdentity.properties.clientId
output AZURE_FOUNDRY_ACCOUNT_NAME string = foundryAccount.outputs.name
output AZURE_FOUNDRY_DEPLOYMENT_NAME string = foundryModel