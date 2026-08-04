import type { WASocket } from 'baileys'
import { log } from './logger.js'

export const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000

export async function muteAllGroups(sock: WASocket): Promise<number> {
  const participating = await sock.groupFetchAllParticipating()
  const jids = Object.keys(participating)

  let muted = 0
  for (const jid of jids) {
    try {
      await sock.chatModify({ mute: ONE_WEEK_MS }, jid)
      muted++
    } catch (err) {
      log(`Falha ao mutar grupo ${jid}: ${(err as Error).message}`, 'warn')
    }
  }
  return muted
}
