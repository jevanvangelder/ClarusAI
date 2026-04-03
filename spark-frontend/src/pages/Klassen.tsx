import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Users, Plus, X, BookOpen, Calendar, Copy, Check, LogIn, Search, MoreVertical, Trash2, Tag, Pencil } from 'lucide-react'
import { toast } from 'sonner'

interface Klas {
  id: string
  name: string
  vak: string | null
  schooljaar: string | null
  beschrijving: string | null
  code: string
  tags: string[]
  is_active: boolean
  created_by: string
  created_at: string
  school_name: string | null
  leerling_count: number
  student_names: string[]
}

export default function Klassen() {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [joinModalOpen, setJoinModalOpen] = useState(false)
  const [tagsModalOpen, setTagsModalOpen] = useState(false)
  const [naamModalOpen, setNaamModalOpen] = useState(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [selectedKlasForTags, setSelectedKlasForTags] = useState<Klas | null>(null)
  const [selectedKlasForNaam, setSelectedKlasForNaam] = useState<Klas | null>(null)

  // Zoeken & filteren
  const [zoekterm, setZoekterm] = useState('')
  const [actieveTag, setActieveTag] = useState<string | null>(null)

  // Formulier: nieuwe klas
  const [naam, setNaam] = useState('')
  const [vak, setVak] = useState('')
  const [schooljaar, setSchooljaar] = useState('')
  const [beschrijving, setBeschrijving] = useState('')
  const [nieuweTags, setNieuweTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')

  // Formulier: naam wijzigen
  const [nieuweNaam, setNieuweNaam] = useState('')

  // Formulier: tags bewerken
  const [bewerkTags, setBewerkTags] = useState<string[]>([])
  const [bewerkTagInput, setBewerkTagInput] = useState('')

  // Formulier: join via code
  const [joinCode, setJoinCode] = useState('')

  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchKlassen = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mijn_klassen')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setKlassen(data || [])
    } catch (err) {
      console.error('Fout bij ophalen klassen:', err)
      toast.error('Kon klassen niet laden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchKlassen()
  }, [user])

  const alleTagsUniek = Array.from(
    new Set(klassen.flatMap((k) => k.tags || []))
  ).sort()

  const gefilterdeKlassen = klassen.filter((klas) => {
    const term = zoekterm.toLowerCase().trim()
    const matchesTag = actieveTag ? (klas.tags || []).includes(actieveTag) : true
    if (!term) return matchesTag
    const matchesNaam = klas.name.toLowerCase().includes(term)
    const matchesVak = klas.vak?.toLowerCase().includes(term) ?? false
    const matchesTags = (klas.tags || []).some((t) => t.toLowerCase().includes(term))
    const matchesStudent = (klas.student_names || []).some((n) => n.toLowerCase().includes(term))
    return matchesTag && (matchesNaam || matchesVak || matchesTags || matchesStudent)
  })

  // Nieuwe klas aanmaken
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!naam.trim()) { setError('Naam is verplicht'); return }
    setSaving(true)
    setError(null)
    try {
      const { error } = await supabase.from('classes').insert({
        name: naam.trim(),
        vak: vak.trim() || null,
        schooljaar: schooljaar.trim() || null,
        beschrijving: beschrijving.trim() || null,
        tags: nieuweTags,
        created_by: user.id,
        is_active: true,
      })
      if (error) throw error
      toast.success('Klas aangemaakt!')
      resetForm()
      setModalOpen(false)
      fetchKlassen()
    } catch (err: any) {
      setError(err.message || 'Fout bij aanmaken klas')
    } finally {
      setSaving(false)
    }
  }

  // Naam wijzigen
  const handleSaveNaam = async () => {
    if (!selectedKlasForNaam) return
    if (!nieuweNaam.trim()) { toast.error('Naam mag niet leeg zijn'); return }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('classes')
        .update({ name: nieuweNaam.trim() })
        .eq('id', selectedKlasForNaam.id)
      if (error) throw error
      toast.success('Naam gewijzigd!')
      setNaamModalOpen(false)
      setSelectedKlasForNaam(null)
      setNieuweNaam('')
      fetchKlassen()
    } catch (err: any) {
      toast.error(err.message || 'Fout bij wijzigen naam')
    } finally {
      setSaving(false)
    }
  }

  // Student join via klascode
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) { setError('Voer een klascode in'); return }
    setJoining(true)
    setError(null)
    try {
      const { data, error } = await supabase.rpc('join_class_by_code', {
        p_code: joinCode.trim()
      })
      if (error) throw error
      const result = data as { success: boolean; error?: string; class_name?: string }
      if (!result.success) { setError(result.error || 'Onbekende fout'); return }
      toast.success(`Je hebt deelgenomen aan ${result.class_name}!`)
      setJoinCode('')
      setJoinModalOpen(false)
      fetchKlassen()
    } catch (err: any) {
      setError(err.message || 'Fout bij deelnemen aan klas')
    } finally {
      setJoining(false)
    }
  }

  // Klas verwijderen (soft delete)
  const handleDelete = async (klasId: string) => {
    try {
      const { error } = await supabase
        .from('classes')
        .update({ is_active: false })
        .eq('id', klasId)
      if (error) throw error
      toast.success('Klas verwijderd')
      setDeleteConfirmId(null)
      fetchKlassen()
    } catch (err: any) {
      toast.error(err.message || 'Fout bij verwijderen klas')
    }
  }

  // Tags opslaan
  const handleSaveTags = async () => {
    if (!selectedKlasForTags) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('classes')
        .update({ tags: bewerkTags })
        .eq('id', selectedKlasForTags.id)
      if (error) throw error
      toast.success('Labels opgeslagen!')
      setTagsModalOpen(false)
      setSelectedKlasForTags(null)
      fetchKlassen()
    } catch (err: any) {
      toast.error(err.message || 'Fout bij opslaan labels')
    } finally {
      setSaving(false)
    }
  }

  const handleTagKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    input: string,
    setInput: (v: string) => void,
    tags: string[],
    setTags: (v: string[]) => void
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = input.trim().replace(/,$/, '')
      if (tag && !tags.includes(tag)) setTags([...tags, tag])
      setInput('')
    }
  }

  const copyCode = async (code: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await navigator.clipboard.writeText(code)
    setCopiedId(id)
    toast.success(`Klascode ${code} gekopieerd!`)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const resetForm = () => {
    setNaam(''); setVak(''); setSchooljaar(''); setBeschrijving('')
    setNieuweTags([]); setTagInput(''); setError(null)
  }

  const isStaff = role === 'teacher' || role === 'school_admin' || role === 'admin'
  const isStudent = role === 'student'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Klassen</h2>
          <p className="text-white/50 text-sm mt-1">
            {role === 'teacher' ? 'Beheer jouw klassen en leerlingen'
              : role === 'school_admin' ? 'Overzicht van alle klassen op jouw school'
              : role === 'admin' ? 'Overzicht van alle klassen in het systeem'
              : 'Jouw klassen'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {isStudent && (
            <button
              onClick={() => { setJoinModalOpen(true); setError(null) }}
              className="flex items-center gap-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-sm rounded-lg transition-all"
            >
              <LogIn size={16} />
              Deelnemen via code
            </button>
          )}
          {isStaff && (
            <button
              onClick={() => { setModalOpen(true); setError(null) }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all"
            >
              <Plus size={16} />
              Nieuwe klas
            </button>
          )}
        </div>
      </div>

      {/* Zoekbalk + tag-filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder={isStaff ? 'Zoek op klasnaam, vak, label of leerlingnaam...' : 'Zoek op klasnaam of vak...'}
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50"
          />
          {zoekterm && (
            <button onClick={() => setZoekterm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {alleTagsUniek.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActieveTag(null)}
              className={`px-3 py-1 rounded-full text-xs border transition-all ${actieveTag === null ? 'bg-blue-500/30 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
            >
              Alle klassen
            </button>
            {alleTagsUniek.map((tag) => (
              <button
                key={tag}
                onClick={() => setActieveTag(actieveTag === tag ? null : tag)}
                className={`px-3 py-1 rounded-full text-xs border transition-all ${actieveTag === tag ? 'bg-blue-500/30 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-white/40 hover:text-white/70'}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Klassenlijst */}
      {loading ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex items-center justify-center">
          <p className="text-white/40 text-sm">Klassen laden...</p>
        </div>
      ) : gefilterdeKlassen.length === 0 ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <Users size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {zoekterm || actieveTag ? 'Geen klassen gevonden' : 'Nog geen klassen'}
          </h3>
          <p className="text-white/40 text-sm max-w-sm">
            {zoekterm || actieveTag ? 'Probeer een andere zoekterm of filter.'
              : isStudent ? 'Vraag je docent om een klascode en klik op "Deelnemen via code".'
              : 'Klik op "Nieuwe klas" om jouw eerste klas aan te maken.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {gefilterdeKlassen.map((klas) => (
            <div
              key={klas.id}
              onClick={() => navigate(`/klassen/${klas.id}`)}
              className="bg-[#0f1029] border border-white/10 hover:border-blue-500/30 rounded-xl p-5 transition-all group cursor-pointer relative"
            >
              {/* Three-dots menu */}
              {isStaff && (
                <div
                  className="absolute top-3 right-3"
                  ref={openMenuId === klas.id ? menuRef : undefined}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === klas.id ? null : klas.id) }}
                    className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
                  >
                    <MoreVertical size={15} />
                  </button>

                  {openMenuId === klas.id && (
                    <div className="absolute right-0 top-8 w-48 bg-[#1a1d3a] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedKlasForNaam(klas)
                          setNieuweNaam(klas.name)
                          setNaamModalOpen(true)
                          setOpenMenuId(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <Pencil size={14} />
                        Naam wijzigen
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedKlasForTags(klas)
                          setBewerkTags(klas.tags || [])
                          setBewerkTagInput('')
                          setTagsModalOpen(true)
                          setOpenMenuId(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <Tag size={14} />
                        Labels bewerken
                      </button>
                      <div className="border-t border-white/5 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmId(klas.id)
                          setOpenMenuId(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all text-left"
                      >
                        <Trash2 size={14} />
                        Klas verwijderen
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-start gap-3 mb-3 pr-7">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Users size={18} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{klas.name}</h3>
                  {klas.vak && (
                    <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                      <BookOpen size={11} />
                      {klas.vak}
                    </p>
                  )}
                </div>
              </div>

              {klas.beschrijving && (
                <p className="text-white/40 text-sm mb-3 line-clamp-2">{klas.beschrijving}</p>
              )}

              {(klas.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {klas.tags.map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300/70 text-xs">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {isStaff && (
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-white/30">Klascode:</span>
                  <code className="text-xs font-mono bg-white/5 border border-white/10 rounded px-2 py-0.5 text-blue-300 tracking-widest">
                    {klas.code}
                  </code>
                  <button
                    onClick={(e) => copyCode(klas.code, klas.id, e)}
                    className="text-white/30 hover:text-blue-400 transition-colors"
                    title="Kopieer klascode"
                  >
                    {copiedId === klas.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                  </button>
                </div>
              )}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                <div className="flex items-center gap-3">
                  {klas.schooljaar && (
                    <span className="text-white/30 text-xs flex items-center gap-1">
                      <Calendar size={11} />
                      {klas.schooljaar}
                    </span>
                  )}
                  {isStaff && (
                    <span className="text-white/30 text-xs flex items-center gap-1">
                      <Users size={11} />
                      {klas.leerling_count} leerling{klas.leerling_count !== 1 ? 'en' : ''}
                    </span>
                  )}
                </div>
                <span className="text-xs text-blue-400/60 ml-auto group-hover:text-blue-400 transition-colors select-none">
                  Bekijken →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Nieuwe klas aanmaken */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Nieuwe klas aanmaken</h3>
              <button onClick={() => { setModalOpen(false); resetForm() }} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Naam klas <span className="text-red-400">*</span></label>
                <input type="text" value={naam} onChange={(e) => setNaam(e.target.value)}
                  placeholder="bijv. 3A of Klas Wiskunde"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Vak</label>
                <input type="text" value={vak} onChange={(e) => setVak(e.target.value)}
                  placeholder="bijv. Wiskunde, Nederlands"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Schooljaar</label>
                <input type="text" value={schooljaar} onChange={(e) => setSchooljaar(e.target.value)}
                  placeholder="bijv. 2025-2026"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Beschrijving</label>
                <textarea value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)}
                  placeholder="Optionele beschrijving" rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 resize-none" />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Labels</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {nieuweTags.map((tag) => (
                    <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300/70 text-xs">
                      {tag}
                      <button type="button" onClick={() => setNieuweTags(nieuweTags.filter(t => t !== tag))} className="hover:text-red-400 transition-colors">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => handleTagKeyDown(e, tagInput, setTagInput, nieuweTags, setNieuweTags)}
                  placeholder="Typ een label en druk Enter (bijv. HAVO, Leerjaar 3)"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-purple-500/50" />
                <p className="text-white/25 text-xs mt-1">Druk op Enter of komma om een label toe te voegen.</p>
              </div>
              <p className="text-white/30 text-xs">✓ De klascode wordt automatisch gegenereerd.</p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setModalOpen(false); resetForm() }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                  Annuleren
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm transition-all disabled:opacity-50">
                  {saving ? 'Opslaan...' : 'Klas aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Naam wijzigen */}
      {naamModalOpen && selectedKlasForNaam && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Naam wijzigen</h3>
              <button onClick={() => { setNaamModalOpen(false); setSelectedKlasForNaam(null); setNieuweNaam('') }}
                className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Nieuwe naam <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={nieuweNaam}
                  onChange={(e) => setNieuweNaam(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNaam() }}
                  placeholder="bijv. 3A of Klas Wiskunde"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setNaamModalOpen(false); setSelectedKlasForNaam(null); setNieuweNaam('') }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                  Annuleren
                </button>
                <button onClick={handleSaveNaam} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm transition-all disabled:opacity-50">
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Labels bewerken */}
      {tagsModalOpen && selectedKlasForTags && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Labels bewerken</h3>
              <button onClick={() => { setTagsModalOpen(false); setSelectedKlasForTags(null) }}
                className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-white/40 text-sm">Labels voor <span className="text-white font-medium">{selectedKlasForTags.name}</span></p>
              <div className="flex flex-wrap gap-1.5">
                {bewerkTags.map((tag) => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300/70 text-xs">
                    {tag}
                    <button type="button" onClick={() => setBewerkTags(bewerkTags.filter(t => t !== tag))} className="hover:text-red-400 transition-colors">
                      <X size={10} />
                    </button>
                  </span>
                ))}
                {bewerkTags.length === 0 && <p className="text-white/25 text-xs">Nog geen labels.</p>}
              </div>
              <input type="text" value={bewerkTagInput} onChange={(e) => setBewerkTagInput(e.target.value)}
                onKeyDown={(e) => handleTagKeyDown(e, bewerkTagInput, setBewerkTagInput, bewerkTags, setBewerkTags)}
                placeholder="Typ een label en druk Enter"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-purple-500/50" />
              <p className="text-white/25 text-xs">Druk op Enter of komma om een label toe te voegen.</p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setTagsModalOpen(false); setSelectedKlasForTags(null) }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                  Annuleren
                </button>
                <button onClick={handleSaveTags} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-sm transition-all disabled:opacity-50">
                  {saving ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Verwijder bevestiging */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Klas verwijderen?</h3>
                <p className="text-white/40 text-sm mt-0.5">Deze actie kan niet ongedaan gemaakt worden.</p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                Annuleren
              </button>
              <button onClick={() => handleDelete(deleteConfirmId)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm transition-all">
                Ja, verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Deelnemen via klascode (student) */}
      {joinModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Deelnemen aan klas</h3>
              <button onClick={() => { setJoinModalOpen(false); setJoinCode(''); setError(null) }}
                className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleJoin} className="p-6 space-y-4">
              {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">{error}</div>}
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Klascode <span className="text-red-400">*</span></label>
                <input type="text" value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="bijv. AB3X9KPQ" maxLength={8}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono tracking-widest placeholder:text-white/20 focus:outline-none focus:border-green-500/50 uppercase" />
                <p className="text-white/30 text-xs mt-1.5">Vraag de code aan je docent.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setJoinModalOpen(false); setJoinCode(''); setError(null) }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                  Annuleren
                </button>
                <button type="submit" disabled={joining}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-sm transition-all disabled:opacity-50">
                  {joining ? 'Deelnemen...' : 'Deelnemen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}