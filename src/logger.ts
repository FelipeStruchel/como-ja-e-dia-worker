import axios from 'axios'

type LogLevel = 'info' | 'error' | 'success' | 'warn'

const INGEST_URL = process.env.LOG_INGEST_URL
const INGEST_TOKEN = process.env.LOG_INGEST_TOKEN

async function sendToIngest(level: LogLevel, message: string, meta?: unknown): Promise<void> {
  if (!INGEST_URL || !INGEST_TOKEN) return
  await axios.post(
    INGEST_URL,
    { source: 'worker', level, message, meta: meta ?? null },
    { headers: { 'x-log-token': INGEST_TOKEN }, timeout: 5000 },
  )
}

const TAG: Record<LogLevel, string> = {
  info: '[INFO]',
  error: '[ERROR]',
  success: '[SUCCESS]',
  warn: '[WARN]',
}

export function log(message: string, level: LogLevel = 'info', meta?: unknown): void {
  const line = `${new Date().toISOString()} ${TAG[level]} ${message}`
  console.log(line)
  if (!message.includes('Falha ao enviar log para ingest')) {
    sendToIngest(level, message, meta).catch(() => {})
  }
}
