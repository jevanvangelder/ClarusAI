import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, UserRole } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import logoImg from '@/assets/logo.png'
import { GraduationCap, BookOpen, School } from 'lucide-react'

const ROL_OPTIES: { value: UserRole; label: string; omschrijving: string; icon: any }[] = [
  { value: 'student', label: 'Student', omschrijving: 'Ik leer en maak opdrachten', icon: GraduationCap },
  { value: 'teacher', label: 'Docent', omschrijving: 'Ik geef les en maak opdrachten', icon: BookOpen },
  { value: 'school_admin', label: 'Schoolleiding', omschrijving: 'Ik beheer de school', icon: School },
]

export default function Register() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole>('student')
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
      const { error } = await signUp(email, password, selectedRole)

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('Dit email adres is al in gebruik')
        } else {
          toast.error(error.message)
        }
        setLoading(false)
        return
      }

      // Navigeer naar aparte bevestigingspagina met email als parameter
      navigate(`/register/bevestig?email=${encodeURIComponent(email)}`)
    } catch (error: any) {
      toast.error('Er is een fout opgetreden')
      console.error('Register error:', error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border-2 border-primary/50 rounded-xl shadow-2xl shadow-primary/20 p-6 sm:p-8 space-y-6">
          <div className="flex justify-center">
            <img src={logoImg} alt="ClarusAI Logo" className="w-20 h-20 object-contain" />
          </div>
          <div className="text-center space-y-2">
            <h1 className="font-['Space_Grotesk'] text-3xl font-bold tracking-tight text-foreground">
              Account aanmaken
            </h1>
            <p className="text-sm text-muted-foreground">
              Of{' '}
              <Link to="/login" className="font-medium text-primary hover:text-primary/80 transition-colors underline">
                log in met je bestaande account
              </Link>
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">Ik ben een...</Label>
            <div className="grid grid-cols-3 gap-2">
              {ROL_OPTIES.map(({ value, label, omschrijving, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setSelectedRole(value)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${
                    selectedRole === value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <Icon size={22} />
                  <span className="text-xs font-semibold leading-tight">{label}</span>
                  <span className="text-[10px] leading-tight opacity-70">{omschrijving}</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-foreground">E-mailadres</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={loading} className="mt-1.5" placeholder="jouw@email.nl" />
              </div>
              <div>
                <Label htmlFor="password" className="text-foreground">Wachtwoord</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={loading} className="mt-1.5" placeholder="Minimaal 6 karakters" />
              </div>
              <div>
                <Label htmlFor="confirmPassword" className="text-foreground">Bevestig wachtwoord</Label>
                <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required disabled={loading} className="mt-1.5" placeholder="Herhaal je wachtwoord" />
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Bezig met aanmaken...' : `Account aanmaken als ${ROL_OPTIES.find(r => r.value === selectedRole)?.label}`}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}