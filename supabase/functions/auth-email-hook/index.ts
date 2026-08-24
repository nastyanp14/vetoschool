import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { parseEmailWebhookPayload } from 'npm:@lovable.dev/email-js'
import { WebhookError, verifyWebhookRequest } from 'npm:@lovable.dev/webhooks-js'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, webhook-id, webhook-timestamp, webhook-signature, x-lovable-signature, x-lovable-timestamp, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

type EmailLang = 'ru' | 'ua' | 'en'

const EMAIL_SUBJECTS: Record<EmailLang, Record<string, string>> = {
  ru: {
    signup: 'Ваш код подтверждения Vetoschool',
    invite: 'Приглашение в Vetoschool',
    magiclink: 'Ссылка для входа в Vetoschool',
    recovery: 'Восстановление пароля Vetoschool',
    email_change: 'Подтвердите новый email',
    reauthentication: 'Код подтверждения Vetoschool',
  },
  ua: {
    signup: 'Ваш код підтвердження Vetoschool',
    invite: 'Запрошення до Vetoschool',
    magiclink: 'Посилання для входу у Vetoschool',
    recovery: 'Відновлення пароля Vetoschool',
    email_change: 'Підтвердьте новий email',
    reauthentication: 'Код підтвердження Vetoschool',
  },
  en: {
    signup: 'Your Vetoschool verification code',
    invite: "You've been invited to Vetoschool",
    magiclink: 'Your Vetoschool login link',
    recovery: 'Reset your Vetoschool password',
    email_change: 'Confirm your new email',
    reauthentication: 'Your Vetoschool verification code',
  },
}

function normalizeLang(value?: string | null): EmailLang {
  const normalized = (value || '').toLowerCase()
  if (normalized === 'ua' || normalized === 'uk') return 'ua'
  if (normalized === 'en') return 'en'
  return 'ru'
}

// Template mapping
const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

// Configuration
const SITE_NAME = "vetoschool"
const SENDER_DOMAIN = "notify.vetoschool.eu"
const ROOT_DOMAIN = "vetoschool.eu"
const FROM_DOMAIN = "notify.vetoschool.eu" // Domain shown in From address (may be root or sender subdomain)

// Sample data for preview mode ONLY (not used in actual email sending).
// URLs are baked in at scaffold time from the project's real data.
// The sample email uses a fixed placeholder (RFC 6761 .test TLD) so the Go backend
// can always find-and-replace it with the actual recipient when sending test emails,
// even if the project's domain has changed since the template was scaffolded.
const SAMPLE_PROJECT_URL = "https://vetoschool.lovable.app"
const SAMPLE_EMAIL = "user@example.test"
const SAMPLE_DATA: Record<string, object> = {
  signup: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    recipient: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
    token: '123456',
  },
  magiclink: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  recovery: {
    siteName: SITE_NAME,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  invite: {
    siteName: SITE_NAME,
    siteUrl: SAMPLE_PROJECT_URL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  email_change: {
    siteName: SITE_NAME,
    oldEmail: SAMPLE_EMAIL,
    email: SAMPLE_EMAIL,
    newEmail: SAMPLE_EMAIL,
    confirmationUrl: SAMPLE_PROJECT_URL,
  },
  reauthentication: {
    token: '123456',
  },
}

// Preview endpoint handler - returns rendered HTML without sending email
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  // Preview is authorized with the email preview token (or, on Lovable Cloud,
  // the Lovable API key). Without a configured token preview stays disabled.
  const previewTokens = [
    Deno.env.get('AUTH_EMAIL_PREVIEW_TOKEN'),
    Deno.env.get('LOVABLE_API_KEY'),
  ].filter((value): value is string => Boolean(value))
  const authHeader = req.headers.get('Authorization')

  if (!previewTokens.some((token) => authHeader === `Bearer ${token}`)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]

  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Unknown email type: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))

  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Normalize a native Supabase "Send Email" hook payload into the internal
// shape used below ({ version, data: { action_type, email, url, token, ... } }).
function normalizeSupabaseHookPayload(raw: any) {
  const emailData = raw?.email_data ?? {}
  const actionTypeRaw = String(emailData.email_action_type ?? '')
  const actionType = actionTypeRaw === 'email_change_current' || actionTypeRaw === 'email_change_new'
    ? 'email_change'
    : actionTypeRaw
  const projectUrl = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '')
  const verifyType = actionType === 'email_change' ? 'email_change' : actionType
  const url = emailData.token_hash
    ? `${projectUrl}/auth/v1/verify?token=${encodeURIComponent(emailData.token_hash)}` +
      `&type=${encodeURIComponent(verifyType)}` +
      (emailData.redirect_to ? `&redirect_to=${encodeURIComponent(emailData.redirect_to)}` : '')
    : (emailData.redirect_to ?? '')

  return {
    version: '1',
    run_id: crypto.randomUUID(),
    data: {
      action_type: actionType,
      email: raw?.user?.email,
      url,
      token: emailData.token,
      old_email: raw?.user?.email,
      new_email: raw?.user?.new_email ?? raw?.user?.email,
    },
  }
}

// Verifies a native Supabase Send Email Hook request (standard-webhooks HMAC,
// secret format: `v1,whsec_<base64>` stored in SEND_EMAIL_HOOK_SECRET).
async function verifySupabaseHook(rawBody: string, req: Request, secret: string): Promise<boolean> {
  const id = req.headers.get('webhook-id')
  const timestamp = req.headers.get('webhook-timestamp')
  const signatureHeader = req.headers.get('webhook-signature')
  if (!id || !timestamp || !signatureHeader) return false

  const skewSeconds = Math.abs(Date.now() / 1000 - Number(timestamp))
  if (!Number.isFinite(skewSeconds) || skewSeconds > 300) return false

  const base64Secret = secret.replace(/^v1,?\s*/, '').replace(/^whsec_/, '')
  const keyBytes = Uint8Array.from(atob(base64Secret), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signed = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`)
  )
  const expected = btoa(String.fromCharCode(...new Uint8Array(signed)))

  return signatureHeader
    .split(' ')
    .map((part) => part.trim())
    .some((part) => part.replace(/^v1,/, '') === expected)
}

// Webhook handler - verifies signature and sends email
async function handleWebhook(req: Request): Promise<Response> {
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  const apiKey = Deno.env.get('LOVABLE_API_KEY')

  if (!hookSecret && !apiKey) {
    console.error('No webhook secret configured (SEND_EMAIL_HOOK_SECRET)')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Verify signature + timestamp, then parse payload.
  let payload: any
  let run_id = ''

  const isSupabaseHook = Boolean(hookSecret && req.headers.get('webhook-signature'))

  if (isSupabaseHook) {
    const rawBody = await req.text()
    const valid = await verifySupabaseHook(rawBody, req, hookSecret!)
    if (!valid) {
      console.error('Invalid Supabase auth hook signature')
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    try {
      payload = normalizeSupabaseHookPayload(JSON.parse(rawBody))
    } catch (error) {
      console.error('Invalid Supabase auth hook payload', { error })
      return new Response(JSON.stringify({ error: 'Invalid webhook payload' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    run_id = payload.run_id
  } else {
    try {
      const verified = await verifyWebhookRequest({
        req,
        secret: apiKey!,
        parser: parseEmailWebhookPayload,
      })
      payload = verified.payload
      run_id = payload.run_id
    } catch (error) {
      if (error instanceof WebhookError) {
        switch (error.code) {
          case 'invalid_signature':
          case 'missing_timestamp':
          case 'invalid_timestamp':
          case 'stale_timestamp':
            console.error('Invalid webhook signature', { error: error.message })
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
              status: 401,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
          case 'invalid_payload':
          case 'invalid_json':
            console.error('Invalid webhook payload', { error: error.message })
            return new Response(
              JSON.stringify({ error: 'Invalid webhook payload' }),
              { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
        }
      }

      console.error('Webhook verification failed', { error })
      return new Response(
        JSON.stringify({ error: 'Invalid webhook payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
  }

  if (!run_id) {
    console.error('Webhook payload missing run_id')
    return new Response(
      JSON.stringify({ error: 'Invalid webhook payload' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (payload.version !== '1') {
    console.error('Unsupported payload version', { version: payload.version, run_id })
    return new Response(
      JSON.stringify({ error: `Unsupported payload version: ${payload.version}` }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // The email action type is in payload.data.action_type (e.g., "signup", "recovery")
  const emailType = payload.data.action_type
  console.log('Received auth event', { emailType, email: payload.data.email, run_id })

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('Unknown email type', { emailType, run_id })
    return new Response(
      JSON.stringify({ error: `Unknown email type: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // Recipient language is stored on the profile (filled from signup metadata).
  let lang: EmailLang = 'ru'
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('lang')
      .eq('email', payload.data.email)
      .maybeSingle()
    lang = normalizeLang(profile?.lang)
  } catch (langError) {
    console.warn('Could not resolve recipient language, falling back to ru', langError)
  }

  // Build template props from payload.data (HookData structure)
  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: payload.data.email,
    confirmationUrl: payload.data.url,
    token: payload.data.token,
    email: payload.data.email,
    oldEmail: payload.data.old_email,
    newEmail: payload.data.new_email,
    lang,
  }

  // Render React Email to HTML and plain text
  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })

  const messageId = crypto.randomUUID()

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: emailType,
    recipient_email: payload.data.email,
    status: 'pending',
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'auth_emails',
    payload: {
      run_id,
      message_id: messageId,
      to: payload.data.email,
      from: `Vetoschool <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: EMAIL_SUBJECTS[lang][emailType] || EMAIL_SUBJECTS.ru[emailType] || 'Vetoschool',
      html,
      text,
      purpose: 'transactional',
      label: emailType,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue auth email', { error: enqueueError, run_id, emailType })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: emailType,
      recipient_email: payload.data.email,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Auth email enqueued', { emailType, email: payload.data.email, run_id })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

Deno.serve(async (req) => {
  const url = new URL(req.url)

  // Handle CORS preflight for main endpoint
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Route to preview handler for /preview path
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  // Main webhook handler
  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('Webhook handler error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
