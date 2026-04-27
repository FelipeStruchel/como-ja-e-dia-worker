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
})
