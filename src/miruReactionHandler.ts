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

export async function handleMiruReaction(
  sock: WASocket,
  entry: ReactionEntry
): Promise<void> {
  const groupId = entry.key.remoteJid
  if (!groupId?.endsWith('@g.us')) return
  if (entry.key.fromMe) return

  const reactorJid = entry.key.participant ?? entry.key.remoteJid ?? ''
  if (!reactorJid || reactorJid.endsWith('@g.us')) return

  const reactedMessageId = entry.reaction.key?.id
  const reactionText = entry.reaction.text
  if (!reactionText || !reactedMessageId) return

  const botJid = sock.user?.id
  if (botJid && reactorJid === botJid) return

  const redis = getRedis()

  const dropId = await redis.get(`miru:msg:${groupId}:${reactedMessageId}`)
  if (!dropId) return

  const dropKey = `miru:drop:active:${groupId}:${dropId}`
  const raw = await redis.getdel(dropKey)
  if (!raw) return

  await redis.del(`miru:msg:${groupId}:${reactedMessageId}`)

  try {
    await axios.post(
      `${config.backendUrl}/miru/capture`,
      {
        ownershipId: dropId,
        capturedBy: reactorJid,
        gameGroupId: groupId,
        rollMessageId: reactedMessageId,
      },
      { headers: { 'x-drop-token': config.dropCaptureToken }, timeout: 10_000 },
    )
    log(`Miru captura: ${reactorJid} → drop ${dropId}`, 'info')
  } catch (err) {
    const axiosErr = err as AxiosError
    if (axiosErr.response?.status === 409) {
      log(`Miru drop ${dropId} já capturado (race)`, 'info')
    } else {
      log(`Falha ao registrar captura Miru: ${(err as Error).message}`, 'error')
    }
  }
}
