import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  MessageSquare,
  BookOpen,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  FileText,
  Shield,
  GraduationCap,
} from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  const getNavItems = () => {
    const items = [
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        path: '/',
        roles: ['admin', 'school_admin', 'teacher', 'student'],
      },
      {
        label: 'Chat',
        icon: MessageSquare,
        path: '/chat',
        roles: ['admin', 'school_admin', 'teacher', 'student'],
      },
      {
        label: 'Modules',
        icon: BookOpen,
        path: '/modules',
        roles: ['admin', 'school_admin', 'teacher', 'student'],
      },
      {
        label: 'Klassen',
        icon: Users,
        path: '/klassen',
        roles: ['admin', 'school_admin', 'teacher'],
      },
      {
        label: 'Mijn Vakken',
        icon: GraduationCap,
        path: '/vakken',
        roles: ['student'],
      },
      {
        label: 'Opdrachten',
        icon: FileText,
        path: '/opdrachten',
        roles: ['admin', 'school_admin', 'teacher', 'student'],
      },
      {
        label: 'Analyse',
        icon: BarChart3,
        path: '/analyse',
        roles: ['admin', 'school_admin', 'teacher'],
      },
      {
        label: 'Admin',
        icon: Shield,
        path: '/admin',
        roles: ['admin'],
      },
    ]

    return items.filter((item) => role && item.roles.includes(role))
  }

  const navItems = getNavItems()

  const getRoleName = () => {
    switch (role) {
      case 'admin': return 'Admin'
      case 'school_admin': return 'Schoolleiding'
      case 'teacher': return 'Docent'
      case 'student': return 'Student'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-[#0f1029] border-r border-white/10
          flex flex-col
          transform transition-transform duration-200 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10">
          <img
            src="/logo.png"
            alt="ClarusAI"
            className="h-8 w-8"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <span className="text-xl font-bold text-white">
            CLARUS<span className="text-blue-400">AI</span>
          </span>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false)
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-all duration-150
                  ${isActive
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                  }
                `}
              >
                <item.icon size={20} />
                {item.label}
              </button>
            )
          })}
        </nav>

        {/* User section */}
        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-blue-400 text-sm font-semibold">
                {profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {profile?.full_name || user?.email}
              </p>
              <p className="text-xs text-white/40">{getRoleName()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => navigate('/instellingen')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 transition-all"
            >
              <Settings size={14} />
              Instellingen
            </button>
            <button
              onClick={handleSignOut}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={14} />
              Uitloggen
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-[#0f1029]/80 backdrop-blur-sm border-b border-white/10 flex items-center px-4 lg:px-6 sticky top-0 z-30">
          <button
            className="lg:hidden text-white/60 hover:text-white mr-4"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold text-white">
              {navItems.find((item) => item.path === location.pathname)?.label || 'ClarusAI'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm text-white/80">{profile?.full_name || user?.email}</p>
              <p className="text-xs text-white/40">{getRoleName()}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
              <span className="text-blue-400 text-sm font-semibold">
                {profile?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}