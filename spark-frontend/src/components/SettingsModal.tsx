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
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

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

  const handlePasswordChange = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error('Vul beide wachtwoord velden in')
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
      
      toast.success('Wachtwoord succesvol gewijzigd!')
      setIsChangingPassword(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast.error(error.message || 'Kon wachtwoord niet wijzigen')
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
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
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handleEmailChange} 
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Bezig...' : 'Bevestigen'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsChangingEmail(false)
                      setNewEmail('')
                    }}
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
            
            {!isChangingPassword ? (
              <Button 
                variant="outline" 
                onClick={() => setIsChangingPassword(true)}
                className="w-full"
              >
                Wachtwoord wijzigen
              </Button>
            ) : (
              <div className="space-y-2">
                <Input
                  id="settings-new-password"
                  type="password"
                  placeholder="Nieuw wachtwoord"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Input
                  id="settings-confirm-password"
                  type="password"
                  placeholder="Bevestig nieuw wachtwoord"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button 
                    onClick={handlePasswordChange} 
                    disabled={loading}
                    className="flex-1"
                  >
                    {loading ? 'Bezig...' : 'Bevestigen'}
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsChangingPassword(false)
                      setNewPassword('')
                      setConfirmPassword('')
                    }}
                    disabled={loading}
                  >
                    Annuleren
                  </Button>
                </div>
              </div>
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