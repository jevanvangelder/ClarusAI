import { useState, useEffect } from 'react'
import { API_URL } from '@/config'
import { useAuth } from '@/contexts/AuthContext'
import type { Chat, Message } from '@/types/chat'

export function useChatActions() {
  const { user } = useAuth()
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)

  // ✅ Load chats from Supabase
  useEffect(() => {
    if (!user) return

    const loadChats = async () => {
      try {
        const res = await fetch(`${API_URL}/api/chats?user_id=${user.id}`)
        if (!res.ok) throw new Error('Failed to fetch chats')
        const data = await res.json()

        const trashRes = await fetch(`${API_URL}/api/chats/trash?user_id=${user.id}`)
        const trashData = trashRes.ok ? await trashRes.json() : []

        const mapChat = (c: any, status: string): Chat => ({
          id: c.id,
          title: c.title,
          messages: [],
          status: status as any,
          deletedAt: c.trashed_at ? new Date(c.trashed_at).getTime() : undefined,
        })

        const normalChats = data.map((c: any) => {
          let status = 'default'
          if (c.favorite) status = 'favorite'
          if (c.has_notes) status = 'note'
          return mapChat(c, status)
        })

        const trashedChats = trashData.map((c: any) => mapChat(c, 'trash'))
        const newChats = [...normalChats, ...trashedChats]

        setChats(prev => {
          const existingMessages = new Map(
            prev.map(c => [c.id, c.messages])
          )
          return newChats.map(chat => ({
            ...chat,
            messages: existingMessages.get(chat.id) || [],
          }))
        })
      } catch (error) {
        console.error('Error loading chats:', error)
      }
    }

    loadChats()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadChats()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user])

  // ✅ Load messages when active chat changes
  useEffect(() => {
    if (!activeChat) return

    const loadMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/api/chats/${activeChat}/messages`)
        if (!res.ok) return
        const data = await res.json()

        const messages: Message[] = data.map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.created_at).getTime(),
        }))

        setChats(prev =>
          prev.map(c =>
            c.id === activeChat ? { ...c, messages } : c
          )
        )
      } catch (error) {
        console.error('Error loading messages:', error)
      }
    }

    loadMessages()

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadMessages()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [activeChat])

  // ✅ Rename via Supabase
  const handleRenameChat = async (chatId: string, newTitle: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c))
    try {
      await fetch(`${API_URL}/api/chats/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
    } catch (error) {
      console.error('Error renaming chat:', error)
    }
  }

  // ✅ Favorieten via Supabase
  const handleMoveToFavorites = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId)
    if (!chat) return
    const newStatus = chat.status === 'favorite' ? 'default' : 'favorite'

    setChats(prev => prev.map(c => c.id === chatId ? { ...c, status: newStatus } : c))
    try {
      await fetch(`${API_URL}/api/chats/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          favorite: newStatus === 'favorite',
          has_notes: false,
        }),
      })
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  // ✅ Aantekeningen via Supabase
  const handleMoveToNotes = async (chatId: string) => {
    const chat = chats.find(c => c.id === chatId)
    if (!chat) return
    const newStatus = chat.status === 'note' ? 'default' : 'note'

    setChats(prev => prev.map(c => c.id === chatId ? { ...c, status: newStatus } : c))
    try {
      await fetch(`${API_URL}/api/chats/${chatId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          has_notes: newStatus === 'note',
          favorite: false,
        }),
      })
    } catch (error) {
      console.error('Error toggling notes:', error)
    }
  }

  // ✅ Prullenbak via Supabase
  const handleMoveToTrash = async (chatId: string) => {
    setChats(prev =>
      prev.map(c =>
        c.id === chatId ? { ...c, status: 'trash' as const, deletedAt: Date.now() } : c
      )
    )
    try {
      await fetch(`${API_URL}/api/chats/${chatId}/trash`, { method: 'PUT' })
    } catch (error) {
      console.error('Error trashing chat:', error)
    }
  }

  // ✅ Herstellen via Supabase
  const handleRestoreFromTrash = async (chatId: string) => {
    setChats(prev =>
      prev.map(c =>
        c.id === chatId ? { ...c, status: 'default' as const, deletedAt: undefined } : c
      )
    )
    try {
      await fetch(`${API_URL}/api/chats/${chatId}/restore`, { method: 'PUT' })
    } catch (error) {
      console.error('Error restoring chat:', error)
    }
  }

  // ✅ Permanent verwijderen via Supabase
  const handlePermanentDelete = async (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId))
    if (activeChat === chatId) setActiveChat(null)
    try {
      await fetch(`${API_URL}/api/chats/${chatId}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Error permanently deleting chat:', error)
    }
  }

  return {
    chats,
    setChats,
    activeChat,
    setActiveChat,
    handleRenameChat,
    handleMoveToFavorites,
    handleMoveToNotes,
    handleMoveToTrash,
    handleRestoreFromTrash,
    handlePermanentDelete,
  }
}