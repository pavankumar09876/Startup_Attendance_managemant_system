import { useState, useEffect } from 'react'

const KEY = 'wfp-dark-mode'

export const useDarkMode = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    const stored = localStorage.getItem(KEY)
    if (stored !== null) return stored === 'true'
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    const root = document.documentElement
    if (isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    localStorage.setItem(KEY, String(isDark))
  }, [isDark])

  const toggle = () => setIsDark((d) => !d)

  return { isDark, toggle }
}
