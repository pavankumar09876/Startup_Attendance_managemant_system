import { useEffect, useCallback } from 'react'

type ShortcutHandler = (e: KeyboardEvent) => void

interface ShortcutOptions {
  ctrl?: boolean
  shift?: boolean
  alt?: boolean
  key: string
  handler: ShortcutHandler
  enabled?: boolean
}

export const useKeyboardShortcut = ({
  ctrl = false,
  shift = false,
  alt = false,
  key,
  handler,
  enabled = true,
}: ShortcutOptions) => {
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return
      if (ctrl  !== (e.ctrlKey || e.metaKey)) return
      if (shift !== e.shiftKey) return
      if (alt   !== e.altKey) return
      if (e.key.toLowerCase() !== key.toLowerCase()) return

      // Don't fire when user is typing in an input/textarea/contenteditable
      const tag = (e.target as HTMLElement)?.tagName
      const isEditable = (e.target as HTMLElement)?.isContentEditable
      if (!ctrl && (tag === 'INPUT' || tag === 'TEXTAREA' || isEditable)) return

      e.preventDefault()
      handler(e)
    },
    [ctrl, shift, alt, key, handler, enabled],
  )

  useEffect(() => {
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onKeyDown])
}
