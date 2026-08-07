/// <reference types="npm:@types/react@18.3.1" />

// Email-слой уведомлений: тот же реестр шаблонов, что и Telegram,
// но отрисованный в фирменном layout Vetoschool (brand.tsx).
// Никаких собственных текстов здесь нет — только вёрстка.

import * as React from 'npm:react@18.3.1'
import { renderAsync, Button, Section, Text } from 'npm:@react-email/components@0.0.22'

import { EmailLayout, colors, styles } from './email-templates/brand.tsx'
import {
  renderNotification,
  type NotificationEvent,
  type NotifyLang,
  type NotifyRole,
  type NotifyVars,
  type RenderedMessage,
} from './notificationTemplates.ts'

const SENDER_DOMAIN = 'notify.vetoschool.eu'
const FROM_DOMAIN = 'notify.vetoschool.eu'
const FROM = `Vetoschool <noreply@${FROM_DOMAIN}>`

/** Обратное преобразование HTML-экранирования из шаблонов реестра. */
function unescape(value: string) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

/** Строка шаблона -> React-узлы: поддерживаем только <b> из реестра. */
function renderLine(line: string, key: string) {
  const nodes: React.ReactNode[] = []
  const pattern = /<b>([\s\S]*?)<\/b>/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0
  while ((match = pattern.exec(line)) !== null) {
    if (match.index > lastIndex) nodes.push(unescape(line.slice(lastIndex, match.index)))
    nodes.push(<strong key={`${key}-b-${index++}`}>{unescape(match[1])}</strong>)
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < line.length) nodes.push(unescape(line.slice(lastIndex)))

  // \n внутри строки шаблона = визуальный перенос внутри одного абзаца
  return nodes.flatMap((node, nodeIndex) => {
    if (typeof node !== 'string') return [node]
    const parts = node.split('\n')
    return parts.flatMap((part, partIndex) =>
      partIndex === 0
        ? [part]
        : [<br key={`${key}-br-${nodeIndex}-${partIndex}`} />, part],
    )
  })
}

const buttonPrimary = { ...styles.button, margin: '0 0 10px' }
const buttonSecondary = {
  ...styles.button,
  backgroundColor: '#ffffff',
  color: colors.purple,
  border: `2px solid ${colors.purple}`,
  margin: '0 0 10px',
}

export function NotificationEmail({
  lang,
  message,
}: {
  lang: NotifyLang
  message: RenderedMessage
}) {
  const plainTitle = unescape(message.title)
  return (
    <EmailLayout lang={lang} preview={plainTitle}>
      <Text style={styles.h1}>{plainTitle}</Text>
      {message.lines
        .filter(line => line.trim() !== '')
        .map((line, index) => (
          <Text key={`line-${index}`} style={styles.text}>
            {renderLine(line, `line-${index}`)}
          </Text>
        ))}
      {message.buttons.length > 0 && (
        <Section style={{ margin: '20px 0 0' }}>
          {message.buttons.map((button, index) => (
            <Button
              key={`btn-${index}`}
              href={button.url}
              style={index === 0 ? buttonPrimary : buttonSecondary}
            >
              {button.label}
            </Button>
          ))}
        </Section>
      )}
    </EmailLayout>
  )
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
  message: RenderedMessage
}

/** Тот же реестр -> письмо в фирменном оформлении. */
export async function renderNotificationEmail(
  event: NotificationEvent,
  role: NotifyRole,
  lang: NotifyLang,
  vars: NotifyVars = {},
): Promise<RenderedEmail | null> {
  const message = renderNotification(event, role, lang, vars)
  if (!message) return null
  const element = <NotificationEmail lang={lang} message={message} />
  const [html, text] = await Promise.all([
    renderAsync(element),
    renderAsync(element, { plainText: true }),
  ])
  return { subject: message.subject, html, text, message }
}

/**
 * Ставит письмо в очередь transactional_emails (Lovable Email).
 * Дубли отсекаются раньше — по idempotency_key в notification_log.
 */
export async function enqueueNotificationEmail(admin: any, input: {
  to: string
  subject: string
  html: string
  text: string
  label: string
  idempotencyKey: string
  language?: string
  recipientName?: string | null
  eventVersion?: number
  notificationLogId?: string | null
  trialBookingId?: string | null
  templateVariables?: Record<string, unknown>
}) {
  const messageId = crypto.randomUUID()

  const { data: suppressed } = await admin
    .from('suppressed_emails')
    .select('email')
    .eq('email', input.to.toLowerCase())
    .maybeSingle()
  if (suppressed) return { messageId: null, skipped: 'suppressed' as const }

  await admin.from('email_send_log').insert({
    message_id: messageId,
    template_name: input.label,
    recipient_email: input.to,
    status: 'pending',
    provider: PROVIDER,
  })

  // Прикладной журнал писем: тот же провайдер, что и в очереди.
  await admin.from('transactional_emails').insert({
    notification_log_id: input.notificationLogId || null,
    event_key: input.idempotencyKey,
    event_type: input.label,
    event_version: input.eventVersion ?? 1,
    trial_request_id: input.trialBookingId || null,
    recipient_email: input.to,
    recipient_name: input.recipientName || null,
    language: input.language || null,
    subject: input.subject,
    html: input.html,
    text: input.text,
    template_variables: input.templateVariables || {},
    provider: PROVIDER,
    provider_message_id: messageId,
    status: 'queued',
  })

  const { error } = await admin.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: input.to,
      from: FROM,
      sender_domain: SENDER_DOMAIN,
      subject: input.subject,
      html: input.html,
      text: input.text,
      purpose: 'transactional',
      label: input.label,
      idempotency_key: input.idempotencyKey,
      queued_at: new Date().toISOString(),
    },
  })
  if (error) throw new Error(error.message)
  return { messageId, skipped: null }
}

