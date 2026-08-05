/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Text } from 'npm:@react-email/components@0.0.22'

import { EmailLayout, Lang, pickLang, securityNote, styles, tr, SITE_URL } from './brand.tsx'

interface RecoveryEmailProps {
  siteName?: string
  confirmationUrl?: string
  lang?: string
}

const copy = {
  preview: {
    ru: 'Восстановление пароля Vetoschool',
    ua: 'Відновлення пароля Vetoschool',
    en: 'Reset your Vetoschool password',
  },
  title: {
    ru: 'Новый пароль',
    ua: 'Новий пароль',
    en: 'Reset your password',
  },
  intro: {
    ru: 'Мы получили запрос на смену пароля. Нажмите кнопку ниже, чтобы задать новый пароль.',
    ua: 'Ми отримали запит на зміну пароля. Натисніть кнопку нижче, щоб створити новий пароль.',
    en: 'We received a request to change your password. Use the button below to set a new one.',
  },
  cta: {
    ru: 'Задать новый пароль',
    ua: 'Створити новий пароль',
    en: 'Set a new password',
  },
}

export const RecoveryEmail = ({ confirmationUrl, lang }: RecoveryEmailProps) => {
  const l: Lang = pickLang(lang)
  return (
    <EmailLayout lang={l} preview={tr(copy.preview, l)}>
      <Text style={styles.h1}>{tr(copy.title, l)}</Text>
      <Text style={styles.text}>{tr(copy.intro, l)}</Text>
      <Button style={styles.button} href={confirmationUrl || SITE_URL}>
        {tr(copy.cta, l)}
      </Button>
      <Text style={styles.note}>{tr(securityNote, l)}</Text>
    </EmailLayout>
  )
}

export default RecoveryEmail
