import type { WASocket, WAMessage } from 'baileys'
import { incomingQueue } from './queues.js'
import { log } from './logger.js'

export interface IncomingPayload {
  id: string
  from: string
  author: string
  body: string
  timestamp: number
  fromMe: boolean
  isGroup: boolean
  participants: string[]
  mentionedJids: string[]
}

export function extractBody(msg: WAMessage): string {
  const m = msg.message
  if (!m) return ''
  return (
    m.conversation ??
    m.extendedTextMessage?.text ??
    m.imageMessage?.caption ??
    m.videoMessage?.caption ??
    m.documentMessage?.caption ??
    m.buttonsResponseMessage?.selectedButtonId ??
    m.listResponseMessage?.singleSelectReply?.selectedRowId ??
    ''
  )
}

export function extractAuthor(msg: WAMessage): string {
  return msg.key.participant ?? msg.key.remoteJid ?? ''
}

async function fetchParticipants(sock: WASocket, jid: string): Promise<string[]> {
  try {
    const metadata = await sock.groupMetadata(jid)
    return metadata.participants.map((p) => p.id)
  } catch {
    return []
  }
}

export async function publishIncoming(sock: WASocket, msg: WAMessage): Promise<void> {
  try {
    const from = msg.key.remoteJid ?? ''
    const isGroup = from.endsWith('@g.us')
    const author = extractAuthor(msg)
    const body = extractBody(msg)
    const participants = isGroup ? await fetchParticipants(sock, from) : []

    const mentionedJids: string[] =
      msg.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? []

    const payload: IncomingPayload = {
      id: msg.key.id ?? '',
      from,
      author,
      body,
      timestamp: ((msg.messageTimestamp as number) ?? 0) * 1000,
      fromMe: msg.key.fromMe ?? false,
      isGroup,
      participants,
      mentionedJids,
    }

    await incomingQueue.add('incoming', payload, {
      removeOnComplete: 50,
      removeOnFail: 50,
    })
  } catch (err) {
    log(`Falha ao enfileirar mensagem recebida: ${(err as Error).message}`, 'error')
  }
}
