// como-ja-e-dia-worker/src/__tests__/reactionHandler.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dos módulos antes do import do handler
vi.mock('../redis.js', () => ({
  getRedis: vi.fn(),
}))
vi.mock('axios', () => ({
  default: { post: vi.fn() },
}))
vi.mock('../logger.js', () => ({
  log: vi.fn(),
}))
vi.mock('../config.js', () => ({
  config: {
    backendUrl: 'http://backend:3000',
    dropCaptureToken: 'test-token',
    dropActiveTtlSec: 900,
  },
}))

import { handleReaction } from '../reactionHandler.js'
import { getRedis } from '../redis.js'
import axios from 'axios'

const mockRedis = {
  getdel: vi.fn(),
  set: vi.fn(),
}

const mockSock = {
  user: { id: 'bot@s.whatsapp.net' },
} as any

beforeEach(() => {
  vi.clearAllMocks()
  ;(getRedis as ReturnType<typeof vi.fn>).mockReturnValue(mockRedis)
})

describe('handleReaction', () => {
  const groupId = '123@g.us'
  const validEntry = {
    key: {
      remoteJid: groupId,
      participant: 'user1@s.whatsapp.net',
      fromMe: false,
    },
    reaction: {
      key: { id: 'msg-abc-123' },
      text: '👍',
    },
  }

  const activeDrop = {
    dropId: 'drop-1',
    pokemonId: 25,
    messageId: 'msg-abc-123',
  }

  it('ignores reactions from the bot (fromMe=true)', async () => {
    await handleReaction(mockSock, { ...validEntry, key: { ...validEntry.key, fromMe: true } })
    expect(mockRedis.getdel).not.toHaveBeenCalled()
  })

  it('ignores reactions on non-group messages', async () => {
    const dm = { ...validEntry, key: { ...validEntry.key, remoteJid: 'user@s.whatsapp.net' } }
    await handleReaction(mockSock, dm)
    expect(mockRedis.getdel).not.toHaveBeenCalled()
  })

  it('ignores reaction removal (empty text)', async () => {
    const removal = { ...validEntry, reaction: { ...validEntry.reaction, text: '' } }
    await handleReaction(mockSock, removal)
    expect(mockRedis.getdel).not.toHaveBeenCalled()
  })

  it('does nothing when no active drop in Redis', async () => {
    mockRedis.getdel.mockResolvedValue(null)
    await handleReaction(mockSock, validEntry)
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('restores key and does nothing when messageId has not been set yet', async () => {
    const dropWithoutMessageId = { dropId: 'drop-1', pokemonId: 25 }
    mockRedis.getdel.mockResolvedValue(JSON.stringify(dropWithoutMessageId))
    await handleReaction(mockSock, validEntry)
    expect(mockRedis.set).toHaveBeenCalled()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('restores key when reaction is for a different message', async () => {
    mockRedis.getdel.mockResolvedValue(
      JSON.stringify({ ...activeDrop, messageId: 'OTHER-MSG-ID' })
    )
    await handleReaction(mockSock, validEntry)
    expect(mockRedis.set).toHaveBeenCalled()
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('calls backend capture when reaction matches active drop', async () => {
    mockRedis.getdel.mockResolvedValue(JSON.stringify(activeDrop))
    ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ok: true } })
    await handleReaction(mockSock, validEntry)
    expect(axios.post).toHaveBeenCalledWith(
      'http://backend:3000/drops/capture',
      {
        dropId: 'drop-1',
        capturedBy: 'user1@s.whatsapp.net',
        groupId,
      },
      expect.objectContaining({ headers: { 'x-drop-token': 'test-token' } })
    )
  })

  it('does not re-throw on 409 (already captured by another)', async () => {
    mockRedis.getdel.mockResolvedValue(JSON.stringify(activeDrop))
    const err = Object.assign(new Error('conflict'), { response: { status: 409 } })
    ;(axios.post as ReturnType<typeof vi.fn>).mockRejectedValue(err)
    await expect(handleReaction(mockSock, validEntry)).resolves.toBeUndefined()
  })

  describe('forcespawn spawner lockout', () => {
    const spawnerJid = 'user1@s.whatsapp.net' // same as validEntry.key.participant
    const now = Date.now()
    const forceDrop = {
      dropId: 'drop-force-1',
      pokemonId: 25,
      messageId: 'msg-abc-123',
      spawnedBy: spawnerJid,
      spawnerUnlocksAt: now + 300_000,
      expiresAt: now + 900_000,
    }

    it('restores key and calls spawner-blocked when spawner reacts during lockout', async () => {
      mockRedis.getdel.mockResolvedValue(JSON.stringify(forceDrop))
      ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ok: true } })

      await handleReaction(mockSock, validEntry)

      expect(mockRedis.set).toHaveBeenCalledWith(
        `drop:active:${groupId}`,
        JSON.stringify(forceDrop),
        'EX',
        expect.any(Number)
      )
      expect(axios.post).toHaveBeenCalledWith(
        'http://backend:3000/drops/spawner-blocked',
        { groupId, reactorJid: spawnerJid, unlocksAt: forceDrop.spawnerUnlocksAt },
        expect.objectContaining({ headers: { 'x-drop-token': 'test-token' } })
      )
      // Must NOT call /drops/capture
      expect(axios.post).not.toHaveBeenCalledWith(
        expect.stringContaining('/drops/capture'),
        expect.anything(),
        expect.anything()
      )
    })

    it('restored TTL is positive and based on expiresAt', async () => {
      const snapNow = Date.now()
      mockRedis.getdel.mockResolvedValue(JSON.stringify({
        ...forceDrop,
        expiresAt: snapNow + 600_000,
      }))
      ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ok: true } })

      await handleReaction(mockSock, validEntry)

      const setCall = (mockRedis.set as ReturnType<typeof vi.fn>).mock.calls[0]
      const ttl = setCall[3]
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(600)
    })

    it('allows capture after spawnerUnlocksAt has passed', async () => {
      const expiredDrop = {
        ...forceDrop,
        spawnerUnlocksAt: Date.now() - 1, // already expired
      }
      mockRedis.getdel.mockResolvedValue(JSON.stringify(expiredDrop))
      ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ok: true } })

      await handleReaction(mockSock, validEntry)

      expect(axios.post).toHaveBeenCalledWith(
        'http://backend:3000/drops/capture',
        expect.objectContaining({ dropId: 'drop-force-1' }),
        expect.anything()
      )
    })

    it('allows non-spawner to capture a forcespawn drop immediately', async () => {
      const otherReactor = {
        ...validEntry,
        key: { ...validEntry.key, participant: 'other-user@s.whatsapp.net' },
      }
      mockRedis.getdel.mockResolvedValue(JSON.stringify(forceDrop))
      ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ok: true } })

      await handleReaction(mockSock, otherReactor)

      expect(axios.post).toHaveBeenCalledWith(
        'http://backend:3000/drops/capture',
        expect.objectContaining({ capturedBy: 'other-user@s.whatsapp.net' }),
        expect.anything()
      )
    })

    it('does not call spawner-blocked for a normal drop without spawnedBy', async () => {
      const normalDrop = { dropId: 'drop-1', pokemonId: 25, messageId: 'msg-abc-123', expiresAt: Date.now() + 900_000 }
      mockRedis.getdel.mockResolvedValue(JSON.stringify(normalDrop))
      ;(axios.post as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { ok: true } })

      await handleReaction(mockSock, validEntry)

      expect(axios.post).toHaveBeenCalledWith(
        'http://backend:3000/drops/capture',
        expect.anything(),
        expect.anything()
      )
      expect(axios.post).not.toHaveBeenCalledWith(
        expect.stringContaining('spawner-blocked'),
        expect.anything(),
        expect.anything()
      )
    })
  })
})
