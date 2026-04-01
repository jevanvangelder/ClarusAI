import { useAuth } from '@/contexts/AuthContext'
import { Shield, Users, BookOpen, FileText, BarChart3 } from 'lucide-react'

export default function Admin() {
  const { role } = useAuth()

  if (role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Shield size={40} className="text-red-400/50 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Je hebt geen toegang tot deze pagina.</p>
        </div>
      </div>
    )
  }

  const stats = [
    { label: 'Gebruikers', value: '—', icon: Users, color: 'blue' },
    { label: 'Modules', value: '—', icon: BookOpen, color: 'purple' },
    { label: 'Opdrachten', value: '—', icon: FileText, color: 'green' },
    { label: 'Actieve sessies', value: '—', icon: BarChart3, color: 'orange' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Admin</h2>
        <p className="text-white/50 text-sm mt-1">
          Beheer het volledige platform
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-[#0f1029] border border-white/10 rounded-xl p-5 flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
              <stat.icon size={22} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
              <p className="text-white/40 text-xs mt-0.5">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Placeholder sectie */}
      <div className="bg-[#0f1029] border border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-center">
        <Shield size={28} className="text-blue-400 mb-3" />
        <h3 className="text-lg font-semibold text-white mb-2">Admin paneel</h3>
        <p className="text-white/40 text-sm max-w-sm">
          Gebruikersbeheer, schoolbeheer en platforminstellingen komen hier beschikbaar.
        </p>
      </div>
    </div>
  )
}