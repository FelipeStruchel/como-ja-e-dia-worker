import { describe, it, expect } from 'vitest'
import { rememberChatHistory, getRecentChatHistory } from '../chatHistory.js'

function entry(body: string) {
  return { body, type: 'chat', senderName: 'Fulano', author: '5511@s.whatsapp.net' }
}

describe('chatHistory', () => {
  it('returns an empty array for a chat with no history', () => {
    expect(getRecentChatHistory('never-seen@g.us')).toEqual([])
  })

  it('returns remembered entries in insertion order, scoped per chat', () => {
    rememberChatHistory('chatA@g.us', entry('oi'))
    rememberChatHistory('chatA@g.us', entry('tudo bem?'))
    rememberChatHistory('chatB@g.us', entry('outro grupo'))

    expect(getRecentChatHistory('chatA@g.us')).toEqual([entry('oi'), entry('tudo bem?')])
    expect(getRecentChatHistory('chatB@g.us')).toEqual([entry('outro grupo')])
  })

  it('caps the buffer per chat and drops the oldest entry once full', () => {
    const chatId = 'capped@g.us'
    for (let i = 0; i < 35; i++) {
      rememberChatHistory(chatId, entry(`msg-${i}`))
    }
    const history = getRecentChatHistory(chatId)
    expect(history).toHaveLength(30)
    expect(history[0]?.body).toBe('msg-5')
    expect(history[29]?.body).toBe('msg-34')
  })

  it('ignores entries with an empty chatId', () => {
    rememberChatHistory('', entry('sem chat'))
    expect(getRecentChatHistory('')).toEqual([])
  })
})
