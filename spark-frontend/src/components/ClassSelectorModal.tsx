import { useState, useMemo, useEffect } from 'react'
import { X, Search, GraduationCap, Check } from 'lucide-react'

interface Klas {
  id: string
  name: string
  vak: string
}

interface ClassSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  klassen: Klas[]
  selectedKlassen: string[]
  onSelect: (klasIds: string[]) => void
}

export default function ClassSelectorModal({
  isOpen,
  onClose,
  klassen,
  selectedKlassen,
  onSelect
}: ClassSelectorModalProps) {
  const [search, setSearch] = useState('')
  const [tempSelected, setTempSelected] = useState<string[]>(selectedKlassen)

  // Sync tempSelected when modal opens
  useEffect(() => {
    if (isOpen) {
      setTempSelected(selectedKlassen)
      setSearch('') // Reset search ook
    }
  }, [isOpen, selectedKlassen])

  // ALLE HOOKS MOETEN VOOR DE RETURN NULL KOMEN
  const filteredKlassen = useMemo(() => {
    if (!search.trim()) return klassen
    const searchLower = search.toLowerCase()
    return klassen.filter(k => 
      k.name.toLowerCase().includes(searchLower) || 
      k.vak.toLowerCase().includes(searchLower)
    )
  }, [klassen, search])

  // Groepeer klassen per vak
  const klassenPerVak = useMemo(() => {
    const grouped: Record<string, Klas[]> = {}
    filteredKlassen.forEach(klas => {
      if (!grouped[klas.vak]) {
        grouped[klas.vak] = []
      }
      grouped[klas.vak].push(klas)
    })
    return grouped
  }, [filteredKlassen])

  // NU PAS DE EARLY RETURN - NA ALLE HOOKS
  if (!isOpen) return null

  const toggleKlas = (klasId: string) => {
    if (tempSelected.includes(klasId)) {
      setTempSelected(tempSelected.filter(id => id !== klasId))
    } else {
      setTempSelected([...tempSelected, klasId])
    }
  }

  const toggleVak = (vak: string) => {
    const vakKlassen = klassenPerVak[vak]
    const allSelected = vakKlassen.every(k => tempSelected.includes(k.id))
    
    if (allSelected) {
      // Deselecteer alle klassen van dit vak
      setTempSelected(tempSelected.filter(id => !vakKlassen.some(k => k.id === id)))
    } else {
      // Selecteer alle klassen van dit vak
      const newSelected = [...tempSelected]
      vakKlassen.forEach(k => {
        if (!newSelected.includes(k.id)) {
          newSelected.push(k.id)
        }
      })
      setTempSelected(newSelected)
    }
  }

  const handleApply = () => {
    onSelect(tempSelected)
    onClose()
  }

  const handleClose = () => {
    setTempSelected(selectedKlassen) // Reset bij annuleren
    setSearch('')
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-xl font-semibold text-white">Selecteer klassen</h3>
              <p className="text-white/50 text-sm mt-1">
                {tempSelected.length} van {klassen.length} geselecteerd
              </p>
            </div>
            <button onClick={handleClose} className="text-white/50 hover:text-white">
              <X size={24} />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op klas of vak..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {Object.keys(klassenPerVak).length === 0 ? (
            <div className="text-center py-12">
              <GraduationCap size={48} className="text-white/20 mx-auto mb-4" />
              <p className="text-white/40">Geen klassen gevonden</p>
            </div>
          ) : (
            Object.entries(klassenPerVak).map(([vak, vakKlassen]) => {
              const allSelected = vakKlassen.every(k => tempSelected.includes(k.id))
              const someSelected = vakKlassen.some(k => tempSelected.includes(k.id))

              return (
                <div key={vak} className="space-y-2">
                  {/* Vak header met "selecteer alle" */}
                  <button
                    onClick={() => toggleVak(vak)}
                    className="w-full flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                        allSelected 
                          ? 'bg-blue-600 border-blue-600' 
                          : someSelected
                          ? 'bg-blue-600/50 border-blue-600'
                          : 'border-white/30 group-hover:border-white/50'
                      }`}>
                        {(allSelected || someSelected) && <Check size={14} className="text-white" />}
                      </div>
                      <span className="font-semibold text-white">{vak}</span>
                      <span className="text-white/40 text-sm">
                        ({vakKlassen.filter(k => tempSelected.includes(k.id)).length}/{vakKlassen.length})
                      </span>
                    </div>
                  </button>

                  {/* Klassen */}
                  <div className="space-y-1 pl-8">
                    {vakKlassen.map(klas => (
                      <button
                        key={klas.id}
                        onClick={() => toggleKlas(klas.id)}
                        className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors group"
                      >
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          tempSelected.includes(klas.id)
                            ? 'bg-blue-600 border-blue-600'
                            : 'border-white/30 group-hover:border-white/50'
                        }`}>
                          {tempSelected.includes(klas.id) && <Check size={12} className="text-white" />}
                        </div>
                        <span className="text-white/80 text-sm">{klas.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-all"
          >
            Annuleren
          </button>
          <button
            onClick={handleApply}
            disabled={tempSelected.length === 0}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition-all"
          >
            Toepassen ({tempSelected.length})
          </button>
        </div>
      </div>
    </div>
  )
}