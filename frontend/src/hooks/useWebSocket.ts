import { useEffect, useRef, useCallback } from 'react'
import { useAuthStore } from '@/store/authStore'

type WSMessage = {
  id: string
  type: string
  title: string
  message: string
  link?: string
  is_read: boolean
}

type Options = {
  onMessage?: (msg: WSMessage) => void
  onOpen?: () => void
  onClose?: () => void
}

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000'

export const useWebSocket = (options: Options = {}) => {
  const { token } = useAuthStore()
  const wsRef    = useRef<WebSocket | null>(null)
  const optsRef  = useRef(options)
  optsRef.current = options

  const connect = useCallback(() => {
    if (!token || wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(`${WS_BASE}/api/notifications/ws?token=${token}`)

    ws.onopen = () => {
      optsRef.current.onOpen?.()
    }

    ws.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data) as WSMessage
        optsRef.current.onMessage?.(data)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      optsRef.current.onClose?.()
      // Reconnect after 5s if token still valid
      setTimeout(() => {
        if (useAuthStore.getState().token) connect()
      }, 5000)
    }

    ws.onerror = () => ws.close()

    wsRef.current = ws
  }, [token])

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [connect])

  const send = (data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    }
  }

  return { send }
}
