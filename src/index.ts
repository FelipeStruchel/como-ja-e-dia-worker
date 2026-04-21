import 'dotenv/config'
import { startClient } from './client.js'
import { startSendWorker } from './sendProcessor.js'
import { startContextWorker } from './contextProcessor.js'
import { publishIncoming } from './incomingPublisher.js'
import { log } from './logger.js'

log('Worker iniciando...', 'info')

startSendWorker()
startContextWorker()

await startClient(async (sock, msg) => {
  await publishIncoming(sock, msg)
})
