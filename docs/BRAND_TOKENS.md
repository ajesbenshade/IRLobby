# IRLobby Brand Tokens — Electric Midnight

Brand direction: Electric Midnight. Dark palette. Rich contrast. Premium accent use.

Core gradient: deep indigo-violet to electric fuchsia. Use electric cyan for energy. Use warm gold for premium moments.

## Palette

| Role | Hex | Usage |
| --- | --- | --- |
| Primary | `#5B4BFF` | Main CTAs, active states, brand marks |
| Primary Deep | `#C026D3` | Gradient end, high-energy, match moments |
| Primary Glow | `#7C6CFF` | Accents and dark mode highlights |
| Secondary / Cyan | `#1EE8FF` | Matches, notifications, live feedback |
| Gold / Premium | `#E8C872` | VIP, paid activities, special moments (use sparingly) |
| Success | `#22C55E` | Positive states |
| Warning | `#F59E0B` | Warnings |
| Danger | `#F43F5E` | Errors / destructive |
| Background (dark) | `#0A0814` | Main dark canvas |
| Surface | `#110D24` / `#161330` | Cards and elevated panels |
| Ink | `#F4F3FA` | Primary text |

## Gradients

- `primary`: `#5B4BFF → #C026D3`
- `match` / high-energy: `#5B4BFF → #C026D3 → #1EE8FF`
- `premium`: `#C026D3 → #E8C872` (use sparingly for VIP moments)

## Source of truth

Shared tokens live in `packages/shared/design-tokens.ts`.

Mobile reads them through `apps/mobile/src/theme/tokens.ts` and NativeWind config.

Web uses HSL CSS variables in `apps/web/src/index.css` and Tailwind.

## Guidance

Use a dark-first layout. Use gold accents for special moments only. Keep the strongest gradients on discovery, matching, celebration, and onboarding. Use calmer surfaces for settings, forms, and moderation.
