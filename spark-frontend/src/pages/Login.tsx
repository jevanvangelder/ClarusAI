import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

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
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md space-y-8 p-8">
        {/* Logo */}
        <div className="flex justify-center">
          <img 
            src="/logo.png" 
            alt="ClarusAI Logo" 
            className="w-24 h-24 object-contain"
          />
        </div>

        {/* Header */}
        <div className="text-center">
          <h1 className="font-['Space_Grotesk'] text-3xl font-bold tracking-tight text-foreground">
            Inloggen bij ClarusAI
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Of{' '}
            <Link 
              to="/register" 
              className="font-medium text-primary hover:text-primary/80 transition-colors"
            >
              maak een nieuw account aan
            </Link>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
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
                className="mt-1"
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
                className="mt-1"
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
  )
}