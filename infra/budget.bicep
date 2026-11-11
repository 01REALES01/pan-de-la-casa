// Alerta de presupuesto del grupo de recursos. Se despliega UNA vez desde
// scripts/bootstrap.sh (no en cada pipeline) para que un fallo aquí no
// bloquee los despliegues.

targetScope = 'resourceGroup'

@description('Correo que recibe la alerta de presupuesto.')
param alertEmail string

@description('Presupuesto mensual en USD.')
param amount int = 20

@description('Primer día del mes en que empieza el presupuesto (yyyy-MM-01).')
param startDate string

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: 'budget-pandelacasa'
  properties: {
    category: 'Cost'
    amount: amount
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: startDate
    }
    notifications: {
      actual50: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 50
        thresholdType: 'Actual'
        contactEmails: [
          alertEmail
        ]
      }
      forecast100: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        thresholdType: 'Forecasted'
        contactEmails: [
          alertEmail
        ]
      }
    }
  }
}
