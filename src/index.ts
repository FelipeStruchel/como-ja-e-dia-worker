import 'dotenv/config'
import { startClient } from './client.js'
import { startSendWorker } from './sendProcessor.js'
import { startContextWorker } from './contextProcessor.js'
import { startGroupDiscoveryWorker } from './groupDiscoveryProcessor.js'
import { startMuteSchedulerWorker } from './muteSchedulerProcessor.js'
import { publishIncoming } from './incomingPublisher.js'
import { extractBody, extractAuthor } from './incomingPublisher.js'
import { handleJogoCommand, handleVincularCommand } from './miruGroupHandler.js'
import { log } from './logger.js'

log('Worker iniciando...', 'info')

startSendWorker()
startContextWorker()
startGroupDiscoveryWorker()
startMuteSchedulerWorker()

await startClient(async (sock, msg) => {
  const from = msg.key.remoteJid ?? ''
  const rawBody = extractBody(msg).trim()
  const body = rawBody.toLowerCase()

  if (from.endsWith('@g.us')) {
    if (body === '!jogo') {
      const author = extractAuthor(msg)
      try {
        await handleJogoCommand(sock, from, author)
      } catch (err) {
        log(`Erro no !jogo: ${(err as Error).message}`, 'error')
      }
      return
    }

    if (body.startsWith('!vincular ')) {
      const author = extractAuthor(msg)
      const inviteLink = rawBody.split(/\s+/)[1] ?? ''
      try {
        await handleVincularCommand(sock, from, author, inviteLink)
      } catch (err) {
        log(`Erro no !vincular: ${(err as Error).message}`, 'error')
      }
      return
    }
  }

  await publishIncoming(sock, msg)
})
