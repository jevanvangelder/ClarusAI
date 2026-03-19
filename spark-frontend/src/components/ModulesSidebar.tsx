import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash, X } from '@phosphor-icons/react'
import { Module } from '@/types/module'
import { ModuleModal } from './modulemodal'

interface ModulesSidebarProps {
  onClose?: () => void
}

export function ModulesSidebar({ onClose }: ModulesSidebarProps) {
  const [modules, setModules] = useState<Module[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingModule, setEditingModule] = useState<Module | null>(null)

  // Load modules from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('clarus-modules')
    if (saved) {
      try {
        setModules(JSON.parse(saved))
      } catch (error) {
        console.error('Error loading modules:', error)
      }
    } else {
      // Default modules
      const defaultModules: Module[] = [
        {
          id: 'swot-1',
          title: 'SWOT Analyse',
          icon: '🎯',
          prompt: 'Geef altijd een SWOT analyse met:\n\n**Strengths (Sterktes):** Interne positieve factoren\n**Weaknesses (Zwaktes):** Interne verbeterpunten\n**Opportunities (Kansen):** Externe mogelijkheden\n**Threats (Bedreigingen):** Externe risico\'s\n\nGebruik bullet points en wees specifiek.',
          enabled: false,
          createdAt: Date.now(),
        },
        {
          id: 'formal-1',
          title: 'Formele Toon',
          icon: '📝',
          prompt: 'Schrijf altijd in een formele, professionele toon. Gebruik correcte grammatica, vermijd spreektaal, en houd het zakelijk.',
          enabled: false,
          createdAt: Date.now(),
        },
        {
          id: 'study-1',
          title: 'Studie Helper',
          icon: '🎓',
          prompt: 'Help me bij het leren door:\n- Concepten uit te leggen in simpele taal\n- Voorbeelden te geven\n- Vragen te stellen om begrip te controleren\n- Samenvattingen te maken van complexe onderwerpen',
          enabled: false,
          createdAt: Date.now(),
        },
      ]
      setModules(defaultModules)
      localStorage.setItem('clarus-modules', JSON.stringify(defaultModules))
    }
  }, [])

  // Save modules to localStorage
  useEffect(() => {
    if (modules.length > 0) {
      localStorage.setItem('clarus-modules', JSON.stringify(modules))
    }
  }, [modules])

  const handleToggle = (id: string) => {
    setModules(prev =>
      prev.map(m => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    )
  }

  const handleCreate = () => {
    setEditingModule(null)
    setIsModalOpen(true)
  }

  const handleEdit = (e: React.MouseEvent, module: Module) => {
    e.stopPropagation() // Prevent card toggle
    setEditingModule(module)
    setIsModalOpen(true)
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation() // Prevent card toggle
    if (confirm('Weet je zeker dat je deze module wilt verwijderen?')) {
      setModules(prev => prev.filter(m => m.id !== id))
    }
  }

  const handleSave = (data: Omit<Module, 'id' | 'createdAt' | 'enabled'>) => {
    if (editingModule) {
      // Update existing
      setModules(prev =>
        prev.map(m =>
          m.id === editingModule.id
            ? { ...m, ...data }
            : m
        )
      )
    } else {
      // Create new
      const newModule: Module = {
        ...data,
        id: `module-${Date.now()}`,
        enabled: false,
        createdAt: Date.now(),
      }
      setModules(prev => [...prev, newModule])
    }
  }

  return (
    <>
      <div className="w-full h-full bg-card border-l border-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold">Modules</h2>
          <div className="flex items-center gap-2">
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
                className="md:hidden text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Modules List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {modules.length === 0 ? (
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
                {/* Title & Icon */}
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{module.icon}</span>
                  <span className="flex-1 font-medium">
                    {module.title}
                  </span>
                </div>

                {/* Prompt Preview */}
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {module.prompt}
                </p>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button
                    onClick={(e) => handleEdit(e, module)}
                    className="text-xs text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                  >
                    <Pencil size={14} />
                    Bewerken
                  </button>
                  <button
                    onClick={(e) => handleDelete(e, module.id)}
                    className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 transition-colors"
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

      {/* Modal */}
      <ModuleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        editModule={editingModule}
      />
    </>
  )
}