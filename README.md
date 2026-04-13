# BBYO Connect Backend API

Production-oriented backend for BBYO Connect (closed and safe social network for BBYO teens and chapter accounts).

## Tech stack
- Node.js + TypeScript
- Express + Socket.IO
- Prisma + PostgreSQL
- Redis (optional for scaling idempotency, rate-limit, cache)
- Zod validation
- Argon2 password hashing

## Folder structure

```text
.
├── docs/
│   ├── compliance-gdpr.md
│   ├── env-vars.md
│   └── security-observability-checklist.md
├── prisma/
│   ├── migrations/
│   │   └── 0001_init/migration.sql
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   │   ├── env.ts
│   │   └── logger.ts
│   ├── common/
│   │   ├── api-response.ts
│   │   ├── async-handler.ts
│   │   ├── audit.ts
│   │   ├── errors.ts
│   │   ├── pagination.ts
│   │   ├── permissions.ts
│   │   ├── safety.ts
│   │   └── tokens.ts
│   ├── lib/
│   │   ├── prisma.ts
│   │   └── redis.ts
│   ├── middlewares/
│   │   ├── auth.ts
│   │   ├── error-handler.ts
│   │   ├── idempotency.ts
│   │   ├── rate-limit.ts
│   │   ├── rbac.ts
│   │   └── validate.ts
│   ├── modules/
│   │   ├── auth/routes.ts
│   │   ├── verification/routes.ts
│   │   ├── chapterApprovals/routes.ts
│   │   ├── feed/routes.ts
│   │   ├── stories/routes.ts
│   │   ├── messaging/routes.ts
│   │   ├── events/routes.ts
│   │   ├── chapters/routes.ts
│   │   ├── resources/routes.ts
│   │   ├── gamification/routes.ts
│   │   ├── reports/routes.ts
│   │   ├── notifications/routes.ts
│   │   └── uploads/routes.ts
│   ├── realtime/
│   │   └── socket.ts
│   ├── docs/
│   │   ├── openapi.yaml
│   │   └── postman_collection.json
│   └── types/
│       └── express.d.ts
├── tests/
│   ├── fixtures/prismaMock.ts
│   ├── integration/*.test.ts
│   └── unit/*.test.ts
├── docker-compose.yml
├── Dockerfile
└── .env.example
```

## Core business rules implemented
- Teen signup starts as `teen_pending` and transitions to `teen_verified` only after 2 distinct vouches from active `teen_verified` users.
- Self-vouch is blocked.
- Chapter signup starts as `chapter_pending`; advisor/admin approval required for `chapter_verified`.
- Guest can browse and public events only; guest cannot post or chat.
- Pending teens restricted from private messaging and feed publish routes.
- Moderation roles can resolve reports and trigger moderation actions (hide content/suspend/ban).
- Audit logs for sensitive actions.

## REST endpoints
Implemented all requested groups:
- Auth
- Verification
- Chapter approvals
- Feed (posts, reactions, comments)
- Stories
- Messaging
- Events (registration + reminders)
- Chapters + map + board + projects + travel intro
- Resources
- Gamification
- Reports + moderation
- Notifications
- Upload presign

See complete contract in `src/docs/openapi.yaml` and Postman collection in `src/docs/postman_collection.json`.

## Realtime
Socket.IO events:
- `message.created`
- `message.edited`
- `message.deleted`
- `conversation.updated`
- `notification.created`
- plus presence/typing support.

## Setup
1. Copy `.env.example` to `.env`.
2. Start dependencies:
   - `docker compose up -d db redis`
3. Run migrations and seed:
   - `npm run prisma:generate`
   - `npx prisma migrate deploy`
   - `npm run prisma:seed`
4. Run API:
   - `npm run dev`

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run test`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:deploy`
- `npm run prisma:seed`

## Security and compliance docs
- `docs/security-observability-checklist.md`
- `docs/compliance-gdpr.md`
- `docs/env-vars.md`
