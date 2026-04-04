import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from 'sonner'
import { Loader2, Eye, EyeOff } from 'lucide-react'
import logoImg from '@/assets/logo.png'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await signIn(email, password)

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Onjuist e-mailadres of wachtwoord')
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Verifieer eerst je e-mailadres')
        } else {
          toast.error(error.message)
        }
        return
      }

      toast.success('Succesvol ingelogd!')
      navigate('/')
    } catch (error: any) {
      toast.error('Er is een fout opgetreden')
      console.error('Login error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#080d1f] flex items-center justify-center p-4">
      {/* Subtiele achtergrond glow */}
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
              className="w-16 h-16 object-contain"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                Inloggen bij <span className="text-blue-400">ClarusAI</span>
              </h1>
              <p className="text-white/40 text-sm mt-1.5">
                Nog geen account?{' '}
                <Link
                  to="/register"
                  className="text-blue-400 hover:text-blue-300 transition-colors font-medium"
                >
                  Maak er een aan
                </Link>
              </p>
            </div>
          </div>

          {/* Formulier */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* E-mail */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-white/60">
                E-mailadres
              </label>
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
              <label className="block text-sm font-medium text-white/60">
                Wachtwoord
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  placeholder="••••••••"
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all text-sm mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Bezig met inloggen...
                </>
              ) : (
                'Inloggen'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}