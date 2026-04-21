import { describe, it, expect } from 'vitest'
import { extractBody, extractAuthor } from '../incomingPublisher.js'
import type { WAMessage } from 'baileys'

function makeMsg(overrides: Partial<WAMessage> = {}): WAMessage {
  return {
    key: { remoteJid: '120363339@g.us', fromMe: false, id: 'msg1' },
    messageTimestamp: 1700000000,
    message: null,
    ...overrides,
  } as WAMessage
}

describe('extractBody', () => {
  it('retorna conversation quando presente', () => {
    const msg = makeMsg({ message: { conversation: 'olá' } })
    expect(extractBody(msg)).toBe('olá')
  })

  it('retorna texto de extendedTextMessage', () => {
    const msg = makeMsg({ message: { extendedTextMessage: { text: 'oi' } } })
    expect(extractBody(msg)).toBe('oi')
  })

  it('retorna caption de imageMessage', () => {
    const msg = makeMsg({ message: { imageMessage: { caption: 'foto' } } })
    expect(extractBody(msg)).toBe('foto')
  })

  it('retorna string vazia quando message é null', () => {
    const msg = makeMsg({ message: null })
    expect(extractBody(msg)).toBe('')
  })
})

describe('extractAuthor', () => {
  it('retorna participant quando presente (mensagem de grupo)', () => {
    const msg = makeMsg({ key: { remoteJid: '120363@g.us', fromMe: false, id: '1', participant: '5511@s.whatsapp.net' } })
    expect(extractAuthor(msg)).toBe('5511@s.whatsapp.net')
  })

  it('retorna remoteJid quando participant ausente (mensagem direta)', () => {
    const msg = makeMsg({ key: { remoteJid: '5511@s.whatsapp.net', fromMe: false, id: '1' } })
    expect(extractAuthor(msg)).toBe('5511@s.whatsapp.net')
  })
})
