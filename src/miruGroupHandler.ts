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
      await sock.sendMessage(mainGroupId, {
        text: '🎮 Este grupo ainda não tem um grupo de jogo Miru vinculado.\n\nUm admin deve:\n1. Criar um grupo manualmente\n2. Adicionar a Miru como admin\n3. Usar *!vincular <link_do_grupo>* aqui neste grupo',
      })
    } else {
      log(`Erro ao buscar linked group: ${(err as Error).message}`, 'error')
      await sock.sendMessage(mainGroupId, {
        text: '❌ Erro ao buscar grupo de jogo. Tente novamente.',
      })
    }
    return
  }

  let inviteCode: string | undefined
  try {
    inviteCode = await sock.groupInviteCode(gameGroupId)
  } catch (err) {
    log(`Erro ao gerar link de convite Miru: ${(err as Error).message}`, 'error')
  }

  if (!inviteCode) {
    await sock.sendMessage(mainGroupId, {
      text: '❌ Não foi possível gerar o link de convite do grupo Miru.',
    })
    return
  }

  const link = `https://chat.whatsapp.com/${inviteCode}`
  await sock.sendMessage(mainGroupId, {
    text: `🎮 Aqui está o link do grupo Miru:\n${link}`,
  })
}

export async function handleVincularCommand(
  sock: WASocket,
  mainGroupId: string,
  authorJid: string,
  inviteLink: string,
): Promise<void> {
  // Only group admins can link groups
  try {
    const meta = await sock.groupMetadata(mainGroupId)
    const participant = meta.participants.find((p) => p.id === authorJid)
    const isAdmin = participant?.admin === 'admin' || participant?.admin === 'superadmin'
    if (!isAdmin) {
      await sock.sendMessage(mainGroupId, { text: '❌ Apenas admins podem vincular grupos.' })
      return
    }
  } catch (err) {
    log(`Erro ao verificar admin no !vincular: ${(err as Error).message}`, 'error')
    await sock.sendMessage(mainGroupId, { text: '❌ Não foi possível verificar suas permissões.' })
    return
  }

  // Check if already linked
  try {
    await axios.get(`${config.backendUrl}/miru/linked-groups/${encodeURIComponent(mainGroupId)}`)
    await sock.sendMessage(mainGroupId, {
      text: '⚠️ Este grupo já tem um grupo de jogo Miru vinculado. Use !jogo para entrar.',
    })
    return
  } catch (err: unknown) {
    if ((err as any)?.response?.status !== 404) {
      await sock.sendMessage(mainGroupId, { text: '❌ Erro ao verificar vínculo existente.' })
      return
    }
  }

  // Parse invite code from link
  const match = inviteLink.match(/chat\.whatsapp\.com\/([A-Za-z0-9]+)/)
  if (!match) {
    await sock.sendMessage(mainGroupId, {
      text: '❌ Link inválido. Use: *!vincular https://chat.whatsapp.com/CODIGO*',
    })
    return
  }
  const code = match[1]

  // Resolve gameGroupId from invite info
  let gameGroupId: string
  try {
    const info = await sock.groupGetInviteInfo(code)
    gameGroupId = info.id
  } catch (err) {
    log(`Erro ao resolver invite no !vincular: ${(err as Error).message}`, 'error')
    await sock.sendMessage(mainGroupId, {
      text: '❌ Não consegui ler o link de convite. Verifique se o link é válido e se a Miru está no grupo.',
    })
    return
  }

  // Save the link
  try {
    await axios.post(`${config.backendUrl}/miru/linked-groups`, { mainGroupId, gameGroupId })
    log(`Grupo Miru vinculado manualmente: ${gameGroupId} ↔ ${mainGroupId}`, 'info')
    await sock.sendMessage(mainGroupId, {
      text: '✅ Grupo de jogo Miru vinculado com sucesso! Use !jogo para entrar.',
    })
  } catch (err) {
    log(`Erro ao salvar linked group no !vincular: ${(err as Error).message}`, 'error')
    await sock.sendMessage(mainGroupId, { text: '❌ Erro ao salvar vínculo. Tente novamente.' })
  }
}
