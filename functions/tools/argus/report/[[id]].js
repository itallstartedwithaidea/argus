/**
 * ARGUS Public Report Page — Dynamic generation from KV data
 * URL: /tools/argus/report/{submission-id}
 */

export async function onRequest(context) {
  const { params, env } = context;
  const rawId = (params.id || []).join('/');
  if (!rawId) return notFound();

  const store = env.SESSIONS;
  if (!store) return notFound();

  // Try direct ID first, then resolve slug → ID
  let sub = await store.get(`argus:submission:${rawId}`, 'json');
  if (!sub) {
    const resolvedId = await store.get(`argus:slug:${rawId}`);
    if (resolvedId) sub = await store.get(`argus:submission:${resolvedId}`, 'json');
  }
  if (!sub || sub.status !== 'published' || !sub.analysis) return notFound();

  // Redirect old ID URLs to SEO slug if available
  if (sub.slug && rawId !== sub.slug) {
    return Response.redirect(`https://googleadsagent.ai/tools/argus/report/${sub.slug}`, 301);
  }

  const html = renderReport(sub);
  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=600',
      'X-Robots-Tag': 'index, follow',
    },
  });
}

function notFound() {
  return new Response(`<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report Not Found — ARGUS</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{background:#08080d;color:#e8e6e3;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}.c{text-align:center;max-width:420px}h1{color:#f0a830;font-size:2rem;margin-bottom:12px}p{color:#9a9aaa;margin-bottom:24px}a{color:#f0a830;text-decoration:none}a:hover{color:#e8e6e3}</style>
</head><body><div class="c"><h1>Report Not Found</h1><p>This analysis hasn't been published yet, or the ID is invalid.</p><a href="/tools/argus/">Back to ARGUS</a> · <a href="/tools/argus/app.html">Submit a Profile</a></div></body></html>`, {
    status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' },
  });
}

function esc(s) { return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function scoreColor(s) {
  if (s <= 25) return '#dc2626';
  if (s <= 40) return '#ea580c';
  if (s <= 60) return '#d97706';
  return '#16a34a';
}

function riskBadge(level) {
  const colors = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a' };
  const c = colors[level] || '#9a9aaa';
  return `<span style="display:inline-block;background:${c}18;color:${c};border:1px solid ${c}40;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">${esc(level)} risk</span>`;
}

function signalRow(sig) {
  const colors = { critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#16a34a', none: '#4ade80' };
  const c = colors[sig.risk] || '#9a9aaa';
  return `<tr>
    <td style="padding:10px 12px;border-bottom:1px solid #1a1a2a;color:#e8e6e3;font-size:13px;">${esc(sig.name)}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #1a1a2a;color:#9a9aaa;font-size:13px;">${esc(sig.value)}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #1a1a2a;text-align:center;"><span style="color:${c};font-size:11px;font-weight:600;text-transform:uppercase;">${esc(sig.risk)}</span></td>
  </tr>`;
}

function engineCard(name, engine) {
  if (!engine) return '';
  const c = scoreColor(engine.score || 50);
  const signals = (engine.signals || []).map(signalRow).join('');
  return `<div class="engine-card">
    <div class="engine-header">
      <div>
        <div class="engine-name">${esc(name)}</div>
        <div class="engine-summary">${esc(engine.summary || '')}</div>
      </div>
      <div class="engine-score" style="color:${c}">${engine.score ?? '?'}</div>
    </div>
    ${signals ? `<table class="signal-table"><thead><tr><th>Signal</th><th>Finding</th><th>Risk</th></tr></thead><tbody>${signals}</tbody></table>` : ''}
  </div>`;
}

function renderReport(sub) {
  const a = sub.analysis;
  const sc = scoreColor(a.trust_score);
  const svgPct = Math.round((1 - a.trust_score / 100) * 251.2);
  const title = `${a.platform_data?.platform || sub.platform} ${sub.input_type} Analysis — Trust Score ${a.trust_score}/100`;
  const desc = esc(a.verdict || '');
  const url = `https://googleadsagent.ai/tools/argus/report/${sub.slug || sub.id}`;
  const analyzedDate = new Date(a.analyzed_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const publishedDate = new Date(sub.approved_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — ARGUS</title>
<meta name="description" content="${desc}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${desc}">
<meta property="og:url" content="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="ARGUS by googleadsagent.ai">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${desc}">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cdefs%3E%3CradialGradient id='g' cx='38%25' cy='38%25'%3E%3Cstop offset='0%25' stop-color='%23f0a830'/%3E%3Cstop offset='100%25' stop-color='%23b07518'/%3E%3C/radialGradient%3E%3C/defs%3E%3Ccircle cx='16' cy='16' r='15' fill='url(%23g)'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:wght@700&display=swap" rel="stylesheet">
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"Article","headline":"${esc(title)}","description":"${desc}","url":"${url}","datePublished":"${sub.approved_at}","dateModified":"${sub.approved_at}","author":{"@type":"Organization","name":"ARGUS by googleadsagent.ai","url":"https://googleadsagent.ai/tools/argus/"},"publisher":{"@type":"Organization","name":"googleadsagent.ai","url":"https://googleadsagent.ai"}}
</script>
<script type="application/ld+json">
{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Home","item":"https://googleadsagent.ai/"},{"@type":"ListItem","position":2,"name":"Tools","item":"https://googleadsagent.ai/tools/"},{"@type":"ListItem","position":3,"name":"ARGUS","item":"https://googleadsagent.ai/tools/argus/"},{"@type":"ListItem","position":4,"name":"Report"}]}
</script>
<style>
:root{--bg:#08080d;--bg2:#0e0e16;--bg3:#14141f;--surface:#1a1a2a;--border:#2a2a3a;--text:#e8e6e3;--text2:#9a9aaa;--text3:#686880;--amber:#f0a830;--amber2:#d4941a;--green:#4ade80;--blue:#60a5fa;--red:#f87171;--purple:#a78bfa;--font-serif:'Playfair Display',Georgia,serif;--font-mono:'JetBrains Mono','Courier New',monospace;--font-body:'IBM Plex Sans',-apple-system,sans-serif}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--text);font-family:var(--font-body);line-height:1.6;-webkit-font-smoothing:antialiased}
a{color:var(--amber);text-decoration:none}a:hover{color:var(--text)}

.nav{position:sticky;top:0;z-index:100;background:rgba(8,8,13,.92);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);padding:0 2rem;height:60px;display:flex;align-items:center;justify-content:space-between}
.nav-logo{font-family:var(--font-mono);font-size:.85rem;color:var(--text2)}.nav-logo span{color:var(--amber)}
.nav-links{display:flex;gap:1.5rem}.nav-links a{font-size:.85rem;color:var(--text2);font-weight:500}.nav-links a:hover{color:var(--amber)}
@media(max-width:768px){.nav-links{display:none}}

.breadcrumb-bar{max-width:960px;margin:0 auto;padding:0 2rem;width:100%}
.breadcrumb{display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:11px;color:var(--text3);padding:12px 0;border-bottom:1px solid var(--border);flex-wrap:wrap}
.breadcrumb a{color:var(--text3)}.breadcrumb a:hover{color:var(--amber)}.breadcrumb .sep{opacity:.4}

.hero{max-width:960px;margin:0 auto;padding:3rem 2rem 2rem;display:flex;gap:3rem;align-items:flex-start}
.score-ring{flex-shrink:0;text-align:center}
.score-ring svg{width:140px;height:140px}
.score-ring .label{font-family:var(--font-mono);font-size:11px;color:var(--text3);margin-top:8px}
.hero-info{flex:1;min-width:0}
.hero-info h1{font-family:var(--font-serif);font-size:clamp(1.4rem,3vw,2rem);margin-bottom:8px}
.hero-info .verdict{color:var(--text2);font-size:1rem;line-height:1.6;margin-bottom:12px}
.hero-meta{font-family:var(--font-mono);font-size:.72rem;color:var(--text3);display:flex;flex-wrap:wrap;gap:16px}
.hero-meta .tag{display:inline-flex;align-items:center;gap:4px}
@media(max-width:640px){.hero{flex-direction:column;align-items:center;text-align:center}.hero-meta{justify-content:center}}

.content{max-width:960px;margin:0 auto;padding:0 2rem 4rem}

.section{margin-bottom:2.5rem}
.section-title{font-family:var(--font-mono);font-size:.9rem;color:var(--amber);font-weight:600;margin-bottom:16px;padding-bottom:8px;border-bottom:1px solid var(--border)}

.engines-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin-bottom:2rem}
.engine-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden}
.engine-header{display:flex;justify-content:space-between;align-items:flex-start;padding:20px;gap:12px}
.engine-name{font-family:var(--font-mono);font-size:.85rem;font-weight:600;color:var(--text);text-transform:capitalize;margin-bottom:4px}
.engine-summary{font-size:.78rem;color:var(--text3);line-height:1.5}
.engine-score{font-family:var(--font-mono);font-size:2.4rem;font-weight:700;line-height:1;flex-shrink:0}
.signal-table{width:100%;border-collapse:collapse}
.signal-table th{padding:8px 12px;text-align:left;font-family:var(--font-mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;background:var(--bg3);border-bottom:1px solid var(--border)}
.signal-table th:last-child{text-align:center}

.detection-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px;margin-bottom:16px}
.detection-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.detection-label{font-family:var(--font-mono);font-size:.82rem;font-weight:600}
.detection-badge{font-family:var(--font-mono);font-size:.72rem;padding:4px 12px;border-radius:16px;font-weight:600}
.detection-detail{color:var(--text2);font-size:.85rem;line-height:1.7;margin-bottom:12px}
.indicator{display:inline-block;background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-size:.72rem;color:var(--text2);margin:2px 4px 2px 0}

.analysis-text{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:28px;color:var(--text2);font-size:.9rem;line-height:1.8;white-space:pre-wrap}

.dispute-cta{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:28px;text-align:center}
.dispute-cta h3{font-family:var(--font-mono);font-size:.9rem;color:var(--text);margin-bottom:8px}
.dispute-cta p{color:var(--text3);font-size:.82rem;margin-bottom:16px}
.dispute-cta a.btn{display:inline-block;background:transparent;border:1px solid var(--border);color:var(--text2);padding:10px 24px;border-radius:8px;font-family:var(--font-mono);font-size:.82rem;font-weight:600;transition:all .2s}
.dispute-cta a.btn:hover{border-color:var(--amber);color:var(--amber)}

.methodology{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px}
.methodology p{color:var(--text3);font-size:.8rem;line-height:1.7;margin-bottom:8px}
.methodology p:last-child{margin-bottom:0}

footer{text-align:center;padding:3rem 2rem;border-top:1px solid var(--border);font-size:.8rem;color:var(--text3)}
footer a{color:var(--text2)}footer a:hover{color:var(--amber)}

@media print{body{background:#fff;color:#111}.nav,.breadcrumb-bar,.dispute-cta{display:none}*{color:#111!important;background:transparent!important;border-color:#ddd!important}}
</style>
</head>
<body>
<nav class="nav">
  <a href="/tools/argus/" class="nav-logo"><span>ARGUS</span> by googleadsagent.ai</a>
  <div class="nav-links">
    <a href="/tools/argus/">Overview</a>
    <a href="/tools/argus/reports">Reports</a>
    <a href="/tools/argus/app.html">Submit</a>
    <a href="/tools/argus/dispute.html">Dispute</a>
    <a href="/tools/argus/docs.html">Docs</a>
    <a href="/tools/">All Tools</a>
  </div>
</nav>

<div class="breadcrumb-bar">
  <nav class="breadcrumb" aria-label="Breadcrumb">
    <a href="/">Home</a><span class="sep">/</span>
    <a href="/tools/">Tools</a><span class="sep">/</span>
    <a href="/tools/argus/">ARGUS</a><span class="sep">/</span>
    <span>Report</span>
  </nav>
</div>

<div class="hero">
  <div class="score-ring">
    <svg viewBox="0 0 100 100">
      <circle cx="50" cy="50" r="40" fill="none" stroke="#1a1a2a" stroke-width="8"/>
      <circle cx="50" cy="50" r="40" fill="none" stroke="${sc}" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="251.2" stroke-dashoffset="${svgPct}" transform="rotate(-90 50 50)" style="transition:stroke-dashoffset .8s ease"/>
      <text x="50" y="46" text-anchor="middle" fill="${sc}" font-family="'JetBrains Mono',monospace" font-size="26" font-weight="700">${a.trust_score}</text>
      <text x="50" y="62" text-anchor="middle" fill="${sc}" font-family="'JetBrains Mono',monospace" font-size="8" font-weight="600" letter-spacing="1">${(a.risk_level || '').toUpperCase()} RISK</text>
    </svg>
    <div class="label">Trust Score / 100</div>
  </div>
  <div class="hero-info">
    <h1>${esc(a.platform_data?.platform || sub.platform)} ${esc(sub.input_type)} Analysis</h1>
    <div class="verdict">${esc(a.verdict)}</div>
    <div class="hero-meta">
      <span class="tag">${riskBadge(a.risk_level)}</span>
      <span class="tag">Platform: ${esc(a.platform_data?.platform || sub.platform)}</span>
      <span class="tag">Type: ${esc(sub.input_type)}</span>
      <span class="tag">Analyzed: ${analyzedDate}</span>
      <span class="tag">Published: ${publishedDate}</span>
    </div>
  </div>
</div>

<div class="content">
  <div class="section">
    <div class="section-title">Subject</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:20px;">
      <div style="font-family:var(--font-mono);font-size:.82rem;color:var(--amber);word-break:break-all;margin-bottom:8px;">
        <a href="${esc(sub.input_url)}" target="_blank" rel="noopener nofollow">${esc(sub.input_url)}</a>
      </div>
      ${a.platform_data?.username ? `<div style="font-size:.82rem;color:var(--text2);">Username: <strong>${esc(a.platform_data.username)}</strong></div>` : ''}
      ${a.platform_data?.display_name ? `<div style="font-size:.82rem;color:var(--text2);">Display Name: <strong>${esc(a.platform_data.display_name)}</strong></div>` : ''}
      ${a.platform_data?.account_age_estimate ? `<div style="font-size:.82rem;color:var(--text2);">Account Age: <strong>${esc(a.platform_data.account_age_estimate)}</strong></div>` : ''}
      ${a.platform_data?.follower_count ? `<div style="font-size:.82rem;color:var(--text2);">Followers: <strong>${esc(a.platform_data.follower_count)}</strong></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Detection Engines</div>
    <div class="engines-grid">
      ${engineCard('Image Engine', a.engines?.image)}
      ${engineCard('Text Engine', a.engines?.text)}
      ${engineCard('Behavioral Engine', a.engines?.behavioral)}
      ${engineCard('Network Engine', a.engines?.network)}
    </div>
  </div>

  ${a.bot_detection ? `<div class="section">
    <div class="section-title">Bot Detection</div>
    <div class="detection-card">
      <div class="detection-header">
        <span class="detection-label" style="color:${a.bot_detection.is_bot_likely ? 'var(--red)' : 'var(--green)'}">
          ${a.bot_detection.is_bot_likely ? 'Bot Activity Likely' : 'No Bot Activity Detected'}
        </span>
        <span class="detection-badge" style="background:${a.bot_detection.is_bot_likely ? 'rgba(248,113,113,.1)' : 'rgba(74,222,128,.1)'};color:${a.bot_detection.is_bot_likely ? 'var(--red)' : 'var(--green)'}">
          ${a.bot_detection.confidence}% confidence
        </span>
      </div>
      <div class="detection-detail">${esc(a.bot_detection.detail)}</div>
      <div>${(a.bot_detection.indicators || []).map(i => `<span class="indicator">${esc(i)}</span>`).join('')}</div>
    </div>
  </div>` : ''}

  ${a.ai_content ? `<div class="section">
    <div class="section-title">AI-Generated Content</div>
    <div class="detection-card">
      <div class="detection-header">
        <span class="detection-label" style="color:${a.ai_content.is_ai_likely ? 'var(--red)' : 'var(--green)'}">
          ${a.ai_content.is_ai_likely ? 'AI Content Detected' : 'No AI Content Detected'}
        </span>
        <span class="detection-badge" style="background:${a.ai_content.is_ai_likely ? 'rgba(248,113,113,.1)' : 'rgba(74,222,128,.1)'};color:${a.ai_content.is_ai_likely ? 'var(--red)' : 'var(--green)'}">
          ${a.ai_content.confidence}% confidence
        </span>
      </div>
      <div class="detection-detail">${esc(a.ai_content.detail)}</div>
      <div>${(a.ai_content.indicators || []).map(i => `<span class="indicator">${esc(i)}</span>`).join('')}</div>
    </div>
  </div>` : ''}

  ${a.fake_engagement?.detected ? `<div class="section">
    <div class="section-title">Fake Engagement</div>
    <div class="detection-card">
      <div class="detection-header">
        <span class="detection-label" style="color:var(--red)">Fake Engagement Detected</span>
        <span class="detection-badge" style="background:rgba(248,113,113,.1);color:var(--red)">${a.fake_engagement.confidence}% confidence</span>
      </div>
      <div class="detection-detail">${esc(a.fake_engagement.detail)}</div>
      <div>${(a.fake_engagement.indicators || []).map(i => `<span class="indicator">${esc(i)}</span>`).join('')}</div>
    </div>
  </div>` : ''}

  ${a.comments_analysis && a.comments_analysis.total_visible > 0 ? `<div class="section">
    <div class="section-title">Comment & Engagement Analysis</div>
    <div class="detection-card" style="padding:0;overflow:hidden;">
      <div style="padding:20px 24px;display:flex;flex-wrap:wrap;gap:16px;align-items:center;">
        <div style="font-family:var(--font-mono);font-size:1.8rem;font-weight:700;color:var(--amber);">${a.comments_analysis.total_visible}</div>
        <div style="font-size:.82rem;color:var(--text2);">comments analyzed</div>
        <div style="margin-left:auto;display:flex;gap:16px;">
          <div style="text-align:center;"><div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:var(--green);">${a.comments_analysis.authentic_count || 0}</div><div style="font-size:.68rem;color:var(--text3);">Authentic</div></div>
          <div style="text-align:center;"><div style="font-family:var(--font-mono);font-size:1.2rem;font-weight:700;color:var(--red);">${a.comments_analysis.suspicious_count || 0}</div><div style="font-size:.68rem;color:var(--text3);">Suspicious</div></div>
        </div>
      </div>
      <div style="padding:0 24px 16px;color:var(--text2);font-size:.85rem;line-height:1.7;">${esc(a.comments_analysis.overall_assessment || '')}</div>
      ${(a.comments_analysis.comments || []).length > 0 ? `<table style="width:100%;border-collapse:collapse;">
        <thead><tr>
          <th style="padding:10px 16px;text-align:left;font-family:var(--font-mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;background:var(--bg3);border-top:1px solid var(--border);">Commenter</th>
          <th style="padding:10px 16px;text-align:left;font-family:var(--font-mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;background:var(--bg3);border-top:1px solid var(--border);">Comment Summary</th>
          <th style="padding:10px 16px;text-align:center;font-family:var(--font-mono);font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:1px;background:var(--bg3);border-top:1px solid var(--border);">Status</th>
        </tr></thead>
        <tbody>${(a.comments_analysis.comments || []).map(c => `<tr>
          <td style="padding:10px 16px;border-bottom:1px solid var(--surface);color:var(--amber);font-family:var(--font-mono);font-size:.78rem;font-weight:500;">${esc(c.username)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid var(--surface);color:var(--text2);font-size:.8rem;">${esc(c.summary)}</td>
          <td style="padding:10px 16px;border-bottom:1px solid var(--surface);text-align:center;">
            <span style="display:inline-block;padding:3px 10px;border-radius:12px;font-size:.68rem;font-weight:600;font-family:var(--font-mono);${c.is_suspicious ? 'background:rgba(248,113,113,.12);color:var(--red);' : 'background:rgba(74,222,128,.12);color:var(--green);'}">${c.is_suspicious ? 'Suspicious' : 'Authentic'}</span>
            ${c.suspicion_reason ? `<div style="font-size:.68rem;color:var(--text3);margin-top:2px;">${esc(c.suspicion_reason)}</div>` : ''}
          </td>
        </tr>`).join('')}</tbody>
      </table>` : ''}
    </div>
  </div>` : ''}

  ${a.poster_profile?.username ? `<div class="section">
    <div class="section-title">Poster Profile</div>
    <div class="detection-card">
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:12px;">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-family:var(--font-mono);font-size:1.2rem;color:var(--amber);font-weight:700;">${esc((a.poster_profile.username || '?')[0].toUpperCase())}</div>
        <div>
          <div style="font-family:var(--font-mono);font-size:.9rem;font-weight:600;color:var(--amber);">${esc(a.poster_profile.username)}</div>
          ${a.poster_profile.profile_url ? `<a href="${esc(a.poster_profile.profile_url)}" target="_blank" rel="noopener nofollow" style="font-size:.72rem;color:var(--text3);">View Profile</a>` : ''}
        </div>
      </div>
      ${a.poster_profile.account_indicators ? `<div style="color:var(--text2);font-size:.85rem;line-height:1.7;margin-bottom:8px;">${esc(a.poster_profile.account_indicators)}</div>` : ''}
      ${a.poster_profile.posting_history_notes ? `<div style="color:var(--text3);font-size:.82rem;line-height:1.6;font-style:italic;">${esc(a.poster_profile.posting_history_notes)}</div>` : ''}
    </div>
  </div>` : ''}

  ${a.cross_platform ? `<div class="section">
    <div class="section-title">Cross-Platform Consistency</div>
    <div class="detection-card">
      <div class="detection-header">
        <span class="detection-label" style="color:var(--text)">Consistency Score: ${a.cross_platform.consistency_score}/100</span>
        <span class="detection-badge" style="background:var(--bg3);color:var(--text2)">
          ${(a.cross_platform.platforms_checked || []).join(', ')}
        </span>
      </div>
      <div class="detection-detail">${esc(a.cross_platform.findings)}</div>
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Detailed Analysis</div>
    <div class="analysis-text">${esc(a.detailed_analysis)}</div>
  </div>

  ${(a.recommendations || []).length > 0 ? `<div class="section">
    <div class="section-title">Recommendations</div>
    <ul style="list-style:none;padding:0;">
      ${a.recommendations.map(r => `<li style="background:var(--bg2);border:1px solid var(--border);border-radius:8px;padding:12px 16px;margin-bottom:8px;color:var(--text2);font-size:.85rem;">
        <span style="color:var(--amber);margin-right:8px;">&#10148;</span>${esc(r)}
      </li>`).join('')}
    </ul>
  </div>` : ''}

  ${a.scoring ? `<div class="section">
    <div class="section-title">Score Calculation</div>
    <div style="background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:24px;">
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px;">
        <div style="text-align:center;flex:1;min-width:100px;">
          <div style="font-family:var(--font-mono);font-size:.68rem;color:var(--text3);margin-bottom:4px;">WEIGHTED COMPOSITE</div>
          <div style="font-family:var(--font-mono);font-size:1.8rem;font-weight:700;color:#60a5fa;">${a.scoring.weighted_composite}</div>
          <div style="font-size:.68rem;color:var(--text3);">Net ${Math.round(a.scoring.engine_scores.network * 0.35)} + Beh ${Math.round(a.scoring.engine_scores.behavioral * 0.30)} + Img ${Math.round(a.scoring.engine_scores.image * 0.20)} + Txt ${Math.round(a.scoring.engine_scores.text * 0.15)}</div>
        </div>
        <div style="text-align:center;flex:1;min-width:100px;">
          <div style="font-family:var(--font-mono);font-size:.68rem;color:var(--text3);margin-bottom:4px;">PENALTIES</div>
          <div style="font-family:var(--font-mono);font-size:1.8rem;font-weight:700;color:#f87171;">-${a.scoring.total_penalty}</div>
          <div style="font-size:.68rem;color:var(--text3);">${a.scoring.penalties.length} factor${a.scoring.penalties.length !== 1 ? 's' : ''}</div>
        </div>
        <div style="text-align:center;flex:1;min-width:100px;">
          <div style="font-family:var(--font-mono);font-size:.68rem;color:var(--text3);margin-bottom:4px;">FINAL SCORE</div>
          <div style="font-family:var(--font-mono);font-size:1.8rem;font-weight:700;color:${scoreColor(a.trust_score)};">${a.trust_score}</div>
          <div style="font-size:.68rem;color:var(--text3);">of 100</div>
        </div>
      </div>
      ${a.scoring.penalties.length > 0 ? `<div style="border-top:1px solid var(--border);padding-top:12px;">
        <div style="font-family:var(--font-mono);font-size:.68rem;color:var(--text3);margin-bottom:8px;">PENALTIES APPLIED:</div>
        ${a.scoring.penalties.map(p => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(42,42,58,.3);font-size:.8rem;">
          <span style="color:var(--text2);">${esc(p.reason)}</span>
          <span style="color:#f87171;font-family:var(--font-mono);font-weight:600;">-${p.amount}</span>
        </div>`).join('')}
      </div>` : ''}
      <div style="margin-top:12px;font-size:.72rem;color:var(--text3);">Engine weights: Network 35% &middot; Behavioral 30% &middot; Image 20% &middot; Text 15%</div>
    </div>
  </div>` : ''}

  <div class="section">
    <div class="section-title">Methodology</div>
    <div class="methodology">
      <p>This report was generated by ARGUS (Algorithmic Reality & Genuineness Unified Scanner), an open-source authenticity analysis platform. The analysis uses four parallel detection engines examining image provenance, text authenticity, behavioral patterns, and network topology.</p>
      <p>Trust scores are computed algorithmically: a weighted composite of engine scores (Network 35%, Behavioral 30%, Image 20%, Text 15%) minus penalties for unverifiable data, detected anomalies, and red flags. This ensures each analysis has a unique, evidence-based score rather than a generic rating.</p>
      <p>Scores below 40 indicate high risk of inauthenticity. This analysis is algorithmic opinion based on publicly available signals and does not constitute a legal, factual, or identity determination.</p>
      <p>Model: ${esc(a.model_used || 'Claude')} &middot; Analyzed: ${analyzedDate} &middot; Published: ${publishedDate} &middot; Report ID: ${esc(sub.slug || sub.id)}</p>
    </div>
  </div>

  <div class="section">
    <div class="dispute-cta">
      <h3>Dispute This Analysis</h3>
      <p>If you are the subject of this analysis or believe it contains errors, you have the right to dispute at any time. We review all disputes within 14 business days.</p>
      <a href="/tools/argus/dispute.html?url=${encodeURIComponent(sub.input_url)}" class="btn">File a Dispute</a>
    </div>
  </div>
</div>

<footer>
  <p>
    <a href="/tools/argus/">ARGUS</a> by <a href="/">googleadsagent.ai</a> &middot;
    <a href="/tools/argus/app.html">Submit</a> &middot;
    <a href="/tools/argus/dispute.html">Dispute</a> &middot;
    <a href="/tools/argus/docs.html">Docs</a> &middot;
    <a href="https://github.com/itallstartedwithaidea/argus">GitHub</a>
  </p>
  <p style="margin-top:12px;font-size:.72rem;">Algorithmic opinion &mdash; not a legal or factual determination.</p>
</footer>
</body>
</html>`;
}
