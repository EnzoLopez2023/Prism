# Contracts and providers

## Authentication

Browser calls use MSAL to acquire a Prism-audienced access token. The Express
API validates signature, tenant, issuer, audience, lifetime, and GUID-shaped
`oid` with Entra JWKS. Persistence and authorization use `(tenant_id, oid)`;
email and display name are never authorization keys.
When silent acquisition requires interaction, Prism replaces the cached-account
UI with an explicit recoverable sign-in state and serializes the interactive
redirect so concurrent API calls cannot launch competing reauthentication.

Cross-application calls obtain audience-specific bearer tokens from App Service
managed identity. No static Hearth, Lantern, Watchtower, or Marquee token is
accepted. A missing app URL, audience, or managed identity returns a typed
`disabled` or `unavailable` state.

## Cross-application inventory

| Owner | Prism purpose | Contract behavior |
| --- | --- | --- |
| Hearth | Household context | Frozen typed client; disabled until v1 service contract is deployed |
| Lantern | Study summaries | Frozen typed client; disabled until v1 service contract is deployed |
| Watchtower | Infrastructure status | Frozen typed client; disabled until v1 service contract is deployed |
| Marquee | Media search and confirmed mutation | `GET /api/contracts/v1/media/search`; playlist/collection `prepare` then `commit` |

Marquee search excludes file paths, credentials, private provider URLs, and
destructive metadata. Prepare validates and persists a bounded intent in
Marquee. Prism displays the exact preview, expiry, and confirmation phrase.
Commit sends only the intent ID and exact phrase. Unknown external outcomes are
surfaced and never retried automatically.
Once a commit request is dispatched, timeout or network loss is classified as
non-retryable `crash-ambiguous`, retained in the Prism preview for operator
reconciliation, and audited as failure rather than transport success.
The same rule applies to any HTTP 5xx received after commit dispatch because
the external mutation may already have completed.

There is no shared database or success-shaped fallback.
Every cross-app response is capped at 2 MiB and must pass its app-specific v1
runtime schema before it can enter an `available` state or a chat tool result.
Oversized, malformed, wrong-owner, or wrong-version payloads remain typed
`unavailable` results.

## Provider inventory

| Prism endpoint | Provider/deployment | Required environment |
| --- | --- | --- |
| `/api/azure-openai/chat[/stream]` | Azure OpenAI-compatible chat and bounded tool loop | `CHAT_OPENAI_*` with `VIBE_OPENAI_*` fallback |
| `/api/ai-test/codex` | GPT-5.3 Codex Responses | `CODEX_OPENAI_*` or `PRO_OPENAI_*` |
| `/api/ai-test/gpt54` | GPT-5.4 chat | `VIBE_OPENAI_*` |
| `/api/ai-test/gpt54pro` | GPT-5.4 Pro Responses | `PRO_OPENAI_*` |
| `/api/ai-test/haiku` | Claude Haiku 4.5 | `ANTHROPIC_API_KEY` |
| `/api/ai-test/sonnet` and `/analyze` | Claude Sonnet 4.6 | `ANTHROPIC_API_KEY` |
| `/api/ai-test/lmstudio` | LM Studio OpenAI-compatible | Explicit `LMSTUDIO_ENDPOINT`; no default |
| `/api/ai-image-test/gpt-image-{1,2}` | GPT image generation/editing | `GPT_IMAGE_*` |
| `/api/ai-image-test/mai-image-2e` | MAI Image 2e | `MAI_IMAGE_*` |

Foundry project bases are used exactly as configured: PRO/Codex append
`/responses`, VIBE/chat append `/chat/completions`, GPT image edits use
multipart `/images/edits`, and MAI uses
`/mai/v1/images/generations?api-version=...` with bounded integer
`width`/`height`.

Secrets remain server-side. Requests enforce prompt, JSON, decoded image,
provider-response, tool-round, tool-argument, and time limits; client
disconnects and explicit stop actions cancel provider work. Responses expose
sanitized error categories, not secrets, tokens, SQL, or configured upstream
URLs.

LM Studio endpoint policy is fail-closed: HTTPS and loopback HTTP are accepted.
A non-loopback plaintext HTTP endpoint is unavailable unless the operator sets
`LMSTUDIO_ALLOW_INSECURE_HTTP=true`; Prism never sends a prompt to an implicit
or malformed endpoint.
