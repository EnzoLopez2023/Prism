# Production parity

| Capability | Prism implementation |
| --- | --- |
| AI Assistant | Durable conversations, history, deletion, prompt picker, image attachment/persistence, markdown, streamed status/error states, stop action |
| Plex/media workflows | Marquee v1 search plus two-step playlist/collection prepare and commit with exact phrase |
| Cross-domain chat tools | Typed authenticated Hearth, Lantern, Watchtower, and Marquee clients; disabled/unavailable states; no SQL fallback |
| AI Test | Six parallel provider comparisons and a separate cross-model judge |
| AI Image Test | GPT Image 1, GPT Image 2, MAI Image 2e, orientation, optional GPT-only source image, download |
| Prompt Library | Search, category/favorite filtering, create, edit, delete, favorite, copy, usage count, model/tags/notes |
| Data Converter | Browser-only `.xlsx`/`.xls` parsing, all-sheet JSON, preview, download |
| Identity | Entra SPA/API access tokens, OID-keyed local identity, member/admin roles, settings, immutable audit |
| Operations | Liveness, bounded readiness, version/build identity, deterministic migration, recovery manifest |

## Deliberate ownership changes

- No Hearth AppView shell or global view registry.
- No direct SQL access to household, study, infrastructure, or media tables.
- No Plex, AI, or cross-app secret reaches the browser.
- Conversation image BLOBs become external artifacts with verified metadata.
- Imported unowned legacy rows remain readable but read-only; new rows are
  scoped to the authenticated Prism identity.
- Providers are independently optional and do not block startup.

## Validation record

The repository uses strict TypeScript, ESLint, Node's built-in `node:test`,
Vite production build, dependency audit, and a source scan that rejects
PostgreSQL packages and implementation code. Tests never call live AI, media,
Entra, or other application services.
