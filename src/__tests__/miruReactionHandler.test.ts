import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../redis.js', () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn(),
    getdel: vi.fn(),
    del: vi.fn(),
  })),
}))

vi.mock('axios', () => ({
  default: { post: vi.fn() },
}))

vi.mock('../config.js', () => ({
  config: {
    backendUrl: 'http://backend:3000',
    dropCaptureToken: 'test-token',
  },
}))

vi.mock('../logger.js', () => ({ log: vi.fn() }))

import { handleMiruReaction } from '../miruReactionHandler.js'
import { getRedis } from '../redis.js'
import axios from 'axios'

const mockSock = { user: { id: 'bot@s.whatsapp.net' } } as any

function makeEntry(groupId: string, reactorJid: string, messageId: string, reactionText = '❤️') {
  return {
    key: { remoteJid: groupId, participant: reactorJid, fromMe: false, id: 'reaction-key' },
    reaction: { key: { id: messageId }, text: reactionText },
  }
}

beforeEach(() => vi.clearAllMocks())

describe('handleMiruReaction', () => {
  it('ignores reactions not in groups', async () => {
    const entry = makeEntry('user@s.whatsapp.net', 'user@s.whatsapp.net', 'msg1')
    const mockRedis = { get: vi.fn(), getdel: vi.fn(), del: vi.fn() }
    vi.mocked(getRedis).mockReturnValue(mockRedis as any)

    await handleMiruReaction(mockSock, entry)
    expect(mockRedis.get).not.toHaveBeenCalled()
  })

  it('ignores reaction removal (empty text)', async () => {
    const entry = makeEntry('game@g.us', 'user@s.whatsapp.net', 'msg1', '')
    const mockRedis = { get: vi.fn(), getdel: vi.fn(), del: vi.fn() }
    vi.mocked(getRedis).mockReturnValue(mockRedis as any)

    await handleMiruReaction(mockSock, entry)
    expect(mockRedis.get).not.toHaveBeenCalled()
  })

  it('ignores when message has no active Miru drop', async () => {
    const entry = makeEntry('game@g.us', 'user@s.whatsapp.net', 'msg1')
    const mockRedis = { get: vi.fn().mockResolvedValue(null), getdel: vi.fn(), del: vi.fn() }
    vi.mocked(getRedis).mockReturnValue(mockRedis as any)

    await handleMiruReaction(mockSock, entry)
    expect(mockRedis.getdel).not.toHaveBeenCalled()
  })

  it('ignores when drop was already captured (GETDEL returns null)', async () => {
    const entry = makeEntry('game@g.us', 'user@s.whatsapp.net', 'msg1')
    const mockRedis = {
      get: vi.fn().mockResolvedValue('own1'),   // reverse lookup found
      getdel: vi.fn().mockResolvedValue(null),  // drop already gone
      del: vi.fn(),
    }
    vi.mocked(getRedis).mockReturnValue(mockRedis as any)

    await handleMiruReaction(mockSock, entry)
    expect(axios.post).not.toHaveBeenCalled()
  })

  it('calls /miru/capture when drop is active and reaction valid', async () => {
    const entry = makeEntry('game@g.us', 'user@s.whatsapp.net', 'msg1')
    const mockRedis = {
      get: vi.fn().mockResolvedValue('own1'),
      getdel: vi.fn().mockResolvedValue('{"characterId":"c1"}'),
      del: vi.fn(),
    }
    vi.mocked(getRedis).mockReturnValue(mockRedis as any)
    vi.mocked(axios.post).mockResolvedValue({ status: 200 })

    await handleMiruReaction(mockSock, entry)

    expect(axios.post).toHaveBeenCalledWith(
      'http://backend:3000/miru/capture',
      expect.objectContaining({
        ownershipId: 'own1',
        capturedBy: 'user@s.whatsapp.net',
        gameGroupId: 'game@g.us',
        rollMessageId: 'msg1',
      }),
      expect.any(Object),
    )
    expect(mockRedis.del).toHaveBeenCalledWith('miru:msg:game@g.us:msg1')
  })
})
