targetScope = 'subscription'

@minLength(1)
@maxLength(64)
@description('Name of the environment (e.g., dev, staging, prod)')
param environmentName string

@minLength(1)
@description('Primary location for all resources')
param location string

@description('Azure OpenAI endpoint URL')
@secure()
param foundryEndpoint string

@description('Azure OpenAI API key')
@secure()
param foundryApiKey string

@description('Model deployment name')
param foundryModel string = 'gpt-4o'

@description('Demo mode: live or simulated')
param demoMode string = 'simulated'

var abbrs = loadJsonContent('./abbreviations.json')
var resourceToken = toLower(uniqueString(subscription().id, environmentName, location))
var tags = {
  'azd-env-name': environmentName
  application: 'contract-agentops-demo'
}

resource rg 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: '${abbrs.resourcesResourceGroups}${environmentName}'
  location: location
  tags: tags
}

module appServicePlan './modules/app-service-plan.bicep' = {
  name: 'app-service-plan'
  scope: rg
  params: {
    name: '${abbrs.webServerFarms}${resourceToken}'
    location: location
    tags: tags
  }
}

module appService './modules/app-service.bicep' = {
  name: 'app-service'
  scope: rg
  params: {
    name: '${abbrs.webSitesAppService}${resourceToken}'
    location: location
    tags: tags
    appServicePlanId: appServicePlan.outputs.id
    foundryEndpoint: foundryEndpoint
    foundryApiKey: foundryApiKey
    foundryModel: foundryModel
    demoMode: demoMode
  }
}

output AZURE_APP_SERVICE_URL string = appService.outputs.url
output AZURE_RESOURCE_GROUP string = rg.name
