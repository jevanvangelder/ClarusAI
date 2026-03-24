import { useState, useRef, useEffect } from 'react'
import { ChatSidebar } from '@/components/ChatSidebar'
import { ModulesSidebar } from '@/components/ModulesSidebar'
import { EbookModal } from '@/components/EbookModal'
import { SettingsModal } from '@/components/SettingsModal'
import { ChatMessage } from '@/components/ChatMessage'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { PaperPlaneRight, CaretLeft, CaretRight, X, Gear } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { API_URL } from './config'
import { useAuth } from '@/contexts/AuthContext'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

interface Chat {
  id: string
  title: string
  messages: Message[]
  active?: boolean
  status?: 'default' | 'favorite' | 'note' | 'trash'
  deletedAt?: number
}

// ✅ Helper: Get active module IDs from Supabase via API
const getActiveModuleIds = async (userId: string): Promise<string[]> => {
  try {
    const res = await fetch(`${API_URL}/api/modules?user_id=${userId}`)
    if (!res.ok) return []
    const modules = await res.json()
    return modules.filter((m: any) => m.is_active).map((m: any) => m.id)
  } catch (error) {
    console.error('Error loading module IDs:', error)
    return []
  }
}

// ✅ Helper: Get active module prompts from Supabase via API
const getActiveModulePrompts = async (userId: string): Promise<string[]> => {
  try {
    const res = await fetch(`${API_URL}/api/modules?user_id=${userId}`)
    if (!res.ok) return []
    const modules = await res.json()
    const activeModules = modules.filter((m: any) => m.is_active)
    if (activeModules.length === 0) return []
    return activeModules.map((m: any) => `📌 ${m.name}:\n${m.system_prompt}`)
  } catch (error) {
    console.error('Error loading modules:', error)
    return []
  }
}

// ✅ Helper: Get active ebook content from Supabase
const getActiveEbookContent = async (ebookId: string | null): Promise<string> => {
  if (!ebookId) return ''
  try {
    const res = await fetch(`${API_URL}/api/ebooks/${ebookId}/text`)
    if (!res.ok) return ''
    const data = await res.json()
    if (!data.text || data.text_length === 0) return ''

    // Beperk tekst voor AI context (max 50K characters)
    const maxLength = 50000
    const text = data.text.length > maxLength
      ? data.text.substring(0, maxLength) + '\n\n[... rest van het boek afgekort ...]'
      : data.text

    return `📚 ACTIEF EBOOK: "${data.title}" door ${data.author}\n\nHieronder staat de inhoud van het schoolboek:\n\n${text}\n\n---\n\n⚠️ INSTRUCTIE: De gebruiker heeft dit schoolboek actief. Gebruik de bovenstaande tekst om vragen te beantwoorden. Verwijs naar specifieke pagina's of hoofdstukken uit het boek wanneer relevant.`
  } catch (error) {
    console.error('Error loading ebook content:', error)
    return ''
  }
}

function App() {
  const { user } = useAuth()
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [activeFilter, setActiveFilter] = useState<'default' | 'favorite' | 'note' | 'trash'>('default')
  const [isLoading, setIsLoading] = useState(false)
  const [showLeftSidebar, setShowLeftSidebar] = useState(() => window.innerWidth >= 768)
  const [showRightSidebar, setShowRightSidebar] = useState(() => window.innerWidth >= 768)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [activeEbookId, setActiveEbookId] = useState<string | null>(null)
  const [isEbookModalOpen, setIsEbookModalOpen] = useState(false)
  const [activeEbookTitle, setActiveEbookTitle] = useState<string | null>(null)
  const [activeEbookEmoji, setActiveEbookEmoji] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const currentChat = chats?.find(c => c.id === activeChat)

  // ✅ Resize listener
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // ✅ Dynamic viewport height
  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01
      document.documentElement.style.setProperty('--vh', `${vh}px`)
    }
    setVh()
    window.addEventListener('resize', setVh)
    return () => window.removeEventListener('resize', setVh)
  }, [])

  // ✅ Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentChat?.messages])

  // ✅ FIX: Load chats from Supabase (bewaart bestaande messages + herlaadt bij tab switch)
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

  // ✅ FIX: Load messages when active chat changes OR when returning to tab
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

  // ✅ Load active ebook info from Supabase
  useEffect(() => {
    const savedActiveEbook = localStorage.getItem('clarus-active-ebook')
    if (savedActiveEbook) setActiveEbookId(savedActiveEbook)
  }, [])

  useEffect(() => {
    if (activeEbookId) {
      localStorage.setItem('clarus-active-ebook', activeEbookId)
      // Haal ebook info op van Supabase
      const loadEbookInfo = async () => {
        try {
          const res = await fetch(`${API_URL}/api/ebooks/${activeEbookId}/text`)
          if (res.ok) {
            const data = await res.json()
            setActiveEbookTitle(data.title)
            setActiveEbookEmoji('📚')
          }
        } catch (error) {
          console.error('Error loading ebook info:', error)
        }
      }
      loadEbookInfo()
    } else {
      localStorage.removeItem('clarus-active-ebook')
      setActiveEbookTitle(null)
      setActiveEbookEmoji(null)
    }
  }, [activeEbookId])

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

      // ✅ Auto-titel genereren zonder extra API call
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

  const handleChatSelect = (chatId: string) => {
    setActiveChat(chatId)
    if (isMobile) setShowLeftSidebar(false)
  }

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

  const handleDeleteChat = handlePermanentDelete

  const filteredChats = chats?.filter(chat => {
    const chatStatus = chat.status || 'default'
    return chatStatus === activeFilter
  }) || []

  return (
    <div
      className="flex overflow-hidden bg-background text-foreground font-['Inter']"
      style={{ height: 'calc(var(--vh, 1vh) * 100)' }}
    >
      {isMobile && showLeftSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowLeftSidebar(false)}
        />
      )}

      <AnimatePresence>
        {showLeftSidebar && (
          <motion.div
            initial={isMobile ? { x: -320 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 256, opacity: 1 }}
            exit={isMobile ? { x: -320 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={
              isMobile
                ? "fixed left-0 top-0 h-full w-[85vw] max-w-[320px] z-50"
                : "flex-shrink-0"
            }
          >
            <div className={isMobile ? "w-full h-full" : "w-64 h-full flex-shrink-0 overflow-hidden"}>
              <ChatSidebar
                chats={filteredChats}
                onChatSelect={handleChatSelect}
                activeChat={activeChat}
                onDeleteChat={handleDeleteChat}
                onRenameChat={handleRenameChat}
                onMoveToFavorites={handleMoveToFavorites}
                onMoveToNotes={handleMoveToNotes}
                onMoveToTrash={handleMoveToTrash}
                onRestoreFromTrash={handleRestoreFromTrash}
                onPermanentDelete={handlePermanentDelete}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                onSettingsClick={() => setSettingsOpen(true)}
                onClose={() => setShowLeftSidebar(false)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="h-14 border-b border-border flex items-center px-4 gap-4 flex-shrink-0">
          <button
            onClick={() => setShowLeftSidebar(!showLeftSidebar)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {showLeftSidebar ? <CaretLeft size={20} /> : <CaretRight size={20} />}
          </button>

          <div className="flex items-center gap-3">
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setActiveChat(null)
                setInputValue('')
              }}
              className="gap-2"
            >
              <span className="text-lg">+</span>
              <span className="hidden md:inline">Nieuwe chat</span>
            </Button>
            {currentChat && (
              <h2 className="text-sm font-medium hidden md:block">{currentChat.title}</h2>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeEbookId && activeEbookTitle ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                <span>{activeEbookEmoji || '📚'}</span>
                <span className="max-w-[150px] truncate hidden md:inline">{activeEbookTitle}</span>
                <button
                  onClick={() => setActiveEbookId(null)}
                  className="ml-1 hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors"
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEbookModalOpen(true)}
                className="gap-2"
              >
                <span>📚</span>
                <span className="hidden md:inline">Schoolboek kiezen</span>
              </Button>
            )}
          </div>

          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {showRightSidebar ? <CaretRight size={20} /> : <CaretLeft size={20} />}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
            {!currentChat?.messages.length && (
              <div className="text-center text-muted-foreground py-12">
                <p className="text-lg">Start een nieuw gesprek</p>
                <p className="text-sm mt-2">Stel een vraag om te beginnen</p>
              </div>
            )}

            {currentChat?.messages.map((message) => (
              <ChatMessage
                key={message.id}
                role={message.role}
                content={message.content}
              />
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-lg px-4 py-3">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-border p-4 flex-shrink-0 bg-background">
          <div className="max-w-4xl mx-auto space-y-3">
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm"
                  >
                    <span className="text-lg">
                      {file.name.endsWith('.pdf') && '📄'}
                      {file.name.endsWith('.docx') && '📝'}
                      {file.name.endsWith('.pptx') && '📊'}
                      {file.name.endsWith('.txt') && '📋'}
                      {(file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) && '🖼️'}
                    </span>
                    <span className="max-w-[200px] truncate">{file.name}</span>
                    <span className="text-muted-foreground text-xs">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                    <button
                      onClick={() => handleRemoveFile(index)}
                      className="ml-2 text-red-500 hover:text-red-700 transition-colors"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="flex-shrink-0"
                onClick={handleFileButtonClick}
                aria-label="Bestanden"
              >
                <span className="md:hidden">📎</span>
                <span className="hidden md:inline">Bestanden</span>
              </Button>
              <div className="flex-1 flex gap-2">
                <textarea
                  ref={textareaRef}
                  id="chat-input"
                  placeholder="Stel een vraag..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  rows={1}
                  disabled={isLoading}
                  className="
                    flex-1 bg-card border border-border rounded-md px-3 py-2
                    text-sm resize-none overflow-y-auto
                    focus:outline-none focus:ring-2 focus:ring-ring
                    disabled:cursor-not-allowed disabled:opacity-50
                    min-h-[40px] max-h-[120px]
                  "
                  style={{ height: 'auto', scrollbarWidth: 'thin' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement
                    target.style.height = 'auto'
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px'
                  }}
                />
                <Button
                  onClick={handleSend}
                  disabled={(!inputValue.trim() && uploadedFiles.length === 0) || isLoading}
                  className="flex-shrink-0"
                >
                  <PaperPlaneRight size={18} weight="fill" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isMobile && showRightSidebar && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setShowRightSidebar(false)}
        />
      )}

      <AnimatePresence>
        {showRightSidebar && (
          <motion.div
            initial={isMobile ? { x: 320 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
            exit={isMobile ? { x: 320 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={
              isMobile
                ? "fixed right-0 top-0 h-full w-[85vw] max-w-[360px] z-50"
                : "flex-shrink-0"
            }
          >
            <ModulesSidebar onClose={() => setShowRightSidebar(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      <EbookModal
        isOpen={isEbookModalOpen}
        onClose={() => setIsEbookModalOpen(false)}
        onSelectEbook={(ebookId) => setActiveEbookId(ebookId)}
        activeEbookId={activeEbookId}
      />

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

export default App