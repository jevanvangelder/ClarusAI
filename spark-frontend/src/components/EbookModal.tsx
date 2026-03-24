import { useState, useEffect, useRef } from 'react'
import { X, MagnifyingGlass, DotsThree, Star, Trash, Upload, Plus } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
const API_URL = import.meta.env.VITE_API_URL || 'https://clarusai-backend.onrender.com'
import { useAuth } from '@/contexts/AuthContext'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface Ebook {
  id: string
  user_id: string
  title: string
  author: string
  file_name: string
  file_type: string
  file_size: number
  file_url: string
  cover_emoji: string
  subject: string
  favorite: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

interface EbookModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectEbook: (ebookId: string) => void
  activeEbookId?: string | null
}

export function EbookModal({ isOpen, onClose, onSelectEbook, activeEbookId }: EbookModalProps) {
  const { user } = useAuth()
  const [ebooks, setEbooks] = useState<Ebook[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [showUploadForm, setShowUploadForm] = useState(false)
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadAuthor, setUploadAuthor] = useState('')
  const [uploadSubject, setUploadSubject] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ✅ Load ebooks from Supabase
  useEffect(() => {
    if (!isOpen || !user) return

    const loadEbooks = async () => {
      try {
        const res = await fetch(`${API_URL}/api/ebooks?user_id=${user.id}`)
        if (!res.ok) throw new Error('Failed to fetch ebooks')
        const data = await res.json()
        setEbooks(data)
      } catch (error) {
        console.error('Error loading ebooks:', error)
      }
    }

    loadEbooks()
  }, [isOpen, user])

  // ✅ Upload ebook
  const handleUpload = async () => {
    if (!selectedFile || !user) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('user_id', user.id)
      formData.append('title', uploadTitle || selectedFile.name.replace(/\.[^/.]+$/, ''))
      formData.append('author', uploadAuthor)
      formData.append('subject', uploadSubject)

      const res = await fetch(`${API_URL}/api/ebooks/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const newEbook = await res.json()
      setEbooks(prev => [newEbook, ...prev])
      toast.success(`"${newEbook.title}" is geüpload!`)

      // Reset form
      setShowUploadForm(false)
      setSelectedFile(null)
      setUploadTitle('')
      setUploadAuthor('')
      setUploadSubject('')
    } catch (error: any) {
      console.error('Error uploading ebook:', error)
      toast.error(error.message || 'Kon ebook niet uploaden.')
    } finally {
      setIsUploading(false)
    }
  }

  // ✅ Delete ebook
  const handleDelete = async (ebookId: string) => {
    try {
      const res = await fetch(`${API_URL}/api/ebooks/${ebookId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setEbooks(prev => prev.filter(b => b.id !== ebookId))
      toast.success('Ebook verwijderd')
    } catch (error) {
      console.error('Error deleting ebook:', error)
      toast.error('Kon ebook niet verwijderen.')
    }
  }

  // ✅ Toggle favorite
  const toggleFavorite = async (ebookId: string) => {
    const ebook = ebooks.find(b => b.id === ebookId)
    if (!ebook) return

    const newFavorite = !ebook.favorite
    setEbooks(prev => prev.map(b => b.id === ebookId ? { ...b, favorite: newFavorite } : b))

    try {
      await fetch(`${API_URL}/api/ebooks/${ebookId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favorite: newFavorite }),
      })
    } catch (error) {
      console.error('Error toggling favorite:', error)
    }
  }

  // ✅ File selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      // Auto-fill title from filename
      if (!uploadTitle) {
        setUploadTitle(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
  }

  // ✅ Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // Filter ebooks
  const filteredEbooks = ebooks.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const favoriteEbooks = filteredEbooks.filter(book => book.favorite)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h2 className="text-lg font-semibold">Selecteer een Ebook</h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setShowUploadForm(true)}
              className="gap-2"
            >
              <Plus size={16} weight="bold" />
              <span>Nieuw</span>
            </Button>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Upload Form */}
        {showUploadForm && (
          <div className="p-4 border-b border-border bg-muted/30 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">📤 Nieuw ebook uploaden</h3>
              <button
                onClick={() => {
                  setShowUploadForm(false)
                  setSelectedFile(null)
                  setUploadTitle('')
                  setUploadAuthor('')
                  setUploadSubject('')
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* File picker */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.epub,.mobi,.azw3,.kfx,.iba,.txt"
                onChange={handleFileSelect}
                className="hidden"
              />
              {selectedFile ? (
                <div className="flex items-center gap-3 p-3 bg-card border border-border rounded-lg">
                  <span className="text-2xl">
                    {selectedFile.name.endsWith('.pdf') ? '📄' :
                     selectedFile.name.endsWith('.epub') ? '📕' :
                     selectedFile.name.endsWith('.txt') ? '📋' : '📘'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full p-6 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-center"
                >
                  <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Klik om een bestand te kiezen</p>
                  <p className="text-xs text-muted-foreground mt-1">PDF, EPUB, MOBI, AZW3, KFX, IBA, TXT</p>
                </button>
              )}
            </div>

            {/* Title, Author, Subject */}
            {selectedFile && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-1">Titel</label>
                  <Input
                    placeholder="Titel van het boek..."
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Auteur (optioneel)</label>
                    <Input
                      placeholder="Naam auteur..."
                      value={uploadAuthor}
                      onChange={(e) => setUploadAuthor(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Vak (optioneel)</label>
                    <Input
                      placeholder="Bijv. Wiskunde..."
                      value={uploadSubject}
                      onChange={(e) => setUploadSubject(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="w-full"
                >
                  {isUploading ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Uploaden & tekst extraheren...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Upload size={16} />
                      Uploaden
                    </span>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

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
                    <div className="text-5xl mb-2">{book.cover_emoji}</div>
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
              {ebooks.length === 0 && !showUploadForm ? (
                <div className="text-center py-12">
                  <span className="text-5xl">📚</span>
                  <p className="text-muted-foreground mt-3">Nog geen ebooks</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload je eerste schoolboek met de "+ Nieuw" knop
                  </p>
                </div>
              ) : filteredEbooks.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Geen boeken gevonden
                </p>
              ) : (
                filteredEbooks.map((book) => (
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
                    <div className="text-3xl">{book.cover_emoji}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{book.title}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {book.author || 'Onbekende auteur'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {book.subject && (
                          <span className="text-xs text-muted-foreground">{book.subject}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          · {book.file_type.toUpperCase()} · {formatFileSize(book.file_size)}
                        </span>
                      </div>
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
                            {book.favorite ? 'Uit favorieten' : 'Favoriet'}
                          </span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm(`"${book.title}" verwijderen?`)) {
                              handleDelete(book.id)
                            }
                          }}
                          className="text-red-500"
                        >
                          <Trash size={16} />
                          <span className="ml-2">Verwijderen</span>
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