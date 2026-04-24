import type { WASocket, Contact } from 'baileys'

const contacts = new Map<string, Contact>()

export function bindContactStore(sock: WASocket): void {
  sock.ev.on('contacts.upsert', (list) => {
    for (const c of list) {
      contacts.set(c.id, c)
    }
  })

  sock.ev.on('contacts.update', (updates) => {
    for (const patch of updates) {
      if (!patch.id) continue
      const existing = contacts.get(patch.id) ?? { id: patch.id }
      contacts.set(patch.id, { ...existing, ...patch })
    }
  })
}

export function resolveContactName(jid: string): string | undefined {
  const c = contacts.get(jid)
  return c?.name ?? c?.notify ?? c?.verifiedName
}
