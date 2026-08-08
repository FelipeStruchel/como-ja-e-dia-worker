import type { WAMessage } from 'baileys'

// Baileys' `quoted` send option needs the original WAMessage object (key +
// content), not just its id — but jobs crossing the sendQueue only carry a
// bare `replyTo: string` id (the backend has no access to the live socket's
// message objects). This cache lets the worker, which does see every
// incoming WAMessage, look one back up by id when it's time to reply.
const TTL_MS = 15 * 60 * 1000
const MAX_ENTRIES = 500

interface CacheEntry {
  msg: WAMessage
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

export function rememberMessage(msg: WAMessage): void {
  const id = msg.key.id
  if (!id) return
  if (!cache.has(id) && cache.size >= MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value
    if (oldestKey !== undefined) cache.delete(oldestKey)
  }
  cache.set(id, { msg, expiresAt: Date.now() + TTL_MS })
}

export function getRememberedMessage(id: string): WAMessage | null {
  const entry = cache.get(id)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) {
    cache.delete(id)
    return null
  }
  return entry.msg
}
