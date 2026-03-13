import { describe, it, expect, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut'
import { fireEvent } from '@testing-library/dom'

describe('useKeyboardShortcut', () => {
  it('calls handler on matching keydown', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'k', ctrl: true, handler }))
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does not call handler on wrong key', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'k', ctrl: true, handler }))
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not call handler when disabled', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'k', ctrl: true, handler, enabled: false }))
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    expect(handler).not.toHaveBeenCalled()
  })

  it('does not fire in input fields for non-ctrl shortcuts', () => {
    const handler = vi.fn()
    renderHook(() => useKeyboardShortcut({ key: 'n', handler }))
    const input = document.createElement('input')
    document.body.appendChild(input)
    fireEvent.keyDown(input, { key: 'n' })
    expect(handler).not.toHaveBeenCalled()
    document.body.removeChild(input)
  })
})
