import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const siteUrl = (process.env.SITE_URL || 'https://vetoschool.eu').replace(/\/$/, '');
const outDir = path.resolve(rootDir, process.env.SEO_OUT_DIR || 'dist');
const publicDir = path.resolve(rootDir, 'public');

// Only real, public, indexable routes (see src/pages/Index.tsx).
const publicRoutes = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/pricing', changefreq: 'weekly', priority: '0.9' },
  { path: '/trial-booking', changefreq: 'weekly', priority: '0.9' },
  { path: '/privacy-policy', changefreq: 'yearly', priority: '0.3' },
  { path: '/cookie-policy', changefreq: 'yearly', priority: '0.3' },
];

// Private / non-indexable areas kept out of search results.
const disallowedPaths = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/auth/',
  '/account/',
  '/dashboard',
  '/admin',
  '/teacher',
  '/analytics/',
  '/checkout/',
  '/payment/',
  '/pending-activation',
  '/api/',
];

function routeUrl(routePath) {
  return `${siteUrl}${routePath.startsWith('/') ? routePath : `/${routePath}`}`;
}

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${publicRoutes
  .map(route => `  <url>
    <loc>${escapeXml(routeUrl(route.path))}</loc>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`)
  .join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /
${disallowedPaths.map(p => `Disallow: ${p}`).join('\n')}

Sitemap: ${siteUrl}/sitemap.xml
`;

const headers = `/sitemap.xml
  Content-Type: application/xml; charset=UTF-8

/robots.txt
  Content-Type: text/plain; charset=UTF-8
`;

for (const dir of new Set([publicDir, outDir])) {
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'sitemap.xml'), sitemap, 'utf8');
  await writeFile(path.join(dir, 'robots.txt'), robots, 'utf8');
  await writeFile(path.join(dir, '_headers'), headers, 'utf8');
}

console.log(`Generated sitemap.xml, robots.txt, and _headers in public and ${path.relative(rootDir, outDir) || '.'}`);
