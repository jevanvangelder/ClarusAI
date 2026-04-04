import { useState, useRef, useEffect } from 'react'
import { ChatSidebar } from '@/components/ChatSidebar'
import { ModulesSidebar } from '@/components/ModulesSidebar'
import { EbookModal } from '@/components/EbookModal'
import { SettingsModal } from '@/components/SettingsModal'
import { ChatMessage } from '@/components/ChatMessage'
import { Button } from '@/components/ui/button'
import { PaperPlaneRight, CaretLeft, CaretRight, X } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { API_URL } from './config'
import { useChatActions } from '@/hooks/useChatActions'
import { useChatMessages } from '@/hooks/useChatMessages'

function App() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  const [activeFilter, setActiveFilter] = useState<'default' | 'favorite' | 'note' | 'trash'>('default')
  const [showLeftSidebar, setShowLeftSidebar] = useState(() => window.innerWidth >= 768)
  const [showRightSidebar, setShowRightSidebar] = useState(() => window.innerWidth >= 768)
  const scrollRef = useRef<HTMLDivElement>(null)

  const [activeEbookId, setActiveEbookId] = useState<string | null>(null)
  const [isEbookModalOpen, setIsEbookModalOpen] = useState(false)
  const [activeEbookTitle, setActiveEbookTitle] = useState<string | null>(null)
  const [activeEbookEmoji, setActiveEbookEmoji] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const {
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
  } = useChatActions()

  const {
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
  } = useChatMessages({
    chats,
    setChats,
    activeChat,
    setActiveChat,
    activeEbookId,
    isMobile,
    setShowLeftSidebar,
    setShowRightSidebar,
  })

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

  // ✅ Load active ebook info
  useEffect(() => {
    const savedActiveEbook = localStorage.getItem('clarus-active-ebook')
    if (savedActiveEbook) setActiveEbookId(savedActiveEbook)
  }, [])

  useEffect(() => {
    if (activeEbookId) {
      localStorage.setItem('clarus-active-ebook', activeEbookId)
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

  // ✅ Analyse-prompt oppakken vanuit Analyse-pagina
  useEffect(() => {
    const analysePrompt = localStorage.getItem('clarus-analyse-prompt')
    if (analysePrompt) {
      localStorage.removeItem('clarus-analyse-prompt')
      setTimeout(() => {
        setActiveChat(null)
        setInputValue(analysePrompt)
      }, 400)
    }
  }, [])

  const handleChatSelect = (chatId: string) => {
    setActiveChat(chatId)
    if (isMobile) setShowLeftSidebar(false)
  }

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
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowLeftSidebar(false)} />
      )}

      <AnimatePresence>
        {showLeftSidebar && (
          <motion.div
            initial={isMobile ? { x: -320 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 256, opacity: 1 }}
            exit={isMobile ? { x: -320 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={isMobile ? "fixed left-0 top-0 h-full w-[85vw] max-w-[320px] z-50" : "flex-shrink-0"}
          >
            <div className={isMobile ? "w-full h-full" : "w-64 h-full flex-shrink-0 overflow-hidden"}>
              <ChatSidebar
                chats={filteredChats}
                onChatSelect={handleChatSelect}
                activeChat={activeChat}
                onDeleteChat={handlePermanentDelete}
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
        {/* Top Bar */}
        <div className="h-14 border-b border-border flex items-center px-4 gap-4 flex-shrink-0">
          {/* Dashboard terugknop */}
          <a
            href="/"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm font-medium mr-1"
            title="Terug naar Dashboard"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
            <span className="hidden md:inline">Dashboard</span>
          </a>

          {/* Sidebar toggle */}
          <button onClick={() => setShowLeftSidebar(!showLeftSidebar)} className="text-muted-foreground hover:text-foreground transition-colors">
            {showLeftSidebar ? <CaretLeft size={20} /> : <CaretRight size={20} />}
          </button>

          <div className="flex items-center gap-3">
            <Button variant="default" size="sm" onClick={() => { setActiveChat(null); setInputValue('') }} className="gap-2">
              <span className="text-lg">+</span>
              <span className="hidden md:inline">Nieuwe chat</span>
            </Button>
            {currentChat && <h2 className="text-sm font-medium hidden md:block">{currentChat.title}</h2>}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {activeEbookId && activeEbookTitle ? (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium">
                <span>{activeEbookEmoji || '📚'}</span>
                <span className="max-w-[150px] truncate hidden md:inline">{activeEbookTitle}</span>
                <button onClick={() => setActiveEbookId(null)} className="ml-1 hover:bg-white/20 rounded-full w-4 h-4 flex items-center justify-center transition-colors">
                  <X size={12} weight="bold" />
                </button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setIsEbookModalOpen(true)} className="gap-2">
                <span>📚</span>
                <span className="hidden md:inline">Schoolboek kiezen</span>
              </Button>
            )}
          </div>

          <button onClick={() => setShowRightSidebar(!showRightSidebar)} className="text-muted-foreground hover:text-foreground transition-colors">
            {showRightSidebar ? <CaretRight size={20} /> : <CaretLeft size={20} />}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-4">
            {!currentChat?.messages.length && (
              <div className="text-center text-muted-foreground py-12">
                <p className="text-lg">Start een nieuw gesprek</p>
                <p className="text-sm mt-2">Stel een vraag om te beginnen</p>
              </div>
            )}
            {currentChat?.messages.map((message) => (
              <ChatMessage key={message.id} role={message.role} content={message.content} />
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

        {/* Input Area */}
        <div className="border-t border-border p-4 flex-shrink-0 bg-background">
          <div className="max-w-4xl mx-auto space-y-3">
            {uploadedFiles.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 text-sm">
                    <span className="text-lg">
                      {file.name.endsWith('.pdf') && '📄'}
                      {file.name.endsWith('.docx') && '📝'}
                      {file.name.endsWith('.pptx') && '📊'}
                      {file.name.endsWith('.txt') && '📋'}
                      {(file.name.endsWith('.png') || file.name.endsWith('.jpg') || file.name.endsWith('.jpeg')) && '🖼️'}
                    </span>
                    <span className="max-w-[200px] truncate">{file.name}</span>
                    <span className="text-muted-foreground text-xs">({(file.size / 1024).toFixed(1)} KB)</span>
                    <button onClick={() => handleRemoveFile(index)} className="ml-2 text-red-500 hover:text-red-700 transition-colors">✕</button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <input ref={fileInputRef} type="file" multiple accept=".pdf,.docx,.pptx,.txt,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
              <Button variant="outline" className="flex-shrink-0" onClick={handleFileButtonClick} aria-label="Bestanden">
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
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); handleSend() } }}
                  rows={1}
                  disabled={isLoading}
                  className="flex-1 bg-card border border-border rounded-md px-3 py-2 text-sm resize-none overflow-y-auto focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed"
                  style={{ height: 'auto', scrollbarWidth: 'thin' }}
                  onInput={(e) => { const target = e.target as HTMLTextAreaElement; target.style.height = 'auto'; target.style.height = Math.min(target.scrollHeight, 120) + 'px' }}
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
        <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowRightSidebar(false)} />
      )}

      <AnimatePresence>
        {showRightSidebar && (
          <motion.div
            initial={isMobile ? { x: 320 } : { width: 0, opacity: 0 }}
            animate={isMobile ? { x: 0 } : { width: 320, opacity: 1 }}
            exit={isMobile ? { x: 320 } : { width: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className={isMobile ? "fixed right-0 top-0 h-full w-[85vw] max-w-[360px] z-50" : "flex-shrink-0"}
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