import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  FolderOpen,
  File,
  Download,
  Upload,
  FolderPlus,
  Trash2,
  ChevronRight,
  Home,
  Loader2,
  FileText,
  FileSpreadsheet,
  Presentation,
  X,
  Plus,
} from 'lucide-react'
import { toast } from 'sonner'

interface Folder {
  id: string
  name: string
  parent_id: string | null
  class_id: string
  created_at: string
}

interface BronFile {
  id: string
  name: string
  folder_id: string | null
  class_id: string
  file_url: string
  file_size: number
  file_type: string
  uploaded_at: string
}

interface Klas {
  id: string
  name: string
  vak: string
  eigen_titel: string | null
}

export default function Bronnen() {
  const { user, role } = useAuth()
  const isStudent = role === 'student'

  const [klassen, setKlassen] = useState<Klas[]>([])
  const [selectedKlas, setSelectedKlas] = useState<string | null>(null)
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = useState<{ id: string | null; name: string }[]>([])

  const [folders, setFolders] = useState<Folder[]>([])
  const [files, setFiles] = useState<BronFile[]>([])
  const [loading, setLoading] = useState(false)

  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)

  const [showUploadFile, setShowUploadFile] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Laad klassen
  useEffect(() => {
    loadKlassen()
  }, [user])

  // Laad bronnen wanneer klas/folder verandert
  useEffect(() => {
    if (selectedKlas) {
      loadBronnen()
    }
  }, [selectedKlas, currentFolderId])

  const loadKlassen = async () => {
    if (!user) return
    
    console.log('🔍 DEBUG - User ID:', user.id)
    console.log('���� DEBUG - Role:', role)
    console.log('🔍 DEBUG - isStudent:', isStudent)
    
    try {
      if (isStudent) {
        // Student: klassen waar student lid van is
        console.log('🔍 DEBUG - Loading klassen for STUDENT')
        const { data: members, error: membersError } = await supabase
          .from('class_members')
          .select('class_id')
          .eq('student_id', user.id)

        console.log('🔍 DEBUG - Class members:', members)
        if (membersError) {
          console.log('🔍 DEBUG - Members error message:', membersError.message)
          console.log('🔍 DEBUG - Members error code:', membersError.code)
        }

        if (!members || members.length === 0) {
          setKlassen([])
          return
        }

        const classIds = members.map(m => m.class_id)
        const { data: classes, error: classesError } = await supabase
          .from('classes')
          .select('id, name, vak, eigen_titel')
          .in('id', classIds)
          .eq('is_active', true)

        console.log('🔍 DEBUG - Classes found:', classes)
        if (classesError) {
          console.log('🔍 DEBUG - Classes error message:', classesError.message)
          console.log('🔍 DEBUG - Classes error code:', classesError.code)
        }

        setKlassen(classes || [])
        if (classes && classes.length > 0) {
          setSelectedKlas(classes[0].id)
        }
      } else {
        // Docent/staff: eigen klassen
        console.log('🔍 DEBUG - Loading klassen for TEACHER/STAFF')
        const { data: classes, error: classesError } = await supabase
          .from('classes')
          .select('id, name, vak, eigen_titel')
          .eq('created_by', user.id)
          .eq('is_active', true)

        console.log('🔍 DEBUG - Teacher classes found:', classes)
        if (classesError) {
          console.log('🔍 DEBUG - Error code:', classesError.code)
          console.log('🔍 DEBUG - Error message:', classesError.message)
          console.log('🔍 DEBUG - Error details:', classesError.details)
          console.log('🔍 DEBUG - Error hint:', classesError.hint)
        }
        console.log('🔍 DEBUG - Query: created_by =', user.id)

        setKlassen(classes || [])
        if (classes && classes.length > 0) {
          setSelectedKlas(classes[0].id)
        }
      }
    } catch (err) {
      console.error('❌ Error loading klassen:', err)
      toast.error('Kon klassen niet laden')
    }
  }

  const loadBronnen = async () => {
    if (!selectedKlas) return
    setLoading(true)
    try {
      // Laad folders
      let folderQuery = supabase
        .from('bronnen_folders')
        .select('*')
        .eq('class_id', selectedKlas)

      if (currentFolderId) {
        folderQuery = folderQuery.eq('parent_id', currentFolderId)
      } else {
        folderQuery = folderQuery.is('parent_id', null)
      }

      const { data: foldersData } = await folderQuery.order('name')
      setFolders(foldersData || [])

      // Laad files
      let fileQuery = supabase
        .from('bronnen_files')
        .select('*')
        .eq('class_id', selectedKlas)

      if (currentFolderId) {
        fileQuery = fileQuery.eq('folder_id', currentFolderId)
      } else {
        fileQuery = fileQuery.is('folder_id', null)
      }

      const { data: filesData } = await fileQuery.order('name')
      setFiles(filesData || [])
    } catch (err) {
      console.error('Error loading bronnen:', err)
      toast.error('Kon bronnen niet laden')
    } finally {
      setLoading(false)
    }
  }

  const openFolder = async (folder: Folder) => {
    setCurrentFolderId(folder.id)
    setBreadcrumbs([...breadcrumbs, { id: folder.id, name: folder.name }])
  }

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) {
      // Home (root)
      setCurrentFolderId(null)
      setBreadcrumbs([])
    } else {
      const crumb = breadcrumbs[index]
      setCurrentFolderId(crumb.id)
      setBreadcrumbs(breadcrumbs.slice(0, index + 1))
    }
  }

  const createFolder = async () => {
    if (!newFolderName.trim() || !selectedKlas) return
    setCreatingFolder(true)
    try {
      const { data, error } = await supabase
        .from('bronnen_folders')
        .insert({
          name: newFolderName.trim(),
          parent_id: currentFolderId,
          class_id: selectedKlas,
          created_by: user!.id,
        })
        .select()

      if (error) throw error

      toast.success('Map aangemaakt')
      setShowNewFolder(false)
      setNewFolderName('')
      loadBronnen()
    } catch (err: any) {
      console.error('Error creating folder:', err)
      toast.error(err.message || 'Kon map niet aanmaken')
    } finally {
      setCreatingFolder(false)
    }
  }

  const uploadFile = async () => {
    if (!selectedFile || !selectedKlas) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('class_id', selectedKlas)
      formData.append('teacher_id', user!.id)
      if (currentFolderId) {
        formData.append('folder_id', currentFolderId)
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/bronnen/files`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.detail || 'Upload mislukt')
      }

      toast.success('Bestand geüpload')
      setShowUploadFile(false)
      setSelectedFile(null)
      loadBronnen()
    } catch (err: any) {
      console.error('Error uploading file:', err)
      toast.error(err.message || 'Kon bestand niet uploaden')
    } finally {
      setUploading(false)
    }
  }

  const deleteFolder = async (folderId: string) => {
    if (!confirm('Weet je zeker dat je deze map wilt verwijderen? Alle submappen en bestanden worden ook verwijderd.')) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/bronnen/folders/${folderId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete mislukt')

      toast.success('Map verwijderd')
      loadBronnen()
    } catch (err: any) {
      console.error('Error deleting folder:', err)
      toast.error(err.message || 'Kon map niet verwijderen')
    }
  }

  const deleteFile = async (fileId: string) => {
    if (!confirm('Weet je zeker dat je dit bestand wilt verwijderen?')) return

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/bronnen/files/${fileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Delete mislukt')

      toast.success('Bestand verwijderd')
      loadBronnen()
    } catch (err: any) {
      console.error('Error deleting file:', err)
      toast.error(err.message || 'Kon bestand niet verwijderen')
    }
  }

  const downloadFile = (file: BronFile) => {
    window.open(file.file_url, '_blank')
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return <FileText size={20} className="text-red-400" />
    if (fileType.includes('sheet') || fileType.includes('excel')) return <FileSpreadsheet size={20} className="text-green-400" />
    if (fileType.includes('presentation') || fileType.includes('powerpoint')) return <Presentation size={20} className="text-orange-400" />
    if (fileType.includes('word') || fileType.includes('document')) return <FileText size={20} className="text-blue-400" />
    return <File size={20} className="text-white/50" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (klassen.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Bronnen</h2>
          <p className="text-white/50 text-sm mt-1">Lesmateriaal per vak</p>
        </div>

        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
            <FolderOpen size={36} className="text-green-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-3">Geen klassen gevonden</h3>
          <p className="text-white/40 text-sm max-w-md">
            {isStudent
              ? 'Je bent nog niet toegevoegd aan een klas. Vraag je docent om je toe te voegen.'
              : 'Je hebt nog geen klassen aangemaakt. Maak eerst een klas aan.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Bronnen</h2>
          <p className="text-white/50 text-sm mt-1">Lesmateriaal per vak</p>
        </div>

        {!isStudent && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowNewFolder(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all"
            >
              <FolderPlus size={18} />
              Nieuwe map
            </button>
            <button
              onClick={() => setShowUploadFile(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-all"
            >
              <Upload size={18} />
              Bestand uploaden
            </button>
          </div>
        )}
      </div>

      {/* Klas selector */}
      <div className="flex items-center gap-2">
        <span className="text-white/50 text-sm">Vak:</span>
        <select
          value={selectedKlas || ''}
          onChange={(e) => {
            setSelectedKlas(e.target.value)
            setCurrentFolderId(null)
            setBreadcrumbs([])
          }}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500/50"
        >
          {klassen.map(k => (
            <option key={k.id} value={k.id} className="bg-[#0f1029]">
              {k.eigen_titel || k.vak || k.name}
            </option>
          ))}
        </select>
      </div>

      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={() => navigateToBreadcrumb(-1)}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors"
        >
          <Home size={16} />
          <span>Home</span>
        </button>
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.id} className="flex items-center gap-1">
            <ChevronRight size={16} className="text-white/30" />
            <button
              onClick={() => navigateToBreadcrumb(index)}
              className="px-2 py-1 rounded hover:bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              {crumb.name}
            </button>
          </div>
        ))}
      </div>

      {/* File browser */}
      <div className="bg-[#0f1029] border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <Loader2 size={32} className="text-blue-400 animate-spin" />
          </div>
        ) : folders.length === 0 && files.length === 0 ? (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <FolderOpen size={48} className="text-white/20 mb-4" />
            <p className="text-white/40 text-sm">Deze map is leeg</p>
            {!isStudent && (
              <p className="text-white/30 text-xs mt-2">Upload bestanden of maak submappen aan</p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {/* Folders */}
            {folders.map(folder => (
              <div
                key={folder.id}
                className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
              >
                <button
                  onClick={() => openFolder(folder)}
                  className="flex items-center gap-3 flex-1 min-w-0"
                >
                  <FolderOpen size={20} className="text-yellow-400 shrink-0" />
                  <span className="text-white font-medium truncate">{folder.name}</span>
                </button>

                {!isStudent && (
                  <button
                    onClick={() => deleteFolder(folder.id)}
                    className="p-2 rounded hover:bg-red-500/10 text-red-400/70 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            ))}

            {/* Files */}
            {files.map(file => (
              <div
                key={file.id}
                className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {getFileIcon(file.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{file.name}</p>
                    <p className="text-white/30 text-xs">{formatFileSize(file.file_size)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => downloadFile(file)}
                    className="p-2 rounded hover:bg-blue-500/10 text-blue-400/70 hover:text-blue-400 transition-all"
                  >
                    <Download size={16} />
                  </button>

                  {!isStudent && (
                    <button
                      onClick={() => deleteFile(file.id)}
                      className="p-2 rounded hover:bg-red-500/10 text-red-400/70 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Nieuwe map</h3>
              <button onClick={() => setShowNewFolder(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Map naam..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && createFolder()}
            />

            <div className="flex gap-2">
              <button
                onClick={() => setShowNewFolder(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
              >
                Annuleren
              </button>
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim() || creatingFolder}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
              >
                {creatingFolder ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Aanmaken
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUploadFile && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Bestand uploaden</h3>
              <button onClick={() => setShowUploadFile(false)} className="text-white/50 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="border-2 border-dashed border-white/10 rounded-lg p-8 text-center">
              {selectedFile ? (
                <div className="space-y-2">
                  <File size={32} className="text-blue-400 mx-auto" />
                  <p className="text-white text-sm font-medium">{selectedFile.name}</p>
                  <p className="text-white/30 text-xs">{formatFileSize(selectedFile.size)}</p>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-red-400 text-xs hover:underline"
                  >
                    Verwijderen
                  </button>
                </div>
              ) : (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    onChange={(e) => e.target.files && setSelectedFile(e.target.files[0])}
                    className="hidden"
                  />
                  <Upload size={32} className="text-white/30 mx-auto mb-2" />
                  <p className="text-white/60 text-sm">Klik om bestand te kiezen</p>
                  <p className="text-white/30 text-xs mt-1">PDF, PowerPoint, Word, Excel</p>
                </label>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowUploadFile(false)}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
              >
                Annuleren
              </button>
              <button
                onClick={uploadFile}
                disabled={!selectedFile || uploading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Uploaden
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}