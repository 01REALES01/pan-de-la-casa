// Infraestructura de "Pan de la Casa" para UN ambiente (dev o prod).
// Los recursos compartidos (Log Analytics y la cuenta de Cosmos DB) se declaran
// igual en ambos despliegues, así que aplicar dev y luego prod es idempotente.

targetScope = 'resourceGroup'

@description('Ambiente a desplegar.')
@allowed([
  'dev'
  'prod'
])
param environment string

@description('Región. La suscripción de estudiante solo permite centralus, brazilsouth, canadacentral, westus y westus3; Static Web Apps solo existe en centralus de esa lista.')
param location string = 'centralus'

@description('Correo para las alertas. Vacío = la alerta existe pero no envía correo.')
param alertEmail string = ''

@description('Throughput compartido por base de datos (RU/s). 400 dev + 400 prod = 800 <= 1000 gratis.')
@minValue(400)
param databaseThroughput int = 400

var project = 'pandelacasa'
var suffix = uniqueString(resourceGroup().id)
var tags = {
  project: project
  environment: environment
  managedBy: 'bicep'
}

// ---------- Compartido ----------

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${project}'
  location: location
  tags: union(tags, { environment: 'shared' })
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    workspaceCapping: {
      dailyQuotaGb: 1 // FinOps: tope diario de ingesta
    }
  }
}

resource cosmos 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' = {
  name: 'cosmos-${project}-${substring(suffix, 0, 6)}'
  location: location
  tags: union(tags, { environment: 'shared' })
  kind: 'GlobalDocumentDB'
  properties: {
    databaseAccountOfferType: 'Standard'
    enableFreeTier: true
    capacity: {
      totalThroughputLimit: 1000 // FinOps: nunca superar lo gratuito
    }
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    backupPolicy: {
      type: 'Periodic'
      periodicModeProperties: {
        backupIntervalInMinutes: 240
        backupRetentionIntervalInHours: 48
        backupStorageRedundancy: 'Local'
      }
    }
    minimalTlsVersion: 'Tls12'
    disableKeyBasedMetadataWriteAccess: true
  }
}

// ---------- Por ambiente ----------

resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2024-05-15' = {
  parent: cosmos
  name: 'panaderia-${environment}'
  properties: {
    resource: {
      id: 'panaderia-${environment}'
    }
    options: {
      throughput: databaseThroughput
    }
  }
}

resource products 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'products'
  properties: {
    resource: {
      id: 'products'
      partitionKey: {
        paths: [
          '/category'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource orders 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2024-05-15' = {
  parent: database
  name: 'orders'
  properties: {
    resource: {
      id: 'orders'
      partitionKey: {
        paths: [
          '/pickupDate'
        ]
        kind: 'Hash'
      }
    }
  }
}

resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${project}-${environment}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logs.id
    SamplingPercentage: environment == 'prod' ? 100 : 50 // FinOps: muestreo en dev
  }
}

resource site 'Microsoft.Web/staticSites@2023-01-01' = {
  name: 'swa-${project}-${environment}'
  location: location
  tags: tags
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    stagingEnvironmentPolicy: 'Disabled' // dev y prod son recursos separados; no usamos previews
    allowConfigFileUpdates: true
  }
}

// Las managed functions del plan Free no soportan identidad administrada:
// la clave de Cosmos se inyecta aquí (nunca en el repositorio). Ver ADR-003.
resource siteSettings 'Microsoft.Web/staticSites/config@2023-01-01' = {
  parent: site
  name: 'appsettings'
  properties: {
    COSMOS_ENDPOINT: cosmos.properties.documentEndpoint
    COSMOS_KEY: cosmos.listKeys().primaryMasterKey
    COSMOS_DATABASE: database.name
    APP_ENVIRONMENT: environment
    APPLICATIONINSIGHTS_CONNECTION_STRING: appInsights.properties.ConnectionString
  }
}

// ---------- Observabilidad: al menos una alerta ----------

resource actionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (!empty(alertEmail)) {
  name: 'ag-${project}-${environment}'
  location: 'global'
  tags: tags
  properties: {
    groupShortName: 'pan${environment}'
    enabled: true
    emailReceivers: [
      {
        name: 'equipo'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource failedRequestsAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: 'alert-${project}-${environment}-failed-requests'
  location: 'global'
  tags: tags
  properties: {
    description: 'Más de 5 peticiones fallidas (5xx) en 5 minutos.'
    severity: environment == 'prod' ? 1 : 3
    enabled: true
    scopes: [
      appInsights.id
    ]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'failedRequests'
          criterionType: 'StaticThresholdCriterion'
          metricName: 'requests/failed'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
        }
      ]
    }
    actions: empty(alertEmail) ? [] : [
      {
        actionGroupId: actionGroup.id
      }
    ]
  }
}

output swaName string = site.name
output swaHostname string = site.properties.defaultHostname
output cosmosAccount string = cosmos.name
output databaseName string = database.name
