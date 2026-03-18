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

interface Ebook {
  id: string
  title: string
  author: string
  cover: string
  subject: string
  favorite: boolean
}

// ✅ Helper: Get active module IDs
const getActiveModuleIds = (): string[] => {
  try {
    const savedModules = localStorage.getItem('clarus-modules')
    if (!savedModules) return []
    
    const modules = JSON.parse(savedModules)
    const activeModules = modules.filter((m: any) => m.enabled)
    
    return activeModules.map((m: any) => m.id)
  } catch (error) {
    console.error('Error loading module IDs:', error)
    return []
  }
}

// ✅ Helper: Get active module prompts (DEPRECATED - backend handles this now)
const getActiveModulePrompts = (): string => {
  try {
    const savedModules = localStorage.getItem('clarus-modules')
    if (!savedModules) return ''
    
    const modules = JSON.parse(savedModules)
    const activeModules = modules.filter((m: any) => m.enabled)
    
    if (activeModules.length === 0) return ''
    
    // Combine all active module prompts
    const combinedPrompts = activeModules
      .map((m: any) => `📌 ${m.title}:\n${m.prompt}`)
      .join('\n\n---\n\n')
    
    return combinedPrompts
  } catch (error) {
    console.error('Error loading modules:', error)
    return ''
  }
}

// ✅ Helper: Get active ebook content
const getActiveEbookContent = (ebookId: string | null): string => {
  if (!ebookId) return ''
  
  try {
    const savedEbooks = localStorage.getItem('clarus-ebooks')
    if (!savedEbooks) return ''
    
    const ebooks = JSON.parse(savedEbooks)
    const activeBook = ebooks.find((b: Ebook) => b.id === ebookId)
    
    if (!activeBook) return ''
    
    return `📚 ACTIEF EBOOK: ${activeBook.title} door ${activeBook.author}\n\n⚠️ De gebruiker heeft toegang tot dit schoolboek. Gebruik de informatie uit dit boek om vragen te beantwoorden. Als de vraag gerelateerd is aan het boek, verwijs dan naar specifieke hoofdstukken of pagina's (zelfs als dit demo data is).`
  } catch (error) {
    console.error('Error loading ebook:', error)
    return ''
  }
}

function App() {
  const [chats, setChats] = useState<Chat[]>([])
  const [activeChat, setActiveChat] = useState<string | null>(null)
  const [inputValue, setInputValue] = useState('')
  const [activeFilter, setActiveFilter] = useState<'default' | 'favorite' | 'note' | 'trash'>('default')
  const [isLoading, setIsLoading] = useState(false)
  const [showLeftSidebar, setShowLeftSidebar] = useState(true)
  const [showRightSidebar, setShowRightSidebar] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null) // ✅ NIEUW: ref voor textarea hoogte-reset
  
  // ✅ Ebook state
  const [activeEbookId, setActiveEbookId] = useState<string | null>(null)
  const [isEbookModalOpen, setIsEbookModalOpen] = useState(false)
  const [activeEbook, setActiveEbook] = useState<Ebook | null>(null)

  // ✅ NEW: Settings modal state
  const [settingsOpen, setSettingsOpen] = useState(false)

  const currentChat = chats?.find(c => c.id === activeChat)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [currentChat?.messages])

  // Load chats from localStorage on mount + cleanup old trash
  useEffect(() => {
    const savedChats = localStorage.getItem('clarus-chats')
    if (savedChats) {
      try {
        const parsedChats = JSON.parse(savedChats)
        
        const now = Date.now()
        const tenDaysInMs = 10 * 24 * 60 * 60 * 1000
        
        const cleanedChats = parsedChats.filter((chat: Chat) => {
          if (chat.status === 'trash' && chat.deletedAt) {
            const daysSinceDeleted = (now - chat.deletedAt) / (1000 * 60 * 60 * 24)
            return daysSinceDeleted < 10
          }
          return true
        })
        
        setChats(cleanedChats)
        
        if (cleanedChats.length !== parsedChats.length) {
          localStorage.setItem('clarus-chats', JSON.stringify(cleanedChats))
          console.log(`Auto-deleted ${parsedChats.length - cleanedChats.length} old trash chats`)
        }
      } catch (error) {
        console.error('Error loading chats from localStorage:', error)
      }
    }
  }, [])

  // Daily cleanup check (runs every hour)
  useEffect(() => {
    const checkInterval = setInterval(() => {
      setChats(prev => {
        const now = Date.now()
        const cleanedChats = prev?.filter(chat => {
          if (chat.status === 'trash' && chat.deletedAt) {
            const daysSinceDeleted = (now - chat.deletedAt) / (1000 * 60 * 60 * 24)
            return daysSinceDeleted < 10
          }
          return true
        }) || []
        
        if (cleanedChats.length !== prev?.length) {
          console.log(`Hourly cleanup: Removed ${(prev?.length || 0) - cleanedChats.length} old trash chats`)
        }
        
        return cleanedChats
      })
    }, 60 * 60 * 1000)

    return () => clearInterval(checkInterval)
  }, [])

  // Save chats to localStorage whenever they change
  useEffect(() => {
    if (chats) {
      if (chats.length > 0) {
        localStorage.setItem('clarus-chats', JSON.stringify(chats))
      } else {
        localStorage.setItem('clarus-chats', JSON.stringify([]))
      }
    }
  }, [chats])

  // Load active chat from localStorage
  useEffect(() => {
    const savedActiveChat = localStorage.getItem('clarus-active-chat')
    if (savedActiveChat) {
      setActiveChat(savedActiveChat)
    }
  }, [])

  // Save active chat to localStorage
  useEffect(() => {
    if (activeChat) {
      localStorage.setItem('clarus-active-chat', activeChat)
    } else {
      localStorage.removeItem('clarus-active-chat')
    }
  }, [activeChat])

  // ✅ Load active ebook from localStorage
  useEffect(() => {
    const savedActiveEbook = localStorage.getItem('clarus-active-ebook')
    if (savedActiveEbook) {
      setActiveEbookId(savedActiveEbook)
    }
  }, [])

  // ✅ Save active ebook to localStorage
  useEffect(() => {
    if (activeEbookId) {
      localStorage.setItem('clarus-active-ebook', activeEbookId)
    } else {
      localStorage.removeItem('clarus-active-ebook')
    }
  }, [activeEbookId])

  // ✅ Load active ebook details
  useEffect(() => {
    if (activeEbookId) {
      try {
        const savedEbooks = localStorage.getItem('clarus-ebooks')
        if (savedEbooks) {
          const ebooks = JSON.parse(savedEbooks)
          const book = ebooks.find((b: Ebook) => b.id === activeEbookId)
          setActiveEbook(book || null)
        }
      } catch (error) {
        console.error('Error loading active ebook:', error)
      }
    } else {
      setActiveEbook(null)
    }
  }, [activeEbookId])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (files) {
      const newFiles = Array.from(files)
      setUploadedFiles(prev => [...prev, ...newFiles])
    }
  }

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleFileButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleSend = async () => {
    if (!inputValue.trim() && uploadedFiles.length === 0) return

    // Add file names to user message
    const filesToUpload = uploadedFiles
    let userMessageContent = inputValue.trim()
    
    if (filesToUpload.length > 0) {
      const fileNames = filesToUpload.map(f => f.name).join(', ')
      userMessageContent = inputValue.trim() 
        ? `${inputValue.trim()}\n\n📎 Bijlagen: ${fileNames}`
        : `📎 Bijlagen: ${fileNames}`
    }

    const userMessage: Message = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMessageContent,
      timestamp: Date.now(),
    }

    let chatId = activeChat

    if (!chatId) {
      const newChat: Chat = {
        id: `chat-${Date.now()}`,
        title: 'Nieuwe chat',
        messages: [userMessage],
        active: true,
      }
      setChats((prev) => [newChat, ...(prev || [])])
      chatId = newChat.id
      setActiveChat(chatId)
    } else {
      setChats((prev) =>
        (prev || []).map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: [...chat.messages, userMessage] }
            : chat
        )
      )
    }

    const userQuestion = inputValue
    
    setInputValue('')
    setUploadedFiles([])
    // ✅ NIEUW: Reset textarea hoogte naar 1 regel na verzenden
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
    setIsLoading(true)

    try {
      const currentChatData = chats.find(c => c.id === chatId)
      const messageHistory = currentChatData?.messages || []

      // ✅ Get active ebook content (still used for frontend context)
      const ebookContent = getActiveEbookContent(activeEbookId)

      let backendResponse

      if (filesToUpload.length > 0) {
        // ✅ Prepare messages for backend (with ebook context)
        let messagesToSend = [...messageHistory, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content
        }))
        
        // ✅ Prepend ebook context to the FIRST user message
        if (ebookContent) {
          messagesToSend[0] = {
            ...messagesToSend[0],
            content: `${ebookContent}\n\n---\n\n⚠️ Gebruik bovenstaande context voor ALLE antwoorden.\n\n---\n\n${messagesToSend[0].content}`
          }
        }

        const formData = new FormData()
        formData.append('content', userQuestion || 'Bestanden geüpload')
        
        filesToUpload.forEach(file => {
          formData.append('files', file)
        })
        
        formData.append('messages', JSON.stringify(messagesToSend))
        formData.append('active_module_ids', JSON.stringify(getActiveModuleIds())) // ✅ NEW!

        backendResponse = await fetch(`${API_URL}/api/chat/send-with-files`, {
          method: 'POST',
          body: formData,
        })
      } else {
        // ✅ Prepare messages for backend (with ebook context)
        let messagesToSend = [...messageHistory, userMessage].map(msg => ({
          role: msg.role,
          content: msg.content
        }))
        
        // ✅ Prepend ebook context to the FIRST user message
        if (ebookContent) {
          messagesToSend[0] = {
            ...messagesToSend[0],
            content: `${ebookContent}\n\n---\n\n⚠️ Gebruik bovenstaande context voor ALLE antwoorden.\n\n---\n\n${messagesToSend[0].content}`
          }
        }

        backendResponse = await fetch(`${API_URL}/api/chat/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            content: userQuestion,
            messages: messagesToSend,
            active_module_ids: getActiveModuleIds() // ✅ NEW!
          }),
        })
      }

      if (!backendResponse.ok) {
        throw new Error('Backend request failed')
      }

      const data = await backendResponse.json()
      const response = data.message

      const assistantMessage: Message = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      }

      setChats((prev) =>
        (prev || []).map((chat) =>
          chat.id === chatId
            ? { ...chat, messages: [...chat.messages, assistantMessage] }
            : chat
        )
      )

      if (chats?.find(c => c.id === chatId)?.title === 'Nieuwe chat') {
        try {
          const titlePrompt = `Geef een korte titel (max 5 woorden) voor deze chat op basis van de vraag: "${userMessage.content}". Geef ALLEEN de titel, geen andere tekst.`
          
          const titleResponse = await fetch(`${API_URL}/api/chat/send`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: titlePrompt,
              messages: [],
              active_module_ids: [] // ✅ Empty for title generation
            })
          })
          
          const titleData = await titleResponse.json()
          const generatedTitle = titleData.message.trim()
          
          setChats(prev => 
            prev?.map(chat => 
              chat.id === chatId 
                ? { ...chat, title: generatedTitle }
                : chat
            ) || []
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
  }

  const handleDeleteChat = (chatId: string) => {
    setChats(prev => prev?.filter(chat => chat.id !== chatId) || [])
    if (activeChat === chatId) {
      setActiveChat(null)
    }
    const updatedChats = chats?.filter(chat => chat.id !== chatId) || []
    localStorage.setItem('clarus-chats', JSON.stringify(updatedChats))
  }

  const handleRenameChat = (chatId: string, newTitle: string) => {
    setChats(prev =>
      prev?.map(chat =>
        chat.id === chatId ? { ...chat, title: newTitle } : chat
      ) || []
    )
  }

  const handleMoveToFavorites = (chatId: string) => {
    setChats(prev =>
      prev?.map(chat =>
        chat.id === chatId 
          ? { ...chat, status: chat.status === 'favorite' ? 'default' : 'favorite' as const }
          : chat
      ) || []
    )
  }

  const handleMoveToNotes = (chatId: string) => {
    setChats(prev =>
      prev?.map(chat =>
        chat.id === chatId 
          ? { ...chat, status: chat.status === 'note' ? 'default' : 'note' as const }
          : chat
      ) || []
    )
  }

  const handleMoveToTrash = (chatId: string) => {
    setChats(prev =>
      prev?.map(chat =>
        chat.id === chatId 
          ? { ...chat, status: 'trash' as const, deletedAt: Date.now() }
          : chat
      ) || []
    )
  }

  const handleRestoreFromTrash = (chatId: string) => {
    setChats(prev =>
      prev?.map(chat =>
        chat.id === chatId 
          ? { ...chat, status: 'default' as const, deletedAt: undefined }
          : chat
      ) || []
    )
  }

  const handlePermanentDelete = (chatId: string) => {
    setChats(prev => prev?.filter(chat => chat.id !== chatId) || [])
    if (activeChat === chatId) {
      setActiveChat(null)
    }
  }

  const filteredChats = chats?.filter(chat => {
    const chatStatus = chat.status || 'default'
    return chatStatus === activeFilter
  }) || []

  return (
    <div className="h-screen flex overflow-hidden bg-background text-foreground font-['Inter']">
      <AnimatePresence>
        {showLeftSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0"
          >
            <div className="w-64 h-full flex-shrink-0 overflow-hidden">
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
              Nieuwe chat
            </Button>
            {currentChat && (
              <h2 className="text-sm font-medium">{currentChat.title}</h2>
            )}
          </div>

          {/* ✅ Ebook Button/Badge */}
          <div className="ml-auto flex items-center gap-2">
            {activeEbook ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                <span>{activeEbook.cover}</span>
                <span className="max-w-[150px] truncate">{activeEbook.title}</span>
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
                Schoolboek kiezen
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
          <div className="max-w-4xl mx-auto p-6 space-y-4">
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
            {/* File Preview */}
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

            {/* Input Row */}
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
              >
                Bestanden
              </Button>
              <div className="flex-1 flex gap-2">
                <textarea
                  ref={textareaRef}
                  id="chat-input"
                  placeholder="Stel een vraag..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
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
                  style={{
                    height: 'auto',
                    scrollbarWidth: 'thin',
                  }}
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

      <AnimatePresence>
        {showRightSidebar && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="flex-shrink-0"
          >
            <ModulesSidebar />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ✅ Ebook Modal */}
      <EbookModal
        isOpen={isEbookModalOpen}
        onClose={() => setIsEbookModalOpen(false)}
        onSelectEbook={(ebookId) => setActiveEbookId(ebookId)}
        activeEbookId={activeEbookId}
      />

      {/* ✅ NEW: Settings Modal */}
      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  )
}

export default App