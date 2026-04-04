import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  BarChart3, ArrowLeft, Users, TrendingUp, TrendingDown,
  Loader2, ChevronRight, Lightbulb, Brain, MessageSquare,
  CheckCircle, AlertTriangle, Clock
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

type View = 'overzicht' | 'detail'

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

  // ── Laad opdrachten met statistieken ──
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

  // ── Laad detail van een opdracht ──
  const openDetail = async (opdracht: OpdrachtStat, class_id?: string) => {
    setSelectedOpdracht(opdracht)
    setSelectedClassId(class_id || null)
    setKerninzicht(null)
    setView('detail')
    setLoadingDetail(true)

    try {
      // Haal vragen op
      const { data: opdrData } = await supabase
        .from('assignments')
        .select('vragen')
        .eq('id', opdracht.id)
        .single()

      const vragen = Array.isArray(opdrData?.vragen)
        ? opdrData.vragen
        : JSON.parse(opdrData?.vragen || '[]')

      // Haal inzendingen op
      let query = supabase
        .from('assignment_submissions')
        .select('student_id, totaal_punten, antwoorden, ingeleverd_op')
        .eq('assignment_id', opdracht.id)
        .eq('ai_nakijk_status', 'done')
        .not('ingeleverd_op', 'is', null)

      if (class_id) query = query.eq('class_id', class_id)

      const { data: subs } = await query

      // Haal namen op — inclusief first_name en last_name als fallback
      const student_ids = [...new Set((subs || []).map(s => s.student_id))]
      const { data: profielen } = await supabase
        .from('profiles')
        .select('id, full_name, first_name, last_name')
        .in('id', student_ids)

      const namenMap: Record<string, string> = {}
      ;(profielen || []).forEach(p => {
        // Gebruik full_name als het gevuld is, anders combineer first_name + last_name
        if (p.full_name && p.full_name.trim() !== '') {
          namenMap[p.id] = p.full_name.trim()
        } else if (p.first_name || p.last_name) {
          namenMap[p.id] = `${p.first_name || ''} ${p.last_name || ''}`.trim()
        }
      })

      // Verwerk inzendingen
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

      // Per-vraag statistieken
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

  // ── Kerninzicht genereren ──
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

  // ── Open in Chat ──
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
      <div className="space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setView('overzicht')} className="text-white/50 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white">{selectedOpdracht.title}</h2>
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
                { label: 'Gemiddeld cijfer', value: gemCijfer.toFixed(1), icon: BarChart3, color: gemCijfer >= 5.5 ? 'text-green-400' : 'text-red-400' },
                { label: 'Hoogste', value: hoogste.toFixed(1), icon: TrendingUp, color: 'text-green-400' },
                { label: 'Laagste', value: laagste.toFixed(1), icon: TrendingDown, color: 'text-red-400' },
              ].map(stat => (
                <div key={stat.label} className="bg-[#0f1029] border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <stat.icon size={14} className="text-white/30" />
                    <span className="text-white/40 text-xs">{stat.label}</span>
                  </div>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              ))}
            </div>

            {/* Per vraag scorebalk */}
            {vraagStats.length > 0 && (
              <div className="bg-[#0f1029] border border-white/10 rounded-xl p-5 space-y-3">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <BarChart3 size={14} className="text-white/40" />
                  Score per vraag
                </h3>
                <div className="space-y-2">
                  {vraagStats.map(v => (
                    <div key={v.nummer} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-white/70 text-xs truncate max-w-[70%]">
                          <span className="text-white/30 mr-1">#{v.nummer}</span>
                          {v.vraag}
                        </p>
                        <span className={`text-xs font-medium ${
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

            {/* Leerlingentabel */}
            {inzendingen.length > 0 && (
              <div className="bg-[#0f1029] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10">
                  <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                    <Users size={14} className="text-white/40" />
                    Leerlingen ({inzendingen.length})
                  </h3>
                </div>
                <div className="divide-y divide-white/5">
                  {inzendingen.map(iz => (
                    <div key={iz.student_id} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                        <span className="text-blue-400 text-xs font-semibold">
                          {iz.student_naam?.[0]?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{iz.student_naam}</p>
                        <p className="text-white/30 text-xs">
                          {new Date(iz.ingeleverd_op).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} ·{' '}
                          {new Date(iz.ingeleverd_op).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-lg font-bold ${iz.cijfer >= 5.5 ? 'text-green-400' : 'text-red-400'}`}>
                          {iz.cijfer.toFixed(1)}
                        </span>
                        <p className="text-white/30 text-xs">{iz.totaal_punten}/{selectedOpdracht.max_punten}pt</p>
                      </div>
                    </div>
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

            {/* ═══ KERNINZICHT SECTIE ═══ */}
            {inzendingen.length > 0 && (
              <div className="bg-[#0f1029] border border-white/10 rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
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
                    <button
                      onClick={genereerKerninzicht}
                      className="text-white/30 hover:text-white/50 text-xs transition-all"
                    >
                      🔄 Opnieuw
                    </button>
                  )}
                </div>

                <div className="p-5">
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
                    <div className="space-y-5">
                      {/* Kerninzicht */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Brain size={13} className="text-purple-400" />
                          <span className="text-purple-400 text-xs font-medium uppercase tracking-wider">Wat ziet de AI?</span>
                        </div>
                        <div className="bg-purple-500/5 border border-purple-500/15 rounded-xl px-4 py-3">
                          <p className="text-white/75 text-sm leading-relaxed">{kerninzicht.kerninzicht}</p>
                        </div>
                      </div>

                      {/* Vervolgvoorstel */}
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

                      {/* Chat doorstuur */}
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
    <div className="space-y-6 max-w-5xl">
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
                {/* Opdracht header */}
                <div className="px-5 py-4 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_COLORS[o.type] || TYPE_COLORS.huiswerk}`}>
                        {o.type}
                      </span>
                      <span className="text-white/30 text-xs">{o.max_punten}pt</span>
                    </div>
                    <h3 className="text-white font-semibold">{o.title}</h3>
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <div className="text-center">
                      <p className="text-white/30 text-xs mb-0.5">Ingeleverd</p>
                      <p className="text-white font-semibold">{o.aantal_ingeleverd}</p>
                    </div>
                    {heeftData && (
                      <div className="text-center">
                        <p className="text-white/30 text-xs mb-0.5">Gem. cijfer</p>
                        <p className={`font-bold text-lg ${o.gemiddeld_cijfer >= 5.5 ? 'text-green-400' : 'text-red-400'}`}>
                          {o.gemiddeld_cijfer.toFixed(1)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Per klas knoppen */}
                {o.klassen.length > 0 && (
                  <div className="px-5 pb-4 flex flex-wrap gap-2">
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
                  <div className="px-5 pb-4">
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