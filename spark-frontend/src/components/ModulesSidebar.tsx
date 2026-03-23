import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash, X } from '@phosphor-icons/react'
import { Module } from '@/types/module'
import { ModuleModal } from './modulemodal'
import { useAuth } from '@/contexts/AuthContext'
import { fetchModules, createModule, updateModule, deleteModule } from '@/services/api'

interface ModulesSidebarProps {
  onClose?: () => void
}

export function ModulesSidebar({ onClose }: ModulesSidebarProps) {
  const { user } = useAuth()
  const [modules, setModules] = useState<Module[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)

  // Load modules from Supabase
  useEffect(() => {
    if (!user) return

    const loadModules = async () => {
      try {
        setLoading(true)
        const data = await fetchModules(user.id)
        // Map Supabase velden naar frontend Module type
        const mapped: Module[] = data.map((m: any) => ({
          id: m.id,
          title: m.name,
          icon: m.icon || '📦',
          prompt: m.system_prompt,
          enabled: m.is_active,
          createdAt: new Date(m.created_at).getTime(),
        }))
        setModules(mapped)
      } catch (error) {
        console.error('Error loading modules:', error)
      } finally {
        setLoading(false)
      }
    }

    loadModules()
  }, [user])

  const handleToggle = async (id: string) => {
    const module = modules.find(m => m.id === id)
    if (!module) return

    // Optimistic update
    setModules(prev =>
      prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    )

    try {
      await updateModule(id, { is_active: !module.enabled })
    } catch (error) {
      console.error('Error toggling module:', error)
      // Rollback
      setModules(prev =>
        prev.map(m => (m.id === id ? { ...m, enabled: module.enabled } : m))
      )
    }
  }

  const handleCreate = () => {
    setEditingModule(null)
    setIsModalOpen(true)
  }

  const handleEdit = (e: React.MouseEvent, module: Module) => {
    e.stopPropagation()
    setEditingModule(module)
    setIsModalOpen(true)
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Weet je zeker dat je deze module wilt verwijderen?')) return

    // Optimistic update
    const backup = modules
    setModules(prev => prev.filter(m => m.id !== id))

    try {
      await deleteModule(id)
    } catch (error) {
      console.error('Error deleting module:', error)
      setModules(backup) // Rollback
    }
  }

  const handleSave = async (data: Omit<Module, 'id' | 'createdAt' | 'enabled'>) => {
    if (!user) return

    try {
      if (editingModule) {
        // Update bestaande module
        await updateModule(editingModule.id, {
          name: data.title,
          icon: data.icon,
          system_prompt: data.prompt,
        })
        setModules(prev =>
          prev.map(m =>
            m.id === editingModule.id ? { ...m, ...data } : m
          )
        )
      } else {
        // Nieuwe module aanmaken
        const created = await createModule(user.id, data.title, data.prompt, data.icon)
        const newModule: Module = {
          id: created.id,
          title: created.name,
          icon: created.icon || '📦',
          prompt: created.system_prompt,
          enabled: created.is_active,
          createdAt: new Date(created.created_at).getTime(),
        }
        setModules(prev => [...prev, newModule])
      }
    } catch (error) {
      console.error('Error saving module:', error)
      alert('Fout bij opslaan van module. Probeer opnieuw.')
    }
  }

  return (
    <>
      <div className="w-full md:w-80 h-full bg-card border-l border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Modules</h2>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              onClick={handleCreate}
              className="gap-2"
            >
              <Plus size={16} weight="bold" />
              Nieuw
            </Button>
            {onClose && (
              <button
                onClick={onClose}
                className="md:hidden text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Zijbalk sluiten"
              >
                <X size={20} weight="bold" />
              </button>
            )}
          </div>
        </div>

        {/* Modules List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Modules laden...
            </p>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Geen modules. Klik op "Nieuw" om er een te maken!
            </p>
          ) : (
            modules.map(module => (
              <div
                key={module.id}
                onClick={() => handleToggle(module.id)}
                className={`
                  border rounded-lg p-3 space-y-2 cursor-pointer transition-all
                  ${module.enabled 
                    ? 'bg-blue-500/20 border-blue-500' 
                    : 'bg-background border-border hover:border-blue-500/50'
                  }
                `}
              >
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{module.icon}</span>
                  <span className="flex-1 font-medium">
                    {module.title}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2">
                  {module.prompt}
                </p>

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={(e) => handleEdit(e, module)}
                    className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors min-h-[44px]"
                  >
                    <Pencil size={14} />
                    Bewerken
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, module.id)}
                    className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors min-h-[44px]"
                  >
                    <Trash size={14} />
                    Verwijderen
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <ModuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editModule={editingModule}
      />
    </>
  )
}