import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import logoImg from '@/assets/logo.png'

export default function ConfirmEmail() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const handleEmailConfirmation = async () => {
      try {
        // Supabase stuurt de tokens via het URL-fragment (#access_token=...)
        // supabase-js pakt dit automatisch op bij het laden van de pagina
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          console.error('Session error:', error)
          setError('Er is een fout opgetreden bij het bevestigen van je email.')
          setLoading(false)
          return
        }

        if (data.session) {
          // Haal de nieuwe email op uit de sessie
          const userEmail = data.session.user.email
          setNewEmail(userEmail || null)
          setConfirmed(true)
          toast.success('Je email is succesvol gewijzigd!')
        } else {
          setError('Geen geldige sessie gevonden. Probeer de link opnieuw.')
        }
      } catch (err) {
        console.error('Confirmation error:', err)
        setError('Er is een fout opgetreden.')
      } finally {
        setLoading(false)
      }
    }

    handleEmailConfirmation()
  }, [])

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

          {/* Loading state */}
          {loading && (
            <div className="text-center space-y-4">
              <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-foreground">
                Email bevestigen...
              </h1>
              <div className="flex justify-center gap-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <p className="text-sm text-muted-foreground">
                Even geduld, we verwerken je verzoek...
              </p>
            </div>
          )}

          {/* Success state */}
          {!loading && confirmed && (
            <div className="text-center space-y-4">
              <div className="text-5xl">✅</div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-foreground">
                Email succesvol gewijzigd!
              </h1>
              {newEmail && (
                <p className="text-sm text-muted-foreground">
                  Je kunt nu inloggen met:<br />
                  <span className="font-semibold text-primary">{newEmail}</span>
                </p>
              )}
              <Button
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Ga naar inloggen
              </Button>
            </div>
          )}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center space-y-4">
              <div className="text-5xl">❌</div>
              <h1 className="font-['Space_Grotesk'] text-2xl font-bold tracking-tight text-foreground">
                Er ging iets mis
              </h1>
              <p className="text-sm text-muted-foreground">
                {error}
              </p>
              <Button
                onClick={() => navigate('/login')}
                className="w-full"
              >
                Ga naar inloggen
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}