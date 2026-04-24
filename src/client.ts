import {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  Browsers,
  fetchLatestBaileysVersion,
  type WASocket,
  type WAMessage,
} from 'baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import QRCode from 'qrcode'
import axios from 'axios'
import { rm } from 'fs/promises'
import { config } from './config.js'
import { log } from './logger.js'
import { bindContactStore } from './contactStore.js'

export type IncomingHandler = (sock: WASocket, msg: WAMessage) => Promise<void>

let currentSock: WASocket | null = null

export function getSocket(): WASocket {
  if (!currentSock) throw new Error('Socket não conectado')
  return currentSock
}

async function publishQr(qr: string): Promise<void> {
  try {
    const dataUrl = await QRCode.toDataURL(qr)
    await axios.post(
      `${config.backendUrl}/whatsapp-qr`,
      { qr: dataUrl },
      { headers: { 'x-ingest-token': config.logIngestToken }, timeout: 5000 },
    )
    log('QR publicado no backend', 'info')
  } catch (err) {
    log(`Falha ao publicar QR: ${(err as Error).message}`, 'warn')
  }
}

async function connect(onMessage: IncomingHandler, backoffMs: number): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(config.authStatePath)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    browser: Browsers.macOS('Safari'),
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  })

  currentSock = sock
  bindContactStore(sock)
  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) await publishQr(qr)

    if (connection === 'open') {
      log('WhatsApp conectado', 'success')
      backoffMs = 1000
    }

    if (connection === 'close') {
      currentSock = null
      const err = lastDisconnect?.error as Boom
      const statusCode = err?.output?.statusCode
      log(`WhatsApp: close — code=${statusCode} message="${err?.message}" data=${JSON.stringify(err?.data ?? null)}`, 'warn')
      const loggedOut = statusCode === DisconnectReason.loggedOut

      if (loggedOut) {
        log('WhatsApp: logout detectado. Limpando auth state e aguardando novo QR.', 'warn')
        await rm(config.authStatePath, { recursive: true, force: true })
        await connect(onMessage, 1000)
      } else {
        log(`WhatsApp: reconectando em ${backoffMs}ms.`, 'warn')
        await new Promise((r) => setTimeout(r, backoffMs))
        await connect(onMessage, Math.min(backoffMs * 2, 30_000))
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (msg.key.fromMe) continue
      try {
        await onMessage(sock, msg)
      } catch (err) {
        log(`Erro ao processar mensagem recebida: ${(err as Error).message}`, 'error')
      }
    }
  })
}

export async function startClient(onMessage: IncomingHandler): Promise<void> {
  await connect(onMessage, 1000)
}
