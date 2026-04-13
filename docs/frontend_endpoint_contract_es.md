# BBYO Connect API - Contrato para Frontend (entrada/salida)

## 1) Formato de respuesta (TODOS los endpoints)
- Exito:
  - data: objeto o lista
  - meta: objeto o null
  - error: null
- Error:
  - data: null
  - meta: null
  - error:
    - code: string estable
    - message: string amigable
    - details: opcional (validaciones, bloqueos, etc.)

## 2) Reglas globales para frontend
- Auth:
  - En endpoints protegidos enviar Authorization: Bearer ACCESS_TOKEN
- Idempotency-Key obligatorio en:
  - POST /auth/register
  - POST /auth/login
  - POST /auth/login/chapter-code
  - POST /auth/guest
  - POST /auth/refresh
  - POST /verification/vouches
  - DELETE /auth/delete-account
- Paginacion cursor-based:
  - Query: cursor (opcional), limit (opcional)
  - Respuesta meta: hasNextPage, nextCursor
- Validaciones:
  - 400 VALIDATION_ERROR cuando body/query/params no cumplen
- Rate limiting:
  - 429 RATE_LIMIT_IP
  - 429 RATE_LIMIT_USER

## 3) Endpoints de Auth

- POST /auth/register
  - Recibe:
    - Header: Idempotency-Key
    - Body:
      - accountType: teen | chapter
      - email: opcional
      - memberId: requerido
      - password: requerido
      - profile: objeto
        - Teen: fullName, pronouns, regionId, chapterId, avatarUrl, bio, languages, interests
        - Chapter: chapterId y displayName requeridos, description, location, advisorUserId
  - Devuelve:
    - 201
    - data:
      - user (creado)
      - tokens:
        - accessToken
        - refreshToken
        - refreshTokenExpiresAt
    - meta:
      - locale: en

- POST /auth/login
  - Recibe:
    - Header: Idempotency-Key
    - Body:
      - memberIdOrEmail
      - password
      - deviceInfo: opcional
  - Devuelve:
    - 200
    - data:
      - user
      - tokens (access/refresh)

- POST /auth/chapter-one-time-codes
  - Recibe:
    - Auth (chapter_verified o staff: advisor | moderator | regional_admin | global_admin)
    - Body:
      - targetMemberIdOrEmail
      - expiresInMinutes: opcional (1-60, default 15)
  - Devuelve:
    - 201
    - data:
      - oneTimeCode (se muestra una sola vez)
      - expiresAt
      - chapterId
      - targetUser: id, memberId, email, role, status
      - maxAttempts
    - meta:
      - oneTimeCode: true

- POST /auth/login/chapter-code
  - Recibe:
    - Header: Idempotency-Key
    - Body:
      - memberIdOrEmail
      - oneTimeCode
      - deviceInfo: opcional
  - Devuelve:
    - 200
    - data:
      - user
      - tokens (access/refresh)
      - authMethod: chapter_one_time_code
      - codeIssuedByUserId

- POST /auth/guest
  - Recibe:
    - Header: Idempotency-Key
    - Body:
      - locale: opcional
      - deviceInfo: opcional
  - Devuelve:
    - 201
    - data:
      - user (role=guest)
      - tokens
    - meta:
      - guest: true

- POST /auth/refresh
  - Recibe:
    - Header: Idempotency-Key
    - Body:
      - refreshToken
      - deviceInfo: opcional
  - Devuelve:
    - 200
    - data:
      - user resumido: id, role, status, memberId, email
      - tokens rotados: accessToken, refreshToken, refreshTokenExpiresAt

- POST /auth/logout
  - Recibe:
    - Auth
    - Body:
      - refreshToken
  - Devuelve:
    - 200
    - data:
      - loggedOut: true

- GET /auth/me
  - Recibe:
    - Auth
  - Devuelve:
    - 200
    - data:
      - user
      - teenProfile (si aplica)
      - chapterProfile (si aplica)

- GET /auth/export-data
  - Recibe:
    - Auth
  - Devuelve:
    - 200
    - data:
      - exportedAt
      - user
      - posts
      - comments
      - messages
      - reports

- DELETE /auth/delete-account
  - Recibe:
    - Auth
    - Header: Idempotency-Key
  - Devuelve:
    - 200
    - data:
      - deleted: true
      - deletedAt

## 4) Verification

- POST /verification/vouches
  - Recibe:
    - Auth (solo teen_verified activo)
    - Header: Idempotency-Key
    - Body:
      - targetUserId
  - Devuelve:
    - 201
    - data:
      - targetUserId
      - approvedVouchCount
      - transitionedToVerified: boolean

- GET /verification/status
  - Recibe:
    - Auth
  - Devuelve:
    - 200
    - data:
      - userId
      - role
      - status
      - approvedVouchCount
      - isVerified
      - needsMoreVouches

## 5) Chapter Approvals

- POST /chapter-approvals/request
  - Recibe:
    - Auth (chapter_pending o chapter_verified)
    - Body:
      - notes: opcional
  - Devuelve:
    - 201
    - data: ChapterApprovalRequest

- PATCH /chapter-approvals/:id/approve
  - Recibe:
    - Auth staff: advisor | moderator | regional_admin | global_admin
    - Params:
      - id
    - Body:
      - notes: opcional
  - Devuelve:
    - 200
    - data: ChapterApprovalRequest actualizado
    - Efecto negocio:
      - chapter user pasa a chapter_verified + active

- PATCH /chapter-approvals/:id/reject
  - Recibe:
    - Auth staff
    - Params:
      - id
    - Body:
      - notes: opcional
  - Devuelve:
    - 200
    - data: ChapterApprovalRequest actualizado
    - Efecto negocio:
      - chapter user queda chapter_pending + pending

## 6) Feed

- GET /feed
  - Recibe:
    - Auth
    - Query:
      - cursor: opcional
      - limit: opcional
      - category: opcional
  - Devuelve:
    - 200
    - data: lista de Post (incluye media, reactions, comments parciales)
    - meta: hasNextPage, nextCursor

- POST /feed
  - Recibe:
    - Auth (NO guest, NO teen_pending, NO chapter_pending)
    - Body:
      - category
      - text
      - language: en | es | he | fr
      - visibility: public | chapter | region | global | private
      - media: lista opcional
        - type, url, thumbnailUrl?, duration?
  - Devuelve:
    - 201
    - data: Post creado

- GET /feed/:postId
  - Recibe:
    - Auth
    - Params:
      - postId
  - Devuelve:
    - 200
    - data: Post con media, reactions, comments

- PATCH /feed/:postId
  - Recibe:
    - Auth (owner o moderador)
    - Params:
      - postId
    - Body:
      - text?: opcional
      - category?: opcional
      - visibility?: opcional
  - Devuelve:
    - 200
    - data: Post actualizado

- DELETE /feed/:postId
  - Recibe:
    - Auth (owner o moderador)
    - Params:
      - postId
  - Devuelve:
    - 200
    - data:
      - deleted: true

- POST /feed/:postId/reactions
  - Recibe:
    - Auth (NO guest)
    - Params:
      - postId
    - Body:
      - reactionType: like | love | support | clap | celebrate | fire
  - Devuelve:
    - 201
    - data: PostReaction (upsert)

- DELETE /feed/:postId/reactions
  - Recibe:
    - Auth (NO guest)
    - Params:
      - postId
  - Devuelve:
    - 200
    - data:
      - removed: true

- GET /feed/:postId/comments
  - Recibe:
    - Auth
    - Params:
      - postId
    - Query:
      - cursor?: opcional
      - limit?: opcional
  - Devuelve:
    - 200
    - data: lista de PostComment
    - meta: hasNextPage, nextCursor

- POST /feed/:postId/comments
  - Recibe:
    - Auth (NO guest)
    - Params:
      - postId
    - Body:
      - text
      - language
  - Devuelve:
    - 201
    - data: PostComment creado

## 7) Stories

- GET /stories
  - Recibe:
    - Auth
  - Devuelve:
    - 200
    - data: Story[] activas

- POST /stories
  - Recibe:
    - Auth (NO guest, NO teen_pending, NO chapter_pending)
    - Body:
      - mediaUrl
      - expiresInHours?: opcional (default 24)
  - Devuelve:
    - 201
    - data: Story creado

- DELETE /stories/:storyId
  - Recibe:
    - Auth (owner o moderador)
    - Params:
      - storyId
  - Devuelve:
    - 200
    - data:
      - deleted: true

## 8) Messaging

- GET /messages/conversations
  - Recibe:
    - Auth (NO guest)
  - Devuelve:
    - 200
    - data: Conversation[]

- POST /messages/conversations
  - Recibe:
    - Auth (NO guest)
    - Body:
      - type: private | group | chapter
      - title?: opcional
      - isEncrypted?: opcional
      - memberIds: lista requerida
  - Devuelve:
    - 201
    - data: Conversation creada (con members)

- GET /messages/conversations/:id/messages
  - Recibe:
    - Auth (NO guest)
    - Params:
      - id (conversationId)
    - Query:
      - cursor?: opcional
      - limit?: opcional
  - Devuelve:
    - 200
    - data: Message[] (attachments + readReceipts)
    - meta: hasNextPage, nextCursor

- POST /messages/conversations/:id/messages
  - Recibe:
    - Auth (NO guest)
    - Params:
      - id (conversationId)
    - Body:
      - content
      - contentType?: default text
      - attachments?: lista
        - url, type, sizeBytes?
  - Devuelve:
    - 201
    - data: Message creado

- PATCH /messages/messages/:id
  - Recibe:
    - Auth (sender o moderador)
    - Params:
      - id (messageId)
    - Body:
      - content
  - Devuelve:
    - 200
    - data: Message editado

- DELETE /messages/messages/:id
  - Recibe:
    - Auth (sender o moderador)
    - Params:
      - id
  - Devuelve:
    - 200
    - data:
      - deleted: true

- POST /messages/messages/:id/read
  - Recibe:
    - Auth (NO guest)
    - Params:
      - id
  - Devuelve:
    - 201
    - data: MessageReadReceipt

## 9) Events

- GET /events
  - Recibe:
    - Auth
    - Query:
      - cursor?
      - limit?
      - visibility?: public | chapter | region | private
  - Devuelve:
    - 200
    - data: Event[]
    - meta: hasNextPage, nextCursor

- GET /events/:id
  - Recibe:
    - Auth
    - Params:
      - id
  - Devuelve:
    - 200
    - data: Event + registrations

- POST /events
  - Recibe:
    - Auth (NO guest, NO teen_pending, NO chapter_pending)
    - Body:
      - chapterId?: opcional
      - title
      - description
      - startAt
      - endAt
      - timezone
      - location?: opcional
      - isVirtual?: opcional
      - visibility
  - Devuelve:
    - 201
    - data: Event creado

- PATCH /events/:id
  - Recibe:
    - Auth (staff o chapter owner del evento)
    - Params:
      - id
    - Body:
      - cualquiera de los campos de Event (parcial)
  - Devuelve:
    - 200
    - data: Event actualizado

- DELETE /events/:id
  - Recibe:
    - Auth (staff o chapter owner del evento)
    - Params:
      - id
  - Devuelve:
    - 200
    - data:
      - deleted: true

- POST /events/:id/register
  - Recibe:
    - Auth
    - Params:
      - id
  - Devuelve:
    - 201
    - data: EventRegistration (upsert)

- DELETE /events/:id/register
  - Recibe:
    - Auth
    - Params:
      - id
  - Devuelve:
    - 200
    - data:
      - removed: true

- POST /events/:id/reminders
  - Recibe:
    - Auth
    - Params:
      - id
    - Body:
      - remindAt
  - Devuelve:
    - 201
    - data: EventReminder creado

## 10) Chapters

- GET /chapters
  - Recibe:
    - Auth
    - Query:
      - cursor?
      - limit?
      - regionId?
      - country?
  - Devuelve:
    - 200
    - data: Chapter[]
    - meta: hasNextPage, nextCursor

- GET /chapters/map-pins
  - Recibe:
    - Auth
  - Devuelve:
    - 200
    - data: [{ id, name, city, country, lat, lng }]

- GET /chapters/:id
  - Recibe:
    - Auth
    - Params:
      - id
  - Devuelve:
    - 200
    - data: Chapter + region

- GET /chapters/:id/board
  - Recibe:
    - Auth
    - Params:
      - id
  - Devuelve:
    - 200
    - data: Post[] board del chapter

- GET /chapters/:id/projects
  - Recibe:
    - Auth
    - Params:
      - id
  - Devuelve:
    - 200
    - data: CreativeProject[] publicados

- POST /chapters/:id/travel-intro
  - Recibe:
    - Auth (NO guest)
    - Params:
      - id
    - Body:
      - message?: opcional
  - Devuelve:
    - 201
    - data: TravelIntro

## 11) Resources

- GET /resources
  - Recibe:
    - Auth
    - Query:
      - language?: en | es | he | fr
      - visibility?: public | chapter | region | global | private
      - cursor?
      - limit?
  - Devuelve:
    - 200
    - data: Resource[]
    - meta: hasNextPage, nextCursor

- POST /resources
  - Recibe:
    - Auth staff (advisor | moderator | regional_admin | global_admin)
    - Body:
      - title
      - type: article | video | podcast | toolkit | pdf | link
      - language
      - url
      - visibility
  - Devuelve:
    - 201
    - data: Resource

## 12) Gamification

- GET /gamification/leaderboard
  - Recibe:
    - Auth
    - Query:
      - scope?: chapter | region | global
      - period?: weekly | monthly | quarterly | yearly
      - chapterId?: opcional
      - regionId?: opcional
  - Devuelve:
    - 200
    - data:
      - snapshot encontrado o
      - fallback: { scope, period, entries: [] }

- GET /gamification/me
  - Recibe:
    - Auth (NO guest)
  - Devuelve:
    - 200
    - data:
      - userId
      - totalPoints
      - badges: [{ awardedAt, badge }]
      - latestEntries

## 13) Reports y Moderacion

- POST /reports
  - Recibe:
    - Auth
    - Body:
      - targetType: user | post | comment | story | message | event | chapter
      - targetId
      - reason
      - details?: opcional
  - Devuelve:
    - 201
    - data: Report

- GET /reports
  - Recibe:
    - Auth staff
    - Query:
      - status?: open | under_review | resolved | dismissed
      - cursor?
      - limit?
  - Devuelve:
    - 200
    - data: Report[] (incluye actions)
    - meta: hasNextPage, nextCursor

- PATCH /reports/:id/resolve
  - Recibe:
    - Auth staff
    - Params:
      - id
    - Body:
      - status: resolved | dismissed
      - actionType: hide_content | warn_user | suspend_user | ban_user | restore_content | note
      - notes?: opcional
  - Devuelve:
    - 200
    - data: Report actualizado (incluye actions)

## 14) Notifications

- GET /notifications
  - Recibe:
    - Auth
    - Query:
      - cursor?
      - limit?
      - unreadOnly?: boolean
  - Devuelve:
    - 200
    - data: Notification[]
    - meta: hasNextPage, nextCursor

- PATCH /notifications/:id/read
  - Recibe:
    - Auth
    - Params:
      - id
  - Devuelve:
    - 200
    - data: Notification actualizado con readAt

## 15) Uploads

- POST /uploads/presign
  - Recibe:
    - Auth (NO guest)
    - Body:
      - fileName
      - contentType
      - sizeBytes (max 20MB)
  - Devuelve:
    - 201
    - data:
      - uploadUrl
      - fileUrl
      - method: PUT
      - headers: content-type, x-upload-signature
      - expiresAt

## 16) Realtime para frontend (Socket.IO)
- Eventos server->client implementados:
  - message.created
  - message.edited
  - message.deleted
  - conversation.updated
  - notification.created
  - presence.updated
  - typing
- Eventos client->server utiles:
  - conversation.join (para room de conversation)
  - typing

## 17) Errores frecuentes a contemplar en UI
- 401:
  - AUTH_REQUIRED
  - INVALID_TOKEN
  - INVALID_SESSION
  - INVALID_CHAPTER_ONE_TIME_CODE
- 403:
  - FORBIDDEN
  - ROLE_RESTRICTED
  - GUEST_CHAT_FORBIDDEN
  - GUEST_EVENT_RESTRICTED
  - PENDING_PRIVATE_CHAT_RESTRICTED
  - PENDING_USER_RESTRICTED
  - TARGET_ROLE_NOT_ELIGIBLE
  - TARGET_ACCOUNT_RESTRICTED
  - TARGET_NOT_IN_CHAPTER
  - SELF_ROLE_CHANGE_FORBIDDEN
- 400:
  - TARGET_CHAPTER_REQUIRED
  - NOTHING_TO_UPDATE
  - TEEN_PROFILE_REQUIRED
  - CHAPTER_PROFILE_REQUIRED
- 404:
  - *_NOT_FOUND
- 409:
  - ACCOUNT_EXISTS
  - VOUCH_ALREADY_EXISTS
  - REQUEST_ALREADY_PENDING
  - REQUEST_ALREADY_DECIDED
  - USER_NOT_PENDING_FOR_ADMISSION
  - USER_DELETED
- 422:
  - CONTENT_FLAGGED (details.blockedWord)
- 429:
  - RATE_LIMIT_IP
  - RATE_LIMIT_USER

## 18) Nota tecnica para frontend
- Actualmente algunos flujos de auth devuelven el objeto user completo desde Prisma.
- Mientras se sanitiza backend, frontend debe ignorar cualquier campo sensible (ejemplo: passwordHash) y usar solo campos publicos necesarios.

## 19) Admin Panel (control de usuarios y chapters)

- GET /admin/overview
  - Recibe:
    - Auth staff: advisor | moderator | regional_admin | global_admin
  - Devuelve:
    - 200
    - data:
      - users:
        - total
        - active
        - pending
        - suspended
        - banned
        - pendingTeenAdmissions
        - pendingChapterAdmissions
      - chapters:
        - total
        - active
        - inactive

- GET /admin/users
  - Recibe:
    - Auth staff
    - Query:
      - cursor?: opcional
      - limit?: opcional (1..100)
      - search?: opcional (memberId o email)
      - role?: opcional (Role)
      - status?: opcional (UserStatus)
      - chapterId?: opcional
      - includeDeleted?: opcional (default false)
  - Devuelve:
    - 200
    - data: lista de usuarios sanitizados (sin passwordHash) + teenProfile/chapterProfile resumido
    - meta: hasNextPage, nextCursor

- GET /admin/users/:id
  - Recibe:
    - Auth staff
    - Params:
      - id
  - Devuelve:
    - 200
    - data:
      - user sanitizado
      - teenProfile y chapterProfile completos (si aplica)
      - activeSessionCount

- PATCH /admin/users/:id/admit
  - Recibe:
    - Auth staff operador: moderator | regional_admin | global_admin
    - Params:
      - id
    - Body:
      - notes?: opcional
  - Efecto negocio:
    - teen_pending -> teen_verified + active
    - chapter_pending -> chapter_verified + active
    - si hay ChapterApprovalRequest pendiente, la marca aprobada
  - Devuelve:
    - 200
    - data:
      - admitted: true
      - user actualizado
      - previousRole
      - previousStatus
      - chapterApprovalRequestId: id o null

- PATCH /admin/users/:id/reject
  - Recibe:
    - Auth staff operador
    - Params:
      - id
    - Body:
      - reason: requerido
      - status?: pending | suspended | banned (default pending)
  - Efecto negocio:
    - solo aplica a teen_pending o chapter_pending
    - si hay ChapterApprovalRequest pendiente, la marca rechazada
  - Devuelve:
    - 200
    - data:
      - rejected: true
      - user actualizado
      - reason
      - chapterApprovalRequestId: id o null

- PATCH /admin/users/:id/status
  - Recibe:
    - Auth staff operador
    - Params:
      - id
    - Body:
      - status: active | pending | suspended | banned
      - reason?: opcional
  - Devuelve:
    - 200
    - data:
      - user actualizado
      - previousStatus
      - reason

- PATCH /admin/users/:id/role
  - Recibe:
    - Auth solo global_admin
    - Params:
      - id
    - Body:
      - role: cualquier Role
      - reason?: opcional
  - Validaciones:
    - no permite auto-democión de global_admin
    - para teen_verified requiere teenProfile
    - para chapter_verified requiere chapterProfile
  - Devuelve:
    - 200
    - data:
      - user actualizado
      - previousRole
      - reason

- GET /admin/chapters
  - Recibe:
    - Auth staff
    - Query:
      - cursor?: opcional
      - limit?: opcional (1..100)
      - search?: opcional (name/city/country)
      - regionId?: opcional
      - country?: opcional
      - isActive?: opcional
      - includeDeleted?: opcional (default false)
  - Devuelve:
    - 200
    - data: Chapter[] con region y _count
    - meta: hasNextPage, nextCursor

- GET /admin/chapters/:id
  - Recibe:
    - Auth staff
    - Params:
      - id
  - Devuelve:
    - 200
    - data:
      - chapter completo con region y _count
      - pendingChapterUsers
      - pendingTeenUsers

- PATCH /admin/chapters/:id
  - Recibe:
    - Auth staff operador
    - Params:
      - id
    - Body (al menos 1 campo):
      - name?
      - regionId?
      - city?
      - country?
      - lat?
      - lng?
      - isActive?
  - Devuelve:
    - 200
    - data: chapter actualizado

- PATCH /admin/chapters/:id/admit
  - Recibe:
    - Auth staff operador
    - Params:
      - id
    - Body:
      - notes?: opcional
  - Efecto negocio:
    - fuerza isActive=true para admitir chapter desde panel
  - Devuelve:
    - 200
    - data:
      - admitted: true
      - chapter actualizado
