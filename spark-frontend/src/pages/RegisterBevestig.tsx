import { Link, useSearchParams } from 'react-router-dom'
import logoImg from '@/assets/logo.png'
import { Mail } from 'lucide-react'

export default function RegisterBevestig() {
  const [searchParams] = useSearchParams()
  const email = searchParams.get('email') || 'je e-mailadres'

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="bg-card border-2 border-primary/50 rounded-xl shadow-2xl shadow-primary/20 p-6 sm:p-8 space-y-6 text-center">
          <div className="flex justify-center">
            <img src={logoImg} alt="ClarusAI Logo" className="w-20 h-20 object-contain" />
          </div>
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Mail size={30} className="text-blue-400" />
            </div>
          </div>
          <div className="space-y-3">
            <h1 className="font-['Space_Grotesk'] text-2xl font-bold text-foreground">
              Controleer je e-mail! 📬
            </h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Je account is aangemaakt! We hebben een verificatie-e-mail gestuurd naar:
            </p>
            <p className="text-primary font-semibold">{email}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Klik op de link in die e-mail om je account te activeren. Daarna kun je inloggen bij ClarusAI.
            </p>
          </div>
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-4 py-3 text-xs text-blue-300/80 text-left space-y-1">
            <p>📁 Geen e-mail ontvangen?</p>
            <p>Controleer je spam of ongewenste e-mail map. De e-mail kan soms een paar minuten onderweg zijn.</p>
          </div>
          <Link
            to="/login"
            className="block w-full py-2.5 px-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium rounded-lg transition-all text-center"
          >
            Terug naar inloggen
          </Link>
        </div>
      </div>
    </div>
  )
}