# GDPR Support Notes

Implemented capabilities:
- `GET /auth/export-data`: exports key user-related records in a machine-readable JSON payload.
- `DELETE /auth/delete-account`: performs soft account deletion, token revocation, and audit entry.

Operational recommendations:
- Configure retention windows by table (for example 30/90/365 days) and run scheduled purge jobs.
- Keep moderation/audit logs immutable for legal retention obligations.
- Store processing purpose and lawful basis metadata where required by policy.
- Add DSR workflow tracking for export/delete requests and SLA enforcement.

Current behavior:
- Deletion marks account as `deleted`, sets `deletedAt`, and revokes refresh sessions.
- Historical records remain soft-deleted for legal traceability until retention purge.
