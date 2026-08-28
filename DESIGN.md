---
name: Prism
description: An optical workbench for AI tools — graphite rail, bright paper canvas, one spectral-violet accent.
colors:
  spectral-violet: "#6346db"
  violet-deep: "#4930b5"
  violet-wash: "#ebe7ff"
  violet-mist: "#f4f1ff"
  violet-frost: "#faf9ff"
  violet-line: "#bdb0f5"
  violet-focus: "#b7a7ff"
  bright-paper: "#f3f4f8"
  pure-paper: "#ffffff"
  ink: "#171824"
  slate: "#5d6074"
  rule-gray: "#dfe1ea"
  graphite: "#202130"
  graphite-deep: "#2a2b3d"
  graphite-line: "#303245"
  rail-text: "#f7f5ff"
  rail-muted: "#c4c5d3"
  confirm-green: "#16845b"
  warning-amber: "#a65f00"
  alert-red: "#b4233e"
typography:
  headline:
    fontFamily: "Aptos, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.8rem"
    fontWeight: 720
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Aptos, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1.3rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Aptos, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
  label:
    fontFamily: "Aptos, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 760
    letterSpacing: "0.06em"
  nav-label:
    fontFamily: "Aptos, Segoe UI Variable, Segoe UI, system-ui, sans-serif"
    fontSize: "0.88rem"
    fontWeight: 620
  mono:
    fontFamily: "SFMono-Regular, Consolas, monospace"
    fontSize: "0.88em"
rounded:
  xs: "3px"
  sm: "8px"
  md: "10px"
  lg: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "14px"
  lg: "18px"
  xl: "24px"
  2xl: "28px"
  3xl: "36px"
components:
  button-primary:
    backgroundColor: "{colors.spectral-violet}"
    textColor: "#ffffff"
    typography: "{typography.nav-label}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.violet-deep}"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "40px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.rail-muted}"
    typography: "{typography.nav-label}"
    rounded: "{rounded.sm}"
    padding: "8px 10px"
  nav-link-active:
    backgroundColor: "{colors.spectral-violet}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
  workspace-panel:
    backgroundColor: "{colors.pure-paper}"
    rounded: "{rounded.lg}"
    padding: "18px"
  chip-status-success:
    backgroundColor: "{colors.confirm-green}"
    textColor: "#ffffff"
    rounded: "999px"
    padding: "0 8px"
    height: "24px"
---

# Design System: Prism

## Overview

**Creative North Star: "The Optical Bench"**

Prism reads as an instrument, not a dashboard: a dark graphite rail holds the tool selector at rest, and every chosen tool opens onto a bright paper canvas where a single white workspace panel does the work. Spectral violet is the one indicator light in the system — it marks the active tool, the primary action, and the focus ring, and nowhere else. The product carries direct, technical, task-oriented language (per PRODUCT.md's Brand Commitments) and the built surface matches it: no illustration, no gradients beyond the small brand mark, no marketing voice.

The build confirms the OWN-WORLD brief exactly — graphite planes (the rail, `#202130`), bright paper (the canvas, `#f3f4f8`), spectral violet (`#6346db`) as the lone accent, crisp 1px rules instead of shadows for most separation, and compact controls (40px buttons, 42px rail links, 0.72–0.88rem labels). Depth is nearly flat: the workspace panel carries the system's only shadow, a soft ambient lift barely visible against the paper. There are no decorative kickers, no hard-offset shadows, and no glyph iconography beyond functional MUI action icons (send, attach, delete) sized to the compact-control scale.

**Key Characteristics:**
- Two structural planes only: dark graphite rail, bright paper canvas, with pure-white workspace panels floating a fraction above the canvas.
- One accent color, reserved for the active/primary state.
- Flat-by-default depth; a single soft shadow, no card lift ladder.
- Crisp 1px hairline rules do most of the separation work shadows would otherwise do.
- A single font family (Aptos/Segoe UI Variable) carries every role from page title to body to labels.

## Colors

The palette is a graphite-and-paper duotone structure with one violet accent and its own tinted family, plus three semantic status colors used only to report explicit state.

### Primary
- **Spectral Violet** (`#6346db`): the system's only accent. Used for the active nav pill, primary contained buttons, the message-author label in chat, and every keyboard focus outline (as a lighter `violet-focus` tint).
- **Violet Deep** (`#4930b5`): the pressed/dark variant of the accent (MUI `palette.primary.dark`).

### Neutral
- **Bright Paper** (`#f3f4f8`): the app canvas background behind every workspace panel.
- **Pure Paper** (`#ffffff`): the workspace panel surface itself — the plane the actual tool lives on.
- **Ink** (`#171824`): primary text and emphasis (empty-state headlines, `h1`/`h2` color).
- **Slate** (`#5d6074`): secondary text — descriptions, captions, status lines.
- **Rule Gray** (`#dfe1ea`): the hairline border/divider color on paper surfaces (panel borders, composer border, result-head dividers).
- **Graphite** (`#202130`): the rail's base plane color.
- **Graphite Deep** (`#2a2b3d`): rail hover fill and the brand-mark tile background.
- **Graphite Line** (`#303245`): the rail's own border, reused as the mobile bottom-nav top border.
- **Rail Text** (`#f7f5ff`) / **Rail Muted** (`#c4c5d3` / `#aeb0c6`): rail label text at full and reduced emphasis.

### Status (semantic — explicit-state reporting)
- **Confirm Green** (`#16845b`): "available"/success state (model-lab availability chip, status dot).
- **Warning Amber** (`#a65f00`): destructive-but-confirmed actions (the mutation "Commit" button only enables once its confirmation phrase matches).
- **Alert Red** (`#b4233e`): error state (MUI `error.main`).

### Named Rules
**The One Accent Rule.** Spectral Violet appears only on the active/selected/primary-action state — never as a decorative background wash. Its own tinted family (`violet-wash` `#ebe7ff`, `violet-mist` `#f4f1ff`, `violet-frost` `#faf9ff`, `violet-line` `#bdb0f5`) exists solely to shade elements already tied to the accent (the user's chat bubble, the cross-model analysis strip, composer/dropzone backgrounds) — it never substitutes for Bright Paper as the general canvas color.

## Typography

**Display/Body/Label Font:** Aptos, with `Segoe UI Variable`, `Segoe UI`, `system-ui`, sans-serif fallbacks.
**Mono Font:** SFMono-Regular, Consolas, monospace (code blocks only).

**Character:** One face, weight- and size-driven hierarchy. Nothing about the type system is ornamental — it reads as instrument-panel labeling, matching the direct/technical brand voice.

### Hierarchy
- **Headline** (720, 1.8rem, letter-spacing -0.03em): the page title in `PageHeading` — one per workspace ("Assistant", "Model lab", "Prompt library"...).
- **Title** (700, 1.3rem, letter-spacing -0.02em): in-panel section headers ("Cross-model analysis", a saved prompt's title).
- **Body** (400, 1rem): descriptions, message content, prompt bodies (clamped to 80ch/4 lines in the prompt list).
- **Label** (760, 0.72rem, letter-spacing 0.06em, uppercase): the functional sender label above each chat message ("USER"/"ASSISTANT") — the system's only uppercase small-caps text, and it exists to identify content, not to decorate a heading.
- **Nav label** (620, 0.88rem): rail links; drops to 0.65rem stacked under an icon in the mobile bottom bar.

### Named Rules
**The Single Family Rule.** One font stack serves display, body, and label roles across the whole product; hierarchy is carried by weight, size, and letter-spacing, never by introducing a second face.

## Layout

Desktop is a two-region CSS grid: a fixed 224px rail plus a fluid main column (`grid-template-columns: 224px minmax(0,1fr)`), both `100vh`. The main column centers a `page-shell` at `min(1440px, 100%)` with 36px/40px/64px (top/side/bottom) padding. Every workspace opens with a `PageHeading` (title + description left, actions right, 72px min-height) followed by one `workspace-panel` that fills the remaining space — the FIRST VIEWPORT contract (rail, task title/status, active workspace) is structural, not per-page choice.

Multi-item workspaces (Model lab, Image lab) use a 3-column grid that steps to 2 columns at 1080px. At 760px the whole shell restructures for the FORM contract: the rail becomes a fixed 68px bottom bar (icon-over-label, brand lockup and authority chip hidden), `page-shell` padding drops to 24px/16px/40px, every multi-column grid collapses to one column, and the page heading stacks instead of splitting title from actions.

Spacing is an 8px-driven rhythm, not a formal token scale: 4/8px for tight internal gaps, 14/18px for panel internal padding, 22/24/28px between stacked blocks, and 36/40px for outer page padding.

## Elevation & Depth

The system is flat by default. Buttons carry no shadow at any state (`MuiButton` override forces `boxShadow: none`); separation between adjacent regions is done with 1px hairline borders (Rule Gray on paper, Graphite Line on the rail), not elevation. The one exception is the workspace panel itself, which gets a single, very low-contrast ambient shadow to lift it a fraction off the bright-paper canvas.

### Shadow Vocabulary
- **Panel lift** (`box-shadow: 0 12px 28px rgba(33,35,52,0.06)`): applied only to `.workspace-panel`, the one active-tool surface per screen.

### Named Rules
**The One Shadow Rule.** There is exactly one shadow value in the system, and it exists to separate the single workspace panel from the canvas beneath it — not to create an elevation ladder. No other element (button, chip, card, result tile) carries a shadow.

## Shapes

Corners are soft but small: 10px is the MUI shape default (buttons, inputs), 12px marks the primary containers (workspace panel, prompt rows, model/image result tiles), 8px marks compact elements (rail links, the brand mark, code blocks, message images), and 3px appears once, as the sharp corner on the tail side of the user's chat bubble (`12px 12px 3px 12px`) — a small directional cue, not a general asymmetric-corner rule. Borders are 1px hairlines throughout; the one deliberate departure is the Converter drop zone, which uses a dashed border to read as a literal drop target for the "provide material" step of the STORY, switching to violet and a frost-tint background on hover/focus.

## Components

### Buttons
- **Shape:** 10px radius (theme default), 40px min-height, no shadow at any state.
- **Primary:** contained, Spectral Violet fill / white text, weight 680, no uppercase transform (`textTransform: none`). Used for the one primary action per workspace ("Generate", "Run comparison", "New prompt", "Download JSON").
- **Hover / Focus:** hover darkens toward Violet Deep; every focusable control gets a 3px Violet Focus outline (`#b7a7ff`/`#a897ef`) with 2–3px offset, not a color-only change.
- **Outlined / Ghost:** outlined variant for secondary file/attach actions ("Browse files", "Add source image"); text-only button for low-emphasis actions like "Cancel".
- **Semantic color:** the `warning` color button is reserved for the one destructive-but-confirmed action (committing a Marquee mutation), and stays disabled until the typed confirmation phrase matches exactly — the button's enabled state *is* the explicit-state signal.

### Chips
- **Style:** small size throughout; filled for a value that stands alone (a prompt's category), outlined for secondary metadata (model, tags).
- **State:** the model-lab availability chip is the clearest explicit-state device in the product — `color="success"` (Confirm Green) once a provider reports available, default gray while "checking". The rail's "Local authority" chip is a fixed, non-interactive status marker (outlined, graphite-toned), hidden on mobile.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Pure Paper (`#ffffff`).
- **Shadow Strategy:** the single Panel Lift shadow (see Elevation & Depth) — never combined with a border-based lift elsewhere.
- **Border:** 1px Rule Gray, used on both the outer workspace panel and inner tiles (model/image result cards use MUI's `variant="outlined"` instead of the ambient shadow).
- **Internal Padding:** 18px is the standard panel/tile padding.

### Inputs / Fields
- **Style:** MUI outlined text fields, no custom chrome.
- **Focus:** the shared 3px Violet Focus outline, offset from the field.
- **Signature case:** the Converter drop zone is a labeled dropzone (dashed border) rather than a text field — it visually announces "provide material here" for the one workflow whose material is a file, not text.

### Navigation
- **Style:** a persistent 224px dark rail (brand lockup, then nav links, then the authority chip pinned to the bottom via `margin-top: auto`). Links are 42px tall, 0.88rem/620 weight, Rail Muted at rest, white on hover (Graphite Deep fill), solid Spectral Violet fill with white text when active.
- **Mobile treatment:** below 760px the rail becomes a fixed 68px bottom bar; brand lockup and authority chip disappear, links go icon-over-label at 0.65rem, and the active link keeps its violet fill as a compact pill — the same active-state language, just reoriented.

### Brand Mark (signature; not a reusable pattern)
A 34×34px graphite tile holding three narrow, rotated (22°) color bars (violet/cyan/pink) — the one purely decorative element in the product, confined to the rail's brand lockup and hidden entirely on mobile. It is an identity mark, not a component: its geometry and extra hues are not reused anywhere else in the system.

## Do's and Don'ts

### Do:
- **Do** keep Spectral Violet to a single role per screen: the active nav item, the one primary action, and focus rings.
- **Do** use 1px hairline rules (Rule Gray on paper, Graphite Line on graphite) as the default way to separate regions.
- **Do** give every focusable control the shared 3px Violet Focus outline — it is the accessibility contract, not a decorative flourish.
- **Do** let a control's enabled/disabled or color state (the warning "Commit" button, the success/default availability chip) *be* the explicit-state signal the STORY calls for, instead of adding separate status text.
- **Do** hold buttons, chips, and result tiles flat; reserve the one ambient shadow for the workspace panel only.

### Don't:
- **Don't** add a second shadow value or stack shadows on top of borders; the system has exactly one shadow and it belongs to the workspace panel.
- **Don't** introduce uppercase kicker/eyebrow labels above page or section titles — the only uppercase small-caps text in the product is the functional per-message sender label inside chat, and it does not generalize to other headings.
- **Don't** use hard-offset (non-blurred) shadows or thick neobrutalist borders; Prism's world is soft-shadow-and-hairline, not that one.
- **Don't** introduce a second typeface for emphasis or display text; hierarchy comes from weight/size/letter-spacing within the single Aptos/Segoe UI Variable stack.
- **Don't** reuse the brand mark's rotated color bars as a general decorative motif; it is confined to the one brand lockup instance.
