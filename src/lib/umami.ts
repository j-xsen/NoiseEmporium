declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, unknown>) => void }
    jws?: { track: (event: string, data?: Record<string, unknown>) => void }
  }
}

export function track(event: string, data?: Record<string, unknown>) {
  if (import.meta.env.DEV) return
  window.umami?.track(event, data)
  window.jws?.track(event, data)
}
