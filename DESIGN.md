---
name: Prism
description: A folding AI workbench in bright optical paper, graphite iOS glass, and restrained spectral refraction.
colors:
  spectral-violet: "#6346db"
  violet-deep: "#4930b5"
  violet-wash: "#ebe7ff"
  violet-mist: "#f4f1ff"
  violet-frost: "#faf9ff"
  violet-line: "#bdb0f5"
  violet-focus: "#b7a7ff"
  refraction-violet: "#8f72ff"
  refraction-cyan: "#45b7db"
  refraction-pink: "#e789b4"
  refraction-pink-light: "#f09fc3"
  optical-paper: "#f4f4f9"
  bright-paper: "#f3f4f8"
  pure-paper: "#ffffff"
  ink: "#171824"
  slate: "#5d6074"
  rule-gray: "#dfe1ea"
  optical-line: "rgba(73, 66, 108, 0.15)"
  graphite-glass: "rgba(28, 29, 43, 0.7)"
  rail-text: "#f7f5ff"
  rail-muted: "#c4c5d3"
  confirm-green: "#16845b"
  warning-amber: "#a65f00"
  alert-red: "#b4233e"
typography:
  marketing-display:
    fontFamily: '"Archivo Variable", "Aptos Display", "Segoe UI Variable Display", sans-serif'
    fontSize: "clamp(3.2rem, 6.3vw, 5.9rem)"
    fontWeight: 760
    lineHeight: 0.94
    letterSpacing: "-0.04em"
  marketing-heading:
    fontFamily: '"Archivo Variable", "Aptos Display", "Segoe UI Variable Display", sans-serif'
    fontSize: "clamp(2.25rem, 4.6vw, 4.5rem)"
    fontWeight: 750
    lineHeight: 1
    letterSpacing: "-0.04em"
  workspace-headline:
    fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "1.8rem"
    fontWeight: 720
    letterSpacing: "-0.03em"
  workspace-title:
    fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "1.3rem"
    fontWeight: 700
    letterSpacing: "-0.02em"
  body:
    fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 400
  action-label:
    fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "1rem"
    fontWeight: 720
    letterSpacing: "-0.01em"
  control-label:
    fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "0.875rem"
    fontWeight: 680
  label:
    fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "0.72rem"
    fontWeight: 760
    letterSpacing: "0.06em"
  nav-label:
    fontFamily: '"Aptos", "Segoe UI Variable", "Segoe UI", system-ui, sans-serif'
    fontSize: "0.88rem"
    fontWeight: 620
  mono:
    fontFamily: "SFMono-Regular, Consolas, monospace"
    fontSize: "0.88em"
rounded:
  directional: "4px"
  media: "8px"
  brand: "11px"
  squircle: "14px"
  pill: "999px"
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
    textColor: "{colors.pure-paper}"
    typography: "{typography.control-label}"
    rounded: "{rounded.squircle}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.violet-deep}"
  button-primary-marketing:
    backgroundColor: "{colors.spectral-violet}"
    textColor: "{colors.pure-paper}"
    typography: "{typography.action-label}"
    rounded: "{rounded.squircle}"
    padding: "0 19px"
    height: "52px"
  button-outlined:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.control-label}"
    rounded: "{rounded.squircle}"
    padding: "0 16px"
    height: "40px"
  nav-link:
    backgroundColor: "transparent"
    textColor: "{colors.rail-muted}"
    typography: "{typography.nav-label}"
    rounded: "{rounded.squircle}"
    padding: "9px 11px"
    height: "44px"
  nav-link-active:
    backgroundColor: "rgba(99, 70, 219, 0.94)"
    textColor: "{colors.pure-paper}"
    rounded: "{rounded.squircle}"
  workspace-panel:
    backgroundColor: "{colors.pure-paper}"
    rounded: "{rounded.squircle}"
  graphite-menu:
    backgroundColor: "{colors.graphite-glass}"
    textColor: "{colors.rail-text}"
    width: "244px"
    inset: "14px"
    rounded: "{rounded.squircle}"
  chip-status-success:
    backgroundColor: "{colors.confirm-green}"
    textColor: "{colors.pure-paper}"
    rounded: "{rounded.squircle}"
    padding: "0 8px"
    height: "24px"
---

# Design System: Prism

## Overview

**Creative North Star: "The Folding Optical Bench"**

Prism is one workbench seen at two distances. The unauthenticated Persuade surface presents the recognizable app itself as the offer, then refits that same frame across five real tools; the authenticated Operate surface is the full working instrument. Bright optical paper receives graphite glass navigation, white task surfaces, and spectral light without turning into a generic marketing page or a conventional dashboard.

The shipped system expands the incumbent Optical Bench rather than replacing it. Spectral Violet still leads interaction, while restrained violet, cyan, and pink refractions now supply atmosphere and a thin signature seam. Ionic's iOS shell and MUI's task workspaces meet at one dominant 14px squircle geometry. Archivo Variable gives only the marketing display layer its broad, tightly tracked voice; all workbench body text and controls remain in the Aptos stack.

Depth is intentionally mode-dependent. Operate stays shallow and legible, using a frosted graphite split pane, hairlines, and one low panel lift. Persuade stages the same workbench with layered glass, diffuse shadows, grain, and bounded pointer/scroll parallax; mobile removes the loose folds, and reduced-motion users receive a still composition.

**Key Characteristics:**
- One recognizable workbench volume, presented persuasively before sign-in and used directly after sign-in.
- Bright optical paper against semi-transparent graphite iOS glass.
- Spectral Violet for action and selection; cyan and pink only as restrained refraction.
- A shared 14px squircle language across Ionic controls, MUI controls, navigation, and work surfaces.
- Archivo Variable for Persuade display type only; Aptos for Operate, body copy, labels, and controls.
- Ambient, blurred depth and bounded motion, with explicit reduced-motion and reduced-transparency behavior.

## Colors

The palette is graphite-and-paper at its structural core, with Violet as the interactive lead and cyan/pink appearing only as refracted light.

### Primary
- **Spectral Violet** (`#6346db`): primary actions, active navigation, message-author identity, selected workflow steps, and Ionic/MUI primary color.
- **Violet Deep** (`#4930b5`): pressed and hover depth for primary actions.
- **Violet Wash / Mist / Frost / Line / Focus** (`#ebe7ff`, `#f4f1ff`, `#faf9ff`, `#bdb0f5`, `#b7a7ff`): tied-state surfaces, analysis and drop-zone treatments, borders, and the shared 3px focus outline.

### Secondary
- **Refraction Violet** (`#8f72ff`): the brighter optical edge in canvas haze, glass glints, and the workspace panel's one-pixel top seam.
- **Refraction Cyan** (`#45b7db`): a cool secondary wavelength in atmospheric fields and spectral seams, never an action color.
- **Refraction Pink / Pink Light** (`#e789b4`, `#f09fc3`): warm secondary wavelengths in low-opacity atmosphere, folded glass, and the workspace seam.

### Neutral
- **Optical Paper** (`#f4f4f9`): the Persuade canvas.
- **Bright Paper** (`#f3f4f8`): the Operate canvas and MUI background.
- **Pure Paper** (`#ffffff`): task panels, inputs, result surfaces, and high-opacity glass.
- **Ink** (`#171824`): primary text; **Slate** (`#5d6074`): secondary text and descriptions.
- **Rule Gray** (`#dfe1ea`): solid hairlines on white work surfaces.
- **Optical Line** (`rgba(73, 66, 108, 0.15)`): low-contrast rules across the marketing canvas.
- **Graphite Glass** (`rgba(28, 29, 43, 0.7)`): the authenticated split-pane menu over the refracted app background.
- **Rail Text / Rail Muted** (`#f7f5ff`, `#c4c5d3`): inverse emphasis levels on graphite glass.

### Status
- **Confirm Green** (`#16845b`): available/ready state only.
- **Warning Amber** (`#a65f00`): warning and confirmed destructive-action state.
- **Alert Red** (`#b4233e`): error state.

### Named Rules
**The Violet Leads Rule.** Spectral Violet owns primary actions, active navigation, and focus. Cyan and pink may only refract as low-opacity atmosphere or a one-pixel spectral seam; they never carry action or status meaning.

**The Mode-Density Rule.** Persuade surfaces may show the full violet/cyan/pink field; Operate surfaces reduce it to edge haze and the panel's top seam so task content remains dominant.

## Typography

**Display Font:** Archivo Variable, with Aptos Display and Segoe UI Variable Display fallbacks.
**Body Font:** Aptos, with Segoe UI Variable, Segoe UI, system-ui, and native sans-serif fallbacks.
**Mono Font:** SFMono-Regular with Consolas fallback.

**Character:** Persuade uses wide-stretched Archivo at heavy weights for a large, plainspoken offer. Operate stays compact and technical in Aptos; the two roles never mix within the task workspace.

### Hierarchy
- **Marketing Display** (760, `clamp(3.2rem, 6.3vw, 5.9rem)`, 0.94 line-height, -0.04em): first-viewport offer, stretched to 112%; mobile narrows to `clamp(2.7rem, 12.5vw, 3.2rem)`.
- **Marketing Heading** (750, `clamp(2.25rem, 4.6vw, 4.5rem)`, 1 line-height, -0.04em): primary section statements, stretched to 108%.
- **Workspace Headline** (720, 1.8rem, -0.03em): the one page title per authenticated workspace.
- **Workspace Title** (700, 1.3rem, -0.02em): in-panel headings and saved-item titles.
- **Lead** (400, `clamp(1.04rem, 1.35vw, 1.18rem)`, 1.68 line-height): the marketing offer's supporting paragraph, capped at 58ch.
- **Body** (400, 1rem): workbench descriptions, messages, and prompt content; marketing explanatory text stays near this size with 1.6–1.68 line-height.
- **Action Label** (720, 1rem, -0.01em): the 52px marketing sign-in action.
- **Label** (760, 0.72rem, 0.06em): uppercase only when identifying functional content such as chat authors.
- **Navigation Label** (620, 0.88rem): authenticated rail links; small marketing navigation uses the same compact, semibold character.
- **Mono** (0.88em): code blocks and technical error output only.

### Named Rules
**The Display Boundary Rule.** Archivo Variable is a Persuade-only display face for the marketing wordmark and large headings. Authenticated workspaces, controls, navigation, labels, and body copy stay in the Aptos stack.

**The Functional Label Rule.** Uppercase tracked type identifies content or state; it does not become a decorative eyebrow above headings.

## Layout

Persuade begins with a sticky 72px glass navigation and a centered hero capped at 1440px. The first viewport is a two-column fold (`0.82fr / 1.18fr`): the plainspoken offer and Microsoft action sit left, while a complete, full-scale Prism workspace occupies the larger right side. The workflow story below uses a 1360px container, a step column beside a sticky workspace stage, and the same app frame reconfigured across Assistant, Model Lab, Image Lab, Prompts, and Converter.

At 920px the landing hero and workflow stage stack, center navigation disappears, and the workspace remains the visual proof. At 640px the primary action becomes full-width, loose fold cards and floating labels disappear, the mock sidebar compresses to icons, proof items stack, and workflow selectors become a horizontal snap strip. Macro marketing spacing is fluid (`clamp()` ranges from 70–164px); component spacing still resolves to the shared 4/8/14/18/24/28/36px rhythm.

Operate uses an Ionic `IonSplitPane` with a persistent 244px menu inset by 14px inside a 272px desktop rail reserve at 761px and above. The main column centers a page shell at `min(1440px, 100%)` with 36px/40px/64px top/side/bottom padding. Below 761px the split pane becomes Ionic's native overlay menu, sized to `min(86vw, 310px)`, opened by a fixed 46px frosted control; the page shell reserves 80px plus the safe-area inset above content. It does not become a bottom tab bar.

Authenticated model results use two columns; image results use three, then two below 1080px. Both collapse to one column below 761px, as do action rows and source-image forms. Page headings stack, prompt rows simplify, and full-width primary actions preserve a usable mobile task flow.

### Named Rules
**The One Volume Rule.** On Prism Persuade surfaces, show the recognizable workbench itself and reconfigure that same frame across capabilities; do not replace it with a row of interchangeable feature cards.

## Elevation & Depth

Prism uses a hybrid depth system. Operate relies on translucent planes, 1px rules, and low ambient lift so data remains primary. Persuade may separate the same workbench into soft glass layers, but every shadow is blurred and atmospheric; there are no hard-offset shadows or stacked card ladders. Frosted surfaces use a 20px backdrop blur with modest saturation. Under reduced-transparency preferences, landing glass drops that blur; the navigation and workflow controls additionally resolve to solid paper.

### Shadow Vocabulary
- **Workspace Panel Lift** (`0 12px 28px rgba(33, 35, 52, 0.06)`): the restrained lift under the real task workspace.
- **Graphite Menu Separation** (`0 12px 32px -14px rgba(24, 23, 38, 0.28), 0 4px 10px -6px rgba(24, 23, 38, 0.16)`): separates the inset frosted split pane from the paper canvas with ambient and contact depth.
- **Marketing Primary Lift** (`0 14px 28px rgba(73, 48, 181, 0.25), inset 0 1px rgba(255, 255, 255, 0.2)`): gives the 52px Microsoft action a tactile Persuade emphasis; hover increases the diffuse lift.
- **Folding Workspace Lift** (`0 32px 80px rgba(38, 31, 62, 0.2), 0 8px 24px rgba(38, 31, 62, 0.1)`): holds the full illustrative app window above the optical field.
- **Floating Glass Lift** (`0 12px 30px rgba(47, 38, 81, 0.13)`): confined to the hero's small floating state labels.
- **Closing Graphite Lift** (`0 34px 78px rgba(31, 27, 48, 0.22)`): supports the single dark closing volume, not ordinary cards.

### Named Rules
**The Depth-by-Mode Rule.** Operate uses only shallow structural lift; Persuade may use deeper blurred shadows to stage the workbench. Both modes use hairlines and translucent material first, and neither uses hard-offset shadow.

## Shapes

The dominant shape is the 14px iOS squircle. It is set at the MUI theme level and on Ionic buttons, items, cards, chips, icon buttons, inputs, menu links, app panels, glass folds, and the mobile menu trigger. Interactive heights form a compact ladder: 40px for MUI actions, 44px for navigation and compact Ionic actions, 46px for the mobile menu trigger, and 52px for the primary Persuade action.

Smaller radii are subordinate: 11–12px frames identity assets and nested navigation, 8px clips media and code, and the user's message has one 4px tail-side corner. Fully rounded pills are reserved for status/floating labels. Solid paper uses 1px Rule Gray borders; glass uses 1px translucent-white edges; the converter keeps the one dashed material-input border. Every real workspace panel carries a one-pixel violet/cyan/pink top seam inside its 14px frame.

### Named Rules
**The Fourteen-Pixel Rule.** Use 14px for interactive blocks, app workspaces, cards, and navigation. Smaller radii belong only to nested media, code, identity assets, or the directional chat corner.

## Components

### Buttons
- **Operate Primary:** flat Spectral Violet, white text, 40px high, 14px radius, 0 16px padding, weight 680; MUI removes shadows at every state.
- **Persuade Primary:** Spectral Violet, white text, 52px high, 14px radius, 0 19px padding, weight 720, Microsoft mark, arrow, and the Marketing Primary Lift.
- **Hover / Focus:** primary hover deepens to Violet Deep; all focusable controls receive a 3px Violet Focus outline with 2–3px offset.
- **Outlined / Clear:** outlined MUI actions stay flat on paper; the landing's 44px clear sign-in action uses paper glass and a 1px optical border.

### Chips
- **Style:** authenticated chips inherit the 14px shape; filled chips carry explicit values, outlined chips carry secondary metadata.
- **State:** Confirm Green is reserved for real available/ready state.

### Cards / Containers
- **Operate Workspace:** Pure Paper, 14px radius, 1px Rule Gray border, Workspace Panel Lift, and the signature one-pixel spectral top seam.
- **Inner Results:** 14px outlined paper surfaces with no added shadow.
- **Persuade Glass:** 14px translucent paper or graphite planes, 1px translucent edge, 20px backdrop blur, and only the shadow assigned to that staged layer.
- **Internal Padding:** 18px is the standard task-panel/tile inset; 14px is the compact composer/control inset.

### Inputs / Fields
- **Style:** MUI outlined inputs on paper, 14px radius, with inherited Aptos typography.
- **Focus:** shared 3px Violet Focus outline and visible offset, never a color-only change.
- **Material Input:** the converter's large dashed drop zone is the only alternate field silhouette; hover shifts its border to Violet and its surface to Violet Frost.

### Navigation
- **Authenticated Desktop:** a persistent 244px semi-transparent graphite `IonMenu` floats inside a 14px `IonSplitPane` gutter, with a 14px radius, 20px blur, translucent hairline, and Graphite Menu Separation shadow. Links are 44px high, 14px radius, Rail Muted at rest, white over translucent paper on hover, and near-solid Violet when active. A hairline-separated footer keeps the signed-in identity, build number, and explicit logout action visible in normal flow.
- **Authenticated Mobile:** below 761px the same menu becomes a left overlay (`min(86vw, 310px)`) with rounded trailing corners and a fixed 46px frosted trigger. Menu selection closes the overlay through Ionic's native toggle behavior, while the same account footer remains available at the end of the drawer.
- **Marketing:** a sticky 72px paper-glass bar keeps the identity left and sign-in right. Center anchors disappear below 920px; below 640px, secondary brand copy and the action label hide while the marks remain.

### Folding Workspace Stage

The Persuade signature is a complete Prism app window, not a decorative card. Its sidebar selection and working canvas switch together across five tools while the frame remains fixed. Pointer motion is capped at 6–12px translation and 1.6–2.2° tilt; scroll parallax is calculated only to 1600px and rendered through `requestAnimationFrame`. Mobile removes the detached folds and floating labels, and `prefers-reduced-motion` removes transforms and scene animation entirely.

### Brand Asset

The shipped `/apple-touch-icon.png` is the sole Prism identity asset in marketing, illustrative workspace, and authenticated rail lockups. It may scale from 18–68px with an 11–18px clip and soft ambient lift; its internal geometry is not a reusable decoration.

## Do's and Don'ts

### Do:
- **Do** let Spectral Violet lead every interactive hierarchy while cyan and pink stay in low-opacity refraction or the one-pixel workspace seam.
- **Do** use 14px radii across Ionic and MUI controls, navigation, cards, and work surfaces.
- **Do** keep Archivo Variable inside Persuade display roles and keep Aptos across authenticated work, body copy, labels, and controls.
- **Do** preserve the persistent 244px desktop menu, its 14px floating gutter, and the native left-overlay menu below 761px.
- **Do** keep parallax bounded, hardware-accelerated, and absent under `prefers-reduced-motion`.
- **Do** keep the shared 3px Violet Focus outline visible on every keyboard-operable control.

### Don't:
- **Don't** promote cyan or pink to buttons, links, selected states, or semantic status colors.
- **Don't** move Archivo into MUI task workspaces or use it for dense body copy.
- **Don't** turn the mobile workbench navigation into a bottom tab bar; the shipped behavior is a frosted left overlay.
- **Don't** use hard-offset shadows, thick neobrutalist borders, or equal elevation on every card.
- **Don't** replace the Persuade workbench volume with generic feature-card rows.
- **Don't** introduce decorative kicker/eyebrow labels; tracked uppercase remains functional content identity.
