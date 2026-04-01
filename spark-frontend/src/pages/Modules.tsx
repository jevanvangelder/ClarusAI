import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { BookOpen, ArrowLeft, Send, Pencil, Trash } from 'lucide-react'
import { ModuleModal } from '@/components/modulemodal'
import { fetchModules, createModule, updateModule, deleteModule } from '@/services/api'
import type { Module } from '@/types/module'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface TestMessage {
  role: 'user' | 'assistant'
  content: string
}

export default function Modules() {
  const { role, user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [selectedModule, setSelectedModule] = useState<Module | null>(null)

  // Test chat state
  const [testMessages, setTestMessages] = useState<TestMessage[]>([])
  const [testInput, setTestInput] = useState('')
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    if (!user) return
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
  }, [user])

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

  // === DETAIL VIEW ===
  if (selectedModule) {
    return (
      <div className="space-y-4 h-full">
        {/* Header */}
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

        {/* Content: info + chatbox */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" style={{ height: 'calc(100vh - 160px)' }}>
          {/* Links: module info */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 overflow-y-auto">
            <h3 className="text-white/50 text-xs uppercase tracking-wider mb-2">System Prompt</h3>
            <p className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">{selectedModule.prompt}</p>
          </div>

          {/* Rechts: test chatbox */}
          <div className="bg-[#0f1029] border border-white/10 rounded-xl flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-white/10">
              <span className="text-white/50 text-xs uppercase tracking-wider">🧪 Test chatbox</span>
            </div>

            {/* Berichten */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {testMessages.length === 0 && (
                <p className="text-white/30 text-sm text-center mt-8">
                  Stuur een bericht om de module te testen.
                </p>
              )}
              {testMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/5 border border-white/10 text-white/80'
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

            {/* Input */}
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

  // === OVERZICHT ===
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