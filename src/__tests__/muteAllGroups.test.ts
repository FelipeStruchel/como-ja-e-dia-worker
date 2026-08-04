import { describe, it, expect, vi } from 'vitest'
import { muteAllGroups, ONE_WEEK_MS } from '../muteAllGroups.js'

describe('muteAllGroups', () => {
  it('mutes every group returned by groupFetchAllParticipating', async () => {
    const chatModify = vi.fn().mockResolvedValue(undefined)
    const sock = {
      groupFetchAllParticipating: vi.fn().mockResolvedValue({
        'a@g.us': { id: 'a@g.us' },
        'b@g.us': { id: 'b@g.us' },
      }),
      chatModify,
    } as any

    const count = await muteAllGroups(sock)

    expect(count).toBe(2)
    expect(chatModify).toHaveBeenCalledWith({ mute: ONE_WEEK_MS }, 'a@g.us')
    expect(chatModify).toHaveBeenCalledWith({ mute: ONE_WEEK_MS }, 'b@g.us')
  })

  it('continues muting remaining groups if one chatModify call fails', async () => {
    const chatModify = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
    const sock = {
      groupFetchAllParticipating: vi.fn().mockResolvedValue({
        'a@g.us': { id: 'a@g.us' },
        'b@g.us': { id: 'b@g.us' },
      }),
      chatModify,
    } as any

    const count = await muteAllGroups(sock)

    expect(count).toBe(1)
    expect(chatModify).toHaveBeenCalledTimes(2)
  })

  it('returns 0 when the account is in no groups', async () => {
    const sock = {
      groupFetchAllParticipating: vi.fn().mockResolvedValue({}),
      chatModify: vi.fn(),
    } as any

    expect(await muteAllGroups(sock)).toBe(0)
  })
})
