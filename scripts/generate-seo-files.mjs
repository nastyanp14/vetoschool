import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const siteUrl = (process.env.SITE_URL || 'https://vetoschool.eu').replace(/\/$/, '');
const outDir = path.resolve(rootDir, process.env.SEO_OUT_DIR || 'dist');
const publicDir = path.resolve(rootDir, 'public');
const today = new Date();
const localToday = new Date(today.getTime() - today.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
const lastmod = process.env.SITEMAP_LASTMOD || localToday;

const publicRoutes = [
  {
    path: '/',
    changefreq: 'weekly',
    priority: '1.0',
  },
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
    <lastmod>${lastmod}</lastmod>
    <changefreq>${route.changefreq}</changefreq>
    <priority>${route.priority}</priority>
  </url>`)
  .join('\n')}
</urlset>
`;

const robots = `User-agent: *
Allow: /
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
