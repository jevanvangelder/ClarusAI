import { Briefcase, Upload, FileText, Clock, Eye, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function Portfolio() {
  const { role } = useAuth()
  const isStudent = role === 'student'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Portfolio</h2>
        <p className="text-white/50 text-sm mt-1">
          {isStudent 
            ? 'Lever documenten en papers in volgens de deadlines van je docent'
            : 'Beheer portfolio-opdrachten en beoordeel ingediende documenten'
          }
        </p>
      </div>

      {/* Placeholder content */}
      <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div className={`w-20 h-20 rounded-full ${isStudent ? 'bg-blue-500/10 border-blue-500/20' : 'bg-purple-500/10 border-purple-500/20'} flex items-center justify-center mb-6`}>
          <Briefcase size={36} className={isStudent ? 'text-blue-400' : 'text-purple-400'} />
        </div>
        <h3 className="text-xl font-semibold text-white mb-3">
          Portfolio systeem komt binnenkort
        </h3>
        <p className="text-white/40 text-sm max-w-md leading-relaxed">
          {isStudent 
            ? 'Hier kun je binnenkort documenten, papers en portfolio-opdrachten inleveren. Je ontvangt feedback en beoordelingen van je docenten.'
            : 'Hier kun je binnenkort portfolio-opdrachten aanmaken, ingediende documenten beoordelen en feedback geven aan studenten.'
          }
        </p>
        
        {/* Features preview - STUDENT */}
        {isStudent && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-2xl w-full">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <Upload size={20} className="text-blue-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Upload documenten</p>
              <p className="text-white/30 text-xs">PDF, Word, Excel en meer</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <Clock size={20} className="text-blue-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Deadlines</p>
              <p className="text-white/30 text-xs">Blijf op de hoogte van inlevermomenten</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <FileText size={20} className="text-blue-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Feedback</p>
              <p className="text-white/30 text-xs">Ontvang beoordelingen van docenten</p>
            </div>
          </div>
        )}

        {/* Features preview - DOCENT/STAFF */}
        {!isStudent && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-2xl w-full">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <FileText size={20} className="text-purple-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Opdrachten aanmaken</p>
              <p className="text-white/30 text-xs">Stel portfolio-opdrachten in met deadlines</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <Eye size={20} className="text-purple-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Inzendingen bekijken</p>
              <p className="text-white/30 text-xs">Bekijk ingediende documenten</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <CheckCircle size={20} className="text-purple-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Beoordelen</p>
              <p className="text-white/30 text-xs">Geef cijfers en schriftelijke feedback</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}