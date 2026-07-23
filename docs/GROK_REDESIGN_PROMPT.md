# Grok Redesign Prompt — IRLobby Frontend Aesthetics Overhaul

Copy everything below the line into Grok.

---

You are a senior product designer and frontend engineer. Your task is to dramatically elevate the visual design of **IRLobby**, a social app for discovering real-life activities nearby ("Get out. Get together."). You will restyle three surfaces that share one monorepo:

1. **Mobile app** — React Native (Expo SDK 54), in `apps/mobile`
2. **Web app** — React 18 + Vite + Tailwind 3 + shadcn-style Radix components, in `apps/web` (authenticated app under `/app/*`)
3. **Marketing website** — same `apps/web` project, public routes (landing, features, how-it-works, download, support)

This is a **restyle, not a rewrite**. Do not change business logic, data fetching, routing, navigation structure, API calls, or component props/contracts. Only change visual presentation: styles, tokens, layout polish, motion, and micro-interactions.

## Design direction

Aim for the level of polish of the best consumer social apps. Draw specifically from:

- **Instagram**: restrained chrome that lets content dominate; clean typography hierarchy; subtle use of gradient only for identity moments (stories ring, logo); flat surfaces with hairline dividers.
- **TikTok**: dark-first, immersive full-bleed content; floating translucent controls over content; bold high-contrast type; energy through motion, not decoration.
- **Hinge / Bumble**: warm, human dating-app card design — large rounded photo cards, generous whitespace, one accent color used sparingly, soft shadows, tactile buttons that feel pressable.
- **Airbnb**: card grid discipline, calm neutrals, crisp 8pt spacing rhythm, refined empty states and skeleton loaders.
- **Discord / Linear (for the web app shell)**: modern dark sidebar, subtle glass/blur layering, crisp focus states, keyboard-friendly, smooth 150–250ms transitions everywhere.

The overall feel should be **sleek, modern, dark-first, spacious, and confident**: fewer borders, more breathing room, deliberate color, fluid motion. Avoid: gradient overload, neon-on-everything, heavy drop shadows, dense borders, default Material Design looks.

## Existing brand system (keep and refine — do not replace)

The brand is "Electric Midnight". Canonical tokens live in `packages/shared/design-tokens.ts` and are consumed by both apps. Current values:

- **Primary** `#5B4BFF` (indigo), primaryGlow `#7C6CFF`, primaryDeep `#C026D3` (fuchsia)
- **Secondary** `#1EE8FF` (cyan), secondaryDeep `#0EA5E9`
- **Accent** gold `#E8C872` (premium moments only)
- **Status** success `#22C55E`, warning `#F59E0B`, danger `#F43F5E`
- **Dark canvas**: background `#0A0814`, surfaceMuted `#110D24`, surface `#161330`, lines `#2A2548`/`#3D3659`
- **Text**: ink `#F4F3FA`, muted `#A5A1C2`, soft `#7A7599`
- **Gradients**: primary `[#5B4BFF → #C026D3]`, match `[#5B4BFF → #C026D3 → #1EE8FF]`, premium `[#C026D3 → #E8C872]`
- **Type**: Outfit 400/500/600/700/800; sizes 12/14/16/20/28/36/48; line heights 1.15/1.3/1.5
- **Radii**: 8/12/16/20/28/999 · **Spacing**: 4/8/12/16/24/32/48/64 · **Motion**: 150/250/400ms

Rules for the system:

1. Keep `#5B4BFF` as the single hero color. Use the fuchsia/cyan gradient ONLY for identity moments: logo lockups, match celebration, vibe quiz results, primary CTA on marketing pages. Everything else should be calm surface + ink + one accent.
2. Extend the token file if needed (elevation scale, blur values, semantic aliases) — but every new value must live in `packages/shared/design-tokens.ts` first and be consumed from there. No hardcoded hex in components.
3. Fix known brand drift: splash background, Android adaptive icon background, notification color (`apps/mobile/app.config.ts`), and web `manifest.json` `theme_color` still use legacy `#7C3AED` — update all of them to the Electric Midnight background/primary.
4. Fix web semantic mismatch: in `apps/web/src/index.css`, `--secondary` currently maps to `#C026D3` and `--accent` to `#1EE8FF`, which contradicts the shared palette naming. Realign the CSS variables to match shared token semantics.
5. Both light and dark themes must work. Dark is the flagship; light mode should be a soft off-white (not pure `#FFFFFF`) with the same hierarchy.

## Tech constraints

**Mobile** (`apps/mobile`):
- Styling is React Native `StyleSheet` with tokens from `src/theme/tokens.ts` (re-exports shared tokens + `card`/`float`/`pop` shadows) plus react-native-paper MD3 themes in `src/theme/index.ts`. NativeWind v4 is configured but unused — keep it unused; stay with StyleSheet + tokens.
- Animation: `react-native-reanimated` ~4.1 is installed and already used (VibeQuestionCard, MatchCelebration). `expo-linear-gradient` is used. `lottie-react-native` is installed but unused — you may use it for celebration/empty-state moments if the JSON assets are small.
- Fonts load via `@expo-google-fonts/outfit` in `App.tsx`.

**Web** (`apps/web`):
- Tailwind 3 with CSS-variable color bridge (`tailwind.config.ts`, `src/index.css`), `darkMode: ["class"]` driven by `src/hooks/useTheme.ts`. shadcn-style primitives in `src/components/ui/*` with CVA + `cn` + lucide icons.
- `tailwindcss-animate` and custom keyframes exist (`swipeLeft/Right`, `bounceIn`, `fadeIn`). **framer-motion is NOT installed** — you may add it for the marketing pages and app-shell transitions if bundle impact stays reasonable; otherwise use CSS transitions/keyframes.
- Marketing utilities already exist: `.public-site-bg`, `.public-page-bg`, `.public-text-gradient`, glass cards — refine these rather than duplicating.

## Surfaces to redesign (in priority order)

### Mobile (`apps/mobile/src/screens/`)
1. **Auth**: `auth/LoginScreen.tsx`, `auth/RegisterScreen.tsx` — first impression. Full-bleed brand moment: deep midnight background, logo, one gradient CTA, social buttons (Apple/Google/X) as calm monochrome pills. Hinge-level warmth.
2. **Discover deck**: `main/DiscoverScreen.tsx` — the core loop. Large rounded photo-forward activity cards (Hinge style), floating translucent action buttons, springy Reanimated swipe feedback, refined skeleton (`ActivityCardSkeleton`) and the deck-cleared / quiet-night empty states.
3. **Home**: `main/HomeScreen.tsx` — Tonight snapshot, stats, shortcuts as an Airbnb-calm card grid.
4. **Chat**: `main/ChatScreen.tsx` — iMessage/Instagram-DM cleanliness: bubble contrast, timestamp de-emphasis, composer with soft blur bar.
5. **Profile**: `main/ProfileScreen.tsx` — hero avatar, vibe profile chip with subtle gradient ring (Instagram story-ring inspiration).
6. **Vibe quiz**: `main/vibeQuiz/*` — keep the playful motion; polish option cards, progress, and the results reveal (this is a sanctioned gradient moment).
7. Shared components under `src/components/` that these screens use (buttons, chips, cards, EmptyStatePanel, tab bar styling in navigation).

### Web app (`apps/web/src/`)
1. **AppShell**: `components/layout/AppShell.tsx`, `AppSidebar.tsx`, `TopHeader.tsx`, `RightRail.tsx`, `CommandPalette.tsx` — Linear/Discord-grade shell: slim dark sidebar with active-item pill, blurred sticky header, refined command palette.
2. **Dashboard**: `pages/dashboard.tsx` — greeting, stats, shortcuts as a calm modular grid.
3. **Discovery**: `pages/discovery.tsx` — card deck parity with mobile design language; polished filters, Tonight toggle, empty states.
4. **Chat**: `pages/chat.tsx` — two-pane layout polish, conversation list hover/active states, clean bubbles.
5. **Auth**: `components/auth-form.tsx` — match the mobile auth moment; Google/Apple/X buttons as consistent pills.
6. Remaining `/app/*` pages (activities, connections, notifications, profile, settings) inherit automatically through the ui primitives — update `components/ui/*` (button, card, input, dialog, tabs, badge) so the improvement propagates.

### Marketing website (`apps/web/src/pages/`)
1. **Landing** `landing.tsx` — hero with the match gradient as text/accent (not full-bg), device mockup or product screenshot frame, social proof strip, feature cards with glass treatment, single sticky CTA. TikTok-energy motion on scroll (fade/slide-in), Instagram restraint in color.
2. `features.tsx`, `how-it-works.tsx`, `download.tsx`, support/legal — consistent section rhythm (96–128px vertical), same card language, refreshed footer.

## Quality bar / acceptance criteria

- All spacing on the 4/8pt grid; consistent radii from the token scale (cards 20–28, controls 12–16, pills 999).
- Text contrast meets WCAG AA on both themes; muted text never below 4.5:1 for body copy.
- Every interactive element has hover (web), pressed (mobile), focus-visible, and disabled states.
- Motion: 150ms for micro (hover/press), 250ms for component transitions, 400ms for celebratory moments; respect `prefers-reduced-motion` on web.
- Skeletons and empty states redesigned for every list/deck surface — no raw spinners on primary screens.
- No hardcoded colors in components; everything through tokens/CSS vars.
- `npm run typecheck` and existing tests pass in both `apps/mobile` and `apps/web`; `npm run build:web` succeeds.
- Do not break Playwright e2e selectors (avoid renaming test ids or accessible labels).

## Deliverables

1. Updated `packages/shared/design-tokens.ts` (extended, backward-compatible).
2. Updated mobile theme (`apps/mobile/src/theme/*`) and the screens listed above.
3. Updated web CSS variables/Tailwind config, `components/ui/*` primitives, app shell, listed pages, and marketing pages.
4. Brand-drift fixes (splash/adaptive-icon/notification/manifest colors).
5. A short `docs/DESIGN_SYSTEM.md` describing the final token system and usage rules.

Work in this order: tokens → web ui primitives + shell → mobile core screens (auth, discover) → remaining screens → marketing site → drift fixes → docs.
