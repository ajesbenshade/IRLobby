# IRLobby Parity Release Gate

This checklist is required before any TestFlight or production deployment.

## 1) Required commands (must all pass)

From repo root:

```bash
npm run check:api-contract
npm run check:web
npm run check:mobile
```

Or one-shot:

```bash
npm run check:release
```

## 2) API contract gate

`check:api-contract` fails when web/mobile reference endpoints that are not routed by backend.

- Contract checker: `scripts/check-api-contract.mjs`
- Scan scope:
  - `client/src/**`
  - `irlobby_mobile/src/**`

If this fails, fix unsupported endpoint usage before building TestFlight.

## 2b) Web lint debt tracking

Use this command to track and burn down existing web lint debt:

```bash
npm run check:web:lint
```

Lint is currently tracked separately so the release gate can focus on functional parity and build integrity.

## 3) Manual parity smoke (required)

Run these user journeys on both web and mobile:

1. Register + login + logout
2. Password reset request (and completion path where supported)
3. Onboarding submit + refresh profile
4. Discover list loads
5. Create activity
6. Join/leave activity
7. Matches list loads
8. Chat list opens and sends message
9. Profile update persists

## 4) Release policy

- No TestFlight submit if any required command fails.
- No production deploy if parity smoke is incomplete.
- Any temporary exception requires explicit sign-off and issue tracking.

## 5) CI enforcement

- GitHub Actions workflow: `.github/workflows/release-gate.yml`
- Runs on pull requests to `main` and pushes to `main`.
- Requires green status before merge when branch protection marks this check as required.
