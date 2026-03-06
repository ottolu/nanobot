import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Message } from '../hooks/useWebSocket'
import type { Components } from 'react-markdown'

interface MessageBubbleProps {
  message: Message
  isLast: boolean
  isGenerating: boolean
}

function CodeBlock({ className, children }: { className?: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const match = /language-(\w+)/.exec(className ?? '')
  const language = match ? match[1] : ''

  const handleCopy = useCallback(() => {
    const text = String(children).replace(/\n$/, '')
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [children])

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-white/10">
      <div className="flex items-center justify-between px-4 py-2 bg-[#1a1a2e] text-xs text-gray-400">
        <span>{language || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 hover:text-white transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              已复制
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              复制
            </>
          )}
        </button>
      </div>
      <pre className="!m-0 !rounded-none">
        <code className={className}>{children}</code>
      </pre>
    </div>
  )
}

export default function MessageBubble({ message, isLast, isGenerating }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const showCursor = isLast && isGenerating && !isUser

  const markdownComponents: Components = {
    code({ className, children, ...props }) {
      const isInline = !className && typeof children === 'string' && !children.includes('\n')
      if (isInline) {
        return <code className="bg-white/10 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
      }
      return <CodeBlock className={className}>{children}</CodeBlock>
    },
    pre({ children }) {
      // Let CodeBlock handle the wrapping
      return <>{children}</>
    },
  }

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fadeIn">
        <div className="max-w-[80%] px-4 py-3 rounded-2xl rounded-br-md bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3 mb-4 animate-fadeIn">
      {/* Avatar */}
      <div className="shrink-0 w-8 h-8 rounded-full bg-[#1a1a2e] border border-white/10 flex items-center justify-center text-base">
        🐈
      </div>

      <div className="flex-1 min-w-0">
        {/* Tool hints */}
        {message.toolHints.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {message.toolHints.map((hint, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {hint}
              </span>
            ))}
          </div>
        )}

        {/* Content */}
        {message.content ? (
          <div className="bg-[#1e1e2e] rounded-2xl rounded-tl-md px-4 py-3 border border-white/5">
            <div className={`markdown-body text-sm text-gray-100 ${showCursor ? 'typing-cursor' : ''}`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
                {message.content}
              </ReactMarkdown>
            </div>
          </div>
        ) : showCursor ? (
          <div className="bg-[#1e1e2e] rounded-2xl rounded-tl-md px-4 py-3 border border-white/5">
            <div className="flex items-center gap-1.5 py-1">
              <div className="w-2 h-2 rounded-full bg-gray-400 dot-bounce-1" />
              <div className="w-2 h-2 rounded-full bg-gray-400 dot-bounce-2" />
              <div className="w-2 h-2 rounded-full bg-gray-400 dot-bounce-3" />
            </div>
          </div>
        ) : null}

        {/* Timestamp */}
        <div className="text-xs text-gray-600 mt-1 ml-1">
          {new Date(message.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
