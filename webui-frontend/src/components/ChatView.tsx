import { useRef, useEffect } from 'react'
import type { Message } from '../hooks/useWebSocket'
import MessageBubble from './MessageBubble'
import InputBar from './InputBar'

interface ChatViewProps {
  messages: Message[]
  isGenerating: boolean
  onSendMessage: (content: string) => void
  sessionId: string
}

const quickQuestions = [
  '你能做什么？',
  '帮我写一个 Python 脚本',
  '解释一下量子计算',
  '今天天气怎么样？',
]

export default function ChatView({ messages, isGenerating, onSendMessage, sessionId: _sessionId }: ChatViewProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const isEmpty = messages.length === 0

  return (
    <div className="flex-1 flex flex-col min-h-0 relative">
      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        {isEmpty ? (
          /* Welcome page */
          <div className="flex flex-col items-center justify-center h-full px-4 animate-fadeIn">
            <div className="text-7xl mb-6">🐈</div>
            <h1 className="text-2xl font-semibold mb-2">你好，我是 nanobot</h1>
            <p className="text-gray-400 mb-8 text-center max-w-md">
              一个轻量级 AI 助手，随时准备帮助你。试试问我一些问题吧！
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg w-full">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => onSendMessage(q)}
                  className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-sm text-gray-300
                             hover:bg-white/10 hover:border-white/20 hover:text-white
                             transition-all duration-150 text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Message list */
          <div className="max-w-3xl mx-auto px-4 py-6">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} isLast={msg === messages[messages.length - 1]} isGenerating={isGenerating} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Gradient shadow above input */}
      <div className="pointer-events-none h-8 bg-gradient-to-t from-[#0f0f0f] to-transparent -mt-8 relative z-10" />

      {/* Input bar */}
      <div className="max-w-3xl mx-auto w-full px-4 pb-4">
        <InputBar onSend={onSendMessage} disabled={!true} isGenerating={isGenerating} />
      </div>
    </div>
  )
}
