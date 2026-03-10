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

@description('Demo mode: live or simulated')
param demoMode string = 'live'

@description('Deployment pipeline admin key used by the postdeploy hook in live mode')
@secure()
param deployAdminKey string

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

module foundryAccount './modules/foundry-account.bicep' = {
  name: 'foundry-account'
  scope: rg
  params: {
    name: 'aoai${resourceToken}'
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
    foundryEndpoint: foundryAccount.outputs.endpoint
    foundryApiKey: foundryAccount.outputs.apiKey
    foundryModel: foundryModel
    demoMode: demoMode
    deployAdminKey: deployAdminKey
  }
}

output AZURE_APP_SERVICE_URL string = appService.outputs.url
output AZURE_RESOURCE_GROUP string = rg.name
output AZURE_FOUNDRY_ACCOUNT_NAME string = foundryAccount.outputs.name
output AZURE_FOUNDRY_DEPLOYMENT_NAME string = foundryModel
