# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Inferred from the extraction brief: the primary user is the authenticated owner of
the Hearth portfolio, working from a desktop or mobile browser to use AI models,
saved prompts, conversation history, media-assistant workflows, and spreadsheet
conversion without entering the household application.

## Product Purpose

Prism is the independent AI workbench extracted from Hearth. It preserves the
production outcomes of AI Assistant, AI Test, AI Image Test, Prompt Library, and
Excel-to-JSON conversion while giving those workflows their own authority,
identity boundary, runtime, and recovery path.

## Positioning

Prism combines durable, private conversation and prompt workflows with explicit
cross-provider comparison and confirmed media actions. It does not own household,
study, infrastructure, or media data; it reaches those domains only through
typed, authenticated contracts.

## Operating Context

Users write and reuse prompts, compare model responses, generate or edit images,
hold streamed assistant conversations, confirm playlist or collection mutations,
and convert local spreadsheets entirely in the browser. AI and application
credentials remain server-side.

## Capabilities and Constraints

- React 19, strict TypeScript, MUI, Vite, and real URL routes.
- Express 5 with an isolated single-process SQLite authority.
- Entra access-token authentication and OID-keyed local roles, settings, and audit.
- Optional AI providers expose typed unavailable states and never block startup.
- Marquee owns media search and mutations. Hearth, Lantern, and Watchtower own
  their respective data. No shared-database fallback is permitted.
- Conversation image bytes live behind an artifact-store interface outside SQLite.
- Spreadsheet conversion is browser-only.
- Source parity is bounded to Hearth production commit
  `f0b05fc1dbf53e8aa26c215d8e858894a2793871`.

## Brand Commitments

The product name is Prism. Language is direct, technical, and task-oriented.

## Evidence on Hand

The immutable Hearth source release, verified production SQLite backup, ownership
manifest, baseline counts, and frozen Marquee v1 contract plan are the factual
evidence. No testimonials, benchmarks, or public product claims are available and
none may be fabricated.

## Product Principles

1. Keep private work durable and recoverable.
2. Make model capability and unavailability explicit.
3. Require a preview and exact confirmation before external mutation.
4. Cross application boundaries only through versioned authenticated contracts.
5. Preserve production data with verifiable lineage.

## Accessibility & Inclusion

Keyboard access, visible focus, reduced-motion support, semantic status messages,
responsive layouts, and WCAG AA contrast are required.
