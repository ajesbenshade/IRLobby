## Parity Smoke Run

- Date: 2026-02-15
- Tester: pending
- Backend environment: pending
- Web build/branch: pending
- Mobile build/branch: pending

### Automated gate evidence

- `npm run check:api-contract` PASS
- `npm run check:release` PASS
  - `check:web` PASS
  - `check:mobile` PASS

### Journey parity checklist

| # | Journey | Web | Mobile | Notes / Defect Link |
|---|---------|-----|--------|----------------------|
| 1 | Register + login + logout | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 2 | Password reset request + completion path | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 3 | Onboarding submit + refresh profile | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 4 | Discover list loads | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | Visual parity updates applied: header copy, empty-state guidance, and retry affordance. Manual screenshot pair needed. |
| 5 | Create activity | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 6 | Join/leave activity | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 7 | Matches list loads | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 8 | Chat list opens + sends message | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | |
| 9 | Profile update persists | ☐ Pass ☐ Fail ☐ N/A | ☐ Pass ☐ Fail ☐ N/A | Visual parity updates applied: action labels, section hierarchy, and profile state wording. Manual screenshot pair needed. |

### Phase 4 behavioral parity matrix

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

### Phase 4 visual parity matrix

| # | Journey | Hierarchy | Actions | Status UI | Spacing | Empty/Error visuals | Meta visibility | Notes |
|---|---------|-----------|---------|-----------|---------|---------------------|-----------------|-------|
| 1 | Register + login + logout | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 2 | Password reset request + completion path | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 3 | Onboarding submit + refresh profile | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 4 | Discover list loads | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 5 | Create activity | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 6 | Join/leave activity | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 7 | Matches list loads | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | |
| 8 | Chat list opens + sends message | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | Verify: header title + subtitle visible, sender name above message body, timestamp rendered, retry action shown on forced error, and send button prominence matches. |
| 9 | Profile update persists | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | ☐ W ☐ M | Verify: section order is profile info → editable fields/stats → navigation/actions, "Connections" naming matches, save/refresh visibility matches, and destructive sign-out/account-delete copy emphasis is equivalent. |

### Go / No-Go

- Overall: ☐ GO ☐ NO-GO
- Blocking issues:
  -
- Follow-up tickets:
  -
- Release approver:
- Approval timestamp:

### Rollback decision log (if needed)

- Triggered: ☐ Yes ☐ No
- Trigger reason:
- Impacted journey/state:
- Rollback action taken:
- Owner:
