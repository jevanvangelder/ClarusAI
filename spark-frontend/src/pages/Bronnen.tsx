import { FolderOpen, File, Download, Search } from 'lucide-react'

export default function Bronnen() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white">Bronnen</h2>
        <p className="text-white/50 text-sm mt-1">
          Lesmateriaal, PowerPoints, PDF's en andere documenten per vak
        </p>
      </div>

      {/* Placeholder content */}
      <div className="bg-[#0f1029] border border-white/10 rounded-xl p-12 flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-6">
          <FolderOpen size={36} className="text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-white mb-3">
          Bronnen bibliotheek komt binnenkort
        </h3>
        <p className="text-white/40 text-sm max-w-md leading-relaxed">
          Hier vind je binnenkort al het lesmateriaal van je vakken.
          Docenten en schoolmedewerkers kunnen bestanden uploaden en mappen aanmaken.
        </p>
        
        {/* Features preview */}
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
      </div>
    </div>
  )
}