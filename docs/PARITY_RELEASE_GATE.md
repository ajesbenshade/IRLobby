# IRLobby Parity Release Gate

Complete this checklist before any TestFlight or production deployment.

## 1) Required commands (all must pass)

From repo root:

```bash
npm run check:api-contract
npm run check:web
npm run check:mobile
```

Or one command:

```bash
npm run check:release
```

## 2) API contract gate

`check:api-contract` fails when web or mobile reference endpoints that the backend does not route.

- Contract checker: `scripts/check-api-contract.mjs`
- Scan scope:
  - `apps/mobile/src/**`
  - `packages/shared/**`

If this check fails, fix unsupported endpoint usage before you build TestFlight.

## 2b) Web lint debt tracking

Use this command to track and reduce existing web lint debt:

```bash
npm run check:web:lint
```

Lint is tracked separately. The release gate focuses on functional parity and build integrity.

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

### Smoke execution notes

- Validate `Join/leave activity` from the mobile Discover details modal with the explicit **Join** and **Leave** actions.
- On web Discover, validate participation intent through swipe actions and the details flow.
- Capture a short pass/fail record per journey for both platforms before release sign-off.

### Copy/paste smoke template

Use this template in PRs, release notes, or deployment checklists.

```markdown
## Parity Smoke Run

- Date:
- Tester:
- Backend environment:
- Web build/branch:
- Mobile build/branch:

| # | Journey | Web | Mobile | Notes / Defect Link |
|---|---------|-----|--------|----------------------|
| 1 | Register + login + logout | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 2 | Password reset request + completion path | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 3 | Onboarding submit + refresh profile | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 4 | Discover list loads | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 5 | Create activity | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 6 | Join/leave activity | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 7 | Matches list loads | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 8 | Chat list opens + sends message | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 9 | Profile update persists | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |

### Result

- Overall: ☐ PASS ☐ FAIL
- Blocking issues:
  -
- Follow-up tickets:
  -
```

## 4) Release policy

- Do not submit to TestFlight if any required command fails.
- Do not deploy to production if parity smoke is incomplete.
- Any temporary exception requires explicit sign-off and issue tracking.

## 5) CI enforcement

- GitHub Actions workflow: `.github/workflows/release-gate.yml`
- Runs on pull requests to `main` and pushes to `main`
- Requires green status before merge when branch protection marks this check as required

## 5b) Phase 4 strict behavior parity (required)

For each journey in section 3, validate all behavior states below on **both** web and mobile.

### Required behavior states

- Loading state appears while the network request is in progress.
- Empty state appears when the API returns no records.
- Error state appears on a failed request with a user-visible recovery path.
- Retry behavior works (manual action or automatic retry where implemented).
- Session behavior matches (expired or invalid token routes the user to re-auth safely).

### Behavioral parity matrix

Use this matrix during smoke run evidence capture.

| # | Journey | Loading | Empty | Error | Retry | Session | Notes |
|---|---------|---------|-------|-------|-------|---------|-------|
| 1 | Register + login + logout | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 2 | Password reset request + completion path | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 3 | Onboarding submit + refresh profile | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 4 | Discover list loads | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 5 | Create activity | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 6 | Join/leave activity | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 7 | Matches list loads | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 8 | Chat list opens + sends message | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 9 | Profile update persists | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |

### Phase 4 go/no-go criteria

- **GO** only if:
  - `npm run check:release` passes
  - All section 3 journeys pass on web and mobile
  - No open Critical/Core parity defects
  - Behavioral parity matrix has no failed required state
- **NO-GO** if any required command fails, any journey fails, or any required state fails

### Rollback trigger guidance

- Trigger rollback immediately for launch-blocking regressions in auth/session, discover, match/chat, or profile persistence.
- Record the rollback reason, impacted journey/state, and follow-up ticket before the next promotion attempt.

## 6) Parity completion report (2026-02-15)

- Status: parity hardening pass completed for web and mobile
- Delivered scope:
  - Unified chat model on web to match mobile (`/api/messages/conversations/*`)
  - Settings parity added on mobile
  - Friends/Connections parity added on mobile
  - Reviews parity implemented on web and mobile with backend write support
  - Notifications parity implemented on web and mobile
  - Legacy activity-chat drift removed (`client/src/components/chat-window.tsx`)
- Warning cleanup:
  - Updated `baseline-browser-mapping` to latest in both `client` and `apps/mobile`
  - Verified warning no longer appears in web build and mobile bundle output
- Final gate results (local):
  - `npm run check:api-contract` PASS
  - `npm run check:web` PASS
  - `npm run check:mobile` PASS
