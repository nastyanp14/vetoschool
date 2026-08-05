/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Text } from 'npm:@react-email/components@0.0.22'

import { EmailLayout, Lang, pickLang, securityNote, styles, tr, SITE_URL } from './brand.tsx'

interface EmailChangeEmailProps {
  siteName?: string
  oldEmail?: string
  email?: string
  newEmail?: string
  confirmationUrl?: string
  lang?: string
}

const copy = {
  preview: {
    ru: 'Подтвердите смену email в Vetoschool',
    ua: 'Підтвердьте зміну email у Vetoschool',
    en: 'Confirm your Vetoschool email change',
  },
  title: { ru: 'Смена email', ua: 'Зміна email', en: 'Email change' },
  cta: { ru: 'Подтвердить', ua: 'Підтвердити', en: 'Confirm' },
}

function intro(lang: Lang, oldEmail?: string, newEmail?: string) {
  if (lang === 'ua') return `Запит на зміну адреси з ${oldEmail || '—'} на ${newEmail || '—'}.`
  if (lang === 'en') return `A request was made to change your address from ${oldEmail || '—'} to ${newEmail || '—'}.`
  return `Запрошена смена адреса с ${oldEmail || '—'} на ${newEmail || '—'}.`
}

export const EmailChangeEmail = ({ oldEmail, newEmail, confirmationUrl, lang }: EmailChangeEmailProps) => {
  const l: Lang = pickLang(lang)
  return (
    <EmailLayout lang={l} preview={tr(copy.preview, l)}>
      <Text style={styles.h1}>{tr(copy.title, l)}</Text>
      <Text style={styles.text}>{intro(l, oldEmail, newEmail)}</Text>
      <Button style={styles.button} href={confirmationUrl || SITE_URL}>
        {tr(copy.cta, l)}
      </Button>
      <Text style={styles.note}>{tr(securityNote, l)}</Text>
    </EmailLayout>
  )
}

export default EmailChangeEmail
