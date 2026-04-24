import { useAuth } from '@/contexts/AuthContext'
import {
  MessageSquare,
  BookOpen,
  FileText,
  BarChart3,
  ArrowRight,
  Sparkles,
  Users,
  LucideIcon,
  Flag,
  Clock,
  Inbox,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface QuickAction {
  label: string
  description: string
  icon: LucideIcon
  color: string
  path: string
}

interface DocentStats {
  te_beoordelen: number | null
  actieve_opdrachten: number | null
  deadline_deze_week: number | null
  ingeleverd_vandaag: number | null
}

export default function Dashboard() {
  const { user, profile, role } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<DocentStats>({
    te_beoordelen: null,
    actieve_opdrachten: null,
    deadline_deze_week: null,
    ingeleverd_vandaag: null,
  })

  const getGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Goedemorgen'
    if (hour < 18) return 'Goedemiddag'
    return 'Goedenavond'
  }

  const displayName = profile?.full_name || user?.email?.split('@')[0] || 'gebruiker'

  useEffect(() => {
    const loadStats = async () => {
      if (!user || (role !== 'teacher' && role !== 'admin' && role !== 'school_admin')) return

      const { data: opdrachten } = await supabase
        .from('assignments')
        .select('id')
        .eq('created_by', user.id)
        .eq('is_active', true)

      const opdrachtIds = (opdrachten || []).map(o => o.id)
      const actieve_opdrachten = opdrachtIds.length

      let te_beoordelen = 0
      let deadline_deze_week = 0
      let ingeleverd_vandaag = 0

      if (opdrachtIds.length > 0) {
        // Te beoordelen: AI klaar maar docent nog niet afgerond
        const { count: teBeoordelenCount } = await supabase
          .from('assignment_submissions')
          .select('*', { count: 'exact', head: true })
          .in('assignment_id', opdrachtIds)
          .eq('ai_nakijk_status', 'done')
          .not('ingeleverd_op', 'is', null)
        te_beoordelen = teBeoordelenCount || 0

        // Ingeleverd vandaag
        const vandaagStart = new Date()
        vandaagStart.setHours(0, 0, 0, 0)
        const { count: vandaagCount } = await supabase
          .from('assignment_submissions')
          .select('*', { count: 'exact', head: true })
          .in('assignment_id', opdrachtIds)
          .gte('ingeleverd_op', vandaagStart.toISOString())
        ingeleverd_vandaag = vandaagCount || 0

        // Deadline deze week: opdrachten via assignment_classes met deadline komende 7 dagen
        const nu = new Date()
        const over7dagen = new Date()
        over7dagen.setDate(nu.getDate() + 7)

        const { data: acData } = await supabase
          .from('assignment_classes')
          .select('assignment_id, deadline')
          .in('assignment_id', opdrachtIds)
          .gte('deadline', nu.toISOString())
          .lte('deadline', over7dagen.toISOString())

        // Unieke opdrachten met deadline deze week
        const uniekeOpdrachtIds = new Set((acData || []).map(ac => ac.assignment_id))
        deadline_deze_week = uniekeOpdrachtIds.size
      }

      setStats({ te_beoordelen, actieve_opdrachten, deadline_deze_week, ingeleverd_vandaag })
    }

    loadStats()
  }, [user, role])

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
      case 'blue':   return { bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: 'text-blue-400',   hover: 'hover:border-blue-500/40 hover:bg-blue-500/15' }
      case 'purple': return { bg: 'bg-purple-500/10', border: 'border-purple-500/20', icon: 'text-purple-400', hover: 'hover:border-purple-500/40 hover:bg-purple-500/15' }
      case 'green':  return { bg: 'bg-green-500/10',  border: 'border-green-500/20',  icon: 'text-green-400',  hover: 'hover:border-green-500/40 hover:bg-green-500/15' }
      case 'orange': return { bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: 'text-orange-400', hover: 'hover:border-orange-500/40 hover:bg-orange-500/15' }
      case 'cyan':   return { bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20',   icon: 'text-cyan-400',   hover: 'hover:border-cyan-500/40 hover:bg-cyan-500/15' }
      default:       return { bg: 'bg-white/5',        border: 'border-white/10',       icon: 'text-white/60',   hover: 'hover:border-white/20 hover:bg-white/10' }
    }
  }

  const docentStatCards = [
    {
      label: 'Te beoordelen',
      value: stats.te_beoordelen,
      icon: Flag,
      color: stats.te_beoordelen !== null && stats.te_beoordelen > 0 ? 'text-amber-400' : 'text-green-400',
      subtext: stats.te_beoordelen !== null
        ? stats.te_beoordelen > 0 ? '→ Klik om te bekijken' : '✓ Alles beoordeeld'
        : 'Laden...',
      onClick: () => navigate('/analyse'),
    },
    {
      label: 'Actieve opdrachten',
      value: stats.actieve_opdrachten,
      icon: FileText,
      color: 'text-purple-400',
      subtext: '→ Bekijk opdrachten',
      onClick: () => navigate('/opdrachten'),
    },
    {
      label: 'Deadline deze week',
      value: stats.deadline_deze_week,
      icon: Clock,
      color: stats.deadline_deze_week !== null && stats.deadline_deze_week > 0 ? 'text-orange-400' : 'text-white/40',
      subtext: stats.deadline_deze_week !== null && stats.deadline_deze_week > 0
        ? '→ Controleer deadlines'
        : 'Geen deadlines',
      onClick: () => navigate('/opdrachten'),
    },
    {
      label: 'Ingeleverd vandaag',
      value: stats.ingeleverd_vandaag,
      icon: Inbox,
      color: stats.ingeleverd_vandaag !== null && stats.ingeleverd_vandaag > 0 ? 'text-blue-400' : 'text-white/40',
      subtext: stats.ingeleverd_vandaag !== null && stats.ingeleverd_vandaag > 0
        ? '→ Bekijk inzendingen'
        : 'Nog niets vandaag',
      onClick: () => navigate('/analyse'),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Welkom sectie */}
      <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-cyan-500/10 border border-white/10 rounded-2xl p-5 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-3xl font-bold text-white mb-1 sm:mb-2 leading-tight">
              {getGreeting()}, {displayName} 👋
            </h1>
            <p className="text-white/50 text-sm sm:text-lg">
              {role === 'admin' && 'Welkom in het ClarusAI admin panel'}
              {role === 'school_admin' && 'Welkom op je school dashboard'}
              {role === 'teacher' && 'Wat wil je vandaag doen?'}
              {role === 'student' && 'Klaar om te leren? Laten we beginnen!'}
              {!role && 'Welkom bij ClarusAI'}
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2 shrink-0">
            <Sparkles size={16} className="text-yellow-400" />
            <span className="text-sm text-white/60">AI-powered learning</span>
          </div>
        </div>
      </div>

      {/* Stat cards — alleen voor docenten en hoger */}
      {(role === 'admin' || role === 'school_admin' || role === 'teacher') && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {docentStatCards.map(stat => (
            <button
              key={stat.label}
              onClick={stat.onClick}
              className="bg-[#0f1029] border border-white/10 hover:border-white/20 rounded-xl p-4 text-left transition-all group"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/40 text-xs leading-tight">{stat.label}</span>
                <stat.icon size={16} className={stat.color} />
              </div>
              {stat.value === null ? (
                <>
                  <div className="h-7 w-8 bg-white/5 rounded animate-pulse mb-1" />
                  <p className="text-xs text-white/20 mt-1 hidden sm:block">Laden...</p>
                </>
              ) : (
                <>
                  <p className={`text-xl sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-white/25 mt-1 hidden sm:block group-hover:text-white/40 transition-colors">
                    {stat.subtext}
                  </p>
                </>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Snelle acties */}
      <div>
        <h2 className="text-base sm:text-lg font-semibold text-white mb-3">Snelle acties</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {quickActions.map((action) => {
            const colors = getColorClasses(action.color)
            return (
              <button
                key={action.path}
                onClick={() => navigate(action.path)}
                className={`${colors.bg} border ${colors.border} ${colors.hover} rounded-xl p-4 sm:p-5 text-left transition-all duration-200 group cursor-pointer`}
              >
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className={`p-2 sm:p-2.5 rounded-lg ${colors.bg}`}>
                    <action.icon size={20} className={colors.icon} />
                  </div>
                  <ArrowRight size={16} className="text-white/20 group-hover:text-white/50 transition-all group-hover:translate-x-1" />
                </div>
                <h3 className="text-white font-semibold mb-0.5 sm:mb-1 text-sm sm:text-base">{action.label}</h3>
                <p className="text-white/40 text-xs sm:text-sm">{action.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* AI Tip */}
      <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border border-blue-500/20 rounded-xl p-4 sm:p-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <div className="p-2 sm:p-2.5 bg-blue-500/10 rounded-lg shrink-0">
            <Sparkles size={20} className="text-blue-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-white font-semibold mb-1 text-sm sm:text-base">AI-tip</h3>
            <p className="text-white/50 text-xs sm:text-sm leading-relaxed">
              {role === 'teacher'
                ? 'Gebruik de AI Chat om snel toetsvragen te genereren op basis van je lesmateriaal. Probeer het eens!'
                : 'Gebruik de AI Chat om uitleg te krijgen over moeilijke onderwerpen. ClarusAI past zich aan jouw niveau aan!'}
            </p>
            <button
              onClick={() => navigate('/chat')}
              className="mt-2 sm:mt-3 text-xs sm:text-sm text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 transition-colors"
            >
              Start een chat <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}