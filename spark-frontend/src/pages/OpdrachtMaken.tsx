import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Send, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Vraag {
  nummer: number
  vraag: string
  type: 'open' | 'meerkeuze' | 'waar-onwaar'
  punten: number
  opties?: string[]
  antwoord: string
  toelichting: string
  afbeelding?: string
}

interface Opdracht {
  id: string
  title: string
  beschrijving: string | null
  type: string | null
  max_punten: number | null
  vragen: Vraag[]
  deadline: string | null
}

interface TutorMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Resultaat {
  vraag_nummer: number
  antwoord_student: string
  punten_behaald: number
  ai_onderbouwing: string
}

type Status = 'laden' | 'bezig' | 'ingeleverd' | 'fout'

export default function OpdrachtMaken() {
  const { assignmentId, classId } = useParams<{ assignmentId: string; classId: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [status, setStatus] = useState<Status>('laden')
  const [opdracht, setOpdracht] = useState<Opdracht | null>(null)
  const [antwoorden, setAntwoorden] = useState<Record<number, string>>({})
  const [tutorMessages, setTutorMessages] = useState<TutorMessage[]>([])
  const [tutorInput, setTutorInput] = useState('')
  const [tutorLoading, setTutorLoading] = useState(false)
  const [inleveren, setInleveren] = useState(false)
  const [resultaten, setResultaten] = useState<Resultaat[]>([])
  const [totaalPunten, setTotaalPunten] = useState(0)
  const [maxPunten, setMaxPunten] = useState(0)
  const [studentNaam, setStudentNaam] = useState('Student')

  const chatEndRef = useRef<HTMLDivElement>(null)
  const tutorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [tutorMessages])

  // Fetch student naam
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('full_name').eq('id', user.id).single()
      .then(({ data }) => { if (data?.full_name) setStudentNaam(data.full_name) })
  }, [user])

  // Fetch opdracht + check bestaande inzending
  useEffect(() => {
    if (!assignmentId || !user) return
    const init = async () => {
      // Haal opdracht op
      const { data: aData, error: aError } = await supabase
        .from('assignments')
        .select('id, title, beschrijving, type, max_punten, vragen')
        .eq('id', assignmentId)
        .single()

      if (aError || !aData) { setStatus('fout'); return }

      // Haal deadline op uit assignment_classes
      let deadline: string | null = null
      if (classId) {
        const { data: acData } = await supabase
          .from('assignment_classes')
          .select('deadline')
          .eq('assignment_id', assignmentId)
          .eq('class_id', classId)
          .single()
        deadline = acData?.deadline || null
      }

      const vragen: Vraag[] = Array.isArray(aData.vragen)
        ? aData.vragen
        : (typeof aData.vragen === 'string' ? JSON.parse(aData.vragen) : [])

      setOpdracht({ ...aData, vragen, deadline })
      setMaxPunten(aData.max_punten || vragen.reduce((s: number, v: Vraag) => s + v.punten, 0))

      // Check bestaande inzending
      const { data: subData } = await supabase
        .from('assignment_submissions')
        .select('antwoorden, chat_log, totaal_punten, max_punten, ai_nakijk_status')
        .eq('assignment_id', assignmentId)
        .eq('student_id', user.id)
        .single()

      if (subData && subData.ai_nakijk_status === 'done') {
        // Al ingeleverd — toon resultaten
        const antwoordenMap: Record<number, string> = {}
        subData.antwoorden.forEach((a: any) => { antwoordenMap[a.vraag_nummer] = a.antwoord_student })
        setAntwoorden(antwoordenMap)
        setResultaten(subData.antwoorden)
        setTotaalPunten(subData.totaal_punten || 0)
        setMaxPunten(subData.max_punten || aData.max_punten || 0)
        setTutorMessages(subData.chat_log || [])
        setStatus('ingeleverd')
      } else {
        // Herstel concept antwoorden als ze er zijn
        if (subData?.antwoorden) {
          const antwoordenMap: Record<number, string> = {}
          subData.antwoorden.forEach((a: any) => { antwoordenMap[a.vraag_nummer] = a.antwoord_student })
          setAntwoorden(antwoordenMap)
        }
        setTutorMessages([{
          role: 'assistant',
          content: `Hoi ${studentNaam}! 👋 Ik ben je AI-tutor voor deze opdracht. Ik kan je helpen de stof beter te begrijpen, maar ik geef geen antwoorden. Stel gerust een vraag!`
        }])
        setStatus('bezig')
      }
    }
    init()
  }, [assignmentId, classId, user])

  // Tutor sturen
  const handleTutorSend = async () => {
    if (!tutorInput.trim() || tutorLoading || !opdracht) return
    const userMsg: TutorMessage = { role: 'user', content: tutorInput.trim() }
    const newMessages = [...tutorMessages, userMsg]
    setTutorMessages(newMessages)
    setTutorInput('')
    setTutorLoading(true)

    try {
      // Maak opdracht context ZONDER antwoorden
      const contextZonderAntwoord = {
        titel: opdracht.title,
        beschrijving: opdracht.beschrijving,
        type: opdracht.type,
        vragen: opdracht.vragen.map(v => ({
          nummer: v.nummer,
          vraag: v.vraag,
          type: v.type,
          punten: v.punten,
          opties: v.opties || [],
        }))
      }

      const res = await fetch(`${API_URL}/api/opdrachten/student/tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMsg.content,
          messages: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          assignment_context: JSON.stringify(contextZonderAntwoord),
          student_naam: studentNaam,
        }),
      })
      const data = await res.json()
      setTutorMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch {
      setTutorMessages(prev => [...prev, { role: 'assistant', content: '❌ Er ging iets mis. Probeer opnieuw.' }])
    } finally {
      setTutorLoading(false)
    }
  }

  // Inleveren
  const handleInleveren = async () => {
    if (!opdracht || !user || !classId) return

    // Check of alle vragen beantwoord zijn
    const onbeantwoord = opdracht.vragen.filter(v => !antwoorden[v.nummer]?.trim())
    if (onbeantwoord.length > 0) {
      toast.error(`Er zijn nog ${onbeantwoord.length} onbeantwoorde vragen.`)
      return
    }

    if (!confirm('Weet je zeker dat je wilt inleveren? Je kunt daarna niet meer aanpassen.')) return

    setInleveren(true)
    try {
      const antwoordenArray = opdracht.vragen.map(v => ({
        vraag_nummer: v.nummer,
        antwoord_student: antwoorden[v.nummer] || '',
      }))

      const res = await fetch(`${API_URL}/api/opdrachten/student/nakijken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignment_id: opdracht.id,
          student_id: user.id,
          class_id: classId,
          vragen: opdracht.vragen,
          antwoorden: antwoordenArray,
          chat_log: tutorMessages,
        }),
      })

      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()

      setResultaten(data.resultaten)
      setTotaalPunten(data.totaal_punten)
      setMaxPunten(data.max_punten)
      setStatus('ingeleverd')
      toast.success('Opdracht ingeleverd en nagekeken! 🎉')
    } catch (err: any) {
      toast.error('Inleveren mislukt: ' + err.message)
    } finally {
      setInleveren(false)
    }
  }

  // Auto-opslaan concept
  const autoSave = useCallback(async () => {
    if (!opdracht || !user || !classId || status !== 'bezig') return
    const antwoordenArray = opdracht.vragen.map(v => ({
      vraag_nummer: v.nummer,
      antwoord_student: antwoorden[v.nummer] || '',
    }))
    await supabase.from('assignment_submissions').upsert({
      assignment_id: opdracht.id,
      student_id: user.id,
      class_id: classId,
      antwoorden: antwoordenArray,
      chat_log: tutorMessages,
      ai_nakijk_status: 'pending',
    }, { onConflict: 'assignment_id,student_id' })
  }, [antwoorden, tutorMessages, opdracht, user, classId, status])

  useEffect(() => {
    if (status !== 'bezig') return
    const timer = setTimeout(autoSave, 3000)
    return () => clearTimeout(timer)
  }, [antwoorden, autoSave, status])

  // ── LADEN ──
  if (status === 'laden') {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-white/40 text-sm">Opdracht laden...</p>
      </div>
    )
  }

  if (status === 'fout' || !opdracht) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <AlertCircle size={32} className="text-red-400" />
        <p className="text-white/60">Opdracht niet gevonden.</p>
        <button onClick={() => navigate(-1)} className="text-blue-400 text-sm hover:underline">← Terug</button>
      </div>
    )
  }

  const isVerlopen = opdracht.deadline ? new Date(opdracht.deadline) < new Date() : false
  const scorePercentage = maxPunten > 0 ? Math.round((totaalPunten / maxPunten) * 100) : 0

  // ── INGELEVERD VIEW ──
  if (status === 'ingeleverd') {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-white/50 hover:text-white"><ArrowLeft size={20} /></button>
          <h2 className="text-2xl font-bold text-white">{opdracht.title}</h2>
        </div>

        {/* Score banner */}
        <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">Jouw score</p>
            <p className="text-4xl font-bold text-white mt-1">{totaalPunten} <span className="text-white/40 text-2xl">/ {maxPunten} pt</span></p>
            <p className="text-white/50 text-sm mt-1">{scorePercentage}% behaald</p>
          </div>
          <CheckCircle size={48} className="text-green-400/60" />
        </div>

        {/* Per vraag feedback */}
        <div className="space-y-3">
          <h3 className="text-white/60 text-sm uppercase tracking-wider">Beoordeling per vraag</h3>
          {opdracht.vragen.map(v => {
            const resultaat = resultaten.find(r => r.vraag_nummer === v.nummer)
            const puntenBehaald = resultaat?.punten_behaald ?? 0
            const volledig = puntenBehaald >= v.punten
            const gedeeltelijk = puntenBehaald > 0 && !volledig
            return (
              <div key={v.nummer} className="bg-[#0f1029] border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-white font-medium text-sm">{v.nummer}. {v.vraag}</p>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-semibold ${
                    volledig ? 'bg-green-500/10 border-green-500/30 text-green-400'
                    : gedeeltelijk ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                    : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    {puntenBehaald}/{v.punten}pt
                  </span>
                </div>
                <div className="bg-white/5 rounded-lg px-3 py-2">
                  <p className="text-white/40 text-xs mb-1">Jouw antwoord:</p>
                  <p className="text-white/80 text-sm">{antwoorden[v.nummer] || <span className="italic text-white/30">Geen antwoord</span>}</p>
                </div>
                {resultaat?.ai_onderbouwing && (
                  <div className={`rounded-lg px-3 py-2 text-xs ${
                    volledig ? 'bg-green-500/5 border border-green-500/15 text-green-400/80'
                    : gedeeltelijk ? 'bg-amber-500/5 border border-amber-500/15 text-amber-400/80'
                    : 'bg-red-500/5 border border-red-500/15 text-red-400/80'
                  }`}>
                    💡 {resultaat.ai_onderbouwing}
                  </div>
                )}
                {/* Modelantwoord tonen na inleveren */}
                <div className="bg-green-500/5 border border-green-500/10 rounded-lg px-3 py-2">
                  <p className="text-green-400/60 text-xs mb-1">✓ Modelantwoord:</p>
                  <p className="text-green-400/80 text-xs">{v.antwoord}</p>
                  {v.toelichting && <p className="text-white/30 text-xs mt-1">💡 {v.toelichting}</p>}
                </div>
              </div>
            )
          })}
        </div>

        <button onClick={() => navigate(-1)} className="text-blue-400 text-sm hover:underline flex items-center gap-1">
          <ArrowLeft size={14} /> Terug naar klas
        </button>
      </div>
    )
  }

  // ── BEZIG VIEW ──
  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => navigate(-1)} className="text-white/50 hover:text-white"><ArrowLeft size={20} /></button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-white truncate">{opdracht.title}</h2>
          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
            {opdracht.type && (
              <span className="text-xs text-white/40">{opdracht.type}</span>
            )}
            {opdracht.deadline && (
              <span className={`flex items-center gap-1 text-xs ${isVerlopen ? 'text-red-400/70' : 'text-amber-400/70'}`}>
                <Clock size={11} />
                Deadline: {new Date(opdracht.deadline).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}{' '}
                {new Date(opdracht.deadline).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <span className="text-xs text-white/30 italic">Concept wordt automatisch opgeslagen</span>
          </div>
        </div>
        <button
          onClick={handleInleveren}
          disabled={inleveren}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all"
        >
          <CheckCircle size={15} />
          {inleveren ? 'Nakijken...' : 'Inleveren'}
        </button>
      </div>

      {/* Split view */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 180px)' }}>

        {/* Links: vragen */}
        <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <span className="text-white/50 text-xs uppercase tracking-wider">📝 Vragen</span>
            <p className="text-white/30 text-xs mt-0.5">{opdracht.vragen.length} vragen · {maxPunten}pt totaal</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {opdracht.beschrijving && (
              <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg px-3 py-2">
                <p className="text-blue-400/80 text-sm">{opdracht.beschrijving}</p>
              </div>
            )}
            {opdracht.vragen.map(v => (
              <div key={v.nummer} className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white/90 text-sm font-medium">{v.nummer}. {v.vraag}</p>
                  <span className="text-white/30 text-xs shrink-0">{v.punten}pt</span>
                </div>
                {v.afbeelding && (
                  <img src={v.afbeelding} alt={`Afbeelding vraag ${v.nummer}`}
                    className="w-full max-h-40 object-cover rounded-lg border border-white/10"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                )}

                {/* Open vraag */}
                {v.type === 'open' && (
                  <textarea
                    value={antwoorden[v.nummer] || ''}
                    onChange={e => setAntwoorden(prev => ({ ...prev, [v.nummer]: e.target.value }))}
                    placeholder="Typ hier je antwoord..."
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 outline-none focus:border-blue-500/50 resize-none transition-colors"
                  />
                )}

                {/* Meerkeuze */}
                {v.type === 'meerkeuze' && v.opties && (
                  <div className="space-y-1.5">
                    {v.opties.map((opt, j) => (
                      <button
                        key={j}
                        onClick={() => setAntwoorden(prev => ({ ...prev, [v.nummer]: opt }))}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm border transition-all ${
                          antwoorden[v.nummer] === opt
                            ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                            : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Waar/Onwaar */}
                {v.type === 'waar-onwaar' && (
                  <div className="flex gap-2">
                    {['Waar', 'Onwaar'].map(keuze => (
                      <button
                        key={keuze}
                        onClick={() => setAntwoorden(prev => ({ ...prev, [v.nummer]: keuze }))}
                        className={`flex-1 py-2 rounded-lg text-sm border font-medium transition-all ${
                          antwoorden[v.nummer] === keuze
                            ? keuze === 'Waar'
                              ? 'bg-green-600/20 border-green-500/50 text-green-300'
                              : 'bg-red-600/20 border-red-500/50 text-red-300'
                            : 'bg-white/5 border-white/10 text-white/70 hover:border-white/20'
                        }`}
                      >
                        {keuze}
                      </button>
                    ))}
                  </div>
                )}

                {/* Voortgangsindicator */}
                {antwoorden[v.nummer]?.trim() && (
                  <p className="text-green-400/50 text-xs flex items-center gap-1">
                    <CheckCircle size={11} /> Beantwoord
                  </p>
                )}
              </div>
            ))}

            {/* Inleveren onderaan */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex items-center justify-between mb-3">
                <span className="text-white/40 text-sm">
                  {Object.values(antwoorden).filter(a => a?.trim()).length} / {opdracht.vragen.length} beantwoord
                </span>
                <div className="h-1.5 flex-1 mx-3 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${(Object.values(antwoorden).filter(a => a?.trim()).length / opdracht.vragen.length) * 100}%` }}
                  />
                </div>
              </div>
              <button
                onClick={handleInleveren}
                disabled={inleveren}
                className="w-full py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-medium rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} />
                {inleveren ? 'AI kijkt na...' : 'Inleveren & nakijken'}
              </button>
            </div>
          </div>
        </div>

        {/* Rechts: AI tutor */}
        <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-white/10">
            <span className="text-white/50 text-xs uppercase tracking-wider">🤖 AI Tutor</span>
            <p className="text-white/30 text-xs mt-0.5">Stel vragen over de stof — ik geef geen antwoorden!</p>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {tutorMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 border border-white/10 text-white/80'
                }`}>
                  {msg.role === 'assistant' ? (
                    <ReactMarkdown components={{
                      p: ({children}) => <p className="mb-1 last:mb-0">{children}</p>,
                      strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                      ul: ({children}) => <ul className="list-disc pl-4 space-y-0.5 my-1">{children}</ul>,
                      li: ({children}) => <li>{children}</li>,
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
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-blue-500/50"
            />
            <button
              onClick={handleTutorSend}
              disabled={tutorLoading || !tutorInput.trim()}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}