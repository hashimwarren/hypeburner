## Polar hardening workstream

- Issue #57: secure Polar checkout and portal endpoints.
- Issue #58: secure Polar webhook ingestion with idempotent writes.
- Shared validation and observability plan: request schema checks, signature verification tests, and failure budgets.

## API response contract

All Polar routes return JSON with:

- Success: `{ ok: true, code: "OK", ... }`
- Failure: `{ ok: false, code: "<ERR_* code>", message: string, details?: unknown }`

### Error codes used by checkout + portal

- `ERR_POLAR_INVALID_INPUT`: Request shape failed validation.
- `ERR_POLAR_CUSTOMER_NOT_FOUND`: Portal lookup did not resolve a customer.
- `ERR_POLAR_UPSTREAM`: Polar API request failed or returned unusable payload.
- `ERR_POLAR_MISSING_CONFIG`: Required Polar secrets or product config are missing.
- `ERR_POLAR_PROCESSING_FAILED`: Unexpected server failure.

### Error codes used by webhook

- `ERR_POLAR_INVALID_SIGNATURE`: Missing or invalid webhook signature.
- `ERR_POLAR_INVALID_PAYLOAD`: Payload is malformed JSON or missing required event fields.
- `ERR_POLAR_MISSING_CONFIG`: Missing webhook secret.
- `ERR_POLAR_PROCESSING_FAILED`: Event processing failed after signature validation.

## Operational behavior

- Duplicate webhook events are detected by `webhookId` and return `200` with `duplicate: true`.
- Failed webhook processing records an error payload for retry visibility in `polarWebhookEvents`.
