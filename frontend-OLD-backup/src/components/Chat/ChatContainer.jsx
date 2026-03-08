import { useState } from 'react';
import EmptyState from './EmptyState';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

export default function ChatContainer() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (content) => {
    const userMessage = { role: 'user', content };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: content })
      });

      const data = await response.json();
      const aiMessage = { role: 'assistant', content: data.response };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { 
        role: 'assistant', 
        content: 'Sorry, er ging iets mis. Probeer het opnieuw.' 
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Content area - groeit mee */}
      <div className="flex-1 overflow-hidden">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <MessageList messages={messages} />
        )}
      </div>

      {/* Input - ALTIJD onderaan */}
      <div className="flex-shrink-0">
        <MessageInput onSendMessage={handleSendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}