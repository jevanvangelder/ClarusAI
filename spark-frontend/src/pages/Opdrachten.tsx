import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { FileText, ArrowLeft, Send, Paperclip, Plus, Trash, Pencil, ChevronDown, Check, MessageSquarePlus, Image, X, GripVertical } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import ReactMarkdown from 'react-markdown'

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
  afbeelding?: string
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
interface SparMessage { role: 'user' | 'assistant'; content: string; isUpdate?: boolean; imageUrl?: string }
type View = 'overzicht' | 'spar' | 'detail'

const parseVragen = (vragen: any): Vraag[] => {
  if (!vragen) return []
  if (typeof vragen === 'string') { try { return JSON.parse(vragen) } catch { return [] } }
  if (Array.isArray(vragen)) return vragen
  return []
}
const berekenMaxPunten = (vragen: Vraag[]) => vragen.reduce((acc, v) => acc + (Number(v.punten) || 0), 0)
const leegVraag = (nummer: number): Vraag => ({ nummer, vraag: '', type: 'open', punten: 1, opties: [], antwoord: '', toelichting: '' })

export default function Opdrachten() {
  const { role, user } = useAuth()
  const [view, setView] = useState<View>('overzicht')
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([])
  const [selectedOpdracht, setSelectedOpdracht] = useState<Opdracht | null>(null)
  const [klassen, setKlassen] = useState<Klas[]>([])

  const [editTitel, setEditTitel] = useState('')
  const [editBeschrijving, setEditBeschrijving] = useState('')
  const [editType, setEditType] = useState('')
  const [editKlasIds, setEditKlasIds] = useState<string[]>([])
  const [editingTitel, setEditingTitel] = useState(false)
  const [editingBeschrijving, setEditingBeschrijving] = useState(false)
  const [editingVragen, setEditingVragen] = useState(false)
  const [editVragen, setEditVragen] = useState<Vraag[]>([])
  const [saving, setSaving] = useState(false)
  const [klasDropdownOpen, setKlasDropdownOpen] = useState(false)
  const klasDropdownRef = useRef<HTMLDivElement>(null)
  const vraagAfbeeldingRefs = useRef<(HTMLInputElement | null)[]>([])

  const [sparMessages, setSparMessages] = useState<SparMessage[]>([])
  const [sparInput, setSparInput] = useState('')
  const [sparLoading, setSparLoading] = useState(false)
  const [sparFiles, setSparFiles] = useState<File[]>([])
  const [sparPastedImages, setSparPastedImages] = useState<{ file: File; previewUrl: string }[]>([])
  const [gegenereerdeOpdracht, setGegenereerdeOpdracht] = useState<any | null>(null)
  const [opslaan, setOpslaan] = useState(false)
  const [sparContext, setSparContext] = useState<string>('')
  const [uploadingImage, setUploadingImage] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const sparInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [sparMessages])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (klasDropdownRef.current && !klasDropdownRef.current.contains(e.target as Node)) setKlasDropdownOpen(false)
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
      setEditBeschrijving(selectedOpdracht.beschrijving || '')
      setEditType(selectedOpdracht.type)
      setEditKlasIds(selectedOpdracht.klas_ids || [])
      setEditVragen(parseVragen(selectedOpdracht.vragen))
      setEditingVragen(false)
      setEditingBeschrijving(false)
    }
  }, [selectedOpdracht])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault()
        const file = items[i].getAsFile()
        if (!file) continue
        const previewUrl = URL.createObjectURL(file)
        const namedFile = new File([file], `geplakt-${Date.now()}.png`, { type: file.type })
        setSparPastedImages(prev => [...prev, { file: namedFile, previewUrl }])
      }
    }
  }, [])

  const toggleKlas = (id: string) => setEditKlasIds(prev => prev.includes(id) ? prev.filter(k => k !== id) : [...prev, id])

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const items = Array.from(editVragen)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    setEditVragen(items.map((v, i) => ({ ...v, nummer: i + 1 })))
  }

  const handleVraagAfbeelding = (i: number, file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const base64 = e.target?.result as string
      setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, afbeelding: base64 } : q))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveChanges = async () => {
    if (!selectedOpdracht) return
    setSaving(true)
    try {
      const vragenToSave = editingVragen ? editVragen : parseVragen(selectedOpdracht.vragen)
      const autoMaxPunten = berekenMaxPunten(vragenToSave)
      const res = await fetch(`${API_URL}/api/opdrachten/${selectedOpdracht.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titel: editTitel, beschrijving: editBeschrijving, type: editType, klas_ids: editKlasIds, max_punten: autoMaxPunten, vragen: vragenToSave }),
      })
      const updated = await res.json()
      const parsedUpdated = { ...updated, vragen: parseVragen(updated.vragen), klas_ids: updated.klas_ids || [] }
      setSelectedOpdracht(parsedUpdated)
      setOpdrachten(prev => prev.map(o => o.id === parsedUpdated.id ? parsedUpdated : o))
      setEditingTitel(false); setEditingVragen(false); setEditingBeschrijving(false)
    } catch { alert('Opslaan mislukt.') }
    finally { setSaving(false) }
  }

  const handleVervolgSpar = (opdracht: Opdracht) => {
    const context = JSON.stringify({ titel: opdracht.titel, beschrijving: opdracht.beschrijving, type: opdracht.type, max_punten: opdracht.max_punten, vragen: parseVragen(opdracht.vragen) })
    setSparContext(context)
    setGegenereerdeOpdracht({ titel: opdracht.titel, beschrijving: opdracht.beschrijving, type: opdracht.type, max_punten: opdracht.max_punten, vragen: parseVragen(opdracht.vragen) })
    setSparMessages([{ role: 'assistant', content: `Ik heb de opdracht **"${opdracht.titel}"** geladen. Wat wil je aanpassen of uitbreiden?` }])
    setView('spar')
  }

  const parseAIResponse = (text: string) => {
    const PREFIX = 'OPDRACHT_UPDATE:'
    if (text.startsWith(PREFIX)) {
      try {
        const parsed = JSON.parse(text.slice(PREFIX.length).trim())
        if (parsed.titel && parsed.vragen) {
          setGegenereerdeOpdracht(parsed)
          setSparContext(JSON.stringify(parsed))
          return { type: 'update' as const, content: '✅ Opdracht bijgewerkt! Bekijk de wijzigingen rechts →' }
        }
      } catch {}
    }
    return { type: 'chat' as const, content: text }
  }

  const handleSparSend = async () => {
    const heeftFiles = sparFiles.length > 0 || sparPastedImages.length > 0
    if (!sparInput.trim() && !heeftFiles) return
    setSparLoading(true)
    const userMsg: SparMessage = {
      role: 'user',
      content: sparInput.trim() || '📎 Afbeelding meegestuurd',
      imageUrl: sparPastedImages.length > 0 ? sparPastedImages[0].previewUrl : undefined
    }
    const newMessages = [...sparMessages, userMsg]
    setSparMessages(newMessages)
    setSparInput('')
    try {
      let rawResponse: string
      const alleFiles = [...sparFiles, ...sparPastedImages.map(p => p.file)]
      if (alleFiles.length > 0) {
        setUploadingImage(true)
        const formData = new FormData()
        formData.append('content', userMsg.content)
        formData.append('messages', JSON.stringify(newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content }))))
        formData.append('context', sparContext || '')
        alleFiles.forEach(f => formData.append('files', f))
        const res = await fetch(`${API_URL}/api/opdrachten/spar/upload`, { method: 'POST', body: formData })
        setUploadingImage(false)
        rawResponse = (await res.json()).message
        setSparFiles([])
        setSparPastedImages([])
      } else {
        const res = await fetch(`${API_URL}/api/opdrachten/spar/chat`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: userMsg.content, messages: newMessages.slice(0, -1).map(m => ({ role: m.role, content: m.content })), context: sparContext }),
        })
        rawResponse = (await res.json()).message
      }
      const parsed = parseAIResponse(rawResponse)
      setSparMessages(prev => [...prev, { role: 'assistant', content: parsed.content, isUpdate: parsed.type === 'update' }])
    } catch {
      setUploadingImage(false)
      setSparMessages(prev => [...prev, { role: 'assistant', content: '❌ Er ging iets mis. Probeer opnieuw.' }])
    } finally { setSparLoading(false) }
  }

  const handleOpslaanOpdracht = async () => {
    if (!gegenereerdeOpdracht || !user) return
    setOpslaan(true)
    try {
      const vragen = parseVragen(gegenereerdeOpdracht.vragen)
      const autoMaxPunten = berekenMaxPunten(vragen)
      if (selectedOpdracht && sparContext) {
        const res = await fetch(`${API_URL}/api/opdrachten/${selectedOpdracht.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titel: gegenereerdeOpdracht.titel, beschrijving: gegenereerdeOpdracht.beschrijving, type: gegenereerdeOpdracht.type, max_punten: autoMaxPunten, vragen }),
        })
        const updated = await res.json()
        const parsedUpdated = { ...updated, vragen: parseVragen(updated.vragen), klas_ids: updated.klas_ids || [] }
        setOpdrachten(prev => prev.map(o => o.id === parsedUpdated.id ? parsedUpdated : o))
        setSelectedOpdracht(parsedUpdated)
      } else {
        const res = await fetch(`${API_URL}/api/opdrachten`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...gegenereerdeOpdracht, max_punten: autoMaxPunten, vragen, teacher_id: user.id }),
        })
        const created = await res.json()
        setOpdrachten(prev => [{ ...created, vragen: parseVragen(created.vragen), klas_ids: created.klas_ids || [] }, ...prev])
      }
      setSparMessages([]); setGegenereerdeOpdracht(null); setSparContext('')
      setView(selectedOpdracht && sparContext ? 'detail' : 'overzicht')
    } catch { alert('Opslaan mislukt.') }
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
          <button onClick={() => { setView(selectedOpdracht && sparContext ? 'detail' : 'overzicht'); setSparMessages([]); setGegenereerdeOpdracht(null); setSparContext('') }} className="text-white/50 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">{sparContext ? `Opdracht aanpassen: ${gegenereerdeOpdracht?.titel || ''}` : 'Nieuwe opdracht maken'}</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 160px)' }}>

          {/* Chat links */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-white/50 text-xs uppercase tracking-wider">💬 Spar met AI</span>
              <p className="text-white/30 text-xs mt-0.5">{sparContext ? 'Stel vragen of vraag de AI de opdracht aan te passen.' : 'Vertel wat voor opdracht je wilt maken.'}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sparMessages.length === 0 && !sparContext && (
                <p className="text-white/30 text-sm text-center mt-8">Bijv: "Maak een oefentoets over de Franse Revolutie voor havo 4, 5 vragen"</p>
              )}
              {sparMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user' ? 'bg-blue-600 text-white'
                    : msg.isUpdate ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-white/5 border border-white/10 text-white/80'
                  }`}>
                    {msg.imageUrl && (
                      <img src={msg.imageUrl} alt="geplakt" className="max-h-32 rounded-lg mb-2 border border-white/20" />
                    )}
                    {msg.role === 'assistant' && !msg.isUpdate ? (
                      <ReactMarkdown components={{
                        p: ({children}) => <p className="mb-1 last:mb-0">{children}</p>,
                        strong: ({children}) => <strong className="font-semibold text-white">{children}</strong>,
                        ul: ({children}) => <ul className="list-disc pl-4 space-y-0.5 my-1">{children}</ul>,
                        ol: ({children}) => <ol className="list-decimal pl-4 space-y-0.5 my-1">{children}</ol>,
                        li: ({children}) => <li>{children}</li>,
                        h1: ({children}) => <h1 className="font-bold text-white text-base mb-1">{children}</h1>,
                        h2: ({children}) => <h2 className="font-semibold text-white mb-1">{children}</h2>,
                        h3: ({children}) => <h3 className="font-semibold text-white/90 mb-1">{children}</h3>,
                        code: ({children}) => <code className="bg-white/10 px-1 rounded text-xs">{children}</code>,
                      }}>
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}
              {(sparLoading || uploadingImage) && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-white/40 text-sm">
                    {uploadingImage ? '⬆️ Afbeelding uploaden...' : 'Aan het denken...'}
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {(sparFiles.length > 0 || sparPastedImages.length > 0) && (
              <div className="px-3 pt-2 flex flex-wrap gap-2">
                {sparFiles.map((f, i) => (
                  <div key={`file-${i}`} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-xs text-white/60">
                    📎 {f.name}
                    <button onClick={() => setSparFiles(prev => prev.filter((_, j) => j !== i))} className="ml-1 text-red-400">×</button>
                  </div>
                ))}
                {sparPastedImages.map((p, i) => (
                  <div key={`paste-${i}`} className="relative">
                    <img src={p.previewUrl} alt="geplakt" className="h-16 w-auto rounded border border-white/20 object-cover" />
                    <button onClick={() => setSparPastedImages(prev => prev.filter((_, j) => j !== i))} className="absolute -top-1 -right-1 bg-red-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-xs">×</button>
                  </div>
                ))}
              </div>
            )}
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={e => { if (e.target.files) setSparFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-white/40 hover:text-white/70" title="Bestand uploaden"><Paperclip size={16} /></button>
              <input
                ref={sparInputRef}
                type="text"
                value={sparInput}
                onChange={e => setSparInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSparSend()}
                onPaste={handlePaste}
                placeholder={sparContext ? 'Stel een vraag, plak een afbeelding (Ctrl+V)...' : 'Beschrijf je opdracht of plak een afbeelding...'}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-blue-500/50"
              />
              <button onClick={handleSparSend} disabled={sparLoading || (!sparInput.trim() && sparFiles.length === 0 && sparPastedImages.length === 0)} className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg">
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Preview rechts */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            {/* Header met opslaan knop rechtsboven */}
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-white/50 text-xs uppercase tracking-wider">📋 {sparContext ? 'Huidige opdracht' : 'Gegenereerde opdracht'}</span>
              {gegenereerdeOpdracht && (
                <button onClick={handleOpslaanOpdracht} disabled={opslaan} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-all">
                  {opslaan ? '⏳ Opslaan...' : sparContext ? '💾 Wijzigingen opslaan' : '💾 Opdracht opslaan'}
                </button>
              )}
            </div>
            {!gegenereerdeOpdracht ? (
              <div className="flex-1 flex items-center justify-center text-white/20 text-sm text-center p-8">De opdracht verschijnt hier zodra de AI hem heeft gegenereerd.</div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{gegenereerdeOpdracht.titel}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block border ${getTypeColor(gegenereerdeOpdracht.type)}`}>{gegenereerdeOpdracht.type}</span>
                  <p className="text-white/60 text-sm mt-2">{gegenereerdeOpdracht.beschrijving}</p>
                  <p className="text-white/40 text-xs mt-1">Max punten: {berekenMaxPunten(parseVragen(gegenereerdeOpdracht.vragen))}pt</p>
                </div>
                <div className="space-y-2">
                  {parseVragen(gegenereerdeOpdracht.vragen).map((v: Vraag, i: number) => (
                    <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-white/80 text-sm font-medium">{v.nummer}. {v.vraag}</p>
                        <span className="text-xs text-white/40 shrink-0">{v.punten}pt</span>
                      </div>
                      {v.afbeelding && (
                        <img src={v.afbeelding} alt={`Afbeelding bij vraag ${v.nummer}`} className="mt-2 w-full max-h-36 object-cover rounded-lg border border-white/10" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      )}
                      {v.opties && v.opties.length > 0 && (
                        <ul className="mt-1 space-y-0.5">{v.opties.map((opt, j) => <li key={j} className="text-white/50 text-xs pl-2">• {opt}</li>)}</ul>
                      )}
                      <p className="text-green-400/70 text-xs mt-1">✓ {v.antwoord}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ===== DETAIL VIEW =====
  if (view === 'detail' && selectedOpdracht) {
    const huidigeVragen = editingVragen ? editVragen : parseVragen(selectedOpdracht.vragen)
    const autoMaxPunten = berekenMaxPunten(huidigeVragen)
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setView('overzicht')} className="text-white/50 hover:text-white"><ArrowLeft size={20} /></button>
          {editingTitel ? (
            <input autoFocus value={editTitel} onChange={e => setEditTitel(e.target.value)} onBlur={() => setEditingTitel(false)} className="text-2xl font-bold bg-white/5 border border-blue-500/50 rounded-lg px-3 py-1 text-white outline-none" />
          ) : <h2 className="text-2xl font-bold text-white">{editTitel}</h2>}
          <button onClick={() => setEditingTitel(true)} className="text-white/30 hover:text-white/70"><Pencil size={15} /></button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => handleVervolgSpar(selectedOpdracht)} className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-sm rounded-lg">
              <MessageSquarePlus size={14} /> Spar verder met AI
            </button>
            <button onClick={handleSaveChanges} disabled={saving} className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg">
              <Check size={14} /> {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={() => handleDelete(selectedOpdracht)} className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm rounded-lg">
              <Trash size={14} /> Verwijderen
            </button>
          </div>
        </div>
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-4 flex flex-wrap gap-6 items-start">
          <div className="flex flex-col gap-2">
            <label className="text-white/40 text-xs uppercase tracking-wider">Type</label>
            <div className="flex gap-2 flex-wrap">
              {OPDRACHT_TYPES.map(t => (
                <button key={t} onClick={() => setEditType(t)} className={`px-3 py-1 rounded-lg text-xs border transition-all ${editType === t ? getTypeColor(t) + ' font-semibold' : 'text-white/30 bg-white/5 border-white/10 hover:border-white/30'}`}>{t}</button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2" ref={klasDropdownRef}>
            <label className="text-white/40 text-xs uppercase tracking-wider">Klassen toewijzen</label>
            <div className="relative">
              <button onClick={() => setKlasDropdownOpen(prev => !prev)} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-sm text-white/70 min-w-[200px]">
                <span className="flex-1 text-left">{editKlasIds.length === 0 ? '— Geen klas geselecteerd —' : `${editKlasIds.length} klas${editKlasIds.length > 1 ? 'sen' : ''} geselecteerd`}</span>
                <ChevronDown size={14} className={`transition-transform ${klasDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {klasDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-[#1a1f3d] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                  {klassen.length === 0 ? <div className="px-4 py-3 text-white/30 text-sm">Geen klassen gevonden</div>
                    : klassen.map(k => (
                      <button key={k.id} onClick={() => toggleKlas(k.id)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${editKlasIds.includes(k.id) ? 'bg-blue-600 border-blue-600' : 'border-white/20'}`}>
                          {editKlasIds.includes(k.id) && <Check size={10} className="text-white" />}
                        </div>
                        <div><p className="text-white text-sm">{k.naam}</p><p className="text-white/40 text-xs">{k.vak} — {k.schooljaar}</p></div>
                      </button>
                    ))}
                </div>
              )}
            </div>
            {editKlasIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {editKlasIds.map(kid => {
                  const k = klassen.find(k => k.id === kid)
                  return k ? (
                    <span key={kid} className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded">
                      {k.naam}<button onClick={() => toggleKlas(kid)} className="text-blue-400/60 hover:text-red-400 ml-0.5">×</button>
                    </span>
                  ) : null
                })}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-white/40 text-xs uppercase tracking-wider">Max punten</label>
            <div className="flex items-center gap-1">
              <span className="text-white text-lg font-semibold">{autoMaxPunten}</span>
              <span className="text-white/40 text-sm">pt</span>
            </div>
            <span className="text-white/20 text-xs">Automatisch berekend</span>
          </div>
        </div>
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-white/40 text-xs uppercase tracking-wider">Beschrijving</label>
            <button onClick={() => setEditingBeschrijving(prev => !prev)} className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1">
              <Pencil size={11} /> {editingBeschrijving ? 'Klaar' : 'Bewerken'}
            </button>
          </div>
          {editingBeschrijving ? (
            <textarea value={editBeschrijving} onChange={e => setEditBeschrijving(e.target.value)} rows={3} placeholder="Voeg een beschrijving toe..." className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/20 outline-none focus:border-blue-500/50 resize-none" />
          ) : (
            <p className="text-white/60 text-sm">{editBeschrijving || <span className="text-white/20 italic">Geen beschrijving</span>}</p>
          )}
        </div>
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">{huidigeVragen.length} vragen · {autoMaxPunten}pt totaal</span>
            <button onClick={() => { if (!editingVragen) setEditVragen(parseVragen(selectedOpdracht.vragen)); setEditingVragen(prev => !prev) }} className={`flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-all ${editingVragen ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'text-white/40 bg-white/5 border-white/10 hover:border-white/30'}`}>
              <Pencil size={12} /> {editingVragen ? 'Stoppen met bewerken' : 'Vragen bewerken'}
            </button>
          </div>
          {editingVragen ? (
            <DragDropContext onDragEnd={handleDragEnd}>
              <Droppable droppableId="vragen">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                    {editVragen.map((v, i) => (
                      <Draggable key={`vraag-${i}`} draggableId={`vraag-${i}`} index={i}>
                        {(provided, snapshot) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} className={`bg-white/5 border rounded-lg p-4 space-y-2 transition-all ${snapshot.isDragging ? 'border-blue-500/40 shadow-lg shadow-blue-500/10' : 'border-white/10'}`}>
                            <div className="flex items-start gap-2">
                              <div {...provided.dragHandleProps} className="mt-2 text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing shrink-0">
                                <GripVertical size={16} />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-white/40 text-xs shrink-0">#{v.nummer}</span>
                                  <textarea value={v.vraag} onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, vraag: e.target.value } : q))} className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-blue-500/50 resize-none" rows={2} placeholder="Vraag..." />
                                  <input type="number" min={0} value={v.punten} onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, punten: Number(e.target.value) } : q))} className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-xs text-center outline-none focus:border-blue-500/50" />
                                  <span className="text-white/40 text-xs">pt</span>
                                  <button onClick={() => setEditVragen(prev => prev.filter((_, j) => j !== i).map((q, j) => ({ ...q, nummer: j + 1 })))} className="text-red-400/60 hover:text-red-400"><Trash size={14} /></button>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <span className="text-white/30 text-xs shrink-0">Antwoord:</span>
                                  <input value={v.antwoord} onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, antwoord: e.target.value } : q))} className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-green-400/80 text-xs outline-none focus:border-blue-500/50" placeholder="Modelantwoord..." />
                                </div>
                                <div className="flex items-center gap-2">
                                  {v.afbeelding ? (
                                    <div className="relative inline-block">
                                      <img src={v.afbeelding} alt="vraag afbeelding" className="max-h-20 rounded border border-white/10" />
                                      <button onClick={() => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, afbeelding: undefined } : q))} className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5 text-white hover:text-red-400">
                                        <X size={10} />
                                      </button>
                                    </div>
                                  ) : (
                                    <button onClick={() => vraagAfbeeldingRefs.current[i]?.click()} className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-dashed border-white/20 hover:border-white/40 rounded text-white/30 hover:text-white/60 text-xs">
                                      <Image size={12} /> Afbeelding koppelen
                                    </button>
                                  )}
                                  <input type="file" accept="image/*" className="hidden" ref={el => { vraagAfbeeldingRefs.current[i] = el }} onChange={e => { const f = e.target.files?.[0]; if (f) handleVraagAfbeelding(i, f) }} />
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          ) : (
            <div className="space-y-3">
              {huidigeVragen.map((v, i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-white/80 text-sm font-medium">{v.nummer}. {v.vraag}</p>
                    <span className="text-xs text-white/40 shrink-0">{v.punten}pt</span>
                  </div>
                  {v.afbeelding && (
                    <img src={v.afbeelding} alt="vraag" className="mt-2 w-full max-h-36 object-cover rounded-lg border border-white/10" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                  )}
                  {v.opties && v.opties.length > 0 && <ul className="mt-2 space-y-1">{v.opties.map((opt, j) => <li key={j} className="text-white/50 text-xs pl-2">• {opt}</li>)}</ul>}
                  <p className="text-green-400/70 text-xs mt-2">✓ Antwoord: {v.antwoord}</p>
                  {v.toelichting && <p className="text-white/30 text-xs mt-1">💡 {v.toelichting}</p>}
                </div>
              ))}
            </div>
          )}
          {editingVragen && (
            <div className="flex items-center justify-between">
              <button onClick={() => setEditVragen(prev => [...prev, leegVraag(prev.length + 1)])} className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-dashed border-white/20 hover:border-white/40 text-white/50 hover:text-white/80 text-sm rounded-lg transition-all">
                <Plus size={14} /> Vraag toevoegen
              </button>
              <span className="text-white/40 text-sm">Totaal: <span className="text-white font-semibold">{autoMaxPunten}pt</span></span>
            </div>
          )}
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
          <button onClick={() => { setSparMessages([]); setGegenereerdeOpdracht(null); setSparContext(''); setSelectedOpdracht(null); setView('spar') }} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg">
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
            <button onClick={() => { setSparMessages([]); setGegenereerdeOpdracht(null); setSparContext(''); setSelectedOpdracht(null); setView('spar') }} className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg">
              <Plus size={16} /> Nieuwe opdracht aanmaken
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {opdrachten.map(opdracht => (
            <div key={opdracht.id} onClick={() => { setSelectedOpdracht(opdracht); setView('detail') }} className="bg-[#0f1029] border border-white/10 hover:border-white/20 rounded-xl p-5 cursor-pointer transition-all hover:bg-white/5 group">
              <div className="flex items-start justify-between mb-2">
                <span className={`text-xs px-2 py-0.5 rounded border ${getTypeColor(opdracht.type)}`}>{opdracht.type}</span>
                <span className="text-xs text-white/30">{berekenMaxPunten(parseVragen(opdracht.vragen))}pt</span>
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