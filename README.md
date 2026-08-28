# Prism

Prism is the independent AI workbench extracted from Hearth production
`2.13.2` build `172`. It owns conversations, externalized conversation
artifacts, prompts, provider comparison, image experiments, and browser-only
spreadsheet conversion.

## Run locally

Requires Node.js 24.

```bash
cp .env.example .env
npm install
npm run dev:server
# in a second terminal
npm run dev
```

Development requires the explicit `PRISM_AUTH_MODE=development` opt-in from
`.env.example`; without that flag the server fails closed unless a complete
Prism Entra tenant and audience are configured. Production requires a
Prism-specific Entra API audience and SPA configuration. AI providers and cross-application
contracts are optional; missing configuration produces explicit unavailable
states rather than blocking startup.

Development identity is always rejected when `NODE_ENV` is production-like or
when Azure App Service deployment environment variables are present, even if
`PRISM_AUTH_MODE=development` was explicitly supplied.
Those App Service signals also select `/home/data` authority paths, production
static serving, and non-loopback deployed binding even when `NODE_ENV` was not
set. Explicit development auth always binds the API to `127.0.0.1`.

The app, importer, and restore command share an atomic
`<database>.operation.claim`. Claims are never auto-stolen across hosts.
Interrupted claims require the documented token-bound `npm run claim:recover`
operator workflow and archived evidence.

LM Studio has no default endpoint. Set `LMSTUDIO_ENDPOINT` explicitly. HTTPS
and loopback HTTP endpoints are accepted; any other plaintext HTTP endpoint is
disabled unless the operator explicitly sets
`LMSTUDIO_ALLOW_INSECURE_HTTP=true`.

## Validate

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit --audit-level=high
npm run check:no-postgres
```

See [source lineage](docs/source-lineage.md),
[contracts and providers](docs/contracts-and-providers.md),
[migration and recovery](docs/migration-and-recovery.md), and the
[parity record](docs/parity.md).
