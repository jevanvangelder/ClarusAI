import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { BookOpen } from 'lucide-react'
import { ModuleModal } from '@/components/modulemodal'
import { fetchModules, createModule } from '@/services/api'
import type { Module } from '@/types/module'

export default function Modules() {
  const { role, user } = useAuth()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modules, setModules] = useState<Module[]>([])

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
    const created = await createModule({
      user_id: user.id,
      name: data.title,
      icon: data.icon,
      system_prompt: data.prompt,
      is_active: true,
    })
    setModules(prev => [...prev, {
      id: created.id,
      title: created.name,
      icon: created.icon || '📦',
      prompt: created.system_prompt,
      enabled: created.is_active,
      createdAt: new Date(created.created_at).getTime(),
    }])
  }

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
            onClick={() => setIsModalOpen(true)}
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
          <p className="text-white/40 text-sm max-w-sm">
            Modules worden hier weergegeven zodra ze zijn aangemaakt.
          </p>
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
          {modules.map(module => (
            <div key={module.id} className="bg-[#0f1029] border border-white/10 rounded-xl p-4">
              <div className="text-2xl mb-2">{module.icon}</div>
              <h3 className="text-white font-semibold">{module.title}</h3>
            </div>
          ))}
        </div>
      )}

      <ModuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  )
}