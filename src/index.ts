import 'dotenv/config'
import { startClient } from './client.js'
import { startSendWorker } from './sendProcessor.js'
import { startContextWorker } from './contextProcessor.js'
import { publishIncoming } from './incomingPublisher.js'
import { extractBody, extractAuthor } from './incomingPublisher.js'
import { handleJogoCommand } from './miruGroupHandler.js'
import { log } from './logger.js'

log('Worker iniciando...', 'info')

startSendWorker()
startContextWorker()

await startClient(async (sock, msg) => {
  const from = msg.key.remoteJid ?? ''
  const body = extractBody(msg).trim().toLowerCase()

  if (body === '!jogo' && from.endsWith('@g.us')) {
    const author = extractAuthor(msg)
    try {
      await handleJogoCommand(sock, from, author)
    } catch (err) {
      log(`Erro no !jogo: ${(err as Error).message}`, 'error')
    }
    return
  }

  await publishIncoming(sock, msg)
})
