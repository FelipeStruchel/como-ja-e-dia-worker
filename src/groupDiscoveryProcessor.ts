import { Worker } from 'bullmq'
import axios from 'axios'
import { getSocket } from './client.js'
import { config } from './config.js'
import { redisConnection } from './queues.js'
import { log } from './logger.js'
import { muteAllGroups } from './muteAllGroups.js'

async function discoverAndReport(): Promise<void> {
  const sock = getSocket()
  const participating = await sock.groupFetchAllParticipating()

  const groups = Object.values(participating).map((meta) => ({
    id: meta.id,
    subject: meta.subject ?? '',
  }))

  await axios.post(
    `${config.backendUrl}/groups/discover/ingest`,
    { groups },
    { headers: { 'x-worker-secret': config.workerApiSecret } },
  )

  const muted = await muteAllGroups(sock)
  log(`Descoberta de grupos: ${groups.length} grupos, ${muted} mutados`, 'info')
}

export function startGroupDiscoveryWorker(): Worker {
  const worker = new Worker(
    config.groupDiscoveryQueueName,
    async (job) => {
      if (job.name !== 'group-discovery') return
      await discoverAndReport()
    },
    { connection: redisConnection },
  )

  worker.on('failed', (job, err) => {
    log(`Job de descoberta de grupos ${job?.id} falhou: ${err.message}`, 'error')
  })

  return worker
}
