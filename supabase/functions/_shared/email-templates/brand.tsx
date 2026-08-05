/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

export type Lang = 'ru' | 'ua' | 'en'

export const SITE_URL = 'https://vetoschool.eu'

export function pickLang(value?: string | null): Lang {
  const normalized = (value || '').toLowerCase()
  if (normalized === 'ua' || normalized === 'uk') return 'ua'
  if (normalized === 'en') return 'en'
  return 'ru'
}

export function tr<T extends Record<Lang, string>>(dict: T, lang: Lang) {
  return dict[lang] || dict.ru
}

export const colors = {
  purple: '#7c3aed',
  purpleSoft: '#f5f0ff',
  pink: '#ec4899',
  pinkSoft: '#fff0f7',
  blueSoft: '#eef4ff',
  text: '#3b3355',
  muted: '#8b84a3',
  border: '#ece7fb',
}

export const styles = {
  main: {
    backgroundColor: '#ffffff',
    fontFamily: "'Segoe UI', Nunito, Arial, sans-serif",
    color: colors.text,
  },
  container: {
    maxWidth: '520px',
    width: '100%',
    margin: '0 auto',
    padding: '24px 20px 32px',
  },
  card: {
    backgroundColor: colors.purpleSoft,
    borderRadius: '24px',
    border: `1px solid ${colors.border}`,
    padding: '28px 24px',
  },
  brand: {
    fontSize: '22px',
    fontWeight: 'bold' as const,
    color: colors.purple,
    margin: '0 0 4px',
    textAlign: 'center' as const,
  },
  brandSub: {
    fontSize: '12px',
    color: colors.muted,
    margin: '0 0 22px',
    textAlign: 'center' as const,
  },
  h1: {
    fontSize: '22px',
    fontWeight: 'bold' as const,
    color: colors.purple,
    margin: '0 0 14px',
    textAlign: 'center' as const,
  },
  text: {
    fontSize: '15px',
    lineHeight: '1.6',
    color: colors.text,
    margin: '0 0 16px',
  },
  code: {
    display: 'block',
    backgroundColor: '#ffffff',
    border: `2px dashed ${colors.pink}`,
    borderRadius: '18px',
    padding: '18px 12px',
    fontSize: '34px',
    letterSpacing: '10px',
    fontWeight: 'bold' as const,
    color: colors.purple,
    textAlign: 'center' as const,
    margin: '0 0 12px',
  },
  hint: {
    fontSize: '13px',
    color: colors.muted,
    textAlign: 'center' as const,
    margin: '0 0 18px',
  },
  button: {
    display: 'block',
    backgroundColor: colors.purple,
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: 'bold' as const,
    borderRadius: '999px',
    padding: '14px 24px',
    textAlign: 'center' as const,
    textDecoration: 'none',
  },
  note: {
    backgroundColor: colors.blueSoft,
    borderRadius: '16px',
    padding: '12px 16px',
    fontSize: '13px',
    lineHeight: '1.5',
    color: colors.muted,
    margin: '18px 0 0',
  },
  footer: {
    fontSize: '12px',
    color: colors.muted,
    textAlign: 'center' as const,
    margin: '18px 0 0',
  },
  link: { color: colors.pink, textDecoration: 'none' },
}

export const securityNote: Record<Lang, string> = {
  ru: 'Если вы не запрашивали это письмо, просто проигнорируйте его — никаких действий с вашим аккаунтом не произойдёт.',
  ua: 'Якщо ви не надсилали цей запит, просто проігноруйте лист — з вашим акаунтом нічого не станеться.',
  en: 'If you did not request this email, simply ignore it — nothing will change in your account.',
}

const tagline: Record<Lang, string> = {
  ru: 'Онлайн-школа английского для детей',
  ua: 'Онлайн-школа англійської для дітей',
  en: 'Online English school for kids',
}

export function EmailLayout({
  lang,
  preview,
  children,
}: {
  lang: Lang
  preview: string
  children: React.ReactNode
}) {
  return (
    <Html lang={lang === 'ua' ? 'uk' : lang} dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.main}>
        <Container style={styles.container}>
          <Text style={styles.brand}>Vetoschool ✨</Text>
          <Text style={styles.brandSub}>{tr(tagline, lang)}</Text>
          <Section style={styles.card}>{children}</Section>
          <Hr style={{ borderColor: colors.border, margin: '20px 0 12px' }} />
          <Text style={styles.footer}>
            <Link href={SITE_URL} style={styles.link}>
              vetoschool.eu
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
