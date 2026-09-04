# n8n deployment handoff for SORTEK CRM

These are integration specifications, not active workflows. The current project has
no attached n8n instance, so no workflow export is safe to generate or import until
the target's node types and credentials are inspected.

## Credentials

- Create one **Header Auth** credential with header name
  `x-sortek-integration-key` and the API's `SORTEK_INTEGRATION_KEY` value.
- Create the YCloud credential in n8n's credential store. Do not place either
  secret in a workflow JSON export or in this repository.
- Store the ticketing provider credential separately when that integration exists.

## Workflow A: YCloud conversation mirror

1. Receive the YCloud webhook and verify its provider signature before any CRM
   call.
2. Normalize the phone, event ID, message ID, conversation ID, direction and
   occurred-at timestamp.
3. `POST https://api.crm.sortek.io/integrations/whatsapp/events` with Header Auth.
4. Treat a 202 response as accepted; safely retry transient failures with the same
   `externalEventId`. Send malformed/unauthorized events to an error path rather
   than retrying them forever.

The CRM is a read-only mirror: this workflow records both inbound and human-sent
outbound messages but does not accept browser-originated sending.

## Workflow B: approved follow-up delivery

1. Trigger on a controlled schedule and call
   `POST https://api.crm.sortek.io/integrations/follow-ups/claim` for one explicit
   `organizationId`.
2. Loop only over the returned records. Each was due, approved for contact and
   approved for sending when atomically claimed.
3. Send the WhatsApp through YCloud, then call
   `POST https://api.crm.sortek.io/integrations/follow-ups/result` with `SENT`
   and the provider message ID, or `FAILED` and a short failure reason.
4. Route every unexpected error through n8n's error workflow. Do not retry a
   provider send without a clear idempotency guarantee from YCloud.

Do not activate the workflow, or send messages to real people, until the workspace
owner has explicitly approved the test and delivery rollout.

## Workflow C: future ticketing ingestion

Validate the ticketing webhook, normalize its external order ID, contact, event,
quantity, monetary amount, currency, status and date, then call
`POST https://api.crm.sortek.io/integrations/ticket-orders` with Header Auth.
Until then, operations can enter sales manually.
