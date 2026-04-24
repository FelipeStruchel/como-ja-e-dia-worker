import { Worker } from 'bullmq'
import axios from 'axios'
import { getSocket } from './client.js'
import { resolveContactName } from './contactStore.js'
import { config } from './config.js'
import { redisConnection } from './queues.js'
import { log } from './logger.js'

interface Member {
  id: string
  name: string
  pushname: string
  displayName: string
  number: string
  isAdmin: boolean
  profilePicUrl: string
}

function idUser(jid: string): string {
  return jid.split('@')[0] ?? ''
}

async function fetchContext(groupId: string): Promise<void> {
  const sock = getSocket()
  const metadata = await sock.groupMetadata(groupId)

  const members: Member[] = []
  for (const p of metadata.participants) {
    const jid = p.id
    let profilePicUrl = ''
    try {
      profilePicUrl = (await sock.profilePictureUrl(jid, 'image')) ?? ''
    } catch {
      // foto não disponível
    }

    const number = idUser(jid)
    const name = resolveContactName(jid) ?? number
    members.push({
      id: jid,
      name,
      pushname: name,
      displayName: name,
      number,
      isAdmin: p.admin === 'admin' || p.admin === 'superadmin',
      profilePicUrl,
    })
  }

  const payload = {
    groupId,
    subject: metadata.subject ?? '',
    description: metadata.desc ?? '',
    members,
  }

  await axios.post(`${config.backendUrl}/context/ingest`, payload, {
    headers: { 'x-context-token': config.logIngestToken },
  })
  log(`context: enviado ${members.length} membros do grupo ${groupId}`, 'info')
}

export function startContextWorker(): Worker {
  const worker = new Worker(
    config.groupContextQueueName,
    async (job) => {
      const { groupId } = job.data as { groupId?: string }
      if (!groupId) return
      await fetchContext(groupId)
    },
    { connection: redisConnection },
  )

  worker.on('active', (job) => {
    log(`Job de contexto ${job.id} iniciado para ${(job.data as { groupId?: string }).groupId}`, 'info')
  })

  worker.on('failed', (job, err) => {
    log(`Job de contexto ${job?.id} falhou: ${err.message}`, 'error')
  })

  worker.on('error', (err) => {
    log(`Worker de contexto erro: ${err.message}`, 'error')
  })

  worker.on('stalled', (jobId) => {
    log(`Job de contexto ${jobId} ficou stalled`, 'warn')
  })

  return worker
}
