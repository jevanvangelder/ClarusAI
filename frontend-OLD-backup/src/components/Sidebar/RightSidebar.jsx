import { ChevronRight, MoreVertical, Plus } from 'lucide-react';
import { useState } from 'react';

export default function RightSidebar({ onClose }) {
  const [activeModules, setActiveModules] = useState(['praktijk']);

  const toggleModule = (id) => {
    setActiveModules(prev => 
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  return (
    <div className="w-80 bg-gray-900 border-l border-gray-700 flex flex-col h-full flex-shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <button
          onClick={onClose}
          className="text-blue-400 hover:text-blue-300 transition-colors"
        >
          <ChevronRight size={24} />
        </button>
        <h2 className="text-white font-semibold text-lg">MODULES</h2>
      </div>

      {/* Modules lijst (scrollbaar) */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <button className="w-full bg-gray-800 hover:bg-gray-750 text-white 
                           px-4 py-3 rounded-lg transition-colors text-center">
          Samenvattingen maken
        </button>

        <div className="relative">
          <button
            onClick={() => toggleModule('praktijk')}
            className={`w-full px-4 py-3 rounded-lg transition-colors text-center relative
                       ${activeModules.includes('praktijk') 
                         ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                         : 'bg-gray-800 hover:bg-gray-750 text-white'}`}
          >
            Praktijk voorbeelden
            {activeModules.includes('praktijk') && (
              <button className="absolute right-2 top-1/2 transform -translate-y-1/2 
                                 hover:bg-blue-700 p-1 rounded">
                <MoreVertical size={18} />
              </button>
            )}
          </button>
        </div>

        <button className="w-full bg-gray-800 hover:bg-gray-750 text-white 
                           px-4 py-3 rounded-lg transition-colors text-center">
          Oefentoets<br />(open vragen)
        </button>

        <button className="w-full bg-gray-800 hover:bg-gray-750 text-white 
                           px-4 py-3 rounded-lg transition-colors text-center">
          Huiswerk<br />ondersteuning
        </button>

        <button className="w-full bg-gray-800 hover:bg-gray-750 text-white 
                           px-4 py-3 rounded-lg transition-colors text-center">
          Feedback
        </button>
      </div>

      {/* Add nieuwe module knop */}
      <div className="p-4 border-t border-gray-700">
        <button className="w-full bg-gradient-to-r from-blue-600 to-purple-600 
                           hover:from-blue-700 hover:to-purple-700
                           text-white px-4 py-3 rounded-lg transition-colors 
                           flex items-center justify-center gap-2">
          <Plus size={24} />
        </button>
      </div>
    </div>
  );
}