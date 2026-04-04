import { memo, useEffect, useState } from 'react'
import { MagnifyingGlass, Gear, Heart, Note, Trash, DotsThree, X } from '@phosphor-icons/react'

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
  chats, onChatSelect, activeChat, onDeleteChat, onRenameChat,
  onMoveToFavorites, onMoveToNotes, onMoveToTrash, onRestoreFromTrash,
  onPermanentDelete, activeFilter = 'default', onFilterChange, onSettingsClick, onClose,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [menuRefreshKey, setMenuRefreshKey] = useState(0)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement
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
    // ✅ Dashboard stijl achtergrond
    <div className="w-full h-full flex flex-col border-r border-white/10" style={{ backgroundColor: '#0f1029' }}>

      {/* Header */}
      <div className="flex-shrink-0 p-4 space-y-4 border-b border-white/10">
        <div className="flex items-center justify-between">
          <h1 className="font-['Space_Grotesk'] font-bold text-2xl uppercase tracking-wide text-white">
            CHAT<br />GESCHIEDENIS
          </h1>
          <div className="flex items-center gap-1">
            <button
              onClick={onSettingsClick}
              className="text-white/40 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label="Instellingen"
            >
              <Gear size={20} />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden text-white/40 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Zijbalk sluiten"
              >
                <X size={20} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {/* Zoekbalk */}
        <div className="relative">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Zoeken"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Chat lijst */}
      <div className="flex-1 px-2 overflow-y-auto min-h-0 py-2">
        <div className="space-y-0.5">
          {filteredChats.map((chat) => (
            <div
              key={chat.id}
              className={`relative group w-full text-left py-2.5 rounded-lg text-sm transition-all cursor-pointer ${
                activeChat === chat.id
                  ? 'bg-blue-600/20 text-white border-l-2 border-blue-500'
                  : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
              onClick={() => onChatSelect(chat.id)}
            >
              <div className="pl-3 pr-12 overflow-hidden pointer-events-none">
                <span className="block truncate w-full pointer-events-none">
                  {chat.title}
                </span>
                {chat.status === 'trash' && chat.deletedAt && (
                  <span className="block text-xs text-red-400 pointer-events-none">
                    Verwijderd over {Math.max(0, 10 - Math.floor((Date.now() - chat.deletedAt) / (1000 * 60 * 60 * 24)))} dagen
                  </span>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenMenuId(openMenuId === chat.id ? null : chat.id)
                }}
                className="three-dots-button absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded transition-colors z-50 pointer-events-auto min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Meer opties"
              >
                <DotsThree size={18} weight="bold" className="text-white/50" />
              </button>

              {openMenuId === chat.id && (
                <div
                  key={`${chat.id}-${chat.status}-${menuRefreshKey}`}
                  className="dropdown-menu absolute right-0 top-full mt-1 border border-white/10 rounded-xl shadow-xl py-1 z-[100] min-w-[180px]"
                  style={{ backgroundColor: '#1a1f3d' }}
                >
                  {chat.status === 'trash' ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onRestoreFromTrash) { onRestoreFromTrash(chat.id); setMenuRefreshKey(prev => prev + 1) }
                          setOpenMenuId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 text-white/70 hover:text-white flex items-center gap-2 min-h-[44px]"
                      >
                        ↩️ Terugzetten
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Chat "${chat.title}" definitief verwijderen?`)) {
                            if (onPermanentDelete) onPermanentDelete(chat.id)
                          }
                          setOpenMenuId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 text-red-400 flex items-center gap-2 min-h-[44px]"
                      >
                        🗑️ Definitief verwijderen
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const newTitle = prompt("Nieuwe titel:", chat.title)
                          if (newTitle && onRenameChat) onRenameChat(chat.id, newTitle)
                          setOpenMenuId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 text-white/70 hover:text-white flex items-center gap-2 min-h-[44px]"
                      >
                        ✏️ Titel aanpassen
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onMoveToFavorites) { onMoveToFavorites(chat.id); setMenuRefreshKey(prev => prev + 1) }
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 text-white/70 hover:text-white flex items-center gap-2 min-h-[44px]"
                      >
                        ❤️ {chat.status === 'favorite' ? 'Uit favorieten' : 'Naar favorieten'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onMoveToNotes) { onMoveToNotes(chat.id); setMenuRefreshKey(prev => prev + 1) }
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 text-white/70 hover:text-white flex items-center gap-2 min-h-[44px]"
                      >
                        📝 {chat.status === 'note' ? 'Uit aantekeningen' : 'Naar aantekeningen'}
                      </button>
                      <div className="h-px bg-white/10 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onMoveToTrash) onMoveToTrash(chat.id)
                          setOpenMenuId(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-white/5 text-orange-400 flex items-center gap-2 min-h-[44px]"
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

      {/* Footer filters */}
      <div className="flex-shrink-0 p-2 space-y-0.5 border-t border-white/10">
        {[
          { key: 'default', label: '💬 Alle chats', icon: null },
          { key: 'favorite', label: 'Favorieten', icon: <Heart size={16} /> },
          { key: 'note', label: 'Aantekeningen', icon: <Note size={16} /> },
          { key: 'trash', label: 'Prullenbak', icon: <Trash size={16} /> },
        ].map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => onFilterChange?.(key as any)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all min-h-[44px] ${
              activeFilter === key
                ? 'bg-blue-600/20 text-white border border-blue-500/30'
                : 'text-white/40 hover:bg-white/5 hover:text-white'
            }`}
          >
            {icon}
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function arePropsEqual(prevProps: ChatSidebarProps, nextProps: ChatSidebarProps) {
  if (prevProps.activeFilter !== nextProps.activeFilter) return false
  if (prevProps.activeChat !== nextProps.activeChat) return false
  if (prevProps.chats.length !== nextProps.chats.length) return false
  return prevProps.chats.every((chat, index) => {
    const nextChat = nextProps.chats[index]
    return nextChat &&
      chat.id === nextChat.id &&
      chat.title === nextChat.title &&
      chat.status === nextChat.status &&
      chat.deletedAt === nextChat.deletedAt
  })
}

export const ChatSidebar = memo(ChatSidebarComponent, arePropsEqual)