---
version: 1
slug: "src-auth-authboundary-tsx"
primary_target: "src/auth/AuthBoundary.tsx"
related_targets: ["src/auth/LandingPage.tsx","src/auth/LandingPage.css","src/app/App.tsx","src/main.tsx"]
---

# Prism login landing

## Scope and mode

Persuade surface for `src/auth/AuthBoundary.tsx`. It replaces the unauthenticated card only; authenticated feature behavior and product truth remain intact. The authenticated frame gains an Ionic iOS split-view shell without migrating its MUI workspaces.

## Audience, job, and action

The authenticated owner needs to recognize Prism as the private AI workbench that gathers durable conversations, cross-provider comparison, image workflows, reusable prompts, confirmed media actions, and browser-only workbook conversion. The primary action is **Continue with Microsoft**. Recovery uses the same surface with explicit session-refresh messaging.

## Direction

**The Folding Workspace.** One complete glass app window occupies the hero and reconfigures in place as the visitor scrolls through Assistant, Model Lab, Image Lab, Prompts, and Converter. Spectral violet, cyan, and pink refractions come from the existing mark; graphite glass and bright paper retain the established product identity. Scroll changes the work surface rather than presenting generic feature cards.

## Memorable moment

The hero's layered app planes separate with pointer and scroll parallax, then resolve into a sticky workspace whose sidebar selection and working canvas transform together across five real product scenes.

## Constraints

- Force Ionic React to `mode: 'ios'`.
- Desktop uses a persistent frosted `IonMenu` in an `IonSplitPane`; narrow screens use its native overlay menu.
- Sidebar glass uses a semi-transparent graphite fill, 1px translucent border, `backdrop-filter: blur(20px)`, and `-webkit-backdrop-filter: blur(20px)`.
- Navigation hover fill is `rgba(255, 255, 255, 0.15)` with `background 0.2s ease-in-out`.
- Interactive blocks, items, cards, and app workspaces use 14px iOS squircle radii.
- Motion is hardware accelerated, bounded, and removed under `prefers-reduced-motion`.
- No invented prices, customers, benchmarks, or capabilities.

## Implementation inventory

| Ingredient | Medium | Commitment |
| --- | --- | --- |
| Sticky glass marketing navigation | Semantic HTML + Ionic button | Brand left, Microsoft action right |
| Hero headline and action | Semantic HTML + Ionic button | Offer and login visible immediately |
| Layered hero app mockup | Semantic HTML/CSS | Complete sidebar, chat, model comparison, composer, status chrome |
| Parallax refraction field | CSS + requestAnimationFrame | Pointer and scroll depth; no content dependency |
| Reconfiguring workflow stage | React state + IntersectionObserver + semantic HTML/CSS | Five real tools, one fixed app footprint |
| Trust principles | Semantic definition list | Durable work, explicit capability state, preview before mutation |
| Closing login control | Ionic button | Repeats the real Microsoft action |
| Product icon | Existing `/apple-touch-icon.png` asset | Used in the marketing and app-shell lockups |

## Unresolved decisions

None.
