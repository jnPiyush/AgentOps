@description('Name of the App Service')
param name string

@description('Location for the resource')
param location string

@description('Resource tags')
param tags object = {}

@description('App Service Plan resource ID')
param appServicePlanId string

@description('Azure OpenAI endpoint URL')
@secure()
param foundryEndpoint string

@description('Azure OpenAI API key')
@secure()
param foundryApiKey string

@description('Model deployment name')
param foundryModel string = 'gpt-5.4'

@description('Demo mode: live or simulated')
param demoMode string = 'live'

@description('Deployment pipeline admin key used by the postdeploy hook in live mode')
@secure()
param deployAdminKey string

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: name
  location: location
  tags: union(tags, { 'azd-service-name': 'app' })
  properties: {
    serverFarmId: appServicePlanId
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      appCommandLine: 'npx tsx start.ts'
      alwaysOn: true
      healthCheckPath: '/api/v1/health'
      appSettings: [
        { name: 'DEMO_MODE', value: demoMode }
        { name: 'DEPLOY_ADMIN_KEY', value: deployAdminKey }
        { name: 'FOUNDRY_ENDPOINT', value: foundryEndpoint }
        { name: 'FOUNDRY_API_KEY', value: foundryApiKey }
        { name: 'FOUNDRY_PROJECT_ENDPOINT', value: foundryEndpoint }
        { name: 'FOUNDRY_MODEL', value: foundryModel }
        { name: 'GATEWAY_PORT', value: '8080' }
        { name: 'NODE_ENV', value: 'production' }
        { name: 'WEBSITE_NODE_DEFAULT_VERSION', value: '~20' }
        { name: 'SCM_DO_BUILD_DURING_DEPLOYMENT', value: 'true' }
      ]
    }
  }
}

output url string = 'https://${appService.properties.defaultHostName}'
output name string = appService.name
