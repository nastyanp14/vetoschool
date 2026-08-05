/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Text } from 'npm:@react-email/components@0.0.22'

import { EmailLayout, Lang, pickLang, securityNote, styles, tr } from './brand.tsx'

interface SignupEmailProps {
  siteName?: string
  siteUrl?: string
  recipient?: string
  confirmationUrl?: string
  token?: string
  lang?: string
}

const copy = {
  preview: {
    ru: 'Ваш код подтверждения Vetoschool',
    ua: 'Ваш код підтвердження Vetoschool',
    en: 'Your Vetoschool verification code',
  },
  title: {
    ru: 'Подтвердите почту',
    ua: 'Підтвердьте пошту',
    en: 'Confirm your email',
  },
  intro: {
    ru: 'Спасибо за регистрацию в Vetoschool! Введите этот код на странице подтверждения:',
    ua: 'Дякуємо за реєстрацію у Vetoschool! Введіть цей код на сторінці підтвердження:',
    en: 'Thanks for signing up for Vetoschool! Enter this code on the confirmation screen:',
  },
  expiry: {
    ru: 'Код действует 10 минут.',
    ua: 'Код дійсний 10 хвилин.',
    en: 'This code expires in 10 minutes.',
  },
}

export const SignupEmail = ({ token, lang }: SignupEmailProps) => {
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

export default SignupEmail
