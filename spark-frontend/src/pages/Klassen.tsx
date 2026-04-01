import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Users, Plus, X, BookOpen, Calendar } from 'lucide-react'

interface Klas {
  id: string
  naam: string
  vak: string | null
  schooljaar: string | null
  beschrijving: string | null
  is_active: boolean
  teacher_id: string
  created_at: string
}

export default function Klassen() {
  const { user, role } = useAuth()
  const [klassen, setKlassen] = useState<Klas[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Formulier state
  const [naam, setNaam] = useState('')
  const [vak, setVak] = useState('')
  const [schooljaar, setSchooljaar] = useState('')
  const [beschrijving, setBeschrijving] = useState('')

  // Klassen ophalen uit Supabase
  const fetchKlassen = async () => {
    if (!user) return
    setLoading(true)
    try {
      let query = supabase.from('klassen').select('*').eq('is_active', true).order('created_at', { ascending: false })

      // Docenten zien alleen hun eigen klassen
      if (role === 'teacher') {
        query = query.eq('teacher_id', user.id)
      }

      const { data, error } = await query
      if (error) throw error
      setKlassen(data || [])
    } catch (err) {
      console.error('Fout bij ophalen klassen:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKlassen()
  }, [user, role])

  // Nieuwe klas opslaan
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (!naam.trim()) {
      setError('Naam is verplicht')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error } = await supabase.from('klassen').insert({
        naam: naam.trim(),
        vak: vak.trim() || null,
        schooljaar: schooljaar.trim() || null,
        beschrijving: beschrijving.trim() || null,
        teacher_id: user.id,
        is_active: true,
      })

      if (error) throw error

      // Reset formulier en sluit modal
      setNaam('')
      setVak('')
      setSchooljaar('')
      setBeschrijving('')
      setModalOpen(false)
      fetchKlassen()
    } catch (err: any) {
      setError(err.message || 'Fout bij aanmaken klas')
    } finally {
      setSaving(false)
    }
  }

  const handleSluitModal = () => {
    setModalOpen(false)
    setNaam('')
    setVak('')
    setSchooljaar('')
    setBeschrijving('')
    setError(null)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Klassen</h2>
          <p className="text-white/50 text-sm mt-1">
            {role === 'teacher'
              ? 'Beheer jouw klassen en leerlingen'
              : role === 'school_admin'
              ? 'Overzicht van alle klassen op jouw school'
              : role === 'admin'
              ? 'Overzicht van alle klassen in het systeem'
              : 'Jouw klas'}
          </p>
        </div>
        {(role === 'teacher' || role === 'school_admin' || role === 'admin') && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all"
          >
            <Plus size={16} />
            Nieuwe klas
          </button>
        )}
      </div>

      {/* Inhoud */}
      {loading ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex items-center justify-center">
          <p className="text-white/40 text-sm">Klassen laden...</p>
        </div>
      ) : klassen.length === 0 ? (
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
            <Users size={28} className="text-blue-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Nog geen klassen</h3>
          <p className="text-white/40 text-sm max-w-sm">
            Klik op "Nieuwe klas" om jouw eerste klas aan te maken.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {klassen.map((klas) => (
            <div
              key={klas.id}
              className="bg-[#0f1029] border border-white/10 hover:border-blue-500/30 rounded-xl p-5 transition-all cursor-pointer group"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                  <Users size={18} className="text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-semibold truncate">{klas.naam}</h3>
                  {klas.vak && (
                    <p className="text-white/40 text-xs mt-0.5 flex items-center gap-1">
                      <BookOpen size={11} />
                      {klas.vak}
                    </p>
                  )}
                </div>
              </div>
              {klas.beschrijving && (
                <p className="text-white/40 text-sm mb-3 line-clamp-2">{klas.beschrijving}</p>
              )}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                {klas.schooljaar && (
                  <span className="text-white/30 text-xs flex items-center gap-1">
                    <Calendar size={11} />
                    {klas.schooljaar}
                  </span>
                )}
                <span className="text-xs text-blue-400/60 ml-auto group-hover:text-blue-400 transition-colors">
                  Bekijken →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Nieuwe klas aanmaken */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-md shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Nieuwe klas aanmaken</h3>
              <button
                onClick={handleSluitModal}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal form */}
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-sm text-white/60 mb-1.5">
                  Naam klas <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                  placeholder="bijv. 3A of Klas Wiskunde"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">Vak</label>
                <input
                  type="text"
                  value={vak}
                  onChange={(e) => setVak(e.target.value)}
                  placeholder="bijv. Wiskunde, Nederlands"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">Schooljaar</label>
                <input
                  type="text"
                  value={schooljaar}
                  onChange={(e) => setSchooljaar(e.target.value)}
                  placeholder="bijv. 2025-2026"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-1.5">Beschrijving</label>
                <textarea
                  value={beschrijving}
                  onChange={(e) => setBeschrijving(e.target.value)}
                  placeholder="Optionele beschrijving van de klas"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50 resize-none"
                />
              </div>

              {/* Knoppen */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSluitModal}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 text-white/50 hover:text-white hover:bg-white/5 text-sm transition-all"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm transition-all disabled:opacity-50"
                >
                  {saving ? 'Opslaan...' : 'Klas aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}