# Dogfood Report: Hypeburner

| Field       | Value                                                         |
| ----------- | ------------------------------------------------------------- |
| **Date**    | 2026-02-25                                                    |
| **App URL** | http://localhost:3000                                         |
| **Session** | hypeburner-issue69                                            |
| **Scope**   | Newsletter + Contact flow verification after Resend migration |

## Summary

| Severity  | Count |
| --------- | ----- |
| Critical  | 0     |
| High      | 0     |
| Medium    | 0     |
| Low       | 0     |
| **Total** | **0** |

No new functional regressions were identified in the issue-69 scope during this session.

## Verification Evidence

### Newsletter flow

- Video: dogfood-output/localhost-3000-issue69/videos/newsletter-verification-4.webm
- Screenshots:
- dogfood-output/localhost-3000-issue69/screenshots/newsletter4-step-1-home.png
- dogfood-output/localhost-3000-issue69/screenshots/newsletter4-step-2-email-filled.png
- dogfood-output/localhost-3000-issue69/screenshots/newsletter4-result.png

Observed behavior:

- Submitting newsletter signup without RESEND_AUDIENCE_ID produced the user-facing message: "Newsletter signups are temporarily unavailable. Please try again later." This is explicit and actionable.

### Contact flow

- Video: dogfood-output/localhost-3000-issue69/videos/contact-verification-1.webm
- Screenshots:
- dogfood-output/localhost-3000-issue69/screenshots/contact-step-1-form.png
- dogfood-output/localhost-3000-issue69/screenshots/contact-step-2-filled.png
- dogfood-output/localhost-3000-issue69/screenshots/contact-result.png

Observed behavior:

- Contact submit path executed and API returned friendly server-side fallback messaging for Resend trial-account send restrictions.

## Notes

- Resend MCP server is configured in ~/.codex/config.toml, but this Codex session does not currently expose a
  esend MCP tool namespace (unknown MCP server), so verification used the installed
  esend skill + app runtime behavior.
