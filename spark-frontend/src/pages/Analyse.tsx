import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, ArrowLeft, Users, TrendingUp, TrendingDown,
  Loader2, ChevronRight, Lightbulb, Brain, MessageSquare,
  Clock, CheckCircle, XCircle, Edit3, Save
} from 'lucide-react'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface OpdrachtStat {
  id: string
  title: string
  type: string
  max_punten: number
  klassen: { class_id: string; klasnaam: string }[]
  aantal_ingeleverd: number
  gemiddelde_score: number
  gemiddeld_cijfer: number
}

interface Inzending {
  student_id: string
  student_naam: string
  totaal_punten: number
  cijfer: number
  ingeleverd_op: string
  antwoorden: any[]
}

interface VraagStat {
  nummer: number
  vraag: string
  max_punten: number
  gemiddeld_behaald: number
  pct: number
}

interface KerninzichtData {
  kerninzicht: string
  vervolgvoorstel: string
  chat_prompt: string
  klasnaam: string
}

type View = 'overzicht' | 'detail' | 'leerling'

export default function Analyse() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [view, setView] = useState<View>('overzicht')
  const [opdrachten, setOpdrachten] = useState<OpdrachtStat[]>([])
  const [loadingOpdrachten, setLoadingOpdrachten] = useState(true)

  const [selectedOpdracht, setSelectedOpdracht] = useState<OpdrachtStat | null>(null)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null)
  const [inzendingen, setInzendingen] = useState<Inzending[]>([])
  const [vraagStats, setVraagStats] = useState<VraagStat[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [kerninzicht, setKerninzicht] = useState<KerninzichtData | null>(null)
  const [loadingKerninzicht, setLoadingKerninzicht] = useState(false)

  // Leerling detail
  const [selectedLeerling, setSelectedLeerling] = useState<Inzending | null>(null)
  const [aangepastePunten, setAangepastePunten] = useState<Record<number, number>>({})
  const [heeftWijzigingen, setHeeftWijzigingen] = useState(false)
  const [savingPunten, setSavingPunten] = useState(false)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoadingOpdrachten(true)
      try {
        const { data: opdr } = await supabase
          .from('assignments')
          .select('id, title, type, max_punten, vragen, assignment_classes(class_id, classes(id, name))')
          .eq('created_by', user.id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })

        if (!opdr) return

        const stats: OpdrachtStat[] = []
        for (const o of opdr) {
          const klassen = (o.assignment_classes || []).map((ac: any) => ({
            class_id: ac.class_id,
            klasnaam: ac.classes?.name || 'Onbekend',
          }))

          const { data: subs } = await supabase
            .from('assignment_submissions')
            .select('totaal_punten')
            .eq('assignment_id', o.id)
            .eq('ai_nakijk_status', 'done')
            .not('ingeleverd_op', 'is', null)

          const aantal = subs?.length || 0
          const scores = (subs || []).map(s => s.totaal_punten || 0)
          const gem_score = aantal > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / aantal) * 10) / 10 : 0
          const gem_cijfer = o.max_punten > 0 ? Math.round((1 + (gem_score / o.max_punten) * 9) * 10) / 10 : 0

          stats.push({
            id: o.id,
            title: o.title,
            type: o.type,
            max_punten: o.max_punten,
            klassen,
            aantal_ingeleverd: aantal,
            gemiddelde_score: gem_score,
            gemiddeld_cijfer: Math.max(1, Math.min(10, gem_cijfer)),
          })
        }
        setOpdrachten(stats)
      } finally {
        setLoadingOpdrachten(false)
      }
    }
    load()
  }, [user])

  const openDetail = async (opdracht: OpdrachtStat, class_id?: string) => {
    setSelectedOpdracht(opdracht)
    setSelectedClassId(class_id || null)
    setKerninzicht(null)
    setView('detail')
    setLoadingDetail(true)

    try {
      const { data: opdrData } = await supabase
        .from('assignments')
        .select('vragen')
        .eq('id', opdracht.id)
        .single()

      const vragen = Array.isArray(opdrData?.vragen)
        ? opdrData.vragen
        : JSON.parse(opdrData?.vragen || '[]')

      let query = supabase
        .from('assignment_submissions')
        .select('student_id, totaal_punten, antwoorden, ingeleverd_op')
        .eq('assignment_id', opdracht.id)
        .eq('ai_nakijk_status', 'done')
        .not('ingeleverd_op', 'is', null)

      if (class_id) query = query.eq('class_id', class_id)

      const { data: subs } = await query

      const student_ids = [...new Set((subs || []).map(s => s.student_id))]
      let namenMap: Record<string, string> = {}

      if (student_ids.length > 0) {
        try {
          const res = await fetch(`${API_URL}/api/analyse/student-namen`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ student_ids }),
          })
          if (res.ok) namenMap = await res.json()
        } catch (err) {
          console.warn('Namen ophalen mislukt, gebruik fallback:', err)
        }
      }

      const verwerkt: Inzending[] = (subs || []).map(s => {
        const cijfer = opdracht.max_punten > 0
          ? Math.max(1, Math.min(10, Math.round((1 + (s.totaal_punten / opdracht.max_punten) * 9) * 10) / 10))
          : 0
        return {
          student_id: s.student_id,
          student_naam: namenMap[s.student_id] || 'Onbekend',
          totaal_punten: s.totaal_punten || 0,
          cijfer,
          ingeleverd_op: s.ingeleverd_op,
          antwoorden: s.antwoorden || [],
        }
      }).sort((a, b) => b.cijfer - a.cijfer)

      setInzendingen(verwerkt)

      const vraagMap: Record<number, { behaald: number; max: number; count: number }> = {}
      for (const s of (subs || [])) {
        for (const ant of (s.antwoorden || [])) {
          const vn = ant.vraag_nummer
          const nakijk = ant.nakijk
          if (vn && nakijk) {
            if (!vraagMap[vn]) vraagMap[vn] = { behaald: 0, max: 0, count: 0 }
            vraagMap[vn].behaald += nakijk.punten_behaald || 0
            vraagMap[vn].max += ant.max_punten || 0
            vraagMap[vn].count += 1
          }
        }
      }

      const vs: VraagStat[] = vragen.map((v: any) => {
        const qs = vraagMap[v.nummer]
        const pct = qs && qs.max > 0 ? Math.round((qs.behaald / qs.max) * 100) : null
        return {
          nummer: v.nummer,
          vraag: v.vraag,
          max_punten: v.punten,
          gemiddeld_behaald: qs ? Math.round((qs.behaald / qs.count) * 10) / 10 : 0,
          pct: pct ?? -1,
        }
      })
      setVraagStats(vs)
    } finally {
      setLoadingDetail(false)
    }
  }

  const openLeerling = (leerling: Inzending) => {
    setSelectedLeerling(leerling)
    setAangepastePunten({})
    setHeeftWijzigingen(false)
    setView('leerling')
  }

  const setPunten = (vraagNummer: number, punten: number) => {
    setAangepastePunten(prev => ({ ...prev, [vraagNummer]: punten }))
    setHeeftWijzigingen(true)
  }

  const slaAangepastePuntenOp = async () => {
    if (!selectedLeerling || !selectedOpdracht) return
    setSavingPunten(true)
    try {
      const { data: sub } = await supabase
        .from('assignment_submissions')
        .select('id, antwoorden')
        .eq('assignment_id', selectedOpdracht.id)
        .eq('student_id', selectedLeerling.student_id)
        .single()

      if (!sub) throw new Error('Inzending niet gevonden')

      const nieuweAntwoorden = (sub.antwoorden || []).map((ant: any) => {
        const aangepast = aangepastePunten[ant.vraag_nummer]
        if (aangepast !== undefined && ant.nakijk) {
          return {
            ...ant,
            nakijk: {
              ...ant.nakijk,
              punten_behaald: aangepast,
              handmatig_aangepast: true,
            },
          }
        }
        return ant
      })

      const nieuwTotaal = nieuweAntwoorden.reduce((sum: number, ant: any) => {
        return sum + (ant.nakijk?.punten_behaald || 0)
      }, 0)

      const nieuwCijfer = Math.max(1, Math.min(10,
        Math.round((1 + (nieuwTotaal / selectedOpdracht.max_punten) * 9) * 10) / 10
      ))

      await supabase
        .from('assignment_submissions')
        .update({
          antwoorden: nieuweAntwoorden,
          totaal_punten: nieuwTotaal,
        })
        .eq('id', sub.id)

      setSelectedLeerling(prev => prev ? {
        ...prev,
        antwoorden: nieuweAntwoorden,
        totaal_punten: nieuwTotaal,
        cijfer: nieuwCijfer,
      } : prev)

      setInzendingen(prev => prev.map(iz =>
        iz.student_id === selectedLeerling.student_id
          ? { ...iz, totaal_punten: nieuwTotaal, cijfer: nieuwCijfer, antwoorden: nieuweAntwoorden }
          : iz
      ))

      setAangepastePunten({})
      setHeeftWijzigingen(false)
      toast.success('Punten opgeslagen!')
    } catch (err) {
      toast.error('Opslaan mislukt')
    } finally {
      setSavingPunten(false)
    }
  }

  const genereerKerninzicht = async () => {
    if (!selectedOpdracht) return
    setLoadingKerninzicht(true)
    setKerninzicht(null)
    try {
      const res = await fetch(`${API_URL}/api/analyse/kerninzicht`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: selectedOpdracht.id,
          class_id: selectedClassId || undefined,
        }),
      })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const data = await res.json()
      setKerninzicht(data)
    } catch (err) {
      toast.error('Kerninzicht genereren mislukt')
    } finally {
      setLoadingKerninzicht(false)
    }
  }

  const openInChat = () => {
    if (!kerninzicht?.chat_prompt) return
    localStorage.setItem('clarus-analyse-prompt', kerninzicht.chat_prompt)
    navigate('/chat')
    toast.success('Prompt geladen in de chatbot!')
  }

  const TYPE_COLORS: Record<string, string> = {
    huiswerk:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
    oefentoets: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    casus:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
    opdracht:   'text-green-400 bg-green-500/10 border-green-500/20',
  }

  // ═══════════════════════════════
  // LEERLING DETAIL VIEW
  // ═══════════════════════════════
  if (view === 'leerling' && selectedLeerling && selectedOpdracht) {
    const huidigTotaal = selectedLeerling.antwoorden.reduce((sum: number, ant: any) => {
      const aangepast = aangepastePunten[ant.vraag_nummer]
      return sum + (aangepast !== undefined ? aangepast : (ant.nakijk?.punten_behaald || 0))
    }, 0)
    const huidigCijfer = Math.max(1, Math.min(10,
      Math.round((1 + (huidigTotaal / selectedOpdracht.max_punten) * 9) * 10) / 10
    ))

    return (
      <div className="space-y-5">
        {/* Wijzigingen banner */}
        {heeftWijzigingen && (
          <div className="bg-blue-600/20 border border-blue-500/30 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Edit3 size={14} className="text-blue-400" />
              <span className="text-blue-400 text-sm">Je hebt punten aangepast — vergeet niet op te slaan.</span>
            </div>
            <button
              onClick={slaAangepastePuntenOp}
              disabled={savingPunten}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-all"
            >
              {savingPunten ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Opslaan
            </button>
          </div>
        )}

        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => setView('detail')} className="mt-1 text-white/50 hover:text-white shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{selectedLeerling.student_naam}</h2>
            <p className="text-white/40 text-sm mt-0.5">
              {selectedOpdracht.title} · Ingeleverd {new Date(selectedLeerling.ingeleverd_op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className={`text-3xl font-bold ${huidigCijfer >= 5.5 ? 'text-green-400' : 'text-red-400'}`}>
              {huidigCijfer.toFixed(1)}
            </p>
            <p className="text-white/30 text-xs">{huidigTotaal}/{selectedOpdracht.max_punten}pt</p>
          </div>
        </div>

        {/* Antwoorden per vraag */}
        <div className="space-y-4">
          {selectedLeerling.antwoorden.map((ant: any) => {
            const nakijk = ant.nakijk
            const maxPunten = ant.max_punten || 0
            const huidigePunten = aangepastePunten[ant.vraag_nummer] !== undefined
              ? aangepastePunten[ant.vraag_nummer]
              : (nakijk?.punten_behaald ?? 0)
            const isAangepast = aangepastePunten[ant.vraag_nummer] !== undefined
            const isHandmatig = nakijk?.handmatig_aangepast

            // Gebruik docent-versie van feedback en beredenering
            const feedbackDocent = nakijk?.feedback_docent || nakijk?.feedback
            const beredeningDocent = nakijk?.beredenering_docent || nakijk?.beredenering

            return (
              <div key={ant.vraag_nummer} className="bg-[#0f1029] border border-white/10 rounded-xl overflow-hidden">
                {/* Vraag header */}
                <div className="px-4 py-3 border-b border-white/10 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white/30 text-xs">Vraag {ant.vraag_nummer}</span>
                      <span className="text-white/20 text-xs">·</span>
                      <span className="text-white/30 text-xs">{ant.type}</span>
                      {(isAangepast || isHandmatig) && (
                        <span className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                          Aangepast
                        </span>
                      )}
                    </div>
                    <p className="text-white text-sm font-medium">{ant.vraag_tekst}</p>
                  </div>
                  <div className="shrink-0 flex items-center gap-1.5">
                    {huidigePunten === maxPunten ? (
                      <CheckCircle size={16} className="text-green-400" />
                    ) : huidigePunten === 0 ? (
                      <XCircle size={16} className="text-red-400" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border-2 border-amber-400 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      </div>
                    )}
                    <span className={`text-sm font-bold ${
                      huidigePunten === maxPunten ? 'text-green-400'
                      : huidigePunten === 0 ? 'text-red-400'
                      : 'text-amber-400'
                    }`}>
                      {huidigePunten}/{maxPunten}
                    </span>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {/* Antwoord leerling */}
                  <div>
                    <p className="text-white/30 text-xs mb-1 uppercase tracking-wider">Antwoord leerling</p>
                    <div className="bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <p className="text-white/80 text-sm">{ant.student_antwoord || '—'}</p>
                    </div>
                  </div>

                  {/* AI feedback — docent versie */}
                  {feedbackDocent && (
                    <div>
                      <p className="text-white/30 text-xs mb-1 uppercase tracking-wider">AI feedback</p>
                      <div className="bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2">
                        <p className="text-white/70 text-sm">{feedbackDocent}</p>
                      </div>
                    </div>
                  )}

                  {/* AI beredenering — docent versie */}
                  {beredeningDocent && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1">
                        <Brain size={11} className="text-purple-400" />
                        <p className="text-purple-400 text-xs uppercase tracking-wider">Toelichting AI</p>
                      </div>
                      <div className="bg-purple-500/5 border border-purple-500/15 rounded-lg px-3 py-2">
                        <p className="text-white/60 text-sm italic">{beredeningDocent}</p>
                      </div>
                    </div>
                  )}

                  {/* Punten aanpassen */}
                  <div>
                    <p className="text-white/30 text-xs mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <Edit3 size={10} />
                      Punten aanpassen
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {Array.from({ length: maxPunten + 1 }, (_, i) => i).map(p => (
                        <button
                          key={p}
                          onClick={() => setPunten(ant.vraag_nummer, p)}
                          className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all border ${
                            huidigePunten === p
                              ? 'bg-blue-600 border-blue-500 text-white'
                              : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Opslaan knop onderaan */}
        {heeftWijzigingen && (
          <button
            onClick={slaAangepastePuntenOp}
            disabled={savingPunten}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all"
          >
            {savingPunten ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Wijzigingen opslaan — nieuw cijfer: {huidigCijfer.toFixed(1)}
          </button>
        )}
      </div>
    )
  }

  // ═══════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════
  if (view === 'detail' && selectedOpdracht) {
    const geselecteerdeKlas = selectedOpdracht.klassen.find(k => k.class_id === selectedClassId)
    const totaalIngeleverd = inzendingen.length
    const gemScore = totaalIngeleverd > 0
      ? Math.round((inzendingen.reduce((a, b) => a + b.totaal_punten, 0) / totaalIngeleverd) * 10) / 10
      : 0
    const gemCijfer = selectedOpdracht.max_punten > 0
      ? Math.max(1, Math.min(10, Math.round((1 + (gemScore / selectedOpdracht.max_punten) * 9) * 10) / 10))
      : 0
    const hoogste = inzendingen.length > 0 ? Math.max(...inzendingen.map(i => i.cijfer)) : 0
    const laagste = inzendingen.length > 0 ? Math.min(...inzendingen.map(i => i.cijfer)) : 0

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <button onClick={() => setView('overzicht')} className="mt-1 text-white/50 hover:text-white shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{selectedOpdracht.title}</h2>
            <p className="text-white/40 text-sm mt-0.5">
              {geselecteerdeKlas ? geselecteerdeKlas.klasnaam : 'Alle klassen'} · {selectedOpdracht.type}
            </p>
          </div>
        </div>

        {loadingDetail ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="animate-spin text-white/40" size={28} />
          </div>
        ) : (
          <>
            {/* Statistieken balk */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Ingeleverd', value: totaalIngeleverd.toString(), icon: Users, color: 'text-blue-400' },
                { label: 'Gem. cijfer', value: gemCijfer.toFixed(1), icon: BarChart3, color: gemCijfer >= 5.5 ? 'text-green-400' : 'text-red-400' },
                { label: 'Hoogste', value: hoogste.toFixed(1), icon: TrendingUp, color: 'text-green-400' },
                { label: 'Laagste', value: laagste.toFixed(1), icon: TrendingDown, color: 'text-red-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-[#0f1029] border border-white/10 rounded-xl p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 mb-1">
                    <stat.icon size={13} className="text-white/30" />
                    <span className="text-white/40 text-xs">{stat.label}</span>
                  </div>
                  <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Per vraag scorebalk */}
            {vraagStats.length > 0 && (
              <div className="bg-[#0f1029] border border-white/10 rounded-xl p-4 sm:p-5 space-y-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <BarChart3 size={14} className="text-white/40" />
                  Score per vraag
                </h3>
                <div className="space-y-2">
                  {vraagStats.map(v => (
                    <div key={v.nummer} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-white/70 text-xs truncate flex-1">
                          <span className="text-white/30 mr-1">#{v.nummer}</span>
                          {v.vraag}
                        </p>
                        <span className={`text-xs font-medium shrink-0 ${
                          v.pct < 0 ? 'text-white/20'
                          : v.pct >= 70 ? 'text-green-400'
                          : v.pct >= 40 ? 'text-amber-400'
                          : 'text-red-400'
                        }`}>
                          {v.pct < 0 ? '–' : `${v.pct}%`}
                        </span>
                      </div>
                      <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
                        {v.pct >= 0 && (
                          <div
                            className={`h-full rounded-full transition-all ${
                              v.pct >= 70 ? 'bg-green-500' : v.pct >= 40 ? 'bg-amber-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${v.pct}%` }}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leerlingentabel — klikbaar */}
            {inzendingen.length > 0 && (
              <div className="bg-[#0f1029] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/10">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <Users size={14} className="text-white/40" />
                    Leerlingen ({inzendingen.length})
                  </h3>
                </div>
                <div className="divide-y divide-white/5">
                  {inzendingen.map(iz => (
                    <button
                      key={iz.student_id}
                      onClick={() => openLeerling(iz)}
                      className="w-full flex items-center gap-3 px-4 sm:px-5 py-3 hover:bg-white/5 transition-all text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <span className="text-blue-400 text-xs font-semibold">
                          {iz.student_naam?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{iz.student_naam}</p>
                        <p className="text-white/30 text-xs">
                          {new Date(iz.ingeleverd_op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-3">
                        <div>
                          <span className={`text-lg font-bold ${iz.cijfer >= 5.5 ? 'text-green-400' : 'text-red-400'}`}>
                            {iz.cijfer.toFixed(1)}
                          </span>
                          <p className="text-white/30 text-xs">{iz.totaal_punten}/{selectedOpdracht.max_punten}pt</p>
                        </div>
                        <ChevronRight size={14} className="text-white/20" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {inzendingen.length === 0 && (
              <div className="bg-[#0f1029] border border-white/10 rounded-xl p-10 text-center">
                <Clock size={24} className="text-white/20 mx-auto mb-2" />
                <p className="text-white/40 text-sm">Nog geen ingeleverde en nagekeken opdrachten</p>
              </div>
            )}

            {/* Kerninzicht */}
            {inzendingen.length > 0 && (
              <div className="bg-[#0f1029] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-white/10 flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Brain size={16} className="text-purple-400" />
                    <h3 className="text-white font-semibold text-sm">Kerninzicht</h3>
                    <span className="text-xs text-purple-400/60 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full">AI</span>
                  </div>
                  {!kerninzicht && !loadingKerninzicht && (
                    <button
                      onClick={genereerKerninzicht}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-400 text-xs rounded-lg transition-all"
                    >
                      <Brain size={12} />
                      Genereer kerninzicht
                    </button>
                  )}
                  {kerninzicht && !loadingKerninzicht && (
                    <button onClick={genereerKerninzicht} className="text-white/30 hover:text-white/50 text-xs transition-all">
                      🔄 Opnieuw
                    </button>
                  )}
                </div>

                <div className="p-4 sm:p-5">
                  {loadingKerninzicht && (
                    <div className="flex items-center gap-3 text-white/40">
                      <Loader2 size={16} className="animate-spin" />
                      <span className="text-sm">AI analyseert de klasresultaten...</span>
                    </div>
                  )}

                  {!loadingKerninzicht && !kerninzicht && (
                    <p className="text-white/25 text-sm text-center py-4">
                      Klik op "Genereer kerninzicht" om een AI-analyse te starten van de prestaties van {geselecteerdeKlas?.klasnaam || 'de klas'}.
                    </p>
                  )}

                  {kerninzicht && !loadingKerninzicht && (
                    <div className="space-y-4 sm:space-y-5">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Brain size={13} className="text-purple-400" />
                          <span className="text-purple-400 text-xs font-medium uppercase tracking-wider">Wat ziet de AI?</span>
                        </div>
                        <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl px-4 py-3">
                          <p className="text-white/75 text-sm leading-relaxed">{kerninzicht.kerninzicht}</p>
                        </div>
                      </div>

                      {kerninzicht.vervolgvoorstel && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Lightbulb size={13} className="text-amber-400" />
                            <span className="text-amber-400 text-xs font-medium uppercase tracking-wider">Vervolgvoorstel</span>
                          </div>
                          <div className="bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3">
                            <p className="text-white/75 text-sm leading-relaxed">{kerninzicht.vervolgvoorstel}</p>
                          </div>
                        </div>
                      )}

                      {kerninzicht.chat_prompt && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <MessageSquare size={13} className="text-blue-400" />
                            <span className="text-blue-400 text-xs font-medium uppercase tracking-wider">Werken met de chatbot</span>
                          </div>
                          <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 space-y-3">
                            <p className="text-white/40 text-xs italic leading-relaxed line-clamp-3">
                              "{kerninzicht.chat_prompt.slice(0, 200)}..."
                            </p>
                            <button
                              onClick={openInChat}
                              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all"
                            >
                              <MessageSquare size={14} />
                              Open in Chat
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  // ═══════════════════════════════
  // OVERZICHT VIEW
  // ═══════════════════════════════
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Analyse</h2>
        <p className="text-white/50 text-sm mt-1">Inzicht in de voortgang van jouw leerlingen</p>
      </div>

      {loadingOpdrachten ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="animate-spin text-white/40" size={28} />
        </div>
      ) : opdrachten.length === 0 ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <BarChart3 size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nog geen data beschikbaar</h3>
          <p className="text-white/40 text-sm max-w-sm">
            Analyses verschijnen hier zodra leerlingen opdrachten hebben ingeleverd.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {opdrachten.map(o => {
            const heeftData = o.aantal_ingeleverd > 0
            return (
              <div key={o.id} className="bg-[#0f1029] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-4 sm:px-5 py-4 flex items-start sm:items-center gap-3 sm:gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_COLORS[o.type] || TYPE_COLORS.huiswerk}`}>
                        {o.type}
                      </span>
                      <span className="text-white/30 text-xs">{o.max_punten}pt</span>
                    </div>
                    <h3 className="text-white font-semibold text-sm sm:text-base">{o.title}</h3>
                  </div>
                  <div className="flex items-center gap-4 sm:gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-white/30 text-xs mb-0.5">Ingeleverd</p>
                      <p className="text-white font-semibold">{o.aantal_ingeleverd}</p>
                    </div>
                    {heeftData && (
                      <div className="text-center">
                        <p className="text-white/30 text-xs mb-0.5">Gem.</p>
                        <p className={`font-bold text-lg ${o.gemiddeld_cijfer >= 5.5 ? 'text-green-400' : 'text-red-400'}`}>
                          {o.gemiddeld_cijfer.toFixed(1)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {o.klassen.length > 0 && (
                  <div className="px-4 sm:px-5 pb-4 flex flex-wrap gap-2">
                    {o.klassen.map(k => (
                      <button
                        key={k.class_id}
                        onClick={() => openDetail(o, k.class_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-xs rounded-lg transition-all"
                      >
                        <Users size={11} />
                        {k.klasnaam}
                        <ChevronRight size={11} />
                      </button>
                    ))}
                    {o.klassen.length > 1 && (
                      <button
                        onClick={() => openDetail(o)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-400/70 hover:text-blue-400 text-xs rounded-lg transition-all"
                      >
                        <BarChart3 size={11} />
                        Alle klassen
                        <ChevronRight size={11} />
                      </button>
                    )}
                  </div>
                )}

                {!heeftData && (
                  <div className="px-4 sm:px-5 pb-4">
                    <span className="text-white/20 text-xs flex items-center gap-1">
                      <Clock size={11} /> Nog geen ingeleverde opdrachten
                    </span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}