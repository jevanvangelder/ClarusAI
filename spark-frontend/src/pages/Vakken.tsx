import { useState, useEffect, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Search, X, LogIn, MoreVertical, Pencil, BookOpen, Palette, GraduationCap, User } from 'lucide-react'
import { toast } from 'sonner'

interface Vak {
  id: string
  name: string
  vak: string | null
  docent_naam: string | null
  schooljaar: string | null
  eigen_titel: string | null
  eigen_kleur: string | null
}

// Beschikbare kleuren voor vakken
const KLEUR_OPTIES = [
  { value: 'blue',   label: 'Blauw',   bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  { value: 'purple', label: 'Paars',   bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-400' },
  { value: 'green',  label: 'Groen',   bg: 'bg-green-500/15',  border: 'border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400' },
  { value: 'amber',  label: 'Geel',    bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  text: 'text-amber-400',  dot: 'bg-amber-400' },
  { value: 'red',    label: 'Rood',    bg: 'bg-red-500/15',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-400' },
  { value: 'pink',   label: 'Roze',    bg: 'bg-pink-500/15',   border: 'border-pink-500/30',   text: 'text-pink-400',   dot: 'bg-pink-400' },
  { value: 'cyan',   label: 'Cyaan',   bg: 'bg-cyan-500/15',   border: 'border-cyan-500/30',   text: 'text-cyan-400',   dot: 'bg-cyan-400' },
  { value: 'orange', label: 'Oranje',  bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
]

function getKleur(kleurWaarde: string | null) {
  return KLEUR_OPTIES.find(k => k.value === kleurWaarde) || KLEUR_OPTIES[0]
}

export default function Vakken() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [vakken, setVakken] = useState<Vak[]>([])
  const [loading, setLoading] = useState(true)
  const [zoekterm, setZoekterm] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const [naamModalOpen, setNaamModalOpen] = useState(false)
  const [kleurModalOpen, setKleurModalOpen] = useState(false)
  const [selectedVak, setSelectedVak] = useState<Vak | null>(null)
  const [nieuweNaam, setNieuweNaam] = useState('')
  const [savingNaam, setSavingNaam] = useState(false)
  const [savingKleur, setSavingKleur] = useState(false)

  const [verlatenId, setVerlatenId] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const fetchVakken = async () => {
    if (!user) return
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('mijn_klassen')
        .select('id, name, vak, docent_naam, schooljaar, eigen_titel, eigen_kleur')
        .eq('is_active', true)
        .order('created_at', { ascending: false })

      if (error) throw error
      setVakken(data || [])
    } catch (err) {
      console.error('Fout bij ophalen vakken:', err)
      toast.error('Kon vakken niet laden')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) fetchVakken()
  }, [user])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!joinCode.trim()) { setJoinError('Voer een klascode in'); return }
    setJoining(true)
    setJoinError(null)
    try {
      const { data, error } = await supabase.rpc('join_class_by_code', { p_code: joinCode.trim() })
      if (error) throw error
      const result = data as { success: boolean; error?: string; class_name?: string }
      if (!result.success) { setJoinError(result.error || 'Onbekende fout'); return }
      toast.success(`Je hebt deelgenomen aan ${result.class_name}!`)
      setJoinCode('')
      fetchVakken()
    } catch (err: any) {
      setJoinError(err.message || 'Fout bij deelnemen')
    } finally {
      setJoining(false)
    }
  }

  const handleVerlaten = async (klasId: string) => {
    try {
      const { error } = await supabase
        .from('class_members')
        .delete()
        .eq('class_id', klasId)
        .eq('student_id', user!.id)
      if (error) throw error

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

  const handleSaveNaam = async () => {
    if (!selectedVak || !user) return
    if (!nieuweNaam.trim()) { toast.error('Naam mag niet leeg zijn'); return }
    setSavingNaam(true)
    try {
      const { error } = await supabase
        .from('student_vak_instellingen')
        .upsert({
          student_id: user.id,
          class_id: selectedVak.id,
          eigen_titel: nieuweNaam.trim(),
        }, { onConflict: 'student_id,class_id' })
      if (error) throw error
      toast.success('Eigen naam opgeslagen!')
      setNaamModalOpen(false)
      setSelectedVak(null)
      setNieuweNaam('')
      fetchVakken()
    } catch (err: any) {
      toast.error(err.message || 'Fout bij opslaan naam')
    } finally {
      setSavingNaam(false)
    }
  }

  const handleSaveKleur = async (kleurWaarde: string) => {
    if (!selectedVak || !user) return
    setSavingKleur(true)
    try {
      const { error } = await supabase
        .from('student_vak_instellingen')
        .upsert({
          student_id: user.id,
          class_id: selectedVak.id,
          eigen_kleur: kleurWaarde,
        }, { onConflict: 'student_id,class_id' })
      if (error) throw error
      toast.success('Kleur opgeslagen!')
      setKleurModalOpen(false)
      setSelectedVak(null)
      fetchVakken()
    } catch (err: any) {
      toast.error(err.message || 'Fout bij opslaan kleur')
    } finally {
      setSavingKleur(false)
    }
  }

  const gefilterdeVakken = vakken.filter((vak) => {
    const term = zoekterm.toLowerCase().trim()
    if (!term) return true
    return (
      (vak.eigen_titel || vak.vak || vak.name).toLowerCase().includes(term) ||
      vak.vak?.toLowerCase().includes(term) ||
      vak.docent_naam?.toLowerCase().includes(term)
    )
  })

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
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm font-mono tracking-widest placeholder:text-white/20 focus:outline-none focus:border-green-500/50"
          />
          <button
            type="submit"
            disabled={joining || !joinCode.trim()}
            className="px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-sm rounded-lg transition-all disabled:opacity-50 whitespace-nowrap"
          >
            {joining ? 'Bezig...' : 'Deelnemen'}
          </button>
        </div>
        {joinError && <p className="text-red-400 text-xs mt-2">{joinError}</p>}
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
      {loading ? (
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
          {gefilterdeVakken.map((vak) => {
            const grootTitel = vak.eigen_titel || vak.vak || vak.name
            const kleur = getKleur(vak.eigen_kleur)

            return (
              <div
                key={vak.id}
                className="bg-[#0f1029] border border-white/10 hover:border-white/20 rounded-xl p-5 transition-all group cursor-pointer relative overflow-hidden"
                onClick={() => navigate(`/vakken/${vak.id}`)}
              >
                {/* Subtiele gekleurde top-accent balk */}
                <div className={`absolute top-0 left-0 right-0 h-0.5 ${kleur.dot} opacity-60`} />

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
                    <div className="absolute right-0 top-8 w-52 bg-[#1a1d3a] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedVak(vak)
                          setNieuweNaam(vak.eigen_titel || vak.vak || vak.name)
                          setNaamModalOpen(true)
                          setOpenMenuId(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <Pencil size={14} />
                        Eigen naam instellen
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedVak(vak)
                          setKleurModalOpen(true)
                          setOpenMenuId(null)
                        }}
                        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-all text-left"
                      >
                        <Palette size={14} />
                        Kleur aanpassen
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
                <div className="flex items-start gap-3 mb-4 pr-7">
                  {/* Gekleurd icoon-blok */}
                  <div className={`w-11 h-11 rounded-xl ${kleur.bg} border ${kleur.border} flex items-center justify-center shrink-0`}>
                    <BookOpen size={18} className={kleur.text} />
                  </div>

                  <div className="flex-1 min-w-0 pt-0.5">
                    {/* Grote, gekleurde vaknaam */}
                    <h3 className={`text-base font-bold truncate ${kleur.text}`}>
                      {grootTitel}
                    </h3>
                    {/* Klasnaam klein eronder */}
                    <p className="text-white/35 text-xs mt-0.5 truncate">{vak.name}</p>
                  </div>
                </div>

                {/* Docent */}
                {vak.docent_naam && (
                  <p className="text-white/35 text-xs mb-2 flex items-center gap-1.5">
                    <User size={11} className="text-white/25" />
                    {vak.docent_naam}
                  </p>
                )}

                {/* Schooljaar */}
                {vak.schooljaar && (
                  <p className="text-white/20 text-xs mb-2">{vak.schooljaar}</p>
                )}

                <div className="flex items-center justify-end mt-3 pt-3 border-t border-white/5">
                  <span className={`text-xs ${kleur.text} opacity-50 group-hover:opacity-100 transition-all select-none`}>
                    Bekijken →
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal: Eigen naam instellen */}
      {naamModalOpen && selectedVak && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Eigen naam instellen</h3>
              <button onClick={() => { setNaamModalOpen(false); setSelectedVak(null); setNieuweNaam('') }}
                className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-white/40 text-sm">
                Vak: <span className="text-white/60">{selectedVak.vak || selectedVak.name}</span>
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
                <button onClick={() => { setNaamModalOpen(false); setSelectedVak(null); setNieuweNaam('') }}
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

      {/* Modal: Kleur aanpassen */}
      {kleurModalOpen && selectedVak && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Kleur aanpassen</h3>
              <button onClick={() => { setKleurModalOpen(false); setSelectedVak(null) }}
                className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-white/40 text-sm">
                Kies een kleur voor <span className="text-white/70">{selectedVak.eigen_titel || selectedVak.vak || selectedVak.name}</span>
              </p>
              <div className="grid grid-cols-4 gap-2">
                {KLEUR_OPTIES.map((kleur) => {
                  const isActief = (selectedVak.eigen_kleur || 'blue') === kleur.value
                  return (
                    <button
                      key={kleur.value}
                      onClick={() => handleSaveKleur(kleur.value)}
                      disabled={savingKleur}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        isActief
                          ? `${kleur.bg} ${kleur.border}`
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-6 h-6 rounded-full ${kleur.dot}`} />
                      <span className={`text-xs ${isActief ? kleur.text : 'text-white/50'}`}>
                        {kleur.label}
                      </span>
                    </button>
                  )
                })}
              </div>
              <p className="text-white/25 text-xs">Alleen jij ziet deze kleur.</p>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Klas verlaten */}
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