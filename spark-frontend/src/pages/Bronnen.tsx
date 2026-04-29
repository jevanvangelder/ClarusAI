import { FolderOpen, File, Download, Upload, FolderPlus, Edit } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function Bronnen() {
  const { role } = useAuth()
  const isStudent = role === 'student'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Bronnen</h2>
        <p className="text-white/50 text-sm mt-1">
          {isStudent 
            ? 'Lesmateriaal, PowerPoints, PDF\'s en andere documenten per vak'
            : 'Beheer lesmateriaal en documenten voor je klassen'
          }
        </p>
      </div>

      {/* Placeholder content */}
      <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div className={`w-20 h-20 rounded-full ${isStudent ? 'bg-green-500/10 border-green-500/20' : 'bg-orange-500/10 border-orange-500/20'} flex items-center justify-center mb-6`}>
          <FolderOpen size={36} className={isStudent ? 'text-green-400' : 'text-orange-400'} />
        </div>
        <h3 className="text-xl font-semibold text-white mb-3">
          Bronnen bibliotheek komt binnenkort
        </h3>
        <p className="text-white/40 text-sm max-w-md leading-relaxed">
          {isStudent 
            ? 'Hier vind je binnenkort al het lesmateriaal van je vakken. Je kunt documenten bekijken en downloaden.'
            : 'Hier kun je binnenkort lesmateriaal uploaden, mappen aanmaken en documenten organiseren per vak en klas.'
          }
        </p>
        
        {/* Features preview - STUDENT */}
        {isStudent && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-2xl w-full">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <FolderOpen size={20} className="text-green-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Mappen structuur</p>
              <p className="text-white/30 text-xs">Overzichtelijk georganiseerd per vak</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <File size={20} className="text-green-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Alle bestandstypes</p>
              <p className="text-white/30 text-xs">PowerPoint, PDF, Word, Excel en meer</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <Download size={20} className="text-green-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Snel downloaden</p>
              <p className="text-white/30 text-xs">Bekijk en download lesmateriaal</p>
            </div>
          </div>
        )}

        {/* Features preview - DOCENT/STAFF */}
        {!isStudent && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 max-w-2xl w-full">
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <Upload size={20} className="text-orange-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Bestanden uploaden</p>
              <p className="text-white/30 text-xs">Upload PowerPoints, PDF's, Word en Excel</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <FolderPlus size={20} className="text-orange-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Mappen aanmaken</p>
              <p className="text-white/30 text-xs">Organiseer materiaal in mappenstructuur</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-left">
              <Edit size={20} className="text-orange-400 mb-2" />
              <p className="text-white text-sm font-medium mb-1">Beheren</p>
              <p className="text-white/30 text-xs">Hernoemen, verplaatsen en verwijderen</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}