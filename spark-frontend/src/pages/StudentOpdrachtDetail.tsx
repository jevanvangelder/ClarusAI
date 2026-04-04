import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Send, CheckCircle, Clock,
  MessageCircle, FileText, ChevronRight, Loader2, AlertTriangle
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Vraag {
  nummer: number
  vraag: string
  type: 'open' | 'meerkeuze' | 'waar-onwaar'
  punten: number
  opties?: string[]
  afbeelding?: string
}

interface Opdracht {
  id: string
  title: string
  beschrijving: string | null
  type: string
  max_punten: number
  vragen: Vraag[]
  deadline: string | null
}

interface Antwoord {
  vraag_nummer: number
  vraag_tekst: string
  student_antwoord: string
  type: string
  max_punten: number
  correct_antwoord?: string
  nakijk?: { punten_behaald: number; feedback: string }
}

interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
}

type Status = 'bezig' | 'ingeleverd' | 'nagekeken'

// ═══════════════════════════════
// BEVESTIGING MODAL — alle vragen ingevuld
// ═══════════════════════════════
function InleverModal({ onBevestig, onAnnuleer }: { onBevestig: () => void; onAnnuleer: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1029] border border-white/15 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-amber-400" />
          </div>
          <h3 className="text-white font-semibold text-base">Opdracht inleveren?</h3>
        </div>
        <p className="text-white/55 text-sm leading-relaxed mb-6">
          Weet je zeker dat je de opdracht wilt inleveren? Je kunt daarna{' '}
          <span className="text-white/80 font-medium">niet meer wijzigen</span>.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onAnnuleer}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm rounded-xl transition-all"
          >
            Nee, terug
          </button>
          <button
            onClick={onBevestig}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle size={14} />
            Ja, inleveren
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════
// WAARSCHUWING MODAL — open vragen
// ═══════════════════════════════
function OpenVragenModal({ aantalOpen, onBevestig, onAnnuleer }: { aantalOpen: number; onBevestig: () => void; onAnnuleer: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0f1029] border border-white/15 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center shrink-0">
            <AlertTriangle size={18} className="text-red-400" />
          </div>
          <h3 className="text-white font-semibold text-base">Nog vragen open!</h3>
        </div>
        <p className="text-white/55 text-sm leading-relaxed mb-6">
          Je hebt nog{' '}
          <span className="text-white/80 font-medium">{aantalOpen} {aantalOpen === 1 ? 'vraag' : 'vragen'}</span>{' '}
          niet beantwoord. Weet je zeker dat je toch wilt inleveren?
          Je kunt daarna <span className="text-white/80 font-medium">niet meer wijzigen</span>.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onAnnuleer}
            className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-sm rounded-xl transition-all"
          >
            Nee, terug
          </button>
          <button
            onClick={onBevestig}
            className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <CheckCircle size={14} />
            Toch inleveren
          </button>
        </div>
      </div>
    </div>
  )
}

export default function StudentOpdrachtDetail() {
  const { id: classId, assignmentId } = useParams<{ id: string; assignmentId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [opdracht, setOpdracht] = useState<Opdracht | null>(null)
  const [antwoorden, setAntwoorden] = useState<Record<number, string>>({})
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<Status>('bezig')
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [nakijkResultaat, setNakijkResultaat] = useState<any | null>(null)
  const [inleveren, setInleveren] = useState(false)
  const [opslaan, setOpslaan] = useState(false)
  const [activeVraag, setActiveVraag] = useState(1)
  const [toonInleverModal, setToonInleverModal] = useState(false)
  const [toonOpenVragenModal, setToonOpenVragenModal] = useState(false)
  const [aantalOpenVragen, setAantalOpenVragen] = useState(0)

  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([])
  const [tutorInput, setTutorInput] = useState('')
  const [tutorLoading, setTutorLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const tutorInputRef = useRef<HTMLInputElement>(null)

  const antwoordenRef = useRef(antwoorden)
  useEffect(() => { antwoordenRef.current = antwoorden }, [antwoorden])

  const tutorMessagesRef = useRef(tutorMessages)
  useEffect(() => { tutorMessagesRef.current = tutorMessages }, [tutorMessages])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [tutorMessages])

  useEffect(() => {
    const load = async () => {
      if (!assignmentId || !user || !classId) return
      setLoading(true)

      const { data: a, error } = await supabase
        .from('assignments')
        .select('id, title, beschrijving, type, max_punten, vragen')
        .eq('id', assignmentId)
        .single()

      if (error || !a) { toast.error('Opdracht niet gevonden'); navigate(-1); return }

      const { data: ac } = await supabase
        .from('assignment_classes')
        .select('deadline')
        .eq('assignment_id', assignmentId)
        .eq('class_id', classId)
        .maybeSingle()

      const vragen: Vraag[] = (Array.isArray(a.vragen) ? a.vragen : JSON.parse(a.vragen || '[]'))
        .map((v: any) => ({
          nummer: v.nummer,
          vraag: v.vraag,
          type: v.type,
          punten: v.punten,
          opties: v.opties,
          afbeelding: v.afbeelding,
        }))

      setOpdracht({ ...a, vragen, deadline: ac?.deadline || null })

      const { data: subData } = await supabase
        .from('assignment_submissions')
        .select('*')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .maybeSingle()

      if (subData) {
        setSubmissionId(subData.id)
        const antwoordMap: Record<number, string> = {}
        ;(subData.antwoorden || []).forEach((a: any) => { antwoordMap[a.vraag_nummer] = a.student_antwoord })
        setAntwoorden(antwoordMap)
        setTutorMessages(subData.chat_log || [])
        if (subData.ingeleverd_op) {
          if (subData.ai_nakijk_status === 'done') {
            setNakijkResultaat(subData)
            setStatus('nagekeken')
          } else {
            setStatus('ingeleverd')
          }
        }
      }

      setLoading(false)
    }
    load()
  }, [assignmentId, user, classId])

  // Auto-save elke 30 seconden
  useEffect(() => {
    if (status !== 'bezig' || !opdracht) return
    const interval = setInterval(() => saveDraft(false), 30000)
    return () => clearInterval(interval)
  }, [antwoorden, tutorMessages, status, opdracht])

  const buildAntwoordenArray = (huidigAntwoorden?: Record<number, string>): Antwoord[] => {
    if (!opdracht) return []
    const bron = huidigAntwoorden ?? antwoordenRef.current
    return opdracht.vragen.map(v => ({
      vraag_nummer: v.nummer,
      vraag_tekst: v.vraag,
      student_antwoord: bron[v.nummer] || '',
      type: v.type,
      max_punten: v.punten,
    }))
  }

  const saveDraft = async (showToast = true, huidigAntwoorden?: Record<number, string>) => {
    if (!opdracht || !user || !classId || status !== 'bezig') return
    if (showToast) setOpslaan(true)
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      const res = await fetch(`${API_URL}/api/submissions/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: opdracht.id,
          student_id: user.id,
          class_id: classId,
          antwoorden: buildAntwoordenArray(huidigAntwoorden),
          chat_log: tutorMessagesRef.current,
        }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const data = await res.json()
      if (data.id) setSubmissionId(data.id)
      if (showToast) toast.success('✅ Voortgang opgeslagen!')
    } catch (err: any) {
      if (err.name === 'AbortError') {
        if (showToast) toast.error('⏱️ Opslaan duurde te lang, probeer opnieuw')
      } else {
        if (showToast) toast.error('❌ Opslaan mislukt')
      }
    } finally {
      if (showToast) setOpslaan(false)
    }
  }

  // Knop → check open vragen → juiste modal tonen
  const handleInleverKlik = () => {
    if (!opdracht) return
    const onbeantwoord = opdracht.vragen.filter(v => !antwoordenRef.current[v.nummer]?.trim())
    if (onbeantwoord.length > 0) {
      setAantalOpenVragen(onbeantwoord.length)
      setToonOpenVragenModal(true)
    } else {
      setToonInleverModal(true)
    }
  }

  // Na bevestiging → eerst draft opslaan, dan echt inleveren
  const handleInleverBevestigd = async () => {
    setToonInleverModal(false)
    setToonOpenVragenModal(false)
    if (!opdracht || !user || !classId) return
    setInleveren(true)

    try {
      await saveDraft(false, antwoordenRef.current)

      const { data: volledigeOpdracht } = await supabase
        .from('assignments').select('vragen').eq('id', opdracht.id).single()
      const volledigeVragen = Array.isArray(volledigeOpdracht?.vragen)
        ? volledigeOpdracht.vragen
        : JSON.parse(volledigeOpdracht?.vragen || '[]')

      const antwoordenMetCorrect = opdracht.vragen.map(v => {
        const volledig = volledigeVragen.find((vv: any) => vv.nummer === v.nummer)
        return {
          vraag_nummer: v.nummer,
          vraag_tekst: v.vraag,
          student_antwoord: antwoordenRef.current[v.nummer] || '',
          correct_antwoord: volledig?.antwoord || '',
          type: v.type,
          max_punten: v.punten,
        }
      })

      const res = await fetch(`${API_URL}/api/submissions/inleveren`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: opdracht.id,
          student_id: user.id,
          class_id: classId,
          antwoorden: antwoordenMetCorrect,
          chat_log: tutorMessagesRef.current,
          max_punten: opdracht.max_punten,
        }),
      })
      const sub = await res.json()
      setSubmissionId(sub.id)
      setStatus('ingeleverd')
      toast.success('Opdracht ingeleverd! AI is aan het nakijken...')

      const nakijkRes = await fetch(`${API_URL}/api/submissions/nakijken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: sub.id, antwoorden: antwoordenMetCorrect }),
      })
      const nakijkData = await nakijkRes.json()
      setNakijkResultaat({ ...sub, ...nakijkData, antwoorden: antwoordenMetCorrect })
      setStatus('nagekeken')
      toast.success('Nakijken klaar! Bekijk je resultaten.')
    } catch (err) {
      console.error(err)
      toast.error('Er ging iets mis bij het inleveren')
    } finally {
      setInleveren(false)
    }
  }

  const handleTutorSend = async () => {
    if (!tutorInput.trim() || tutorLoading || !opdracht) return
    const userMsg: TutorMessage = { role: 'user', content: tutorInput.trim() }
    const newMessages = [...tutorMessages, userMsg]
    setTutorMessages(newMessages)
    setTutorInput('')
    setTutorLoading(true)

    const opdrachtContext = JSON.stringify({
      titel: opdracht.title,
      beschrijving: opdracht.beschrijving,
      type: opdracht.type,
      vragen: opdracht.vragen.map(v => ({
        nummer: v.nummer,
        vraag: v.vraag,
        type: v.type,
        punten: v.punten,
        opties: v.opties,
      })),
    })

    try {
      const res = await fetch(`${API_URL}/api/submissions/tutor/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMsg.content,
          messages: newMessages.slice(0, -1),
          opdracht_context: opdrachtContext,
        }),
      })
      if (!res.ok) {
        const errText = await res.text()
        console.error('Tutor API error:', res.status, errText)
        throw new Error(`API ${res.status}`)
      }
      const data = await res.json()
      setTutorMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch (err) {
      console.error('Tutor fout:', err)
      setTutorMessages(prev => [...prev, { role: 'assistant', content: '❌ Er ging iets mis. Probeer opnieuw.' }])
    } finally {
      setTutorLoading(false)
    }
  }

  const isVerlopen = opdracht?.deadline ? new Date(opdracht.deadline) < new Date() : false

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-white/40" size={28} />
      </div>
    )
  }

  if (!opdracht) return null

  const huidigeVraag = opdracht.vragen.find(v => v.nummer === activeVraag)
  const aantalBeantwoord = opdracht.vragen.filter(v => antwoorden[v.nummer]?.trim()).length
  const voortgang = Math.round((aantalBeantwoord / opdracht.vragen.length) * 100)
  const isLaatsteVraag = activeVraag === opdracht.vragen.length

  const TYPE_COLORS: Record<string, string> = {
    huiswerk:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
    oefentoets: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    casus:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
    opdracht:   'text-green-400 bg-green-500/10 border-green-500/20',
  }
  const typeColor = TYPE_COLORS[opdracht.type] || TYPE_COLORS.huiswerk

  // ═══════════════════════════════
  // NAGEKEKEN VIEW
  // ═══════════════════════════════
  if (status === 'nagekeken' && nakijkResultaat) {
    const resultaten = nakijkResultaat.resultaten || []
    const totaal = nakijkResultaat.totaal_punten ?? 0
    const max = opdracht.max_punten
    const pct = max > 0 ? Math.round((totaal / max) * 100) : 0
    const cijfer = Math.max(1, Math.min(10, Math.round(1 + (totaal / max) * 9)))

    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/50 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">{opdracht.title}</h2>
        </div>
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 text-center">
          <div className={`text-6xl font-bold mb-2 ${pct >= 55 ? 'text-green-400' : 'text-red-400'}`}>
            {cijfer}
          </div>
          <p className="text-white/60 text-sm">{totaal} / {max} punten ({pct}%)</p>
          {nakijkResultaat.algemene_feedback && (
            <p className="text-white/50 text-sm mt-3 italic">"{nakijkResultaat.algemene_feedback}"</p>
          )}
        </div>
        <div className="space-y-3">
          {opdracht.vragen.map(v => {
            const r = resultaten.find((res: any) => res.vraag_nummer === v.nummer)
            const ant = (nakijkResultaat.antwoorden || []).find((a: any) => a.vraag_nummer === v.nummer)
            const goed = r ? r.punten_behaald === r.max_punten : false
            return (
              <div key={v.nummer} className={`bg-[#0f1029] border rounded-xl p-4 ${goed ? 'border-green-500/20' : 'border-red-500/20'}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <p className="text-white/80 text-sm font-medium">{v.nummer}. {v.vraag}</p>
                  <span className={`shrink-0 text-sm font-bold ${goed ? 'text-green-400' : 'text-amber-400'}`}>
                    {r?.punten_behaald ?? '?'}/{v.punten}pt
                  </span>
                </div>
                <p className="text-white/50 text-xs">
                  <span className="text-white/30">Jouw antwoord: </span>
                  {ant?.student_antwoord || <em className="text-white/20">Geen antwoord</em>}
                </p>
                {r?.feedback && (
                  <p className="text-white/40 text-xs italic mt-1">💡 {r.feedback}</p>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={() => navigate(-1)}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-all">
          Terug naar de klas
        </button>
      </div>
    )
  }

  // ═══════════════════════════════
  // INGELEVERD VIEW
  // ═══════════════════════════════
  if (status === 'ingeleverd') {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="animate-spin text-blue-400" size={40} />
        <p className="text-white/60">AI is je antwoorden aan het nakijken...</p>
      </div>
    )
  }

  // ═══════════════════════════════
  // BEZIG VIEW
  // ═══════════════════════════════
  return (
    <>
      {toonInleverModal && (
        <InleverModal
          onBevestig={handleInleverBevestigd}
          onAnnuleer={() => setToonInleverModal(false)}
        />
      )}
      {toonOpenVragenModal && (
        <OpenVragenModal
          aantalOpen={aantalOpenVragen}
          onBevestig={handleInleverBevestigd}
          onAnnuleer={() => setToonOpenVragenModal(false)}
        />
      )}

      <div className="flex flex-col h-full space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => { saveDraft(false); navigate(-1) }} className="text-white/50 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-white truncate">{opdracht.title}</h2>
            <div className="flex items-center gap-3 flex-wrap mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded border ${typeColor}`}>{opdracht.type}</span>
              <span className="text-white/40 text-xs">{opdracht.max_punten}pt totaal</span>
              {opdracht.deadline && (
                <span className={`text-xs flex items-center gap-1 ${isVerlopen ? 'text-red-400' : 'text-amber-400/80'}`}>
                  <Clock size={11} />
                  {isVerlopen ? 'Verlopen' : 'Deadline'}:{' '}
                  {new Date(opdracht.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}{' '}
                  {new Date(opdracht.deadline).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => saveDraft(true)}
              disabled={opslaan}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs rounded-lg transition-all disabled:opacity-40 flex items-center gap-1"
            >
              {opslaan ? <Loader2 size={12} className="animate-spin" /> : '💾'}
              {opslaan ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button
              onClick={handleInleverKlik}
              disabled={inleveren}
              className="px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition-all"
            >
              {inleveren ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              {inleveren ? 'Inleveren...' : 'Inleveren'}
            </button>
          </div>
        </div>

        <div className="bg-white/5 rounded-full h-1.5 overflow-hidden">
          <div className="bg-blue-500 h-full rounded-full transition-all duration-500" style={{ width: `${voortgang}%` }} />
        </div>
        <p className="text-white/30 text-xs text-right -mt-1">{aantalBeantwoord}/{opdracht.vragen.length} beantwoord</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 220px)' }}>

          {/* Links: vragen */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
              <FileText size={14} className="text-white/40" />
              <span className="text-white/50 text-xs uppercase tracking-wider">Vragen</span>
            </div>
            <div className="flex gap-1 p-2 border-b border-white/10 overflow-x-auto">
              {opdracht.vragen.map(v => {
                const beantwoord = !!antwoorden[v.nummer]?.trim()
                return (
                  <button key={v.nummer} onClick={() => setActiveVraag(v.nummer)}
                    className={`shrink-0 w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      activeVraag === v.nummer ? 'bg-blue-600 text-white'
                      : beantwoord ? 'bg-green-500/20 text-green-400 border border-green-500/20'
                      : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}>
                    {v.nummer}
                  </button>
                )
              })}
            </div>
            {huidigeVraag && (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-white/30 text-xs">Vraag {huidigeVraag.nummer} van {opdracht.vragen.length}</span>
                    <span className="text-white/30 text-xs">{huidigeVraag.punten}pt</span>
                  </div>
                  <p className="text-white font-medium text-sm leading-relaxed">{huidigeVraag.vraag}</p>
                  {huidigeVraag.afbeelding && (
                    <img src={huidigeVraag.afbeelding} alt={`Afbeelding vraag ${huidigeVraag.nummer}`}
                      className="mt-3 w-full max-h-48 object-contain rounded-lg border border-white/10" />
                  )}
                </div>
                {huidigeVraag.type === 'meerkeuze' && huidigeVraag.opties && huidigeVraag.opties.length > 0 ? (
                  <div className="space-y-2">
                    {huidigeVraag.opties.map((opt, i) => (
                      <button key={i}
                        onClick={() => setAntwoorden(prev => ({ ...prev, [huidigeVraag.nummer]: opt }))}
                        className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all ${
                          antwoorden[huidigeVraag.nummer] === opt
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                            : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                        }`}>
                        {opt}
                      </button>
                    ))}
                  </div>
                ) : huidigeVraag.type === 'waar-onwaar' ? (
                  <div className="flex gap-3">
                    {['Waar', 'Onwaar'].map(opt => (
                      <button key={opt}
                        onClick={() => setAntwoorden(prev => ({ ...prev, [huidigeVraag.nummer]: opt }))}
                        className={`flex-1 py-3 rounded-xl border text-sm font-medium transition-all ${
                          antwoorden[huidigeVraag.nummer] === opt
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                            : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                        }`}>
                        {opt === 'Waar' ? '✓ Waar' : '✗ Onwaar'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <textarea
                    value={antwoorden[huidigeVraag.nummer] || ''}
                    onChange={e => setAntwoorden(prev => ({ ...prev, [huidigeVraag.nummer]: e.target.value }))}
                    placeholder="Schrijf hier je antwoord..."
                    rows={5}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-white/20 outline-none focus:border-blue-500/50 resize-none"
                  />
                )}

                {/* Navigatieknoppen onderaan de vraag */}
                <div className="flex gap-2 pt-2">
                  {activeVraag > 1 && (
                    <button onClick={() => setActiveVraag(prev => prev - 1)}
                      className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm rounded-lg transition-all">
                      ← Vorige
                    </button>
                  )}
                  {!isLaatsteVraag ? (
                    <button onClick={() => setActiveVraag(prev => prev + 1)}
                      className="flex-1 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg flex items-center justify-center gap-1 transition-all">
                      Volgende <ChevronRight size={14} />
                    </button>
                  ) : (
                    <button
                      onClick={handleInleverKlik}
                      disabled={inleveren}
                      className="flex-1 py-2 bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all"
                    >
                      {inleveren ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                      {inleveren ? 'Inleveren...' : 'Inleveren'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Rechts: AI tutor */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <MessageCircle size={14} className="text-purple-400" />
                <span className="text-white/50 text-xs uppercase tracking-wider">AI Tutor</span>
              </div>
              <p className="text-white/25 text-xs mt-0.5">Stel vragen over de stof — ik help je begrijpen, niet afschrijven 😊</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {tutorMessages.length === 0 && (
                <div className="text-center mt-8 space-y-3">
                  <p className="text-white/20 text-sm">Heb je een vraag over de stof?</p>
                  <div className="space-y-2">
                    {[
                      'Kun je uitleggen wat schaarste betekent?',
                      'Hoe werkt vraag en aanbod?',
                      'Ik snap vraag 3 niet goed',
                    ].map((s, i) => (
                      <button key={i} onClick={() => { setTutorInput(s); tutorInputRef.current?.focus() }}
                        className="block w-full text-left px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-white/40 hover:text-white/60 text-xs transition-all">
                        "{s}"
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {tutorMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/10 text-white/80'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <ReactMarkdown components={{
                        p: ({children}) => <p className="mb-1 last:mb-0">{children}</p>,
                        strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                      }}>
                        {msg.content}
                      </ReactMarkdown>
                    ) : <span>{msg.content}</span>}
                  </div>
                </div>
              ))}
              {tutorLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-white/40 text-sm">
                    Aan het denken...
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                ref={tutorInputRef}
                type="text"
                value={tutorInput}
                onChange={e => setTutorInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleTutorSend()}
                placeholder="Stel een vraag over de stof..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/25 outline-none focus:border-purple-500/50"
              />
              <button
                onClick={handleTutorSend}
                disabled={tutorLoading || !tutorInput.trim()}
                className="p-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}