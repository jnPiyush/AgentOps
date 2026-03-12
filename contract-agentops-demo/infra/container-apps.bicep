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
  scope: foundryAccount
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