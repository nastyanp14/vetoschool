import { useEffect } from 'react';

const SITE_URL = 'https://vetoschool.eu';
const SITE_NAME = 'Vetoschool';
const DEFAULT_IMAGE = `${SITE_URL}/uploads/upload_1.PNG`;

export type SeoConfig = {
  title: string;
  description: string;
  path?: string;
  noindex?: boolean;
  schema?: Record<string, unknown>;
};

function upsertMeta(selector: string, attributes: Record<string, string>) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([name, value]) => {
    element?.setAttribute(name, value);
  });
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement('link');
    element.rel = 'canonical';
    document.head.appendChild(element);
  }

  element.href = href;
}

function upsertJsonLd(schema?: Record<string, unknown>) {
  const id = 'seo-jsonld';
  let element = document.getElementById(id) as HTMLScriptElement | null;

  if (!schema) {
    element?.remove();
    return;
  }

  if (!element) {
    element = document.createElement('script');
    element.id = id;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(schema);
}

function withSiteUrl(path = '/') {
  return new URL(path, SITE_URL).toString();
}

export function Seo({ title, description, path = '/', noindex = false, schema }: SeoConfig) {
  useEffect(() => {
    const canonicalUrl = withSiteUrl(path);
    const robots = noindex ? 'noindex,nofollow' : 'index,follow';

    document.title = title;
    upsertMeta('meta[name="description"]', { name: 'description', content: description });
    upsertMeta('meta[name="robots"]', { name: 'robots', content: robots });
    upsertCanonical(canonicalUrl);

    upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME });
    upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' });
    upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title });
    upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonicalUrl });
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: DEFAULT_IMAGE });
    upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'ru_RU' });

    upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title });
    upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description });
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: DEFAULT_IMAGE });

    upsertJsonLd(schema);
  }, [description, noindex, path, schema, title]);

  return null;
}

export const homeSchoolSchema = {
  '@context': 'https://schema.org',
  '@type': 'School',
  name: 'Vetoschool',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  image: DEFAULT_IMAGE,
  description: 'Vetoschool is an online English school for children ages 5-12 with interactive lessons, practice, homework, listening, and grammar.',
  areaServed: 'Europe',
  educationalCredentialAwarded: 'English language learning for children',
  knowsAbout: ['English for kids', 'Online English lessons', 'Interactive language learning'],
  sameAs: ['https://t.me/vetoschool_bot'],
};
