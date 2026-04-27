// como-ja-e-dia-worker/src/reactionHandler.ts
import axios from 'axios'
import type { AxiosError } from 'axios'
import type { WASocket, proto } from 'baileys'
import { getRedis } from './redis.js'
import { config } from './config.js'
import { log } from './logger.js'

interface ReactionEntry {
  key: proto.IMessageKey
  reaction: proto.IReaction
}

interface ActiveDrop {
  dropId: string
  pokemonId: number
  messageId?: string
}

export async function handleReaction(
  sock: WASocket,
  entry: ReactionEntry
): Promise<void> {
  const groupId = entry.key.remoteJid
  if (!groupId?.endsWith('@g.us')) return

  // Ignora reação do próprio bot
  if (entry.key.fromMe) return

  const reactorJid = entry.key.participant ?? entry.key.remoteJid ?? ''
  if (!reactorJid || reactorJid.endsWith('@g.us')) {
    log('reaction missing participant JID', 'warn')
    return
  }

  const reactedMessageId = entry.reaction.key?.id
  const reactionText = entry.reaction.text

  // Ignora remoção de reação (text vazio = remoção)
  if (!reactionText) return
  if (!reactedMessageId) {
    log('reaction missing key.id', 'warn')
    return
  }

  // Ignora reação do bot pelo JID
  const botJid = sock.user?.id
  if (botJid && reactorJid === botJid) return

  const redis = getRedis()
  const activeKey = `drop:active:${groupId}`

  // GETDEL atômico — garante que só um reactor "ganha"
  const raw = await redis.getdel(activeKey)
  if (!raw) return // nenhum drop ativo ou já capturado

  const active = JSON.parse(raw) as ActiveDrop

  // Se o messageId ainda não foi registrado (race entre drop e reação), restaura e ignora
  if (!active.messageId) {
    await redis.set(activeKey, raw, 'EX', config.dropActiveTtlSec)
    return
  }

  // Se a reação é em outra mensagem (não o drop), restaura e ignora
  if (active.messageId !== reactedMessageId) {
    await redis.set(activeKey, raw, 'EX', config.dropActiveTtlSec)
    return
  }

  // Esta reação ganhou atomicamente — notificar o backend
  try {
    await axios.post(
      `${config.backendUrl}/drops/capture`,
      { dropId: active.dropId, capturedBy: reactorJid, groupId },
      {
        headers: { 'x-drop-token': config.dropCaptureToken },
        timeout: 10_000,
      }
    )
    log(`Captura registrada: ${reactorJid} → drop ${active.dropId}`, 'info')
  } catch (err) {
    const axiosErr = err as AxiosError
    if (axiosErr.response?.status === 409) {
      log(`Drop ${active.dropId} já foi capturado por outro (race no backend)`, 'info')
    } else {
      log(`Falha ao registrar captura: ${(err as Error).message}`, 'error')
    }
  }
}
