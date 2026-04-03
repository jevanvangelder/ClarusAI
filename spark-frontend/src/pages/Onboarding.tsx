import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { User, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function Onboarding() {
  const { user, refreshProfile } = useAuth()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName.trim()) { toast.error('Voornaam is verplicht'); return }
    if (!lastName.trim()) { toast.error('Achternaam is verplicht'); return }
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          // full_name wordt automatisch ingevuld door de trigger
        })
        .eq('id', user.id)

      if (error) throw error

      await refreshProfile()
      // needsOnboarding wordt false na refreshProfile → app laadt automatisch door
    } catch (err: any) {
      toast.error(err.message || 'Fout bij opslaan')
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-3xl font-bold text-white">
            CLARUS<span className="text-blue-400">AI</span>
          </span>
          <p className="text-white/40 text-sm mt-2">Welkom! Stel eerst je profiel in.</p>
        </div>

        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <User size={20} className="text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Jouw naam</h2>
              <p className="text-white/40 text-sm">Dit is hoe anderen jou zien in het platform.</p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-white/60 mb-1.5">
                Voornaam <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="bijv. Jan"
                autoFocus
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div>
              <label className="block text-sm text-white/60 mb-1.5">
                Achternaam <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="bijv. de Vries"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-blue-500/50"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !firstName.trim() || !lastName.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium rounded-lg transition-all mt-2"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Doorgaan
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}