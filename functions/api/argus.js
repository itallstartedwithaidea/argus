/**
 * ARGUS API — Submission, Analysis, Approval, Dispute, Email
 * 
 * POST actions: submit, dispute, analyze, approve, reject
 * GET actions:  queue, disputes, submission
 */

const ALLOWED_ORIGINS = [
  'https://googleadsagent.ai',
  'https://www.googleadsagent.ai',
  'https://googleadsagent-site.pages.dev',
  'http://localhost:8788',
];

const ADMIN_EMAIL = 'john@itallstartedwithaidea.com';
const ANALYSIS_MODEL = 'claude-sonnet-4-20250514';

function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin');
  if (origin && ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith('.pages.dev'))) return origin;
  return ALLOWED_ORIGINS[0];
}

function ch(request) {
  return { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': getAllowedOrigin(request) };
}

function json(data, status, request) {
  return new Response(JSON.stringify(data), { status, headers: ch(request) });
}

function generateId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

function generateSlug(sub) {
  const platform = (sub.platform || 'unknown').toLowerCase().replace(/[^a-z]/g, '');
  const a = sub.analysis;
  const src = (a?.verdict || sub.input_url || '').toLowerCase();
  const stop = new Set(['this','that','with','from','have','been','appears','the','and','for','are','but','not','you','all','can','had','her','was','one','our','out','its']);
  const words = src.replace(/https?:\/\/[^\s]+/g, '').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !stop.has(w)).slice(0, 5).join('-');
  const score = a?.trust_score ?? 0;
  return `${platform}-${words}-${score}`.replace(/--+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function sanitize(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[<>]/g, '').trim();
}

const PLATFORMS = {
  'linkedin.com': 'LinkedIn', 'reddit.com': 'Reddit', 'instagram.com': 'Instagram',
  'x.com': 'X (Twitter)', 'twitter.com': 'X (Twitter)', 'facebook.com': 'Facebook',
  'youtube.com': 'YouTube', 'quora.com': 'Quora', 'tiktok.com': 'TikTok',
};

function detectPlatform(url) {
  const lower = (url || '').toLowerCase();
  for (const [host, name] of Object.entries(PLATFORMS)) {
    if (lower.includes(host)) return name;
  }
  return 'Unknown';
}

// ── Session verification ────────────────────────────────────────────

async function verifyAdmin(request, env) {
  const sessionId = request.headers.get('X-Session-Id') || new URL(request.url).searchParams.get('session_id');
  if (!sessionId) return false;
  const store = env.USERS || env.SESSIONS;
  if (!store) return false;
  try {
    const raw = await store.get(`auth:${sessionId}`, 'json');
    return raw?.email === ADMIN_EMAIL;
  } catch { return false; }
}

// ── POST handler ────────────────────────────────────────────────────

export async function onRequestPost({ request, env }) {
  const action = new URL(request.url).searchParams.get('action');
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // File upload uses FormData, not JSON
  if (action === 'upload') return handleFileUpload(request, env);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Invalid request body' }, 400, request); }

  if (action === 'submit')  return handleSubmit(body, ip, env, request);
  if (action === 'dispute') return handleDispute(body, ip, env, request);

  // Admin-only actions
  if (!await verifyAdmin(request, env)) return json({ error: 'Not found' }, 404, request);

  if (action === 'analyze')         return handleAnalyze(body, env, request);
  if (action === 'approve')         return handleApprove(body, env, request);
  if (action === 'reject')          return handleReject(body, env, request);
  if (action === 'dispute_resolve') return handleDisputeResolve(body, env, request);

  return json({ error: 'Unknown action' }, 400, request);
}

// ── GET handler ─────────────────────────────────────────────────────

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action');

  if (action === 'submission') {
    const id = url.searchParams.get('id');
    if (!id) return json({ error: 'Missing id' }, 400, request);
    const store = env.SESSIONS;
    if (!store) return json({ error: 'No storage' }, 500, request);
    const sub = await store.get(`argus:submission:${id}`, 'json');
    if (!sub) return json({ error: 'Not found' }, 404, request);
    if (sub.status !== 'published') {
      if (!await verifyAdmin(request, env)) return json({ error: 'Not found' }, 404, request);
    }
    return json({ submission: sub }, 200, request);
  }

  // Admin-only
  if (action === 'queue' || action === 'disputes' || action === 'stats') {
    if (!await verifyAdmin(request, env)) return json({ error: 'Not found' }, 404, request);
  }

  if (action === 'queue')    return handleAdminQueue(env, request);
  if (action === 'disputes') return handleAdminDisputes(env, request);
  if (action === 'stats')    return handleStats(env, request);

  // Public endpoints
  if (action === 'published') return handlePublishedList(env, request);

  return json({ error: 'Unknown action' }, 400, request);
}

// ── File Upload ─────────────────────────────────────────────────────

async function handleFileUpload(request, env) {
  const store = env.FILES;
  if (!store) return json({ error: 'File storage not available' }, 500, request);

  let formData;
  try { formData = await request.formData(); } catch { return json({ error: 'Invalid form data' }, 400, request); }

  const file = formData.get('file');
  if (!file || typeof file === 'string') return json({ error: 'No file provided' }, 400, request);

  if (file.size > 10 * 1024 * 1024) return json({ error: 'File exceeds 10MB limit' }, 400, request);

  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  if (!allowed.includes(file.type)) return json({ error: 'File type not allowed' }, 400, request);

  const ext = (file.name || 'file').split('.').pop().toLowerCase();
  const key = `argus/evidence/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  await store.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { originalName: (file.name || 'unknown').slice(0, 200), uploadedAt: new Date().toISOString() },
  });

  return json({ key, name: file.name, size: file.size }, 200, request);
}

// ── Submit ──────────────────────────────────────────────────────────

async function handleSubmit(body, ip, env, request) {
  const { url: inputUrl, input_type, reason, submitter_email, notify_on_publish,
    private_mode, manual_platform, manual_username, manual_content, manual_screenshots, manual_metrics } = body;
  if (!private_mode && (!inputUrl || typeof inputUrl !== 'string' || inputUrl.length < 10)) {
    return json({ error: 'A valid URL is required' }, 400, request);
  }
  if (private_mode && !manual_content && (!inputUrl || inputUrl.startsWith('private://'))) {
    return json({ error: 'Private mode requires pasted content or a URL' }, 400, request);
  }

  if (env.SESSIONS) {
    const rk = `argus_submit:${ip}`;
    try {
      const cur = await env.SESSIONS.get(rk, 'json');
      const now = Math.floor(Date.now() / 1000);
      if (cur && cur.ws + 3600 > now && cur.c >= 10) return json({ error: 'Rate limit exceeded' }, 429, request);
      const c = (cur && cur.ws + 3600 > now) ? cur.c + 1 : 1;
      const ws = (cur && cur.ws + 3600 > now) ? cur.ws : now;
      await env.SESSIONS.put(rk, JSON.stringify({ c, ws }), { expirationTtl: 3610 });
    } catch {}
  }

  const id = generateId();
  const cf = request.cf || {};
  const effectiveUrl = inputUrl || `private://${manual_platform || 'unknown'}/${id}`;
  const submission = {
    id, input_url: effectiveUrl, input_type: input_type || 'profile',
    reason: sanitize(reason).slice(0, 2000),
    submitter_email: submitter_email || null, notify_on_publish: !!notify_on_publish,
    submitted_by: 'community', status: 'queued',
    ip, city: cf.city || null, region: cf.region || null, country: cf.country || null,
    latitude: cf.latitude || null, longitude: cf.longitude || null,
    timezone: cf.timezone || null, asn: cf.asn || null,
    ua: (request.headers.get('User-Agent') || '').slice(0, 300),
    platform: private_mode ? (manual_platform || 'Unknown') : detectPlatform(inputUrl),
    created_at: new Date().toISOString(),
    analysis: null, approved_at: null, admin_notes: null,
    published_url: null, email_sent: false,
    // Private mode fields
    private_mode: !!private_mode,
    manual_content: private_mode ? sanitize(manual_content).slice(0, 50000) : null,
    manual_username: private_mode ? sanitize(manual_username).slice(0, 200) : null,
    manual_screenshots: private_mode ? (manual_screenshots || []).slice(0, 5) : null,
    manual_metrics: private_mode ? manual_metrics : null,
  };

  if (env.SESSIONS) {
    try {
      await env.SESSIONS.put(`argus:submission:${id}`, JSON.stringify(submission), { expirationTtl: 86400 * 365 });
      const idx = await env.SESSIONS.get('argus:submission_index', 'json') || [];
      idx.unshift({ id, url: inputUrl, type: input_type || 'profile', platform: submission.platform, created_at: submission.created_at, status: 'queued' });
      await env.SESSIONS.put('argus:submission_index', JSON.stringify(idx.slice(0, 1000)), { expirationTtl: 86400 * 365 });
    } catch (e) { console.error('[ARGUS] KV write error:', e); }
  }

  return json({ status: 'submitted', submission_id: id, message: 'Submission received and queued for analysis. Our team will review before publishing.' }, 202, request);
}

// ── Dispute ─────────────────────────────────────────────────────────

async function handleDispute(body, ip, env, request) {
  const { claimant_name, claimant_email, profile_url, platform, handle, dispute_type, reason, evidence_notes, evidence_files } = body;
  if (!claimant_name || !claimant_email || !dispute_type || !reason) {
    return json({ error: 'Missing required fields' }, 400, request);
  }

  const id = generateId();
  const dispute = {
    id, claimant_name: sanitize(claimant_name).slice(0, 200),
    claimant_email: claimant_email.slice(0, 320),
    profile_url: sanitize(profile_url).slice(0, 2000),
    platform: platform || null, handle: handle || null, dispute_type,
    reason: sanitize(reason).slice(0, 5000),
    evidence_notes: sanitize(evidence_notes).slice(0, 5000),
    evidence_files: Array.isArray(evidence_files) ? evidence_files.slice(0, 3) : [],
    status: 'pending', ip, created_at: new Date().toISOString(),
  };

  if (env.SESSIONS) {
    try {
      await env.SESSIONS.put(`argus:dispute:${id}`, JSON.stringify(dispute), { expirationTtl: 86400 * 365 });
      const idx = await env.SESSIONS.get('argus:dispute_index', 'json') || [];
      idx.unshift({ id, name: claimant_name, type: dispute_type, created_at: dispute.created_at, status: 'pending' });
      await env.SESSIONS.put('argus:dispute_index', JSON.stringify(idx.slice(0, 500)), { expirationTtl: 86400 * 365 });
    } catch (e) { console.error('[ARGUS] KV dispute error:', e); }
  }

  return json({ status: 'received', dispute_id: id, message: 'Dispute received. Review within 14 business days.' }, 201, request);
}

// ── Analyze (Admin) ─────────────────────────────────────────────────

async function handleAnalyze(body, env, request) {
  const { submission_id, api_key } = body;
  if (!submission_id) return json({ error: 'Missing submission_id' }, 400, request);
  if (!env.SESSIONS) return json({ error: 'No storage' }, 500, request);

  const sub = await env.SESSIONS.get(`argus:submission:${submission_id}`, 'json');
  if (!sub) return json({ error: 'Submission not found' }, 404, request);

  // Use key from request (shared from auditor), env secret, or KV-stored config
  let apiKey = api_key || env.ANTHROPIC_API_KEY;
  if (!apiKey && env.SESSIONS) {
    try {
      const cfg = await env.SESSIONS.get('argus:config', 'json');
      if (cfg?.anthropic_key) apiKey = cfg.anthropic_key;
    } catch {}
  }
  if (!apiKey) {
    return json({ error: 'No API key found. Enter your Anthropic key in the ARGUS admin settings or the Auditor tool.' }, 400, request);
  }

  // Persist key in KV for future use (same KV as auditor)
  if (api_key && env.SESSIONS) {
    try {
      const cfg = await env.SESSIONS.get('argus:config', 'json') || {};
      cfg.anthropic_key = api_key;
      await env.SESSIONS.put('argus:config', JSON.stringify(cfg), { expirationTtl: 86400 * 365 });
    } catch {}
  }

  sub.status = 'analyzing';
  await env.SESSIONS.put(`argus:submission:${submission_id}`, JSON.stringify(sub), { expirationTtl: 86400 * 365 });

  let pageContent = '';

  // For private mode, use manually provided content; otherwise scrape
  if (sub.private_mode && sub.manual_content) {
    pageContent = `[PRIVATE/MANUAL SUBMISSION — content provided by submitter, not scraped]\n`;
    if (sub.manual_username) pageContent += `Username/Handle: ${sub.manual_username}\n`;
    if (sub.manual_metrics) {
      const m = sub.manual_metrics;
      pageContent += `Reported Metrics: `;
      if (m.followers != null) pageContent += `Followers: ${m.followers}, `;
      if (m.likes != null) pageContent += `Likes: ${m.likes}, `;
      if (m.comments != null) pageContent += `Comments: ${m.comments}, `;
      if (m.shares != null) pageContent += `Shares: ${m.shares}, `;
      if (m.account_age) pageContent += `Account Age: ${m.account_age}, `;
      if (m.total_posts != null) pageContent += `Total Posts: ${m.total_posts}`;
      pageContent += '\n\n';
    }
    pageContent += `--- Submitter-Provided Content ---\n${sub.manual_content}`;
    if (sub.manual_screenshots?.length > 0) {
      pageContent += `\n\n[${sub.manual_screenshots.length} screenshot(s) uploaded as evidence]`;
    }
  } else if (!sub.input_url.startsWith('private://')) {
    try {
      const resp = await fetch(sub.input_url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARGUS-Analyzer/1.0; +https://googleadsagent.ai/tools/argus/)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(12000),
      });
      if (resp.ok) {
        const text = await resp.text();
        pageContent = text.slice(0, 30000);
      }
    } catch (e) {
      pageContent = '[Could not fetch page: ' + (e.message || 'timeout') + ']';
    }
  }

  const prompt = buildAnalysisPrompt(sub, pageContent);

  let analysis;
  try {
    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANALYSIS_MODEL,
        max_tokens: 8192,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    const aiData = await aiResp.json();
    const text = aiData.content?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    analysis = JSON.parse(jsonMatch[0]);
    analysis.analyzed_at = new Date().toISOString();
    analysis.model_used = ANALYSIS_MODEL;
    analysis.page_content_length = pageContent.length;

    // Post-processing: compute weighted composite score from engine scores
    analysis = applyScoreAlgorithm(analysis, sub, pageContent);
  } catch (e) {
    sub.status = 'queued';
    await env.SESSIONS.put(`argus:submission:${submission_id}`, JSON.stringify(sub), { expirationTtl: 86400 * 365 });
    return json({ error: 'Analysis failed: ' + (e.message || 'unknown'), raw: e.toString() }, 500, request);
  }

  sub.analysis = analysis;
  sub.status = 'analyzed';
  await env.SESSIONS.put(`argus:submission:${submission_id}`, JSON.stringify(sub), { expirationTtl: 86400 * 365 });

  // Update index
  try {
    const idx = await env.SESSIONS.get('argus:submission_index', 'json') || [];
    const entry = idx.find(e => e.id === submission_id);
    if (entry) {
      entry.status = 'analyzed';
      entry.trust_score = analysis.trust_score;
      entry.risk_level = analysis.risk_level;
      await env.SESSIONS.put('argus:submission_index', JSON.stringify(idx), { expirationTtl: 86400 * 365 });
    }
  } catch {}

  return json({ status: 'analyzed', submission: sub }, 200, request);
}

// ── Post-Processing Score Algorithm ──────────────────────────────────

function applyScoreAlgorithm(analysis, sub, pageContent) {
  const eng = analysis.engines || {};
  const imgScore = eng.image?.score ?? 50;
  const txtScore = eng.text?.score ?? 50;
  const behScore = eng.behavioral?.score ?? 50;
  const netScore = eng.network?.score ?? 50;

  // Weighted composite: Network 35%, Behavioral 30%, Image 20%, Text 15%
  let composite = Math.round(netScore * 0.35 + behScore * 0.30 + imgScore * 0.20 + txtScore * 0.15);

  // Penalty system
  let penalties = [];
  let totalPenalty = 0;

  function penalize(amount, reason) {
    totalPenalty += amount;
    penalties.push({ amount, reason });
  }

  // Can't verify account age
  const pd = analysis.platform_data || {};
  if (!pd.account_age_estimate || pd.account_age_estimate === 'Unable to determine' ||
      pd.account_age_estimate?.toLowerCase().includes('unable') ||
      pd.account_age_estimate?.toLowerCase().includes('unknown')) {
    penalize(8, 'Account age unverifiable');
  }

  // No visible posting history
  if (!pd.post_count || pd.post_count === 'Not visible' || pd.post_count === '0') {
    penalize(10, 'No visible posting history');
  }

  // Private mode — submitter-provided content not independently verified
  if (sub.private_mode) {
    penalize(15, 'Private submission — content not independently verified');
  }

  // Page couldn't be fetched (for non-private)
  if (!sub.private_mode && pageContent.startsWith('[Could not fetch')) {
    penalize(12, 'Page content could not be fetched for independent analysis');
  }

  // Page content was very short (likely blocked/restricted)
  if (!sub.private_mode && pageContent.length < 500 && !pageContent.startsWith('[')) {
    penalize(10, 'Very limited page content available');
  }

  // Bot detection penalty
  if (analysis.bot_detection?.is_bot_likely) {
    penalize(Math.min(20, Math.round(analysis.bot_detection.confidence * 0.2)), 'Bot activity detected');
  }

  // AI content penalty
  if (analysis.ai_content?.is_ai_likely) {
    penalize(Math.min(15, Math.round(analysis.ai_content.confidence * 0.15)), 'AI-generated content detected');
  }

  // Fake engagement penalty
  if (analysis.fake_engagement?.detected) {
    penalize(Math.min(20, Math.round(analysis.fake_engagement.confidence * 0.2)), 'Fake engagement detected');
  }

  // Comment section analysis penalty
  const ca = analysis.comments_analysis;
  if (ca && ca.total_visible > 0) {
    const suspPct = (ca.suspicious_count || 0) / ca.total_visible;
    if (suspPct > 0.5) penalize(15, `${Math.round(suspPct * 100)}% of comments flagged suspicious`);
    else if (suspPct > 0.25) penalize(8, `${Math.round(suspPct * 100)}% of comments flagged suspicious`);
  }

  // Follower/engagement anomaly
  if (pd.follower_count && pd.post_count) {
    const followers = parseInt(String(pd.follower_count).replace(/[^0-9]/g, ''));
    const posts = parseInt(String(pd.post_count).replace(/[^0-9]/g, ''));
    if (followers > 10000 && posts < 5) penalize(18, 'Follower/post ratio anomaly (high followers, minimal posts)');
    if (posts > 100 && followers < 10) penalize(12, 'Post/follower ratio anomaly (many posts, almost no followers)');
  }

  // New account with high engagement from manual metrics
  if (sub.manual_metrics) {
    const m = sub.manual_metrics;
    if (m.account_age && (m.account_age.includes('day') || m.account_age.includes('week') || m.account_age.includes('new'))) {
      if ((m.followers && m.followers > 1000) || (m.likes && m.likes > 500)) {
        penalize(20, 'New account with disproportionately high engagement');
      }
    }
  }

  // Apply penalties
  const adjustedScore = Math.max(0, Math.min(100, composite - totalPenalty));

  // Determine risk level from adjusted score
  let riskLevel;
  if (adjustedScore <= 25) riskLevel = 'critical';
  else if (adjustedScore <= 40) riskLevel = 'high';
  else if (adjustedScore <= 60) riskLevel = 'medium';
  else riskLevel = 'low';

  // Store both Claude's original and the algorithmic composite
  analysis.claude_raw_score = analysis.trust_score;
  analysis.trust_score = adjustedScore;
  analysis.risk_level = riskLevel;
  analysis.scoring = {
    weighted_composite: composite,
    penalties,
    total_penalty: totalPenalty,
    engine_weights: { network: 0.35, behavioral: 0.30, image: 0.20, text: 0.15 },
    engine_scores: { image: imgScore, text: txtScore, behavioral: behScore, network: netScore },
  };

  return analysis;
}

function buildAnalysisPrompt(sub, pageContent) {
  const isPrivate = sub.private_mode;
  return `You are ARGUS (Algorithmic Reality & Genuineness Unified Scanner), a professional authenticity analysis engine for social media content. Analyze this submission with extreme thoroughness and CRITICAL skepticism.

## CRITICAL SCORING RULES — READ CAREFULLY
- DO NOT default to scores of 80-90. MOST content is NOT 80-90.
- Each engine score MUST be independently calculated based on actual evidence.
- If you cannot verify something, that is a PENALTY, not neutral. Unknown = suspicious.
- Score each engine on its OWN merits — engines should RARELY all be within 5 points of each other.
- Apply these scoring guidelines:
  * 90-100: Overwhelming verified evidence of authenticity (verified badge, long history, consistent cross-platform)
  * 70-89: Mostly authentic with some unverifiable elements
  * 50-69: Mixed signals — some authentic, some suspicious. Cannot fully verify.
  * 30-49: Multiple red flags. Significant evidence of inauthenticity.
  * 0-29: Strong evidence of fake/bot/manufactured content.
- The trust_score should be a WEIGHTED composite: Network(35%) + Behavioral(30%) + Image(20%) + Text(15%)
- Apply these PENALTIES to the final score:
  * Cannot verify account age: -10
  * No visible posting history: -15
  * Engagement ratio anomalies (high engagement, low followers or vice versa): -20
  * Private/restricted profile where data is limited: -15
  * Brand new account (<30 days) with high activity: -25
  * Generic/stock profile image: -10
  * Content is mostly AI-generated: -20
  * Detected bot patterns in comments: -15 per pattern
  * Coordinated behavior indicators: -25
${isPrivate ? `  * PRIVATE MODE SUBMISSION — content is submitter-provided, not independently verified: automatic -20 penalty\n` : ''}

## Input
- **URL**: ${sub.input_url}
- **Content Type**: ${sub.input_type || 'profile'}
- **Platform**: ${sub.platform || 'Unknown'}
- **Submitter's Concern**: ${sub.reason || 'No reason provided'}
- **Submission Date**: ${sub.created_at}
${isPrivate ? `- **MODE**: PRIVATE — content below was provided by submitter, not scraped from the URL. Apply higher skepticism.\n` : ''}
${sub.manual_username ? `- **Reported Username**: ${sub.manual_username}\n` : ''}
${sub.manual_metrics ? `- **Reported Metrics**: ${JSON.stringify(sub.manual_metrics)}\n` : ''}

## Page Content (${pageContent.length} chars)
\`\`\`
${pageContent.slice(0, 25000)}
\`\`\`

## Analysis Requirements
Analyze across ALL four detection engines. Be thorough, specific, and evidence-based. Reference actual data from the page content where possible. DO NOT be generous — if evidence is missing, score accordingly.

### Image Engine (Profile pictures, cover photos, post images)
- GAN artifact indicators, stock photo patterns
- Reverse image search potential, C2PA provenance markers
- Visual consistency, EXIF metadata anomalies

### Text Engine (Bio, posts, comments)
- AI-generated text probability (GPT/Claude patterns)
- Stylometric consistency, linguistic fingerprinting
- Templated language, comment farming patterns
- Cross-post content duplication

### Behavioral Engine (Activity patterns)
- Account age vs activity volume ratio
- Posting frequency, timing patterns (bot-like scheduling)
- Engagement ratios (likes/comments vs followers)
- Content velocity anomalies, sudden activity spikes

### Network Engine (Connections, interactions)
- Follower/following ratio analysis
- Interaction network assessment
- Coordination indicators (synchronized posting, identical comments)
- Bot network signatures, click farm patterns

## Comment & Engagement Analysis (CRITICAL — analyze every visible commenter)
If this is a post/thread/article with comments, you MUST analyze them:
- List EVERY visible commenter with their username/handle
- Summarize what each commenter said (1-2 sentences)
- Assess if each comment appears genuine, bot-generated, or suspicious
- Look for coordinated patterns: similar phrasing, identical timing, repetitive praise
- Check for engagement pods, like farming, comment farming
- Rate overall comment section authenticity
- Note any commenters who appear across multiple posts (if visible)

## Platform-Specific Analysis for ${sub.platform || 'Unknown'}
Apply platform-specific detection methods:
- LinkedIn: connection inflation, endorsement farms, AI headshots, engagement pod comments
- Reddit: karma farming, repost bots, astroturfing, upvote manipulation, bot comment patterns
- X/Twitter: follower buying, engagement pods, automated posting, reply bot networks
- Instagram: like/follow bots, comment pods, engagement groups, generic emoji comments
- Facebook: fake page likes, comment bots, share manipulation, engagement baiting
- YouTube: view botting, comment spam, sub4sub networks, AI-generated comment floods
- Quora: AI answer farms, upvote manipulation, sockpuppet answering

## Output — Return ONLY valid JSON, no markdown fences
{
  "trust_score": <0-100, WEIGHTED: network*0.35 + behavioral*0.30 + image*0.20 + text*0.15 minus penalties. DO NOT default to 80-90>,
  "risk_level": "<critical|high|medium|low>",
  "verdict": "<one clear sentence>",
  "detailed_analysis": "<4-6 paragraph comprehensive analysis with specific evidence>",
  "platform_data": {
    "platform": "<name>",
    "url": "<analyzed url>",
    "username": "<extracted or null>",
    "display_name": "<extracted or null>",
    "account_age_estimate": "<if determinable>",
    "follower_count": "<if visible>",
    "post_count": "<if visible>"
  },
  "engines": {
    "image": {
      "score": <0-100>,
      "summary": "<2-3 sentences>",
      "signals": [{"name": "<signal>", "value": "<finding>", "risk": "<critical|high|medium|low|none>"}]
    },
    "text": {"score": <0-100>, "summary": "<2-3 sentences>", "signals": [{"name": "<signal>", "value": "<finding>", "risk": "<risk>"}]},
    "behavioral": {"score": <0-100>, "summary": "<2-3 sentences>", "signals": [{"name": "<signal>", "value": "<finding>", "risk": "<risk>"}]},
    "network": {"score": <0-100>, "summary": "<2-3 sentences>", "signals": [{"name": "<signal>", "value": "<finding>", "risk": "<risk>"}]}
  },
  "bot_detection": {
    "is_bot_likely": <true|false>,
    "confidence": <0-100>,
    "indicators": ["<specific indicator 1>", "<indicator 2>"],
    "detail": "<paragraph>"
  },
  "ai_content": {
    "is_ai_likely": <true|false>,
    "confidence": <0-100>,
    "indicators": ["<specific indicator 1>", "<indicator 2>"],
    "detail": "<paragraph>"
  },
  "fake_engagement": {
    "detected": <true|false>,
    "confidence": <0-100>,
    "indicators": ["<specific indicator 1>", "<indicator 2>"],
    "detail": "<paragraph>"
  },
  "comments_analysis": {
    "total_visible": <number>,
    "authentic_count": <number>,
    "suspicious_count": <number>,
    "overall_assessment": "<paragraph about comment section authenticity>",
    "comments": [
      {
        "username": "<commenter handle>",
        "summary": "<what they said, 1-2 sentences>",
        "is_suspicious": <true|false>,
        "suspicion_reason": "<why suspicious, or null>",
        "sentiment": "<positive|negative|neutral|promotional>"
      }
    ]
  },
  "cross_platform": {
    "consistency_score": <0-100>,
    "platforms_checked": ["<list>"],
    "findings": "<summary>"
  },
  "poster_profile": {
    "username": "<poster/author handle>",
    "profile_url": "<link to their profile if extractable>",
    "account_indicators": "<brief assessment of the poster's account>",
    "posting_history_notes": "<any visible patterns>"
  },
  "recommendations": ["<actionable recommendation 1>", "<recommendation 2>"]
}`;
}

// ── Approve (Admin) ─────────────────────────────────────────────────

async function handleApprove(body, env, request) {
  const { submission_id, admin_notes } = body;
  if (!submission_id) return json({ error: 'Missing submission_id' }, 400, request);
  if (!env.SESSIONS) return json({ error: 'No storage' }, 500, request);

  const sub = await env.SESSIONS.get(`argus:submission:${submission_id}`, 'json');
  if (!sub) return json({ error: 'Not found' }, 404, request);
  if (!sub.analysis) return json({ error: 'Must analyze before approving' }, 400, request);

  sub.status = 'published';
  sub.approved_at = new Date().toISOString();
  sub.admin_notes = admin_notes || null;

  const slug = generateSlug(sub);
  sub.slug = slug;
  sub.published_url = `https://googleadsagent.ai/tools/argus/report/${slug}`;

  // Store slug → ID mapping for SEO-friendly URL resolution
  try { await env.SESSIONS.put(`argus:slug:${slug}`, submission_id, { expirationTtl: 86400 * 365 }); } catch {}

  await env.SESSIONS.put(`argus:submission:${submission_id}`, JSON.stringify(sub), { expirationTtl: 86400 * 365 });

  // Update published index
  try {
    const pub = await env.SESSIONS.get('argus:published_index', 'json') || [];
    pub.unshift({
      id: submission_id, slug, url: sub.input_url, platform: sub.platform,
      trust_score: sub.analysis.trust_score, risk_level: sub.analysis.risk_level,
      verdict: sub.analysis.verdict, published_at: sub.approved_at,
    });
    await env.SESSIONS.put('argus:published_index', JSON.stringify(pub.slice(0, 500)), { expirationTtl: 86400 * 365 });
  } catch {}

  // Update submission index
  try {
    const idx = await env.SESSIONS.get('argus:submission_index', 'json') || [];
    const entry = idx.find(e => e.id === submission_id);
    if (entry) { entry.status = 'published'; }
    await env.SESSIONS.put('argus:submission_index', JSON.stringify(idx), { expirationTtl: 86400 * 365 });
  } catch {}

  // Send email to submitter
  let emailSent = false;
  if (sub.submitter_email && sub.notify_on_publish) {
    try {
      emailSent = await sendResultsEmail(sub, env);
      if (emailSent) {
        sub.email_sent = true;
        sub.email_sent_at = new Date().toISOString();
        await env.SESSIONS.put(`argus:submission:${submission_id}`, JSON.stringify(sub), { expirationTtl: 86400 * 365 });
      }
    } catch (e) { console.error('[ARGUS] Email error:', e); }
  }

  return json({ status: 'published', published_url: sub.published_url, email_sent: emailSent }, 200, request);
}

// ── Reject (Admin) ──────────────────────────────────────────────────

async function handleReject(body, env, request) {
  const { submission_id, reason } = body;
  if (!submission_id) return json({ error: 'Missing submission_id' }, 400, request);
  if (!env.SESSIONS) return json({ error: 'No storage' }, 500, request);

  const sub = await env.SESSIONS.get(`argus:submission:${submission_id}`, 'json');
  if (!sub) return json({ error: 'Not found' }, 404, request);

  sub.status = 'rejected';
  sub.admin_notes = reason || null;
  sub.rejected_at = new Date().toISOString();
  await env.SESSIONS.put(`argus:submission:${submission_id}`, JSON.stringify(sub), { expirationTtl: 86400 * 365 });

  try {
    const idx = await env.SESSIONS.get('argus:submission_index', 'json') || [];
    const entry = idx.find(e => e.id === submission_id);
    if (entry) { entry.status = 'rejected'; }
    await env.SESSIONS.put('argus:submission_index', JSON.stringify(idx), { expirationTtl: 86400 * 365 });
  } catch {}

  return json({ status: 'rejected' }, 200, request);
}

// ── Dispute Resolve (Admin) ─────────────────────────────────────────

async function handleDisputeResolve(body, env, request) {
  const { dispute_id, resolution, resolution_note } = body;
  if (!dispute_id || !resolution) return json({ error: 'Missing dispute_id or resolution' }, 400, request);
  if (!env.SESSIONS) return json({ error: 'No storage' }, 500, request);

  const dispute = await env.SESSIONS.get(`argus:dispute:${dispute_id}`, 'json');
  if (!dispute) return json({ error: 'Dispute not found' }, 404, request);

  dispute.status = resolution;
  dispute.resolution_note = resolution_note || null;
  dispute.resolved_at = new Date().toISOString();
  await env.SESSIONS.put(`argus:dispute:${dispute_id}`, JSON.stringify(dispute), { expirationTtl: 86400 * 365 });

  // Update dispute index
  try {
    const idx = await env.SESSIONS.get('argus:dispute_index', 'json') || [];
    const entry = idx.find(e => e.id === dispute_id);
    if (entry) { entry.status = resolution; }
    await env.SESSIONS.put('argus:dispute_index', JSON.stringify(idx), { expirationTtl: 86400 * 365 });
  } catch {}

  // If dispute was approved, update the linked submission if we can find it
  if (resolution === 'approved' && dispute.profile_url) {
    try {
      const subIdx = await env.SESSIONS.get('argus:submission_index', 'json') || [];
      const linked = subIdx.find(e => e.url === dispute.profile_url);
      if (linked) {
        const sub = await env.SESSIONS.get(`argus:submission:${linked.id}`, 'json');
        if (sub) {
          sub.disputed = true;
          sub.dispute_outcome = 'upheld';
          sub.dispute_note = resolution_note || 'Dispute approved — analysis may contain errors.';
          await env.SESSIONS.put(`argus:submission:${linked.id}`, JSON.stringify(sub), { expirationTtl: 86400 * 365 });
        }
      }
    } catch {}
  }

  // Notify the claimant via email
  if (dispute.claimant_email && env.RESEND_API_KEY) {
    try {
      const outcome = resolution === 'approved' ? 'approved' : 'reviewed and not upheld';
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'ARGUS <argus@googleadsagent.ai>',
          to: [dispute.claimant_email],
          subject: `ARGUS Dispute ${resolution === 'approved' ? 'Approved' : 'Update'} — ${dispute.dispute_type}`,
          html: `<div style="font-family:sans-serif;background:#08080d;color:#e8e6e3;padding:32px;">
            <div style="max-width:540px;margin:0 auto;">
              <h2 style="color:#f0a830;">ARGUS Dispute Resolution</h2>
              <p>Your dispute regarding <strong>${sanitize(dispute.profile_url || dispute.dispute_type)}</strong> has been <strong>${outcome}</strong>.</p>
              ${resolution_note ? `<p style="color:#9a9aaa;border-left:3px solid #f0a830;padding-left:12px;">${sanitize(resolution_note)}</p>` : ''}
              <p style="color:#686880;font-size:12px;margin-top:24px;">ARGUS by <a href="https://googleadsagent.ai" style="color:#f0a830;">googleadsagent.ai</a></p>
            </div></div>`,
        }),
      });
    } catch (e) { console.error('[ARGUS] Dispute email error:', e); }
  }

  return json({ status: 'resolved', resolution }, 200, request);
}

// ── Published List (Public) ─────────────────────────────────────────

async function handlePublishedList(env, request) {
  if (!env.SESSIONS) return json({ reports: [] }, 200, request);
  try {
    const pub = await env.SESSIONS.get('argus:published_index', 'json') || [];
    const reports = pub.map(p => ({
      slug: p.slug || p.id,
      url: p.url,
      platform: p.platform,
      trust_score: p.trust_score,
      risk_level: p.risk_level,
      verdict: p.verdict,
      published_at: p.published_at,
      report_url: `/tools/argus/report/${p.slug || p.id}`,
    }));
    return json({ reports, total: reports.length }, 200, request);
  } catch { return json({ reports: [] }, 200, request); }
}

// ── Email ───────────────────────────────────────────────────────────

async function sendResultsEmail(sub, env) {
  const key = env.RESEND_API_KEY;
  if (!key) { console.log('[ARGUS] RESEND_API_KEY not set'); return false; }

  const a = sub.analysis;
  const scoreColor = a.trust_score <= 25 ? '#dc2626' : a.trust_score <= 40 ? '#ea580c' : a.trust_score <= 60 ? '#d97706' : '#16a34a';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#08080d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;">
<div style="text-align:center;margin-bottom:32px;">
  <div style="display:inline-block;background:linear-gradient(135deg,#f0a830,#b07518);color:#08080d;font-weight:800;padding:8px 20px;border-radius:8px;font-size:18px;letter-spacing:2px;">ARGUS</div>
  <p style="color:#9a9aaa;font-size:14px;margin-top:8px;">Authenticity Analysis Complete</p>
</div>

<div style="background:#0e0e16;border:1px solid #2a2a3a;border-radius:16px;padding:32px;margin-bottom:24px;">
  <div style="text-align:center;margin-bottom:24px;">
    <div style="font-size:64px;font-weight:800;color:${scoreColor};line-height:1;">${a.trust_score}</div>
    <div style="font-size:13px;color:${scoreColor};font-weight:600;letter-spacing:2px;text-transform:uppercase;margin-top:4px;">${a.risk_level} RISK</div>
    <div style="font-size:12px;color:#686880;margin-top:4px;">Trust Score / 100</div>
  </div>
  <div style="background:#14141f;border-radius:8px;padding:16px;margin-bottom:16px;">
    <div style="color:#f0a830;font-size:12px;font-weight:600;margin-bottom:6px;letter-spacing:1px;">VERDICT</div>
    <div style="color:#e8e6e3;font-size:15px;line-height:1.5;">${a.verdict}</div>
  </div>
  <div style="font-size:12px;color:#686880;">
    Analyzed: <span style="color:#9a9aaa;">${sub.input_url}</span><br>
    Platform: <span style="color:#9a9aaa;">${sub.platform}</span> &middot;
    Type: <span style="color:#9a9aaa;">${sub.input_type}</span>
  </div>
</div>

<div style="background:#0e0e16;border:1px solid #2a2a3a;border-radius:16px;padding:24px;margin-bottom:24px;">
  <div style="color:#f0a830;font-size:12px;font-weight:600;margin-bottom:12px;letter-spacing:1px;">ENGINE SCORES</div>
  ${['image', 'text', 'behavioral', 'network'].map(eng => {
    const e = a.engines?.[eng] || {};
    const c = (e.score || 50) <= 25 ? '#dc2626' : (e.score || 50) <= 40 ? '#ea580c' : (e.score || 50) <= 60 ? '#d97706' : '#16a34a';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #1a1a2a;">
      <div><div style="color:#e8e6e3;font-size:14px;font-weight:500;text-transform:capitalize;">${eng}</div><div style="color:#686880;font-size:12px;">${e.summary || ''}</div></div>
      <div style="color:${c};font-size:20px;font-weight:700;">${e.score ?? '?'}</div>
    </div>`;
  }).join('')}
</div>

${a.bot_detection ? `<div style="background:#0e0e16;border:1px solid #2a2a3a;border-radius:16px;padding:24px;margin-bottom:24px;">
  <div style="color:#f87171;font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:1px;">BOT DETECTION</div>
  <div style="color:#e8e6e3;font-size:14px;line-height:1.6;">${a.bot_detection.detail || ''}</div>
  ${(a.bot_detection.indicators || []).map(i => `<div style="color:#f87171;font-size:12px;margin-top:4px;">• ${i}</div>`).join('')}
</div>` : ''}

<div style="background:#0e0e16;border:1px solid #2a2a3a;border-radius:16px;padding:24px;margin-bottom:24px;">
  <div style="color:#f0a830;font-size:12px;font-weight:600;margin-bottom:8px;letter-spacing:1px;">DETAILED ANALYSIS</div>
  <div style="color:#9a9aaa;font-size:14px;line-height:1.7;white-space:pre-wrap;">${a.detailed_analysis || ''}</div>
</div>

<div style="text-align:center;margin-top:24px;">
  <a href="${sub.published_url}" style="display:inline-block;background:#f0a830;color:#08080d;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">View Full Report</a>
</div>

<div style="text-align:center;margin-top:32px;padding-top:24px;border-top:1px solid #2a2a3a;">
  <div style="color:#686880;font-size:11px;">
    ARGUS by <a href="https://googleadsagent.ai" style="color:#f0a830;text-decoration:none;">googleadsagent.ai</a><br>
    This is an algorithmic opinion, not a factual determination.<br>
    <a href="https://googleadsagent.ai/tools/argus/dispute.html" style="color:#9a9aaa;text-decoration:none;">Dispute this analysis</a>
  </div>
</div>
</div></body></html>`;

  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'ARGUS <argus@googleadsagent.ai>',
        to: [sub.submitter_email],
        subject: `ARGUS Analysis: ${a.risk_level.toUpperCase()} risk (${a.trust_score}/100) — ${sub.platform} ${sub.input_type}`,
        html,
      }),
    });
    const result = await resp.json();
    return !!result.id;
  } catch (e) {
    console.error('[ARGUS] Resend error:', e);
    return false;
  }
}

// ── Admin Queue ─────────────────────────────────────────────────────

async function handleAdminQueue(env, request) {
  if (!env.SESSIONS) return json({ submissions: [] }, 200, request);
  try {
    const idx = await env.SESSIONS.get('argus:submission_index', 'json') || [];
    const submissions = [];
    for (const entry of idx.slice(0, 100)) {
      const full = await env.SESSIONS.get(`argus:submission:${entry.id}`, 'json');
      if (full) submissions.push(full);
    }
    return json({ submissions }, 200, request);
  } catch { return json({ submissions: [] }, 200, request); }
}

async function handleAdminDisputes(env, request) {
  if (!env.SESSIONS) return json({ disputes: [] }, 200, request);
  try {
    const idx = await env.SESSIONS.get('argus:dispute_index', 'json') || [];
    const disputes = [];
    for (const entry of idx.slice(0, 100)) {
      const full = await env.SESSIONS.get(`argus:dispute:${entry.id}`, 'json');
      if (full) disputes.push(full);
    }
    return json({ disputes }, 200, request);
  } catch { return json({ disputes: [] }, 200, request); }
}

async function handleStats(env, request) {
  if (!env.SESSIONS) return json({}, 200, request);
  try {
    const idx = await env.SESSIONS.get('argus:submission_index', 'json') || [];
    const disputeIdx = await env.SESSIONS.get('argus:dispute_index', 'json') || [];
    const total = idx.length;
    const queued = idx.filter(e => e.status === 'queued').length;
    const analyzed = idx.filter(e => e.status === 'analyzed').length;
    const published = idx.filter(e => e.status === 'published').length;
    const rejected = idx.filter(e => e.status === 'rejected').length;

    // Fetch full submissions for chart data
    const allSubs = [];
    for (const entry of idx.slice(0, 200)) {
      const full = await env.SESSIONS.get(`argus:submission:${entry.id}`, 'json');
      if (full) allSubs.push(full);
    }

    // Platform distribution
    const platforms = {};
    allSubs.forEach(s => { const p = s.platform || 'unknown'; platforms[p] = (platforms[p] || 0) + 1; });

    // Score distribution (buckets: 0-20, 21-40, 41-60, 61-80, 81-100)
    const scoreBuckets = [0, 0, 0, 0, 0];
    const scores = [];
    allSubs.forEach(s => {
      if (s.analysis?.trust_score != null) {
        const sc = s.analysis.trust_score;
        scores.push(sc);
        if (sc <= 20) scoreBuckets[0]++;
        else if (sc <= 40) scoreBuckets[1]++;
        else if (sc <= 60) scoreBuckets[2]++;
        else if (sc <= 80) scoreBuckets[3]++;
        else scoreBuckets[4]++;
      }
    });

    // Risk level distribution
    const riskLevels = { critical: 0, high: 0, medium: 0, low: 0 };
    allSubs.forEach(s => { if (s.analysis?.risk_level) riskLevels[s.analysis.risk_level] = (riskLevels[s.analysis.risk_level] || 0) + 1; });

    // Submissions over time (by date)
    const timeline = {};
    allSubs.forEach(s => { const d = (s.created_at || '').slice(0, 10); if (d) timeline[d] = (timeline[d] || 0) + 1; });

    // Group by poster domain
    const posterDomains = {};
    allSubs.forEach(s => {
      try { const h = new URL(s.input_url).hostname.replace('www.', ''); posterDomains[h] = (posterDomains[h] || 0) + 1; } catch {}
    });

    // Group by submitter IP (anonymous grouping)
    const submitters = {};
    allSubs.forEach(s => {
      const key = s.submitter_email || s.submitter_ip || 'anonymous';
      if (!submitters[key]) submitters[key] = { count: 0, submissions: [] };
      submitters[key].count++;
      submitters[key].submissions.push({ id: s.id, url: s.input_url, platform: s.platform, status: s.status, score: s.analysis?.trust_score });
    });

    // Group by subject URL poster
    const subjectPosters = {};
    allSubs.forEach(s => {
      const poster = s.analysis?.poster_profile?.username || s.analysis?.platform_data?.username || null;
      if (poster) {
        if (!subjectPosters[poster]) subjectPosters[poster] = { count: 0, submissions: [] };
        subjectPosters[poster].count++;
        subjectPosters[poster].submissions.push({ id: s.id, url: s.input_url, platform: s.platform, score: s.analysis?.trust_score });
      }
    });

    // Input type distribution
    const inputTypes = {};
    allSubs.forEach(s => { const t = s.input_type || 'unknown'; inputTypes[t] = (inputTypes[t] || 0) + 1; });

    // Average score
    const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

    return json({
      total, queued, analyzed, published, rejected, disputes: disputeIdx.length,
      charts: {
        platforms, scoreBuckets, riskLevels, timeline, inputTypes,
        posterDomains, avgScore,
      },
      grouping: { submitters, subjectPosters },
    }, 200, request);
  } catch (e) { console.error('[ARGUS] Stats error:', e); return json({}, 200, request); }
}

// ── CORS ────────────────────────────────────────────────────────────

export async function onRequestOptions({ request }) {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(request),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
      'Access-Control-Max-Age': '86400',
    },
  });
}
