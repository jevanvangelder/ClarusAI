import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import {
  FileText, Calendar, CheckCircle, Clock,
  AlertTriangle, BookOpen, ChevronRight, Search, X
} from 'lucide-react'

interface OpdrachtRij {
  id: string
  class_id: string
  title: string
  beschrijving: string | null
  type: string | null
  max_punten: number | null
  deadline: string | null
  created_at: string
  vaknaam: string | null
  klasnaam: string
  eigen_titel: string | null
  ingeleverd: boolean
  nagekeken: boolean
  totaal_punten: number | null
  cijfer: number | null
  te_laat: boolean
}

type Filter = 'alles' | 'open' | 'ingeleverd' | 'nagekeken'

const TYPE_COLORS: Record<string, string> = {
  huiswerk:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  oefentoets: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  casus:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
  opdracht:   'text-green-400 bg-green-500/10 border-green-500/20',
}

export default function StudentOpdrachtenOverzicht() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [opdrachten, setOpdrachten] = useState<OpdrachtRij[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Filter>('alles')
  const [zoekterm, setZoekterm] = useState('')

  useEffect(() => {
    if (user) loadOpdrachten()
  }, [user])

  const loadOpdrachten = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data: klassen } = await supabase
        .from('mijn_klassen')
        .select('id, name, vak, eigen_titel')
        .eq('is_active', true)

      if (!klassen || klassen.length === 0) { setOpdrachten([]); setLoading(false); return }

      const klasIds = klassen.map(k => k.id)
      const { data: acData } = await supabase
        .from('assignment_classes')
        .select('assignment_id, class_id, deadline')
        .in('class_id', klasIds)

      if (!acData || acData.length === 0) { setOpdrachten([]); setLoading(false); return }

      const assignmentIds = [...new Set(acData.map((r: any) => r.assignment_id))]
      const { data: aData } = await supabase
        .from('assignments')
        .select('id, title, beschrijving, type, max_punten, created_at')
        .in('id', assignmentIds)
        .eq('is_active', true)

      if (!aData || aData.length === 0) { setOpdrachten([]); setLoading(false); return }

      const { data: subs } = await supabase
        .from('assignment_submissions')
        .select('assignment_id, ingeleverd_op, ai_nakijk_status, totaal_punten')
        .eq('student_id', user.id)
        .in('assignment_id', assignmentIds)

      const subMap: Record<string, any> = {}
      ;(subs || []).forEach(s => { subMap[s.assignment_id] = s })

      const klasMap: Record<string, typeof klassen[0]> = {}
      klassen.forEach(k => { klasMap[k.id] = k })

      const rijen: OpdrachtRij[] = []

      for (const ac of acData) {
        const a = aData.find((x: any) => x.id === ac.assignment_id)
        if (!a) continue
        const klas = klasMap[ac.class_id]
        if (!klas) continue
        const sub = subMap[a.id]

        const ingeleverd = !!sub?.ingeleverd_op
        const nagekeken = sub?.ai_nakijk_status === 'done'
        const totaal = sub?.totaal_punten ?? null
        const cijfer = nagekeken && a.max_punten && totaal !== null
          ? Math.max(1, Math.min(10, Math.round((1 + (totaal / a.max_punten) * 9) * 10) / 10))
          : null

        // Controleer of te laat ingeleverd
        const te_laat = ingeleverd && !!ac.deadline && new Date(sub.ingeleverd_op) > new Date(ac.deadline)

        rijen.push({
          id: a.id,
          class_id: ac.class_id,
          title: a.title,
          beschrijving: a.beschrijving,
          type: a.type,
          max_punten: a.max_punten,
          deadline: ac.deadline || null,
          created_at: a.created_at,
          vaknaam: klas.vak,
          klasnaam: klas.name,
          eigen_titel: klas.eigen_titel,
          ingeleverd,
          nagekeken,
          totaal_punten: totaal,
          cijfer,
          te_laat,
        })
      }

      rijen.sort((a, b) => {
        const aOpen = !a.ingeleverd && !!a.deadline
        const bOpen = !b.ingeleverd && !!b.deadline
        if (aOpen && !bOpen) return -1
        if (!aOpen && bOpen) return 1
        if (aOpen && bOpen) {
          return new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime()
        }
        const aDate = a.deadline || a.created_at
        const bDate = b.deadline || b.created_at
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })

      setOpdrachten(rijen)
    } catch (err) {
      console.error('Fout bij laden opdrachten:', err)
    } finally {
      setLoading(false)
    }
  }

  const isVerlopen = (deadline: string) => new Date(deadline) < new Date()
  const isNabij = (deadline: string) => {
    const diff = new Date(deadline).getTime() - Date.now()
    return diff > 0 && diff < 1000 * 60 * 60 * 48
  }

  const gefilterdeOpdrachten = opdrachten.filter(o => {
    const matchFilter =
      filter === 'alles' ? true
      : filter === 'open' ? !o.ingeleverd
      : filter === 'ingeleverd' ? o.ingeleverd && !o.nagekeken
      : filter === 'nagekeken' ? o.nagekeken
      : true

    const term = zoekterm.toLowerCase().trim()
    const matchZoek = !term || [o.title, o.vaknaam, o.klasnaam, o.eigen_titel]
      .some(v => v?.toLowerCase().includes(term))

    return matchFilter && matchZoek
  })

  const aantalOpen = opdrachten.filter(o => !o.ingeleverd).length
  const aantalIngeleverd = opdrachten.filter(o => o.ingeleverd && !o.nagekeken).length
  const aantalNagekeken = opdrachten.filter(o => o.nagekeken).length

  const getStatusBadge = (o: OpdrachtRij) => {
    if (o.nagekeken) return {
      label: o.cijfer ? `Nagekeken · ${o.cijfer.toFixed(1)}` : 'Nagekeken',
      cls: 'bg-green-500/10 border-green-500/20 text-green-400',
      icon: <CheckCircle size={11} />,
    }
    if (o.ingeleverd) return {
      label: 'Ingeleverd',
      cls: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
      icon: <Clock size={11} />,
    }
    if (o.deadline && isVerlopen(o.deadline)) return {
      label: 'Verlopen',
      cls: 'bg-red-500/10 border-red-500/20 text-red-400',
      icon: <AlertTriangle size={11} />,
    }
    if (o.deadline && isNabij(o.deadline)) return {
      label: 'Bijna verlopen',
      cls: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      icon: <AlertTriangle size={11} />,
    }
    return {
      label: 'Open',
      cls: 'bg-white/5 border-white/10 text-white/50',
      icon: <FileText size={11} />,
    }
  }

  const FILTERS: { key: Filter; label: string; count?: number }[] = [
    { key: 'alles', label: 'Alles', count: opdrachten.length },
    { key: 'open', label: 'Open', count: aantalOpen },
    { key: 'ingeleverd', label: 'Ingeleverd', count: aantalIngeleverd },
    { key: 'nagekeken', label: 'Nagekeken', count: aantalNagekeken },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Opdrachten</h2>
        <p className="text-white/50 text-sm mt-1">Jouw openstaande en voltooide opdrachten</p>
      </div>

      {/* Filters + zoekbalk */}
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-all ${
              filter === f.key
                ? 'bg-blue-600/20 border-blue-500/30 text-blue-400'
                : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70'
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                filter === f.key ? 'bg-blue-500/20 text-blue-300' : 'bg-white/5 text-white/30'
              }`}>
                {f.count}
              </span>
            )}
          </button>
        ))}

        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={zoekterm}
            onChange={e => setZoekterm(e.target.value)}
            placeholder="Zoeken..."
            className="bg-white/5 border border-white/10 rounded-lg pl-8 pr-8 py-1.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 w-48"
          />
          {zoekterm && (
            <button onClick={() => setZoekterm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Lijst */}
      {loading ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex items-center justify-center">
          <p className="text-white/40 text-sm">Laden...</p>
        </div>
      ) : gefilterdeOpdrachten.length === 0 ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <FileText size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">
            {zoekterm || filter !== 'alles' ? 'Geen opdrachten gevonden' : 'Nog geen opdrachten'}
          </h3>
          <p className="text-white/40 text-sm max-w-sm">
            {zoekterm || filter !== 'alles'
              ? 'Probeer een andere filter of zoekterm.'
              : 'Opdrachten van je docenten verschijnen hier zodra ze zijn aangemaakt.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {gefilterdeOpdrachten.map(o => {
            const status = getStatusBadge(o)
            const typeColor = TYPE_COLORS[o.type || ''] || TYPE_COLORS.huiswerk
            const verlopen = o.deadline ? isVerlopen(o.deadline) : false
            const nabij = o.deadline ? isNabij(o.deadline) : false

            return (
              <button
                key={`${o.id}-${o.class_id}`}
                onClick={() => navigate(`/vakken/${o.class_id}/opdracht/${o.id}`)}
                className="w-full text-left bg-[#0f1029] border border-white/10 hover:border-blue-500/30 hover:bg-blue-500/5 rounded-xl px-5 py-4 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="flex items-center gap-1 text-xs text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                        <BookOpen size={10} />
                        {o.eigen_titel || o.vaknaam || o.klasnaam}
                      </span>
                      {o.type && (
                        <span className={`text-xs px-2 py-0.5 rounded border ${typeColor}`}>
                          {o.type}
                        </span>
                      )}
                      {o.max_punten != null && (
                        <span className="text-white/25 text-xs">{o.max_punten}pt</span>
                      )}
                      {/* Te laat badge */}
                      {o.te_laat && (
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded border bg-red-500/10 border-red-500/20 text-red-400">
                          <AlertTriangle size={10} />
                          Te laat ingeleverd
                        </span>
                      )}
                    </div>

                    <h3 className="text-white font-semibold truncate">{o.title}</h3>

                    {o.beschrijving && (
                      <p className="text-white/35 text-xs mt-0.5 line-clamp-1">{o.beschrijving}</p>
                    )}

                    {o.deadline && (
                      <p className={`text-xs mt-1.5 flex items-center gap-1 ${
                        verlopen ? 'text-red-400/70'
                        : nabij ? 'text-amber-400'
                        : 'text-white/30'
                      }`}>
                        <Calendar size={10} />
                        {verlopen
                          ? `Verlopen op ${new Date(o.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`
                          : `Deadline: ${new Date(o.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} om ${new Date(o.deadline).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
                        }
                        {nabij && ' ⚠️'}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${status.cls}`}>
                      {status.icon}
                      {status.label}
                    </span>
                    <ChevronRight size={15} className="text-white/20 group-hover:text-blue-400 transition-colors" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}