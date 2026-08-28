# Deployment Guide

## Architecture

Prism runs as a single-container Node 24 application on Azure Linux App Service.

- **Runtime**: Node.js 24, Express 5, non-root user (`prism:1001`)
- **Database**: SQLite (WAL-mode DELETE) at `/home/data/prism.db`
- **Artifacts**: Filesystem store at `/home/data/prism-artifacts`
- **Static SPA**: Vite-built React app served by Express in production
- **Auth**: Microsoft Entra ID (MSAL) — configured at runtime via `/api/config`
- **Port**: 3000 (via `PORT` env var)

## Container

Multi-stage Dockerfile:
1. **Build stage**: `node:24-slim`, `npm ci`, typecheck + Vite build + server compile
2. **Runtime stage**: `node:24-slim`, non-root `prism` user, `dumb-init` for signal forwarding

## Required GitHub Secrets & Variables

### Repository Variables (`vars.*`)

| Variable | Description | Example |
|---|---|---|
| `AZURE_CLIENT_ID` | Entra app registration for OIDC federated credential | `00000000-...` |
| `AZURE_TENANT_ID` | Entra tenant ID | `00000000-...` |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription | `00000000-...` |
| `ACR_NAME` | Azure Container Registry name | `acrprismlwxhu7jxlrbtu` |
| `WEBAPP_NAME` | Azure App Service name | `app-prism-prod-lwxhu7jxlrbtu` |
| `RESOURCE_GROUP` | Azure resource group | `rg-prism-prod` |

### App Service App Settings

| Setting | Description |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `PRISM_ENTRA_TENANT_ID` | Entra tenant for server-side JWT validation |
| `PRISM_ENTRA_CLIENT_ID` | Entra client ID for the SPA (served to client via `/api/config`) |
| `PRISM_ENTRA_AUDIENCE` | Entra audience for server-side JWT validation |
| `PRISM_ENTRA_API_SCOPE` | Entra API scope for client token acquisition |
| `PRISM_DB_PATH` | `/home/data/prism.db` (auto-detected on App Service) |
| `CHAT_OPENAI_ENDPOINT` | Azure OpenAI endpoint |
| `CHAT_OPENAI_API_KEY` | Azure OpenAI key |
| Other `*_BASE_URL`/`*_AUDIENCE` | Cross-app contract endpoints |

## Bootstrap Order

1. **Azure infrastructure**: Provision ACR, App Service, Entra app registration (via Bicep/IaC, separate repo)
2. **GitHub OIDC**: Create federated credential on the Entra app registration for GitHub Actions
3. **GitHub repo config**: Set repository variables listed above
4. **App Service config**: Set app settings listed above
5. **First deploy**: Push to `main` or trigger Deploy workflow manually
6. **Verify**: `GET /api/live`, `GET /api/ready`, `GET /api/version`

## Health Endpoints

| Endpoint | Auth | Purpose |
|---|---|---|
| `GET /api/live` | None | Liveness — returns `{"status":"live","app":"prism"}` |
| `GET /api/ready` | None | Readiness — includes DB status and build identity |
| `GET /api/version` | None | Build metadata (version, commit, schema) |
| `GET /api/config` | None | Runtime SPA config (Entra tenant/client/scope, no secrets) |

## Rollback

The deploy workflow automatically rolls back if the smoke test fails after deployment. Manual rollback: redeploy a previous image digest via `az webapp config container set`.

## Local Development

```bash
cp .env.example .env
# Edit .env with your local settings
npm install
npm run dev          # Vite dev server (port 5173)
npm run dev:server   # Express API server (port 3000)
```

The Vite dev server proxies `/api` to `localhost:3000`. In dev mode, MSAL settings fall back to `VITE_*` env vars if `/api/config` is unavailable.
