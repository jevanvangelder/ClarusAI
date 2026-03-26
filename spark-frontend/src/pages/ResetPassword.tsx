import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check voor errors in de URL hash
    const hash = window.location.hash
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1))
      const errorDesc = params.get('error_description')?.replace(/\+/g, ' ')
      setError(errorDesc || 'De link is ongeldig of verlopen')
      return
    }

    // Luister naar PASSWORD_RECOVERY event
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const handleConfirm = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Vul beide velden in')
      return
    }

    if (newPassword !== confirmPassword) {
      toast.error('Wachtwoorden komen niet overeen')
      return
    }

    if (newPassword.length < 6) {
      toast.error('Wachtwoord moet minimaal 6 karakters zijn')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      await supabase.auth.signOut()
      toast.success('Wachtwoord succesvol gewijzigd! Log opnieuw in.')
      navigate('/login')
    } catch (error: any) {
      toast.error(error.message || 'Kon wachtwoord niet wijzigen')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-xl p-8 shadow-lg space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold">Wachtwoord wijzigen</h1>
        </div>

        {error ? (
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-center">
              <p className="text-red-700 dark:text-red-300 font-medium">
                ❌ {error}
              </p>
              <p className="text-red-600 dark:text-red-400 text-sm mt-2">
                Vraag een nieuwe wachtwoord reset aan via Instellingen.
              </p>
            </div>
            <Button onClick={() => navigate('/login')} className="w-full">
              Terug naar inloggen
            </Button>
          </div>
        ) : sessionReady ? (
          <div className="space-y-4">
            <p className="text-muted-foreground text-center">
              Voer hieronder uw nieuwe wachtwoord in
            </p>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nieuw wachtwoord</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Minimaal 6 karakters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Bevestig wachtwoord</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Herhaal uw wachtwoord"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <Button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Bezig...' : 'Wachtwoord wijzigen'}
            </Button>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-muted-foreground text-sm">
              Verificatie wordt geladen...
            </p>
          </div>
        )}
      </div>
    </div>
  )
}