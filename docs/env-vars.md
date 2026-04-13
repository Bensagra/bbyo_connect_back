# Environment Variables

Required:
- `DATABASE_URL`: PostgreSQL connection string.
- `ACCESS_TOKEN_SECRET`: JWT secret for access token.
- `REFRESH_TOKEN_SECRET`: JWT secret for refresh token.

Optional with defaults:
- `PORT` (default: `4000`)
- `NODE_ENV` (default: `development`)
- `REDIS_URL` (optional)
- `ACCESS_TOKEN_TTL` (default: `15m`)
- `REFRESH_TOKEN_TTL_DAYS` (default: `30`)
- `JWT_ISSUER` (default: `bbyo-connect-api`)
- `CORS_ALLOWLIST` (comma-separated origins)
- `RATE_LIMIT_WINDOW_MS` (default: `60000`)
- `RATE_LIMIT_MAX_IP` (default: `120`)
- `RATE_LIMIT_MAX_USER` (default: `240`)
- `IDEMPOTENCY_TTL_SECONDS` (default: `300`)
- `BANNED_WORDS` (comma-separated)
- `UPLOAD_SIGNING_SECRET`
