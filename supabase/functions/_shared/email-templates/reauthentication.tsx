/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'

import { EmailLayout, Lang, pickLang, securityNote, styles, tr } from './brand.tsx'

interface ReauthenticationEmailProps {
  token?: string
  lang?: string
}

const copy = {
  preview: {
    ru: 'Код подтверждения Vetoschool',
    ua: 'Код підтвердження Vetoschool',
    en: 'Your Vetoschool confirmation code',
  },
  title: { ru: 'Подтверждение действия', ua: 'Підтвердження дії', en: 'Confirm it is you' },
  intro: {
    ru: 'Введите этот код, чтобы подтвердить действие:',
    ua: 'Введіть цей код, щоб підтвердити дію:',
    en: 'Enter this code to confirm the action:',
  },
  expiry: {
    ru: 'Код действует 10 минут.',
    ua: 'Код дійсний 10 хвилин.',
    en: 'This code expires in 10 minutes.',
  },
}

export const ReauthenticationEmail = ({ token, lang }: ReauthenticationEmailProps) => {
  const l: Lang = pickLang(lang)
  return (
    <EmailLayout lang={l} preview={tr(copy.preview, l)}>
      <Text style={styles.h1}>{tr(copy.title, l)}</Text>
      <Text style={styles.text}>{tr(copy.intro, l)}</Text>
      <Text style={styles.code}>{token || '------'}</Text>
      <Text style={styles.hint}>{tr(copy.expiry, l)}</Text>
      <Text style={styles.note}>{tr(securityNote, l)}</Text>
    </EmailLayout>
  )
}

export default ReauthenticationEmail
