import { ChevronLeft, Search, Heart, FileText, Trash2 } from 'lucide-react';

export default function LeftSidebar({ onClose }) {
  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-white font-semibold text-lg">CHAT GESCHIEDENIS</h2>
        <button
          onClick={onClose}
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ChevronLeft size={24} />
        </button>
      </div>

      {/* Zoekbalk */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={18} />
          <input
            type="text"
            placeholder="Zoeken"
            className="w-full bg-gray-800 text-white border border-gray-700 rounded-lg pl-10 pr-4 py-2
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Chat lijst (scrollbaar) */}
      <div className="flex-1 overflow-y-auto px-4 space-y-2">
        <button className="w-full text-left bg-gray-800 hover:bg-gray-750 text-gray-300 
                           px-4 py-3 rounded-lg transition-colors">
          MAR1 SWOT Unile...
        </button>
        <button className="w-full text-left bg-gray-800 hover:bg-gray-750 text-gray-300 
                           px-4 py-3 rounded-lg transition-colors">
          BEC2 Opdrachthulp
        </button>
        <button className="w-full text-left bg-gray-800 hover:bg-gray-750 text-gray-300 
                           px-4 py-3 rounded-lg transition-colors">
          MVO Royal dutch s...
        </button>
      </div>

      {/* Footer secties */}
      <div className="border-t border-gray-700 p-4 space-y-3">
        <button className="w-full flex items-center gap-3 text-gray-300 hover:text-white 
                           px-4 py-2 hover:bg-gray-800 rounded transition-colors">
          <Heart size={20} />
          Favorieten
        </button>
        <button className="w-full flex items-center gap-3 text-gray-300 hover:text-white 
                           px-4 py-2 hover:bg-gray-800 rounded transition-colors">
          <FileText size={20} />
          Aantekeningen
        </button>
        <button className="w-full flex items-center gap-3 text-gray-300 hover:text-white 
                           px-4 py-2 hover:bg-gray-800 rounded transition-colors">
          <Trash2 size={20} />
          Prullenbak
        </button>
      </div>
    </div>
  );
}