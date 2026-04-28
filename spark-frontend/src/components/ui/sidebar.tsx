import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { 
  LayoutDashboard, MessageSquare, BookOpen, Users, 
  FileText, BarChart3, Settings, LogOut, Menu, X 
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

interface NavItem {
  icon: React.ElementType
  label: string
  path: string
  roles?: string[]
}

export default function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { role, user } = useAuth()
  
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed')
    return saved === 'true'
  })

  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isCollapsed))
  }, [isCollapsed])

  const navItems: NavItem[] = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: MessageSquare, label: 'Chat', path: '/chat' },
    { icon: BookOpen, label: 'Modules', path: '/modules' },
    { icon: Users, label: 'Klassen', path: '/klassen', roles: ['teacher', 'school_admin', 'admin'] },
    { icon: FileText, label: 'Opdrachten', path: '/opdrachten' },
    { icon: BarChart3, label: 'Analyse', path: '/analyse', roles: ['teacher', 'school_admin', 'admin'] },
  ]

  const filteredNavItems = navItems.filter(item => 
    !item.roles || item.roles.includes(role || '')
  )

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div 
      className={`bg-[#0a0d1f] border-r border-white/10 flex flex-col transition-all duration-300 ${
        isCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="p-4 border-b border-white/10 flex items-center justify-between">
        {!isCollapsed && (
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">CA</span>
            </div>
            <span className="text-white font-bold text-lg">CLARUSAI</span>
          </Link>
        )}
        <button
          onClick={() => setIsCollapsed(prev => !prev)}
          className={`p-2 hover:bg-white/5 rounded-lg transition-colors text-white/50 hover:text-white ${
            isCollapsed ? 'mx-auto' : ''
          }`}
          title={isCollapsed ? 'Uitklappen' : 'Inklappen'}
        >
          {isCollapsed ? <Menu size={20} /> : <X size={20} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {filteredNavItems.map(item => {
          const Icon = item.icon
          const active = isActive(item.path)
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
                active 
                  ? 'bg-blue-500/10 text-blue-400' 
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
              title={isCollapsed ? item.label : ''}
            >
              <Icon size={20} className="shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
              
              {isCollapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 border-t border-white/10 space-y-1">
        <Link
          to="/instellingen"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative ${
            isActive('/instellingen')
              ? 'bg-blue-500/10 text-blue-400'
              : 'text-white/60 hover:bg-white/5 hover:text-white'
          } ${isCollapsed ? 'justify-center' : ''}`}
          title={isCollapsed ? 'Instellingen' : ''}
        >
          <Settings size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Instellingen</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              Instellingen
            </div>
          )}
        </Link>

        <button
          onClick={handleLogout}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-all group relative ${
            isCollapsed ? 'justify-center' : ''
          }`}
          title={isCollapsed ? 'Uitloggen' : ''}
        >
          <LogOut size={20} className="shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium">Uitloggen</span>}
          {isCollapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
              Uitloggen
            </div>
          )}
        </button>

        {!isCollapsed && user && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold">
                {user.email?.[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{user.email}</p>
                <p className="text-white/40 text-xs capitalize">{role}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}