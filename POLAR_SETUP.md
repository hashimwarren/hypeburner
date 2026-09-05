# Polar setup

Configured on September 5, 2026 for Hypeburner using Next.js App Router and `@polar-sh/sdk` directly.

This integration uses **live Polar production**, not the sandbox. The Polar account currently shows **test mode** in hosted checkout; finish the account's onboarding before accepting paid orders. Free products and 100% discount orders are available for testing.

## Routes

- `GET /checkout?products=<product-id>` creates a checkout and sends a non-cacheable 302 redirect to Polar. Repeat `products` to offer multiple products. Missing or invalid UUIDs return 400.
- `POST /api/webhook/polar` is the registered endpoint. It verifies the untouched request body and the `webhook-id`, `webhook-timestamp`, and `webhook-signature` headers with `validateEvent`. Invalid signatures return 403; invalid signed payloads return 400; missing configuration returns 503.
- `order.paid` and `customer.state_changed` have TODO handlers only. They acknowledge valid events without granting access or writing to the database. Add delivery deduplication using `webhook-id` when implementing fulfillment.

Polar provides the hosted payment confirmation. No custom success URL or confirmation page was added.

Polar's customer portal is already hosted by Polar, and customers receive its link by email. No new portal route or Manage billing link was added.

Existing `/api/polar/*` endpoints and their database logic remain separate legacy code. This setup registers only `/api/webhook/polar`; it does not migrate or connect the legacy billing flows.

## Environment

The Git-ignored `.env` contains these keys (values intentionally omitted):

- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_SERVER`

The existing credential entries were consolidated from `.env.local` into `.env` so they do not shadow the saved credentials. Product mapping entries in `.env.local` remain unchanged. The new checkout uses its product query parameter.

Next.js loads the environment files. The SDK client validates its configuration on first use, is reused, and limits API requests to 10 seconds. Changing the selected Polar environment requires the corresponding credentials/products and restarting the app.

## Provisioned resources

Organization: `hypeburner` (`4ea0bfec-8f47-4732-9346-8f0595e6bae6`). Existing active products were reused; no Test Product was created.

| Resource             | ID                                     | Details                                                                       |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------------------- |
| Monthly subscription | `9d0e656b-96ef-4d38-860e-304729079c84` | $9.97/month; used for the first checkout                                      |
| Annual subscription  | `56023612-bed2-43e5-9072-b8bbd5814d69` | $97/year                                                                      |
| Webhook endpoint     | `a8c3a19f-48fb-46d7-a612-59038aaf9401` | `https://hypeburner.com/api/webhook/polar`; raw format; both requested events |
| Test discount        | `a6011dce-b66e-4e1a-8567-599fb4659adb` | 100%; monthly product only; one redemption                                    |

The webhook signing secret was saved directly to `.env` without displaying it.

## Try checkout

From the Hypeburner project directory, start the app:

```sh
corepack yarn dev
```

Open [the monthly checkout](http://localhost:3000/checkout?products=9d0e656b-96ef-4d38-860e-304729079c84).

Enter the test discount code from the private setup handoff in Polar's discount field. The plain checkout link does not pre-apply a discount. The code permits one redemption and expires for new redemptions on **September 12, 2026 at 18:34 UTC**. Its discount duration is forever, so the test subscription also remains free on renewal. Keep the live code out of this public repository.

A checkout was successfully created through the SDK, and applying this code in the browser showed **$0/month**. No order was submitted and no customer subscription was created by this setup.

## Files changed

- `lib/polar/client.ts`: reusable SDK client and configuration checks.
- `app/checkout/route.ts`: product-driven checkout redirect.
- `app/api/webhook/polar/route.ts`: SDK signature verification and TODO handlers.
- `__tests__/api/polar-sdk-routes.test.ts`: real signed webhook fixtures and checkout/error tests.
- `__tests__/api/polar-routes.test.ts`: corrected constructor typing and module scope so the existing tests typecheck.
- `package.json` and `yarn.lock`: SDK dependency. The existing npm lockfile was not regenerated; CI and this project use Yarn.
- `package.json`: the postbuild command now explicitly uses production mode, preventing Payload's development schema-sync prompt during builds. An initial build's proposed table deletions were not approved.
- `.gitignore`, `.env` (ignored), `.env.local` (ignored), and `.env.example`: environment setup and template.
- `README.md` and `POLAR_SETUP.md`: setup and handoff instructions.

Stale generated Next.js types were removed and regenerated during verification; no source routes were removed.

## Verify before merging

- [x] Production token verified with an authenticated products request.
- [x] Full TypeScript check passed.
- [x] All 29 Polar tests passed (18 new SDK tests and 11 legacy tests).
- [x] SDK checkout creation succeeded; the hosted checkout accepted the discount and showed $0/month.
- [x] Full production build, including the corrected postbuild command, completed successfully.
- [x] Reviewed the integration files for credential exposure; credentials remain in ignored environment files.
- [x] Checkout and webhook TODO handlers match the requested setup scope; paid orders do not grant app access yet.

## Deployment remains required

The source changes and secrets have **not been deployed**. The endpoint is registered in Polar, but delivery cannot succeed until the site serves the new route with the matching secret.

1. Configure the three Polar environment keys in the Hypeburner production deployment using their local values securely.
2. Deploy a server-backed Next.js build with both new routes available publicly.
3. Finish any remaining Polar account onboarding before accepting real charges.
4. Verify a free checkout and confirm both webhook deliveries receive HTTP 200 in Polar; replay any deliveries missed before deployment.

References: [Polar integration guide](https://raw.githubusercontent.com/polarsource/skills/main/skills/polar-integration/SKILL.md), [webhook delivery](https://polar.sh/docs/integrate/webhooks/delivery), and [customer portal](https://polar.sh/docs/features/customer-portal/introduction).
