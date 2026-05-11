import type { WASocket } from 'baileys'
import axios from 'axios'
import { config } from './config.js'
import { log } from './logger.js'

export async function handleJogoCommand(
  sock: WASocket,
  mainGroupId: string,
  authorJid: string,
): Promise<void> {
  let gameGroupId: string
  let isNew = false

  try {
    const res = await axios.get<{ gameGroupId: string }>(
      `${config.backendUrl}/miru/linked-groups/${encodeURIComponent(mainGroupId)}`,
    )
    gameGroupId = res.data.gameGroupId
    try {
      await sock.groupParticipantsUpdate(gameGroupId, [authorJid], 'add')
    } catch {
      // User already a member — not an error
    }
  } catch (err: unknown) {
    const status = (err as any)?.response?.status
    if (status === 404) {
      isNew = true
      const result = await sock.groupCreate('Miru 🎮', [authorJid])
      gameGroupId = result.id

      try {
        await sock.groupUpdateDescription(
          gameGroupId,
          'Grupo Miru vinculado a este grupo. Use !miru para capturar personagens!',
        )
      } catch {
        // Non-critical
      }

      await axios.post(`${config.backendUrl}/miru/linked-groups`, { mainGroupId, gameGroupId })
      log(`Grupo Miru criado: ${gameGroupId} ↔ ${mainGroupId}`, 'info')
    } else {
      log(`Erro ao buscar linked group: ${(err as Error).message}`, 'error')
      await sock.sendMessage(mainGroupId, {
        text: '❌ Erro ao criar grupo de jogo. Tente novamente.',
      })
      return
    }
  }

  let inviteCode: string
  try {
    inviteCode = await sock.groupInviteCode(gameGroupId)
  } catch (err) {
    log(`Erro ao gerar link de convite Miru: ${(err as Error).message}`, 'error')
    await sock.sendMessage(mainGroupId, {
      text: '❌ Grupo criado mas não foi possível gerar o link de convite.',
    })
    return
  }

  const link = `https://chat.whatsapp.com/${inviteCode}`
  const text = isNew
    ? `🎮 *Grupo Miru criado!* Entre pelo link:\n${link}\n\n_Mute o grupo se não quiser notificações._`
    : `🎮 Aqui está o link do grupo Miru:\n${link}`

  await sock.sendMessage(mainGroupId, { text })
}
