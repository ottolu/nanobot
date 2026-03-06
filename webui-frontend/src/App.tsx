import { useState, useCallback, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'

interface Session {
  id: string
  title: string
  createdAt: number
}

function generateId() {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function App() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const initial: Session = { id: generateId(), title: '新会话', createdAt: Date.now() }
    return [initial]
  })
  const [currentSessionId, setCurrentSessionId] = useState<string>(() => sessions[0].id)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const { connected, messages, sendMessage, isGenerating, clearMessages } = useWebSocket()

  // Update session title from first user message
  useEffect(() => {
    const firstUserMsg = messages.find(m => m.role === 'user')
    if (firstUserMsg) {
      const title = firstUserMsg.content.slice(0, 20) + (firstUserMsg.content.length > 20 ? '…' : '')
      setSessions(prev =>
        prev.map(s => s.id === currentSessionId ? { ...s, title } : s)
      )
    }
  }, [messages, currentSessionId])

  const handleNewSession = useCallback(() => {
    const newSession: Session = { id: generateId(), title: '新会话', createdAt: Date.now() }
    setSessions(prev => [newSession, ...prev])
    setCurrentSessionId(newSession.id)
    clearMessages()
    setSidebarOpen(false)
  }, [clearMessages])

  const handleSelectSession = useCallback((id: string) => {
    if (id !== currentSessionId) {
      setCurrentSessionId(id)
      clearMessages()
    }
    setSidebarOpen(false)
  }, [currentSessionId, clearMessages])

  const handleDeleteSession = useCallback((id: string) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id)
      if (filtered.length === 0) {
        const newSession: Session = { id: generateId(), title: '新会话', createdAt: Date.now() }
        setCurrentSessionId(newSession.id)
        clearMessages()
        return [newSession]
      }
      if (id === currentSessionId) {
        setCurrentSessionId(filtered[0].id)
        clearMessages()
      }
      return filtered
    })
  }, [currentSessionId, clearMessages])

  const handleSendMessage = useCallback((content: string) => {
    sendMessage(content, currentSessionId)
  }, [sendMessage, currentSessionId])

  return (
    <div className="flex h-dvh w-full bg-[#0f0f0f] overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:relative z-50 h-full
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 transition-transform duration-200 ease-out
      `}>
        <Sidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onSelectSession={handleSelectSession}
          onNewSession={handleNewSession}
          onDeleteSession={handleDeleteSession}
          onClose={() => setSidebarOpen(false)}
          connected={connected}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <div className="md:hidden flex items-center px-4 py-3 border-b border-white/10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 font-medium">nanobot 🐈</span>
        </div>

        <ChatView
          messages={messages}
          isGenerating={isGenerating}
          onSendMessage={handleSendMessage}
          sessionId={currentSessionId}
        />
      </div>
    </div>
  )
}
