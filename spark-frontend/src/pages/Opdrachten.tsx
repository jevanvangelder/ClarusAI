import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  FileText, ArrowLeft, Send, Paperclip, Plus, Trash, Pencil,
  ChevronDown, Check, MessageSquarePlus, Image, X, GripVertical, Calendar, Search, ExternalLink, Flag, Clock
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const OPDRACHT_TYPES = ['huiswerk', 'oefentoets', 'casus', 'opdracht']
const TYPE_COLORS: Record<string, string> = {
  huiswerk:   'text-blue-400 bg-blue-500/10 border-blue-500/20',
  oefentoets: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  casus:      'text-orange-400 bg-orange-500/10 border-orange-500/20',
  opdracht:   'text-green-400 bg-green-500/10 border-green-500/20',
}
const TYPE_FILTER_COLORS: Record<string, string> = {
  huiswerk:   'bg-blue-500/15 border-blue-500/30 text-blue-400',
  oefentoets: 'bg-purple-500/15 border-purple-500/30 text-purple-400',
  casus:      'bg-orange-500/15 border-orange-500/30 text-orange-400',
  opdracht:   'bg-green-500/15 border-green-500/30 text-green-400',
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

interface KlasDeadline {
  class_id: string
  deadline: string
}

interface Opdracht {
  id: string
  titel: string
  beschrijving: string
  type: string
  max_punten: number
  vragen: Vraag[]
  klas_deadlines: KlasDeadline[]
  is_actief: boolean
  created_at: string
  te_beoordelen?: number
}

interface Klas {
  id: string
  name: string
  vak: string | null
  schooljaar: string | null
}

interface SparMessage {
  role: 'user' | 'assistant'
  content: string
  isUpdate?: boolean
  imageUrl?: string
}

type View = 'overzicht' | 'spar' | 'detail'
type TypeFilter = 'alles' | 'huiswerk' | 'oefentoets' | 'casus' | 'opdracht'
type ActiveFilter = 'actief' | 'inactief'

const parseVragen = (vragen: any): Vraag[] => {
  if (!vragen) return []
  if (typeof vragen === 'string') { try { return JSON.parse(vragen) } catch { return [] } }
  if (Array.isArray(vragen)) return vragen
  return []
}
const berekenMaxPunten = (vragen: Vraag[]) => vragen.reduce((acc, v) => acc + (Number(v.punten) || 0), 0)
const leegVraag = (nummer: number): Vraag => ({ nummer, vraag: '', type: 'open', punten: 1, opties: [], antwoord: '', toelichting: '' })

const toDatetimeLocal = (iso: string | null): string => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return '' }
}

function AfbeeldingPreview({ src, className }: { src: string; className?: string }) {
  const [broken, setBroken] = useState(false)
  const isUrl = src.startsWith('http://') || src.startsWith('https://')
  if (broken && isUrl) {
    return (
      <a href={src} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 mt-1">
        <ExternalLink size={11} />
        Afbeelding bekijken (externe link)
      </a>
    )
  }
  return (
    <img src={src} alt="Vraag afbeelding"
      className={className || 'mt-2 w-full max-h-48 object-contain rounded-lg border border-white/10 bg-white/5'}
      onError={() => setBroken(true)} />
  )
}

export default function Opdrachten() {
  const { role, user } = useAuth()
  const [view, setView] = useState<View>('overzicht')
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([])
  const [selectedOpdracht, setSelectedOpdracht] = useState<Opdracht | null>(null)
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [zoekterm, setZoekterm] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('alles')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('actief')

  const [editTitel, setEditTitel] = useState('')
  const [editBeschrijving, setEditBeschrijving] = useState('')
  const [editType, setEditType] = useState('')
  const [editKlasDeadlines, setEditKlasDeadlines] = useState<KlasDeadline[]>([])
  const [editingTitel, setEditingTitel] = useState(false)
  const [editingBeschrijving, setEditingBeschrijving] = useState(false)
  const [editingVragen, setEditingVragen] = useState(false)
  const [editVragen, setEditVragen] = useState<Vraag[]>([])
  const [saving, setSaving] = useState(false)
  const [klasDropdownOpen, setKlasDropdownOpen] = useState(false)
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
  const sparInputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [sparMessages])

  const fetchOpdrachten = async () => {
    if (!user) return
    // Haal alle opdrachten op (actief én inactief) zodat we kunnen filteren
    const { data, error } = await supabase
      .from('assignments')
      .select(`id, title, beschrijving, type, max_punten, vragen, is_active, created_at, assignment_classes(class_id, deadline)`)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })
    if (error) { console.error('fetchOpdrachten error:', error); return }

    const basis = (data || []).map((o: any) => ({
      id: o.id,
      titel: o.title,
      beschrijving: o.beschrijving || '',
      type: o.type || 'opdracht',
      max_punten: o.max_punten || 0,
      vragen: parseVragen(o.vragen),
      is_actief: o.is_active,
      created_at: o.created_at,
      klas_deadlines: (o.assignment_classes || []).map((ac: any) => ({
        class_id: ac.class_id,
        deadline: ac.deadline ? toDatetimeLocal(ac.deadline) : '',
      })),
      te_beoordelen: 0,
    }))

    // Haal te_beoordelen per opdracht op
    const opdrachtIds = basis.map(o => o.id)
    if (opdrachtIds.length > 0) {
      const { data: subs } = await supabase
        .from('assignment_submissions')
        .select('assignment_id')
        .in('assignment_id', opdrachtIds)
        .eq('ai_nakijk_status', 'done')
        .not('ingeleverd_op', 'is', null)

      const telMap: Record<string, number> = {}
      ;(subs || []).forEach(s => { telMap[s.assignment_id] = (telMap[s.assignment_id] || 0) + 1 })
      basis.forEach(o => { o.te_beoordelen = telMap[o.id] || 0 })
    }

    setOpdrachten(basis)
  }

  const fetchKlassen = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('classes')
      .select('id, name, vak, schooljaar')
      .eq('created_by', user.id)
      .eq('is_active', true)
      .order('name', { ascending: true })
    if (error) { console.error('fetchKlassen error:', error); return }
    setKlassen(data || [])
  }

  useEffect(() => {
    if (user) { fetchOpdrachten(); fetchKlassen() }
  }, [user])

  useEffect(() => {
    if (selectedOpdracht) {
      setEditTitel(selectedOpdracht.titel)
      setEditBeschrijving(selectedOpdracht.beschrijving || '')
      setEditType(selectedOpdracht.type || 'opdracht')
      setEditKlasDeadlines(selectedOpdracht.klas_deadlines || [])
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

  const toggleKlas = (id: string) => {
    setEditKlasDeadlines(prev => {
      const exists = prev.find(kd => kd.class_id === id)
      if (exists) return prev.filter(kd => kd.class_id !== id)
      return [...prev, { class_id: id, deadline: '' }]
    })
  }

  const clearDeadlineForKlas = (class_id: string) => {
    setEditKlasDeadlines(prev =>
      prev.map(kd => kd.class_id === class_id ? { ...kd, deadline: '' } : kd)
    )
  }

  const setDeadlineForKlas = (class_id: string, deadline: string) => {
    setEditKlasDeadlines(prev =>
      prev.map(kd => kd.class_id === class_id ? { ...kd, deadline } : kd)
    )
  }

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
      const { error: assignErr } = await supabase
        .from('assignments')
        .update({ title: editTitel, beschrijving: editBeschrijving, type: editType, max_punten: autoMaxPunten, vragen: vragenToSave })
        .eq('id', selectedOpdracht.id)
      if (assignErr) throw assignErr
      await supabase.from('assignment_classes').delete().eq('assignment_id', selectedOpdracht.id)
      if (editKlasDeadlines.length > 0) {
        const { error: acErr } = await supabase.from('assignment_classes').insert(
          editKlasDeadlines.map(kd => ({
            assignment_id: selectedOpdracht.id,
            class_id: kd.class_id,
            deadline: kd.deadline ? new Date(kd.deadline).toISOString() : null,
          }))
        )
        if (acErr) throw acErr
      }
      toast.success('Opdracht opgeslagen!')
      setEditingTitel(false); setEditingVragen(false); setEditingBeschrijving(false)
      await fetchOpdrachten()
      const { data: updated } = await supabase
        .from('assignments')
        .select('id, title, beschrijving, type, max_punten, vragen, is_active, created_at, assignment_classes(class_id, deadline)')
        .eq('id', selectedOpdracht.id)
        .single()
      if (updated) {
        setSelectedOpdracht({
          id: updated.id,
          titel: updated.title,
          beschrijving: updated.beschrijving || '',
          type: updated.type || 'opdracht',
          max_punten: updated.max_punten || 0,
          vragen: parseVragen(updated.vragen),
          is_actief: updated.is_active,
          created_at: updated.created_at,
          klas_deadlines: (updated.assignment_classes || []).map((ac: any) => ({
            class_id: ac.class_id,
            deadline: ac.deadline ? toDatetimeLocal(ac.deadline) : '',
          })),
        })
      }
    } catch (err: any) {
      console.error('handleSaveChanges error:', err)
      toast.error(err.message || 'Opslaan mislukt')
    } finally {
      setSaving(false)
    }
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
    const idx = text.indexOf(PREFIX)
    if (idx !== -1) {
      try {
        const jsonStr = text.slice(idx + PREFIX.length).trim()
        const parsed = JSON.parse(jsonStr)
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
    if (sparInputRef.current) sparInputRef.current.style.height = 'auto'
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
        const { error } = await supabase
          .from('assignments')
          .update({ title: gegenereerdeOpdracht.titel, beschrijving: gegenereerdeOpdracht.beschrijving, type: gegenereerdeOpdracht.type || 'opdracht', max_punten: autoMaxPunten, vragen })
          .eq('id', selectedOpdracht.id)
          .select()
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('assignments')
          .insert({ title: gegenereerdeOpdracht.titel, beschrijving: gegenereerdeOpdracht.beschrijving || '', type: gegenereerdeOpdracht.type || 'opdracht', max_punten: autoMaxPunten, vragen, created_by: user.id, is_active: true })
          .select()
        if (error) throw error
      }
      toast.success('Opdracht opgeslagen!')
      setSparMessages([])
      setGegenereerdeOpdracht(null)
      setSparContext('')
      await fetchOpdrachten()
      setView(selectedOpdracht && sparContext ? 'detail' : 'overzicht')
    } catch (err: any) {
      toast.error('Fout: ' + (err?.message || JSON.stringify(err)))
    } finally {
      setOpslaan(false)
    }
  }

  const handleDelete = async (opdracht: Opdracht) => {
    if (!confirm(`Weet je zeker dat je "${opdracht.titel}" wilt verwijderen?`)) return
    const { error } = await supabase.from('assignments').update({ is_active: false }).eq('id', opdracht.id)
    if (error) { toast.error('Verwijderen mislukt'); return }
    toast.success('Opdracht gearchiveerd')
    await fetchOpdrachten()
    setView('overzicht')
  }

  const eerstvolgendeDeadline = (kd: KlasDeadline[]) => {
    const toekomstig = kd.filter(d => d.deadline).map(d => new Date(d.deadline)).filter(d => d > new Date())
    if (toekomstig.length === 0) return null
    return new Date(Math.min(...toekomstig.map(d => d.getTime())))
  }

  // ═══════════════════════════════
  // SPAR VIEW
  // ═══════════════════════════════
  if (view === 'spar') {
    return (
      <div className="flex flex-col h-full space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setView(selectedOpdracht && sparContext ? 'detail' : 'overzicht'); setSparMessages([]); setGegenereerdeOpdracht(null); setSparContext('') }}
            className="text-white/50 hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-2xl font-bold text-white">
            {sparContext ? `Opdracht aanpassen: ${gegenereerdeOpdracht?.titel || ''}` : 'Nieuwe opdracht maken'}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 160px)' }}>
          {/* Chat links */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-white/50 text-xs uppercase tracking-wider">💬 Spar met AI</span>
              <p className="text-white/30 text-xs mt-0.5">
                {sparContext ? 'Stel vragen of vraag de AI de opdracht aan te passen.' : 'Vertel wat voor opdracht je wilt maken.'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sparMessages.length === 0 && !sparContext && (
                <p className="text-white/30 text-sm text-center mt-8">
                  Bijv: "Maak een oefentoets over de Franse Revolutie voor havo 4, 5 vragen"
                </p>
              )}
              {sparMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user' ? 'bg-blue-600 text-white'
                    : msg.isUpdate ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                    : 'bg-white/5 border border-white/10 text-white/80'
                  }`}>
                    {msg.imageUrl && <img src={msg.imageUrl} alt="geplakt" className="max-h-32 rounded-lg mb-2 border border-white/20" />}
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
                    ) : <span>{msg.content}</span>}
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
            <div className="p-3 border-t border-white/10 flex gap-2 items-end">
              <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*"
                onChange={e => { if (e.target.files) setSparFiles(prev => [...prev, ...Array.from(e.target.files!)]) }} />
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-white/40 hover:text-white/70 mb-0.5" title="Bestand uploaden">
                <Paperclip size={16} />
              </button>
              <textarea
                ref={sparInputRef}
                rows={1}
                value={sparInput}
                onChange={e => {
                  setSparInput(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 5 * 24) + 'px'
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSparSend() }
                }}
                onPaste={handlePaste}
                placeholder={sparContext ? 'Stel een vraag, plak een afbeelding (Ctrl+V)...' : 'Beschrijf je opdracht of plak een afbeelding...'}
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-blue-500/50 resize-none overflow-y-auto"
                style={{ height: 'auto', lineHeight: '24px' }}
              />
              <button
                onClick={handleSparSend}
                disabled={sparLoading || (!sparInput.trim() && sparFiles.length === 0 && sparPastedImages.length === 0)}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all mb-0.5"
              >
                <Send size={16} />
              </button>
            </div>
          </div>

          {/* Preview rechts */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
              <span className="text-white/50 text-xs uppercase tracking-wider">
                📋 {sparContext ? 'Huidige opdracht' : 'Gegenereerde opdracht'}
              </span>
              {gegenereerdeOpdracht && (
                <button
                  onClick={handleOpslaanOpdracht}
                  disabled={opslaan}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-all"
                >
                  {opslaan ? '⏳ Opslaan...' : sparContext ? '💾 Wijzigingen opslaan' : '💾 Opdracht opslaan'}
                </button>
              )}
            </div>
            {!gegenereerdeOpdracht ? (
              <div className="flex-1 flex items-center justify-center text-white/20 text-sm text-center p-8">
                De opdracht verschijnt hier zodra de AI hem heeft gegenereerd.
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div>
                  <h3 className="text-white font-bold text-lg">{gegenereerdeOpdracht.titel}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block border ${getTypeColor(gegenereerdeOpdracht.type)}`}>
                    {gegenereerdeOpdracht.type}
                  </span>
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
                      {v.afbeelding && <AfbeeldingPreview src={v.afbeelding} />}
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

  // ═══════════════════════════════
  // DETAIL VIEW
  // ═══════════════════════════════
  if (view === 'detail' && selectedOpdracht) {
    const huidigeVragen = editingVragen ? editVragen : parseVragen(selectedOpdracht.vragen)
    const autoMaxPunten = berekenMaxPunten(huidigeVragen)
    const geselecteerdeKlasIds = editKlasDeadlines.map(kd => kd.class_id)

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => setView('overzicht')} className="text-white/50 hover:text-white">
            <ArrowLeft size={20} />
          </button>
          {editingTitel ? (
            <input autoFocus value={editTitel} onChange={e => setEditTitel(e.target.value)}
              onBlur={() => setEditingTitel(false)}
              className="text-2xl font-bold bg-white/5 border border-blue-500/50 rounded-lg px-3 py-1 text-white outline-none" />
          ) : <h2 className="text-2xl font-bold text-white">{editTitel}</h2>}
          <button onClick={() => setEditingTitel(true)} className="text-white/30 hover:text-white/70">
            <Pencil size={15} />
          </button>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => handleVervolgSpar(selectedOpdracht)}
              className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-400 text-sm rounded-lg transition-all">
              <MessageSquarePlus size={14} /> Spar verder met AI
            </button>
            <button onClick={handleSaveChanges} disabled={saving}
              className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm rounded-lg">
              <Check size={14} /> {saving ? 'Opslaan...' : 'Opslaan'}
            </button>
            <button onClick={() => handleDelete(selectedOpdracht)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm rounded-lg transition-all">
              <Trash size={14} /> Verwijderen
            </button>
          </div>
        </div>

        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-4 space-y-4">
          <div className="flex flex-wrap gap-6 items-start">
            <div className="flex flex-col gap-2">
              <label className="text-white/40 text-xs uppercase tracking-wider">Type</label>
              <div className="flex gap-2 flex-wrap">
                {OPDRACHT_TYPES.map(t => (
                  <button key={t} onClick={() => setEditType(t)}
                    className={`px-3 py-1 rounded-lg text-xs border transition-all ${editType === t ? getTypeColor(t) + ' font-semibold' : 'text-white/30 border-white/10 hover:border-white/20'}`}>
                    {t}
                  </button>
                ))}
              </div>
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

          <div>
            <label className="text-white/40 text-xs uppercase tracking-wider block mb-2">Klassen toewijzen</label>
            <div className="relative">
              {klasDropdownOpen && (
                <div className="fixed inset-0 z-40" onClick={() => setKlasDropdownOpen(false)} />
              )}
              <button
                onClick={() => setKlasDropdownOpen(prev => !prev)}
                className="relative z-50 flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 hover:border-white/20 rounded-lg text-sm text-white/70 min-w-[240px] transition-all"
              >
                <span className="flex-1 text-left">
                  {geselecteerdeKlasIds.length === 0 ? '— Selecteer klassen —'
                    : `${geselecteerdeKlasIds.length} klas${geselecteerdeKlasIds.length > 1 ? 'sen' : ''} geselecteerd`}
                </span>
                <ChevronDown size={14} className={`transition-transform ${klasDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {klasDropdownOpen && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-[#1a1f3d] border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                  {klassen.length === 0 ? (
                    <div className="px-4 py-3 text-white/30 text-sm">Geen klassen gevonden</div>
                  ) : klassen.map(k => (
                    <button key={k.id} onClick={() => toggleKlas(k.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 text-left transition-colors">
                      <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${geselecteerdeKlasIds.includes(k.id) ? 'bg-blue-600 border-blue-600' : 'border-white/20'}`}>
                        {geselecteerdeKlasIds.includes(k.id) && <Check size={10} className="text-white" />}
                      </div>
                      <div>
                        <p className="text-white text-sm">{k.name}</p>
                        <p className="text-white/40 text-xs">{k.vak}{k.schooljaar ? ` — ${k.schooljaar}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {editKlasDeadlines.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-white/30 text-xs">Stel per klas een deadline in (optioneel):</p>
                {editKlasDeadlines.map(kd => {
                  const klas = klassen.find(k => k.id === kd.class_id)
                  if (!klas) return null
                  return (
                    <div key={kd.class_id} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{klas.name}</p>
                        {klas.vak && <p className="text-white/40 text-xs">{klas.vak}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Calendar size={13} className="text-white/30" />
                        <input
                          type="datetime-local"
                          value={kd.deadline}
                          onChange={e => setDeadlineForKlas(kd.class_id, e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-blue-500/50"
                        />
                        {kd.deadline && (
                          <button onClick={() => clearDeadlineForKlas(kd.class_id)} title="Deadline wissen" className="text-white/30 hover:text-white/60 transition-colors">
                            <X size={13} />
                          </button>
                        )}
                        <button onClick={() => toggleKlas(kd.class_id)} title="Klas verwijderen uit selectie" className="text-red-400/50 hover:text-red-400 transition-colors ml-1">
                          <Trash size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-white/40 text-xs uppercase tracking-wider">Beschrijving</label>
            <button onClick={() => setEditingBeschrijving(prev => !prev)}
              className="text-white/30 hover:text-white/60 text-xs flex items-center gap-1">
              <Pencil size={11} /> {editingBeschrijving ? 'Klaar' : 'Bewerken'}
            </button>
          </div>
          {editingBeschrijving ? (
            <textarea value={editBeschrijving} onChange={e => setEditBeschrijving(e.target.value)}
              rows={3} placeholder="Voeg een beschrijving toe..."
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-blue-500/50 resize-none" />
          ) : (
            <p className="text-white/60 text-sm">{editBeschrijving || <span className="text-white/20 italic">Geen beschrijving</span>}</p>
          )}
        </div>

        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-white/60 text-sm">{huidigeVragen.length} vragen · {autoMaxPunten}pt totaal</span>
            <button
              onClick={() => { if (!editingVragen) setEditVragen(parseVragen(selectedOpdracht.vragen)); setEditingVragen(prev => !prev) }}
              className={`flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg border transition-all ${editingVragen ? 'bg-white/10 border-white/20 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}>
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
                          <div ref={provided.innerRef} {...provided.draggableProps}
                            className={`bg-white/5 border rounded-lg p-4 space-y-2 transition-all ${snapshot.isDragging ? 'border-blue-500/50 shadow-lg' : 'border-white/10'}`}>
                            <div className="flex items-start gap-2">
                              <div {...provided.dragHandleProps} className="mt-2 text-white/20 hover:text-white/50 cursor-grab active:cursor-grabbing shrink-0">
                                <GripVertical size={16} />
                              </div>
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-white/40 text-xs shrink-0">#{v.nummer}</span>
                                  <textarea value={v.vraag}
                                    onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, vraag: e.target.value } : q))}
                                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm resize-none outline-none focus:border-blue-500/50 min-h-[36px]" rows={2} />
                                  <input type="number" min={0} value={v.punten}
                                    onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, punten: Number(e.target.value) } : q))}
                                    className="w-14 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none text-center" />
                                  <span className="text-white/40 text-xs">pt</span>
                                  <button onClick={() => setEditVragen(prev => prev.filter((_, j) => j !== i).map((q, j) => ({ ...q, nummer: j + 1 })))}
                                    className="text-red-400/60 hover:text-red-400 transition-colors">
                                    <Trash size={14} />
                                  </button>
                                </div>
                                <div className="flex gap-2 items-center">
                                  <span className="text-white/30 text-xs shrink-0">Antwoord:</span>
                                  <input value={v.antwoord}
                                    onChange={e => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, antwoord: e.target.value } : q))}
                                    className="flex-1 bg-white/5 border border-white/10 rounded px-2 py-1 text-white text-sm outline-none focus:border-green-500/50" />
                                </div>
                                <div className="space-y-1.5">
                                  {v.afbeelding ? (
                                    <div className="space-y-1.5">
                                      <AfbeeldingPreview src={v.afbeelding} className="max-h-40 w-auto max-w-full rounded-lg border border-white/10 object-contain bg-white/5" />
                                      {(v.afbeelding.startsWith('http://') || v.afbeelding.startsWith('https://')) && (
                                        <a href={v.afbeelding} target="_blank" rel="noopener noreferrer"
                                          className="flex items-center gap-1 text-xs text-blue-400/60 hover:text-blue-400 truncate max-w-xs">
                                          <ExternalLink size={10} />
                                          <span className="truncate">{v.afbeelding}</span>
                                        </a>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <button onClick={() => vraagAfbeeldingRefs.current[i]?.click()}
                                          className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-white/20 hover:border-white/40 rounded text-white/40 hover:text-white/70 text-xs transition-all">
                                          <Image size={11} /> Vervangen
                                        </button>
                                        <button onClick={() => setEditVragen(prev => prev.map((q, j) => j === i ? { ...q, afbeelding: undefined } : q))}
                                          className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 hover:border-red-500/40 rounded text-red-400/60 hover:text-red-400 text-xs transition-all">
                                          <X size={11} /> Verwijderen
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button onClick={() => vraagAfbeeldingRefs.current[i]?.click()}
                                      className="flex items-center gap-1 px-2 py-1 bg-white/5 border border-dashed border-white/20 hover:border-white/40 rounded text-white/40 hover:text-white/70 text-xs transition-all">
                                      <Image size={12} /> Afbeelding koppelen
                                    </button>
                                  )}
                                  <input type="file" accept="image/*" className="hidden"
                                    ref={el => { vraagAfbeeldingRefs.current[i] = el }}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleVraagAfbeelding(i, f) }} />
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
                    <div className="mt-2 space-y-1">
                      <AfbeeldingPreview src={v.afbeelding} className="w-full max-h-48 object-contain rounded-lg border border-white/10 bg-white/5" />
                      {(v.afbeelding.startsWith('http://') || v.afbeelding.startsWith('https://')) && (
                        <a href={v.afbeelding} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400/50 hover:text-blue-400 truncate max-w-xs">
                          <ExternalLink size={10} />
                          <span className="truncate">{v.afbeelding}</span>
                        </a>
                      )}
                    </div>
                  )}
                  {v.opties && v.opties.length > 0 && (
                    <ul className="mt-2 space-y-1">{v.opties.map((opt, j) => <li key={j} className="text-white/50 text-xs pl-2">• {opt}</li>)}</ul>
                  )}
                  <p className="text-green-400/70 text-xs mt-2">✓ Antwoord: {v.antwoord}</p>
                  {v.toelichting && <p className="text-white/30 text-xs mt-1">💡 {v.toelichting}</p>}
                </div>
              ))}
            </div>
          )}

          {editingVragen && (
            <div className="flex items-center justify-between">
              <button onClick={() => setEditVragen(prev => [...prev, leegVraag(prev.length + 1)])}
                className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-dashed border-white/20 hover:border-white/40 rounded-lg text-white/50 hover:text-white text-sm transition-all">
                <Plus size={14} /> Vraag toevoegen
              </button>
              <span className="text-white/40 text-sm">Totaal: <span className="text-white font-semibold">{autoMaxPunten}pt</span></span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ═══════════════════════════════
  // OVERZICHT
  // ═══════════════════════════════
  const actieveOpdrachten = opdrachten.filter(o => o.is_actief)
  const inactieveOpdrachten = opdrachten.filter(o => !o.is_actief)
  const huidigeLijst = activeFilter === 'actief' ? actieveOpdrachten : inactieveOpdrachten

  const beschikbareTypes = OPDRACHT_TYPES.filter(t => huidigeLijst.some(o => o.type === t))

  const gefilterdeOpdrachten = huidigeLijst.filter(o => {
    const matchType = typeFilter === 'alles' || o.type === typeFilter
    const term = zoekterm.toLowerCase().trim()
    const matchZoek = !term || (
      o.titel.toLowerCase().includes(term) ||
      o.beschrijving.toLowerCase().includes(term) ||
      o.type.toLowerCase().includes(term) ||
      o.klas_deadlines.some(kd => {
        const k = klassen.find(k => k.id === kd.class_id)
        return k?.name.toLowerCase().includes(term) || k?.vak?.toLowerCase().includes(term)
      })
    )
    return matchType && matchZoek
  })

  const totaalTeBeoordelenActief = actieveOpdrachten.reduce((sum, o) => sum + (o.te_beoordelen || 0), 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
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
            onClick={() => { setSparMessages([]); setGegenereerdeOpdracht(null); setSparContext(''); setSelectedOpdracht(null); setView('spar') }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all whitespace-nowrap">
            <Plus size={16} /> Nieuwe opdracht aanmaken
          </button>
        )}
      </div>

      {/* Te beoordelen banner */}
      {totaalTeBeoordelenActief > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Flag size={15} className="text-amber-400 shrink-0" />
            <p className="text-amber-400 text-sm">
              <span className="font-semibold">{totaalTeBeoordelenActief} inzending{totaalTeBeoordelenActief !== 1 ? 'en' : ''}</span> wacht{totaalTeBeoordelenActief === 1 ? '' : 'en'} op beoordeling
            </p>
          </div>
          <button onClick={() => { /* navigate to analyse */ }} className="text-amber-400/70 hover:text-amber-400 text-xs underline underline-offset-2 transition-colors shrink-0">
            Bekijk in Analyse →
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Actief / Inactief tabs */}
        <div className="flex items-center bg-white/5 border border-white/10 rounded-lg p-0.5">
          <button
            onClick={() => { setActiveFilter('actief'); setTypeFilter('alles') }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeFilter === 'actief' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Actief
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeFilter === 'actief' ? 'bg-blue-500/30 text-blue-300' : 'bg-white/10 text-white/30'}`}>
              {actieveOpdrachten.length}
            </span>
          </button>
          <button
            onClick={() => { setActiveFilter('inactief'); setTypeFilter('alles') }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeFilter === 'inactief' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
            }`}
          >
            Archief
            <span className={`px-1.5 py-0.5 rounded-full text-xs ${activeFilter === 'inactief' ? 'bg-white/20 text-white/60' : 'bg-white/10 text-white/30'}`}>
              {inactieveOpdrachten.length}
            </span>
          </button>
        </div>

        {/* Type filters */}
        {beschikbareTypes.length > 0 && (
          <>
            <div className="w-px h-5 bg-white/10" />
            <button
              onClick={() => setTypeFilter('alles')}
              className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                typeFilter === 'alles'
                  ? 'bg-white/15 border-white/25 text-white'
                  : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
              }`}
            >
              Alle soorten
            </button>
            {beschikbareTypes.map(t => (
              <button key={t} onClick={() => setTypeFilter(t as TypeFilter)}
                className={`px-3 py-1.5 rounded-lg border text-xs transition-all ${
                  typeFilter === t ? TYPE_FILTER_COLORS[t] : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white/60'
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </>
        )}

        {/* Zoekbalk */}
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={zoekterm}
            onChange={e => setZoekterm(e.target.value)}
            placeholder="Zoek opdracht..."
            className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50 w-52"
          />
          {zoekterm && (
            <button onClick={() => setZoekterm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Lijst */}
      {opdrachten.length === 0 ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <FileText size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nog geen opdrachten</h3>
          <p className="text-white/40 text-sm max-w-sm">Opdrachten worden hier weergegeven zodra ze zijn aangemaakt.</p>
          {(role === 'teacher' || role === 'school_admin' || role === 'admin') && (
            <button
              onClick={() => { setSparMessages([]); setGegenereerdeOpdracht(null); setSparContext(''); setSelectedOpdracht(null); setView('spar') }}
              className="mt-6 flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all">
              <Plus size={16} /> Nieuwe opdracht aanmaken
            </button>
          )}
        </div>
      ) : gefilterdeOpdrachten.length === 0 ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-4">
            <Search size={24} className="text-white/30" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Geen opdrachten gevonden</h3>
          <p className="text-white/40 text-sm">Probeer een andere zoekterm of filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {gefilterdeOpdrachten.map(opdracht => {
            const deadline = eerstvolgendeDeadline(opdracht.klas_deadlines)
            const aantalKlassen = opdracht.klas_deadlines.length
            const teBeoor = opdracht.te_beoordelen || 0
            return (
              <div key={opdracht.id}
                onClick={() => { setSelectedOpdracht(opdracht); setView('detail') }}
                className={`bg-[#0f1029] border rounded-xl p-5 cursor-pointer transition-all group space-y-2 ${
                  !opdracht.is_actief ? 'border-white/5 opacity-60 hover:opacity-80' : 'border-white/10 hover:border-white/20'
                }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded border ${getTypeColor(opdracht.type)}`}>{opdracht.type}</span>
                    {!opdracht.is_actief && (
                      <span className="text-xs px-2 py-0.5 rounded border text-white/30 bg-white/5 border-white/10">archief</span>
                    )}
                  </div>
                  <span className="text-xs text-white/30 shrink-0">{berekenMaxPunten(parseVragen(opdracht.vragen))}pt</span>
                </div>
                <h3 className="text-white font-semibold">{opdracht.titel}</h3>
                <p className="text-white/40 text-xs line-clamp-2">{opdracht.beschrijving}</p>
                <p className="text-white/20 text-xs">{parseVragen(opdracht.vragen).length} vragen</p>

                {/* Te beoordelen badge */}
                {teBeoor > 0 && (
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs">
                    <Flag size={11} />
                    <span>{teBeoor} te beoordelen</span>
                  </div>
                )}

                {aantalKlassen > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {opdracht.klas_deadlines.slice(0, 3).map(kd => {
                      const k = klassen.find(k => k.id === kd.class_id)
                      return k ? (
                        <span key={kd.class_id} className="text-xs text-blue-400/60 bg-blue-500/5 border border-blue-500/10 px-1.5 py-0.5 rounded">
                          📚 {k.name}
                        </span>
                      ) : null
                    })}
                    {aantalKlassen > 3 && <span className="text-xs text-white/30 px-1.5 py-0.5">+{aantalKlassen - 3} meer</span>}
                  </div>
                )}

                {deadline && (
                  <p className="text-amber-400/70 text-xs flex items-center gap-1">
                    <Clock size={11} />
                    {deadline.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} · {deadline.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <div className="pt-1 text-white/20 text-xs group-hover:text-white/40 transition-colors">Klik om te openen →</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}