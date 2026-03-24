import { useState, useEffect, useRef } from 'react'
import { X, MagnifyingGlass, DotsThree, Star, Trash, Upload, Plus, PencilSimple, FilePlus } from '@phosphor-icons/react'
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

const EMOJI_OPTIONS = ['📕', '📗', '📘', '📙', '📔', '📖', '📚', '📓', '📒', '📝', '🗂️', '🔬', '🧮', '🌍', '💻', '🎨']

interface EbookDocument {
  file_name: string
  file_size: number
  file_url?: string
}

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
  documents: EbookDocument[]
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
  const [uploadEmoji, setUploadEmoji] = useState('📘')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit state
  const [editingEbook, setEditingEbook] = useState<Ebook | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editAuthor, setEditAuthor] = useState('')
  const [editSubject, setEditSubject] = useState('')
  const [editEmoji, setEditEmoji] = useState('📘')
  const [editNewFiles, setEditNewFiles] = useState<File[]>([])
  const [editExistingDocs, setEditExistingDocs] = useState<EbookDocument[]>([])
  const [removedDocs, setRemovedDocs] = useState<string[]>([])
  const editFileInputRef = useRef<HTMLInputElement>(null)

  // ✅ Load ebooks from Supabase
  useEffect(() => {
    if (!isOpen || !user) return

    const loadEbooks = async () => {
      try {
        const res = await fetch(`${API_URL}/api/ebooks?user_id=${user.id}`)
        if (!res.ok) throw new Error('Failed to fetch ebooks')
        const data = await res.json()
        // Ensure documents is always an array
        const normalized = data.map((b: any) => ({
          ...b,
          documents: b.documents || [{ file_name: b.file_name, file_size: b.file_size, file_url: b.file_url }]
        }))
        setEbooks(normalized)
      } catch (error) {
        console.error('Error loading ebooks:', error)
      }
    }

    loadEbooks()
  }, [isOpen, user])

  // ✅ Upload ebook with multiple files
  const handleUpload = async () => {
    if (selectedFiles.length === 0 || !user) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      selectedFiles.forEach(f => formData.append('files', f))
      formData.append('user_id', user.id)
      formData.append('title', uploadTitle || selectedFiles[0].name.replace(/\.[^/.]+$/, ''))
      formData.append('author', uploadAuthor)
      formData.append('subject', uploadSubject)
      formData.append('cover_emoji', uploadEmoji)

      const res = await fetch(`${API_URL}/api/ebooks/upload`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.detail || 'Upload failed')
      }

      const newEbook = await res.json()
      newEbook.documents = newEbook.documents || [{ file_name: newEbook.file_name, file_size: newEbook.file_size }]
      setEbooks(prev => [newEbook, ...prev])
      toast.success(`"${newEbook.title}" is geüpload!`)

      // Reset form
      setShowUploadForm(false)
      setSelectedFiles([])
      setUploadTitle('')
      setUploadAuthor('')
      setUploadSubject('')
      setUploadEmoji('📘')
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

  // ✅ Save edit
  const handleSaveEdit = async () => {
    if (!editingEbook || !user) return

    setIsUploading(true)
    try {
      // 1. Update metadata + removed docs
      const res = await fetch(`${API_URL}/api/ebooks/${editingEbook.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editTitle,
          author: editAuthor,
          subject: editSubject,
          cover_emoji: editEmoji,
          removed_documents: removedDocs,
        }),
      })

      if (!res.ok) throw new Error('Update failed')
      let updated = await res.json()

      // 2. Upload new files one by one
      for (const file of editNewFiles) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('user_id', user.id)

        const addRes = await fetch(`${API_URL}/api/ebooks/${editingEbook.id}/add-document`, {
          method: 'POST',
          body: formData,
        })

        if (!addRes.ok) {
          const error = await addRes.json()
          throw new Error(error.detail || `Kon ${file.name} niet toevoegen`)
        }

        updated = await addRes.json()
      }

      updated.documents = updated.documents || [{ file_name: updated.file_name, file_size: updated.file_size }]
      setEbooks(prev => prev.map(b => b.id === editingEbook.id ? updated : b))
      setEditingEbook(null)
      setEditNewFiles([])
      setRemovedDocs([])
      toast.success('Ebook bijgewerkt!')
    } catch (error: any) {
      console.error('Error updating ebook:', error)
      toast.error(error.message || 'Kon ebook niet bijwerken.')
    } finally {
      setIsUploading(false)
    }
  }

  // ✅ Open edit form
  const openEditForm = (book: Ebook) => {
    setEditingEbook(book)
    setEditTitle(book.title)
    setEditAuthor(book.author)
    setEditSubject(book.subject)
    setEditEmoji(book.cover_emoji)
    setEditNewFiles([])
    setRemovedDocs([])
    // Set existing documents
    const docs = book.documents && book.documents.length > 0
      ? book.documents
      : [{ file_name: book.file_name, file_size: book.file_size, file_url: book.file_url }]
    setEditExistingDocs(docs)
    setShowUploadForm(false)
  }

  // ✅ Add files (new upload)
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setSelectedFiles(prev => [...prev, ...files])
      if (!uploadTitle && selectedFiles.length === 0) {
        setUploadTitle(files[0].name.replace(/\.[^/.]+$/, ''))
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ✅ Add files (edit)
  const handleEditFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      setEditNewFiles(prev => [...prev, ...files])
    }
    if (editFileInputRef.current) editFileInputRef.current.value = ''
  }

  // ✅ Remove existing doc (edit)
  const handleRemoveExistingDoc = (fileName: string) => {
    setEditExistingDocs(prev => prev.filter(d => d.file_name !== fileName))
    setRemovedDocs(prev => [...prev, fileName])
  }

  // ✅ Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  // ✅ Get file icon
  const getFileIcon = (name: string) => {
    if (name.endsWith('.pdf')) return '📄'
    if (name.endsWith('.epub')) return '📕'
    if (name.endsWith('.txt')) return '📋'
    return '📘'
  }

  // Filter ebooks
  const filteredEbooks = ebooks.filter(book =>
    book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
    book.subject.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const favoriteEbooks = filteredEbooks.filter(book => book.favorite)
  const isFormOpen = showUploadForm || editingEbook !== null

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col mx-4">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📚</span>
            <h2 className="text-lg font-semibold">Selecteer een Ebook</h2>
          </div>
          <div className="flex items-center gap-2">
            {!isFormOpen && (
              <Button
                variant="default"
                size="sm"
                onClick={() => {
                  setShowUploadForm(true)
                  setEditingEbook(null)
                  setSelectedFiles([])
                }}
                className="gap-2"
              >
                <Plus size={16} weight="bold" />
                <span>Nieuw</span>
              </Button>
            )}
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* ===== UPLOAD FORM (Nieuw) ===== */}
        {showUploadForm && !editingEbook && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">📤 Nieuw ebook uploaden</h3>
              <button
                onClick={() => {
                  setShowUploadForm(false)
                  setSelectedFiles([])
                  setUploadTitle('')
                  setUploadAuthor('')
                  setUploadSubject('')
                  setUploadEmoji('📘')
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Bestanden */}
            <div>
              <label className="block text-xs font-medium mb-2">Bestanden</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.epub,.mobi,.azw3,.kfx,.iba,.txt"
                onChange={handleFileSelect}
                multiple
                className="hidden"
              />

              {/* Lijst van geselecteerde bestanden */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2 mb-3">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-2.5 bg-card border border-border rounded-lg">
                      <span className="text-xl">{getFileIcon(file.name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bestand toevoegen knop */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <FilePlus size={24} className="mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {selectedFiles.length === 0 ? 'Klik om bestanden te kiezen' : 'Nog een bestand toevoegen'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">PDF, EPUB, MOBI, AZW3, KFX, IBA, TXT</p>
              </button>
            </div>

            {selectedFiles.length > 0 && (
              <>
                {/* Titel */}
                <div>
                  <label className="block text-xs font-medium mb-1">Titel</label>
                  <Input
                    placeholder="Titel van het boek..."
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                  />
                </div>

                {/* Auteur + Vak */}
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

                {/* Emoji picker */}
                <div>
                  <label className="block text-xs font-medium mb-2">Kleur / Icoon</label>
                  <div className="flex flex-wrap gap-2">
                    {EMOJI_OPTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => setUploadEmoji(emoji)}
                        className={`text-2xl p-1.5 rounded-lg border-2 transition-all hover:scale-110 ${
                          uploadEmoji === emoji ? 'border-primary bg-primary/10 scale-110' : 'border-transparent hover:border-border'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Upload button */}
                <div className="flex gap-2">
                  <Button onClick={handleUpload} disabled={isUploading} className="flex-1">
                    {isUploading ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Uploaden & tekst extraheren...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <Upload size={16} />
                        Uploaden ({selectedFiles.length} {selectedFiles.length === 1 ? 'bestand' : 'bestanden'})
                      </span>
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => {
                    setShowUploadForm(false)
                    setSelectedFiles([])
                    setUploadTitle('')
                    setUploadAuthor('')
                    setUploadSubject('')
                    setUploadEmoji('📘')
                  }}>
                    Annuleren
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ===== EDIT FORM (Aanpassen) ===== */}
        {editingEbook && (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">✏️ Ebook aanpassen</h3>
              <button
                onClick={() => {
                  setEditingEbook(null)
                  setEditNewFiles([])
                  setRemovedDocs([])
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            {/* Titel */}
            <div>
              <label className="block text-xs font-medium mb-1">Titel</label>
              <Input
                placeholder="Titel van het boek..."
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
              />
            </div>

            {/* Auteur + Vak */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Auteur</label>
                <Input
                  placeholder="Naam auteur..."
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Vak</label>
                <Input
                  placeholder="Bijv. Wiskunde..."
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                />
              </div>
            </div>

            {/* Emoji picker */}
            <div>
              <label className="block text-xs font-medium mb-2">Kleur / Icoon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setEditEmoji(emoji)}
                    className={`text-2xl p-1.5 rounded-lg border-2 transition-all hover:scale-110 ${
                      editEmoji === emoji ? 'border-primary bg-primary/10 scale-110' : 'border-transparent hover:border-border'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Bestanden */}
            <div>
              <label className="block text-xs font-medium mb-2">Bestanden</label>
              <input
                ref={editFileInputRef}
                type="file"
                accept=".pdf,.epub,.mobi,.azw3,.kfx,.iba,.txt"
                onChange={handleEditFileSelect}
                multiple
                className="hidden"
              />

              {/* Bestaande bestanden */}
              {editExistingDocs.length > 0 && (
                <div className="space-y-2 mb-3">
                  {editExistingDocs.map((doc, index) => (
                    <div key={`existing-${index}`} className="flex items-center gap-3 p-2.5 bg-card border border-border rounded-lg">
                      <span className="text-xl">{getFileIcon(doc.file_name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveExistingDoc(doc.file_name)}
                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                        title="Bestand verwijderen"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Nieuw toegevoegde bestanden */}
              {editNewFiles.length > 0 && (
                <div className="space-y-2 mb-3">
                  {editNewFiles.map((file, index) => (
                    <div key={`new-${index}`} className="flex items-center gap-3 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
                      <span className="text-xl">{getFileIcon(file.name)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)} · <span className="text-primary">nieuw</span></p>
                      </div>
                      <button
                        onClick={() => setEditNewFiles(prev => prev.filter((_, i) => i !== index))}
                        className="text-red-500 hover:text-red-700 flex-shrink-0"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Bestand toevoegen knop */}
              <button
                onClick={() => editFileInputRef.current?.click()}
                className="w-full p-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-primary/5 transition-all text-center"
              >
                <FilePlus size={20} className="mx-auto mb-1 text-muted-foreground" />
                <p className="text-sm font-medium">Bestand toevoegen</p>
              </button>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-2">
              <Button onClick={handleSaveEdit} disabled={isUploading} className="flex-1">
                {isUploading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Opslaan...
                  </span>
                ) : (
                  'Opslaan'
                )}
              </Button>
              <Button variant="outline" onClick={() => {
                setEditingEbook(null)
                setEditNewFiles([])
                setRemovedDocs([])
              }}>
                Annuleren
              </Button>
            </div>
          </div>
        )}

        {/* ===== BOOK LIST ===== */}
        {!isFormOpen && (
          <>
            {/* Search Bar */}
            <div className="p-4 border-b border-border flex-shrink-0">
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
            <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-[250px]">
              {/* Favorites */}
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
                        onClick={() => { onSelectEbook(book.id); onClose() }}
                        className={`flex-shrink-0 w-32 p-3 rounded-lg border transition-all hover:border-primary hover:bg-primary/10
                          ${activeEbookId === book.id ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
                      >
                        <div className="text-5xl mb-2">{book.cover_emoji}</div>
                        <p className="text-sm font-medium truncate">{book.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{book.author}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* All Books */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">📖 ALLE BOEKEN</h3>
                <div className="space-y-2">
                  {ebooks.length === 0 ? (
                    <div className="text-center py-12">
                      <span className="text-5xl">📚</span>
                      <p className="text-muted-foreground mt-3">Nog geen ebooks</p>
                      <p className="text-sm text-muted-foreground mt-1">Upload je eerste schoolboek met de "+ Nieuw" knop</p>
                    </div>
                  ) : filteredEbooks.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">Geen boeken gevonden</p>
                  ) : (
                    filteredEbooks.map((book) => (
                      <div
                        key={book.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all hover:border-primary hover:bg-primary/5 cursor-pointer group
                          ${activeEbookId === book.id ? 'border-primary bg-primary/10' : 'border-border'}`}
                        onClick={() => { onSelectEbook(book.id); onClose() }}
                      >
                        <div className="text-3xl">{book.cover_emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{book.title}</p>
                          <p className="text-sm text-muted-foreground truncate">{book.author || 'Onbekende auteur'}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {book.subject && <span className="text-xs text-muted-foreground">{book.subject}</span>}
                            <span className="text-xs text-muted-foreground">
                              · {book.file_type.toUpperCase()} · {formatFileSize(book.file_size)}
                              {book.documents && book.documents.length > 1 && ` · ${book.documents.length} bestanden`}
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
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditForm(book) }}>
                              <PencilSimple size={16} />
                              <span className="ml-2">Aanpassen</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); toggleFavorite(book.id) }}>
                              <Star size={16} weight={book.favorite ? 'fill' : 'regular'} className={book.favorite ? 'text-yellow-500' : ''} />
                              <span className="ml-2">{book.favorite ? 'Uit favorieten' : 'Favoriet'}</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => { e.stopPropagation(); if (confirm(`"${book.title}" verwijderen?`)) handleDelete(book.id) }}
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
          </>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-border flex-shrink-0">
          <Button variant="outline" onClick={onClose} className="w-full">Annuleren</Button>
        </div>
      </div>
    </div>
  )
}