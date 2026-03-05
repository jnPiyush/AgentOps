@description('Name of the App Service Plan')
param name string

@description('Location for the resource')
param location string

@description('Resource tags')
param tags object = {}

resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: name
  location: location
  tags: tags
  kind: 'linux'
  sku: {
    name: 'B1'
    tier: 'Basic'
  }
  properties: {
    reserved: true // Required for Linux
  }
}

output id string = appServicePlan.id
output name string = appServicePlan.name
