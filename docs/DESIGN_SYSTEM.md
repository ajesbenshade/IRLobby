# IRLobby design system

Electric Midnight is the IRLobby visual system. Use it for the mobile app, web app, and marketing site.

## Source of truth

Canonical tokens live in `packages/shared/design-tokens.ts`.

- Mobile re-exports them from `apps/mobile/src/theme/tokens.ts`.
- Web maps them to CSS variables in `apps/web/src/index.css` and Tailwind in `apps/web/tailwind.config.ts`.

Do not hardcode hex colors in components. Add a token first. Then consume it.

## Palette

| Role | Token | Hex | Use |
| --- | --- | --- | --- |
| Hero | `primary` | `#5B4BFF` | Primary buttons, links, focus rings |
| Brand deep | `primaryDeep` / `primary-deep` | `#C026D3` | Identity gradients only |
| Energy | `secondary` | `#1EE8FF` | Live / match / energy accents |
| Premium | `accent` | `#E8C872` | VIP / premium moments only |
| Canvas | `background` | `#0A0814` | Dark flagship background |
| Surface | `surface` / `card` | `#161330` / `#110D24` | Cards and panels |
| Text | `ink` | `#F4F3FA` | Primary copy on dark |
| Muted text | `mutedInk` | `#A5A1C2` | Secondary copy |

Light theme uses soft off-white surfaces (`lightBackground` `#F7F6FB`), not pure white.

## Gradients

Use gradients only for identity moments:

- Logo lockups
- Match celebration
- Vibe quiz results
- Primary marketing CTA

Brand gradient: `#5B4BFF` → `#C026D3` (web: `from-primary to-primary-deep`).

Match gradient may add cyan: `#5B4BFF` → `#C026D3` → `#1EE8FF`.

## Type

Font: Outfit 400 / 500 / 600 / 700 / 800.

Sizes: 12 / 14 / 16 / 20 / 28 / 36 / 48.

## Space, radius, motion

- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64
- Radii: 8 / 12 / 16 / 20 / 28 / pill
- Motion: 150ms micro, 250ms component, 400ms celebration
- Respect `prefers-reduced-motion` on web

## Elevation

Shared elevation recipes: `soft`, `card`, `float`, `pop`.

Prefer hairline borders plus soft shadows. Avoid heavy multi-layer shadows.

## Component rules

- Cards: radius 20–28, quiet border, soft shadow
- Controls: radius 12–16
- Pills: full round
- Secondary buttons/badges: muted surface, not neon fills
- Social auth buttons: outline / glass pills

## Do not

- Replace Electric Midnight with a new palette
- Use legacy `#7C3AED`
- Flood screens with gradients
- Mix light pastel fills on the dark canvas
