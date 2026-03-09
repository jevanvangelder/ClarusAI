import { useState, useEffect } from 'react'
import { X, MagnifyingGlass, DotsThree, Star } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Ebook {
  id: string
  title: string
  author: string
  cover: string
  subject: string
  favorite: boolean
}

interface EbookModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectEbook: (ebookId: string) => void
  activeEbookId?: string | null
}

// ✅ Demo ebooks (later from server)
const DEMO_EBOOKS: Ebook[] = [
  {
    id: 'book-1',
    title: 'Wiskunde 12e editie',
    author: 'Jan de Vries',
    cover: '📕',
    subject: 'Wiskunde',
    favorite: true
  },
  {
    id: 'book-2',
    title: 'Engels Advanced',
    author: 'Sarah Johnson',
    cover: '📘',
    subject: 'Engels',
    favorite: false
  },
  {
    id: 'book-3',
    title: 'Biologie Hoofdstuk 3',
    author: 'Prof. Dr. Berg',
    cover: '📗',
    subject: 'Biologie',
    favorite: true
  },
  {
    id: 'book-4',
    title: 'Natuurkunde Mechanica',
    author: 'Albert Einstein',
    cover: '📙',
    subject: 'Natuurkunde',
    favorite: false
  },
  {
    id: 'book-5',
    title: 'Geschiedenis WO2',
    author: 'Anne Frank',
    cover: '📔',
    subject: 'Geschiedenis',
    favorite: false
  },
  {
    id: 'book-6',
    title: 'Scheikunde Organisch',
    author: 'Marie Curie',
    cover: '📙',
    subject: 'Scheikunde',
    favorite: true
  },
  {
    id: 'book-7',
    title: 'Aardrijkskunde Europa',
    author: 'Marco Polo',
    cover: '🗺️',
    subject: 'Aardrijkskunde',
    favorite: false
  },
  {
    id: 'book-8',
    title: 'Nederlands Grammatica',
    author: 'Gerrit Komrij',
    cover: '📖',
    subject: 'Nederlands',
    favorite: false
  }
]

export function EbookModal({ isOpen, onClose, onSelectEbook, activeEbookId }: EbookModalProps) {
  const [ebooks, setEbooks] = useState<Ebook[]>([])
  const [searchQuery, setSearchQuery] = useState('')

  // Load ebooks from localStorage (or use demo data)
  useEffect(() => {
    const savedEbooks = localStorage.getItem('clarus-ebooks')
    if (savedEbooks) {
      try {
        setEbooks(JSON.parse(savedEbooks))
      } catch (error) {
        console.error('Error loading ebooks:', error)
        setEbooks(DEMO_EBOOKS)
        localStorage.setItem('clarus-ebooks', JSON.stringify(DEMO_EBOOKS))
      }
    } else {
      // First time: use demo data
      setEbooks(DEMO_EBOOKS)
      localStorage.setItem('clarus-ebooks', JSON.stringify(DEMO_EBOOKS))
    }
  }, [])

  // Save ebooks to localStorage
  useEffect(() => {
    if (ebooks.length > 0) {
      localStorage.setItem('clarus-ebooks', JSON.stringify(ebooks))
    }
  }, [ebooks])

  // Toggle favorite
  const toggleFavorite = (ebookId: string) => {
    setEbooks(prev =>
      prev.map(book =>
        book.id === ebookId ? { ...book, favorite: !book.favorite } : book
      )
    )
  }

  // Filter ebooks by search
  const filteredEbooks = ebooks.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const favoriteEbooks = filteredEbooks.filter(book => book.favorite)
  const allEbooks = filteredEbooks

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h2 className="text-lg font-semibold">Selecteer een Ebook</h2>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <MagnifyingGlass
              size={20}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="text"
              placeholder="Zoek naar een boek..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Favorites Section */}
          {favoriteEbooks.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Star size={16} weight="fill" className="text-yellow-500" />
                FAVORIETEN
              </h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {favoriteEbooks.map((book) => (
                  <button
                    key={book.id}
                    onClick={() => {
                      onSelectEbook(book.id)
                      onClose()
                    }}
                    className={`
                      flex-shrink-0 w-32 p-3 rounded-lg border transition-all
                      hover:border-primary hover:bg-primary/10
                      ${activeEbookId === book.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}
                    `}
                  >
                    <div className="text-5xl mb-2">{book.cover}</div>
                    <p className="text-sm font-medium truncate">{book.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* All Books Section */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-3">
              📖 ALLE BOEKEN
            </h3>
            <div className="space-y-2">
              {allEbooks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Geen boeken gevonden
                </p>
              ) : (
                allEbooks.map((book) => (
                  <div
                    key={book.id}
                    className={`
                      flex items-center gap-3 p-3 rounded-lg border transition-all
                      hover:border-primary hover:bg-primary/5 cursor-pointer group
                      ${activeEbookId === book.id ? 'border-primary bg-primary/10' : 'border-border'}
                    `}
                    onClick={() => {
                      onSelectEbook(book.id)
                      onClose()
                    }}
                  >
                    <div className="text-3xl">{book.cover}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{book.title}</p>
                      <p className="text-sm text-muted-foreground truncate">{book.author}</p>
                      <p className="text-xs text-muted-foreground">{book.subject}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                        >
                          <DotsThree size={20} weight="bold" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(book.id)
                          }}
                        >
                          <Star
                            size={16}
                            weight={book.favorite ? 'fill' : 'regular'}
                            className={book.favorite ? 'text-yellow-500' : ''}
                          />
                          <span className="ml-2">
                            {book.favorite ? 'Verwijder uit favorieten' : 'Toevoegen aan favorieten'}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="w-full">
            Annuleren
          </Button>
        </div>
      </div>
    </div>
  )
}