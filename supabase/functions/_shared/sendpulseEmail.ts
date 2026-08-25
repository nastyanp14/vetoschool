// SendPulse SMTP API transport shared by the email queue worker.
// Replaces the Lovable Email transport (@lovable.dev/email-js) without changing
// email content, templates, queue semantics, retry/DLQ/TTL handling.

export class SendPulseEmailError extends Error {
  status: number
  retryAfterSeconds: number | null

  constructor(message: string, status: number, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = 'SendPulseEmailError'
    this.status = status
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export interface SendPulseEnv {
  clientId?: string
  clientSecret?: string
  endpoint?: string
  fromEmail?: string
  fromName?: string
}

export interface SendPulseMessage {
  to: string
  /** e.g. `Vetoschool <noreply@notify.vetoschool.eu>` */
  from?: string
  subject: string
  html: string
  text?: string
}

export const DEFAULT_FROM_EMAIL = 'noreply@notify.vetoschool.eu'
export const DEFAULT_FROM_NAME = 'Vetoschool'
const TOKEN_ENDPOINT = 'https://api.sendpulse.com/oauth/access_token'
const DEFAULT_SEND_ENDPOINT = 'https://api.sendpulse.com/smtp/emails'

export function readSendPulseEnv(): SendPulseEnv {
  return {
    clientId: Deno.env.get('SENDPULSE_CLIENT_ID') ?? undefined,
    clientSecret: Deno.env.get('SENDPULSE_CLIENT_SECRET') ?? undefined,
    endpoint: Deno.env.get('SENDPULSE_EMAIL_ENDPOINT') ?? undefined,
    fromEmail: Deno.env.get('SENDPULSE_FROM_EMAIL') ?? undefined,
    fromName: Deno.env.get('SENDPULSE_FROM_NAME') ?? undefined,
  }
}

/** Parses `Name <email@host>` or a bare address. */
export function parseSender(
  raw: string | undefined | null,
  env: SendPulseEnv
): { name: string; email: string } {
  const fallback = {
    name: env.fromName || DEFAULT_FROM_NAME,
    email: env.fromEmail || DEFAULT_FROM_EMAIL,
  }
  const value = (raw || '').trim()
  if (!value) return fallback

  const angle = value.match(/^(.*)<\s*([^<>\s]+@[^<>\s]+)\s*>$/)
  if (angle) {
    const name = angle[1].trim().replace(/^"|"$/g, '')
    return { name: name || fallback.name, email: angle[2] }
  }
  if (value.includes('@') && !value.includes(' ')) {
    return { name: fallback.name, email: value }
  }
  return fallback
}

let cachedToken: { token: string; expiresAt: number } | null = null

export async function getSendPulseToken(env: SendPulseEnv): Promise<string> {
  if (!env.clientId || !env.clientSecret) {
    throw new SendPulseEmailError('sendpulse_credentials_missing', 403)
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.token
  }

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: env.clientId,
      client_secret: env.clientSecret,
    }),
  })
  const payload = (await response.json().catch(() => ({}))) as {
    access_token?: string
    expires_in?: number
    message?: string
    error_description?: string
  }

  if (!response.ok || !payload.access_token) {
    const message =
      payload.message || payload.error_description || `sendpulse_auth_failed_${response.status}`
    throw new SendPulseEmailError(message, response.status)
  }

  cachedToken = {
    token: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  }
  return cachedToken.token
}

export function resetSendPulseTokenCache() {
  cachedToken = null
}

export async function sendSendPulseEmail(
  message: SendPulseMessage,
  env: SendPulseEnv
): Promise<string | null> {
  const sender = parseSender(message.from, env)
  const token = await getSendPulseToken(env)
  const endpoint = env.endpoint || DEFAULT_SEND_ENDPOINT

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: {
        subject: message.subject,
        from: { name: sender.name, email: sender.email },
        to: [{ email: message.to }],
        html: btoa(unescape(encodeURIComponent(message.html))),
        text: message.text || undefined,
      },
    }),
  })

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    message_id?: string
    result?: { id?: string } | boolean
    message?: string
    error_description?: string
  }

  if (!response.ok) {
    // Expired/revoked token: drop the cache so the next attempt re-authenticates.
    if (response.status === 401) resetSendPulseTokenCache()
    const retryAfterHeader = response.headers.get('retry-after')
    const retryAfterSeconds = retryAfterHeader ? Number(retryAfterHeader) || null : null
    const message_ =
      payload.message || payload.error_description || `sendpulse_email_failed_${response.status}`
    throw new SendPulseEmailError(message_, response.status, retryAfterSeconds)
  }

  const result = typeof payload.result === 'object' && payload.result ? payload.result : null
  return payload.id || payload.message_id || result?.id || null
}
