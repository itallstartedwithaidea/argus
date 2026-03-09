/**
 * ARGUS Public Reports Directory — Dynamic listing of published analyses
 * URL: /tools/argus/reports
 */

export async function onRequest(context) {
  const { env } = context;
  const store = env.SESSIONS;

  let reports = [];
  if (store) {
    try {
      const pub = await store.get('argus:published_index', 'json') || [];
      reports = pub;
    } catch {}
  }

  const html = renderDirectory(reports);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=300',
      'X-Robots-Tag': 'index, follow',
    },
  });
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function scoreColor(s) {
  if (s <= 25) return '#dc2626';
  if (s <= 40) return '#ea580c';
  if (s <= 60) return '#d97706';
  return '#16a34a';
}

function riskLabel(s) {
  if (s <= 25) return 'CRITICAL';
  if (s <= 40) return 'HIGH';
  if (s <= 60) return 'MEDIUM';
  return 'LOW';
}

function platformIcon(p) {
  const icons = {
    'LinkedIn': '&#128101;', 'Reddit': '&#129693;', 'Instagram': '&#128247;',
    'X (Twitter)': '&#120143;', 'Facebook': '&#102;', 'YouTube': '&#9654;',
    'Quora': '&#81;', 'TikTok': '&#9836;'
  };
  return icons[p] || '&#127760;';
}

function renderDirectory(reports) {
  const total = reports.length;
  const avgScore = total > 0 ? Math.round(reports.reduce((a, r) => a + (r.trust_score || 0), 0) / total) : 0;
  const platforms = {};
  reports.forEach(r => { platforms[r.platform || 'Unknown'] = (platforms[r.platform || 'Unknown'] || 0) + 1; });

  const reportCards = reports.map(r => {
    const sc = scoreColor(r.trust_score || 50);
    const risk = riskLabel(r.trust_score || 50);
    const date = new Date(r.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    const urlShort = (r.url || '').replace(/^https?:\/\/(www\.)?/, '').slice(0, 50);
    const href = `/tools/argus/report/${r.slug || r.id}`;

    return `<a href="${href}" class="report-card">
      <div class="card-score" style="color:${sc}">${r.trust_score ?? '?'}</div>
      <div class="card-body">
        <div class="card-platform"><span class="plat-icon">${platformIcon(r.platform)}</span> ${esc(r.platform || 'Unknown')}</div>
        <div class="card-verdict">${esc(r.verdict || '')}</div>
        <div class="card-url">${esc(urlShort)}</div>
        <div class="card-meta">
          <span class="risk-tag" style="color:${sc};border-color:${sc}40;background:${sc}12">${risk}</span>
          <span>${date}</span>
        </div>
      </div>
    </a>`;
  }).join('');

  const platformFilters = Object.entries(platforms).map(([p, c]) =>
    `<button class="filter-btn" data-platform="${esc(p)}" onclick="filterPlatform('${esc(p)}')">${esc(p)} <span class="filter-count">${c}</span></button>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Published Analysis Reports — ARGUS by googleadsagent.ai</title>
<meta name="description" content="Browse ${total} published authenticity analysis reports. ARGUS analyzes social media profiles and posts across LinkedIn, Reddit, Instagram, X, YouTube, Facebook, and more.">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="https://googleadsagent.ai/tools/argus/reports">
<meta property="og:title" content="Published Analysis Reports — ARGUS">
<meta property="og:description" content="Browse ${total} published authenticity analyses across multiple social media platforms.">
<meta property="og:url" content="https://googleadsagent.ai/tools/argus/reports">
<meta property="og:type" content="website">
<meta property="og:site_name" content="ARGUS by googleadsagent.ai">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="Published Analysis Reports — ARGUS">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3CradialGradient id='g' cx='38%25' cy='38%25'%3E%3Cstop offset='0%25' stop-color='%23f0a830'/%3E%3Cstop offset='100%25' stop-color='%23b07518'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='16' cy='16' r='15' fill='url(%23g)'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"CollectionPage","name":"ARGUS Published Analysis Reports","description":"Browse published authenticity analysis reports for social media profiles and posts.","url":"https://googleadsagent.ai/tools/argus/reports","isPartOf":{"@type":"WebApplication","name":"ARGUS","url":"https://googleadsagent.ai/tools/argus/"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://googleadsagent.ai/"},{"@type":"ListItem","position":2,"name":"Tools","item":"https://googleadsagent.ai/tools/"},{"@type":"ListItem","position":3,"name":"ARGUS","item":"https://googleadsagent.ai/tools/argus/"},{"@type":"ListItem","position":4,"name":"Reports"}]}
</script>
<style>
:root{--bg:#08080d;--bg2:#0e0e16;--bg3:#14141f;--surface:#1a1a2a;--border:#2a2a3a;--text:#e8e6e3;--text2:#9a9aaa;--text3:#686880;--amber:#f0a830;--amber2:#d4941a;--green:#4ade80;--blue:#60a5fa;--red:#f87171;--purple:#a78bfa;--font-serif:'Playfair Display',Georgia,serif;--font-mono:'JetBrains Mono','Courier New',monospace;--font-body:'IBM Plex Sans',-apple-system,sans-serif}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:var(--font-body);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--amber);text-decoration:none}a:hover{color:var(--text)}

.nav{position:sticky;top:0;z-index:100;background:rgba(8,8,13,.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:0 2rem;height:60px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-family:var(--font-mono);font-size:.85rem;color:var(--text2)}.nav-logo span{color:var(--amber)}
.nav-links{display:flex;gap:1.5rem}.nav-links a{font-size:.85rem;color:var(--text2);font-weight:500}.nav-links a:hover{color:var(--amber)}
.nav-cta{background:var(--amber);color:var(--bg);padding:.45rem 1.2rem;border-radius:6px;font-weight:600;font-size:.8rem}.nav-cta:hover{background:var(--text);color:var(--bg)}
@media(max-width:768px){.nav-links{display:none}}

.breadcrumb-bar{max-width:1100px;margin:0 auto;padding:0 2rem;width:100%}
.breadcrumb{display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;color:var(--text3);padding:12px 0;border-bottom:1px solid var(--border);flex-wrap:wrap}
.breadcrumb a{color:var(--text3)}.breadcrumb a:hover{color:var(--amber)}.breadcrumb .sep{opacity:.4}

.hero{max-width:1100px;margin:0 auto;padding:3rem 2rem 1.5rem;text-align:center}
.hero h1{font-family:var(--font-serif);font-size:clamp(1.6rem,4vw,2.4rem);margin-bottom:8px}
.hero p{color:var(--text2);font-size:1rem;max-width:600px;margin:0 auto}

.stats-bar{max-width:1100px;margin:0 auto;padding:0 2rem;display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-bottom:2rem}
.stat-pill{background:var(--bg2);border:1px solid var(--border);border-radius:20px;padding:8px 20px;display:flex;align-items:center;gap:8px}
.stat-pill .num{font-family:var(--font-mono);font-weight:700;color:var(--amber)}
.stat-pill .lbl{font-size:.78rem;color:var(--text3)}

.filters{max-width:1100px;margin:0 auto;padding:0 2rem 1rem;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.filter-label{font-family:var(--font-mono);font-size:.72rem;color:var(--text3);margin-right:4px}
.filter-btn{background:var(--bg2);border:1px solid var(--border);color:var(--text2);padding:6px 14px;border-radius:16px;font-family:var(--font-mono);font-size:.72rem;cursor:pointer;transition:all .2s}
.filter-btn:hover,.filter-btn.active{background:rgba(240,168,48,.1);border-color:var(--amber);color:var(--amber)}
.filter-count{background:var(--bg3);padding:1px 6px;border-radius:8px;font-size:.62rem;margin-left:4px}
.search-box{background:var(--bg2);border:1px solid var(--border);color:var(--text);padding:8px 16px;border-radius:8px;font-family:var(--font-body);font-size:.82rem;width:220px;margin-left:auto}
.search-box:focus{outline:none;border-color:var(--amber)}
.search-box::placeholder{color:var(--text3)}

.reports-grid{max-width:1100px;margin:0 auto;padding:0 2rem 4rem;display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px}
.report-card{display:flex;gap:16px;background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;transition:all .2s;text-decoration:none}
.report-card:hover{border-color:var(--amber);transform:translateY(-2px);box-shadow:0 8px 24px rgba(0,0,0,.3)}
.card-score{font-family:var(--font-mono);font-size:2.2rem;font-weight:700;line-height:1;flex-shrink:0;min-width:50px;text-align:center}
.card-body{flex:1;min-width:0}
.card-platform{font-family:var(--font-mono);font-size:.72rem;color:var(--text3);margin-bottom:4px}
.plat-icon{margin-right:4px}
.card-verdict{color:var(--text);font-size:.85rem;line-height:1.5;margin-bottom:6px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-url{font-family:var(--font-mono);font-size:.68rem;color:var(--text3);margin-bottom:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.card-meta{display:flex;gap:8px;align-items:center;font-size:.68rem;color:var(--text3)}
.risk-tag{font-family:var(--font-mono);font-size:.6rem;font-weight:600;padding:2px 8px;border-radius:10px;border:1px solid;letter-spacing:.5px}

.empty-state{max-width:1100px;margin:0 auto;padding:4rem 2rem;text-align:center}
.empty-state h2{color:var(--text3);font-size:1.2rem;margin-bottom:8px}
.empty-state p{color:var(--text3);font-size:.9rem;margin-bottom:24px}
.empty-state a.cta{display:inline-block;background:var(--amber);color:var(--bg);padding:12px 28px;border-radius:8px;font-weight:600}

footer{text-align:center;padding:3rem 2rem;border-top:1px solid var(--border);font-size:.8rem;color:var(--text3)}
footer a{color:var(--text2)}footer a:hover{color:var(--amber)}
</style>
</head>
<body>
<nav class="nav">
  <a href="/tools/argus/" class="nav-logo"><span>ARGUS</span> by googleadsagent.ai</a>
  <div class="nav-links">
    <a href="/tools/argus/">Overview</a>
    <a href="/tools/argus/reports">Reports</a>
    <a href="/tools/argus/app">Submit</a>
    <a href="/tools/argus/dispute">Dispute</a>
    <a href="/tools/argus/docs">Docs</a>
    <a href="/tools/" class="nav-cta">All Tools</a>
  </div>
</nav>

<div class="breadcrumb-bar">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span>
    <a href="/tools/">Tools</a><span class="sep">/</span>
    <a href="/tools/argus/">ARGUS</a><span class="sep">/</span>
    <span>Reports</span>
  </nav>
</div>

<div class="hero">
  <h1>Published Analysis Reports</h1>
  <p>Browse authenticity analyses across social media platforms. Every report is AI-analyzed and human-reviewed before publication.</p>
</div>

${total > 0 ? `
<div class="stats-bar">
  <div class="stat-pill"><span class="num">${total}</span><span class="lbl">Reports Published</span></div>
  <div class="stat-pill"><span class="num">${avgScore}</span><span class="lbl">Avg Trust Score</span></div>
  <div class="stat-pill"><span class="num">${Object.keys(platforms).length}</span><span class="lbl">Platforms</span></div>
</div>

<div class="filters">
  <span class="filter-label">Filter:</span>
  <button class="filter-btn active" onclick="filterPlatform('all')">All <span class="filter-count">${total}</span></button>
  ${platformFilters}
  <input type="text" class="search-box" id="searchBox" placeholder="Search reports..." oninput="searchReports(this.value)">
</div>

<div class="reports-grid" id="reportsGrid">
  ${reportCards}
</div>
` : `
<div class="empty-state">
  <h2>No Published Reports Yet</h2>
  <p>Analyses are published after AI processing and human review. Submit a profile or post for analysis.</p>
  <a href="/tools/argus/app" class="cta">Submit for Analysis</a>
</div>
`}

<footer>
  <p>
    <a href="/tools/argus/">ARGUS</a> by <a href="/">googleadsagent.ai</a> &middot;
    <a href="/tools/argus/app">Submit</a> &middot;
    <a href="/tools/argus/dispute">Dispute</a> &middot;
    <a href="/tools/argus/docs">Docs</a> &middot;
    <a href="https://github.com/itallstartedwithaidea/argus">GitHub</a>
  </p>
  <p style="margin-top:12px;font-size:.72rem;">Algorithmic opinion &mdash; not a legal or factual determination.</p>
</footer>

<script>
function filterPlatform(p) {
  var cards = document.querySelectorAll('.report-card');
  document.querySelectorAll('.filter-btn').forEach(function(b) {
    b.classList.toggle('active', b.dataset.platform === p || (p === 'all' && !b.dataset.platform));
  });
  cards.forEach(function(c) {
    var plat = c.querySelector('.card-platform').textContent.trim();
    c.style.display = (p === 'all' || plat.indexOf(p) >= 0) ? '' : 'none';
  });
}
function searchReports(q) {
  var cards = document.querySelectorAll('.report-card');
  var lower = q.toLowerCase();
  cards.forEach(function(c) {
    var text = c.textContent.toLowerCase();
    c.style.display = (!q || text.indexOf(lower) >= 0) ? '' : 'none';
  });
}
</script>
</body>
</html>`;
}
