import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rememberMessage, getRememberedMessage } from '../messageCache.js'
import type { WAMessage } from 'baileys'

function makeMsg(id: string, overrides: Partial<WAMessage> = {}): WAMessage {
  return {
    key: { remoteJid: '120363339@g.us', fromMe: false, id },
    messageTimestamp: 1700000000,
    message: { conversation: 'oi' },
    ...overrides,
  } as WAMessage
}

describe('messageCache', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns null for an id that was never remembered', () => {
    expect(getRememberedMessage('never-seen')).toBeNull()
  })

  it('returns the exact message that was remembered by its key.id', () => {
    const msg = makeMsg('msg1')
    rememberMessage(msg)
    expect(getRememberedMessage('msg1')).toBe(msg)
  })

  it('ignores a message with no key.id', () => {
    const msg = makeMsg('')
    ;(msg.key as { id?: string }).id = undefined
    rememberMessage(msg)
    expect(getRememberedMessage('undefined')).toBeNull()
  })

  it('expires an entry after its TTL and returns null', () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    rememberMessage(makeMsg('expiring'))
    expect(getRememberedMessage('expiring')).not.toBeNull()
    vi.setSystemTime(16 * 60 * 1000)
    expect(getRememberedMessage('expiring')).toBeNull()
  })
})
