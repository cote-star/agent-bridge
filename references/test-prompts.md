# Inter-Agent Bridge Test Prompt Suite

Use these prompts to validate behavior quality across modes and failure conditions.

## How to Use

1. Pick one prompt.
2. Replace placeholder session IDs and paths.
3. Run the same prompt on different coordinating agents.
4. Compare whether verdict, risks, and next actions converge.

## Prompt 1: Basic Verify (Coding Task)

```md
Mode: verify
Task: Validate whether the login rate-limiter implementation is production-ready.
Success Criteria:
- Handles bursts correctly
- No regression in existing auth tests
- No hardcoded secrets
Sources:
- codex session_id=019c3bf0-d21c-7e41-9b28-2aa269ae2133
- gemini session_id=eadc3136-464d-4d86-9d9c-ee76161e5cf1
- claude session_id=355364b7-96ed-4127-ae5d-061ef2087c0c
Constraints:
- Keep API backwards compatible
- No new external dependencies
Return using the Universal Inter-Agent Coordinator Protocol.
```

## Prompt 2: Steer Conflicting Plans

```md
Mode: steer
Task: Deliver a migration from REST endpoint v1 to v2 in one release window.
Success Criteria:
- Zero downtime
- Rollback plan present
- Monitoring and alerting included
Sources:
- codex current_session=true cwd=/Users/e059303/sandbox
- gemini current_session=true cwd=/Users/e059303/sandbox
- claude session_id=355364b7-96ed-4127-ae5d-061ef2087c0c
Constraints:
- 2 engineer-days max
- Must support staged rollout
Resolve conflicts and output an ordered plan with owner per step.
```

## Prompt 3: Analyze Root Cause From Divergent Debugging

```md
Mode: analyze
Task: Determine root cause of intermittent CI test hangs.
Success Criteria:
- Identify most likely root cause
- Provide disambiguation tests
- Provide containment fix and long-term fix
Sources:
- codex session_id=<codex-session-uuid>
- gemini session_id=<gemini-session-uuid>
- claude session_id=<claude-session-uuid>
Constraints:
- No flaky retry-only workaround
Focus on contradictions between sources and confidence levels.
```

## Prompt 4: Feedback Quality Gate (Planning Doc)

```md
Mode: feedback
Task: Critique the implementation plan for multi-tenant billing support.
Success Criteria:
- Risks and missing assumptions identified
- Compliance/security gaps highlighted
- Concrete plan improvements listed
Sources:
- codex current_session=true cwd=/Users/e059303/sandbox
- gemini current_session=true cwd=/Users/e059303/sandbox
Constraints:
- Keep feedback concise and impact-ranked
Use P0-P3 findings with evidence tags.
```

## Prompt 5: Missing Source Robustness

```md
Mode: verify
Task: Validate cache invalidation patch.
Success Criteria:
- Correctness
- Test coverage
Sources:
- codex session_id=<valid-codex-uuid>
- gemini session_id=<invalid-or-missing-id>
- claude current_session=true cwd=/Users/e059303/sandbox
Constraints:
- Do not guess missing data
Expected behavior: continue with available sources and explicitly report missing source impact.
```

## Prompt 6: Session Mismatch Detection

```md
Mode: analyze
Task: Explain why two agents disagree on schema change safety.
Success Criteria:
- Confirm whether sessions refer to same codebase/cwd
- Distinguish evidence vs speculation
Sources:
- codex session_id=<uuid-from-repo-A>
- gemini session_id=<uuid-from-repo-B>
- claude session_id=<uuid-from-repo-A>
Constraints:
- Must detect cross-repo mismatch before technical conclusions
```

## Prompt 7: Security-Sensitive Review

```md
Mode: verify
Task: Assess OAuth callback handler changes for security readiness.
Success Criteria:
- State validation covered
- Redirect URI validation covered
- Sensitive logs redacted
Sources:
- codex session_id=<codex-uuid>
- claude session_id=<claude-uuid>
Constraints:
- High-stakes review: conservative verdict required
Output must include explicit residual risk statement.
```

## Prompt 8: Large-Task Steering Under Time Pressure

```md
Mode: steer
Task: Ship hotfix for payment webhook idempotency failure today.
Success Criteria:
- Prevent duplicate charges
- Include minimal safe tests
- Deploy and monitor plan included
Sources:
- codex current_session=true cwd=/Users/e059303/sandbox
- gemini current_session=true cwd=/Users/e059303/sandbox
- claude current_session=true cwd=/Users/e059303/sandbox
Constraints:
- 4-hour delivery window
- Prioritize safety over elegance
Return only steps that can complete in window.
```

## Prompt 9: Meta-Consistency Check

```md
Mode: feedback
Task: Evaluate whether agent reasoning quality is improving across 3 iterations.
Success Criteria:
- Compare iteration N, N+1, N+2 objectively
- Identify repeated blind spots
- Recommend one process change per agent
Sources:
- codex session_id=<iter1>
- codex session_id=<iter2>
- codex session_id=<iter3>
- gemini session_id=<iter1>
- gemini session_id=<iter2>
- gemini session_id=<iter3>
Constraints:
- No vague feedback; evidence for each claim required
```

## Prompt 10: Final Sign-Off Gate

```md
Mode: verify
Task: Decide go/no-go for production deploy of feature flag cleanup.
Success Criteria:
- All acceptance criteria met
- Rollback path validated
- Observability checks present
Sources:
- codex session_id=<codex-uuid>
- gemini session_id=<gemini-uuid>
- claude session_id=<claude-uuid>
Constraints:
- If any P0 unresolved, must return NO-GO
Return verdict as GO or NO-GO, then required actions.
```

## Scoring Checklist

Score each run from 0 to 2:

- Correctly used requested mode
- Cited evidence per claim
- Flagged contradictions/gaps
- Produced actionable next actions
- Avoided hallucinating missing source details
- Kept structure consistent

Target: 10+ indicates strong coordinator behavior.
