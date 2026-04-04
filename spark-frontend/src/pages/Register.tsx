import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth, UserRole } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import logoImg from '@/assets/logo.png'
import { GraduationCap, BookOpen, School, Mail, Loader2, Eye, EyeOff } from 'lucide-react'

const ROL_OPTIES: { value: UserRole; label: string; omschrijving: string; icon: any }[] = [
  { value: 'student', label: 'Student', omschrijving: 'Ik leer en maak opdrachten', icon: GraduationCap },
  { value: 'teacher', label: 'Docent', omschrijving: 'Ik geef les en maak opdrachten', icon: BookOpen },
  { value: 'school_admin', label: 'Schoolleiding', omschrijving: 'Ik beheer de school', icon: School },
]

export default function Register() {
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
  const [loading, setLoading] = useState(false)
  const [gelukt, setGelukt] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Wachtwoorden komen niet overeen')
      return
    }
    if (password.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 tekens zijn')
      return
    }

    setLoading(true)
    const { error } = await signUp(email, password, selectedRole)

    if (error) {
      if (error.message?.includes('already registered')) {
        toast.error('Dit e-mailadres is al in gebruik')
      } else {
        toast.error(error.message || 'Er is een fout opgetreden')
      }
      setLoading(false)
      return
    }

    setLoading(false)
    setGelukt(true)
  }

  // ===== BEVESTIGSCHERM =====
  if (gelukt) {
    return (
      <div className="min-h-screen bg-[#080d1f] flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
        </div>

        <div className="w-full max-w-md relative">
          <div className="bg-[#0f1029] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <img
              src={logoImg}
              alt="ClarusAI Logo"
              className="w-14 h-14 object-contain mx-auto"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />

            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mx-auto">
              <Mail size={28} className="text-blue-400" />
            </div>

            <div className="space-y-3">
              <h1 className="text-2xl font-bold text-white">Controleer je e-mail! 📬</h1>
              <p className="text-white/50 text-sm leading-relaxed">
                Je account is aangemaakt. We hebben een verificatielink gestuurd naar:
              </p>
              <p className="text-blue-400 font-semibold text-sm">{email}</p>
              <p className="text-white/40 text-sm leading-relaxed">
                Klik op de link in de e-mail om je account te activeren. Daarna kun je inloggen bij ClarusAI.
              </p>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/15 rounded-xl px-4 py-3 text-xs text-blue-300/70 text-left space-y-1">
              <p className="font-medium">📁 Geen e-mail ontvangen?</p>
              <p>Controleer je spam of ongewenste e-mail map. Het kan soms een paar minuten duren.</p>
            </div>

            <Link
              to="/login"
              className="block w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-all text-center"
            >
              Terug naar inloggen
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ===== REGISTRATIE FORMULIER =====
  return (
    <div className="min-h-screen bg-[#080d1f] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="bg-[#0f1029] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-7">

          {/* Logo + titel */}
          <div className="flex flex-col items-center gap-4 text-center">
            <img
              src={logoImg}
              alt="ClarusAI Logo"
              className="w-14 h-14 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Account aanmaken bij <span className="text-blue-400">ClarusAI</span>
              </h1>
              <p className="text-white/40 text-sm mt-1.5">
                Al een account?{' '}
                <Link
                  to="/login"
                  className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  Log in
                </Link>
              </p>
            </div>
          </div>

          {/* Rol kiezen */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-white/60">Ik ben een...</p>
            <div className="grid grid-cols-3 gap-2">
              {ROL_OPTIES.map(({ value, label, omschrijving, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRole(value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all text-center ${
                    selectedRole === value
                      ? 'bg-blue-600/20 border-blue-500/30 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white/70'
                  }`}
                >
                  <Icon size={20} className={selectedRole === value ? 'text-blue-400' : ''} />
                  <span className="text-xs font-semibold leading-tight">{label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{omschrijving}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Formulier */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/60">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="jouw@email.nl"
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 focus:outline-none rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm transition-colors disabled:opacity-50"
              />
            </div>

            {/* Wachtwoord */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/60">Wachtwoord</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="Minimaal 6 tekens"
                  className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 focus:outline-none rounded-lg px-4 py-3 pr-11 text-white placeholder-white/30 text-sm transition-colors disabled:opacity-50"
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
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/60">Bevestig wachtwoord</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                placeholder="Herhaal je wachtwoord"
                className="w-full bg-white/5 border border-white/10 focus:border-blue-500/50 focus:ring-0 focus:outline-none rounded-lg px-4 py-3 text-white placeholder-white/30 text-sm transition-colors disabled:opacity-50"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all text-sm mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Bezig met aanmaken...
                </>
              ) : (
                `Account aanmaken als ${ROL_OPTIES.find(r => r.value === selectedRole)?.label}`
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}