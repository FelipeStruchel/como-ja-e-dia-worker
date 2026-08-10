// Baileys has no wwebjs-style `chat.fetchMessages()` to pull recent history on
// demand, so we keep a small rolling buffer per chat as messages come in.
// incomingPublisher attaches this to each payload as `recentMessages`, which
// is what the backend's !analise command expects.
export interface ChatHistoryEntry {
  body: string
  type: string
  senderName: string
  author: string
}

const MAX_ENTRIES_PER_CHAT = 30

const history = new Map<string, ChatHistoryEntry[]>()

export function rememberChatHistory(chatId: string, entry: ChatHistoryEntry): void {
  if (!chatId) return
  let entries = history.get(chatId)
  if (!entries) {
    entries = []
    history.set(chatId, entries)
  }
  entries.push(entry)
  if (entries.length > MAX_ENTRIES_PER_CHAT) entries.shift()
}

export function getRecentChatHistory(chatId: string): ChatHistoryEntry[] {
  return history.get(chatId)?.slice() ?? []
}
