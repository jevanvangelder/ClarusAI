import { useState, useEffect } from 'react'
import { X } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Module } from '@/types/module'

interface ModuleModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (module: Omit<Module, 'id' | 'createdAt' | 'enabled'>) => void
  editModule?: Module | null
}

// Uitgebreide emoji opties (40+ emojis!)
const EMOJI_OPTIONS = [
  '🎯', '📝', '🎓', '💡', '📊', '🔍', 
  '✨', '🚀', '💪', '🧠', '📚', '✅',
  '🎨', '⚡', '🔥', '💼', '📈', '🎭',
  '🌟', '🏆', '🎪', '🎬', '📱', '💻',
  '🔔', '💬', '📌', '🎁', '🎯', '🎲',
  '🧩', '🎮', '🎹', '🎸', '🎤', '🎧',
  '📷', '🎥', '📺', '📻', '☕', '🍕',
  '🌈', '🌸', '🌺', '🌻', '🌼', '🍀'
]

export function ModuleModal({ isOpen, onClose, onSave, editModule }: ModuleModalProps) {
  const [title, setTitle] = useState('')
  const [icon, setIcon] = useState('')
  const [prompt, setPrompt] = useState('')

  // Load data when editing
  useEffect(() => {
    if (editModule) {
      setTitle(editModule.title)
      setIcon(editModule.icon)
      setPrompt(editModule.prompt)
    } else {
      setTitle('')
      setIcon('')
      setPrompt('')
    }
  }, [editModule, isOpen])

  const handleSave = () => {
    if (!title.trim() || !prompt.trim()) {
      alert('Titel en prompt zijn verplicht!')
      return
    }

    onSave({
      title: title.trim(),
      icon: icon || '',
      prompt: prompt.trim(),
    })

    // Reset form
    setTitle('')
    setIcon('')
    setPrompt('')
    onClose()
  }

  const handleClose = () => {
    setTitle('')
    setIcon('')
    setPrompt('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={handleClose}
      />

      {/* ✅ Modal — responsive: fullscreen op mobiel, centered op desktop */}
      <div className="fixed inset-0 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 w-full md:w-[600px] md:max-h-[80vh] bg-card md:border md:border-border md:rounded-lg shadow-xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {editModule ? '✏️ Module Bewerken' : '➕ Nieuwe Module'}
          </h2>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Sluiten"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          {/* Titel */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Titel <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="Bijv. SWOT Analyse"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full"
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Icon (optioneel)
            </label>
            
            {/* Selected Icon Display */}
            <div className="flex items-center gap-3 mb-3">
              <div className="text-4xl w-12 h-12 flex items-center justify-center">
                {icon || '—'}
              </div>
              <span className="text-sm text-muted-foreground">
                {icon ? 'Geselecteerd' : 'Geen icon geselecteerd'}
              </span>
            </div>

            {/* ✅ Emoji Grid op mobiel, horizontaal scrollen op desktop */}
            <div className="relative">
              <div className="overflow-x-auto py-2 -mx-1 px-1">
                <div className="grid grid-cols-8 gap-2 md:flex md:gap-2 md:min-w-max">
                  {/* Geen emoji optie */}
                  <button
                    type="button"
                    onClick={() => setIcon('')}
                    className={`
                      w-10 h-10 md:w-12 md:h-12 flex items-center justify-center rounded-md transition-all hover:bg-accent shrink-0
                      ${!icon ? 'bg-blue-500/20 ring-2 ring-blue-500' : 'bg-background border border-border'}
                    `}
                    title="Geen icon"
                  >
                    <span className="text-lg md:text-xl text-muted-foreground">—</span>
                  </button>

                  {/* Emoji opties */}
                  {EMOJI_OPTIONS.map((emoji, index) => (
                    <button
                      key={`${emoji}-${index}`}
                      type="button"
                      onClick={() => setIcon(emoji)}
                      className={`
                        w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-lg md:text-xl rounded-md transition-all hover:bg-accent shrink-0
                        ${icon === emoji ? 'bg-blue-500/20 ring-2 ring-blue-500' : 'bg-background border border-border'}
                      `}
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Scroll hint — alleen op desktop */}
              <div className="hidden md:block absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-card to-transparent pointer-events-none" />
            </div>

            <p className="text-xs text-muted-foreground mt-2 hidden md:block">
              Scroll horizontaal voor meer emoji's →
            </p>
          </div>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium mb-2">
              System Prompt <span className="text-red-500">*</span>
            </label>
            <Textarea
              placeholder="Bijv. Geef altijd een SWOT analyse met strengths, weaknesses, opportunities en threats..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full min-h-[150px] md:min-h-[200px] resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Deze instructies worden aan de AI gegeven wanneer de module actief is.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 md:px-6 py-4 border-t border-border flex justify-end">
          <Button onClick={handleSave} size="lg" className="w-full md:w-auto">
            Opslaan
          </Button>
        </div>
      </div>
    </>
  )
}