import { useState } from 'react';
import { Send, Upload } from 'lucide-react';

export default function MessageInput({ onSendMessage, disabled }) {
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSendMessage(message);
      setMessage('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-gray-700 p-6 bg-gray-900">
      {/* Bestanden uploaden knop - BOVEN input */}
      <div className="flex justify-end mb-3">
        <button className="text-gray-400 hover:text-white flex items-center gap-2 px-4 py-2 
                           border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
          <Upload size={18} />
          Bestanden uploaden
        </button>
      </div>

      {/* Input area */}
      <form onSubmit={handleSubmit} className="flex gap-3 items-end">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Stel een vraag..."
          disabled={disabled}
          className="flex-1 bg-gray-800 text-white border border-gray-700 rounded-lg px-4 py-3 
                     resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 
                     disabled:opacity-50 disabled:cursor-not-allowed"
          rows={2}
        />
        
        <button
          type="submit"
          disabled={!message.trim() || disabled}
          className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed
                     text-white p-3 rounded-lg transition-colors flex items-center justify-center"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
}