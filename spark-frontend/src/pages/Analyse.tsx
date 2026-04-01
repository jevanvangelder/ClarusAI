import { useAuth } from '@/contexts/AuthContext'
import { BarChart3 } from 'lucide-react'

export default function Analyse() {
  const { role } = useAuth()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Analyse</h2>
        <p className="text-white/50 text-sm mt-1">
          {role === 'teacher'
            ? 'Inzicht in de voortgang van jouw leerlingen'
            : role === 'school_admin'
            ? 'Schoolbrede rapportages en statistieken'
            : 'Platformbrede analyses en rapportages'}
        </p>
      </div>

      {/* Placeholder content */}
      <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
          <BarChart3 size={28} className="text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Nog geen data beschikbaar</h3>
        <p className="text-white/40 text-sm max-w-sm">
          Analyses en statistieken verschijnen hier zodra leerlingen actief zijn in het platform.
        </p>
      </div>
    </div>
  )
}