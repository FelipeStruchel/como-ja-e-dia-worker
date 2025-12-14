Project: Worker (WhatsApp client + job executer)

Principles
- Single responsibility: WhatsApp connectivity, ingest incoming messages to queues, process send queue, context queue. No HTTP API here.
- Use internal URLs (MEDIA_BASE_URL or BACKEND_PUBLIC_URL fallback) to fetch media; never rely on public DNS. Only delete media after successful send and only when cleanup flag is true (random pool always cleans).
- JID normalization: convert @lid to @c.us when possible (getContactById); include participants for group messages. Ensure author is filled before enqueue.
- Queues (BullMQ): incoming-messages publisher, send-messages consumer, group-context collector. Respect queue names from env; default Redis redis://redis:6379.
- Context jobs: collect participants, names, profile pics; graceful fallback if contact lookup fails; store via ingest API.
- Logging: use structured logger; send to backend ingest with CONTEXT_INGEST_TOKEN/INGEST URL; keep console logs minimal; avoid log loops on ingest failure.
- Puppeteer/whatsapp-web.js: keep headless config stable; handle chromium profile lock by cleaning only your own temp dirs; avoid multiple clients sharing session.

Do not
- Do not persist media locally long term. Do not send logs to backend on ingest failure in a loop. Do not assume localhost for Redis/ingest.
- Do not change message content/flow; worker must be a thin executor of backend decisions.
