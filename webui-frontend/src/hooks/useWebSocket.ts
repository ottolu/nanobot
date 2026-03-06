import { useState, useEffect, useRef, useCallback } from 'react'

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolHints: string[]
}

interface WSMessage {
  type: 'message' | 'progress' | 'tool_hint'
  content?: string
  done?: boolean
  session_id?: string
  hint?: string
}

export function useWebSocket() {
  const [connected, setConnected] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptRef = useRef(0)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const currentAssistantIdRef = useRef<string | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`)

    ws.onopen = () => {
      setConnected(true)
      reconnectAttemptRef.current = 0
    }

    ws.onclose = () => {
      setConnected(false)
      wsRef.current = null
      // Exponential backoff reconnect
      const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000)
      reconnectAttemptRef.current += 1
      reconnectTimerRef.current = setTimeout(connect, delay)
    }

    ws.onerror = () => {
      ws.close()
    }

    ws.onmessage = (event) => {
      let data: WSMessage
      try {
        data = JSON.parse(event.data)
      } catch {
        return
      }

      if (data.type === 'message') {
        const content = data.content ?? ''

        // Append content if present (works for both streaming chunks and final messages)
        if (content) {
          setIsGenerating(true)
          setMessages(prev => {
            const lastMsg = prev[prev.length - 1]
            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.id === currentAssistantIdRef.current) {
              // Append to existing assistant message
              return prev.map((m, i) =>
                i === prev.length - 1
                  ? { ...m, content: m.content + content }
                  : m
              )
            } else {
              // Create new assistant message
              const newId = `assistant-${Date.now()}`
              currentAssistantIdRef.current = newId
              return [...prev, {
                id: newId,
                role: 'assistant' as const,
                content,
                timestamp: Date.now(),
                toolHints: [],
              }]
            }
          })
        }

        // Mark generation complete when done
        if (data.done === true || data.done === undefined) {
          setIsGenerating(false)
          currentAssistantIdRef.current = null
        }
      } else if (data.type === 'tool_hint') {
        // Append tool hint to current assistant message
        const hint = data.hint ?? data.content ?? ''
        if (!hint) return
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1]
          if (lastMsg && lastMsg.role === 'assistant') {
            return prev.map((m, i) =>
              i === prev.length - 1
                ? { ...m, toolHints: [...m.toolHints, hint] }
                : m
            )
          }
          // Create a new assistant message with the tool hint
          const newId = `assistant-${Date.now()}`
          currentAssistantIdRef.current = newId
          return [...prev, {
            id: newId,
            role: 'assistant' as const,
            content: '',
            timestamp: Date.now(),
            toolHints: [hint],
          }]
        })
      }
      // progress type can be handled later if needed
    }

    wsRef.current = ws
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  const sendMessage = useCallback((content: string, sessionId: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return

    // Add user message locally
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      toolHints: [],
    }
    setMessages(prev => [...prev, userMsg])
    setIsGenerating(true)

    wsRef.current.send(JSON.stringify({
      type: 'message',
      content,
      session_id: sessionId,
    }))
  }, [])

  const clearMessages = useCallback(() => {
    setMessages([])
    setIsGenerating(false)
    currentAssistantIdRef.current = null
  }, [])

  return { connected, messages, sendMessage, isGenerating, clearMessages }
}
