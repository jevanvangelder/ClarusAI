import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { SignOut, EnvelopeSimple, LockKey } from '@phosphor-icons/react'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [isChangingEmail, setIsChangingEmail] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [passwordResetSent, setPasswordResetSent] = useState(false)

  const handleEmailChange = async () => {
    if (!newEmail) {
      toast.error('Vul een nieuw email adres in')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail })
      if (error) throw error
      toast.success('Verificatie email verstuurd naar je nieuwe email adres!')
      setIsChangingEmail(false)
      setNewEmail('')
    } catch (error: any) {
      toast.error(error.message || 'Kon email niet wijzigen')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!user?.email) {
      toast.error('Geen email adres gevonden')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      setPasswordResetSent(true)
    } catch (error: any) {
      toast.error(error.message || 'Kon verificatie email niet versturen')
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut()
      onOpenChange(false)
      toast.success('Succesvol uitgelogd!')
      navigate('/login')
    } catch (error: any) {
      toast.error('Kon niet uitloggen')
      setLoading(false)
    }
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setIsChangingEmail(false)
      setNewEmail('')
      setPasswordResetSent(false)
    }
    onOpenChange(isOpen)
  }

  // ✅ Stop keyboard events van doorbubblelen naar ChatSidebar
  const stopKeyboard = (e: React.KeyboardEvent) => {
    e.stopPropagation()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onKeyDown={stopKeyboard}
        onKeyUp={stopKeyboard}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">Instellingen</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <EnvelopeSimple size={20} />
              Email
            </Label>

            {!isChangingEmail ? (
              <div className="flex items-center gap-3">
                <Input
                  id="settings-current-email"
                  value={user?.email || ''}
                  disabled
                  className="flex-1 bg-gray-100 dark:bg-gray-800"
                  readOnly
                  tabIndex={-1}
                />
                <Button
                  variant="outline"
                  onClick={() => setIsChangingEmail(true)}
                  className="whitespace-nowrap"
                >
                  Email wijzigen
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Input
                  id="settings-new-email"
                  type="email"
                  placeholder="Nieuw email adres"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={stopKeyboard}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button onClick={handleEmailChange} disabled={loading} className="flex-1">
                    {loading ? 'Bezig...' : 'Bevestigen'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setIsChangingEmail(false); setNewEmail('') }}
                    disabled={loading}
                  >
                    Annuleren
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Password Section */}
          <div className="space-y-3">
            <Label className="text-base font-semibold flex items-center gap-2">
              <LockKey size={20} />
              Wachtwoord
            </Label>

            {passwordResetSent ? (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-center space-y-2">
                <p className="text-green-700 dark:text-green-300 font-medium">
                  📧 Verifieer via uw email om de wijziging te voltooien
                </p>
                <p className="text-green-600 dark:text-green-400 text-sm">
                  We hebben een verificatie link gestuurd naar {user?.email}
                </p>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handlePasswordReset}
                disabled={loading}
                className="w-full"
              >
                {loading ? 'Bezig...' : 'Wachtwoord wijzigen'}
              </Button>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 dark:border-gray-700" />

          {/* Sign Out Button */}
          <Button
            variant="destructive"
            onClick={handleSignOut}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2"
          >
            <SignOut size={20} />
            {loading ? 'Bezig met uitloggen...' : 'Uitloggen'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}