import { useAuth } from '@/contexts/AuthContext'
import { Users } from 'lucide-react'

export default function Klassen() {
  const { role } = useAuth()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Klassen</h2>
        <p className="text-white/50 text-sm mt-1">
          {role === 'teacher'
            ? 'Beheer jouw klassen en leerlingen'
            : role === 'school_admin'
            ? 'Overzicht van alle klassen op jouw school'
            : role === 'admin'
            ? 'Overzicht van alle klassen in het systeem'
            : 'Jouw klas'}
        </p>
      </div>

      {/* Placeholder content */}
      <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
          <Users size={28} className="text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Nog geen klassen</h3>
        <p className="text-white/40 text-sm max-w-sm">
          Klassen worden hier weergegeven zodra ze zijn aangemaakt.
        </p>
        {(role === 'teacher' || role === 'school_admin' || role === 'admin') && (
          <button className="mt-6 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-sm rounded-lg transition-all">
            + Nieuwe klas aanmaken
          </button>
        )}
      </div>
    </div>
  )
}