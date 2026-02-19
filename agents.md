# Hypeburner High-Level Architecture

```mermaid
flowchart LR
  U[Readers / Subscribers / Admin]

  subgraph Vercel
    W[Next.js 16 App]
    CMS[Payload Admin /cms]
    API[API Routes]
    CRON[Build + Runtime Fetch]
  end

  subgraph Data
    DB[(Neon Postgres)]
  end

  subgraph External Services
    POLAR[Polar API]
    WH[Polar Webhooks]
    RESEND[Resend]
  end

  U -->|Browse site| W
  U -->|Manage content| CMS
  U -->|Checkout / Portal| API

  W -->|Read content| API
  CMS -->|CRUD content| DB
  API -->|Payload local/REST access| DB
  CRON -->|Generate search/tag/rss artifacts| API

  API -->|Create checkout / manage billing| POLAR
  WH -->|POST /api/polar/webhook| API
  API -->|Persist customer/subscription state| DB

  API -->|Send newsletter/contact email| RESEND
```

## Notes

- `Next.js` serves the public pages and the `Payload` admin panel on `/cms`.
- `Payload` uses `Neon Postgres` as the primary content + app data store.
- `Polar` powers checkout, customer portal, and subscription lifecycle webhooks.
- `Resend` handles outbound transactional/email flows.
