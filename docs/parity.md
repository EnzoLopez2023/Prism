# Production parity

| Capability | Prism implementation |
| --- | --- |
| AI Assistant | Durable conversations, history, deletion, prompt picker, image attachment/persistence, markdown, streamed status/error states, stop action |
| Plex/media workflows | Marquee v1 search plus two-step playlist/collection prepare and commit with exact phrase |
| Cross-domain chat tools | Typed authenticated Hearth, Lantern, Watchtower, and Marquee clients; disabled/unavailable states; no SQL fallback |
| AI Test | Eight production sample prompts, Ctrl/Cmd+Enter, six fixed parallel provider comparisons, full pending/error/timing/token states, and a separate successful-response-only cross-model judge |
| AI Image Test | Ten production sample prompts, Ctrl/Cmd+Enter, GPT Image 1, GPT Image 2, MAI Image 2e, native orientation, eleven output/download presets, clean bounded GPT-only source-image editing, exact crop/download behavior |
| Prompt Library | Search, category/model/favorite filtering, five sort modes, create/edit/delete/favorite, Enter-to-add tags, expandable bodies/notes, copy feedback, usage counts, and explicit imported read-only state |
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

## Data cutover status

The deterministic importer and reconciliation gate preserve all 40 production
Hearth prompt rows, including IDs, timestamps, categories, tags, model, notes,
favorite state, and usage counts. A deployment starts with an empty Prism
authority until an operator performs the documented quiesce/import/reconcile/
promote cutover; personal prompt contents are never embedded in the repository
or container image.

## Validation record

The repository uses strict TypeScript, ESLint, Node's built-in `node:test`,
Vite production build, dependency audit, and a source scan that rejects
PostgreSQL packages and implementation code. Tests never call live AI, media,
Entra, or other application services.
