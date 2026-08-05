/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Button, Text } from 'npm:@react-email/components@0.0.22'

import { EmailLayout, Lang, pickLang, securityNote, styles, tr, SITE_URL } from './brand.tsx'

interface MagicLinkEmailProps {
  siteName?: string
  confirmationUrl?: string
  lang?: string
}

const copy = {
  preview: {
    ru: 'Ссылка для входа в Vetoschool',
    ua: 'Посилання для входу у Vetoschool',
    en: 'Your Vetoschool login link',
  },
  title: { ru: 'Вход в кабинет', ua: 'Вхід у кабінет', en: 'Log in' },
  intro: {
    ru: 'Нажмите кнопку ниже, чтобы войти в личный кабинет Vetoschool.',
    ua: 'Натисніть кнопку нижче, щоб увійти в особистий кабінет Vetoschool.',
    en: 'Use the button below to log in to your Vetoschool account.',
  },
  cta: { ru: 'Войти', ua: 'Увійти', en: 'Log in' },
}

export const MagicLinkEmail = ({ confirmationUrl, lang }: MagicLinkEmailProps) => {
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

export default MagicLinkEmail
