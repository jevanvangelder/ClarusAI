import { memo, useEffect } from 'react'
import { MagnifyingGlass, Gear, Heart, Note, Trash, DotsThree, X } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useState } from 'react'

interface Chat {
  id: string
  title: string
  active?: boolean
  status?: 'default' | 'favorite' | 'note' | 'trash'
  deletedAt?: number
}

interface ChatSidebarProps {
  chats: Chat[]
  onChatSelect: (id: string) => void
  activeChat: string | null
  onDeleteChat?: (id: string) => void
  onRenameChat?: (id: string, newTitle: string) => void
  onMoveToFavorites?: (id: string) => void
  onMoveToNotes?: (id: string) => void
  onMoveToTrash?: (id: string) => void
  onRestoreFromTrash?: (id: string) => void
  onPermanentDelete?: (id: string) => void
  activeFilter?: 'default' | 'favorite' | 'note' | 'trash'
  onFilterChange?: (filter: 'default' | 'favorite' | 'note' | 'trash') => void
  onSettingsClick?: () => void
  onClose?: () => void
}

function ChatSidebarComponent({ 
  chats, 
  onChatSelect, 
  activeChat, 
  onDeleteChat, 
  onRenameChat,
  onMoveToFavorites,
  onMoveToNotes,
  onMoveToTrash,
  onRestoreFromTrash,
  onPermanentDelete,
  activeFilter = 'default',
  onFilterChange,
  onSettingsClick,
  onClose
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuRefreshKey, setMenuRefreshKey] = useState(0)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // Close menu if clicking outside the dropdown AND outside the three-dots button
      if (!target.closest('.dropdown-menu') && !target.closest('.three-dots-button')) {
        setOpenMenuId(null)
      }
    }

    if (openMenuId) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openMenuId])

  const filteredChats = chats.filter(chat =>
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="w-full h-full bg-background border-r border-border flex flex-col">
      {/* Header - Fixed */}
      <div className="flex-shrink-0 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="font-['Space_Grotesk'] font-bold text-2xl uppercase tracking-wide">
            CHAT<br />GESCHIEDENIS
          </h1>
          <div className="flex items-center gap-1">
            <button 
              onClick={onSettingsClick}
              aria-label="Instellingen"
              className="text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-muted/50"
            >
              <Gear size={20} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Zijbalk sluiten"
                className="md:hidden text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center rounded-md hover:bg-muted/50"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        <div className="relative">
          <MagnifyingGlass 
            size={16} 
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" 
          />
          <Input
            placeholder="Zoeken"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      {/* Scrollable Chat List */}
      <div className="flex-1 px-2 overflow-y-auto min-h-0">
        <div className="space-y-1 pb-4">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`relative group w-full max-w-full text-left py-3 rounded-md text-sm transition-all cursor-pointer ${
                activeChat === chat.id
                  ? 'bg-muted text-foreground border-l-2 border-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
              onClick={() => onChatSelect(chat.id)}
              style={{ maxWidth: '100%', width: '100%' }}
            >
              <div className="w-full max-w-full overflow-hidden pointer-events-none pr-10">
                <span className="block truncate pl-3 pr-2 max-w-[200px] pointer-events-none">
                  {chat.title}
                </span>
                {/* Show countdown if in trash */}
                {chat.status === 'trash' && chat.deletedAt && (
                  <span className="block pl-3 pr-2 text-xs text-red-500 pointer-events-none">
                    Verwijderd over {Math.max(0, 10 - Math.floor((Date.now() - chat.deletedAt) / (1000 * 60 * 60 * 24)))} dagen
                  </span>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuId(openMenuId === chat.id ? null : chat.id)
                }}
                aria-label="Chat opties"
                className="three-dots-button absolute right-1 top-1/2 -translate-y-1/2 min-w-[44px] min-h-[44px] flex items-center justify-center hover:bg-muted rounded transition-colors z-50 pointer-events-auto"
              >
                <DotsThree size={18} weight="bold" color="white" />
              </button>

              {openMenuId === chat.id && (
                <div 
                  key={`${chat.id}-${chat.status}-${menuRefreshKey}`}
                  className="dropdown-menu absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg py-1 z-[100] min-w-[180px]"
                >
                  {/* IF IN TRASH: Show restore + permanent delete */}
                  {chat.status === 'trash' ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onRestoreFromTrash) {
                            onRestoreFromTrash(chat.id)
                            setMenuRefreshKey(prev => prev + 1)
                          }
                          setOpenMenuId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      >
                        ↩️ Terugzetten
                      </button>

                      <div className="h-px bg-border my-1" />

                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Chat "${chat.title}" definitief verwijderen?`)) {
                            if (onPermanentDelete) {
                              onPermanentDelete(chat.id)
                            }
                          }
                          setOpenMenuId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted text-red-500 flex items-center gap-2"
                      >
                        🗑️ Definitief verwijderen
                      </button>
                    </>
                  ) : (
                    /* ELSE: Show normal menu */
                    <>
                      {/* Titel aanpassen */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const newTitle = prompt("Nieuwe titel:", chat.title)
                          if (newTitle && onRenameChat) {
                            onRenameChat(chat.id, newTitle)
                          }
                          setOpenMenuId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      >
                        ✏️ Titel aanpassen
                      </button>

                      <div className="h-px bg-border my-1" />

                      {/* Favorieten */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onMoveToFavorites) {
                            onMoveToFavorites(chat.id)
                            setMenuRefreshKey(prev => prev + 1)
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      >
                        ❤️ {chat.status === 'favorite' ? 'Uit favorieten' : 'Naar favorieten'}
                      </button>

                      {/* Aantekeningen */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onMoveToNotes) {
                            onMoveToNotes(chat.id)
                            setMenuRefreshKey(prev => prev + 1)
                          }
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted flex items-center gap-2"
                      >
                        📝 {chat.status === 'note' ? 'Uit aantekeningen' : 'Naar aantekeningen'}
                      </button>

                      <div className="h-px bg-border my-1" />

                      {/* Prullenbak */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onMoveToTrash) {
                            onMoveToTrash(chat.id)
                          }
                          setOpenMenuId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-muted text-orange-500 flex items-center gap-2"
                      >
                        🗑️ Naar prullenbak
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer - Fixed */}
      <div className="flex-shrink-0 p-2 space-y-1 border-t border-border">
        <Separator className="mb-2" />
        
        <button 
          onClick={() => onFilterChange?.('default')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-md text-sm transition-all ${
            activeFilter === 'default' 
              ? 'bg-muted text-foreground' 
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <span>💬 Alle chats</span>
        </button>

        <button 
          onClick={() => onFilterChange?.('favorite')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-md text-sm transition-all ${
            activeFilter === 'favorite' 
              ? 'bg-muted text-foreground' 
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Heart size={18} />
          <span>Favorieten</span>
        </button>

        <button 
          onClick={() => onFilterChange?.('note')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-md text-sm transition-all ${
            activeFilter === 'note' 
              ? 'bg-muted text-foreground' 
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Note size={18} />
          <span>Aantekeningen</span>
        </button>

        <button 
          onClick={() => onFilterChange?.('trash')}
          className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-md text-sm transition-all ${
            activeFilter === 'trash' 
              ? 'bg-muted text-foreground' 
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
          }`}
        >
          <Trash size={18} />
          <span>Prullenbak</span>
        </button>
      </div>
    </div>
  )
}

function arePropsEqual(prevProps: ChatSidebarProps, nextProps: ChatSidebarProps) {
  // ✅ FIX: Check activeFilter EERST — dit is het belangrijkste
  if (prevProps.activeFilter !== nextProps.activeFilter) return false
  if (prevProps.activeChat !== nextProps.activeChat) return false
  if (prevProps.chats.length !== nextProps.chats.length) return false
  
  const chatsEqual = prevProps.chats.every((chat, index) => {
    const nextChat = nextProps.chats[index]
    return nextChat && 
           chat.id === nextChat.id && 
           chat.title === nextChat.title &&
           chat.status === nextChat.status &&
           chat.deletedAt === nextChat.deletedAt
  })
  
  return chatsEqual
}

export const ChatSidebar = memo(ChatSidebarComponent, arePropsEqual)