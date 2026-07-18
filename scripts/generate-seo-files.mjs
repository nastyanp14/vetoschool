import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const siteUrl = (process.env.SITE_URL || 'https://vetoschool.eu').replace(/\/$/, '');
const outDir = path.resolve(rootDir, process.env.SEO_OUT_DIR || 'dist');
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

await mkdir(outDir, { recursive: true });
await writeFile(path.join(outDir, 'sitemap.xml'), sitemap, 'utf8');
await writeFile(path.join(outDir, 'robots.txt'), robots, 'utf8');

console.log(`Generated sitemap.xml and robots.txt in ${path.relative(rootDir, outDir) || '.'}`);
