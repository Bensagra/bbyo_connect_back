# Fix de Deploy en Vercel (BBYO Connect API)

## Cambios aplicados en codigo
- Se agrego entrada serverless valida para Vercel en `api/index.ts`.
- Se agregaron rewrites globales en `vercel.json` para enrutar todo a `api/index.ts`.
- Se agrego ruta `GET /` y `GET /favicon.ico` para evitar errores del navegador en raiz.
- Se silenciaron logs de dotenv en serverless (`dotenv.config({ quiet: true })`).
- Se agrego manejo de bootstrap error en `api/index.ts` para devolver JSON claro en vez de "Invalid export found".

## Variables de entorno obligatorias en Vercel
Configuralas en Project Settings > Environment Variables (Production/Preview):
- DATABASE_URL
- ACCESS_TOKEN_SECRET
- REFRESH_TOKEN_SECRET

Recomendadas:
- JWT_ISSUER
- ACCESS_TOKEN_TTL
- REFRESH_TOKEN_TTL_DAYS
- CORS_ALLOWLIST
- RATE_LIMIT_WINDOW_MS
- RATE_LIMIT_MAX_IP
- RATE_LIMIT_MAX_USER
- IDEMPOTENCY_TTL_SECONDS
- UPLOAD_SIGNING_SECRET
- REDIS_URL (si usas redis)
- BANNED_WORDS

## Deploy
1. Push de los cambios.
2. Redeploy en Vercel.
3. Probar:
   - GET /
   - GET /health
   - GET /docs

## Nota importante
- Socket.IO en Vercel serverless no mantiene conexiones persistentes para realtime tradicional.
- Para realtime productivo (chat/presencia), mover WebSocket a un servicio dedicado (por ejemplo Fly.io, Railway, Render, ECS o provider websocket managed).
