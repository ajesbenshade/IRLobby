# IRLobby Brand Tokens — Electric Midnight

Darker, richer, more premium direction ("Electric Midnight").

Core gradient: deep indigo-violet → electric fuchsia with electric cyan for energy and warm gold for premium moments.

## Palette

| Role | Hex | Usage |
| --- | --- | --- |
| Primary | `#5B4BFF` | Main CTAs, active states, brand marks |
| Primary Deep | `#C026D3` | Gradient end, high-energy, match moments |
| Primary Glow | `#7C6CFF` | Accents and dark mode highlights |
| Secondary / Cyan | `#1EE8FF` | Matches, notifications, live feedback |
| Gold / Premium | `#E8C872` | VIP, paid activities, special moments (used sparingly) |
| Success | `#22C55E` | Positive states |
| Warning | `#F59E0B` | Warnings |
| Danger | `#F43F5E` | Errors / destructive |
| Background (dark) | `#0A0814` | Main dark canvas |
| Surface | `#110D24` / `#161330` | Cards and elevated panels |
| Ink | `#F4F3FA` | Primary text |

## Gradients

- `primary`: `#5B4BFF → #C026D3`
- `match` / high-energy: `#5B4BFF → #C026D3 → #1EE8FF`
- `premium`: `#C026D3 → #E8C872` (used sparingly for VIP moments)

## Source Of Truth

Shared tokens live in `packages/shared/design-tokens.ts`.

Mobile pulls from there via `apps/mobile/src/theme/tokens.ts` + NativeWind config.

Web uses HSL CSS variables in `apps/web/src/index.css` + Tailwind.

## Guidance

Dark-first, rich, premium feel. Strong use of the new gold accent for special moments. Keep the strongest gradients on discovery, matching, celebration, and onboarding. Use calmer surfaces for settings, forms, and moderation.
