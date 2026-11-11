#!/usr/bin/env bash
# Configuración inicial (se ejecuta UNA vez, desde tu máquina, con `az login` y `gh auth login` hechos).
#
#   scripts/bootstrap.sh <owner/repo> [correo-alertas]
#
# Crea:
#   1. Grupo de recursos (centralus).
#   2. Identidad administrada para GitHub Actions, con rol Contributor SOLO sobre ese grupo.
#   3. Credenciales federadas OIDC para los environments "dev" y "prod" del repo.
#   4. Environments, secretos y variables en GitHub.
#   5. Alerta de presupuesto (si se da un correo).
# Nada de esto deja contraseñas: GitHub obtiene tokens de corta duración vía OIDC.
set -euo pipefail

REPO="${1:?Uso: scripts/bootstrap.sh <owner/repo> [correo-alertas]}"
ALERT_EMAIL="${2:-}"
RG="${RG:-rg-pandelacasa}"
LOCATION="${LOCATION:-centralus}"
IDENTITY="id-pandelacasa-github"

cd "$(dirname "$0")/.."

echo "==> 1/5 Grupo de recursos $RG ($LOCATION)"
az group create -n "$RG" -l "$LOCATION" --tags project=pandelacasa -o none
RG_ID=$(az group show -n "$RG" --query id -o tsv)

echo "==> 2/5 Identidad $IDENTITY con Contributor sobre $RG"
az identity create -n "$IDENTITY" -g "$RG" -l "$LOCATION" -o none
CLIENT_ID=$(az identity show -n "$IDENTITY" -g "$RG" --query clientId -o tsv)
PRINCIPAL_ID=$(az identity show -n "$IDENTITY" -g "$RG" --query principalId -o tsv)
TENANT_ID=$(az account show --query tenantId -o tsv)
SUBSCRIPTION_ID=$(az account show --query id -o tsv)

# Se filtra por principalId (no por --assignee) para no depender de consultas al directorio de Entra ID.
if [ -z "$(az role assignment list --scope "$RG_ID" --query "[?principalId=='$PRINCIPAL_ID' && roleDefinitionName=='Contributor'].id | [0]" -o tsv)" ]; then
  # La identidad recién creada puede tardar en propagarse.
  for i in 1 2 3 4 5 6; do
    az role assignment create --assignee-object-id "$PRINCIPAL_ID" --assignee-principal-type ServicePrincipal \
      --role Contributor --scope "$RG_ID" -o none && break
    echo "   reintentando asignación de rol ($i)..."; sleep 10
  done
fi

echo "==> 3/5 Credenciales federadas OIDC para $REPO"
# GitHub puede emitir el "subject" con nombres (repo:owner/repo:...) o con nombres + IDs inmutables
# (repo:owner@<id>/repo@<id>:...). Registramos ambos formatos para cada environment.
OWNER_ID=$(gh api "repos/$REPO" --jq .owner.id)
REPO_ID=$(gh api "repos/$REPO" --jq .id)
OWNER="${REPO%%/*}"; NAME_ONLY="${REPO##*/}"
for ENV in dev prod; do
  for FORMAT in name id; do
    if [ "$FORMAT" = name ]; then
      SUBJECT="repo:${REPO}:environment:${ENV}"; CRED="github-${ENV}"
    else
      SUBJECT="repo:${OWNER}@${OWNER_ID}/${NAME_ONLY}@${REPO_ID}:environment:${ENV}"; CRED="github-${ENV}-ids"
    fi
    if ! az identity federated-credential show --name "$CRED" --identity-name "$IDENTITY" -g "$RG" -o none 2>/dev/null; then
      az identity federated-credential create --name "$CRED" --identity-name "$IDENTITY" -g "$RG" \
        --issuer "https://token.actions.githubusercontent.com" \
        --subject "$SUBJECT" \
        --audiences "api://AzureADTokenExchange" -o none
    fi
  done
done

echo "==> 4/5 Environments, secretos y variables en GitHub"
ME_ID=$(gh api user --jq .id)
gh api -X PUT "repos/$REPO/environments/dev" --silent
# prod requiere aprobación manual de un revisor antes de desplegar.
printf '{"reviewers":[{"type":"User","id":%s}]}' "$ME_ID" \
  | gh api -X PUT "repos/$REPO/environments/prod" --input - --silent

gh secret set AZURE_CLIENT_ID       -R "$REPO" -b "$CLIENT_ID"
gh secret set AZURE_TENANT_ID       -R "$REPO" -b "$TENANT_ID"
gh secret set AZURE_SUBSCRIPTION_ID -R "$REPO" -b "$SUBSCRIPTION_ID"
gh variable set AZURE_RESOURCE_GROUP -R "$REPO" -b "$RG"
if [ -n "$ALERT_EMAIL" ]; then
  gh variable set ALERT_EMAIL -R "$REPO" -b "$ALERT_EMAIL"
fi

echo "==> 5/5 Alerta de presupuesto"
if [ -n "$ALERT_EMAIL" ]; then
  az deployment group create -g "$RG" -n budget -f infra/budget.bicep \
    -p alertEmail="$ALERT_EMAIL" startDate="$(date -u +%Y-%m-01)" -o none \
    && echo "   presupuesto creado" \
    || echo "   AVISO: no se pudo crear el presupuesto (créalo en el portal: Cost Management > Budgets)"
else
  echo "   omitido (sin correo)"
fi

echo
echo "Listo. Identidad: $IDENTITY · Grupo: $RG · Repo: $REPO"
