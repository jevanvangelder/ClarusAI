import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  User,
  Mail,
  School,
  Shield,
  Save,
  Check,
  AlertCircle,
  Lock,
  Eye,
  EyeOff,
} from 'lucide-react'

export default function Instellingen() {
  const { user, profile, role } = useAuth()

  // Profiel velden
  const [fullName, setFullName] = useState('')
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

  // Laad huidige waarden
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '')
      setSchool(profile.school || '')
    }
  }, [profile])

  // Profiel opslaan
  const handleSaveProfile = async () => {
    if (!user) return

    setSaving(true)
    setError(null)
    setSaved(false)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          school: school.trim() || null,
        })
        .eq('id', user.id)

      if (updateError) {
        setError('Fout bij opslaan: ' + updateError.message)
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)

      // Herlaad de pagina na 1 seconde zodat de sidebar ook bijwerkt
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    } catch (err) {
      setError('Er ging iets mis bij het opslaan')
    } finally {
      setSaving(false)
    }
  }

  // Wachtwoord wijzigen
  const handleChangePassword = async () => {
    setPasswordError(null)
    setPasswordSaved(false)

    if (newPassword.length < 6) {
      setPasswordError('Wachtwoord moet minimaal 6 tekens zijn')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Wachtwoorden komen niet overeen')
      return
    }

    setPasswordSaving(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) {
        setPasswordError('Fout bij wijzigen: ' + error.message)
        return
      }

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
            <span className="flex items-center gap-2">
              <Mail size={14} />
              E-mail
            </span>
          </label>
          <input
            type="email"
            value={user?.email || ''}
            disabled
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/40 text-sm cursor-not-allowed"
          />
          <p className="text-xs text-white/30 mt-1">Je e-mail kan niet worden gewijzigd</p>
        </div>

        {/* Rol (niet bewerkbaar) */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">
            <span className="flex items-center gap-2">
              <Shield size={14} />
              Rol
            </span>
          </label>
          <input
            type="text"
            value={getRoleName()}
            disabled
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white/40 text-sm cursor-not-allowed"
          />
          <p className="text-xs text-white/30 mt-1">Je rol kan alleen door een admin worden gewijzigd</p>
        </div>

        {/* Volledige naam */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">
            <span className="flex items-center gap-2">
              <User size={14} />
              Volledige naam
            </span>
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Bijv. Jan de Vries"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>

        {/* School */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">
            <span className="flex items-center gap-2">
              <School size={14} />
              School
            </span>
          </label>
          <input
            type="text"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            placeholder="Bijv. Hogeschool Rotterdam"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
          />
        </div>

        {/* Error / Success */}
        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {saved && (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
            <Check size={16} />
            Profiel succesvol opgeslagen!
          </div>
        )}

        {/* Opslaan knop */}
        <button
          onClick={handleSaveProfile}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white font-medium rounded-lg transition-all text-sm"
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Opslaan...
            </>
          ) : (
            <>
              <Save size={16} />
              Profiel opslaan
            </>
          )}
        </button>
      </div>

      {/* Wachtwoord sectie */}
      <div className="bg-[#0f1029] border border-white/10 rounded-xl p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-purple-500/10 rounded-lg">
            <Lock size={20} className="text-purple-400" />
          </div>
          <h2 className="text-lg font-semibold text-white">Wachtwoord wijzigen</h2>
        </div>

        {/* Nieuw wachtwoord */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">Nieuw wachtwoord</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimaal 6 tekens"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all pr-12"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Bevestig wachtwoord */}
        <div>
          <label className="block text-sm font-medium text-white/60 mb-2">Bevestig wachtwoord</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Herhaal je wachtwoord"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white text-sm placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
          />
        </div>

        {/* Error / Success */}
        {passwordError && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
            <AlertCircle size={16} />
            {passwordError}
          </div>
        )}

        {passwordSaved && (
          <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3">
            <Check size={16} />
            Wachtwoord succesvol gewijzigd!
          </div>
        )}

        {/* Wijzig knop */}
        <button
          onClick={handleChangePassword}
          disabled={passwordSaving || !newPassword || !confirmPassword}
          className="flex items-center gap-2 px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-purple-500/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-all text-sm"
        >
          {passwordSaving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Wijzigen...
            </>
          ) : (
            <>
              <Lock size={16} />
              Wachtwoord wijzigen
            </>
          )}
        </button>
      </div>
    </div>
  )
}