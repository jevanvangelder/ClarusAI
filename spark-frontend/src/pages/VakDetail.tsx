import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, BookOpen, Calendar, Users, FileText, Info } from 'lucide-react'
import { toast } from 'sonner'

interface VakInfo {
  id: string
  name: string
  vak: string | null
  schooljaar: string | null
  beschrijving: string | null
  docent_naam: string | null
  leerling_count: number
  eigen_titel: string | null
}

interface Opdracht {
  id: string
  title: string
  beschrijving: string | null
  deadline: string | null
  created_at: string
}

type Tab = 'opdrachten' | 'info'

export default function VakDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [vak, setVak] = useState<VakInfo | null>(null)
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('opdrachten')

  const fetchVak = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('mijn_klassen')
      .select('id, name, vak, schooljaar, beschrijving, docent_naam, leerling_count, eigen_titel')
      .eq('id', id)
      .single()
    if (error) { toast.error('Vak niet gevonden'); navigate('/vakken'); return }
    setVak(data)
  }

  const fetchOpdrachten = async () => {
    if (!id) return
    const { data, error } = await supabase
      .from('assignments')
      .select('id, title, beschrijving, deadline, created_at')
      .eq('class_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    if (error) { console.error(error); return }
    setOpdrachten(data || [])
  }

  useEffect(() => {
    const init = async () => {
      setLoading(true)
      await Promise.all([fetchVak(), fetchOpdrachten()])
      setLoading(false)
    }
    if (id) init()
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/40 text-sm">Laden...</p>
      </div>
    )
  }

  if (!vak) return null

  const isDeadlineNabij = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    return diff > 0 && diff < 1000 * 60 * 60 * 48 // binnen 48 uur
  }

  const isVerlopen = (deadline: string) => new Date(deadline).getTime() < Date.now()

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'opdrachten', label: 'Opdrachten', icon: FileText },
    { key: 'info', label: 'Info', icon: Info },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate('/vakken')}
          className="mt-1 text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-white">
            {vak.eigen_titel || vak.name}
          </h2>
          {vak.eigen_titel && vak.eigen_titel !== vak.name && (
            <p className="text-white/30 text-sm">{vak.name}</p>
          )}
          <div className="flex items-center gap-3 flex-wrap mt-1">
            {vak.vak && (
              <span className="flex items-center gap-1 text-blue-400/70 text-sm">
                <BookOpen size={13} />
                {vak.vak}
              </span>
            )}
            {vak.schooljaar && (
              <span className="flex items-center gap-1 text-white/40 text-sm">
                <Calendar size={13} />
                {vak.schooljaar}
              </span>
            )}
            {vak.docent_naam && (
              <span className="text-white/40 text-sm">👤 {vak.docent_naam}</span>
            )}
          </div>
        </div>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <Users size={14} className="text-blue-400" />
          <span className="text-white/70 text-sm">{vak.leerling_count} leerling{vak.leerling_count !== 1 ? 'en' : ''} in deze klas</span>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
          <FileText size={14} className="text-purple-400" />
          <span className="text-white/70 text-sm">{opdrachten.length} opdracht{opdrachten.length !== 1 ? 'en' : ''}</span>
        </div>
      </div>

      {/* Tabbladen */}
      <div className="border-b border-white/10">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === tab.key
                  ? 'border-blue-400 text-blue-400'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TAB: Opdrachten ── */}
      {activeTab === 'opdrachten' && (
        <div className="space-y-3">
          {opdrachten.length === 0 ? (
            <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <FileText size={28} className="text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Geen opdrachten</h3>
              <p className="text-white/40 text-sm">Je docent heeft nog geen opdrachten aangemaakt voor dit vak.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {opdrachten.map(opdracht => {
                const verlopen = opdracht.deadline ? isVerlopen(opdracht.deadline) : false
                const nabij = opdracht.deadline ? isDeadlineNabij(opdracht.deadline) : false
                return (
                  <div key={opdracht.id} className="bg-[#0f1029] border border-white/10 rounded-xl p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold">{opdracht.title}</h3>
                        {opdracht.beschrijving && (
                          <p className="text-white/40 text-sm mt-1 line-clamp-3">{opdracht.beschrijving}</p>
                        )}
                        {opdracht.deadline && (
                          <p className={`text-xs mt-2 flex items-center gap-1 ${
                            verlopen ? 'text-red-400/70' : nabij ? 'text-amber-400' : 'text-white/40'
                          }`}>
                            <Calendar size={11} />
                            {verlopen ? 'Verlopen: ' : 'Deadline: '}
                            {new Date(opdracht.deadline).toLocaleDateString('nl-NL', {
                              day: 'numeric', month: 'long', year: 'numeric',
                              hour: '2-digit', minute: '2-digit'
                            })}
                            {nabij && ' ⚠️'}
                          </p>
                        )}
                        <p className="text-white/25 text-xs mt-1">
                          Geplaatst op {new Date(opdracht.created_at).toLocaleDateString('nl-NL')}
                        </p>
                      </div>
                      {/* Status badge */}
                      <div className={`shrink-0 px-2 py-0.5 rounded-full text-xs border ${
                        verlopen
                          ? 'bg-red-500/10 border-red-500/20 text-red-400/70'
                          : nabij
                          ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                          : 'bg-green-500/10 border-green-500/20 text-green-400/70'
                      }`}>
                        {verlopen ? 'Verlopen' : nabij ? 'Bijna verlopen' : 'Actief'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Info ── */}
      {activeTab === 'info' && (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 space-y-4 max-w-lg">
          <h3 className="text-white font-semibold">Over dit vak</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className="text-white/30 text-sm w-24 shrink-0">Klasnaam</span>
              <span className="text-white text-sm">{vak.name}</span>
            </div>
            {vak.vak && (
              <div className="flex items-start gap-3">
                <span className="text-white/30 text-sm w-24 shrink-0">Vak</span>
                <span className="text-white text-sm">{vak.vak}</span>
              </div>
            )}
            {vak.schooljaar && (
              <div className="flex items-start gap-3">
                <span className="text-white/30 text-sm w-24 shrink-0">Schooljaar</span>
                <span className="text-white text-sm">{vak.schooljaar}</span>
              </div>
            )}
            {vak.docent_naam && (
              <div className="flex items-start gap-3">
                <span className="text-white/30 text-sm w-24 shrink-0">Docent</span>
                <span className="text-white text-sm">{vak.docent_naam}</span>
              </div>
            )}
            <div className="flex items-start gap-3">
              <span className="text-white/30 text-sm w-24 shrink-0">Leerlingen</span>
              <span className="text-white text-sm">{vak.leerling_count} leerling{vak.leerling_count !== 1 ? 'en' : ''}</span>
            </div>
            {vak.beschrijving && (
              <div className="flex items-start gap-3">
                <span className="text-white/30 text-sm w-24 shrink-0">Beschrijving</span>
                <span className="text-white/70 text-sm">{vak.beschrijving}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}