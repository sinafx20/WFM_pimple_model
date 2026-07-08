---
name: project-integration-state
description: "Current state of the HubSpot-to-Pylon integration — what's built, what's configured, and what's still pending"
metadata: 
  node_type: memory
  type: project
  originSessionId: 390ba7f8-bcdb-4c5c-ac36-a36f039bd54e
---

## HubSpot ↔ Pylon Integration — working directory: `c:\Users\SinaZarei\Hubspot-to-Pylon-integration`

Full scaffold is built and committed (initial commit). The integration covers three flows:

1. HubSpot deal hits "System designed / ready to quote" → creates a Pylon solar project with deal + contact data
2. Pylon `proposals.shared` (quote sent) → moves HubSpot deal to "Quote Sent"
3. Pylon `web_proposals.signed` (deal accepted) → moves HubSpot deal to "Closed Won"

Stack: Fastify server, BullMQ + Redis queue, PostgreSQL for deal↔project link table and audit log, deployed on Railway.

---

## HubSpot configuration — DONE

All three stage IDs confirmed via API and written to `.env`:

| Env var | Value | Label |
|---|---|---|
| `HUBSPOT_PIPELINE_ID` | `default` | Sales Pipeline |
| `HUBSPOT_STAGE_READY_TO_QUOTE` | `contractsent` | System designed / ready to quote |
| `HUBSPOT_STAGE_QUOTE_SENT` | `closedwon` | Quote Sent |
| `HUBSPOT_STAGE_CLOSED_WON` | `closedlost` | Quote Accepted / Closed Won |

Note: HubSpot's default stage IDs (`closedwon`, `closedlost`) have been repurposed with custom solar pipeline labels. The internal IDs look misleading but are correct.

HubSpot account: portal ID `443185577`, APAC instance (`app-ap1.hubspot.com`), user Sina Zarei.

HubSpot private app was created with scopes: `crm.objects.deals.read`, `crm.objects.deals.write`, `crm.objects.contacts.read`. Access token (`pat-ap1-...`) and client secret have been pasted into `.env`.

Webhook subscription still needs to be configured in the private app (deal → property change → dealstage), pointing to the deployed server URL.

**Why:** `crm.associations.read` scope does not appear in HubSpot's private app UI — associations access is bundled into the CRM object scopes, so the three scopes above are sufficient.

---

## Pending

1. **Node.js not installed** on this machine — user needs to install it (LTS 20.x via `winget install OpenJS.NodeJS.LTS`) before running `npm install`, `npm run dev`, or `npm run hs:stages`.

2. **Pylon API shape not yet verified** — `src/services/pylon.ts` has placeholder field names in `buildProjectPayload()` that need to be confirmed against actual Pylon API docs. Endpoint assumed: `POST /solar_projects`. Fields to verify: `contact`, `site_address`, `estimated_value`, `external_reference`.

3. **Pylon webhook event types not yet verified** — `proposals.shared` and `web_proposals.signed` in `src/webhooks/pylon.ts` need to match Pylon's actual event type strings. `extractProjectId()` also has three candidate paths for pulling the project ID — needs confirming.

4. **Pylon API token** — `PYLON_API_TOKEN` in `.env` is still empty.

5. **Infrastructure** — PostgreSQL and Redis not yet provisioned. Railway deployment not yet done.

**How to apply:** When resuming, pick up from step 2 (Pylon API shape) as the next thing to tackle.
