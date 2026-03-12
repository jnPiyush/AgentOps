@description('Name of the Azure OpenAI account')
param name string

@description('Location for the resource')
param location string

@description('Resource tags')
param tags object = {}

resource foundryAccount 'Microsoft.CognitiveServices/accounts@2024-10-01' = {
  name: name
  location: location
  kind: 'OpenAI'
  sku: {
    name: 'S0'
  }
  tags: tags
  properties: {
    customSubDomainName: name
    publicNetworkAccess: 'Enabled'
  }
}

output endpoint string = 'https://${foundryAccount.name}.openai.azure.com'
output name string = foundryAccount.name