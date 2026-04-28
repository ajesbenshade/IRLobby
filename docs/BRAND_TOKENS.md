# IRLobby Launch Brand Tokens

IRLobby's launch palette is anchored on a purple-to-pink primary gradient with cyan for social feedback moments.

## Palette

| Role | Hex | Usage |
| --- | --- | --- |
| Primary | `#7C3AED` | Main CTAs, active navigation, focus rings, core brand marks |
| Primary deep / pink | `#EC4899` | Gradient end stop, hover accents, match celebration energy |
| Primary soft | `#F1E8FF` | Soft selected states and subtle brand surfaces |
| Primary glow | `#A78BFA` | Dark-mode highlights and elevated accents |
| Secondary cyan | `#22D3EE` | Matches, notifications, live/social feedback |
| Success | `#84CC16` | Positive state and completion feedback |
| Warning | `#F59E0B` | Warnings, pending states, rating/star semantics |
| Danger | `#F43F5E` | Errors, destructive actions, safety warnings |
| Light background | `#F8FAFC` | App canvas and muted surfaces |
| Dark background | `#0F172A` | Dark-mode app canvas and public-site base |

## Gradient

Use `#7C3AED -> #EC4899` as the default brand gradient. Use `#7C3AED -> #EC4899 -> #22D3EE` for match, celebration, and high-energy moments.

## Source Of Truth

Shared launch tokens live in `packages/shared/design-tokens.ts`.

Mobile consumes those through `apps/mobile/src/theme/tokens.ts` and maps them into React Native Paper in `apps/mobile/src/theme/index.ts`.

Web consumes the same palette through CSS variables in `apps/web/src/index.css` and Tailwind semantic colors in `apps/web/tailwind.config.ts`.

## Launch Guidance

Keep workflow surfaces dense and readable. Use the strongest gradients for primary CTAs, match moments, discovery cards, onboarding, and the Vibe Quiz. Keep settings, moderation, legal, and form-heavy screens calmer, using semantic tokens instead of decorative color.
