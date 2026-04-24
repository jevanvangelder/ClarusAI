import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Users, BookOpen, Calendar, Copy, Check,
  Trash2, Plus, X, Settings, FileText
} from 'lucide-react'
import { toast } from 'sonner'

interface KlasInfo {
  id: string
  name: string
  vak: string | null
  schooljaar: string | null
  beschrijving: string | null
  code: string
  tags: string[]
  is_active: boolean
  created_by: string
  docent_naam: string | null
  leerling_count: number
}

interface Leerling {
  student_id: string
  first_name: string | null
  last_name: string | null
  full_name: string | null
  email: string | null
  joined_at: string
}

interface Opdracht {
  id: string
  title: string
  beschrijving: string | null
  deadline: string | null
  type: string
  max_punten: number
  is_active: boolean
  created_at: string
}

type Tab = 'leerlingen' | 'opdrachten' | 'instellingen'

const TYPE_COLORS: Record<string, string> = {
  huiswerk:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  oefentoets: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  casus:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
  opdracht:   'text-green-400 bg-green-500/10 border-green-500/20',
}

export default function KlasDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [klas, setKlas] = useState<KlasInfo | null>(null)
  const [leerlingen, setLeerlingen] = useState<Leerling[]>([])
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('leerlingen')
  const [copied, setCopied] = useState(false)

  const [editNaam, setEditNaam] = useState('')
  const [editVak, setEditVak] = useState('')
  const [editSchooljaar, setEditSchooljaar] = useState('')
  const [editBeschrijving, setEditBeschrijving] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editTagInput, setEditTagInput] = useState('')
  const [savingInstellingen, setSavingInstellingen] = useState(false)

  const [verwijderLeerlingId, setVerwijderLeerlingId] = useState<string | null>(null)
  const [archiverenModal, setArchiverenModal] = useState(false)

  const fetchKlas = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('klas_detail')
      .select('*')
      .eq('id', id)
      .single()
    if (error) { toast.error('Klas niet gevonden'); navigate('/klassen'); return }
    setKlas(data)
    setEditNaam(data.name)
    setEditVak(data.vak || '')
    setEditSchooljaar(data.schooljaar || '')
    setEditBeschrijving(data.beschrijving || '')
    setEditTags(data.tags || [])
  }

  const fetchLeerlingen = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('klas_leerlingen')
      .select('student_id, first_name, last_name, full_name, email, joined_at')
      .eq('class_id', id)
      .order('joined_at', { ascending: true })
    if (error) { console.error('Fout bij ophalen leerlingen:', error); return }
    setLeerlingen(data || [])
  }

  const fetchOpdrachten = async () => {
    if (!id) return
    // Haal opdrachten op via assignment_classes koppeltabel
    const { data, error } = await supabase
      .from('assignment_classes')
      .select(`
        deadline,
        assignments (
          id, title, beschrijving, type, max_punten, is_active, created_at
        )
      `)
      .eq('class_id', id)
    if (error) { console.error('Fout bij ophalen opdrachten:', error); return }

    const opdrachtList: Opdracht[] = (data || [])
      .filter((row: any) => row.assignments?.is_active)
      .map((row: any) => ({
        id: row.assignments.id,
        title: row.assignments.title,
        beschrijving: row.assignments.beschrijving,
        deadline: row.deadline,
        type: row.assignments.type || 'opdracht',
        max_punten: row.assignments.max_punten || 0,
        is_active: row.assignments.is_active,
        created_at: row.assignments.created_at,
      }))
      .sort((a: Opdracht, b: Opdracht) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    setOpdrachten(opdrachtList)
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchKlas(), fetchLeerlingen(), fetchOpdrachten()])
      setLoading(false)
    }
    if (id) init()
  }, [id])

  const copyCode = async () => {
    if (!klas) return
    await navigator.clipboard.writeText(klas.code)
    setCopied(true)
    toast.success(`Klascode ${klas.code} gekopieerd!`)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleVerwijderLeerling = async (studentId: string) => {
    const { error } = await supabase
      .from('class_members')
      .delete()
      .eq('class_id', id)
      .eq('student_id', studentId)
    if (error) { toast.error('Fout bij verwijderen leerling'); return }
    toast.success('Leerling verwijderd uit klas')
    setVerwijderLeerlingId(null)
    fetchLeerlingen()
    fetchKlas()
  }

  const handleSaveInstellingen = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editNaam.trim()) { toast.error('Naam is verplicht'); return }
    setSavingInstellingen(true)
    const { error } = await supabase
      .from('classes')
      .update({
        name: editNaam.trim(),
        vak: editVak.trim() || null,
        schooljaar: editSchooljaar.trim() || null,
        beschrijving: editBeschrijving.trim() || null,
        tags: editTags,
      })
      .eq('id', id)
    setSavingInstellingen(false)
    if (error) { toast.error(error.message); return }
    toast.success('Instellingen opgeslagen!')
    fetchKlas()
  }

  const handleArchiveren = async () => {
    const { error } = await supabase
      .from('classes')
      .update({ is_active: false })
      .eq('id', id)
    if (error) { toast.error('Fout bij archiveren'); return }
    toast.success('Klas gearchiveerd')
    navigate('/klassen')
  }

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const tag = editTagInput.trim().replace(/,$/, '')
      if (tag && !editTags.includes(tag)) setEditTags([...editTags, tag])
      setEditTagInput('')
    }
  }

  const getInitials = (l: Leerling) => {
    if (l.first_name && l.last_name) return `${l.first_name[0]}${l.last_name[0]}`.toUpperCase()
    if (l.full_name) return l.full_name[0].toUpperCase()
    return '?'
  }

  const getDisplayName = (l: Leerling) => {
    if (l.first_name && l.last_name) return `${l.first_name} ${l.last_name}`
    if (l.full_name) return l.full_name
    return l.email || 'Onbekend'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/40 text-sm">Laden...</p>
      </div>
    )
  }

  if (!klas) return null

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'leerlingen', label: 'Leerlingen', icon: Users },
    { key: 'opdrachten', label: 'Opdrachten', icon: FileText },
    { key: 'instellingen', label: 'Instellingen', icon: Settings },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={() => navigate('/klassen')} className="mt-1 text-white/50 hover:text-white transition-colors shrink-0">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{klas.name}</h2>
              <div className="flex items-center gap-3 flex-wrap mt-1">
                {klas.vak && (
                  <span className="flex items-center gap-1 text-white/40 text-xs sm:text-sm">
                    <BookOpen size={12} /> {klas.vak}
                  </span>
                )}
                {klas.schooljaar && (
                  <span className="flex items-center gap-1 text-white/40 text-xs sm:text-sm">
                    <Calendar size={12} /> {klas.schooljaar}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 shrink-0">
              <code className="text-xs font-mono text-blue-300 tracking-widest">{klas.code}</code>
              <button onClick={copyCode} className="text-white/30 hover:text-blue-400 transition-colors ml-1">
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
          {(klas.tags || []).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {klas.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300/70 text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <Users size={13} className="text-blue-400" />
          <span className="text-white/70 text-xs sm:text-sm">{klas.leerling_count} leerling{klas.leerling_count !== 1 ? 'en' : ''}</span>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <FileText size={13} className="text-purple-400" />
          <span className="text-white/70 text-xs sm:text-sm">{opdrachten.length} opdracht{opdrachten.length !== 1 ? 'en' : ''}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-white/10">
        <div className="flex gap-0">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <tab.icon size={15} />
              <span className="hidden xs:inline sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: Leerlingen ── */}
      {activeTab === 'leerlingen' && (
        <div className="space-y-3">
          {leerlingen.length === 0 ? (
            <div className="bg-[#0f1029] border border-white/10 rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                <Users size={28} className="text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Nog geen leerlingen</h3>
              <p className="text-white/40 text-sm max-w-sm">
                Deel de klascode <span className="font-mono text-blue-300">{klas.code}</span> met je leerlingen.
              </p>
            </div>
          ) : (
            <div className="bg-[#0f1029] border border-white/10 rounded-xl overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-white/5">
                <p className="text-white/50 text-xs uppercase tracking-wider">
                  {leerlingen.length} leerling{leerlingen.length !== 1 ? 'en' : ''}
                </p>
              </div>
              <div className="divide-y divide-white/5">
                {leerlingen.map((leerling) => (
                  <div key={leerling.student_id} className="flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-white/[0.02] transition-colors group">
                    <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                      <span className="text-blue-400 text-xs font-semibold">{getInitials(leerling)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{getDisplayName(leerling)}</p>
                      <p className="text-white/30 text-xs truncate">{leerling.email || ''}</p>
                    </div>
                    <p className="text-white/25 text-xs shrink-0 hidden sm:block">
                      {new Date(leerling.joined_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                    </p>
                    <button
                      onClick={() => setVerwijderLeerlingId(leerling.student_id)}
                      className="p-1.5 text-red-400/30 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all shrink-0 opacity-0 group-hover:opacity-100"
                      title="Verwijder uit klas"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Opdrachten ── */}
      {activeTab === 'opdrachten' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button
              onClick={() => navigate('/opdrachten')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all"
            >
              <Plus size={16} /> Nieuwe opdracht
            </button>
          </div>
          {opdrachten.length === 0 ? (
            <div className="bg-[#0f1029] border border-white/10 rounded-xl p-10 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <FileText size={28} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Nog geen opdrachten</h3>
              <p className="text-white/40 text-sm">Wijs een opdracht toe aan deze klas via de Opdrachten-pagina.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {opdrachten.map(opdracht => {
                const typeColor = TYPE_COLORS[opdracht.type] || TYPE_COLORS.opdracht
                const isVerlopen = opdracht.deadline ? new Date(opdracht.deadline) < new Date() : false
                return (
                  <div key={opdracht.id} className="bg-[#0f1029] border border-white/10 hover:border-white/20 rounded-xl p-4 sm:p-5 transition-all">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded border ${typeColor}`}>{opdracht.type}</span>
                          <span className="text-white/30 text-xs">{opdracht.max_punten}pt</span>
                        </div>
                        <h3 className="text-white font-semibold text-sm sm:text-base">{opdracht.title}</h3>
                        {opdracht.beschrijving && (
                          <p className="text-white/40 text-sm line-clamp-2">{opdracht.beschrijving}</p>
                        )}
                        {opdracht.deadline && (
                          <p className={`text-xs mt-1 flex items-center gap-1 ${isVerlopen ? 'text-red-400/70' : 'text-amber-400/70'}`}>
                            <Calendar size={11} />
                            {isVerlopen ? 'Verlopen: ' : 'Deadline: '}
                            {new Date(opdracht.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                            {new Date(opdracht.deadline).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Instellingen ── */}
      {activeTab === 'instellingen' && (
        <div className="space-y-6">
          <form onSubmit={handleSaveInstellingen} className="bg-[#0f1029] border border-white/10 rounded-xl p-5 sm:p-6 space-y-4">
            <h3 className="text-white font-semibold">Klas bewerken</h3>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Naam <span className="text-red-400">*</span></label>
              <input type="text" value={editNaam} onChange={e => setEditNaam(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Vak</label>
              <input type="text" value={editVak} onChange={e => setEditVak(e.target.value)}
                placeholder="bijv. Wiskunde"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Schooljaar</label>
              <input type="text" value={editSchooljaar} onChange={e => setEditSchooljaar(e.target.value)}
                placeholder="bijv. 2025-2026"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50" />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Beschrijving</label>
              <textarea value={editBeschrijving} onChange={e => setEditBeschrijving(e.target.value)}
                rows={3} placeholder="Optionele beschrijving"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 resize-none" />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">Labels</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {editTags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300/70 text-xs">
                    {tag}
                    <button type="button" onClick={() => setEditTags(editTags.filter(t => t !== tag))} className="hover:text-red-400">
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
              <input type="text" value={editTagInput} onChange={e => setEditTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown} placeholder="Typ een label en druk Enter"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-purple-500/50" />
            </div>
            <button type="submit" disabled={savingInstellingen}
              className="w-full px-4 py-2.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all disabled:opacity-50">
              {savingInstellingen ? 'Opslaan...' : 'Wijzigingen opslaan'}
            </button>
          </form>

          <div className="bg-[#0f1029] border border-red-500/20 rounded-xl p-5 sm:p-6 space-y-3">
            <h3 className="text-red-400 font-semibold text-sm">Gevaarzone</h3>
            <p className="text-white/40 text-sm">De klas wordt gearchiveerd en is niet meer zichtbaar voor leerlingen.</p>
            <button onClick={() => setArchiverenModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-sm rounded-lg transition-all">
              <Trash2 size={14} /> Klas archiveren
            </button>
          </div>
        </div>
      )}

      {/* Modal: Leerling verwijderen */}
      {verwijderLeerlingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Leerling verwijderen?</h3>
                <p className="text-white/40 text-sm mt-0.5">De leerling kan opnieuw deelnemen via de klascode.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setVerwijderLeerlingId(null)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                Annuleren
              </button>
              <button onClick={() => handleVerwijderLeerling(verwijderLeerlingId)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm transition-all">
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Archiveren */}
      {archiverenModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Klas archiveren?</h3>
                <p className="text-white/40 text-sm mt-0.5">De klas verdwijnt uit het overzicht.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setArchiverenModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                Annuleren
              </button>
              <button onClick={handleArchiveren}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm transition-all">
                Ja, archiveren
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}