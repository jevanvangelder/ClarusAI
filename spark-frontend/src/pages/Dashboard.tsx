import { useAuth } from '@/contexts/AuthContext'
import {
  MessageSquare,
  BookOpen,
  FileText,
  BarChart3,
  ArrowRight,
  Sparkles,
  Users,
  TrendingUp,
  LucideIcon,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface QuickAction {
  label: string
  description: string
  icon: LucideIcon
  color: string
  path: string
}

export default function Dashboard() {
  const { user, profile, role } = useAuth()
  const navigate = useNavigate()

  // Begroeting op basis van tijdstip
  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Goedemorgen'
    if (hour < 18) return 'Goedemiddag'
    return 'Goedenavond'
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'gebruiker'

  // Snelle acties per rol
  const getQuickActions = (): QuickAction[] => {
    const actions: QuickAction[] = []

    if (role === 'admin' || role === 'school_admin' || role === 'teacher' || role === 'student') {
      actions.push({
        label: 'AI Chat',
        description: 'Stel een vraag aan ClarusAI',
        icon: MessageSquare,
        color: 'blue',
        path: '/chat',
      })
    }

    if (role === 'admin' || role === 'school_admin' || role === 'teacher' || role === 'student') {
      actions.push({
        label: 'Modules',
        description: 'Bekijk je lesmodules',
        icon: BookOpen,
        color: 'purple',
        path: '/modules',
      })
    }

    if (role === 'admin' || role === 'school_admin' || role === 'teacher') {
      actions.push({
        label: 'Opdrachten',
        description: role === 'teacher' ? 'Maak en beheer opdrachten' : 'Bekijk opdrachten',
        icon: FileText,
        color: 'green',
        path: '/opdrachten',
      })
    }

    if (role === 'admin' || role === 'school_admin' || role === 'teacher') {
      actions.push({
        label: 'Analyse',
        description: 'Bekijk voortgang en inzichten',
        icon: BarChart3,
        color: 'orange',
        path: '/analyse',
      })
    }

    if (role === 'admin' || role === 'school_admin' || role === 'teacher') {
      actions.push({
        label: 'Klassen',
        description: 'Beheer je klassen',
        icon: Users,
        color: 'cyan',
        path: '/klassen',
      })
    }

    if (role === 'student') {
      actions.push({
        label: 'Mijn opdrachten',
        description: 'Bekijk je openstaande opdrachten',
        icon: FileText,
        color: 'green',
        path: '/opdrachten',
      })
    }

    return actions
  }

  const quickActions = getQuickActions()

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-500/10',
          border: 'border-blue-500/20',
          icon: 'text-blue-400',
          hover: 'hover:border-blue-500/40 hover:bg-blue-500/15',
        }
      case 'purple':
        return {
          bg: 'bg-purple-500/10',
          border: 'border-purple-500/20',
          icon: 'text-purple-400',
          hover: 'hover:border-purple-500/40 hover:bg-purple-500/15',
        }
      case 'green':
        return {
          bg: 'bg-green-500/10',
          border: 'border-green-500/20',
          icon: 'text-green-400',
          hover: 'hover:border-green-500/40 hover:bg-green-500/15',
        }
      case 'orange':
        return {
          bg: 'bg-orange-500/10',
          border: 'border-orange-500/20',
          icon: 'text-orange-400',
          hover: 'hover:border-orange-500/40 hover:bg-orange-500/15',
        }
      case 'cyan':
        return {
          bg: 'bg-cyan-500/10',
          border: 'border-cyan-500/20',
          icon: 'text-cyan-400',
          hover: 'hover:border-cyan-500/40 hover:bg-cyan-500/15',
        }
      default:
        return {
          bg: 'bg-white/5',
          border: 'border-white/10',
          icon: 'text-white/60',
          hover: 'hover:border-white/20 hover:bg-white/10',
        }
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Welkom sectie */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 border border-white/10 rounded-2xl p-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {getGreeting()}, {displayName} 👋
            </h1>
            <p className="text-white/50 text-lg">
              {role === 'admin' && 'Welkom in het ClarusAI admin panel'}
              {role === 'school_admin' && 'Welkom op je school dashboard'}
              {role === 'teacher' && 'Wat wil je vandaag doen?'}
              {role === 'student' && 'Klaar om te leren? Laten we beginnen!'}
              {!role && 'Welkom bij ClarusAI'}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2">
            <Sparkles size={16} className="text-yellow-400" />
            <span className="text-sm text-white/60">AI-powered learning</span>
          </div>
        </div>
      </div>

      {/* Stat cards — alleen voor docenten en hoger */}
      {(role === 'admin' || role === 'school_admin' || role === 'teacher') && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/40 text-sm">Actieve leerlingen</span>
              <Users size={18} className="text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-white">—</p>
            <p className="text-xs text-white/30 mt-1">Binnenkort beschikbaar</p>
          </div>

          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/40 text-sm">Vragen vandaag</span>
              <MessageSquare size={18} className="text-purple-400" />
            </div>
            <p className="text-2xl font-bold text-white">—</p>
            <p className="text-xs text-white/30 mt-1">Binnenkort beschikbaar</p>
          </div>

          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/40 text-sm">Voortgang</span>
              <TrendingUp size={18} className="text-green-400" />
            </div>
            <p className="text-2xl font-bold text-white">—</p>
            <p className="text-xs text-white/30 mt-1">Binnenkort beschikbaar</p>
          </div>

          <div className="bg-[#0f1029] border border-white/10 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-white/40 text-sm">Opdrachten</span>
              <FileText size={18} className="text-orange-400" />
            </div>
            <p className="text-2xl font-bold text-white">—</p>
            <p className="text-xs text-white/30 mt-1">Binnenkort beschikbaar</p>
          </div>
        </div>
      )}

      {/* Snelle acties */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">Snelle acties</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {quickActions.map((action) => {
            const colors = getColorClasses(action.color)
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`
                  ${colors.bg} border ${colors.border} ${colors.hover}
                  rounded-xl p-5 text-left transition-all duration-200
                  group cursor-pointer
                `}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className={`p-2.5 rounded-lg ${colors.bg}`}>
                    <action.icon size={22} className={colors.icon} />
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-white/20 group-hover:text-white/50 transition-all group-hover:translate-x-1"
                  />
                </div>
                <h3 className="text-white font-semibold mb-1">{action.label}</h3>
                <p className="text-white/40 text-sm">{action.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* AI Tip */}
      <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="p-2.5 bg-blue-500/10 rounded-lg">
            <Sparkles size={22} className="text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-1">AI-tip</h3>
            <p className="text-white/50 text-sm leading-relaxed">
              {role === 'teacher'
                ? 'Gebruik de AI Chat om snel toetsvragen te genereren op basis van je lesmateriaal. Probeer het eens!'
                : 'Gebruik de AI Chat om uitleg te krijgen over moeilijke onderwerpen. ClarusAI past zich aan jouw niveau aan!'}
            </p>
            <button
              onClick={() => navigate('/chat')}
              className="mt-3 text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
            >
              Start een chat <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}