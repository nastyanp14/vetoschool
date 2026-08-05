/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Text } from 'npm:@react-email/components@0.0.22'

import { EmailLayout, Lang, pickLang, securityNote, styles, tr, SITE_URL } from './brand.tsx'

interface InviteEmailProps {
  siteName?: string
  siteUrl?: string
  confirmationUrl?: string
  lang?: string
}

const copy = {
  preview: {
    ru: 'Приглашение в Vetoschool',
    ua: 'Запрошення до Vetoschool',
    en: 'Your invitation to Vetoschool',
  },
  title: { ru: 'Вас пригласили', ua: 'Вас запросили', en: "You've been invited" },
  intro: {
    ru: 'Вас пригласили в Vetoschool. Нажмите кнопку ниже, чтобы создать аккаунт.',
    ua: 'Вас запросили до Vetoschool. Натисніть кнопку нижче, щоб створити акаунт.',
    en: "You've been invited to Vetoschool. Use the button below to create your account.",
  },
  cta: { ru: 'Принять приглашение', ua: 'Прийняти запрошення', en: 'Accept invitation' },
}

export const InviteEmail = ({ confirmationUrl, lang }: InviteEmailProps) => {
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

export default InviteEmail
