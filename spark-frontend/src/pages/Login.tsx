import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import logoImg from '@/assets/logo.png'

export default function Login() {
  const navigate = useNavigate()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await signIn(email, password)
      
      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Onjuist email adres of wachtwoord')
        } else if (error.message.includes('Email not confirmed')) {
          toast.error('Verifieer eerst je email adres')
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
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border-2 border-primary/50 rounded-xl shadow-2xl shadow-primary/20 p-8 space-y-6">
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
              Inloggen bij ClarusAI
            </h1>
            <p className="text-sm text-muted-foreground">
              Of{' '}
              <Link 
                to="/register" 
                className="font-medium text-primary hover:text-primary/80 transition-colors underline"
              >
                maak een nieuw account aan
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
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Bezig met inloggen...' : 'Inloggen'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}