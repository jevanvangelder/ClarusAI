import { useState, useRef } from 'react'
import { toast } from 'sonner'
import { API_URL } from '@/config'
import { useAuth } from '@/contexts/AuthContext'
import { getActiveModuleIds, getActiveModulePrompts, getActiveEbookContent } from '@/services/chat-helpers'
import type { Chat, Message } from '@/types/chat'

interface UseChatMessagesProps {
  chats: Chat[]
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>
  activeChat: string | null
  setActiveChat: (id: string | null) => void
  activeEbookId: string | null
  isMobile: boolean
  setShowLeftSidebar: (show: boolean) => void
  setShowRightSidebar: (show: boolean) => void
}

export function useChatMessages({
  chats,
  setChats,
  activeChat,
  setActiveChat,
  activeEbookId,
  isMobile,
  setShowLeftSidebar,
  setShowRightSidebar,
}: UseChatMessagesProps) {
  const { user } = useAuth()
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) setUploadedFiles(prev => [...prev, ...Array.from(files)])
  }

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleFileButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleSend = async () => {
    if (!inputValue.trim() && uploadedFiles.length === 0) return
    if (!user) return

    if (isMobile) {
      setShowLeftSidebar(false)
      setShowRightSidebar(false)
    }

    const filesToUpload = uploadedFiles
    let userMessageContent = inputValue.trim()

    if (filesToUpload.length > 0) {
      const fileNames = filesToUpload.map(f => f.name).join(', ')
      userMessageContent = inputValue.trim()
        ? `${inputValue.trim()}\n\n📎 Bijlagen: ${fileNames}`
        : `📎 Bijlagen: ${fileNames}`
    }

    let chatId = activeChat

    // ✅ Chat aanmaken in Supabase als er nog geen actieve chat is
    if (!chatId) {
      try {
        const res = await fetch(`${API_URL}/api/chats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id, title: 'Nieuwe chat' }),
        })
        if (!res.ok) throw new Error('Failed to create chat')
        const newChatData = await res.json()

        const newChat: Chat = {
          id: newChatData.id,
          title: newChatData.title,
          messages: [],
          active: true,
        }
        setChats(prev => [newChat, ...(prev || [])])
        chatId = newChatData.id
        setActiveChat(chatId)
      } catch (error) {
        console.error('Error creating chat:', error)
        toast.error('Kon chat niet aanmaken.')
        return
      }
    }

    // ✅ User message opslaan in Supabase
    let userMessage: Message
    try {
      const res = await fetch(`${API_URL}/api/chats/${chatId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'user', content: userMessageContent }),
      })
      if (!res.ok) throw new Error('Failed to save message')
      const savedMsg = await res.json()

      userMessage = {
        id: savedMsg.id,
        role: 'user',
        content: userMessageContent,
        timestamp: new Date(savedMsg.created_at).getTime(),
      }
    } catch (error) {
      console.error('Error saving user message:', error)
      toast.error('Kon bericht niet opslaan.')
      return
    }

    // Update UI
    setChats(prev =>
      prev.map(chat =>
        chat.id === chatId
          ? { ...chat, messages: [...chat.messages, userMessage] }
          : chat
      )
    )

    const userQuestion = inputValue
    setInputValue('')
    setUploadedFiles([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
    setIsLoading(true)

    try {
      const currentChatData = chats.find(c => c.id === chatId)
      const messageHistory = currentChatData?.messages || []
      const ebookContent = await getActiveEbookContent(activeEbookId)
      const modulePrompts = await getActiveModulePrompts(user.id)

      let backendResponse

      if (filesToUpload.length > 0) {
        let messagesToSend = [...messageHistory, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content,
        }))

        if (ebookContent) {
          messagesToSend[0] = {
            ...messagesToSend[0],
            content: `${ebookContent}\n\n---\n\n⚠️ Gebruik bovenstaande context voor ALLE antwoorden.\n\n---\n\n${messagesToSend[0].content}`,
          }
        }

        const formData = new FormData()
        formData.append('content', userQuestion || 'Bestanden geüpload')
        filesToUpload.forEach(file => formData.append('files', file))
        formData.append('messages', JSON.stringify(messagesToSend))
        formData.append('active_module_ids', JSON.stringify(await getActiveModuleIds(user.id)))
        formData.append('active_module_prompts', JSON.stringify(modulePrompts))

        backendResponse = await fetch(`${API_URL}/api/chat/send-with-files`, {
          method: 'POST',
          body: formData,
        })
      } else {
        let messagesToSend = [...messageHistory, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content,
        }))

        if (ebookContent) {
          messagesToSend[0] = {
            ...messagesToSend[0],
            content: `${ebookContent}\n\n---\n\n⚠️ Gebruik bovenstaande context voor ALLE antwoorden.\n\n---\n\n${messagesToSend[0].content}`,
          }
        }

        backendResponse = await fetch(`${API_URL}/api/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: userQuestion,
            messages: messagesToSend,
            active_module_ids: await getActiveModuleIds(user.id),
            active_module_prompts: modulePrompts,
          }),
        })
      }

      if (!backendResponse.ok) throw new Error('Backend request failed')

      const data = await backendResponse.json()
      const response = data.message

      // ✅ Assistant message opslaan in Supabase
      let assistantMessage: Message
      try {
        const res = await fetch(`${API_URL}/api/chats/${chatId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'assistant', content: response }),
        })
        const savedMsg = await res.json()

        assistantMessage = {
          id: savedMsg.id,
          role: 'assistant',
          content: response,
          timestamp: new Date(savedMsg.created_at).getTime(),
        }
      } catch {
        assistantMessage = {
          id: `msg-${Date.now()}`,
          role: 'assistant',
          content: response,
          timestamp: Date.now(),
        }
      }

      setChats(prev =>
        prev.map(chat =>
          chat.id === chatId
            ? { ...chat, messages: [...chat.messages, assistantMessage] }
            : chat
        )
      )

      // ✅ Auto-titel genereren
      const chatToCheck = chats.find(c => c.id === chatId)
      if (chatToCheck?.title === 'Nieuwe chat') {
        try {
          const words = userMessage.content.split(' ').slice(0, 5).join(' ')
          const generatedTitle = words.length > 40 ? words.substring(0, 40) + '...' : words

          await fetch(`${API_URL}/api/chats/${chatId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: generatedTitle }),
          })

          setChats(prev =>
            prev.map(chat =>
              chat.id === chatId ? { ...chat, title: generatedTitle } : chat
            )
          )
        } catch (error) {
          console.error('Error generating title:', error)
        }
      }
    } catch (error) {
      toast.error('Er is een fout opgetreden bij het genereren van een antwoord.')
      console.error('Error generating response:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return {
    inputValue,
    setInputValue,
    isLoading,
    uploadedFiles,
    fileInputRef,
    textareaRef,
    handleFileUpload,
    handleRemoveFile,
    handleFileButtonClick,
    handleSend,
  }
}