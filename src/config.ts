export const config = {
  redisHost: process.env.REDIS_HOST ?? 'redis',
  redisPort: parseInt(process.env.REDIS_PORT ?? '6379', 10),
  sendQueueName: process.env.SEND_QUEUE_NAME ?? 'send-messages',
  incomingQueueName: process.env.INCOMING_QUEUE_NAME ?? 'incoming-messages',
  groupContextQueueName: process.env.GROUP_CONTEXT_QUEUE_NAME ?? 'group-context',
  groupContextToken: process.env.CONTEXT_INGEST_TOKEN ?? '',
  backendUrl: (process.env.BACKEND_PUBLIC_URL ?? 'http://backend:3000').replace(/\/+$/, ''),
  groupId: process.env.GROUP_ID ?? process.env.ALLOWED_PING_GROUP ?? '120363339314665620@g.us',
  authStatePath: process.env.AUTH_STATE_PATH ?? '/app/auth_state',
  logIngestToken: process.env.LOG_INGEST_TOKEN ?? '',
  logIngestUrl: process.env.LOG_INGEST_URL ?? '',
} as const
