# Taana

Taana is a multi-store commerce platform for independent saree houses. One codebase serves many sellers. Each store has its own catalogue, theme, orders, customers, and staff. There is no combined marketplace.

## Decisions for this release

- One shared deployment, with data isolated by store.
- Storefront URLs are `/s/{slug}`. A platform subdomain is stored for each store (`{slug}.taana.test`) so a host map can be added later.
- Currency is INR, stored as paise. Language is English.
- India launch: cash on delivery, plus a demo payment desk that signs webhooks and never collects card or UPI secrets.
- Shipping is manual, with PIN-prefix serviceability and a flat rate that becomes free over a threshold.
- Instagram uses a manual gallery. Official Meta connect stays closed until `META_APP_ID` and `META_APP_SECRET` are set. The app never asks for an Instagram password.
- Seller alerts are an in-app inbox plus an email log. Browser push is not the only channel.
- One stock location per store. Colour variants have their own SKU and stock.
- Staff roles: owner, manager, catalogue, orders, content.
- The database in development is SQLite through Prisma, so the app runs without a separate server. Production should point `DATABASE_URL` at PostgreSQL; the schema avoids provider-specific types.

## Run

```bash
npm install
npm run setup
npm run dev
```

Open http://localhost:3000.

Demo password for every account: `SareeDemo!2026`

| Who | Email |
| --- | --- |
| Platform admin | platform@taana.test |
| Varanasi Weave House owner | meera@varanasiweave.test |
| Varanasi order manager | ravi@varanasiweave.test |
| Kanjeevaram Atelier owner | lakshmi@kanjeevaram.test |
| Customer | ananya@example.com |

Varanasi already has order VW-1001 waiting to be confirmed.

## Checks

```bash
npm test
npm run typecheck
```
