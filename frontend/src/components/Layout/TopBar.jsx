import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';

export default function TopBar({ onToggleLeftSidebar, onToggleRightSidebar, onNewChat }) {
  return (
    <div className="bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
      {/* Linker pijl */}
      <button
        onClick={onToggleLeftSidebar}
        className="text-blue-400 hover:text-blue-300 transition-colors p-2"
        aria-label="Toggle chat geschiedenis"
      >
        <ChevronLeft size={28} />
      </button>

      {/* Nieuwe opdracht knop - MIDDEN */}
      <button
        onClick={onNewChat}
        className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg 
                   flex items-center gap-2 transition-colors font-medium shadow-lg"
      >
        <Plus size={20} />
        Nieuwe opdracht
      </button>

      {/* Rechter pijl */}
      <button
        onClick={onToggleRightSidebar}
        className="text-blue-400 hover:text-blue-300 transition-colors p-2"
        aria-label="Toggle modules"
      >
        <ChevronRight size={28} />
      </button>
    </div>
  );
}