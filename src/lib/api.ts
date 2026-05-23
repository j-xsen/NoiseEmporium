// src/lib/api.ts — centralized fetch wrapper.
//
// All API calls share auth header injection, JSON serialization, and error
// normalization. Errors from the server { error: string } are thrown as Error
// instances with the server message, so callers only need one catch block.
//
// Usage:
//   api.get<{ purchases: string[] }>('/api/downloads?purchases', token)
//   api.post<{ url: string }>('/api/stripe/checkout', { mode: 'payment', contentfulId }, token)

type Body = Record<string, unknown>

async function request<T>(
  method: string,
  path: string,
  opts: { token?: string | null; body?: Body } = {},
): Promise<T> {
  const headers: Record<string, string> = {}
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`

  const res = await fetch(path, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  })

  let data: unknown
  try { data = await res.json() } catch { data = null }

  if (!res.ok) {
    const err = data as { error?: string } | null
    throw new Error(err?.error ?? `HTTP ${res.status}`)
  }
  return data as T
}

export const api = {
  get:    <T>(path: string, token?: string | null) =>
    request<T>('GET', path, { token }),
  post:   <T>(path: string, body: Body, token?: string | null) =>
    request<T>('POST', path, { token, body }),
  delete: <T>(path: string, body: Body, token?: string | null) =>
    request<T>('DELETE', path, { token, body }),
  patch:  <T>(path: string, body: Body, token?: string | null) =>
    request<T>('PATCH', path, { token, body }),
}
