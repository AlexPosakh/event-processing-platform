# Webhook platform MVP scope

## Goal

Receive generic JSON webhooks at a platform URL, persist them, and later deliver
them to a configured customer URL. The first release is a learning-project MVP,
not a production-ready public service.

The API uses NestJS, PostgreSQL, and TypeORM; the dashboard uses Next.js. The
first release does not require Redis or a background queue.

## First-release boundaries

- Accept generic webhooks. Stripe, GitHub, and Shopify-specific adapters and
  signature verification are out of scope.
- Each configured endpoint has one customer destination URL and one generated
  inbound URL.
- Events are JSON objects. The platform does not validate provider-specific
  payload schemas or transform payloads.
- Support one workspace initially. Organization memberships, roles, quotas,
  billing, and multi-tenant administration are deferred.
- Dashboard/API user authentication is deferred. Do not expose this version as
  a public production service.
- Queue workers, retries, replay, HMAC signing of outgoing deliveries, rate
  limiting, live updates, and advanced monitoring are follow-on milestones.

## Endpoint contract

An endpoint has:

- `id`: platform-generated identifier.
- `name`: user-provided display name.
- `destinationUrl`: the customer's HTTP(S) URL.
- `inboundToken`: a platform-generated, high-entropy token used in its ingress
  URL; show the token only when it is created and store only its hash.
- `active`: whether new events may be accepted for this endpoint.
- `createdAt`.

The generated ingress URL is `POST /webhooks/{inboundToken}`. Production
destinations must use HTTPS. HTTP destinations may be allowed only for local
development.

## Inbound event contract

- Require `Content-Type: application/json` and a JSON object body.
- Reject invalid JSON, invalid/inactive tokens, and bodies larger than 1 MiB.
- Accept an optional `X-Event-Type` header. If absent, the event type is null;
  the platform does not infer a type from provider-specific payload fields.
- Accept an optional `Idempotency-Key`. When present, it is scoped to the
  endpoint: repeated requests with the same key return `202 Accepted` and do
  not create another event. Requests without a key are treated as distinct.
- Generate a platform event ID and received timestamp. Store the JSON payload
  without provider-specific transformation.
- Return `202 Accepted` only after the event has been durably stored. Include
  the platform event ID in the response.

An event records its ID, endpoint ID, optional type, payload, received time,
and overall delivery status. Delivery attempts are separate records so the
event's history is retained.

## Delivery contract for the next milestone

- Send the stored JSON payload to the endpoint's destination URL.
- Include `X-Event-Id` and, when available, `X-Event-Type` headers.
- Treat any `2xx` response as delivered.
- Retry network errors, timeouts, `408`, `429`, and `5xx`; treat other `4xx`
  responses as terminal failures.
- Use a 10-second request timeout and at most 10 attempts, including the
  initial attempt. Delays after failures are 5 seconds, 30 seconds, 2 minutes,
  10 minutes, then 1 hour between remaining attempts.
- Record each attempt's start time, duration, HTTP status, bounded response
  body, and error. The final status is `delivered` or `failed`; while work is
  outstanding it is `pending`, `delivering`, or `retrying`.
- Manual retry and replay are deferred until after automatic delivery/retries
  are working.

## Dashboard outline

1. **Endpoints:** list endpoints and show each endpoint's name, destination,
   active state, and generated ingress URL when first created.
2. **Events:** list recent events with received time, event type, and delivery
   status.
3. **Event detail:** show the JSON payload and the chronological delivery
   attempts, including response status and error.

The first dashboard version does not include charts, live updates, filtering,
or manual replay.

## Completion criteria for this scope milestone

- The inbound route, endpoint settings, payload constraints, and authentication
  boundary are specified above.
- Event identity, idempotency behavior, stored event fields, and response
  behavior are specified above.
- Delivery success, retryable failures, limits, and status values are specified
  above.
- The initial dashboard pages and explicitly deferred features are identified.
