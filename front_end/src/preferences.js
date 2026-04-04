import { useEffect, useMemo, useState } from 'react'

const THEME_KEY = 'pace42.theme'
const EVENT_NAME = 'pace42:preferences'

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch {
  }
  try {
    window.dispatchEvent(new Event(EVENT_NAME))
  } catch {
  }
}

export function getTheme() {
  const v = String(safeStorageGet(THEME_KEY) || '').toLowerCase()
  return v === 'dark' ? 'dark' : 'light'
}

export function applyTheme(theme) {
  const t = String(theme || '').toLowerCase() === 'dark' ? 'dark' : 'light'
  try {
    document.documentElement.dataset.theme = t
  } catch {
  }
}

export function setTheme(theme) {
  const t = String(theme || '').toLowerCase() === 'dark' ? 'dark' : 'light'
  safeStorageSet(THEME_KEY, t)
  applyTheme(t)
}

function usePreferenceValue(getter) {
  const initial = useMemo(() => getter(), [getter])
  const [value, setValue] = useState(initial)

  useEffect(() => {
    const sync = () => setValue(getter())

    window.addEventListener('storage', sync)
    window.addEventListener(EVENT_NAME, sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener(EVENT_NAME, sync)
    }
  }, [getter])

  return value
}

export function useThemeValue() {
  return usePreferenceValue(getTheme)
}
