# SORTEK CRM platform handoff

## Scope and topology

SORTEK CRM is a public MIT fork of `trycompai/crm`, pinned initially to
`6d4793dd6d7aeea91aa6a034e00b17d7408a2d08`. It is a separate product from the
SORTEK landing and the existing prospecting dashboard. Neither of those codebases
nor their database schemas are reused here.

| Service | Intended hostname | Responsibility |
| --- | --- | --- |
| Web app | `crm.sortek.io` | Authenticated CRM console |
| Private API | `api.crm.sortek.io` | API, auth, n8n and ticketing ingress |
| Database | Dedicated Supabase Postgres project | All CRM data and Prisma migrations |

Use two Vercel projects (suggested names: `sortek-crm-app` and `sortek-crm-api`)
and one new, dedicated Supabase project. Do not point either project at the
existing Sortek dashboard database.

## Workspace model

Better Auth's `Organization`, `Member` and `Invitation` records are the workspace
boundary. Every new platform CRM model includes `organizationId` and every browser
query verifies membership before reading or writing it.

- `PLATFORM_ADMIN` is a SORTEK global administrator. Only this role can create or
  suspend client businesses.
- A workspace owner/admin manages members for that workspace. Operators only see
  the workspaces to which they belong.
- Creating a business creates an empty workspace and either assigns its initial
  admin immediately or sends an invitation when that user does not yet exist. It
  never copies Goza data, stages, integrations or automations.
- Contacts deduplicate only on `(organizationId, phoneNormalized)`: the same phone
  can legitimately exist in two different businesses.

The first business is **Goza Europa**. Activate its optional `WHATSAPP`, `EVENTS`
and `TICKETING` feature flags after it exists, then create these initial stages in
order: `Nuevo`, `Contactado`, `Interesado`, `Enlace enviado`, `Seguimiento`,
`Comprado`, `Perdido`. Mark the final two as closed. New workspaces receive none
of this configuration automatically.

## First production setup

1. Create the dedicated Supabase project and use a pooled runtime `DATABASE_URL`.
   If it is pooled, also set a direct `DIRECT_DATABASE_URL` (or
   `POSTGRES_URL_NON_POOLING`) for Prisma migration deployment.
2. Configure `API_URL=https://api.crm.sortek.io`, `APP_URL=https://crm.sortek.io`
   and `AUTH_COOKIE_DOMAIN=.sortek.io`, as well as `BETTER_AUTH_SECRET`, a
   restrictive `ALLOWED_SIGN_IN`, and one completed Google or Microsoft OAuth
   client configuration. Add `SORTEK_INTEGRATION_KEY` only to API/n8n secret
   stores.
3. Review the committed `20260904100403_sortek_multitenant_platform` migration
   (generated and applied against an empty local Postgres database), then deploy
   it through the normal Prisma deployment path. Apply it only to the new
   dedicated CRM project, never to an existing Sortek database.
4. After the first SORTEK user has signed in, promote exactly that account once:

   ```sql
   UPDATE "user"
   SET "platformRole" = 'PLATFORM_ADMIN'
   WHERE "email" = 'admin@sortek.io';
   ```

5. The platform administrator opens **Negocios**, creates Goza Europa and enters
   the first workspace admin's email. Finish Goza's stages and feature flags by
   hand before importing operational data.

Local code generation and type validation use a disposable local connection:

```bash
bun run db:generate
bun run --filter=api trpc:generate
bun run check-types
```

Use `bun run db:migrate` only against a local development database: its guard
intentionally rejects non-local targets. Production uses the reviewed migration
with `bun run db:deploy`.

## Private integration contracts

All requests below require this header, stored in n8n as a Header Auth credential:

```text
x-sortek-integration-key: <SORTEK_INTEGRATION_KEY>
```

The frontend never receives this value. Requests with absent/invalid credentials
are rejected. Payloads are retained in the immutable activity/integration ledger.

### WhatsApp mirror

`POST /integrations/whatsapp/events` accepts provider events from n8n/YCloud.
Its required fields are `organizationId`, `externalEventId`, `conversationId`,
`providerMessageId`, `direction` (`INBOUND` or `OUTBOUND`), `phone`, and
`occurredAt` (ISO date-time). `contactName`, `body`, `kind` and `payload` are
optional. The pair `(organizationId, provider="ycloud", externalEventId)` makes
the endpoint idempotent. An inbound event reopening a closed conversation records
a reactivation and preserves the prior history.

### Approved follow-up delivery

`POST /integrations/follow-ups/claim` accepts `{ organizationId, limit? }` and
atomically claims only follow-ups that are due and have both
`approvedToContact=true` and `approvedToSend=true`. n8n must send one WhatsApp
only for each returned item.

After the provider responds, n8n calls `POST /integrations/follow-ups/result`
with `organizationId`, `followUpId`, `status` (`SENT` or `FAILED`), and optional
`providerMessageId` / `failureReason`. This is deliberately a two-step protocol:
the CRM schedules and audits; n8n is the sender.

### Ticketing webhook

`POST /integrations/ticket-orders` accepts `organizationId`, `externalId`,
`phone`, `quantity`, `amountCents`, `currency`, and `status`, plus optional
`contactName`, `eventId`, `paidAt`, and `payload`. The pair
`(organizationId, externalId)` is idempotent. Until a ticketing provider exists,
orders may be recorded manually through the CRM interface.

## n8n handoff (not activated)

No workflow JSON is committed because this workspace has no connected n8n instance
to validate node versions or credentials. Before creating/importing a workflow,
inspect node types in that instance, create credentials in n8n's credential store,
validate connections and run fixed-data tests. Do not activate any workflow or send
real messages without explicit authorization.

1. **WhatsApp sync:** verify the YCloud webhook signature first; map inbound and
   outbound provider events to the WhatsApp mirror endpoint; use an error branch
   for structured 4xx/5xx responses and retain the provider event ID for retries.
2. **Follow-up sender:** on a schedule, call `follow-ups/claim` for one workspace,
   loop through claimed entries, send through the YCloud credential, then call
   `follow-ups/result` for every success or failure. It must never send an
   unclaimed or unapproved record.
3. **Ticketing:** validate the future provider webhook, forward the normalized
   order to `ticket-orders`, and use the provider order ID as `externalId`.

The exact workflow configuration is documented in
[automations/n8n/README.md](../automations/n8n/README.md).

## Required verification before launch

- Cross-workspace attempts to read contacts, conversations, calls, opportunities,
  follow-ups, events and orders must fail.
- Test contact deduplication in the same workspace and allow the same phone in a
  different one.
- Replay WhatsApp and ticketing webhooks; each must produce a single business
  record. Test a closed conversation reopening.
- Run two concurrent follow-up claims; only one may receive a given item.
- Verify stage changes, manual sale entry and aggregate SORTEK metrics with fixed
  Goza data before using production traffic.
