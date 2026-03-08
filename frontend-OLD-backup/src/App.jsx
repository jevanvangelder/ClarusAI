import { useState } from 'react';
import TopBar from './components/Layout/TopBar';
import LeftSidebar from './components/Sidebar/LeftSidebar';
import RightSidebar from './components/Sidebar/RightSidebar';
import ChatContainer from './components/Chat/ChatContainer';
import logo from './assets/ClarusAI logo.png';

function App() {
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(false);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(false);

  const handleNewChat = () => {
    window.location.reload();
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900">
      {/* Top Bar - ALTIJD bovenaan */}
      <TopBar
        onToggleLeftSidebar={() => setLeftSidebarOpen(!leftSidebarOpen)}
        onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
        onNewChat={handleNewChat}
      />

      {/* Main 3-kolommen layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - 3de kolom links */}
        {leftSidebarOpen && <LeftSidebar onClose={() => setLeftSidebarOpen(false)} />}

        {/* Chat Container - MIDDEN kolom (altijd zichtbaar) */}
        <div className="flex-1 flex flex-col items-center justify-center">
          {/* Logo en tekst gecentreerd */}
          <div className="flex flex-col items-center mb-8">
            <img src={logo} alt="ClarusAI Logo" className="w-64 h-64 mb-6" />
            <h1 className="text-5xl font-bold text-white mb-2">
              CLARUS<span className="text-blue-400">AI</span>
            </h1>
            <p className="text-2xl text-gray-300">Wat wil je vandaag leren?</p>
          </div>

          {/* Chat Container onderaan */}
          <div className="w-full px-4">
            <ChatContainer />
          </div>
        </div>

        {/* Right Sidebar - 3de kolom rechts */}
        {rightSidebarOpen && <RightSidebar onClose={() => setRightSidebarOpen(false)} />}
      </div>
    </div>
  );
}

export default App;