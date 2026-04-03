import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { BookOpen, ArrowLeft, Send, Pencil, Trash, Search, X, LogIn, MoreVertical, GraduationCap } from 'lucide-react'
import { ModuleModal } from '@/components/modulemodal'
import { fetchModules, createModule, updateModule, deleteModule } from '@/services/api'
import { supabase } from '@/lib/supabase'
import type { Module } from '@/types/module'
import { toast } from 'sonner'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface TestMessage {
  role: 'user' | 'assistant'
  content: string
}

interface Vak {
  id: string
  name: string
  vak: string | null
  docent_naam: string | null
  schooljaar: string | null
  created_by: string
  eigen_titel: string | null
}

export default function Modules() {
  const { role, user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)

  // Vakken (voor studenten)
  const [vakken, setVakken] = useState<Vak[]>([])
  const [vakkenLoading, setVakkenLoading] = useState(true)
  const [zoekterm, setZoekterm] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  // Three-dots menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Naam wijzigen modal
  const [naamModalOpen, setNaamModalOpen] = useState(false)
  const [selectedVakForNaam, setSelectedVakForNaam] = useState<Vak | null>(null)
  const [nieuweNaam, setNieuweNaam] = useState('')
  const [savingNaam, setSavingNaam] = useState(false)

  // Verlaten bevestiging
  const [verlatenId, setVerlatenId] = useState<string | null>(null)

  // Test chat state
  const [testMessages, setTestMessages] = useState<TestMessage[]>([])
  const [testInput, setTestInput] = useState('')
  const [testLoading, setTestLoading] = useState(false)

  // Sluit menu bij klik buiten
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Vakken ophalen via mijn_klassen view (eigen_titel komt mee via LEFT JOIN)
  const fetchVakken = async () => {
    if (!user) return
    setVakkenLoading(true)
    try {
      const { data, error } = await supabase
        .from('mijn_klassen')
        .select('id, name, vak, docent_naam, schooljaar, created_by, eigen_titel')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVakken(data || [])
    } catch (err) {
      console.error('Fout bij ophalen vakken:', err)
      toast.error('Kon vakken niet laden')
    } finally {
      setVakkenLoading(false)
    }
  }

  // Modules ophalen (voor teachers/admins)
  useEffect(() => {
    if (!user) return
    if (role === 'student') {
      fetchVakken()
    } else {
      fetchModules(user.id).then((data: any[]) => {
        setModules(data.map((m) => ({
          id: m.id,
          title: m.name,
          icon: m.icon || '📦',
          prompt: m.system_prompt,
          enabled: m.is_active,
          createdAt: new Date(m.created_at).getTime(),
        })))
      })
    }
  }, [user, role])

  // Student: deelnemen via klascode
  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) { setJoinError('Voer een klascode in'); return }

    setJoining(true)
    setJoinError(null)

    try {
      const { data, error } = await supabase.rpc('join_class_by_code', {
        p_code: joinCode.trim()
      })

      if (error) throw error

      const result = data as { success: boolean; error?: string; class_name?: string }
      if (!result.success) {
        setJoinError(result.error || 'Onbekende fout')
        return
      }

      toast.success(`Je hebt deelgenomen aan ${result.class_name}!`)
      setJoinCode('')
      fetchVakken()
    } catch (err: any) {
      setJoinError(err.message || 'Fout bij deelnemen')
    } finally {
      setJoining(false)
    }
  }

  // Student: klas verlaten
  const handleVerlaten = async (klasId: string) => {
    try {
      const { error } = await supabase
        .from('class_members')
        .delete()
        .eq('class_id', klasId)
        .eq('student_id', user!.id)

      if (error) throw error

      // Verwijder ook de eigen instellingen voor dit vak
      await supabase
        .from('student_vak_instellingen')
        .delete()
        .eq('class_id', klasId)
        .eq('student_id', user!.id)

      toast.success('Je hebt het vak verlaten')
      setVerlatenId(null)
      fetchVakken()
    } catch (err: any) {
      toast.error(err.message || 'Fout bij verlaten vak')
    }
  }

  // Student: eigen titel opslaan in Supabase
  const handleSaveNaam = async () => {
    if (!selectedVakForNaam || !user) return
    if (!nieuweNaam.trim()) { toast.error('Naam mag niet leeg zijn'); return }

    setSavingNaam(true)
    try {
      const { error } = await supabase
        .from('student_vak_instellingen')
        .upsert({
          student_id: user.id,
          class_id: selectedVakForNaam.id,
          eigen_titel: nieuweNaam.trim(),
        }, {
          onConflict: 'student_id,class_id'
        })

      if (error) throw error

      toast.success('Eigen naam opgeslagen!')
      setNaamModalOpen(false)
      setSelectedVakForNaam(null)
      setNieuweNaam('')
      fetchVakken()
    } catch (err: any) {
      toast.error(err.message || 'Fout bij opslaan naam')
    } finally {
      setSavingNaam(false)
    }
  }

  // Gefilterde vakken
  const gefilterdeVakken = vakken.filter((vak) => {
    const term = zoekterm.toLowerCase().trim()
    if (!term) return true
    return (
      (vak.eigen_titel || vak.name).toLowerCase().includes(term) ||
      vak.vak?.toLowerCase().includes(term) ||
      vak.docent_naam?.toLowerCase().includes(term)
    )
  })

  // Teacher/Admin module handlers
  const handleSave = async (data: Omit<Module, 'id' | 'createdAt' | 'enabled'>) => {
    if (!user) return
    if (editingModule) {
      const updated = await updateModule(editingModule.id, {
        name: data.title,
        icon: data.icon,
        system_prompt: data.prompt,
      })
      setModules(prev => prev.map(m => m.id === editingModule.id ? {
        ...m, title: updated.name, icon: updated.icon, prompt: updated.system_prompt
      } : m))
      if (selectedModule?.id === editingModule.id) {
        setSelectedModule(prev => prev ? { ...prev, title: updated.name, icon: updated.icon, prompt: updated.system_prompt } : null)
      }
    } else {
      const created = await createModule(user.id, data.title, data.prompt, data.icon)
      setModules(prev => [...prev, {
        id: created.id,
        title: created.name,
        icon: created.icon || '📦',
        prompt: created.system_prompt,
        enabled: created.is_active,
        createdAt: new Date(created.created_at).getTime(),
      }])
    }
    setEditingModule(null)
  }

  const handleDelete = async (mod: Module) => {
    if (!confirm(`Weet je zeker dat je "${mod.title}" wilt verwijderen?`)) return
    await deleteModule(mod.id)
    setModules(prev => prev.filter(m => m.id !== mod.id))
    if (selectedModule?.id === mod.id) setSelectedModule(null)
  }

  const handleSelectModule = (mod: Module) => {
    setSelectedModule(mod)
    setTestMessages([])
    setTestInput('')
  }

  const handleTestSend = async () => {
    if (!testInput.trim() || !selectedModule) return
    const userMsg: TestMessage = { role: 'user', content: testInput.trim() }
    const newMessages = [...testMessages, userMsg]
    setTestMessages(newMessages)
    setTestInput('')
    setTestLoading(true)

    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: userMsg.content,
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          active_module_prompts: [selectedModule.prompt],
        }),
      })
      const data = await res.json()
      setTestMessages(prev => [...prev, { role: 'assistant', content: data.message }])
    } catch (e) {
      setTestMessages(prev => [...prev, { role: 'assistant', content: '❌ Fout bij ophalen antwoord.' }])
    } finally {
      setTestLoading(false)
    }
  }

  // ── TEACHER/ADMIN: Module detail view ──
  if (selectedModule && role !== 'student') {
    return (
      <div className="space-y-4 h-full">
        <div className="flex items-center gap-3">
          <button onClick={() => setSelectedModule(null)} className="text-white/50 hover:text-white transition-colors">
            <ArrowLeft size={20} />
          </button>
          <span className="text-2xl">{selectedModule.icon}</span>
          <h2 className="text-2xl font-bold text-white">{selectedModule.title}</h2>
          <div className="ml-auto flex gap-2">
            <button
              onClick={() => { setEditingModule(selectedModule); setIsModalOpen(true) }}
              className="flex items-center gap-1 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm rounded-lg transition-all"
            >
              <Pencil size={14} /> Bewerken
            </button>
            <button
              onClick={() => handleDelete(selectedModule)}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm rounded-lg transition-all"
            >
              <Trash size={14} /> Verwijderen
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 160px)' }}>
          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 overflow-y-auto">
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">System Prompt</h3>
            <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">{selectedModule.prompt}</p>
          </div>
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-white/50 text-xs uppercase tracking-wider">🧪 Test chatbox</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {testMessages.length === 0 && (
                <p className="text-white/30 text-sm text-center mt-8">Stuur een bericht om de module te testen.</p>
              )}
              {testMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white/5 border border-white/10 text-white/80'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {testLoading && (
                <div className="flex justify-start">
                  <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-xl text-white/40 text-sm">
                    Aan het typen...
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <input
                type="text"
                value={testInput}
                onChange={e => setTestInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleTestSend()}
                placeholder="Test je module..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:border-blue-500/50"
              />
              <button
                onClick={handleTestSend}
                disabled={testLoading || !testInput.trim()}
                className="p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white rounded-lg transition-all"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>

        <ModuleModal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); setEditingModule(null) }}
          onSave={handleSave}
          editModule={editingModule}
        />
      </div>
    )
  }

  // ── STUDENT: Vakken overzicht ──
  if (role === 'student') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-white">Mijn Vakken</h2>
          <p className="text-white/50 text-sm mt-1">Jouw klassen en vakken</p>
        </div>

        {/* Klascode invoer */}
        <form onSubmit={handleJoin} className="bg-[#0f1029] border border-white/10 rounded-xl p-5">
          <p className="text-white/60 text-sm font-medium mb-3 flex items-center gap-2">
            <LogIn size={15} className="text-green-400" />
            Deelnemen aan een klas via klascode
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(null) }}
              placeholder="Voer klascode in (bijv. AB3X9KPQ)"
              maxLength={8}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono tracking-widest placeholder:text-white/20 focus:outline-none focus:border-green-500/50 uppercase"
            />
            <button
              type="submit"
              disabled={joining || !joinCode.trim()}
              className="px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-sm rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {joining ? 'Bezig...' : 'Deelnemen'}
            </button>
          </div>
          {joinError && (
            <p className="text-red-400 text-xs mt-2">{joinError}</p>
          )}
        </form>

        {/* Zoekbalk */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoek op vaknaam of docent..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/50"
          />
          {zoekterm && (
            <button onClick={() => setZoekterm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition-colors">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Vakken grid */}
        {vakkenLoading ? (
          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex items-center justify-center">
            <p className="text-white/40 text-sm">Vakken laden...</p>
          </div>
        ) : gefilterdeVakken.length === 0 ? (
          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
              <GraduationCap size={28} className="text-blue-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {zoekterm ? 'Geen vakken gevonden' : 'Nog geen vakken'}
            </h3>
            <p className="text-white/40 text-sm max-w-sm">
              {zoekterm ? 'Probeer een andere zoekterm.' : 'Voer een klascode in om deel te nemen aan een klas.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {gefilterdeVakken.map((vak) => (
              <div
                key={vak.id}
                className="bg-[#0f1029] border border-white/10 hover:border-blue-500/30 rounded-xl p-5 transition-all group cursor-pointer relative"
                onClick={() => toast.info('Vak detail pagina komt binnenkort!')}
              >
                {/* Three-dots menu */}
                <div
                  className="absolute top-3 right-3"
                  ref={openMenuId === vak.id ? menuRef : undefined}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setOpenMenuId(openMenuId === vak.id ? null : vak.id)
                    }}
                    className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/5 transition-all"
                  >
                    <MoreVertical size={15} />
                  </button>

                  {openMenuId === vak.id && (
                    <div className="absolute right-0 top-8 w-48 bg-[#1a1d3a] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedVakForNaam(vak)
                          setNieuweNaam(vak.eigen_titel || vak.name)
                          setNaamModalOpen(true)
                          setOpenMenuId(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <Pencil size={14} />
                        Eigen naam instellen
                      </button>
                      <div className="border-t border-white/5 my-1" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setVerlatenId(vak.id)
                          setOpenMenuId(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400/70 hover:text-red-400 hover:bg-red-500/5 transition-all text-left"
                      >
                        <X size={14} />
                        Klas verlaten
                      </button>
                    </div>
                  )}
                </div>

                {/* Kaart inhoud */}
                <div className="flex items-start gap-3 mb-3 pr-7">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <GraduationCap size={18} className="text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white font-semibold truncate">
                      {vak.eigen_titel || vak.name}
                    </h3>
                    {vak.eigen_titel && vak.eigen_titel !== vak.name && (
                      <p className="text-white/25 text-xs truncate">{vak.name}</p>
                    )}
                    {vak.vak && (
                      <p className="text-blue-400/70 text-xs mt-0.5 flex items-center gap-1">
                        <BookOpen size={10} />
                        {vak.vak}
                      </p>
                    )}
                  </div>
                </div>

                {/* Docent naam */}
                {vak.docent_naam && (
                  <p className="text-white/35 text-xs mb-3 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-white/10 flex items-center justify-center text-[10px]">👤</span>
                    {vak.docent_naam}
                  </p>
                )}

                {vak.schooljaar && (
                  <p className="text-white/25 text-xs mb-3">{vak.schooljaar}</p>
                )}

                <div className="flex items-center justify-end mt-3 pt-3 border-t border-white/5">
                  <span className="text-xs text-blue-400/60 group-hover:text-blue-400 transition-colors select-none">
                    Bekijken →
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: Eigen naam instellen */}
        {naamModalOpen && selectedVakForNaam && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl">
              <div className="flex items-center justify-between p-6 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">Eigen naam instellen</h3>
                <button onClick={() => { setNaamModalOpen(false); setSelectedVakForNaam(null); setNieuweNaam('') }}
                  className="text-white/40 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-white/40 text-sm">
                  Officiële naam: <span className="text-white/60">{selectedVakForNaam.name}</span>
                </p>
                <div>
                  <label className="block text-sm text-white/60 mb-1.5">Jouw naam voor dit vak</label>
                  <input
                    type="text"
                    value={nieuweNaam}
                    onChange={(e) => setNieuweNaam(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveNaam() }}
                    placeholder="bijv. Eco bij meneer Jansen"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
                    autoFocus
                  />
                  <p className="text-white/25 text-xs mt-1.5">Alleen jij ziet deze naam.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button"
                    onClick={() => { setNaamModalOpen(false); setSelectedVakForNaam(null); setNieuweNaam('') }}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                    Annuleren
                  </button>
                  <button onClick={handleSaveNaam} disabled={savingNaam}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm transition-all disabled:opacity-50">
                    {savingNaam ? 'Opslaan...' : 'Opslaan'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Klas verlaten bevestiging */}
        {verlatenId && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <X size={18} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold">Klas verlaten?</h3>
                  <p className="text-white/40 text-sm mt-0.5">Je kunt opnieuw deelnemen via de klascode.</p>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setVerlatenId(null)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all">
                  Annuleren
                </button>
                <button onClick={() => handleVerlaten(verlatenId)}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm transition-all">
                  Ja, verlaten
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── TEACHER/ADMIN: Modules overzicht ──
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Modules</h2>
          <p className="text-white/50 text-sm mt-1">
            {role === 'teacher' || role === 'school_admin' || role === 'admin'
              ? 'Beheer en activeer leermodules voor jouw klassen'
              : 'Jouw beschikbare leermodules'}
          </p>
        </div>
        {(role === 'teacher' || role === 'school_admin' || role === 'admin') && (
          <button
            onClick={() => { setEditingModule(null); setIsModalOpen(true) }}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-all"
          >
            + Nieuwe module aanmaken
          </button>
        )}
      </div>

      {modules.length === 0 ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <BookOpen size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nog geen modules</h3>
          <p className="text-white/40 text-sm max-w-sm">Modules worden hier weergegeven zodra ze zijn aangemaakt.</p>
          {(role === 'teacher' || role === 'school_admin' || role === 'admin') && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-6 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all"
            >
              + Nieuwe module aanmaken
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {modules.map(mod => (
            <div
              key={mod.id}
              onClick={() => handleSelectModule(mod)}
              className="bg-[#0f1029] border border-white/10 hover:border-blue-500/40 rounded-xl p-5 cursor-pointer transition-all hover:bg-white/5 group"
            >
              <div className="text-3xl mb-3">{mod.icon}</div>
              <h3 className="text-white font-semibold mb-1">{mod.title}</h3>
              <p className="text-white/40 text-xs line-clamp-2">{mod.prompt}</p>
              <div className="mt-3 text-blue-400/60 text-xs group-hover:text-blue-400 transition-colors">
                Klik om te openen →
              </div>
            </div>
          ))}
        </div>
      )}

      <ModuleModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setEditingModule(null) }}
        onSave={handleSave}
        editModule={editingModule}
      />
    </div>
  )
}