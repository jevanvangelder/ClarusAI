const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// ============ CHATS ============

export async function fetchChats(userId: string) {
  const res = await fetch(`${API_URL}/api/chats?user_id=${userId}`)
  if (!res.ok) throw new Error('Failed to fetch chats')
  return res.json()
}

export async function createChat(userId: string, title: string) {
  const res = await fetch(`${API_URL}/api/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, title }),
  })
  if (!res.ok) throw new Error('Failed to create chat')
  return res.json()
}

export async function updateChat(chatId: string, title: string) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error('Failed to update chat')
  return res.json()
}

export async function deleteChat(chatId: string) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete chat')
  return res.json()
}

// ============ MESSAGES ============

export async function fetchMessages(chatId: string) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}/messages`)
  if (!res.ok) throw new Error('Failed to fetch messages')
  return res.json()
}

export async function createMessage(chatId: string, role: string, content: string) {
  const res = await fetch(`${API_URL}/api/chats/${chatId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, content }),
  })
  if (!res.ok) throw new Error('Failed to create message')
  return res.json()
}

// ============ MODULES ============

export async function fetchModules(userId: string) {
  const res = await fetch(`${API_URL}/api/modules?user_id=${userId}`)
  if (!res.ok) throw new Error('Failed to fetch modules')
  return res.json()
}

export async function createModule(userId: string, name: string, systemPrompt: string, icon: string = '', description: string = '') {
  const res = await fetch(`${API_URL}/api/modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      name,
      description,
      system_prompt: systemPrompt,
      icon,
    }),
  })
  if (!res.ok) throw new Error('Failed to create module')
  return res.json()
}

export async function updateModule(moduleId: string, data: { name?: string; description?: string; system_prompt?: string; icon?: string; is_active?: boolean }) {
  const res = await fetch(`${API_URL}/api/modules/${moduleId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to update module')
  return res.json()
}

export async function deleteModule(moduleId: string) {
  const res = await fetch(`${API_URL}/api/modules/${moduleId}`, {
    method: 'DELETE',
  })
  if (!res.ok) throw new Error('Failed to delete module')
  return res.json()
}