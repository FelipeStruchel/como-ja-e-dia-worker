import { Worker } from 'bullmq'
import { getSocket } from './client.js'
import { config } from './config.js'
import { redisConnection } from './queues.js'
import { log } from './logger.js'
import { muteAllGroups } from './muteAllGroups.js'

export function startMuteSchedulerWorker(): Worker {
  const worker = new Worker(
    config.muteQueueName,
    async (job) => {
      if (job.name !== 'mute-all') return
      const sock = getSocket()
      const muted = await muteAllGroups(sock)
      log(`Renovação de mute: ${muted} grupos mutados`, 'info')
    },
    { connection: redisConnection },
  )

  worker.on('failed', (job, err) => {
    log(`Job de mute ${job?.id} falhou: ${err.message}`, 'error')
  })

  return worker
}
