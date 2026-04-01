import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FileText, ArrowLeft, Send, Paperclip, Plus, Trash } from 'lucide-react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface Vraag {
  nummer: number
  vraag: string
  type: 'open' | 'meerkeuze' | 'waar-onwaar'
  punten: number
  opties?: string[]
  antwoord: string
  toelichting: string
}

interface Opdracht {
  id: string
  titel: string
  beschrijving: string
  type: string
  max_punten: number
  vragen: Vraag[]
  klas_id: string | null
  deadline: string | null
  is_actief: boolean
  created_at: string
}

interface SparMessage {
  role: 'user' | 'assistant'
  content: string
}

type View = 'overzicht' | 'spar' | 'detail'

const parseVragen = (vragen: any): Vraag[] => {
  if (!vragen) return []
  if (typeof vragen === 'string') {
    try { return JSON.parse(vragen) } catch { return [] }
  }
  if (Array.isArray(vragen)) return vragen
  return []
}

export default function Opdrachten() {
  const { role, user } = useAuth()
  const [view, setView] = useState<View>('overzicht')
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([])
  const [selectedOpdracht, setSelectedOpdracht] = useState<Opdracht | null>(null)

  const [sparMessages, setSparMessages] = useState<SparMessage[]>([])
  const [sparInput, setSparInput] = useState('')
  const [sparLoading, setSparLoading] = useState(false)
  const [sparFiles, setSparFiles] = useState<File[]>([])
  const [gegenereerdeOpdracht, setGegenereerdeOpdracht] = useState<any | null>(null)
  const [opslaan, setOpslaan] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sparMessages])

  useEffect(() => {
    if (!user) return
    fetch(`${API_URL}/api/opdrachten?teacher_id=${user.id}`)
      .then(r => r.json())
      .then(data => setOpdrachten(Array.isArray(data) ? data.map((o: any) => ({
        ...o,
        vragen: parseVragen(o.vragen)
      })) : []))
      .catch(() => {})
  }, [user])

  const tryParseOpdracht = (text: string) => {
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) {
        const parsed = JSON.parse(match[0])
        if (parsed.titel && parsed.vragen) {
          setGegenereerdeOpdracht(parsed)
        }
      }
    } catch {}
  }

  const handleSparSend = async () => {
    if (!sparInput.trim() && sparFiles.length === 0) return
    setSparLoading(true)

    const userMsg: SparMessage = { role: 'user', content: sparInput.trim() || '📎 Bestand meegestuurd' }
    const newMessages = [...sparMessages, userMsg]
    setSparMessages(newMessages)
    setSparInput('')

    try {
      let data
      if (sparFiles.length > 0) {
        const formData = new FormData()
        formData.append('content', userMsg.content)
        formData.append('messages', JSON.stringify(newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))))
        sparFiles.forEach(f => formData.append('files', f))
        const res = await fetch(`${API_URL}/api/opdrachten/spar/upload`, { method: 'POST', body: formData })
        data = await res.json()
        setSparFiles([])
      } else {
        const res = await fetch(`${API_URL}/api/opdrachten/spar/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: userMsg.content,
            messages: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
          }),
        })
        data = await res.json()
      }

      const assistantMsg: SparMessage = { role: 'assistant', content: data.message }
      setSparMessages(prev => [...prev, assistantMsg])
      tryParseOpdracht(data.message)
    } catch {
      setSparMessages(prev => [...prev, { role: 'assistant', content: '❌ Er ging iets mis. Probeer opnieuw.' }])
    } finally {
      setSparLoading(false)
    }
  }

  const handleOpslaanOpdracht = async () => {
    if (!gegenereerdeOpdracht || !user) return
    setOpslaan(true)
    try {
      const res = await fetch(`${API_URL}/api/opdrachten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...gegenereerdeOpdracht,
          teacher_id: user.id,
        }),
      })
      const created = await res.json()
      const parsed = { ...created, vragen: parseVragen(created.vragen) }
      setOpdrachten(prev => [parsed, ...prev])
      setView('overzicht')
      setSparMessages([])
      setGegenereerdeOpdracht(null)
    } catch {
      alert('Opslaan mislukt, probeer opnieuw.')
    } finally {
      setOpslaan(false)
    }
  }

  const handleDelete = async (opdracht: Opdracht) => {
    if (!confirm(`Weet je zeker dat je "${opdracht.titel}" wilt verwijderen?`)) return
    await fetch(`${API_URL}/api/opdrachten/${opdracht.id}`, { method: 'DELETE' })
    setOpdrachten(prev => prev.filter(o => o.id !== opdracht.id))
    if (selectedOpdracht?.id === opdracht.id) setView('overzicht')
  }

  // ===== SPAR VIEW =====
  if (view === 'spar') {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { setView('overzicht'); setSparMessages([]); setGegenereerdeOpdracht(null) }} className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">Nieuwe opdracht maken</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 160px)' }}>
          {/* Links: spar chatbox */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-white/50 text-xs uppercase tracking-wider">💬 Spar met AI</span>
              <p className="text-white/30 text-xs mt-0.5">Vertel wat voor opdracht je wilt maken. Je kunt ook bestanden meesturen.</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sparMessages.length === 0 && (
                <p className="text-white/30 text-sm text-center mt-8">
                  Vertel de AI wat voor opdracht je wilt maken.<br />
                  Bijv: "Maak een oefentoets over de Franse Revolutie voor havo 4, 5 vragen"
                </p>
              )}
              {sparMessages.map((msg, i) => {
                const isJson = msg.role === 'assistant' && msg.content.trim().startsWith('{')
                if (isJson) return null
                return (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white/5 border border-white/10 text-white/80'
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              {gegenereerdeOpdracht && (
                <div className="flex justify-start">
                  <div className="bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-xl text-sm text-green-400">
                    ✅ Opdracht gegenereerd! Bekijk en sla op rechts →
                  </div>
                </div>
              )}
              {sparLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-white/40 text-sm">Aan het denken...</div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {sparFiles.length > 0 && (
              <div className="px-3 pt-2 flex flex-wrap gap-2">
                {sparFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/60">
                    📎 {f.name}
                    <button onClick={() => setSparFiles(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-red-400 hover:text-red-300">×</button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 border-t border-white/10 flex gap-2">
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => { if (e.target.files) setSparFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-white/40 hover:text-white/70 transition-colors">
                <Paperclip size={16} />
              </button>
              <input
                type="text"
                value={sparInput}
                onChange={e => setSparInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSparSend()}
                placeholder="Beschrijf je opdracht..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-blue-500/50"
              />
              <button
                onClick={handleSparSend}
                disabled={sparLoading || (!sparInput.trim() && sparFiles.length === 0)}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Rechts: gegenereerde opdracht preview */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-white/50 text-xs uppercase tracking-wider">📋 Gegenereerde opdracht</span>
            </div>

            {!gegenereerdeOpdracht ? (
              <div className="flex-1 flex items-center justify-center text-white/20 text-sm text-center p-8">
                De opdracht verschijnt hier zodra de AI hem heeft gegenereerd.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{gegenereerdeOpdracht.titel}</h3>
                  <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded mt-1 inline-block">
                    {gegenereerdeOpdracht.type}
                  </span>
                  <p className="text-white/60 text-sm mt-2">{gegenereerdeOpdracht.beschrijving}</p>
                  <p className="text-white/40 text-xs mt-1">Max punten: {gegenereerdeOpdracht.max_punten}</p>
                </div>

                <div className="space-y-3">
                  {parseVragen(gegenereerdeOpdracht.vragen).map((v: Vraag, i: number) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white/80 text-sm font-medium">{v.nummer}. {v.vraag}</p>
                        <span className="text-xs text-white/40 shrink-0">{v.punten}pt</span>
                      </div>
                      {v.opties && v.opties.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {v.opties.map((opt, j) => (
                            <li key={j} className="text-white/50 text-xs pl-2">• {opt}</li>
                          ))}
                        </ul>
                      )}
                      <p className="text-green-400/70 text-xs mt-2">✓ {v.antwoord}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleOpslaanOpdracht}
                  disabled={opslaan}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-all"
                >
                  {opslaan ? 'Opslaan...' : '💾 Opdracht opslaan'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selectedOpdracht) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('overzicht')} className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">{selectedOpdracht.titel}</h2>
          <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
            {selectedOpdracht.type}
          </span>
          <div className="ml-auto">
            <button
              onClick={() => handleDelete(selectedOpdracht)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm rounded-lg transition-all"
            >
              <Trash size={14} /> Verwijderen
            </button>
          </div>
        </div>

        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 space-y-4">
          <p className="text-white/60 text-sm">{selectedOpdracht.beschrijving}</p>
          <p className="text-white/40 text-xs">Max punten: {selectedOpdracht.max_punten}</p>

          <div className="space-y-3">
            {parseVragen(selectedOpdracht.vragen).map((v: Vraag, i: number) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-white/80 text-sm font-medium">{v.nummer}. {v.vraag}</p>
                  <span className="text-xs text-white/40 shrink-0">{v.punten}pt</span>
                </div>
                {v.opties && v.opties.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {v.opties.map((opt, j) => (
                      <li key={j} className="text-white/50 text-xs pl-2">• {opt}</li>
                    ))}
                  </ul>
                )}
                <p className="text-green-400/70 text-xs mt-2">✓ Antwoord: {v.antwoord}</p>
                {v.toelichting && <p className="text-white/30 text-xs mt-1">💡 {v.toelichting}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ===== OVERZICHT =====
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Opdrachten</h2>
          <p className="text-white/50 text-sm mt-1">
            {role === 'teacher' ? 'Maak en beheer opdrachten voor jouw klassen'
              : role === 'school_admin' || role === 'admin' ? 'Overzicht van alle opdrachten'
              : 'Jouw openstaande en voltooide opdrachten'}
          </p>
        </div>
        {(role === 'teacher' || role === 'school_admin' || role === 'admin') && (
          <button
            onClick={() => { setSparMessages([]); setGegenereerdeOpdracht(null); setView('spar') }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all"
          >
            <Plus size={16} /> Nieuwe opdracht aanmaken
          </button>
        )}
      </div>

      {opdrachten.length === 0 ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <FileText size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nog geen opdrachten</h3>
          <p className="text-white/40 text-sm max-w-sm">Opdrachten worden hier weergegeven zodra ze zijn aangemaakt.</p>
          {(role === 'teacher' || role === 'school_admin' || role === 'admin') && (
            <button
              onClick={() => { setSparMessages([]); setGegenereerdeOpdracht(null); setView('spar') }}
              className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all"
            >
              <Plus size={16} /> Nieuwe opdracht aanmaken
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {opdrachten.map(opdracht => (
            <div
              key={opdracht.id}
              onClick={() => { setSelectedOpdracht(opdracht); setView('detail') }}
              className="bg-[#0f1029] border border-white/10 hover:border-blue-500/40 rounded-xl p-5 cursor-pointer transition-all hover:bg-white/5 group"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                  {opdracht.type}
                </span>
                <span className="text-xs text-white/30">{opdracht.max_punten}pt</span>
              </div>
              <h3 className="text-white font-semibold mb-1">{opdracht.titel}</h3>
              <p className="text-white/40 text-xs line-clamp-2">{opdracht.beschrijving}</p>
              <p className="text-white/20 text-xs mt-2">{parseVragen(opdracht.vragen).length} vragen</p>
              <div className="mt-3 text-blue-400/60 text-xs group-hover:text-blue-400 transition-colors">
                Klik om te openen →
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}