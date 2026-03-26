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

  // Supabase zet automatisch de sessie via de link in de email
  useEffect(() => {
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

      // Uitloggen zodat gebruiker opnieuw moet inloggen met nieuw wachtwoord
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
          <p className="text-muted-foreground">
            Voer hieronder uw nieuwe wachtwoord in
          </p>
        </div>

        {sessionReady ? (
          <div className="space-y-4">
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