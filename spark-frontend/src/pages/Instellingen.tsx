import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  User, Mail, School, Shield, Save, Check, AlertCircle, Lock, Eye, EyeOff,
} from 'lucide-react'

export default function Instellingen() {
  const { user, profile, role, refreshProfile } = useAuth()

  // Profiel velden
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [school, setSchool] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Wachtwoord velden
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '')
      setLastName(profile.last_name || '')
      setSchool(profile.school || '')
    }
  }, [profile])

  const handleSaveProfile = async () => {
    if (!user) return
    if (!firstName.trim()) { setError('Voornaam is verplicht'); return }
    if (!lastName.trim()) { setError('Achternaam is verplicht'); return }

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          school: school.trim() || null,
          // full_name wordt automatisch bijgewerkt door de trigger
        })
        .eq('id', user.id)

      if (updateError) { setError('Fout bij opslaan: ' + updateError.message); return }

      await refreshProfile()
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError('Er ging iets mis bij het opslaan')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSaved(false)

    if (newPassword.length < 6) { setPasswordError('Wachtwoord moet minimaal 6 tekens zijn'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Wachtwoorden komen niet overeen'); return }

    setPasswordSaving(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) { setPasswordError('Fout bij wijzigen: ' + error.message); return }
      setPasswordSaved(true)
      setNewPassword('')
      setConfirmPassword('')
      setTimeout(() => setPasswordSaved(false), 3000)
    } catch (err) {
      setPasswordError('Er ging iets mis bij het wijzigen van je wachtwoord')
    } finally {
      setPasswordSaving(false)
    }
  }

  const getRoleName = () => {
    switch (role) {
      case 'admin': return 'Admin'
      case 'school_admin': return 'Schoolleiding'
      case 'teacher': return 'Docent'
      case 'student': return 'Student'
      default: return 'Onbekend'
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Instellingen</h1>
        <p className="text-white/50 mt-1">Beheer je profiel en accountinstellingen</p>
      </div>

      {/* Profiel sectie */}
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <User size={20} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Profiel</h2>
          </div>

          {/* Email (niet bewerkbaar) */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <span className="flex items-center gap-2"><Mail size={14} /> E-mail</span>
            </label>
            <input type="email" value={user?.email || ''} disabled
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/40 text-sm cursor-not-allowed" />
            <p className="text-xs text-white/30 mt-1">Je e-mail kan niet worden gewijzigd</p>
          </div>

          {/* Rol (niet bewerkbaar) */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <span className="flex items-center gap-2"><Shield size={14} /> Rol</span>
            </label>
            <input type="text" value={getRoleName()} disabled
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/40 text-sm cursor-not-allowed" />
            <p className="text-xs text-white/30 mt-1">Je rol kan alleen door een admin worden gewijzigd</p>
          </div>

          {/* Voornaam + Achternaam */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                <span className="flex items-center gap-2"><User size={14} /> Voornaam <span className="text-red-400">*</span></span>
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="bijv. Jan"
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">
                <span className="flex items-center gap-2"><User size={14} /> Achternaam <span className="text-red-400">*</span></span>
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="bijv. de Vries"
                autoComplete="off"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
              />
            </div>
          </div>

          {/* School */}
          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">
              <span className="flex items-center gap-2"><School size={14} /> School</span>
            </label>
            <input
              type="text"
              value={school}
              onChange={(e) => setSchool(e.target.value)}
              placeholder="bijv. Hogeschool Rotterdam"
              autoComplete="off"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} /> {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
              <Check size={16} /> Profiel succesvol opgeslagen!
            </div>
          )}

          <button type="button" onClick={handleSaveProfile} disabled={saving}
            className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-medium rounded-lg transition-all text-sm">
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Opslaan...</>
            ) : (
              <><Save size={16} /> Profiel opslaan</>
            )}
          </button>
        </div>
      </form>

      {/* Wachtwoord sectie */}
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()}>
        <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 space-y-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Lock size={20} className="text-purple-400" />
            </div>
            <h2 className="text-lg font-semibold text-white">Wachtwoord wijzigen</h2>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Nieuw wachtwoord</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimaal 6 tekens"
                autoComplete="new-password"
                className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all pr-12"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/60 mb-2">Bevestig wachtwoord</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Herhaal je wachtwoord"
              autoComplete="new-password"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
            />
          </div>

          {passwordError && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
              <AlertCircle size={16} /> {passwordError}
            </div>
          )}
          {passwordSaved && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
              <Check size={16} /> Wachtwoord succesvol gewijzigd!
            </div>
          )}

          <button type="button" onClick={handleChangePassword}
            disabled={passwordSaving || !newPassword || !confirmPassword}
            className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all text-sm">
            {passwordSaving ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Wijzigen...</>
            ) : (
              <><Lock size={16} /> Wachtwoord wijzigen</>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}