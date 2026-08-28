export interface PersistedChatMessage {
  type: 'user' | 'assistant'
  content: string
}

export interface ChatContextMessage {
  role: 'user' | 'assistant'
  content: string
}

export function boundedChatContext(messages: PersistedChatMessage[], maximum = 80): ChatContextMessage[] {
  const mapped = messages.map(message => ({ role: message.type, content: message.content }))
  if (mapped.length <= maximum) return mapped
  const retained = mapped.slice(-(maximum - 1))
  return [
    { role: 'assistant', content: `[${mapped.length - retained.length} earlier persisted messages were omitted from this model context.]` },
    ...retained,
  ]
}
