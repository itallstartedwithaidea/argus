/**
 * Dynamic ARGUS sitemap — lists all published report URLs
 * URL: /sitemap-argus.xml
 */

export async function onRequestGet({ env }) {
  const store = env.SESSIONS;
  let urls = '';

  if (store) {
    try {
      const pub = await store.get('argus:published_index', 'json') || [];
      pub.forEach(r => {
        const slug = r.slug || r.id;
        const date = (r.published_at || '').slice(0, 10);
        urls += `  <url>
    <loc>https://googleadsagent.ai/tools/argus/report/${slug}</loc>
    <lastmod>${date || new Date().toISOString().slice(0, 10)}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>\n`;
      });
    } catch {}
  }

  // Also include the static ARGUS pages
  const staticPages = [
    { loc: '/tools/argus/', priority: '0.9' },
    { loc: '/tools/argus/reports', priority: '0.8' },
    { loc: '/tools/argus/app', priority: '0.8' },
    { loc: '/tools/argus/docs', priority: '0.6' },
    { loc: '/tools/argus/dispute', priority: '0.5' },
  ];
  staticPages.forEach(p => {
    urls += `  <url>
    <loc>https://googleadsagent.ai${p.loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>${p.priority}</priority>
  </url>\n`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}</urlset>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
