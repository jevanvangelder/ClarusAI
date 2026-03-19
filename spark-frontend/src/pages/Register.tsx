import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import logoImg from '@/assets/logo.png'

export default function Register() {
  const navigate = useNavigate()
  const { signUp } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (password !== confirmPassword) {
      toast.error('Wachtwoorden komen niet overeen')
      return
    }

    if (password.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 karakters zijn')
      return
    }

    setLoading(true)

    try {
      const { error } = await signUp(email, password)
      
      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Dit email adres is al in gebruik')
        } else {
          toast.error(error.message)
        }
        return
      }

      toast.success('Account aangemaakt! Check je email voor verificatie.')
      navigate('/login')
    } catch (error: any) {
      toast.error('Er is een fout opgetreden')
      console.error('Register error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {/* ✅ p-6 op kleine schermen, p-8 vanaf sm (640px) */}
        <div className="bg-card border-2 border-primary/50 rounded-xl shadow-2xl shadow-primary/20 p-6 sm:p-8 space-y-6">
          {/* Logo */}
          <div className="flex justify-center">
            <img 
              src={logoImg} 
              alt="ClarusAI Logo" 
              className="w-20 h-20 object-contain"
            />
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold tracking-tight text-foreground">
              Account aanmaken
            </h1>
            <p className="text-sm text-muted-foreground">
              Of{' '}
              <Link 
                to="/login" 
                className="font-medium text-primary hover:text-primary/80 transition-colors underline"
              >
                log in met je bestaande account
              </Link>
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-foreground">
                  E-mailadres
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="mt-1.5"
                  placeholder="jouw@email.nl"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-foreground">
                  Wachtwoord
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="mt-1.5"
                  placeholder="Minimaal 6 karakters"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-foreground">
                  Bevestig wachtwoord
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="mt-1.5"
                  placeholder="Herhaal je wachtwoord"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Bezig met aanmaken...' : 'Account aanmaken'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}