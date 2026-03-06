interface Session {
  id: string
  title: string
  createdAt: number
}

interface SidebarProps {
  sessions: Session[]
  currentSessionId: string
  onSelectSession: (id: string) => void
  onNewSession: () => void
  onDeleteSession: (id: string) => void
  onClose: () => void
  connected: boolean
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

export default function Sidebar({
  sessions,
  currentSessionId,
  onSelectSession,
  onNewSession,
  onDeleteSession,
  onClose,
  connected,
}: SidebarProps) {
  return (
    <div className="w-72 h-full bg-[#1a1a2e] flex flex-col border-r border-white/10 animate-slideIn md:animate-none">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">🐈</span>
          <span className="text-lg font-semibold tracking-tight">nanobot</span>
        </div>
        <button
          onClick={onClose}
          className="md:hidden p-1 rounded-lg hover:bg-white/10 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* New session button */}
      <div className="px-4 py-3">
        <button
          onClick={onNewSession}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white font-medium text-sm
                     hover:brightness-110 hover:scale-[1.02] active:scale-[0.98] transition-all duration-150"
        >
          + 新建会话
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {sessions.map(session => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            className={`
              group flex items-center justify-between px-3 py-2.5 mx-1 mb-0.5 rounded-lg cursor-pointer
              transition-all duration-150
              ${session.id === currentSessionId
                ? 'bg-white/10 text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }
            `}
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{session.title}</div>
              <div className="text-xs text-gray-500 mt-0.5">{formatTime(session.createdAt)}</div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSession(session.id)
              }}
              className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-white/10 transition-all duration-150 ml-2 shrink-0"
              title="删除会话"
            >
              <svg className="w-4 h-4 text-gray-400 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      {/* Connection status */}
      <div className="px-5 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'} ${connected ? '' : 'animate-pulse'}`} />
          {connected ? '已连接' : '连接中…'}
        </div>
      </div>
    </div>
  )
}
