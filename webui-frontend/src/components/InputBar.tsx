import { useState, useRef, useEffect, useCallback } from 'react'

interface InputBarProps {
  onSend: (content: string) => void
  disabled: boolean
  isGenerating: boolean
}

export default function InputBar({ onSend, disabled: _disabled, isGenerating }: InputBarProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxHeight = 6 * 24 // ~6 lines
    el.style.height = Math.min(el.scrollHeight, maxHeight) + 'px'
  }, [text])

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || isGenerating) return
    onSend(trimmed)
    setText('')
    // Reset height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, isGenerating, onSend])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex items-end gap-2 bg-[#1a1a2e] rounded-2xl border border-white/10 px-4 py-3
                    focus-within:border-[#667eea]/50 transition-colors">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入消息…"
        rows={1}
        className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 resize-none outline-none
                   leading-6 max-h-36"
      />

      {isGenerating ? (
        /* Stop button */
        <button
          className="shrink-0 w-9 h-9 rounded-full bg-red-500/20 border border-red-500/30
                     flex items-center justify-center hover:bg-red-500/30 transition-all duration-150"
          title="停止生成"
        >
          <div className="w-3 h-3 rounded-sm bg-red-400" />
        </button>
      ) : (
        /* Send button */
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-r from-[#667eea] to-[#764ba2]
                     flex items-center justify-center
                     disabled:opacity-30 disabled:cursor-not-allowed
                     hover:brightness-110 hover:scale-105 active:scale-95
                     transition-all duration-150"
        >
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
