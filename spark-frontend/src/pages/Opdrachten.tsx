import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FileText, ArrowLeft, Send, Paperclip, Plus, Trash, Pencil, ChevronDown, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const OPDRACHT_TYPES = ['huiswerk', 'oefentoets', 'casus', 'opdracht']
const TYPE_COLORS: Record<string, string> = {
  huiswerk:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  oefentoets: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  casus:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
  opdracht:   'text-green-400 bg-green-500/10 border-green-500/20',
}
const getTypeColor = (type: string) => TYPE_COLORS[type] || 'text-blue-400 bg-blue-500/10 border-blue-500/20'

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
  klas_ids: string[]
  deadline: string | null
  is_actief: boolean
  created_at: string
}
interface Klas { id: string; naam: string; vak: string; schooljaar: string }
interface SparMessage { role: 'user' | 'assistant'; content: string }
type View = 'overzicht' | 'spar' | 'detail'

const parseVragen = (vragen: any): Vraag[] => {
  if (!vragen) return []
  if (typeof vragen === 'string') { try { return JSON.parse(vragen) } catch { return [] } }
  if (Array.isArray(vragen)) return vragen
  return []
}

export default function Opdrachten() {
  const { role, user } = useAuth()
  const [view, setView] = useState<View>('overzicht')
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([])
  const [selectedOpdracht, setSelectedOpdracht] = useState<Opdracht | null>(null)
  const [klassen, setKlassen] = useState<Klas[]>([])

  // Edit state
  const [editTitel, setEditTitel] = useState('')
  const [editType, setEditType] = useState('')
  const [editKlasIds, setEditKlasIds] = useState<string[]>([])
  const [editingTitel, setEditingTitel] = useState(false)
  const [editingVragen, setEditingVragen] = useState(false)
  const [editVragen, setEditVragen] = useState<Vraag[]>([])
  const [saving, setSaving] = useState(false)
  const [klasDropdownOpen, setKlasDropdownOpen] = useState(false)
  const klasDropdownRef = useRef<HTMLDivElement>(null)

  // Spar state
  const [sparMessages, setSparMessages] = useState<SparMessage[]>([])
  const [sparInput, setSparInput] = useState('')
  const [sparLoading, setSparLoading] = useState(false)
  const [sparFiles, setSparFiles] = useState<File[]>([])
  const [gegenereerdeOpdracht, setGegenereerdeOpdracht] = useState<any | null>(null)
  const [opslaan, setOpslaan] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [sparMessages])

  // Sluit dropdown bij klik buiten
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (klasDropdownRef.current && !klasDropdownRef.current.contains(e.target as Node)) {
        setKlasDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!user) return
    fetch(`${API_URL}/api/opdrachten?teacher_id=${user.id}`)
      .then(r => r.json())
      .then(data => setOpdrachten(Array.isArray(data) ? data.map((o: any) => ({
        ...o, vragen: parseVragen(o.vragen), klas_ids: Array.isArray(o.klas_ids) ? o.klas_ids : [],
      })) : []))
      .catch(() => {})
  }, [user])

  useEffect(() => {
    if (!user) return
    supabase.from('klassen').select('id, naam, vak, schooljaar').eq('teacher_id', user.id).eq('is_active', true)
      .then(({ data }) => setKlassen(data || []))
  }, [user])

  useEffect(() => {
    if (selectedOpdracht) {
      setEditTitel(selectedOpdracht.titel)
      setEditType(selectedOpdracht.type)
      setEditKlasIds(selectedOpdracht.klas_ids || [])
      setEditVragen(parseVragen(selectedOpdracht.vragen))
      setEditingVragen(false)
    }
  }, [selectedOpdracht])

  const toggleKlas = (id: string) => {
    setEditKlasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])
  }

  const handleSaveChanges = async () => {
    if (!selectedOpdracht) return
    setSaving(true)
    try {
      const body: any = { titel: editTitel, type: editType, klas_ids: editKlasIds }
      if (editingVragen) body.vragen = editVragen
      const res = await fetch(`${API_URL}/api/opdrachten/${selectedOpdracht.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const updated = await res.json()
      const parsedUpdated = { ...updated, vragen: parseVragen(updated.vragen), klas_ids: updated.klas_ids || [] }
      setSelectedOpdracht(parsedUpdated)
      setOpdrachten(prev => prev.map(o => o.id === parsedUpdated.id ? parsedUpdated : o))
      setEditingTitel(false)
      setEditingVragen(false)
    } catch { alert('Opslaan mislukt, probeer opnieuw.') }
    finally { setSaving(false) }
  }

  const tryParseOpdracht = (text: string) => {
    try {
      const match = text.match(/\{[\s\S]*\}/)
      if (match) { const p = JSON.parse(match[0]); if (p.titel && p.vragen) setGegenereerdeOpdracht(p) }
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
        data = await res.json(); setSparFiles([])
      } else {
        const res = await fetch(`${API_URL}/api/opdrachten/spar/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: userMsg.content, messages: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })) }),
        }); data = await res.json()
      }
      setSparMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      tryParseOpdracht(data.message)
    } catch { setSparMessages(prev => [...prev, { role: 'assistant', content: '❌ Er ging iets mis. Probeer opnieuw.' }]) }
    finally { setSparLoading(false) }
  }

  const handleOpslaanOpdracht = async () => {
    if (!gegenereerdeOpdracht || !user) return
    setOpslaan(true)
    try {
      const res = await fetch(`${API_URL}/api/opdrachten`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...gegenereerdeOpdracht, teacher_id: user.id }),
      })
      const created = await res.json()
      setOpdrachten(prev => [{ ...created, vragen: parseVragen(created.vragen), klas_ids: created.klas_ids || [] }, ...prev])
      setView('overzicht'); setSparMessages([]); setGegenereerdeOpdracht(null)
    } catch { alert('Opslaan mislukt, probeer opnieuw.') }
    finally { setOpslaan(false) }
  }

  const handleDelete = async (opdracht: Opdracht) => {
    if (!confirm(`Weet je zeker dat je "${opdracht.titel}" wilt verwijderen?`)) return
    await fetch(`${API_URL}/api/opdrachten/${opdracht.id}`, { method: 'DELETE' })
    setOpdrachten(prev => prev.filter(o => o.id !== opdracht.id))
    setView('overzicht')
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
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-white/50 text-xs uppercase tracking-wider">💬 Spar met AI</span>
              <p className="text-white/30 text-xs mt-0.5">Vertel wat voor opdracht je wilt maken.</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sparMessages.length === 0 && (
                <p className="text-white/30 text-sm text-center mt-8">Bijv: "Maak een oefentoets over de Franse Revolutie voor havo 4, 5 vragen"</p>
              )}
              {sparMessages.map((msg, i) => {
                if (msg.role === 'assistant' && msg.content.trim().startsWith('{')) return null
                return (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/10 text-white/80'}`}>
                      {msg.content}
                    </div>
                  </div>
                )
              })}
              {gegenereerdeOpdracht && (
                <div className="flex justify-start">
                  <div className="bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-xl text-sm text-green-400">✅ Opdracht gegenereerd! Bekijk en sla op rechts →</div>
                </div>
              )}
              {sparLoading && <div className="flex justify-start"><div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-white/40 text-sm">Aan het denken...</div></div>}
              <div ref={chatEndRef} />
            </div>
            {sparFiles.length > 0 && (
              <div className="px-3 pt-2 flex flex-wrap gap-2">
                {sparFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/60">
                    📎 {f.name}<button onClick={() => setSparFiles(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-red-400">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => { if (e.target.files) setSparFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-white/40 hover:text-white/70"><Paperclip size={16} /></button>
              <input type="text" value={sparInput} onChange={e => setSparInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSparSend()} placeholder="Beschrijf je opdracht..." className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-blue-500/50" />
              <button onClick={handleSparSend} disabled={sparLoading || (!sparInput.trim() && sparFiles.length === 0)} className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg"><Send size={16} /></button>
            </div>
          </div>
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-white/50 text-xs uppercase tracking-wider">📋 Gegenereerde opdracht</span>
            </div>
            {!gegenereerdeOpdracht ? (
              <div className="flex-1 flex items-center justify-center text-white/20 text-sm text-center p-8">De opdracht verschijnt hier zodra de AI hem heeft gegenereerd.</div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{gegenereerdeOpdracht.titel}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block border ${getTypeColor(gegenereerdeOpdracht.type)}`}>{gegenereerdeOpdracht.type}</span>
                  <p className="text-white/60 text-sm mt-2">{gegenereerdeOpdracht.beschrijving}</p>
                </div>
                <div className="space-y-3">
                  {parseVragen(gegenereerdeOpdracht.vragen).map((v: Vraag, i: number) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white/80 text-sm font-medium">{v.nummer}. {v.vraag}</p>
                        <span className="text-xs text-white/40 shrink-0">{v.punten}pt</span>
                      </div>
                      {v.opties && v.opties.length > 0 && <ul className="mt-2 space-y-1">{v.opties.map((opt, j) => <li key={j} className="text-white/50 text-xs pl-2">• {opt}</li>)}</ul>}
                      <p className="text-green-400/70 text-xs mt-2">✓ {v.antwoord}</p>
                    </div>
                  ))}
                </div>
                <button onClick={handleOpslaanOpdracht} disabled={opslaan} className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg">
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
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setView('overzicht')} className="text-white/50 hover:text-white transition-colors"><ArrowLeft size={20} /></button>
          {editingTitel ? (
            <input autoFocus value={editTitel} onChange={e => setEditTitel(e.target.value)} onBlur={() => setEditingTitel(false)} className="text-2xl font-bold bg-white/5 border border-blue-500/50 rounded-lg px-3 py-1 text-white outline-none" />
          ) : (
            <h2 className="text-2xl font-bold text-white">{editTitel}</h2>
          )}
          <button onClick={() => setEditingTitel(true)} className="text-white/30 hover:text-white/70"><Pencil size={15} /></button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={handleSaveChanges} disabled={saving} className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg">
              <Check size={14} /> {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={() => handleDelete(selectedOpdracht)} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm rounded-lg">
              <Trash size={14} /> Verwijderen
            </button>
          </div>
        </div>

        {/* Instellingen balk */}
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-4 flex flex-wrap gap-6 items-start">
          {/* Type */}
          <div className="flex flex-col gap-2">
            <label className="text-white/40 text-xs uppercase tracking-wider">Type</label>
            <div className="flex gap-2 flex-wrap">
              {OPDRACHT_TYPES.map(t => (
                <button key={t} onClick={() => setEditType(t)}
                  className={`px-3 py-1 rounded-lg text-xs border transition-all ${editType === t ? getTypeColor(t) + ' font-semibold' : 'text-white/30 bg-white/5 border-white/10 hover:border-white/20'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Klassen dropdown */}
          <div className="flex flex-col gap-2" ref={klasDropdownRef}>
            <label className="text-white/40 text-xs uppercase tracking-wider">Klassen toewijzen</label>
            <div className="relative">
              <button
                onClick={() => setKlasDropdownOpen(prev => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-sm text-white/70 transition-all min-w-[200px]"
              >
                <span className="flex-1 text-left">
                  {editKlasIds.length === 0 ? '— Geen klas geselecteerd —' : `${editKlasIds.length} klas${editKlasIds.length > 1 ? 'sen' : ''} geselecteerd`}
                </span>
                <ChevronDown size={14} className={`transition-transform ${klasDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {klasDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-[#1a1f3d] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                  {klassen.length === 0 ? (
                    <div className="px-4 py-3 text-white/30 text-sm">Geen klassen gevonden</div>
                  ) : (
                    klassen.map(k => (
                      <button key={k.id} onClick={() => toggleKlas(k.id)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${editKlasIds.includes(k.id) ? 'bg-blue-600 border-blue-600' : 'border-white/20'}`}>
                          {editKlasIds.includes(k.id) && <Check size={10} className="text-white" />}
                        </div>
                        <div>
                          <p className="text-white text-sm">{k.naam}</p>
                          <p className="text-white/40 text-xs">{k.vak} — {k.schooljaar}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Geselecteerde klassen als tags */}
            {editKlasIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {editKlasIds.map(kid => {
                  const k = klassen.find(k => k.id === kid)
                  return k ? (
                    <span key={kid} className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                      {k.naam}
                      <button onClick={() => toggleKlas(kid)} className="text-blue-400/60 hover:text-red-400 ml-0.5">×</button>
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-xs uppercase tracking-wider">Max punten</label>
            <span className="text-white text-sm">{selectedOpdracht.max_punten}pt</span>
          </div>
        </div>

        {/* Vragen */}
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-white/60 text-sm">{selectedOpdracht.beschrijving}</p>
            <button
              onClick={() => setEditingVragen(prev => !prev)}
              className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all ${editingVragen ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'text-white/40 bg-white/5 border-white/10 hover:border-white/20'}`}
            >
              <Pencil size={12} /> {editingVragen ? 'Stoppen met bewerken' : 'Vragen bewerken'}
            </button>
          </div>

          <div className="space-y-3">
            {(editingVragen ? editVragen : parseVragen(selectedOpdracht.vragen)).map((v: Vraag, i: number) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
                {editingVragen ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-white/40 text-xs shrink-0">#{v.nummer}</span>
                      <textarea
                        value={v.vraag}
                        onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, vraag: e.target.value } : q))}
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-blue-500/50 resize-none"
                        rows={2}
                      />
                      <input
                        type="number"
                        value={v.punten}
                        onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, punten: Number(e.target.value) } : q))}
                        className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs text-center outline-none focus:border-blue-500/50"
                      />
                      <span className="text-white/40 text-xs">pt</span>
                    </div>
                    <div className="flex gap-2 items-center pl-6">
                      <span className="text-white/30 text-xs">Antwoord:</span>
                      <input
                        value={v.antwoord}
                        onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, antwoord: e.target.value } : q))}
                        className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-green-400/80 text-xs outline-none focus:border-blue-500/50"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-white/80 text-sm font-medium">{v.nummer}. {v.vraag}</p>
                      <span className="text-xs text-white/40 shrink-0">{v.punten}pt</span>
                    </div>
                    {v.opties && v.opties.length > 0 && <ul className="mt-2 space-y-1">{v.opties.map((opt, j) => <li key={j} className="text-white/50 text-xs pl-2">• {opt}</li>)}</ul>}
                    <p className="text-green-400/70 text-xs mt-2">✓ Antwoord: {v.antwoord}</p>
                    {v.toelichting && <p className="text-white/30 text-xs mt-1">💡 {v.toelichting}</p>}
                  </>
                )}
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
            {role === 'teacher' ? 'Maak en beheer opdrachten voor jouw klassen' : role === 'school_admin' || role === 'admin' ? 'Overzicht van alle opdrachten' : 'Jouw openstaande en voltooide opdrachten'}
          </p>
        </div>
        {(role === 'teacher' || role === 'school_admin' || role === 'admin') && (
          <button onClick={() => { setSparMessages([]); setGegenereerdeOpdracht(null); setView('spar') }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all">
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
            <button onClick={() => { setSparMessages([]); setGegenereerdeOpdracht(null); setView('spar') }} className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg">
              <Plus size={16} /> Nieuwe opdracht aanmaken
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {opdrachten.map(opdracht => (
            <div key={opdracht.id} onClick={() => { setSelectedOpdracht(opdracht); setView('detail') }}
              className="bg-[#0f1029] border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition-all hover:bg-white/5 group">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded border ${getTypeColor(opdracht.type)}`}>{opdracht.type}</span>
                <span className="text-xs text-white/30">{opdracht.max_punten}pt</span>
              </div>
              <h3 className="text-white font-semibold mb-1">{opdracht.titel}</h3>
              <p className="text-white/40 text-xs line-clamp-2">{opdracht.beschrijving}</p>
              <p className="text-white/20 text-xs mt-2">{parseVragen(opdracht.vragen).length} vragen</p>
              {opdracht.klas_ids && opdracht.klas_ids.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {opdracht.klas_ids.slice(0, 3).map(kid => {
                    const k = klassen.find(k => k.id === kid)
                    return k ? <span key={kid} className="text-xs text-blue-400/60 bg-blue-500/5 border border-blue-500/10 px-1.5 py-0.5 rounded">📚 {k.naam}</span> : null
                  })}
                  {opdracht.klas_ids.length > 3 && <span className="text-xs text-white/30 px-1.5 py-0.5">+{opdracht.klas_ids.length - 3} meer</span>}
                </div>
              )}
              <div className="mt-3 text-white/20 text-xs group-hover:text-white/40 transition-colors">Klik om te openen →</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}