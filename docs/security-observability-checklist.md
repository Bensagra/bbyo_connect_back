# Security and Observability Checklist

## Security baseline
- [x] Access JWT short-lived and refresh token rotation implemented.
- [x] Password hashing with Argon2.
- [x] RBAC enforced per endpoint.
- [x] Input validation with Zod middleware.
- [x] IP and user-level rate limits.
- [x] CORS allowlist support.
- [x] Idempotency-Key middleware for sensitive operations.
- [x] Soft-delete model for key entities.
- [x] Audit logging for sensitive actions.
- [x] Report and moderation traceability.

## Youth protection
- [x] Guest restrictions (no chat/feed publishing).
- [x] Teen pending restrictions for private messaging/global posting.
- [x] Verification vouch workflow (2 distinct active verified teens).
- [x] Chapter approval workflow pending->approved/rejected.
- [x] Safety report and moderation action logs.
- [x] Language filter hook in feed/messages/comments.

## Compliance and privacy
- [x] Data export endpoint.
- [x] Account deletion endpoint with token revocation.
- [x] Retention policy hooks via soft-deletes and timestamps.
- [x] UTC ISO timestamps returned by API.

## Observability
- [x] Structured logging with Pino.
- [x] Request logging middleware.
- [x] Standard error envelope with stable code/message.
- [x] Health endpoint `/health`.

## Recommended production hardening
- [ ] Enforce TLS termination at ingress/load balancer.
- [ ] Store secrets in vault/KMS, not `.env` files.
- [ ] Replace in-memory idempotency and user rate limit with Redis.
- [ ] Add WAF and bot protections on edge.
- [ ] Add SIEM integration for moderation and auth events.
- [ ] Add OpenTelemetry traces and metrics exporter.
- [ ] Add content scanning for media uploads.
- [ ] Add background workers for reminders and notifications.
