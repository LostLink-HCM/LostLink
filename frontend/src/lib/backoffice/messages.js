export const MESSAGE_LIMIT = 2000

export const createEmptyMessageState = () => ({
  contacts: [],
  threads: [],
  drafts: {},
  activeId: null,
})

export function normalizeInbox(data, previous = createEmptyMessageState()) {
  const contacts = Array.isArray(data?.contacts) ? data.contacts : []
  const threads = (data?.threads || []).map((thread) => {
    const existing = previous.threads.find((item) => item.id === thread.id)
    const lastMessage = thread.lastMessage
    const alreadyLoaded =
      lastMessage && existing?.messages?.some((item) => item.id === lastMessage.id)
    const messages = lastMessage
      ? alreadyLoaded
        ? existing.messages
        : existing?.messages?.length
          ? [...existing.messages, lastMessage]
          : [lastMessage]
      : (existing?.messages ?? thread.messages ?? [])
    return {
      ...thread,
      messages,
      lastMessage: lastMessage ?? existing?.lastMessage ?? null,
      context: thread.context ?? null,
    }
  })
  return {
    ...previous,
    contacts,
    threads,
    activeId: threads.some((thread) => thread.id === previous.activeId) ? previous.activeId : null,
  }
}

export function mergeConversation(state, thread) {
  const contact = thread.contact
  const contacts = contact
    ? [...state.contacts.filter((item) => item.id !== contact.id), contact]
    : state.contacts
  const existing = state.threads.find((item) => item.id === thread.id)
  const mergedThread = {
    ...existing,
    ...thread,
    contactId: thread.contactId ?? contact?.id ?? existing?.contactId,
    messages: thread.messages ?? existing?.messages ?? [],
  }
  return {
    ...state,
    contacts,
    threads: [mergedThread, ...state.threads.filter((item) => item.id !== thread.id)],
    activeId: thread.id,
  }
}

export function appendRemoteMessage(state, message) {
  if (!message?.conversationId) return state
  return {
    ...state,
    threads: state.threads.map((thread) => {
      if (thread.id !== message.conversationId) return thread
      if (thread.messages.some((item) => item.id === message.id)) return thread
      return {
        ...thread,
        lastMessage: message,
        unread: message.sender === 'me' || state.activeId === thread.id ? 0 : thread.unread + 1,
        messages: [...thread.messages, message],
      }
    }),
  }
}

export function replaceThread(state, threadId, updates) {
  return {
    ...state,
    threads: state.threads.map((thread) =>
      thread.id === threadId ? { ...thread, ...updates } : thread
    ),
  }
}

export function contactName(contact) {
  return contact?.role === 'admin' ? 'Admin' : contact?.name || 'Người dùng'
}

export function openThread(state, threadId) {
  if (!state.threads.some((thread) => thread.id === threadId)) return state
  return {
    ...state,
    activeId: threadId,
    threads: state.threads.map((thread) =>
      thread.id === threadId ? { ...thread, unread: 0 } : thread
    ),
  }
}

export function markThreadUnread(state, threadId) {
  if (!state.threads.some((thread) => thread.id === threadId)) return state
  return {
    ...state,
    threads: state.threads.map((thread) =>
      thread.id === threadId ? { ...thread, unread: Math.max(1, thread.unread) } : thread
    ),
  }
}

export function startThread(state, contactId, now = Date.now()) {
  const contact = state.contacts.find((entry) => entry.id === contactId)
  if (!contact || !['user', 'admin', 'moderator'].includes(contact.role)) return state

  const existing = state.threads.find((thread) => thread.contactId === contactId)
  if (existing) return openThread(state, existing.id)

  const thread = {
    id: `thread-${contactId}`,
    contactId,
    unread: 0,
    priority: false,
    createdAt: new Date(now).toISOString(),
    context: null,
    messages: [],
  }

  return { ...state, threads: [thread, ...state.threads], activeId: thread.id }
}

export function sendMessage(state, threadId, now = Date.now()) {
  const text = (state.drafts[threadId] || '').trim()
  const thread = state.threads.find((entry) => entry.id === threadId)
  if (!text || text.length > MESSAGE_LIMIT || !thread) return state

  return {
    ...state,
    drafts: { ...state.drafts, [threadId]: '' },
    threads: state.threads.map((entry) =>
      entry.id === threadId
        ? {
            ...entry,
            unread: 0,
            messages: [
              ...entry.messages,
              {
                id: `${threadId}-${now}-${entry.messages.length}`,
                sender: 'me',
                text,
                createdAt: new Date(now).toISOString(),
                local: true,
              },
            ],
          }
        : entry
    ),
  }
}

export function filterThreads(state, { role = '', query = '', unreadOnly = false }) {
  const needle = query.trim().toLocaleLowerCase('vi')

  return state.threads
    .filter((thread) => {
      const contact = state.contacts.find((entry) => entry.id === thread.contactId)
      if (!contact || (role && contact.role !== role) || (unreadOnly && !thread.unread)) {
        return false
      }

      return (
        !needle ||
        `${contactName(contact)} ${contact.email} ${thread.context?.code || ''} ${thread.context?.title || ''}`
          .toLocaleLowerCase('vi')
          .includes(needle)
      )
    })
    .sort((left, right) => {
      if (left.priority !== right.priority) return Number(right.priority) - Number(left.priority)
      return (
        Date.parse(right.messages.at(-1)?.createdAt || right.createdAt) -
        Date.parse(left.messages.at(-1)?.createdAt || left.createdAt)
      )
    })
}
