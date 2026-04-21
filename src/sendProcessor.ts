import { Worker } from 'bullmq'
import axios from 'axios'
import mime from 'mime-types'
import { getSocket } from './client.js'
import { config } from './config.js'
import { redisConnection, sendQueueName } from './queues.js'
import { log } from './logger.js'

interface SendJobData {
  groupId?: string
  type: 'text' | 'image' | 'video'
  content: string
  caption?: string
  replyTo?: string
  mentions?: Array<string | { _serialized?: string; id?: string }>
  cleanup?: {
    type: 'phrase' | 'image' | 'video'
    id?: string
    filename?: string
    scope?: string
  }
}

const mediaBase = config.backendUrl

async function downloadMediaToBuffer(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const resp = await axios.get<ArrayBuffer>(url, { responseType: 'arraybuffer' })
  const mimeType =
    (resp.headers['content-type'] as string | undefined) ||
    mime.lookup(url) ||
    'application/octet-stream'
  return { buffer: Buffer.from(resp.data), mimeType }
}

function resolveUrl(source: string): string {
  if (source.startsWith('http')) return source
  const clean = source.split('?')[0]
  return `${mediaBase}${clean}`
}

function normalizeJid(raw: string | { _serialized?: string; id?: string }): string | null {
  if (typeof raw === 'string') return raw
  return raw?._serialized ?? raw?.id ?? null
}

async function cleanupMedia(cleanup: NonNullable<SendJobData['cleanup']>): Promise<void> {
  if (!cleanup.filename || !cleanup.type) return
  const scope =
    cleanup.scope === 'trigger' || cleanup.scope === 'media_triggers' ? 'trigger' : 'media'
  const url = `${mediaBase}/media/${cleanup.type}/${cleanup.filename}${scope === 'trigger' ? '?scope=trigger' : ''}`
  await axios.delete(url)
  log(`Cleanup de mídia concluído: ${cleanup.filename}`, 'info')
}

async function cleanupPhrase(cleanup: NonNullable<SendJobData['cleanup']>): Promise<void> {
  if (!cleanup.id) return
  await axios.delete(`${mediaBase}/frases/by-id/${cleanup.id}`)
  log(`Cleanup de frase concluído: ${cleanup.id}`, 'info')
}

export function startSendWorker(): Worker {
  const worker = new Worker(
    sendQueueName,
    async (job) => {
      const data = job.data as SendJobData
      const groupId = data.groupId ?? config.groupId
      if (!groupId) throw new Error('groupId ausente no job')

      const sock = getSocket()
      log(`Enviando job ${job.id} para ${groupId}`, 'info')

      const mentions: string[] = (data.mentions ?? [])
        .map(normalizeJid)
        .filter((jid): jid is string => jid !== null)

      if (data.type === 'text') {
        await sock.sendMessage(groupId, {
          text: data.content,
          ...(mentions.length ? { mentions } : {}),
        })
      } else if (data.type === 'image') {
        const { buffer, mimeType } = await downloadMediaToBuffer(resolveUrl(data.content))
        await sock.sendMessage(groupId, {
          image: buffer,
          mimetype: mimeType,
          ...(data.caption ? { caption: data.caption } : {}),
          ...(mentions.length ? { mentions } : {}),
        } as any)
      } else {
        const { buffer, mimeType } = await downloadMediaToBuffer(resolveUrl(data.content))
        await sock.sendMessage(groupId, {
          video: buffer,
          mimetype: mimeType,
          ...(data.caption ? { caption: data.caption } : {}),
          ...(mentions.length ? { mentions } : {}),
        } as any)
      }

      if (data.cleanup) {
        try {
          if (data.cleanup.type === 'phrase') {
            await cleanupPhrase(data.cleanup)
          } else {
            await cleanupMedia(data.cleanup)
          }
        } catch (err) {
          log(`Falha no cleanup: ${(err as Error).message}`, 'warn')
        }
      }

      log(`Job ${job.id} enviado para ${groupId}`, 'success')
    },
    { connection: redisConnection },
  )

  worker.on('failed', (job, err) => {
    log(`Job de envio ${job?.id} falhou: ${err.message}`, 'error')
  })

  return worker
}
